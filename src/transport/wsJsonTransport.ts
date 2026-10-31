import { WebSocket } from "ws";
import { logger } from "../logger";
import type { OcppCall, OcppCallError } from "../ocppMessage";
import type { OcppTransport, OcppTransportHandlers } from "./ocppTransport";

export interface WsJsonTransportOptions {
  endpoint: string;
  chargePointId: string;
  protocol: string;
  basicAuthPassword?: string;
}

/** OCPP-J: JSON message arrays over one WebSocket (OCPP 1.6, 2.0.1, 2.1). */
export class WsJsonTransport implements OcppTransport {
  private ws?: WebSocket;

  constructor(private options: WsJsonTransportOptions) {}

  connect(handlers: OcppTransportHandlers): Promise<void> {
    return new Promise((resolve) => {
      const websocketUrl = `${this.options.endpoint}/${this.options.chargePointId}`;
      this.ws = new WebSocket(websocketUrl, [this.options.protocol], {
        rejectUnauthorized: false,
        followRedirects: true,
        headers: {
          ...(this.options.basicAuthPassword && {
            Authorization: `Basic ${Buffer.from(
              `${this.options.chargePointId}:${this.options.basicAuthPassword}`,
            ).toString("base64")}`,
          }),
        },
      });

      this.ws.on("open", () => resolve());
      this.ws.on("message", (message: string) =>
        this.onMessage(message, handlers),
      );
      this.ws.on("ping", () => {
        logger.info("Received PING");
      });
      this.ws.on("pong", () => {
        logger.info("Received PONG");
      });
      this.ws.on("close", (code: number, reason: string) =>
        handlers.onClose(code, reason),
      );
      this.ws.on("error", (error: Error) => {
        logger.error("Websocket error:");
        logger.error(error);
        handlers.onError(error);
      });
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  sendCall(call: OcppCall<any>) {
    const jsonMessage = JSON.stringify([
      2,
      call.messageId,
      call.action,
      call.payload,
    ]);
    logger.info(`Sending message ➡️  ${jsonMessage}`);
    this.socket().send(jsonMessage);
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  sendCallResult(messageId: string, _action: string, payload: any) {
    const jsonMessage = JSON.stringify([3, messageId, payload]);
    logger.info(`Responding with ➡️  ${jsonMessage}`);
    this.socket().send(jsonMessage);
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  sendCallError(error: OcppCallError<any>) {
    const jsonMessage = JSON.stringify([
      4,
      error.messageId,
      error.errorCode,
      error.errorDescription,
      error.errorDetails,
    ]);
    logger.info(`Responding with ➡️  ${jsonMessage}`);
    this.socket().send(jsonMessage);
  }

  close() {
    this.socket().close();
    this.ws = undefined;
  }

  private socket(): WebSocket {
    if (!this.ws) {
      throw new Error("Websocket not initialized. Call connect() first");
    }
    return this.ws;
  }

  private onMessage(message: string, handlers: OcppTransportHandlers) {
    logger.info(`Receive message ⬅️  ${message}`);
    // biome-ignore lint/suspicious/noExplicitAny: ocpp message format
    let data: any[];
    try {
      data = JSON.parse(message);
    } catch (err) {
      logger.error(`Failed to parse message: ${err}`);
      return;
    }
    const [type, ...rest] = data;
    if (type === 2) {
      const [messageId, action, payload] = rest;
      handlers.onCall({ messageId, action, payload });
    } else if (type === 3) {
      const [messageId, payload] = rest;
      handlers.onCallResult(messageId, payload);
    } else if (type === 4) {
      const [messageId, errorCode, errorDescription, errorDetails] = rest;
      handlers.onCallError({
        messageId,
        errorCode,
        errorDescription,
        errorDetails,
      });
    } else {
      throw new Error(`Unrecognized message type ${type}`);
    }
  }
}
