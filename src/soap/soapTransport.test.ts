import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { gzipSync } from "node:zlib";
import type { OcppCall, OcppCallError } from "../ocppMessage";
import type { OcppTransportHandlers } from "../transport/ocppTransport";
import {
  decodeBody,
  encodeRequestEnvelope,
  encodeResponseEnvelope,
  parseEnvelope,
} from "./ocpp12Codec";
import { findOperation, type Operation } from "./ocpp12Schema";
import { SoapTransport } from "./soapTransport";

const NOW = "2026-10-31T20:00:00.000Z";
const op = (action: string) => findOperation(action) as Operation;

/** A central system that answers every request with the given response payloads. */
const centralSystem = (answers: Record<string, object>) => {
  const received: { action: string; headers: object; payload: object }[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (c: Buffer) => chunks.push(c));
    request.on("end", () => {
      const envelope = parseEnvelope(Buffer.concat(chunks).toString("utf8"));
      const decoded = decodeBody(
        envelope.body as NonNullable<typeof envelope.body>,
      );
      received.push({
        action: decoded.operation.action,
        headers: envelope.headers,
        payload: decoded.payload,
      });
      const xml = encodeResponseEnvelope({
        operation: decoded.operation,
        namespace: decoded.namespace,
        payload: answers[decoded.operation.action] ?? {},
        messageId: "urn:uuid:cs",
        relatesTo: envelope.headers.messageId,
      });
      response.writeHead(200, {
        "Content-Type": "application/soap+xml",
        "Content-Encoding": "gzip",
      });
      response.end(gzipSync(xml));
    });
  });
  return { server, received, url: "" };
};

const listen = (server: Server) =>
  new Promise<number>((resolve) =>
    server.listen(0, () => resolve((server.address() as AddressInfo).port)),
  );

describe("SoapTransport", () => {
  const cs = centralSystem({
    BootNotification: {
      status: "Accepted",
      currentTime: NOW,
      heartbeatInterval: 30,
    },
    StartTransaction: { transactionId: 7, idTagInfo: { status: "Accepted" } },
  });
  const calls: OcppCall[] = [];
  const results: { messageId: string; payload: object }[] = [];
  const errors: OcppCallError[] = [];
  const handlers: OcppTransportHandlers = {
    onCall: (call) => calls.push(call),
    onCallResult: (messageId, payload) => results.push({ messageId, payload }),
    onCallError: (error) => errors.push(error),
    onClose: () => assert.fail("onClose"),
    onError: (error) => assert.fail(error),
  };
  let transport: SoapTransport;
  let boxPort: number;

  before(async () => {
    const csPort = await listen(cs.server);
    cs.url = `http://127.0.0.1:${csPort}/ocpp/CentralSystemService`;
    const probe = createServer();
    boxPort = await listen(probe);
    probe.close();
    transport = new SoapTransport({
      centralSystemUrl: cs.url,
      chargePointId: "CB-1",
      namespace: "2010_10",
      serverPort: boxPort,
      advertisedUrl: `http://box:${boxPort}/ocpp/ChargePointService/CB-1`,
      answerTimeoutMs: 300,
    });
    await transport.connect(handlers);
  });

  after(() => {
    transport.close();
    cs.server.close();
  });

  it("sends calls one at a time, in order, and hands back each result", async () => {
    transport.sendCall({
      messageId: "m1",
      action: "BootNotification",
      payload: { chargePointVendor: "V", chargePointModel: "M" },
    });
    transport.sendCall({
      messageId: "m2",
      action: "StartTransaction",
      payload: { connectorId: 1, idTag: "T", timestamp: NOW, meterStart: 0 },
    });
    transport.sendCall({
      messageId: "m3",
      action: "MeterValues",
      payload: { connectorId: 1, values: [{ timestamp: NOW, value: 10 }] },
    });
    while (results.length < 3) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.deepEqual(
      cs.received.map((r) => r.action),
      ["BootNotification", "StartTransaction", "MeterValues"],
    );
    assert.deepEqual(results, [
      {
        messageId: "m1",
        payload: {
          status: "Accepted",
          currentTime: NOW,
          heartbeatInterval: 30,
        },
      },
      {
        messageId: "m2",
        payload: { transactionId: 7, idTagInfo: { status: "Accepted" } },
      },
      { messageId: "m3", payload: {} },
    ]);
    assert.deepEqual(
      { ...cs.received[0].headers, messageId: undefined },
      {
        chargeBoxIdentity: "CB-1",
        action: "/BootNotification",
        messageId: undefined,
        relatesTo: undefined,
        from: `http://box:${boxPort}/ocpp/ChargePointService/CB-1`,
        replyTo: "http://www.w3.org/2005/08/addressing/anonymous",
        to: cs.url,
      },
    );
  });

  const post = async (body: string, gzip = false) => {
    const response = await fetch(
      `http://127.0.0.1:${boxPort}/ocpp/ChargePointService/CB-1`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/soap+xml; charset=utf-8",
          ...(gzip && { "Content-Encoding": "gzip" }),
        },
        body: gzip ? gzipSync(body) : body,
      },
    );
    return {
      status: response.status,
      envelope: parseEnvelope(await response.text()),
    };
  };

  const commandEnvelope = (
    action: string,
    payload: object,
    namespace: "2010_08" | "2010_10" = "2010_10",
    chargeBoxIdentity = "CB-1",
  ) =>
    encodeRequestEnvelope({
      operation: op(action),
      namespace,
      payload,
      chargeBoxIdentity,
      messageId: "urn:uuid:cmd",
      to: `http://box:${boxPort}/ocpp/ChargePointService/CB-1`,
    });

  it("answers a command in the HTTP response, in the request's namespace", async () => {
    const pending = post(
      commandEnvelope(
        "RemoteStartTransaction",
        { idTag: "T", connectorId: 2 },
        "2010_08",
      ),
      true,
    );
    while (calls.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const call = calls[0];
    assert.equal(call.action, "RemoteStartTransaction");
    // 2010/08 has no connectorId, so it is not even written.
    assert.deepEqual(call.payload, { idTag: "T" });
    transport.sendCallResult(call.messageId, call.action, {
      status: "Accepted",
    });
    const { status, envelope } = await pending;
    assert.equal(status, 200);
    assert.equal(envelope.headers.action, "/RemoteStartTransactionResponse");
    assert.equal(envelope.headers.relatesTo, "urn:uuid:cmd");
    const decoded = decodeBody(
      envelope.body as NonNullable<typeof envelope.body>,
    );
    assert.equal(decoded.namespace, "2010_08");
    assert.deepEqual(decoded.payload, { status: "Accepted" });
  });

  it("faults a command for another box, an unknown element and a missing answer", async () => {
    const wrongBox = await post(
      commandEnvelope("Reset", { type: "Soft" }, "2010_10", "OTHER"),
    );
    assert.equal(wrongBox.status, 400);
    assert.equal(wrongBox.envelope.fault?.subcode, "IdentityMismatch");

    const garbage = await post("<nope/>");
    assert.equal(garbage.status, 400);
    assert.equal(garbage.envelope.fault?.subcode, "ProtocolError");

    const before = calls.length;
    const unanswered = await post(commandEnvelope("Reset", { type: "Soft" }));
    assert.equal(calls.length, before + 1);
    assert.equal(unanswered.status, 500);
    assert.equal(unanswered.envelope.fault?.subcode, "InternalError");
  });

  it("reports an unreachable central system as a call error", async () => {
    const offline = new SoapTransport({
      centralSystemUrl: "http://127.0.0.1:1/ocpp/CentralSystemService",
      chargePointId: "CB-2",
      namespace: "2010_08",
      serverPort: 0,
      advertisedUrl: "http://box/",
    });
    await offline.connect(handlers);
    offline.sendCall({ messageId: "x1", action: "Heartbeat", payload: {} });
    while (errors.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    offline.close();
    assert.equal(errors[0].messageId, "x1");
    assert.equal(errors[0].errorCode, "GenericError");
  });
});
