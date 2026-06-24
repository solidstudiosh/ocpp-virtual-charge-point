// ---------------------------------------------------------------------------
// Station class — connection lifecycle, WebSocket, message handling
// ---------------------------------------------------------------------------

import WebSocket from "ws";
import { randomUUID } from "node:crypto";
import { CONFIG, randomBetween, randomRfid } from "./config.js";
import {
  startChargingSession,
  stopChargingSession,
  abortSession,
} from "./charging.js";
import { logDebug, logInfo, C } from "./stats.js";
import type {
  OcppProtocol,
  StationState,
  ChargingSession,
  PendingCall,
} from "./types.js";

// ---------------------------------------------------------------------------
// Station ID generator — distributes names across proxy routing rules:
//   ~10% SIM-00xx  → unstable target
//   ~20% SIM-1xxx  → slow target
//   ~10% ACE-xxxx  → unstable target
//   ~5%  CHARGER-x → wildcard fallback (realistic names)
//   ~5%  EVB-xxxx  → wildcard fallback (realistic names)
//   ~50% SIM-xxxx  → wildcard fallback (default)
// ---------------------------------------------------------------------------

const PREFIXES: { prefix: string; weight: number; pad: number }[] = [
  { prefix: "SIM-00", weight: 10, pad: 2 },
  { prefix: "SIM-1",  weight: 20, pad: 3 },
  { prefix: "ACE-",   weight: 10, pad: 4 },
  { prefix: "AUTH-",  weight: 5, pad: 3 },
  { prefix: "CHARGER-", weight: 5, pad: 3 },
  { prefix: "EVB-",   weight: 5, pad: 4 },
  { prefix: "SIM-",   weight: 45, pad: 4 },
];

const TOTAL_WEIGHT = PREFIXES.reduce((s, p) => s + p.weight, 0);
const prefixCounters = new Map<string, number>();

function generateStationId(index: number): string {
  let roll = (index * 7 + 13) % TOTAL_WEIGHT;
  for (const { prefix, weight, pad } of PREFIXES) {
    roll -= weight;
    if (roll < 0) {
      const seq = (prefixCounters.get(prefix) ?? 0) + 1;
      prefixCounters.set(prefix, seq);
      return `${prefix}${String(seq).padStart(pad, "0")}`;
    }
  }
  return `SIM-${String(index).padStart(4, "0")}`;
}

export class Station {
  readonly id: string;
  readonly serial: string;
  readonly protocol: OcppProtocol;

  state: StationState = "disconnected";
  ws: WebSocket | null = null;
  heartbeatIntervalMs = 30_000;
  heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  session: ChargingSession | null = null;
  pendingCalls: Map<string, PendingCall> = new Map();
  reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  meterBaseWh = 0; // cumulative meter across sessions
  intentionalDisconnect = false;
  destroyed = false;

  constructor(index: number, totalStations: number) {
    this.id = generateStationId(index);
    this.serial = `SER-${String(index).padStart(4, "0")}`;
    // 70% OCPP 1.6, 30% OCPP 2.0.1
    this.protocol =
      index <= Math.floor(totalStations * 0.7) ? "ocpp1.6" : "ocpp2.0.1";
  }

  // --- Connection lifecycle ---

  connect(): void {
    if (this.destroyed) return;
    this.clearReconnectTimer();
    this.state = "connecting";

    try {
      this.ws = new WebSocket(`${CONFIG.wsUrl}/${this.id}`, [this.protocol]);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      logDebug(this.id, "WebSocket connected");
      this.sendBootNotification();
    });

    this.ws.on("message", (data: WebSocket.Data) => {
      this.handleMessage(data.toString());
    });

    this.ws.on("close", () => {
      this.cleanup();
      if (!this.destroyed && !this.intentionalDisconnect) {
        this.scheduleReconnect();
      }
      this.intentionalDisconnect = false;
    });

    this.ws.on("error", () => {
      // close event fires after error
    });
  }

  disconnect(intentional = false): void {
    this.intentionalDisconnect = intentional;
    if (this.session) {
      abortSession(this);
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.state = "disconnected";
  }

  destroy(): void {
    this.destroyed = true;
    this.clearReconnectTimer();
    this.clearHeartbeat();
    if (this.session?.meterTimer) {
      clearInterval(this.session.meterTimer);
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }
  }

  private cleanup(): void {
    this.clearHeartbeat();
    if (this.session?.meterTimer) {
      clearInterval(this.session.meterTimer);
      this.session.meterTimer = null;
    }
    this.pendingCalls.clear();
    this.ws = null;
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    this.state = "disconnected";
    const delay = randomBetween(CONFIG.reconnectMinMs, CONFIG.reconnectMaxMs);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // --- Heartbeat ---

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatIntervalMs);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // --- OCPP message sending (public for charging module) ---

  send(action: string, payload: unknown): Promise<unknown> {
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        resolve(null);
        return;
      }
      const msgId = randomUUID();
      this.pendingCalls.set(msgId, { action, payload, resolve });
      const msg = JSON.stringify([2, msgId, action, payload]);
      logDebug(this.id, `>>> ${action}`);
      try {
        this.ws.send(msg);
      } catch {
        this.pendingCalls.delete(msgId);
        resolve(null);
      }
      // Timeout pending calls after 30s to prevent memory leaks
      setTimeout(() => {
        if (this.pendingCalls.has(msgId)) {
          this.pendingCalls.delete(msgId);
          resolve(null);
        }
      }, 30_000);
    });
  }

  private sendResponse(msgId: string, payload: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg = JSON.stringify([3, msgId, payload]);
    logDebug(this.id, `>>> Response to ${msgId}`);
    try {
      this.ws.send(msg);
    } catch {
      // ignore
    }
  }

  // --- Message handling ---

  private handleMessage(raw: string): void {
    let parsed: unknown[];
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (!Array.isArray(parsed) || parsed.length < 3) return;

    const messageType = parsed[0] as number;

    // CallResult [3, msgId, payload]
    if (messageType === 3) {
      const msgId = parsed[1] as string;
      const payload = parsed[2];
      const pending = this.pendingCalls.get(msgId);
      if (pending) {
        this.pendingCalls.delete(msgId);
        logDebug(this.id, `<<< ${pending.action} response`);
        pending.resolve(payload);
      }
      return;
    }

    // CallError [4, msgId, errorCode, errorDescription, errorDetails]
    if (messageType === 4) {
      const msgId = parsed[1] as string;
      const pending = this.pendingCalls.get(msgId);
      if (pending) {
        this.pendingCalls.delete(msgId);
        logDebug(this.id, `<<< ${pending.action} error: ${parsed[2]}`);
        pending.resolve(null);
      }
      return;
    }

    // Call [2, msgId, action, payload] — incoming from CSMS
    if (messageType === 2 && parsed.length >= 4) {
      const msgId = parsed[1] as string;
      const action = parsed[2] as string;
      const payload = parsed[3] as Record<string, unknown>;
      this.handleIncomingCall(msgId, action, payload);
    }
  }

  private handleIncomingCall(
    msgId: string,
    action: string,
    payload: Record<string, unknown>,
  ): void {
    logDebug(this.id, `<<< Incoming: ${action}`);

    switch (action) {
      case "RemoteStartTransaction": {
        if (this.state === "available" && !this.session) {
          this.sendResponse(msgId, { status: "Accepted" });
          const idTag = (payload.idTag as string) ?? randomRfid();
          const connectorId = (payload.connectorId as number) ?? 1;
          this.startChargingSession(idTag, connectorId);
        } else {
          this.sendResponse(msgId, { status: "Rejected" });
        }
        break;
      }
      case "RequestStartTransaction": {
        if (this.state === "available" && !this.session) {
          this.sendResponse(msgId, { status: "Accepted" });
          const idToken = payload.idToken as
            | { idToken: string }
            | undefined;
          const idTag = idToken?.idToken ?? randomRfid();
          this.startChargingSession(idTag, 1);
        } else {
          this.sendResponse(msgId, { status: "Rejected" });
        }
        break;
      }
      case "RemoteStopTransaction": {
        const txId = payload.transactionId as number;
        if (this.session && this.session.transactionId === txId) {
          this.sendResponse(msgId, { status: "Accepted" });
          this.stopChargingSession("Remote");
        } else {
          this.sendResponse(msgId, { status: "Rejected" });
        }
        break;
      }
      case "RequestStopTransaction": {
        const txId = payload.transactionId as string;
        if (this.session && this.session.transactionId === txId) {
          this.sendResponse(msgId, { status: "Accepted" });
          this.stopChargingSession("Remote");
        } else {
          this.sendResponse(msgId, { status: "Rejected" });
        }
        break;
      }
      case "Reset": {
        this.sendResponse(msgId, { status: "Accepted" });
        logInfo(
          this.id,
          `${C.red}Reset requested — reconnecting${C.reset}`,
        );
        this.disconnect();
        setTimeout(
          () => this.connect(),
          randomBetween(2000, 5000),
        );
        break;
      }
      case "GetConfiguration":
      case "GetVariables": {
        this.sendResponse(
          msgId,
          this.protocol === "ocpp1.6"
            ? { configurationKey: [], unknownKey: [] }
            : { getVariableResult: [] },
        );
        break;
      }
      case "ChangeConfiguration":
      case "SetVariables": {
        this.sendResponse(
          msgId,
          this.protocol === "ocpp1.6"
            ? { status: "Accepted" }
            : { setVariableResult: [] },
        );
        break;
      }
      case "TriggerMessage": {
        this.sendResponse(msgId, { status: "Accepted" });
        break;
      }
      default: {
        // Unknown action — respond with NotImplemented CallError
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            this.ws.send(
              JSON.stringify([
                4,
                msgId,
                "NotImplemented",
                `${action} not supported`,
                {},
              ]),
            );
          } catch {
            // ignore
          }
        }
        break;
      }
    }
  }

  // --- Boot sequence ---

  private async sendBootNotification(): Promise<void> {
    let response: unknown;

    if (this.protocol === "ocpp1.6") {
      response = await this.send("BootNotification", {
        chargePointVendor: "Solidstudio",
        chargePointModel: "VirtualCP",
        chargePointSerialNumber: this.serial,
        firmwareVersion: "1.0.0",
      });
    } else {
      response = await this.send("BootNotification", {
        reason: "PowerUp",
        chargingStation: {
          vendorName: "Solidstudio",
          model: "VirtualCP",
          serialNumber: this.serial,
          firmwareVersion: "1.0.0",
        },
      });
    }

    // Extract heartbeat interval
    if (response && typeof response === "object") {
      const res = response as Record<string, unknown>;
      if (typeof res.interval === "number" && res.interval > 0) {
        this.heartbeatIntervalMs = res.interval * 1000;
      }
    }

    // Send StatusNotification (Available)
    await this.sendStatusNotification("Available");
    this.state = "available";
    this.startHeartbeat();
    logDebug(
      this.id,
      `Booted (heartbeat ${this.heartbeatIntervalMs / 1000}s)`,
    );
  }

  sendStatusNotification(status: string): Promise<void> {
    if (this.protocol === "ocpp1.6") {
      return this.send("StatusNotification", {
        connectorId: 1,
        errorCode: "NoError",
        status,
        timestamp: new Date().toISOString(),
      }) as Promise<void>;
    }
    const connectorStatus =
      status === "Charging" ||
      status === "Preparing" ||
      status === "Finishing"
        ? "Occupied"
        : status === "Available"
          ? "Available"
          : "Unavailable";
    return this.send("StatusNotification", {
      timestamp: new Date().toISOString(),
      connectorStatus,
      evseId: 1,
      connectorId: 1,
    }) as Promise<void>;
  }

  private sendHeartbeat(): void {
    this.send("Heartbeat", {});
  }

  // --- Charging session delegates ---

  startChargingSession(idTag?: string, connectorId = 1): void {
    startChargingSession(this, idTag, connectorId);
  }

  async stopChargingSession(reason: string): Promise<void> {
    await stopChargingSession(this, reason);
  }

  // --- Tick: called every 30s for random behaviors ---

  tick(): void {
    if (this.state === "available" && !this.session) {
      if (Math.random() < CONFIG.chargeProbability) {
        this.startChargingSession();
      }
    }
  }

  // --- Random disconnect check: called every minute ---

  disconnectCheck(): void {
    if (this.state === "disconnected" || this.destroyed) return;
    if (Math.random() < CONFIG.disconnectProbability) {
      logInfo(
        this.id,
        `${C.red}Network disruption — disconnecting${C.reset}`,
      );
      this.disconnect();
      const reconnectDelay = randomBetween(10_000, 60_000);
      setTimeout(() => {
        if (!this.destroyed) {
          logInfo(
            this.id,
            `${C.blue}Reconnecting after disruption${C.reset}`,
          );
          this.connect();
        }
      }, reconnectDelay);
    }
  }
}
