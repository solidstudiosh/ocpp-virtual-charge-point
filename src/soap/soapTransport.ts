import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { gunzipSync, gzipSync, inflateSync } from "node:zlib";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../logger";
import type { OcppCall, OcppCallError } from "../ocppMessage";
import type {
  OcppTransport,
  OcppTransportHandlers,
} from "../transport/ocppTransport";
import {
  decodeBody,
  encodeFaultEnvelope,
  encodeRequestEnvelope,
  encodeResponseEnvelope,
  Ocpp12CodecError,
  parseEnvelope,
  SOAP12_MEDIA_TYPE,
} from "./ocpp12Codec";
import { findOperation, type Ocpp12Namespace } from "./ocpp12Schema";

export interface SoapTransportOptions {
  /** CentralSystemService URL, e.g. http://gateway:8080/ocpp/CentralSystemService */
  centralSystemUrl: string;
  chargePointId: string;
  namespace: Ocpp12Namespace;
  /** Port of this charge point's ChargePointService. */
  serverPort: number;
  /** ChargePointService URL the central system can reach; sent as wsa:From. */
  advertisedUrl: string;
  requestTimeoutMs?: number;
  answerTimeoutMs?: number;
}

interface PendingAnswer {
  response: ServerResponse;
  namespace: Ocpp12Namespace;
  relatesTo?: string;
  gzip: boolean;
  timer: ReturnType<typeof setTimeout>;
}

const urnMessageId = () => `urn:uuid:${uuidv4()}`;

/**
 * OCPP 1.2 over SOAP 1.2 / HTTP. Each outgoing call is one POST to the
 * CentralSystemService and its HTTP response is the result; calls go out one
 * at a time, in order, like a box that waits for each answer (StartTransaction
 * before its MeterValues). Calls from the central system arrive on a small
 * ChargePointService server and are answered in the HTTP response once the
 * VCP responds.
 */
export class SoapTransport implements OcppTransport {
  private server?: Server;
  private handlers?: OcppTransportHandlers;
  private outgoing: Promise<void> = Promise.resolve();
  private pending = new Map<string, PendingAnswer>();
  private closed = false;

  constructor(private options: SoapTransportOptions) {}

  connect(handlers: OcppTransportHandlers): Promise<void> {
    this.handlers = handlers;
    this.closed = false;
    return new Promise((resolve, reject) => {
      const server = createServer((request, response) => {
        this.onRequest(request, response).catch((error) => {
          logger.error(`ChargePointService request failed: ${error}`);
          if (!response.headersSent) {
            response.statusCode = 500;
            response.end();
          }
        });
      });
      server.once("error", reject);
      server.listen(this.options.serverPort, () => {
        server.off("error", reject);
        server.on("error", (error) => {
          logger.error(`ChargePointService server error: ${error}`);
          handlers.onError(error);
        });
        logger.info(
          `ChargePointService listening on :${this.options.serverPort}, advertised as ${this.options.advertisedUrl}`,
        );
        resolve();
      });
      this.server = server;
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  sendCall(call: OcppCall<any>, beforeWrite?: () => void) {
    this.requireOpen();
    const operation = findOperation(call.action);
    if (!operation || operation.service !== "Cs") {
      throw new Error(`OCPP 1.2 has no CentralSystemService ${call.action}`);
    }
    const xml = encodeRequestEnvelope({
      operation,
      namespace: this.options.namespace,
      payload: call.payload,
      chargeBoxIdentity: this.options.chargePointId,
      messageId: urnMessageId(),
      from: this.options.advertisedUrl,
      to: this.options.centralSystemUrl,
    });
    logger.info(`Sending message ➡️  ${xml}`);
    beforeWrite?.();
    this.outgoing = this.outgoing.then(() => this.post(call, xml));
  }

  sendCallResult(
    messageId: string,
    action: string,
    // biome-ignore lint/suspicious/noExplicitAny: ocpp types
    payload: any,
    beforeWrite?: () => void,
  ) {
    const operation = findOperation(action);
    if (!operation || operation.service !== "Cp") {
      throw new Error(`OCPP 1.2 has no ChargePointService ${action}`);
    }
    const pending = this.takePending(messageId);
    if (!pending) {
      return;
    }
    const xml = encodeResponseEnvelope({
      operation,
      namespace: pending.namespace,
      payload,
      messageId: urnMessageId(),
      relatesTo: pending.relatesTo,
    });
    logger.info(`Responding with ➡️  ${xml}`);
    beforeWrite?.();
    this.answer(pending, 200, xml);
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  sendCallError(error: OcppCallError<any>) {
    const pending = this.takePending(error.messageId);
    if (!pending) {
      return;
    }
    const notSupported = ["NotImplemented", "NotSupported"].includes(
      error.errorCode,
    );
    const xml = encodeFaultEnvelope({
      code: "Receiver",
      subcode: notSupported ? "NotSupported" : "InternalError",
      reason: error.errorDescription || error.errorCode,
      messageId: urnMessageId(),
      relatesTo: pending.relatesTo,
    });
    logger.info(`Responding with ➡️  ${xml}`);
    this.answer(pending, 500, xml);
  }

  close() {
    this.requireOpen();
    this.closed = true;
    for (const pending of Array.from(this.pending.values())) {
      clearTimeout(pending.timer);
      pending.response.destroy();
    }
    this.pending.clear();
    this.server?.close();
    this.server?.closeAllConnections();
    this.server = undefined;
  }

  private requireOpen() {
    if (!this.server || this.closed) {
      throw new Error("Websocket not initialized. Call connect() first");
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  private async post(call: OcppCall<any>, xml: string): Promise<void> {
    if (this.closed) {
      return;
    }
    const handlers = this.handlers as OcppTransportHandlers;
    let body: string;
    try {
      const response = await fetch(this.options.centralSystemUrl, {
        method: "POST",
        headers: {
          "Content-Type": `${SOAP12_MEDIA_TYPE}; charset=utf-8; action="/${call.action}"`,
          "Accept-Encoding": "gzip, deflate",
        },
        body: xml,
        signal: AbortSignal.timeout(this.options.requestTimeoutMs ?? 30_000),
      });
      body = await response.text();
    } catch (error) {
      logger.error(`${call.action} not delivered: ${error}`);
      this.safely(() =>
        handlers.onCallError({
          messageId: call.messageId,
          errorCode: "GenericError",
          errorDescription: `CentralSystemService unreachable: ${error}`,
        }),
      );
      return;
    }
    if (this.closed) {
      return;
    }
    logger.info(`Receive message ⬅️  ${body}`);
    this.safely(() => {
      const envelope = parseEnvelope(body);
      if (envelope.fault) {
        handlers.onCallError({
          messageId: call.messageId,
          errorCode: envelope.fault.subcode ?? envelope.fault.code,
          errorDescription: envelope.fault.reason,
        });
        return;
      }
      const decoded = decodeBody(
        envelope.body as NonNullable<typeof envelope.body>,
      );
      if (
        decoded.kind !== "response" ||
        decoded.operation.action !== call.action
      ) {
        throw new Ocpp12CodecError(
          `Expected the ${call.action} response, got ${decoded.operation.action} ${decoded.kind}`,
        );
      }
      handlers.onCallResult(call.messageId, decoded.payload);
    });
  }

  private safely(run: () => void) {
    try {
      run();
    } catch (error) {
      logger.error(`SOAP message not processed: ${error}`);
    }
  }

  private async onRequest(request: IncomingMessage, response: ServerResponse) {
    const gzip = /\bgzip\b/.test(
      String(request.headers["accept-encoding"] ?? ""),
    );
    if (request.method !== "POST") {
      response.statusCode = 405;
      response.end();
      return;
    }
    const xml = decompress(
      await readBody(request),
      String(request.headers["content-encoding"] ?? ""),
    ).toString("utf8");
    logger.info(`Receive message ⬅️  ${xml}`);
    const fault = (
      code: "Sender" | "Receiver",
      subcode: string,
      reason: string,
      relatesTo?: string,
    ) => {
      const faultXml = encodeFaultEnvelope({
        code,
        subcode,
        reason,
        messageId: urnMessageId(),
        relatesTo,
      });
      logger.warn(`Responding with SOAP fault ➡️  ${faultXml}`);
      writeSoap(response, code === "Sender" ? 400 : 500, faultXml, gzip);
    };

    let envelope: ReturnType<typeof parseEnvelope>;
    let decoded: ReturnType<typeof decodeBody>;
    try {
      envelope = parseEnvelope(xml);
      if (!envelope.body) {
        throw new Ocpp12CodecError("A fault is not a request");
      }
      decoded = decodeBody(envelope.body);
      if (decoded.kind !== "request" || decoded.operation.service !== "Cp") {
        throw new Ocpp12CodecError(
          `<${envelope.body.name}> is not a ChargePointService request`,
        );
      }
    } catch (error) {
      fault("Sender", "ProtocolError", String(error));
      return;
    }
    const relatesTo = envelope.headers.messageId;
    if (envelope.headers.chargeBoxIdentity !== this.options.chargePointId) {
      fault(
        "Sender",
        "IdentityMismatch",
        `chargeBoxIdentity '${envelope.headers.chargeBoxIdentity}' is not '${this.options.chargePointId}'`,
        relatesTo,
      );
      return;
    }

    const messageId = uuidv4();
    const timer = setTimeout(() => {
      if (this.pending.delete(messageId)) {
        fault("Receiver", "InternalError", "No answer in time", relatesTo);
      }
    }, this.options.answerTimeoutMs ?? 15_000);
    this.pending.set(messageId, {
      response,
      namespace: decoded.namespace,
      relatesTo,
      gzip,
      timer,
    });
    try {
      (this.handlers as OcppTransportHandlers).onCall({
        messageId,
        action: decoded.operation.action,
        payload: decoded.payload,
      });
    } catch (error) {
      logger.error(`${decoded.operation.action} not handled: ${error}`);
      const pending = this.pending.get(messageId);
      if (pending) {
        this.pending.delete(messageId);
        clearTimeout(pending.timer);
        fault("Receiver", "NotSupported", String(error), relatesTo);
      }
    }
  }

  // Undefined once the request timed out or the transport closed: the answer
  // has nowhere to go, which is not worth crashing the VCP for.
  private takePending(messageId: string): PendingAnswer | undefined {
    const pending = this.pending.get(messageId);
    if (!pending) {
      logger.warn(
        `No SOAP request waiting for an answer with messageId=${messageId}`,
      );
      return undefined;
    }
    this.pending.delete(messageId);
    clearTimeout(pending.timer);
    return pending;
  }

  private answer(pending: PendingAnswer, status: number, xml: string) {
    writeSoap(pending.response, status, xml, pending.gzip);
  }
}

const readBody = (request: IncomingMessage): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });

const decompress = (body: Buffer, encoding?: string): Buffer => {
  switch ((encoding ?? "").trim().toLowerCase()) {
    case "gzip":
    case "x-gzip":
      return gunzipSync(body);
    case "deflate":
      return inflateSync(body);
    default:
      return body;
  }
};

const writeSoap = (
  response: ServerResponse,
  status: number,
  xml: string,
  gzip: boolean,
) => {
  const body = gzip ? gzipSync(xml) : Buffer.from(xml, "utf8");
  response.writeHead(status, {
    "Content-Type": `${SOAP12_MEDIA_TYPE}; charset=utf-8`,
    ...(gzip && { "Content-Encoding": "gzip" }),
    "Content-Length": body.length,
  });
  response.end(body);
};
