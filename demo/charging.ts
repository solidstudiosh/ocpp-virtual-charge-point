// ---------------------------------------------------------------------------
// Charging session logic (start/stop, meter values for OCPP 1.6 and 2.0.1)
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { CONFIG, randomBetween, randomInt, randomRfid } from "./config.js";
import { C, logInfo, stats } from "./stats.js";
import type { ChargingSession, OcppProtocol } from "./types.js";

// ---------------------------------------------------------------------------
// Station interface for charging — avoids circular dependency
// ---------------------------------------------------------------------------

interface ChargingStation {
  readonly id: string;
  readonly protocol: OcppProtocol;
  state: string;
  session: ChargingSession | null;
  meterBaseWh: number;
  send(action: string, payload: unknown): Promise<unknown>;
  sendStatusNotification(status: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Start charging session (entry point)
// ---------------------------------------------------------------------------

export function startChargingSession(
  station: ChargingStation,
  idTag?: string,
  connectorId = 1,
): void {
  if (station.session || station.state !== "available") return;

  const rfid = idTag ?? randomRfid();
  const targetKwh = randomBetween(5, 80);
  const targetEnergyWh = targetKwh * 1000;
  const durationMs = randomBetween(
    CONFIG.sessionMinMinutes * 60_000,
    CONFIG.sessionMaxMinutes * 60_000,
  );

  station.session = {
    transactionId: null,
    idTag: rfid,
    meterStartWh: station.meterBaseWh,
    targetEnergyWh,
    currentEnergyWh: 0,
    startedAt: Date.now(),
    durationMs,
    meterTimer: null,
    seqNo: 0,
  };

  logInfo(
    station.id,
    `${C.yellow}Started charging${C.reset} (${rfid}, target: ${targetKwh.toFixed(1)} kWh, ${(durationMs / 60_000).toFixed(1)} min)`,
  );

  if (station.protocol === "ocpp1.6") {
    startSession16(station, connectorId);
  } else {
    startSession201(station, connectorId);
  }
}

// ---------------------------------------------------------------------------
// OCPP 1.6 session lifecycle
// ---------------------------------------------------------------------------

async function startSession16(
  station: ChargingStation,
  connectorId: number,
): Promise<void> {
  if (!station.session) return;

  station.state = "preparing";
  await station.sendStatusNotification("Preparing");
  if (!station.session) return;

  const response = await station.send("StartTransaction", {
    connectorId,
    idTag: station.session.idTag,
    meterStart: Math.floor(station.session.meterStartWh),
    timestamp: new Date().toISOString(),
  });
  if (!station.session) return;

  // Extract transactionId
  if (response && typeof response === "object") {
    const res = response as Record<string, unknown>;
    if (typeof res.transactionId === "number") {
      station.session.transactionId = res.transactionId;
    } else {
      station.session.transactionId = randomInt(100000, 999999);
    }
  } else {
    station.session.transactionId = randomInt(100000, 999999);
  }

  station.state = "charging";
  await station.sendStatusNotification("Charging");
  if (!station.session) return;

  // Start MeterValues loop
  station.session.meterTimer = setInterval(() => {
    sendMeterValues16(station, connectorId);
  }, CONFIG.meterIntervalMs);

  // Schedule stop
  const durationMs = station.session.durationMs;
  setTimeout(() => {
    if (station.session && station.state === "charging") {
      stopChargingSession(station, "Local");
    }
  }, durationMs);
}

function sendMeterValues16(
  station: ChargingStation,
  connectorId: number,
): void {
  if (!station.session) return;

  const elapsed = Date.now() - station.session.startedAt;
  const progress = Math.min(elapsed / station.session.durationMs, 1);
  station.session.currentEnergyWh =
    progress * station.session.targetEnergyWh;

  const totalMeterWh =
    station.session.meterStartWh + station.session.currentEnergyWh;

  station.send("MeterValues", {
    connectorId,
    transactionId: station.session.transactionId,
    meterValue: [
      {
        timestamp: new Date().toISOString(),
        sampledValue: [
          {
            value: (totalMeterWh / 1000).toFixed(3),
            measurand: "Energy.Active.Import.Register",
            unit: "kWh",
          },
          {
            value: randomBetween(3, 22).toFixed(1),
            measurand: "Power.Active.Import",
            unit: "kW",
          },
          {
            value: randomBetween(220, 240).toFixed(1),
            measurand: "Voltage",
            unit: "V",
          },
          {
            value: randomBetween(8, 32).toFixed(1),
            measurand: "Current.Import",
            unit: "A",
          },
          {
            value: randomInt(20, 95).toString(),
            measurand: "SoC",
            unit: "Percent",
          },
        ],
      },
    ],
  });
}

async function stopSession16(
  station: ChargingStation,
  reason: string,
): Promise<void> {
  if (!station.session) return;

  const meterStop = Math.floor(
    station.session.meterStartWh + station.session.currentEnergyWh,
  );

  await station.send("StopTransaction", {
    transactionId: station.session.transactionId,
    meterStop,
    timestamp: new Date().toISOString(),
    reason,
  });
}

// ---------------------------------------------------------------------------
// OCPP 2.0.1 session lifecycle
// ---------------------------------------------------------------------------

async function startSession201(
  station: ChargingStation,
  connectorId: number,
): Promise<void> {
  if (!station.session) return;

  const txId = randomUUID();
  station.session.transactionId = txId;

  station.state = "preparing";
  await station.sendStatusNotification("Preparing");
  if (!station.session) return;

  station.session.seqNo = 0;
  await station.send("TransactionEvent", {
    eventType: "Started",
    timestamp: new Date().toISOString(),
    triggerReason: "Authorized",
    seqNo: station.session.seqNo,
    transactionInfo: {
      transactionId: txId,
      chargingState: "EVConnected",
    },
    idToken: {
      idToken: station.session.idTag,
      type: "ISO14443",
    },
    evse: {
      id: 1,
      connectorId,
    },
    meterValue: [
      {
        timestamp: new Date().toISOString(),
        sampledValue: [
          {
            value: 0,
            measurand: "Energy.Active.Import.Register",
            unitOfMeasure: { unit: "Wh" },
          },
        ],
      },
    ],
  });

  if (!station.session) return;

  station.state = "charging";
  await station.sendStatusNotification("Charging");
  if (!station.session) return;

  // Start MeterValues loop
  station.session.meterTimer = setInterval(() => {
    sendMeterValues201(station, connectorId);
  }, CONFIG.meterIntervalMs);

  // Schedule stop
  const durationMs = station.session.durationMs;
  setTimeout(() => {
    if (station.session && station.state === "charging") {
      stopChargingSession(station, "Local");
    }
  }, durationMs);
}

function sendMeterValues201(
  station: ChargingStation,
  connectorId: number,
): void {
  if (!station.session) return;

  const elapsed = Date.now() - station.session.startedAt;
  const progress = Math.min(elapsed / station.session.durationMs, 1);
  station.session.currentEnergyWh =
    progress * station.session.targetEnergyWh;
  station.session.seqNo++;

  station.send("TransactionEvent", {
    eventType: "Updated",
    timestamp: new Date().toISOString(),
    triggerReason: "MeterValuePeriodic",
    seqNo: station.session.seqNo,
    transactionInfo: {
      transactionId: station.session.transactionId,
      chargingState: "Charging",
    },
    evse: {
      id: 1,
      connectorId,
    },
    meterValue: [
      {
        timestamp: new Date().toISOString(),
        sampledValue: [
          {
            value: parseFloat(
              (
                station.session.meterStartWh +
                station.session.currentEnergyWh
              ).toFixed(1),
            ),
            measurand: "Energy.Active.Import.Register",
            unitOfMeasure: { unit: "Wh" },
          },
          {
            value: parseFloat(randomBetween(3000, 22000).toFixed(0)),
            measurand: "Power.Active.Import",
            unitOfMeasure: { unit: "W" },
          },
          {
            value: parseFloat(randomBetween(220, 240).toFixed(1)),
            measurand: "Voltage",
            unitOfMeasure: { unit: "V" },
          },
        ],
      },
    ],
  });
}

async function stopSession201(
  station: ChargingStation,
  reason: string,
): Promise<void> {
  if (!station.session) return;

  station.session.seqNo++;

  const stoppedReason = reason === "Remote" ? "Remote" : "Local";

  await station.send("TransactionEvent", {
    eventType: "Ended",
    timestamp: new Date().toISOString(),
    triggerReason: reason === "Remote" ? "RemoteStop" : "StopAuthorized",
    seqNo: station.session.seqNo,
    transactionInfo: {
      transactionId: station.session.transactionId,
      chargingState: "Idle",
      stoppedReason,
    },
    evse: {
      id: 1,
      connectorId: 1,
    },
    meterValue: [
      {
        timestamp: new Date().toISOString(),
        sampledValue: [
          {
            value: parseFloat(
              (
                station.session.meterStartWh +
                station.session.currentEnergyWh
              ).toFixed(1),
            ),
            measurand: "Energy.Active.Import.Register",
            unitOfMeasure: { unit: "Wh" },
          },
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Stop charging session (entry point)
// ---------------------------------------------------------------------------

export async function stopChargingSession(
  station: ChargingStation,
  reason: string,
): Promise<void> {
  if (!station.session) return;

  // Finalize energy
  const elapsed = Date.now() - station.session.startedAt;
  const progress = Math.min(elapsed / station.session.durationMs, 1);
  station.session.currentEnergyWh =
    progress * station.session.targetEnergyWh;

  const deliveredKwh = station.session.currentEnergyWh / 1000;
  const durationMin = elapsed / 60_000;

  // Clear meter timer
  if (station.session.meterTimer) {
    clearInterval(station.session.meterTimer);
    station.session.meterTimer = null;
  }

  station.state = "finishing";

  if (station.protocol === "ocpp1.6") {
    await stopSession16(station, reason);
  } else {
    await stopSession201(station, reason);
  }

  // Update base meter
  station.meterBaseWh += station.session.currentEnergyWh;

  // Update stats
  stats.sessionsCompleted++;
  stats.totalEnergyKwh += deliveredKwh;
  stats.totalSessionDurationMs += elapsed;
  stats.sessionCount++;

  logInfo(
    station.id,
    `${C.green}Stopped charging${C.reset} (${deliveredKwh.toFixed(1)} kWh, ${durationMin.toFixed(1)} min, reason: ${reason})`,
  );

  station.session = null;
  station.state = "available";
  station.sendStatusNotification("Available").catch(() => {});
}

// ---------------------------------------------------------------------------
// Abort session (on disconnect — no OCPP messages sent)
// ---------------------------------------------------------------------------

export function abortSession(station: ChargingStation): void {
  if (!station.session) return;
  if (station.session.meterTimer) {
    clearInterval(station.session.meterTimer);
    station.session.meterTimer = null;
  }
  const elapsed = Date.now() - station.session.startedAt;
  const progress = Math.min(elapsed / station.session.durationMs, 1);
  const deliveredKwh = (progress * station.session.targetEnergyWh) / 1000;
  station.meterBaseWh += progress * station.session.targetEnergyWh;
  stats.sessionsCompleted++;
  stats.totalEnergyKwh += deliveredKwh;
  stats.totalSessionDurationMs += elapsed;
  stats.sessionCount++;
  station.session = null;
}
