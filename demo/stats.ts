// ---------------------------------------------------------------------------
// Color helpers, logging, and statistics tracking
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";
import type { Stats, Station } from "./types.js";

// ---------------------------------------------------------------------------
// ANSI color helpers
// ---------------------------------------------------------------------------

export const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  bold: "\x1b[1m",
};

function ts(): string {
  return new Date().toTimeString().slice(0, 8);
}

export function logInfo(stationId: string, msg: string): void {
  console.log(
    `${C.dim}[${ts()}]${C.reset} ${C.cyan}[${stationId}]${C.reset} ${msg}`,
  );
}

export function logDebug(stationId: string, msg: string): void {
  if (CONFIG.logLevel === "debug") {
    console.log(
      `${C.dim}[${ts()}]${C.reset} ${C.dim}[${stationId}] ${msg}${C.reset}`,
    );
  }
}

function logStats(line: string): void {
  console.log(`${C.bold}${C.green}[${ts()}]${C.reset} ${line}`);
}

// ---------------------------------------------------------------------------
// Global stats singleton
// ---------------------------------------------------------------------------

export const stats: Stats = {
  sessionsCompleted: 0,
  totalEnergyKwh: 0,
  totalSessionDurationMs: 0,
  sessionCount: 0,
};

// ---------------------------------------------------------------------------
// Stats display
// ---------------------------------------------------------------------------

export function printStats(allStations: Station[]): void {
  const connected = allStations.filter(
    (s) => s.state !== "disconnected" && s.state !== "connecting",
  ).length;
  const charging = allStations.filter((s) => s.state === "charging").length;
  const available = allStations.filter((s) => s.state === "available").length;
  const disconnected = allStations.filter(
    (s) => s.state === "disconnected" || s.state === "connecting",
  ).length;
  const preparing = allStations.filter((s) => s.state === "preparing").length;
  const finishing = allStations.filter((s) => s.state === "finishing").length;

  logStats(
    `Connected: ${C.cyan}${connected}/${allStations.length}${C.reset}${C.bold}${C.green} | ` +
      `${C.yellow}Charging: ${charging}${C.reset}${C.bold}${C.green} | ` +
      `${C.green}Available: ${available}${C.reset}${C.bold}${C.green} | ` +
      `${C.magenta}Preparing/Finishing: ${preparing + finishing}${C.reset}${C.bold}${C.green} | ` +
      `${C.red}Disconnected: ${disconnected}${C.reset}${C.bold}${C.green} | ` +
      `${C.white}Sessions: ${stats.sessionsCompleted}${C.reset}${C.bold}${C.green} | ` +
      `${C.white}Energy: ${stats.totalEnergyKwh.toFixed(1)} kWh${C.reset}`,
  );
}

// ---------------------------------------------------------------------------
// Final statistics on shutdown
// ---------------------------------------------------------------------------

export function printFinalStats(stationCount: number): void {
  const avgDuration =
    stats.sessionCount > 0
      ? (stats.totalSessionDurationMs / stats.sessionCount / 60_000).toFixed(1)
      : "0";

  console.log(`${C.bold}${C.cyan}=== Final Statistics ===${C.reset}`);
  console.log(`  Total stations:           ${stationCount}`);
  console.log(
    `  Protocol split:           ${Math.floor(stationCount * 0.7)} OCPP 1.6 / ${stationCount - Math.floor(stationCount * 0.7)} OCPP 2.0.1`,
  );
  console.log(`  Sessions completed:       ${stats.sessionsCompleted}`);
  console.log(
    `  Total energy delivered:    ${stats.totalEnergyKwh.toFixed(1)} kWh`,
  );
  console.log(`  Avg session duration:      ${avgDuration} min`);
  console.log(
    `  Avg energy per session:    ${stats.sessionCount > 0 ? (stats.totalEnergyKwh / stats.sessionCount).toFixed(1) : "0"} kWh`,
  );
  console.log("");
}
