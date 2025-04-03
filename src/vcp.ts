import WebSocket, { WebSocketServer } from "ws";
import util from "util";

import { logger } from "./logger";
import { call } from "./messageFactory";
import { OcppCall, OcppCallError, OcppCallResult } from "./ocppMessage";
import {
  OcppMessageHandler,
  resolveMessageHandler,
} from "./ocppMessageHandler";
import { ocppOutbox } from "./ocppOutbox";
import { OcppVersion, toProtocolVersion } from "./ocppVersion";
import {
  validateOcppRequest,
  validateOcppResponse,
} from "./jsonSchemaValidator";

interface VCPOptions {
  ocppVersion: OcppVersion;
  endpoint: string;
  chargePointId: string;
  basicAuthPassword?: string;
  adminWsPort?: number;
  isTwinGun?: boolean; // if VCP is twingun, based on cli param
  connectorIds?: number[];
}

export class VCP {
  private ws?: WebSocket;
  private adminWs?: WebSocketServer;
  private messageHandler: OcppMessageHandler;
  public isFinishing: boolean = false;
  public isWaiting: boolean = false;
  public lastAction: string = "";
  public isTwinGun: boolean = false;
  public connectorIDs: number[];
  public status: string;

  constructor(public vcpOptions: VCPOptions) {
    this.messageHandler = resolveMessageHandler(vcpOptions.ocppVersion);

    this.vcpOptions.isTwinGun = this.vcpOptions.isTwinGun ?? false;
    this.isTwinGun = this.vcpOptions.isTwinGun ?? false;
    this.connectorIDs =
      this.vcpOptions.connectorIds ?? this.initializeConnectorIDs();
    this.status = "Available";

    if (vcpOptions.adminWsPort) {
      this.adminWs = new WebSocketServer({
        port: vcpOptions.adminWsPort,
      });
      this.adminWs.on("connection", (_ws) => {
        _ws.on("message", (data: string) => {
          this.send(JSON.parse(data));
        });
      });
      this.adminWs.on("error", (error) => {
        logger.error("Admin WebSocketServer Error: " + error);
      });
    }
  }

  async connect(): Promise<void> {
    logger.info(`Connecting... | ${util.inspect(this.vcpOptions)}`);
    this.isFinishing = false;
    return new Promise((resolve) => {
      const websocketUrl = `${this.vcpOptions.endpoint}/${this.vcpOptions.chargePointId}`;
      const protocol = toProtocolVersion(this.vcpOptions.ocppVersion);
      this.ws = new WebSocket(websocketUrl, [protocol], {
        rejectUnauthorized: false,
        auth: this.vcpOptions.basicAuthPassword
          ? `${this.vcpOptions.chargePointId}:${this.vcpOptions.basicAuthPassword}`
          : undefined,
        followRedirects: true,
      });

      this.ws.on("open", () => resolve());
      this.ws.on("message", (message: string) => this._onMessage(message));
      this.ws.on("ping", () => {
        //logger.info("Received PING");
      });
      this.ws.on("pong", () => {
        logger.info("Received PONG");
      });
      this.ws.on("close", (code: number, reason: string) =>
        this._onClose(code, reason),
      );
    });
  }

  send(ocppCall: OcppCall<any>) {
    if (!this.ws) {
      throw new Error("Websocket not initialized. Call connect() first");
    }
    ocppOutbox.enqueue(ocppCall);
    const jsonMessage = JSON.stringify([
      2,
      ocppCall.messageId,
      ocppCall.action,
      ocppCall.payload,
    ]);

    if (ocppCall.action !== "Heartbeat") {
      logger.info(
        `➡️  Sending ${this.vcpOptions.chargePointId} ${ocppCall.action} ${jsonMessage}`,
      );
    }
    validateOcppRequest(
      this.vcpOptions.ocppVersion,
      ocppCall.action,
      JSON.parse(JSON.stringify(ocppCall.payload)),
    );
    this.lastAction = ocppCall.action;

    if (ocppCall.action === "StatusNotification") {
      this.status = ocppCall.payload.status;
    }

    this.ws.send(jsonMessage);
  }

  async sendAndWait(ocppCall: OcppCall<any>) {
    if (this.isWaiting) {
      // wait till isWaiting is false
      const self = this;
      await new Promise((resolve) => {
        const interval = setInterval(() => {
          //logger.info('waiting');
          if (!self.isWaiting) {
            clearInterval(interval);
            this.sendAndWait(ocppCall);
          }
        }, 100);
      });
    } else {
      this.isWaiting = true;
      this.send(ocppCall);
    }
  }

  respond(result: OcppCallResult<any>) {
    if (!this.ws) {
      throw new Error("Websocket not initialized. Call connect() first");
    }
    const jsonMessage = JSON.stringify([3, result.messageId, result.payload]);
    logger.info(`➡️  Responding ${jsonMessage}`);
    validateOcppResponse(
      this.vcpOptions.ocppVersion,
      result.action,
      JSON.parse(JSON.stringify(result.payload)),
    );
    this.ws.send(jsonMessage);
  }

  respondError(error: OcppCallError<any>) {
    if (!this.ws) {
      throw new Error("Websocket not initialized. Call connect() first");
    }
    const jsonMessage = JSON.stringify([
      4,
      error.messageId,
      error.errorCode,
      error.errorDescription,
      error.errorDetails,
    ]);
    logger.info(`Responding with ➡️  ${jsonMessage}`);
    this.ws.send(jsonMessage);
  }

  configureHeartbeat(interval: number) {
    setInterval(() => {
      this.send(call("Heartbeat"));
    }, interval);
  }

  close() {
    if (!this.ws) {
      throw new Error(
        "Trying to close a Websocket that was not opened. Call connect() first",
      );
    }
    this.isFinishing = true;
    this.ws.close();
    this.adminWs?.close();
    delete this.ws;
    delete this.adminWs;
    process.exit(1);
  }

  // sets array of connectorIDs
  private initializeConnectorIDs(): number[] {
    if (this.isTwinGun) {
      return [0, 1, 2];
    }
    return [1];
  }

  private _onMessage(message: string) {
    this.isWaiting = false;
    if (this.lastAction !== "Heartbeat") {
      logger.info(`⬅️  Receive ${this.vcpOptions.chargePointId} ${message}`);
    } else {
      this.lastAction = "";
    }
    const data = JSON.parse(message);
    const [type, ...rest] = data;
    if (type === 2) {
      const [messageId, action, payload] = rest;
      validateOcppRequest(this.vcpOptions.ocppVersion, action, payload);
      this.messageHandler.handleCall(this, { messageId, action, payload });
    } else if (type === 3) {
      const [messageId, payload] = rest;
      const enqueuedCall = ocppOutbox.get(messageId);
      if (!enqueuedCall) {
        throw new Error(
          `Received CallResult for unknown messageId=${messageId}`,
        );
      }
      validateOcppResponse(
        this.vcpOptions.ocppVersion,
        enqueuedCall.action,
        payload,
      );
      this.messageHandler.handleCallResult(this, enqueuedCall, {
        messageId,
        payload,
        action: enqueuedCall.action,
      });
    } else if (type === 4) {
      const [messageId, errorCode, errorDescription, errorDetails] = rest;
      this.messageHandler.handleCallError(this, {
        messageId,
        errorCode,
        errorDescription,
        errorDetails,
      });
    } else {
      throw new Error(`Unrecognized message type ${type}`);
    }
  }

  private _onClose(code: number, reason: string) {
    if (this.isFinishing) {
      return;
    }
    logger.info(`Connection closed. code=${code}, reason=${reason}`);
    process.exit();
  }

  disconnect() {
    if (!this.ws) {
      throw new Error(
        "Trying to close a Websocket that was not opened. Call connect() first",
      );
    }

    this.isFinishing = true;
    this.ws.close();
  }
}
