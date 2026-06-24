// ---------------------------------------------------------------------------
// OCPP Network Simulator — main entry point
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";
import { Station } from "./station.js";
import { printStats, printFinalStats, C } from "./stats.js";
import {
  scheduleEnvScenarios,
  setupInteractiveInput,
  startChaosLoop,
  printHotkeys,
} from "./scenarios.js";

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------

const allStations: Station[] = [];
let tickTimer: ReturnType<typeof setInterval> | null = null;
let statsTimer: ReturnType<typeof setInterval> | null = null;
let disconnectTimer: ReturnType<typeof setInterval> | null = null;
let shuttingDown = false;

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;

  // Restore stdin so the process can exit cleanly
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(false);
  }
  process.stdin.pause();

  console.log("");
  console.log(`${C.bold}${C.red}=== Shutting down ===${C.reset}`);
  console.log("");

  if (tickTimer) clearInterval(tickTimer);
  if (statsTimer) clearInterval(statsTimer);
  if (disconnectTimer) clearInterval(disconnectTimer);

  for (const station of allStations) {
    station.destroy();
  }

  printFinalStats(CONFIG.stationCount);

  setTimeout(() => process.exit(0), 1000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const ocpp16Count = Math.floor(CONFIG.stationCount * 0.7);
  const ocpp201Count = CONFIG.stationCount - ocpp16Count;

  console.log(`${C.bold}${C.cyan}=== OCPP Network Simulator ===${C.reset}`);
  console.log(`  Target:       ${CONFIG.wsUrl}`);
  console.log(
    `  Stations:     ${CONFIG.stationCount} (${ocpp16Count} OCPP 1.6, ${ocpp201Count} OCPP 2.0.1)`,
  );
  console.log(
    `  Charge prob:  ${(CONFIG.chargeProbability * 100).toFixed(0)}% per 30s tick`,
  );
  console.log(
    `  Disconnect:   ${(CONFIG.disconnectProbability * 100).toFixed(0)}% per minute`,
  );
  console.log(
    `  Session time: ${CONFIG.sessionMinMinutes}-${CONFIG.sessionMaxMinutes} min (real)`,
  );
  console.log(`  Log level:    ${CONFIG.logLevel}`);
  console.log(`  Stagger:      0-${CONFIG.staggerSeconds}s per station`);

  if (CONFIG.scenarios) {
    console.log(`  Scenarios:    ${CONFIG.scenarios}`);
  }

  console.log("");

  // Print hotkeys
  printHotkeys();

  console.log(
    `${C.dim}Staggering ${CONFIG.stationCount} station connections over ${CONFIG.staggerSeconds}s...${C.reset}`,
  );
  console.log("");

  // Create stations
  for (let i = 1; i <= CONFIG.stationCount; i++) {
    const station = new Station(i, CONFIG.stationCount);
    allStations.push(station);

    const delay = Math.random() * CONFIG.staggerSeconds * 1000;
    setTimeout(() => {
      if (!shuttingDown) {
        station.connect();
      }
    }, delay);
  }

  // Schedule env-based scenarios
  scheduleEnvScenarios(allStations);

  // Start chaos loop if enabled
  startChaosLoop(allStations);

  // Setup interactive keyboard input
  setupInteractiveInput(allStations, shutdown);

  // Tick timer: every 30s, give each available station a chance to start charging
  tickTimer = setInterval(() => {
    if (shuttingDown) return;
    for (const station of allStations) {
      station.tick();
    }
  }, CONFIG.tickIntervalMs);

  // Stats timer: every 30s
  statsTimer = setInterval(() => {
    if (shuttingDown) return;
    printStats(allStations);
  }, CONFIG.tickIntervalMs);

  // Disconnect check timer: every 60s
  disconnectTimer = setInterval(() => {
    if (shuttingDown) return;
    for (const station of allStations) {
      station.disconnectCheck();
    }
  }, 60_000);

  // Print first stats after stagger period
  setTimeout(
    () => {
      if (!shuttingDown) printStats(allStations);
    },
    Math.min(CONFIG.staggerSeconds * 1000 + 5000, 30_000),
  );
}

main();
