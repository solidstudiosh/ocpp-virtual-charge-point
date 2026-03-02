import * as util from "node:util";
import { WebSocket, WebSocketServer } from "ws";
import { serveStatic } from "@hono/node-server/serve-static";

import { serve } from "@hono/node-server";
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
import { OcppVersion, toProtocolVersion } from "./ocppVersion";
import {
  validateOcppIncomingRequest,
  validateOcppIncomingResponse,
  validateOcppOutgoingRequest,
  validateOcppOutgoingResponse,
} from "./schemaValidator";
import { TransactionManager } from "./transactionManager";
import { heartbeatOcppMessage } from "./v16/messages/heartbeat";
import { dbService } from "./database";

interface VCPOptions {
  ocppVersion: OcppVersion;
  endpoint: string;
  chargePointId: string;
  basicAuthPassword?: string;
  clientCert?: string;
  clientKey?: string;
  adminPort?: number;
  bootSequence?: (vcp: VCP) => Promise<void>;
}

interface LogEntry {
  type: "Application";
  timestamp: string;
  level: string;
  message: string;
  metadata: Record<string, unknown>;
}

export class VCP {
  private ws?: WebSocket;
  private wss?: WebSocketServer;
  private messageHandler: OcppMessageHandler;

  private isFinishing = false;
  public chaosMode = false;
  private chaosInterval?: NodeJS.Timeout;

  transactionManager = new TransactionManager();

  constructor(private vcpOptions: VCPOptions) {
    this.messageHandler = resolveMessageHandler(vcpOptions.ocppVersion);
    if (vcpOptions.adminPort) {
      const adminApi = new Hono();
      adminApi.get("/health", (c) => c.text("OK"));
      adminApi.get("/api/status", (c) => {
        const dbTx = dbService.getActiveTransactions();
        const enrichedTx = dbTx.map(tx => {
          let memTx = this.transactionManager.transactions.get(tx.transactionId);
          if (!memTx && !isNaN(Number(tx.transactionId))) {
            memTx = this.transactionManager.transactions.get(Number(tx.transactionId));
          }
          return {
            ...tx,
            soc: memTx?.soc,
            smartChargingLimitW: memTx?.smartChargingLimitW,
            maxChargingRateW: memTx?.maxChargingRateW,
          };
        });
        return c.json({ transactions: enrichedTx });
      });

      adminApi.get("/api/messages", (c) => {
        const messages = dbService.getRecentMessages(100);
        return c.json(messages);
      });

      adminApi.get("/api/config", (c) => {
        return c.json({
          endpoint: this.vcpOptions.endpoint,
          chargePointId: this.vcpOptions.chargePointId,
          basicAuthPassword: this.vcpOptions.basicAuthPassword || "",
          connectionStatus: this.ws?.readyState === WebSocket.OPEN ? "connected" : "disconnected",
          ocppVersion: this.vcpOptions.ocppVersion,
        });
      });

      adminApi.post(
        "/api/connect",
        zValidator(
          "json",
          z.object({
            endpoint: z.string(),
            chargePointId: z.string(),
            basicAuthPassword: z.string().optional(),
            clientCert: z.string().optional(),
            clientKey: z.string().optional(),
          }),
        ),
        async (c) => {
          const validated = c.req.valid("json");
          this.vcpOptions.endpoint = validated.endpoint;
          this.vcpOptions.chargePointId = validated.chargePointId;
          this.vcpOptions.basicAuthPassword = validated.basicAuthPassword || undefined;
          this.vcpOptions.clientCert = validated.clientCert || undefined;
          this.vcpOptions.clientKey = validated.clientKey || undefined;

          if (this.ws) {
            this.ws.close();
          }

          try {
            await this.connect();
            return c.json({ success: true, status: "connected" });
          } catch (e: any) {
            return c.json({ success: false, error: e.message }, 500);
          }
        },
      );

      adminApi.post("/api/disconnect", (c) => {
        if (this.ws) {
          this.ws.close();
        }
        return c.json({ success: true, status: "disconnected" });
      });

      adminApi.get("/api/chaos", (c) => {
        return c.json({ enabled: this.chaosMode });
      });

      adminApi.post(
        "/api/chaos",
        zValidator("json", z.object({ enabled: z.boolean() })),
        (c) => {
          this.chaosMode = c.req.valid("json").enabled;
          if (this.chaosMode && !this.chaosInterval) {
            this.chaosInterval = setInterval(() => {
              if (Math.random() < 0.15 && this.ws) {
                logger.warn("[Chaos Mode] Injecting random WebSocket disconnect fault!");
                this.ws.close();
              }
            }, 10000);
          } else if (!this.chaosMode && this.chaosInterval) {
            clearInterval(this.chaosInterval);
            this.chaosInterval = undefined;
          }
          return c.json({ success: true, chaosMode: this.chaosMode });
        }
      );

      adminApi.get("/api/security-events", (c) => {
        const events = dbService.getSecurityEvents(50);
        return c.json(events);
      });

      adminApi.post(
        "/api/security-events",
        zValidator(
          "json",
          z.object({
            type: z.string(),
            message: z.string().optional(),
          })
        ),
        (c) => {
          const validated = c.req.valid("json");
          this.notifySecurityEvent(validated.type, validated.message);
          return c.json({ success: true });
        }
      );

      adminApi.post("/api/trigger-csr", (c) => {
        this.triggerCertificateSign();
        return c.json({ success: true });
      });

      adminApi.post(
        "/api/trigger-v2g",
        zValidator(
          "json",
          z.object({
            connectorId: z.number().int(),
            targetSoC: z.number().int().min(0).max(100),
            departureTime: z.string().datetime(),
          }),
        ),
        (c) => {
          const { connectorId, targetSoC, departureTime } = c.req.valid("json");
          if (this.vcpOptions.ocppVersion === OcppVersion.OCPP_2_1 || this.vcpOptions.ocppVersion === OcppVersion.OCPP_2_0_1) {
            const activeTx = Array.from(this.transactionManager.transactions.values()).find(t => t.connectorId === connectorId);
            const soc = activeTx?.soc || 20;

            const notifyNeeds = call("NotifyEVChargingNeeds", {
              evseId: connectorId,
              timestamp: new Date().toISOString(),
              chargingNeeds: {
                requestedEnergyTransfer: "DC",
                departureTime,
                v2xChargingParameters: {
                  targetSoC,
                  minChargePower: 1000,
                  maxChargePower: Math.min(activeTx?.maxChargingRateW || 22000, 22000),
                  minDischargePower: 1000,
                  maxDischargePower: Math.min(activeTx?.maxChargingRateW || 22000, 22000),
                  evTargetEnergyRequest: ((targetSoC - soc) / 100) * 50000,
                  evMaxEnergyRequest: 50000,
                  evMinEnergyRequest: 0,
                  evMinV2XEnergyRequest: 10000,
                  evMaxV2XEnergyRequest: 50000,
                },
                dcChargingParameters: {
                  evMaxCurrent: 100,
                  evMaxVoltage: 500,
                  evMaxPower: 50000,
                  evEnergyCapacity: 50000,
                  stateOfCharge: Math.round(soc),
                }
              }
            });
            this.send(notifyNeeds);
            return c.json({ success: true });
          }
          return c.json({ success: false, error: "Only supported in OCPP 2.1" }, 400);
        }
      );

      adminApi.post(
        "/api/execute",
        zValidator(
          "json",
          z.object({
            action: z.string(),
            payload: z.any(),
          }),
        ),
        (c) => {
          const validated = c.req.valid("json");
          this.send(call(validated.action, validated.payload));
          return c.text("OK");
        },
      );

      adminApi.use("/*", serveStatic({ root: "./ui/dist" }));

      const server = serve({
        fetch: adminApi.fetch,
        port: vcpOptions.adminPort,
      });

      this.wss = new WebSocketServer({ server: server as any });
    }
  }

  private broadcastLog(direction: "IN" | "OUT", messageType: number, messageId: string, action: string | undefined, payload: any) {
    dbService.logMessage(direction, messageType, messageId, action, payload);
    const msg = JSON.stringify({
      type: 'ocpp_log',
      data: {
        timestamp: new Date().toISOString(),
        direction,
        messageType,
        messageId,
        action,
        payload
      }
    });
    this.wss?.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  async connect(): Promise<void> {
    logger.info(`Connecting... | ${util.inspect(this.vcpOptions)}`);
    this.isFinishing = false;
    return new Promise((resolve, reject) => {
      const websocketUrl = `${this.vcpOptions.endpoint}/${this.vcpOptions.chargePointId}`;
      const protocol = toProtocolVersion(this.vcpOptions.ocppVersion);
      this.ws = new WebSocket(websocketUrl, [protocol], {
        rejectUnauthorized: false, // For testing, bypasses server cert verification
        followRedirects: true,
        // mTLS Profile 3 configuration
        cert: this.vcpOptions.clientCert,
        key: this.vcpOptions.clientKey,
        headers: {
          ...(this.vcpOptions.basicAuthPassword && {
            Authorization: `Basic ${Buffer.from(
              `${this.vcpOptions.chargePointId}:${this.vcpOptions.basicAuthPassword}`,
            ).toString("base64")}`,
          }),
        },
      });

      this.ws.on("open", async () => {
        if (this.vcpOptions.bootSequence) {
          logger.info("Executing custom boot sequence...");
          await this.vcpOptions.bootSequence(this);
        } else if (this.messageHandler.handleResumption) {
          await this.messageHandler.handleResumption(this);
        }
        resolve();
      });
      this.ws.on("error", (error: Error) => {
        logger.error(`WebSocket error: ${error.message}`);
        reject(error);
      });
      this.ws.on("message", (message: string) => this._onMessage(message));
      this.ws.on("ping", () => {
        logger.info("Received PING");
      });
      this.ws.on("pong", () => {
        logger.info("Received PONG");
      });
      this.ws.on("close", (code: number, reason: string) =>
        this._onClose(code, reason),
      );
    });
  }

  async triggerCertificateSign() {
    try {
      logger.info("Generating new keypair and CSR for remote sign request...");
      const { generateCSR } = await import("./crypto");
      const { csr, privateKey } = await generateCSR(
        "ocpp-vcp-client", // Common Name
        "Solidstudio"      // Organization
      );

      // Temporarily store the pending private key
      (this as any).pendingPrivateKey = privateKey;

      logger.info("Sending SignCertificateRequest to CSMS...");
      this.send([
        2,
        Math.random().toString(36).substring(7),
        "SignCertificate",
        {
          csr: csr
        }
      ] as any);
    } catch (e) {
      logger.error(`Failed to trigger certificate sign: ${e}`);
    }
  }

  notifySecurityEvent(type: string, message?: string) {
    dbService.logSecurityEvent(type, message || "");

    // Only attempt to send if connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.send([
          2,
          Math.random().toString(36).substring(7),
          "SecurityEventNotification",
          {
            type: type.substring(0, 50),
            timestamp: new Date().toISOString(),
            techInfo: message ? message.substring(0, 255) : undefined,
          }
        ] as any);
      } catch (e) {
        logger.error(`Failed to send SecurityEventNotification: ${e}`);
      }
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
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
    logger.info(`Sending message ➡️  ${jsonMessage}`);
    this.broadcastLog("OUT", 2, ocppCall.messageId, ocppCall.action, ocppCall.payload);
    validateOcppOutgoingRequest(
      this.vcpOptions.ocppVersion,
      ocppCall.action,
      JSON.parse(JSON.stringify(ocppCall.payload)),
    );
    this.ws.send(jsonMessage);
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  respond(result: OcppCallResult<any>) {
    if (!this.ws) {
      throw new Error("Websocket not initialized. Call connect() first");
    }
    const jsonMessage = JSON.stringify([3, result.messageId, result.payload]);
    logger.info(`Responding with ➡️  ${jsonMessage}`);
    this.broadcastLog("OUT", 3, result.messageId, result.action, result.payload);
    validateOcppIncomingResponse(
      this.vcpOptions.ocppVersion,
      result.action,
      JSON.parse(JSON.stringify(result.payload)),
    );
    this.ws.send(jsonMessage);
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
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
    this.broadcastLog("OUT", 4, error.messageId, undefined, {
      errorCode: error.errorCode,
      errorDescription: error.errorDescription,
      errorDetails: error.errorDetails,
    });
    this.ws.send(jsonMessage);
  }

  configureHeartbeat(interval: number) {
    setInterval(() => {
      this.send(heartbeatOcppMessage.request({}));
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
    this.ws = undefined;
    process.exit(1);
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

  private _onMessage(message: string) {
    logger.info(`Receive message ⬅️  ${message}`);
    const data = JSON.parse(message);
    const [type, ...rest] = data;
    if (type === 2) {
      const [messageId, action, payload] = rest;
      this.broadcastLog("IN", 2, messageId, action, payload);
      validateOcppIncomingRequest(this.vcpOptions.ocppVersion, action, payload);
      this.messageHandler.handleCall(this, { messageId, action, payload });
    } else if (type === 3) {
      const [messageId, payload] = rest;
      const enqueuedCall = ocppOutbox.get(messageId);
      if (!enqueuedCall) {
        throw new Error(
          `Received CallResult for unknown messageId=${messageId}`,
        );
      }
      this.broadcastLog("IN", 3, messageId, enqueuedCall.action, payload);
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
    } else if (type === 4) {
      const [messageId, errorCode, errorDescription, errorDetails] = rest;
      this.broadcastLog("IN", 4, messageId, undefined, {
        errorCode,
        errorDescription,
        errorDetails,
      });
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
    logger.info(`Connection closed. code=${code}, reason=${reason}. Dashboard remains accessible.`);
    // Removed process.exit() to keep the admin dashboard alive.
  }
}
