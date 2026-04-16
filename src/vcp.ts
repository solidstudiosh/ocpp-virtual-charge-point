import * as path from "node:path";
import * as util from "node:util";
import { readFile } from "node:fs/promises";
import { WebSocket } from "ws";

import { serve, type ServerType } from "@hono/node-server";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { logger } from "./logger";
import { call } from "./messageFactory";
import type { OcppCall, OcppCallError, OcppCallResult } from "./ocppMessage";
import {
  type OcppMessageHandler,
  resolveMessageHandler,
} from "./ocppMessageHandler";
import { ocppOutbox } from "./ocppOutbox";
import { OcppVersion, type OcppVersion as OcppVersionType, toProtocolVersion } from "./ocppVersion";
import {
  validateOcppIncomingRequest,
  validateOcppIncomingResponse,
  validateOcppOutgoingRequest,
  validateOcppOutgoingResponse,
} from "./schemaValidator";
import { TransactionManager } from "./transactionManager";
import { close } from "./close";
import { heartbeatOcppMessage } from "./v16/messages/heartbeat";
import { bootNotificationOcppMessage } from "./v16/messages/bootNotification";
import { statusNotificationOcppMessage } from "./v16/messages/statusNotification";
import { bootNotificationOcppOutgoing as bootNotificationOcppOutgoingV201 } from "./v201/messages/bootNotification";
import { statusNotificationOcppOutgoing as statusNotificationOcppOutgoingV201 } from "./v201/messages/statusNotification";
import { bootNotificationOcppOutgoing as bootNotificationOcppOutgoingV21 } from "./v21/messages/bootNotification";
import { statusNotificationOcppOutgoing as statusNotificationOcppOutgoingV21 } from "./v21/messages/statusNotification";
import { ocppOutgoingMessages as ocppOutgoingMessagesV16 } from "./v16/messageHandler";
import { ocppOutgoingMessages as ocppOutgoingMessagesV201 } from "./v201/messageHandler";
import { ocppOutgoingMessages as ocppOutgoingMessagesV21 } from "./v21/messageHandler";

const UI_DIRECTORY = path.resolve(process.cwd(), "ui");
const MAX_MESSAGE_ENTRIES = 500;
const MAX_LOG_ENTRIES = 600;
const MAX_HEARTBEAT_ENTRIES = 400;
const MAX_METER_ENTRIES = 600;
const MAX_TRANSACTION_ENTRIES = 300;

interface VCPOptions {
  ocppVersion: OcppVersionType;
  endpoint: string;
  chargePointId: string;
  basicAuthPassword?: string;
  adminPort?: number;
  closeProcessOnConnectionError?: boolean;
}

type MessageDirection =
  | "outgoingCall"
  | "outgoingCallResult"
  | "outgoingCallError"
  | "incomingCall"
  | "incomingCallResult"
  | "incomingCallError";

interface MessageTrace {
  timestamp: string;
  direction: MessageDirection;
  messageType: 2 | 3 | 4;
  messageId: string;
  action?: string;
  payload: unknown;
}

interface TelemetryLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  source: "system" | "message";
  message: string;
  metadata?: Record<string, unknown>;
}

interface HeartbeatTrace {
  timestamp: string;
  phase: "sent" | "ack";
  messageId: string;
  latencyMs?: number;
}

interface MeterValueTrace {
  timestamp: string;
  connectorId?: number;
  evseId?: number;
  transactionId?: string | number;
  value: number;
  unit?: string;
  measurand?: string;
}

interface TransactionTrace {
  timestamp: string;
  event:
    | "startRequested"
    | "startConfirmed"
    | "stopRequested"
    | "stopConfirmed"
    | "remoteStart"
    | "remoteStop"
    | "transactionEvent";
  transactionId?: string | number;
  connectorId?: number;
  idTag?: string;
  details?: string;
}

interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  websocketUrl?: string;
  lastConnectedAt?: string;
  lastDisconnectedAt?: string;
  lastError?: string;
}

interface ActionCounter {
  outgoing: number;
  incoming: number;
}

interface HeartbeatConfigurationState {
  currentIntervalMs?: number;
  currentIntervalMinutes?: number;
  source?: "csms" | "manual";
  manualOverrideActive: boolean;
  manualOverrideIntervalMinutes?: number;
}

interface ChaosModeState {
  enabled: boolean;
  lastEventAt?: string;
  nextEventAt?: string;
}

interface UIVcpState {
  options: {
    endpoint: string;
    chargePointId: string;
    ocppVersion: OcppVersionType;
    hasBasicAuthPassword: boolean;
  };
  connection: ConnectionState;
  supportedActions: string[];
  stats: {
    sent: number;
    received: number;
    errors: number;
    activeTransactions: number;
    lastHeartbeatAt?: string;
    averageHeartbeatLatencyMs?: number;
  };
  actionCounters: Record<string, ActionCounter>;
  messages: MessageTrace[];
  heartbeats: HeartbeatTrace[];
  meterValues: MeterValueTrace[];
  transactions: TransactionTrace[];
  logs: TelemetryLogEntry[];
  heartbeatConfiguration: HeartbeatConfigurationState;
  chaosMode: ChaosModeState;
  activeTransactions: Array<{
    transactionId: string | number;
    idTag: string;
    meterValue: number;
    connectorId: number;
    evseId?: number;
    startedAt: string;
    durationSeconds: number;
  }>;
}

const connectRequestSchema = z.object({
  endpoint: z.string().min(1),
  chargePointId: z.string().min(1),
  ocppVersion: z.nativeEnum(OcppVersion),
  basicAuthPassword: z.string().optional(),
  sendBootNotification: z.boolean().optional(),
  sendInitialStatus: z.boolean().optional(),
});

const executeRequestSchema = z.object({
  action: z.string().min(1),
  payload: z.unknown().optional(),
});

const heartbeatConfigRequestSchema = z.object({
  minutes: z.number().gt(0).max(120),
});

const chaosModeRequestSchema = z.object({
  enabled: z.boolean(),
});

export class VCP {
  private ws?: WebSocket;
  private adminServer?: ServerType;
  private messageHandler: OcppMessageHandler;
  private heartbeatInterval?: NodeJS.Timeout;

  private isFinishing = false;

  private postMessageActions: Record<string, () => void | Promise<void>> = {};

  private connectionState: ConnectionState = {
    connected: false,
    connecting: false,
  };

  private telemetry = {
    sent: 0,
    received: 0,
    errors: 0,
    messages: [] as MessageTrace[],
    logs: [] as TelemetryLogEntry[],
    heartbeats: [] as HeartbeatTrace[],
    meterValues: [] as MeterValueTrace[],
    transactions: [] as TransactionTrace[],
    actionCounters: {} as Record<string, ActionCounter>,
  };

  private pendingHeartbeatSentAt = new Map<string, number>();
  private configuredHeartbeatIntervalMs?: number;
  private configuredHeartbeatSource: "csms" | "manual" = "csms";
  private manualHeartbeatOverrideMs?: number;

  private chaosModeEnabled = false;
  private chaosModeTimer?: NodeJS.Timeout;
  private chaosLastEventAt?: string;
  private chaosNextEventAt?: string;

  transactionManager = new TransactionManager();

  constructor(private vcpOptions: VCPOptions) {
    this.messageHandler = resolveMessageHandler(vcpOptions.ocppVersion);
    if (vcpOptions.adminPort) {
      const adminApi = new Hono();
      adminApi.use("*", cors());

      adminApi.get("/", async (c) => {
        const html = await this.readUiAsset("index.html");
        if (!html) {
          return c.text("UI not found. Expected ui/index.html", 404);
        }
        return c.html(html);
      });

      adminApi.get("/app.js", async (c) => {
        const js = await this.readUiAsset("app.js");
        if (!js) {
          return c.text("app.js not found", 404);
        }
        return c.body(js, 200, {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        });
      });

      adminApi.get("/style.css", async (c) => {
        const css = await this.readUiAsset("style.css");
        if (!css) {
          return c.text("style.css not found", 404);
        }
        return c.body(css, 200, {
          "Content-Type": "text/css; charset=utf-8",
          "Cache-Control": "no-store",
        });
      });

      adminApi.get("/health", (c) => c.text("OK"));

      adminApi.get("/api/ui/state", (c) => {
        return c.json(this.getUiState());
      });

      adminApi.post(
        "/api/ui/connect",
        zValidator("json", connectRequestSchema),
        async (c) => {
          const payload = c.req.valid("json");

          try {
            if (this.isConnected()) {
              this.disconnect();
            }

            this.updateConnectionOptions({
              endpoint: payload.endpoint,
              chargePointId: payload.chargePointId,
              ocppVersion: payload.ocppVersion,
              basicAuthPassword: payload.basicAuthPassword?.trim() || undefined,
            });

            await this.connect();

            const shouldSendBootNotification = payload.sendBootNotification ?? true;
            const shouldSendInitialStatus = payload.sendInitialStatus ?? true;
            if (shouldSendBootNotification || shouldSendInitialStatus) {
              this.sendDefaultStartupMessages(
                shouldSendBootNotification,
                shouldSendInitialStatus,
              );
            }

            return c.json({ ok: true, state: this.getUiState() });
          } catch (error) {
            this.pushSystemLog("error", "Failed to connect from UI", {
              error: this.errorMessage(error),
            });
            return c.json(
              {
                ok: false,
                error: this.errorMessage(error),
                state: this.getUiState(),
              },
              500,
            );
          }
        },
      );

      adminApi.post("/api/ui/disconnect", (c) => {
        if (this.isConnected()) {
          this.disconnect();
        }
        return c.json({ ok: true, state: this.getUiState() });
      });

      adminApi.post("/api/ui/telemetry/reset", (c) => {
        this.resetTelemetry();
        return c.json({ ok: true, state: this.getUiState() });
      });

      adminApi.post(
        "/api/ui/heartbeat/config",
        zValidator("json", heartbeatConfigRequestSchema),
        (c) => {
          const validated = c.req.valid("json");
          try {
            this.setManualHeartbeatIntervalMinutes(validated.minutes);
            return c.json({ ok: true, state: this.getUiState() });
          } catch (error) {
            return c.json(
              {
                ok: false,
                error: this.errorMessage(error),
                state: this.getUiState(),
              },
              400,
            );
          }
        },
      );

      adminApi.post(
        "/api/ui/chaos",
        zValidator("json", chaosModeRequestSchema),
        (c) => {
          const validated = c.req.valid("json");
          this.setChaosMode(validated.enabled);
          return c.json({ ok: true, state: this.getUiState() });
        },
      );

      adminApi.post(
        "/api/ui/execute",
        zValidator("json", executeRequestSchema),
        (c) => {
          const validated = c.req.valid("json");
          try {
            this.send(call(validated.action, validated.payload ?? {}));
            return c.json({ ok: true, state: this.getUiState() });
          } catch (error) {
            this.pushSystemLog("error", "Failed to execute UI command", {
              action: validated.action,
              error: this.errorMessage(error),
            });
            return c.json(
              {
                ok: false,
                error: this.errorMessage(error),
                state: this.getUiState(),
              },
              400,
            );
          }
        },
      );

      adminApi.post(
        "/execute",
        zValidator("json", executeRequestSchema),
        (c) => {
          const validated = c.req.valid("json");
          this.send(call(validated.action, validated.payload ?? {}));
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
    if (this.connectionState.connecting) {
      throw new Error("Connection attempt already in progress");
    }
    if (this.isConnected()) {
      throw new Error("Charge point is already connected");
    }

    this.connectionState.connecting = true;
    this.connectionState.lastError = undefined;
    this.isFinishing = false;

    const websocketUrl = this.resolveWebsocketUrl();
    this.connectionState.websocketUrl = websocketUrl;

    logger.info(`Connecting... | ${util.inspect(this.vcpOptions)}`);
    this.pushSystemLog("info", "Connecting to CSMS", {
      websocketUrl,
      chargePointId: this.vcpOptions.chargePointId,
      ocppVersion: this.vcpOptions.ocppVersion,
    });

    return new Promise((resolve, reject) => {
      let settled = false;

      const finishResolve = () => {
        if (settled) {
          return;
        }
        settled = true;
        this.connectionState.connecting = false;
        this.connectionState.connected = true;
        this.connectionState.lastConnectedAt = new Date().toISOString();
        this.pushSystemLog("info", "Connected to CSMS", {
          websocketUrl,
        });
        if (this.manualHeartbeatOverrideMs !== undefined) {
          this.configureHeartbeat(this.manualHeartbeatOverrideMs, "manual");
        }
        if (this.chaosModeEnabled) {
          this.startChaosModeScheduler();
        }
        resolve();
      };

      const finishReject = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        this.connectionState.connecting = false;
        this.connectionState.connected = false;
        this.connectionState.lastError = error.message;
        this.connectionState.lastDisconnectedAt = new Date().toISOString();
        reject(error);
      };

      const protocol = toProtocolVersion(this.vcpOptions.ocppVersion);
      this.ws = new WebSocket(websocketUrl, [protocol], {
        rejectUnauthorized: false,
        followRedirects: true,
        headers: {
          ...(this.vcpOptions.basicAuthPassword && {
            Authorization: `Basic ${Buffer.from(
              `${this.vcpOptions.chargePointId}:${this.vcpOptions.basicAuthPassword}`,
            ).toString("base64")}`,
          }),
        },
      });

      this.ws.on("open", () => finishResolve());
      this.ws.on("message", (message) => this._onMessage(message.toString()));
      this.ws.on("ping", () => {
        logger.info("Received PING");
        this.pushSystemLog("info", "Received WebSocket PING");
      });
      this.ws.on("pong", () => {
        logger.info("Received PONG");
        this.pushSystemLog("info", "Received WebSocket PONG");
      });
      this.ws.on("close", (code: number, reason: Buffer) => {
        const reasonText = reason.toString();
        this._onClose(code, reasonText);
        if (!settled) {
          finishReject(
            new Error(
              `WebSocket closed before establishing connection (code=${code}, reason=${reasonText})`,
            ),
          );
        }
      });
      this.ws.on("error", (error: Error) => {
        logger.error("Websocket error:");
        logger.error(error);
        this.pushSystemLog("error", "WebSocket error", {
          error: error.message,
        });

        if (!settled) {
          finishReject(error);
        }

        if (this.shouldCloseProcessOnConnectionError()) {
          close(this);
        }
      });
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  send(ocppCall: OcppCall<any>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Websocket not connected. Connect the charge point first");
    }

    ocppOutbox.enqueue(ocppCall);
    const jsonMessage = JSON.stringify([
      2,
      ocppCall.messageId,
      ocppCall.action,
      ocppCall.payload,
    ]);
    logger.info(`Sending message ➡️  ${jsonMessage}`);
    validateOcppOutgoingRequest(
      this.vcpOptions.ocppVersion,
      ocppCall.action,
      JSON.parse(JSON.stringify(ocppCall.payload)),
    );

    this.recordMessage({
      direction: "outgoingCall",
      messageType: 2,
      messageId: ocppCall.messageId,
      action: ocppCall.action,
      payload: ocppCall.payload,
    });

    this.recordDomainEventsForOutgoingAction(ocppCall.action, ocppCall);

    this.ws.send(jsonMessage);
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  respond(result: OcppCallResult<any>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Websocket not connected. Connect the charge point first");
    }
    const jsonMessage = JSON.stringify([3, result.messageId, result.payload]);
    logger.info(`Responding with ➡️  ${jsonMessage}`);
    validateOcppIncomingResponse(
      this.vcpOptions.ocppVersion,
      result.action,
      JSON.parse(JSON.stringify(result.payload)),
    );

    this.recordMessage({
      direction: "outgoingCallResult",
      messageType: 3,
      messageId: result.messageId,
      action: result.action,
      payload: result.payload,
    });

    this.ws.send(jsonMessage);
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  respondError(error: OcppCallError<any>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Websocket not connected. Connect the charge point first");
    }
    const jsonMessage = JSON.stringify([
      4,
      error.messageId,
      error.errorCode,
      error.errorDescription,
      error.errorDetails,
    ]);
    logger.info(`Responding with ➡️  ${jsonMessage}`);

    this.recordMessage({
      direction: "outgoingCallError",
      messageType: 4,
      messageId: error.messageId,
      payload: {
        errorCode: error.errorCode,
        errorDescription: error.errorDescription,
        errorDetails: error.errorDetails,
      },
    });

    this.ws.send(jsonMessage);
  }

  configureHeartbeat(interval: number, source: "csms" | "manual" = "csms") {
    const normalizedInterval = Math.max(1000, Math.floor(interval));

    if (source === "csms" && this.manualHeartbeatOverrideMs !== undefined) {
      this.pushSystemLog(
        "info",
        "Ignoring CSMS heartbeat interval because manual override is active",
        {
          csmsIntervalMs: normalizedInterval,
          manualIntervalMs: this.manualHeartbeatOverrideMs,
        },
      );
      return;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.configuredHeartbeatIntervalMs = normalizedInterval;
    this.configuredHeartbeatSource = source;
    if (source === "manual") {
      this.manualHeartbeatOverrideMs = normalizedInterval;
    }

    this.pushSystemLog("info", "Configured heartbeat interval", {
      intervalMs: normalizedInterval,
      source,
    });

    this.heartbeatInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }
      this.send(heartbeatOcppMessage.request({}));
    }, normalizedInterval);
  }

  setManualHeartbeatIntervalMinutes(minutes: number) {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new Error("Heartbeat interval must be a number greater than 0 minutes");
    }

    const intervalMs = Math.round(minutes * 60 * 1000);
    this.manualHeartbeatOverrideMs = intervalMs;
    this.configuredHeartbeatIntervalMs = intervalMs;
    this.configuredHeartbeatSource = "manual";

    if (this.isConnected()) {
      this.configureHeartbeat(intervalMs, "manual");
    } else {
      this.pushSystemLog("info", "Saved manual heartbeat interval for next connection", {
        intervalMinutes: minutes,
        intervalMs,
      });
    }
  }

  setChaosMode(enabled: boolean) {
    this.chaosModeEnabled = enabled;
    if (enabled) {
      this.pushSystemLog("warn", "Chaos mode enabled");
      this.startChaosModeScheduler();
    } else {
      this.pushSystemLog("info", "Chaos mode disabled");
      this.stopChaosModeScheduler();
    }
  }

  disconnect() {
    if (!this.ws) {
      return;
    }

    this.isFinishing = true;
    const ws = this.ws;
    this.ws = undefined;

    this.clearHeartbeatScheduler();
    this.stopChaosModeScheduler();
    this.connectionState.connected = false;
    this.connectionState.connecting = false;
    this.connectionState.lastDisconnectedAt = new Date().toISOString();

    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }

    this.pushSystemLog("info", "Disconnected from CSMS");
  }

  close() {
    this.stopChaosModeScheduler();
    this.disconnect();
    if (this.adminServer) {
      this.adminServer.close();
      this.adminServer = undefined;
    }
  }

  async getDiagnosticData(): Promise<TelemetryLogEntry[]> {
    return [...this.telemetry.logs];
  }

  updateConnectionOptions(
    options: Partial<
      Pick<
        VCPOptions,
        "endpoint" | "chargePointId" | "ocppVersion" | "basicAuthPassword"
      >
    >,
  ) {
    if (options.ocppVersion) {
      this.messageHandler = resolveMessageHandler(options.ocppVersion);
      this.vcpOptions.ocppVersion = options.ocppVersion;
    }
    if (options.endpoint !== undefined) {
      this.vcpOptions.endpoint = options.endpoint;
    }
    if (options.chargePointId !== undefined) {
      this.vcpOptions.chargePointId = options.chargePointId;
    }
    if (options.basicAuthPassword !== undefined) {
      this.vcpOptions.basicAuthPassword = options.basicAuthPassword;
    }
  }

  getUiState(): UIVcpState {
    const heartbeatAcks = this.telemetry.heartbeats.filter(
      (entry) => entry.phase === "ack" && typeof entry.latencyMs === "number",
    );

    const averageHeartbeatLatencyMs =
      heartbeatAcks.length > 0
        ? Math.round(
            heartbeatAcks.reduce((sum, entry) => sum + (entry.latencyMs ?? 0), 0) /
              heartbeatAcks.length,
          )
        : undefined;

    const lastHeartbeatAt =
      this.telemetry.heartbeats.length > 0
        ? this.telemetry.heartbeats[this.telemetry.heartbeats.length - 1].timestamp
        : undefined;

    const activeTransactions = Array.from(
      this.transactionManager.transactions.values(),
    ).map(({ meterValuesTimer: _meterValuesTimer, ...transaction }) => ({
      ...transaction,
      startedAt: transaction.startedAt.toISOString(),
      durationSeconds: Math.floor(
        (Date.now() - transaction.startedAt.getTime()) / 1000,
      ),
    }));

    const heartbeatConfiguration: HeartbeatConfigurationState = {
      currentIntervalMs: this.configuredHeartbeatIntervalMs,
      currentIntervalMinutes:
        this.configuredHeartbeatIntervalMs !== undefined
          ? Number((this.configuredHeartbeatIntervalMs / 60000).toFixed(3))
          : undefined,
      source: this.configuredHeartbeatSource,
      manualOverrideActive: this.manualHeartbeatOverrideMs !== undefined,
      manualOverrideIntervalMinutes:
        this.manualHeartbeatOverrideMs !== undefined
          ? Number((this.manualHeartbeatOverrideMs / 60000).toFixed(3))
          : undefined,
    };

    const chaosMode: ChaosModeState = {
      enabled: this.chaosModeEnabled,
      lastEventAt: this.chaosLastEventAt,
      nextEventAt: this.chaosNextEventAt,
    };

    return {
      options: {
        endpoint: this.vcpOptions.endpoint,
        chargePointId: this.vcpOptions.chargePointId,
        ocppVersion: this.vcpOptions.ocppVersion,
        hasBasicAuthPassword: Boolean(this.vcpOptions.basicAuthPassword),
      },
      connection: { ...this.connectionState },
      supportedActions: this.getSupportedActions(),
      stats: {
        sent: this.telemetry.sent,
        received: this.telemetry.received,
        errors: this.telemetry.errors,
        activeTransactions: activeTransactions.length,
        lastHeartbeatAt,
        averageHeartbeatLatencyMs,
      },
      actionCounters: { ...this.telemetry.actionCounters },
      messages: [...this.telemetry.messages],
      heartbeats: [...this.telemetry.heartbeats],
      meterValues: [...this.telemetry.meterValues],
      transactions: [...this.telemetry.transactions],
      logs: [...this.telemetry.logs],
      heartbeatConfiguration,
      chaosMode,
      activeTransactions,
    };
  }

  async postMessageAction(
    action: string,
    callback: () => void | Promise<void>,
  ) {
    this.postMessageActions[action] = callback;
  }

  isConnected() {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  private async readUiAsset(fileName: string): Promise<string | null> {
    try {
      const filePath = path.resolve(UI_DIRECTORY, path.basename(fileName));
      return await readFile(filePath, "utf8");
    } catch {
      return null;
    }
  }

  private sendDefaultStartupMessages(
    sendBootNotification: boolean,
    sendInitialStatus: boolean,
  ) {
    if (this.vcpOptions.ocppVersion === OcppVersion.OCPP_1_6) {
      if (sendBootNotification) {
        this.send(
          bootNotificationOcppMessage.request({
            chargePointVendor: "Solidstudio",
            chargePointModel: "VirtualChargePoint",
            chargePointSerialNumber: "S001",
            firmwareVersion: "1.0.0",
          }),
        );
      }

      if (sendInitialStatus) {
        this.send(
          statusNotificationOcppMessage.request({
            connectorId: 1,
            errorCode: "NoError",
            status: "Available",
          }),
        );
      }

      return;
    }

    if (this.vcpOptions.ocppVersion === OcppVersion.OCPP_2_0_1) {
      if (sendBootNotification) {
        this.send(
          bootNotificationOcppOutgoingV201.request({
            reason: "PowerUp",
            chargingStation: {
              model: "VirtualChargePoint",
              vendorName: "Solidstudio",
            },
          }),
        );
      }

      if (sendInitialStatus) {
        this.send(
          statusNotificationOcppOutgoingV201.request({
            evseId: 1,
            connectorId: 1,
            connectorStatus: "Available",
            timestamp: new Date().toISOString(),
          }),
        );
      }

      return;
    }

    if (sendBootNotification) {
      this.send(
        bootNotificationOcppOutgoingV21.request({
          reason: "PowerUp",
          chargingStation: {
            model: "VirtualChargePoint",
            vendorName: "Solidstudio",
          },
        }),
      );
    }

    if (sendInitialStatus) {
      this.send(
        statusNotificationOcppOutgoingV21.request({
          evseId: 1,
          connectorId: 1,
          connectorStatus: "Available",
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  private resolveWebsocketUrl() {
    const endpoint = this.vcpOptions.endpoint.replace(/\/+$/, "");
    return `${endpoint}/${this.vcpOptions.chargePointId}`;
  }

  private shouldCloseProcessOnConnectionError() {
    if (this.vcpOptions.closeProcessOnConnectionError !== undefined) {
      return this.vcpOptions.closeProcessOnConnectionError;
    }
    return true;
  }

  private pushSystemLog(
    level: "info" | "warn" | "error",
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    this.pushBounded(this.telemetry.logs, {
      timestamp: new Date().toISOString(),
      level,
      source: "system",
      message,
      metadata,
    }, MAX_LOG_ENTRIES);
  }

  private pushMessageLog(entry: MessageTrace) {
    this.pushBounded(this.telemetry.logs, {
      timestamp: entry.timestamp,
      level: entry.messageType === 4 ? "error" : "info",
      source: "message",
      message: `${entry.direction} ${entry.action ?? "UnknownAction"} (${entry.messageId})`,
      metadata: {
        messageType: entry.messageType,
      },
    }, MAX_LOG_ENTRIES);
  }

  private recordMessage(entry: Omit<MessageTrace, "timestamp">) {
    const timestamp = new Date().toISOString();
    const trace: MessageTrace = {
      ...entry,
      timestamp,
      payload: this.toSerializablePayload(entry.payload),
    };

    this.pushBounded(this.telemetry.messages, trace, MAX_MESSAGE_ENTRIES);
    this.pushMessageLog(trace);

    if (entry.direction.startsWith("outgoing")) {
      this.telemetry.sent += 1;
      if (entry.action) {
        this.incrementActionCounter(entry.action, "outgoing");
      }
    } else {
      this.telemetry.received += 1;
      if (entry.action) {
        this.incrementActionCounter(entry.action, "incoming");
      }
    }

    if (entry.messageType === 4) {
      this.telemetry.errors += 1;
    }

    this.recordHeartbeatTrace(entry.action, entry.messageId, entry.direction, timestamp);
    this.recordMeterValues(entry.action, entry.payload, timestamp);
  }

  private recordDomainEventsForOutgoingAction(
    action: string,
    // biome-ignore lint/suspicious/noExplicitAny: ocpp types
    ocppCall: OcppCall<any>,
  ) {
    if (action === "StartTransaction") {
      this.pushTransactionEvent({
        event: "startRequested",
        connectorId: ocppCall.payload?.connectorId,
        idTag: ocppCall.payload?.idTag,
      });
      return;
    }

    if (action === "StopTransaction") {
      if (ocppCall.payload?.transactionId !== undefined) {
        this.transactionManager.stopTransaction(ocppCall.payload.transactionId);
      }
      this.pushTransactionEvent({
        event: "stopRequested",
        transactionId: ocppCall.payload?.transactionId,
        connectorId: ocppCall.payload?.connectorId,
      });
      return;
    }

    if (action === "TransactionEvent") {
      this.pushTransactionEvent({
        event: "transactionEvent",
        transactionId: ocppCall.payload?.transactionInfo?.transactionId,
        connectorId:
          ocppCall.payload?.evse?.connectorId ?? ocppCall.payload?.evse?.id,
        details: ocppCall.payload?.eventType,
      });
    }
  }

  private recordHeartbeatTrace(
    action: string | undefined,
    messageId: string,
    direction: MessageDirection,
    timestamp: string,
  ) {
    if (action !== "Heartbeat") {
      return;
    }

    if (direction === "outgoingCall") {
      const sentAt = Date.now();
      this.pendingHeartbeatSentAt.set(messageId, sentAt);
      this.pushBounded(this.telemetry.heartbeats, {
        timestamp,
        phase: "sent",
        messageId,
      }, MAX_HEARTBEAT_ENTRIES);
      return;
    }

    if (direction === "incomingCallResult") {
      const sentAt = this.pendingHeartbeatSentAt.get(messageId);
      const latencyMs = sentAt ? Date.now() - sentAt : undefined;
      this.pendingHeartbeatSentAt.delete(messageId);
      this.pushBounded(this.telemetry.heartbeats, {
        timestamp,
        phase: "ack",
        messageId,
        latencyMs,
      }, MAX_HEARTBEAT_ENTRIES);
    }
  }

  private recordMeterValues(
    action: string | undefined,
    payload: unknown,
    timestamp: string,
  ) {
    if (!action || action !== "MeterValues") {
      return;
    }

    const candidate = payload as {
      connectorId?: number;
      evseId?: number;
      transactionId?: string | number;
      meterValue?: Array<{
        sampledValue?: Array<{
          value?: string | number;
          unit?: string;
          measurand?: string;
          unitOfMeasure?: {
            unit?: string;
          };
        }>;
      }>;
    };

    if (!Array.isArray(candidate.meterValue)) {
      return;
    }

    for (const reading of candidate.meterValue) {
      if (!Array.isArray(reading.sampledValue)) {
        continue;
      }

      for (const sample of reading.sampledValue) {
        const numericValue = Number(sample.value);
        if (Number.isNaN(numericValue)) {
          continue;
        }

        this.pushBounded(this.telemetry.meterValues, {
          timestamp,
          connectorId: candidate.connectorId,
          evseId: candidate.evseId,
          transactionId: candidate.transactionId,
          value: numericValue,
          unit: sample.unit ?? sample.unitOfMeasure?.unit,
          measurand: sample.measurand,
        }, MAX_METER_ENTRIES);
      }
    }
  }

  private pushTransactionEvent(
    event: Omit<TransactionTrace, "timestamp">,
  ) {
    this.pushBounded(this.telemetry.transactions, {
      timestamp: new Date().toISOString(),
      ...event,
    }, MAX_TRANSACTION_ENTRIES);
  }

  private incrementActionCounter(action: string, direction: "outgoing" | "incoming") {
    if (!this.telemetry.actionCounters[action]) {
      this.telemetry.actionCounters[action] = { outgoing: 0, incoming: 0 };
    }
    this.telemetry.actionCounters[action][direction] += 1;
  }

  private startChaosModeScheduler() {
    this.stopChaosModeScheduler();
    if (!this.chaosModeEnabled) {
      return;
    }
    if (!this.isConnected()) {
      return;
    }
    this.scheduleNextChaosEvent();
  }

  private stopChaosModeScheduler() {
    if (this.chaosModeTimer) {
      clearTimeout(this.chaosModeTimer);
      this.chaosModeTimer = undefined;
    }
    this.chaosNextEventAt = undefined;
  }

  private scheduleNextChaosEvent() {
    if (!this.chaosModeEnabled) {
      return;
    }

    const delayMs = this.randomInt(4000, 10000);
    this.chaosNextEventAt = new Date(Date.now() + delayMs).toISOString();
    this.chaosModeTimer = setTimeout(() => {
      this.runChaosEvent();
    }, delayMs);
  }

  private runChaosEvent() {
    this.chaosModeTimer = undefined;
    this.chaosNextEventAt = undefined;

    if (!this.chaosModeEnabled) {
      return;
    }

    if (this.isConnected()) {
      try {
        this.emitRandomChaosAction();
        this.chaosLastEventAt = new Date().toISOString();
      } catch (error) {
        this.pushSystemLog("error", "Chaos mode action failed", {
          error: this.errorMessage(error),
        });
      }
    }

    this.scheduleNextChaosEvent();
  }

  private emitRandomChaosAction() {
    const action = this.randomFrom(["Heartbeat", "StatusNotification", "MeterValues"]);
    let payload: unknown = {};

    if (action === "StatusNotification") {
      payload = this.buildChaosStatusPayload();
    } else if (action === "MeterValues") {
      payload = this.buildChaosMeterValuesPayload();
    }

    this.send(call(action, payload));
    this.pushSystemLog("warn", "Chaos mode sent action", {
      action,
    });
  }

  private buildChaosStatusPayload() {
    if (this.vcpOptions.ocppVersion === OcppVersion.OCPP_1_6) {
      const status = this.randomFrom([
        "Available",
        "Preparing",
        "Charging",
        "Finishing",
        "Faulted",
      ]);
      const hasError = status === "Faulted";
      return {
        connectorId: 1,
        errorCode: hasError ? "InternalError" : "NoError",
        status,
      };
    }

    return {
      evseId: 1,
      connectorId: 1,
      connectorStatus: this.randomFrom([
        "Available",
        "Occupied",
        "Reserved",
        "Unavailable",
        "Faulted",
      ]),
      timestamp: new Date().toISOString(),
    };
  }

  private buildChaosMeterValuesPayload() {
    const value = Number((this.randomInt(120, 560) / 10).toFixed(1));

    if (this.vcpOptions.ocppVersion === OcppVersion.OCPP_1_6) {
      return {
        connectorId: 1,
        meterValue: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [
              {
                value: value.toString(),
                measurand: "Energy.Active.Import.Register",
                unit: "kWh",
              },
            ],
          },
        ],
      };
    }

    return {
      evseId: 1,
      meterValue: [
        {
          timestamp: new Date().toISOString(),
          sampledValue: [
            {
              value,
              context: "Sample.Periodic",
              measurand: "Energy.Active.Import.Register",
              unitOfMeasure: {
                unit: "kWh",
              },
            },
          ],
        },
      ],
    };
  }

  private randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private randomFrom<T>(items: T[]): T {
    return items[this.randomInt(0, items.length - 1)];
  }

  private clearHeartbeatScheduler() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  private resetTelemetry() {
    this.pendingHeartbeatSentAt.clear();
    this.telemetry.sent = 0;
    this.telemetry.received = 0;
    this.telemetry.errors = 0;
    this.telemetry.messages = [];
    this.telemetry.logs = [];
    this.telemetry.heartbeats = [];
    this.telemetry.meterValues = [];
    this.telemetry.transactions = [];
    this.telemetry.actionCounters = {};
  }

  private getSupportedActions() {
    const actionsByVersion: Record<OcppVersionType, string[]> = {
      [OcppVersion.OCPP_1_6]: Object.keys(ocppOutgoingMessagesV16),
      [OcppVersion.OCPP_2_0_1]: Object.keys(ocppOutgoingMessagesV201),
      [OcppVersion.OCPP_2_1]: Object.keys(ocppOutgoingMessagesV21),
    };

    return actionsByVersion[this.vcpOptions.ocppVersion].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  private toSerializablePayload(payload: unknown): unknown {
    if (payload === undefined) {
      return null;
    }

    try {
      return JSON.parse(JSON.stringify(payload));
    } catch {
      return { value: String(payload) };
    }
  }

  private pushBounded<T>(buffer: T[], entry: T, maxEntries: number) {
    buffer.push(entry);
    if (buffer.length > maxEntries) {
      buffer.splice(0, buffer.length - maxEntries);
    }
  }

  private _onMessage(message: string) {
    logger.info(`Receive message ⬅️  ${message}`);
    const data = JSON.parse(message);
    const [type, ...rest] = data;

    if (type === 2) {
      const [messageId, action, payload] = rest;

      this.recordMessage({
        direction: "incomingCall",
        messageType: 2,
        messageId,
        action,
        payload,
      });

      if (action === "RemoteStartTransaction") {
        this.pushTransactionEvent({ event: "remoteStart" });
      }
      if (action === "RemoteStopTransaction") {
        this.pushTransactionEvent({ event: "remoteStop" });
      }

      validateOcppIncomingRequest(this.vcpOptions.ocppVersion, action, payload);
      this.messageHandler.handleCall(this, { messageId, action, payload });
      if (this.postMessageActions[action]) {
        logger.info(`Executing postMessageAction for ${action}`);
        this.postMessageActions[action]();
      }
    } else if (type === 3) {
      const [messageId, payload] = rest;
      const enqueuedCall = ocppOutbox.get(messageId);
      if (!enqueuedCall) {
        if (process.env.CONTINUE_ON_UNKNOWN_MESSAGE_ID) {
          return;
        }
        throw new Error(
          `Received CallResult for unknown messageId=${messageId}`,
        );
      }

      this.recordMessage({
        direction: "incomingCallResult",
        messageType: 3,
        messageId,
        action: enqueuedCall.action,
        payload,
      });

      if (enqueuedCall.action === "StartTransaction") {
        this.pushTransactionEvent({
          event: "startConfirmed",
          transactionId: payload?.transactionId,
          connectorId: enqueuedCall.payload?.connectorId,
        });
      }

      if (enqueuedCall.action === "StopTransaction") {
        this.pushTransactionEvent({
          event: "stopConfirmed",
          transactionId: enqueuedCall.payload?.transactionId,
        });
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
    } else if (type === 4) {
      const [messageId, errorCode, errorDescription, errorDetails] = rest;

      this.recordMessage({
        direction: "incomingCallError",
        messageType: 4,
        messageId,
        payload: {
          errorCode,
          errorDescription,
          errorDetails,
        },
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
    this.clearHeartbeatScheduler();
    this.stopChaosModeScheduler();
    this.connectionState.connected = false;
    this.connectionState.connecting = false;
    this.connectionState.lastDisconnectedAt = new Date().toISOString();
    this.ws = undefined;

    if (this.isFinishing) {
      return;
    }

    logger.info(`Connection closed. code=${code}, reason=${reason}`);
    this.pushSystemLog("warn", "Connection closed", {
      code,
      reason,
    });

    if (this.shouldCloseProcessOnConnectionError()) {
      close(this);
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
