import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeBody,
  encodeFaultEnvelope,
  encodeRequestEnvelope,
  encodeResponseEnvelope,
  Ocpp12CodecError,
  parseEnvelope,
} from "./ocpp12Codec";
import {
  findOperation,
  OCPP12_NAMESPACES,
  OCPP12_OPERATIONS,
  type Operation,
} from "./ocpp12Schema";

const NOW = "2026-10-31T20:00:00.000Z";
const IDTAG_INFO = { status: "Accepted", expiryDate: NOW, parentIdTag: "P1" };

// One payload per message with every field the WSDL defines filled in.
const SAMPLES: Record<string, { request: object; response: object }> = {
  Authorize: {
    request: { idTag: "TAG1" },
    response: { idTagInfo: IDTAG_INFO },
  },
  StartTransaction: {
    request: { connectorId: 1, idTag: "TAG1", timestamp: NOW, meterStart: 0 },
    response: { transactionId: 42, idTagInfo: { status: "Accepted" } },
  },
  StopTransaction: {
    request: {
      transactionId: 42,
      idTag: "TAG1",
      timestamp: NOW,
      meterStop: 1234,
    },
    response: { idTagInfo: IDTAG_INFO },
  },
  Heartbeat: { request: {}, response: { currentTime: NOW } },
  MeterValues: {
    request: {
      connectorId: 1,
      values: [
        { timestamp: NOW, value: 100 },
        { timestamp: NOW, value: 250 },
      ],
    },
    response: {},
  },
  BootNotification: {
    request: {
      chargePointVendor: "Vendor",
      chargePointModel: "Model",
      chargePointSerialNumber: "CP1",
      chargeBoxSerialNumber: "CB1",
      firmwareVersion: "1.0",
      iccid: "ICC",
      imsi: "IMSI",
      meterType: "MT",
      meterSerialNumber: "MS",
    },
    response: { status: "Accepted", currentTime: NOW, heartbeatInterval: 30 },
  },
  StatusNotification: {
    request: { connectorId: 1, status: "Occupied", errorCode: "NoError" },
    response: {},
  },
  FirmwareStatusNotification: {
    request: { status: "Installed" },
    response: {},
  },
  DiagnosticsStatusNotification: {
    request: { status: "Uploaded" },
    response: {},
  },
  UnlockConnector: {
    request: { connectorId: 1 },
    response: { status: "Accepted" },
  },
  Reset: { request: { type: "Soft" }, response: { status: "Accepted" } },
  ChangeAvailability: {
    request: { connectorId: 0, type: "Inoperative" },
    response: { status: "Scheduled" },
  },
  GetDiagnostics: {
    request: {
      location: "ftp://example.com/diag",
      startTime: NOW,
      stopTime: NOW,
      retries: 2,
      retryInterval: 30,
    },
    response: { fileName: "diag.zip" },
  },
  ClearCache: { request: {}, response: { status: "Accepted" } },
  UpdateFirmware: {
    request: {
      retrieveDate: NOW,
      location: "http://example.com/fw.bin",
      retries: 1,
      retryInterval: 60,
    },
    response: {},
  },
  ChangeConfiguration: {
    request: { key: "HeartBeatInterval", value: "60" },
    response: { status: "Accepted" },
  },
  RemoteStartTransaction: {
    request: { idTag: "TAG1" },
    response: { status: "Accepted" },
  },
  RemoteStopTransaction: {
    request: { transactionId: 42 },
    response: { status: "Rejected" },
  },
};

const operation = (action: string): Operation => {
  const found = findOperation(action);
  assert.ok(found, action);
  return found;
};

const roundTrip = (xml: string) => {
  const envelope = parseEnvelope(xml);
  assert.ok(envelope.body, "body");
  return { envelope, decoded: decodeBody(envelope.body) };
};

describe("OCPP 1.2 codec", () => {
  it("has a sample for every operation", () => {
    assert.deepEqual(
      OCPP12_OPERATIONS.map((o) => o.action).sort(),
      Object.keys(SAMPLES).sort(),
    );
  });

  for (const namespace of OCPP12_NAMESPACES) {
    for (const op of OCPP12_OPERATIONS) {
      it(`round-trips ${op.action} request and response in ${namespace}`, () => {
        const sample = SAMPLES[op.action];
        const request = roundTrip(
          encodeRequestEnvelope({
            operation: op,
            namespace,
            payload: sample.request,
            chargeBoxIdentity: "CB-1",
            messageId: "urn:uuid:1",
            from: "http://box:9100/ocpp/ChargePointService/CB-1",
            to: "http://cs/ocpp",
          }),
        );
        assert.equal(request.decoded.operation, op);
        assert.equal(request.decoded.kind, "request");
        assert.equal(request.decoded.namespace, namespace);
        assert.deepEqual(request.decoded.payload, sample.request);
        assert.deepEqual(request.envelope.headers, {
          chargeBoxIdentity: "CB-1",
          action: `/${op.action}`,
          messageId: "urn:uuid:1",
          relatesTo: undefined,
          from: "http://box:9100/ocpp/ChargePointService/CB-1",
          replyTo: "http://www.w3.org/2005/08/addressing/anonymous",
          to: "http://cs/ocpp",
        });

        const response = roundTrip(
          encodeResponseEnvelope({
            operation: op,
            namespace,
            payload: sample.response,
            messageId: "urn:uuid:2",
            relatesTo: "urn:uuid:1",
          }),
        );
        assert.equal(response.decoded.kind, "response");
        assert.deepEqual(response.decoded.payload, sample.response);
        assert.equal(response.envelope.headers.action, `/${op.action}Response`);
        assert.equal(response.envelope.headers.relatesTo, "urn:uuid:1");
      });
    }
  }

  it("writes the body and chargeBoxIdentity in the service's namespace, fields in WSDL order", () => {
    const xml = encodeRequestEnvelope({
      operation: operation("StartTransaction"),
      namespace: "2010_10",
      payload: { meterStart: 5, timestamp: NOW, idTag: "T", connectorId: 2 },
      chargeBoxIdentity: "CB-1",
      messageId: "urn:uuid:1",
      to: "http://cs",
    });
    assert.match(
      xml,
      /<chargeBoxIdentity xmlns="urn:\/\/Ocpp\/Cs\/2010\/10\/">CB-1<\/chargeBoxIdentity>/,
    );
    assert.match(
      xml,
      /<startTransactionRequest xmlns="urn:\/\/Ocpp\/Cs\/2010\/10\/"><connectorId>2<\/connectorId><idTag>T<\/idTag><timestamp>[^<]+<\/timestamp><meterStart>5<\/meterStart><\/startTransactionRequest>/,
    );
  });

  it("has RemoteStartTransaction connectorId only in 2010/10, after idTag (VERSION-DIFF D1)", () => {
    const remoteStart = operation("RemoteStartTransaction");
    const write = (namespace: "2010_08" | "2010_10") =>
      encodeResponseEnvelope({
        operation: { ...remoteStart, response: remoteStart.request },
        namespace,
        payload: { idTag: "T", connectorId: 2 },
        messageId: "urn:uuid:1",
      });
    assert.match(
      write("2010_10"),
      /<idTag>T<\/idTag><connectorId>2<\/connectorId>/,
    );
    assert.doesNotMatch(write("2010_08"), /connectorId/);

    const read = (ns: string) =>
      decodeBody(
        parseEnvelope(
          `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><remoteStartTransactionRequest xmlns="urn://Ocpp/Cp/${ns}/"><idTag>T</idTag><connectorId>2</connectorId></remoteStartTransactionRequest></s:Body></s:Envelope>`,
        ).body as NonNullable<ReturnType<typeof parseEnvelope>["body"]>,
      );
    assert.deepEqual(read("2010/10").payload, { idTag: "T", connectorId: 2 });
    assert.throws(() => read("2010/08"), /Unexpected element .*connectorId/);
  });

  it("reads a request the way the gateway writes it: prefixed namespaces, any field order", () => {
    const { envelope, decoded } =
      roundTrip(`<?xml version="1.0" encoding="UTF-8"?>
      <env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope">
        <env:Header>
          <cp:chargeBoxIdentity xmlns:cp="urn://Ocpp/Cp/2010/08/">CB-1</cp:chargeBoxIdentity>
          <a:Action xmlns:a="http://www.w3.org/2005/08/addressing" env:mustUnderstand="true">/ChangeAvailability</a:Action>
          <a:MessageID xmlns:a="http://www.w3.org/2005/08/addressing">urn:uuid:abc</a:MessageID>
          <a:ReplyTo xmlns:a="http://www.w3.org/2005/08/addressing"><a:Address>http://www.w3.org/2005/08/addressing/anonymous</a:Address></a:ReplyTo>
          <a:To xmlns:a="http://www.w3.org/2005/08/addressing">http://box:9100/x</a:To>
        </env:Header>
        <env:Body>
          <ns2:changeAvailabilityRequest xmlns:ns2="urn://Ocpp/Cp/2010/08/">
            <ns2:type>Operative</ns2:type>
            <ns2:connectorId>1</ns2:connectorId>
          </ns2:changeAvailabilityRequest>
        </env:Body>
      </env:Envelope>`);
    assert.equal(envelope.headers.chargeBoxIdentity, "CB-1");
    assert.equal(envelope.headers.action, "/ChangeAvailability");
    assert.equal(envelope.headers.messageId, "urn:uuid:abc");
    assert.equal(envelope.headers.to, "http://box:9100/x");
    assert.equal(decoded.operation.action, "ChangeAvailability");
    assert.equal(decoded.namespace, "2010_08");
    assert.deepEqual(decoded.payload, { type: "Operative", connectorId: 1 });
  });

  it("unescapes and escapes XML text", () => {
    const op = operation("ChangeConfiguration");
    const { decoded } = roundTrip(
      encodeRequestEnvelope({
        operation: op,
        namespace: "2010_08",
        payload: { key: "a<b&c", value: `"x" 'y' >` },
        chargeBoxIdentity: "CB&1",
        messageId: "urn:uuid:1",
        to: "http://cs",
      }),
    );
    assert.deepEqual(decoded.payload, { key: "a<b&c", value: `"x" 'y' >` });
  });

  it("reads a SOAP fault with its OCPP subcode", () => {
    const envelope = parseEnvelope(
      encodeFaultEnvelope({
        code: "Sender",
        subcode: "ProtocolError",
        reason: "bad <thing>",
        messageId: "urn:uuid:2",
        relatesTo: "urn:uuid:1",
      }),
    );
    assert.deepEqual(envelope.fault, {
      code: "Sender",
      subcode: "ProtocolError",
      reason: "bad <thing>",
    });
    assert.equal(envelope.headers.relatesTo, "urn:uuid:1");
  });

  it("rejects what the schema does not allow", () => {
    const body = (inner: string) =>
      decodeBody(
        parseEnvelope(
          `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>${inner}</s:Body></s:Envelope>`,
        ).body as NonNullable<ReturnType<typeof parseEnvelope>["body"]>,
      );
    const cs = 'xmlns="urn://Ocpp/Cs/2010/08/"';
    assert.throws(
      () => body(`<heartbeatResponse ${cs}></heartbeatResponse>`),
      /Missing element heartbeatResponse\/currentTime/,
    );
    assert.throws(
      () =>
        body(
          `<startTransactionResponse ${cs}><transactionId>x</transactionId><idTagInfo><status>Accepted</status></idTagInfo></startTransactionResponse>`,
        ),
      /not an int/,
    );
    assert.throws(
      () =>
        body(
          `<startTransactionResponse ${cs}><transactionId>2147483648</transactionId><idTagInfo><status>Accepted</status></idTagInfo></startTransactionResponse>`,
        ),
      /out of the int range/,
    );
    assert.throws(
      () =>
        body(
          `<heartbeatResponse ${cs}><currentTime>${NOW}</currentTime><x/></heartbeatResponse>`,
        ),
      /Unexpected element/,
    );
    assert.throws(
      () => body(`<heartbeatResponse xmlns="urn://Ocpp/Cs/2012/06/"/>`),
      /Unknown OCPP namespace/,
    );
    assert.throws(() => parseEnvelope("<not-xml"), Ocpp12CodecError);
    assert.throws(
      () =>
        encodeRequestEnvelope({
          operation: operation("MeterValues"),
          namespace: "2010_08",
          payload: { connectorId: 1, values: [{ timestamp: NOW, value: 1.5 }] },
          chargeBoxIdentity: "CB-1",
          messageId: "urn:uuid:1",
          to: "http://cs",
        }),
      /values\/value is not an int/,
    );
    assert.throws(
      () =>
        encodeRequestEnvelope({
          operation: operation("Heartbeat"),
          namespace: "2010_08",
          payload: { transactionId: 1 },
          chargeBoxIdentity: "CB-1",
          messageId: "urn:uuid:1",
          to: "http://cs",
        }),
      /unknown fields: transactionId/,
    );
  });
});
