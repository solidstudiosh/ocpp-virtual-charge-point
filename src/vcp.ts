import * as util from "node:util";

import { serve, type ServerType } from "@hono/node-server";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { logger } from "./logger";
import { call } from "./messageFactory";
import type { OcppCall, OcppCallError, OcppCallResult } from "./ocppMessage";
import {
  type OcppMessageHandler,
  resolveMessageHandler,
} from "./ocppMessageHandler";
import { ocppOutbox } from "./ocppOutbox";
import { type OcppVersion, toProtocolVersion } from "./ocppVersion";
import {
  getOcppOutgoingMessages,
  validateOcppIncomingRequest,
  validateOcppIncomingResponse,
  validateOcppOutgoingRequest,
  validateOcppOutgoingResponse,
} from "./schemaValidator";
import { TransactionManager } from "./transactionManager";
import { heartbeatOcppMessage } from "./v16/messages/heartbeat";
import { close } from "./close";
import type { OcppTransport } from "./transport/ocppTransport";
import { WsJsonTransport } from "./transport/wsJsonTransport";

interface VCPOptions {
  ocppVersion: OcppVersion;
  endpoint: string;
  chargePointId: string;
  basicAuthPassword?: string;
  adminPort?: number;
}

interface LogEntry {
  type: "Application";
  timestamp: string;
  level: string;
  message: string;
  metadata: Record<string, unknown>;
}

export class VCP {
  private transport?: OcppTransport;
  private adminServer?: ServerType;
  private messageHandler: OcppMessageHandler;
  private heartbeatIntervalId?: ReturnType<typeof setInterval>;

  private isFinishing = false;

  private postMessageActions: Record<string, () => void | Promise<void>> = {};

  transactionManager = new TransactionManager();

  constructor(private vcpOptions: VCPOptions) {
    this.messageHandler = resolveMessageHandler(vcpOptions.ocppVersion);
    if (vcpOptions.adminPort) {
      const adminApi = new Hono();
      adminApi.get("/health", (c) => c.text("OK"));
      adminApi.post(
        "/execute",
        zValidator(
          "json",
          z.object({
            action: z.string(),
            payload: z.any(),
          }),
        ),
        (c) => {
          const validated = c.req.valid("json");
          try {
            this.send(call(validated.action, validated.payload));
          } catch (error) {
            logger.error(
              `Admin command ${validated.action} not sent: ${String(error)}`,
            );
            return c.text(`Not sent: ${String(error)}`, 503);
          }
          return c.text("OK");
        },
      );
      this.adminServer = serve({
        fetch: adminApi.fetch,
        port: vcpOptions.adminPort,
      });
    }
  }

  async connect(): Promise<void> {
    logger.info(`Connecting... | ${util.inspect(this.vcpOptions)}`);
    this.isFinishing = false;
    this.transport = new WsJsonTransport({
      endpoint: this.vcpOptions.endpoint,
      chargePointId: this.vcpOptions.chargePointId,
      protocol: toProtocolVersion(this.vcpOptions.ocppVersion),
      basicAuthPassword: this.vcpOptions.basicAuthPassword,
    });
    return this.transport.connect({
      onCall: (ocppCall) => this._onCall(ocppCall),
      onCallResult: (messageId, payload) =>
        this._onCallResult(messageId, payload),
      onCallError: (error) => this.messageHandler.handleCallError(this, error),
      onClose: (code, reason) => this._onClose(code, reason),
      onError: () => close(this),
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  send(ocppCall: OcppCall<any>) {
    const transport = this.connectedTransport();
    // Applied before enqueueing so the outbox holds exactly what went out on
    // the wire - resHandlers read the payload back from there.
    const beforeSend = getOcppOutgoingMessages(this.vcpOptions.ocppVersion)[
      ocppCall.action
    ]?.beforeSend;
    const resolvedCall = beforeSend
      ? { ...ocppCall, payload: beforeSend(this, ocppCall.payload) }
      : ocppCall;
    ocppOutbox.enqueue(resolvedCall);
    // Validation only logs, so it runs after the message is on its way and
    // its warnings follow the logged message.
    transport.sendCall(resolvedCall);
    validateOcppOutgoingRequest(
      this.vcpOptions.ocppVersion,
      resolvedCall.action,
      JSON.parse(JSON.stringify(resolvedCall.payload)),
    );
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  respond(result: OcppCallResult<any>) {
    const transport = this.connectedTransport();
    transport.sendCallResult(result.messageId, result.action, result.payload);
    validateOcppIncomingResponse(
      this.vcpOptions.ocppVersion,
      result.action,
      JSON.parse(JSON.stringify(result.payload)),
    );
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  respondError(error: OcppCallError<any>) {
    this.connectedTransport().sendCallError(error);
  }

  configureHeartbeat(interval: number) {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
    }
    this.heartbeatIntervalId = setInterval(() => {
      this.send(heartbeatOcppMessage.request({}));
    }, interval);
  }

  close() {
    if (!this.transport) {
      throw new Error(
        "Trying to close a Websocket that was not opened. Call connect() first",
      );
    }
    this.isFinishing = true;
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = undefined;
    }
    this.transport.close();
    this.transport = undefined;
    if (this.adminServer) {
      this.adminServer.close();
      this.adminServer = undefined;
    }
  }

  async getDiagnosticData(): Promise<LogEntry[]> {
    try {
      // Get logs from Winston logger's memory
      const transport = logger.transports[0];

      // Create a promise that resolves with collected logs
      const logStream = new Promise<LogEntry[]>((resolve) => {
        const entries: LogEntry[] = [];

        // Listen for new logs
        transport.on(
          "logged",
          (info: {
            timestamp: string;
            level: string;
            message: string;
            [key: string]: unknown;
          }) => {
            entries.push({
              type: "Application",
              timestamp: info.timestamp || new Date().toISOString(),
              level: info.level,
              message: info.message,
              metadata: Object.fromEntries(
                Object.entries(info).filter(
                  ([key]) => !["timestamp", "level", "message"].includes(key),
                ),
              ),
            });
          },
        );

        // Resolve after a short delay to collect recent logs
        setTimeout(() => resolve(entries), 10000);
      });

      return await logStream;
    } catch (err) {
      logger.error("Failed to read application logs:", err);
      return [];
    }
  }

  async postMessageAction(
    action: string,
    callback: () => void | Promise<void>,
  ) {
    this.postMessageActions[action] = callback;
  }

  private connectedTransport(): OcppTransport {
    if (!this.transport) {
      throw new Error("Websocket not initialized. Call connect() first");
    }
    return this.transport;
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  private _onCall({ messageId, action, payload }: OcppCall<any>) {
    validateOcppIncomingRequest(this.vcpOptions.ocppVersion, action, payload);
    this.messageHandler.handleCall(this, { messageId, action, payload });
    if (this.postMessageActions[action]) {
      logger.info(`Executing postMessageAction for ${action}`);
      this.postMessageActions[action]();
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  private _onCallResult(messageId: string, payload: any) {
    const enqueuedCall = ocppOutbox.get(messageId);
    if (!enqueuedCall) {
      if (process.env.CONTINUE_ON_UNKNOWN_MESSAGE_ID) {
        return;
      }
      throw new Error(`Received CallResult for unknown messageId=${messageId}`);
    }
    validateOcppOutgoingResponse(
      this.vcpOptions.ocppVersion,
      enqueuedCall.action,
      payload,
    );
    this.messageHandler.handleCallResult(this, enqueuedCall, {
      messageId,
      payload,
      action: enqueuedCall.action,
    });
  }

  private _onClose(code: number, reason: string) {
    if (this.isFinishing) {
      return;
    }
    logger.info(`Connection closed. code=${code}, reason=${reason}`);
    close(this);
  }
}
