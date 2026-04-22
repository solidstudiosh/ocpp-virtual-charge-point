// ---------------------------------------------------------------------------
// Predefined scenarios that can be triggered via env or hotkeys
// ---------------------------------------------------------------------------

import { CONFIG, randomBetween } from "./config.js";
import { C } from "./stats.js";
import { Station } from "./station.js";
import type { Scenario } from "./types.js";

// ---------------------------------------------------------------------------
// Scenario definitions
// ---------------------------------------------------------------------------

export const SCENARIOS: Scenario[] = [
  {
    name: "blackout",
    description:
      "All stations disconnect simultaneously, reconnect after 30-60s (power outage)",
    hotkey: "b",
    triggerAt: -1,
    execute(stations) {
      console.log(
        `\n${C.bold}${C.red}>>> SCENARIO: BLACKOUT — all ${stations.length} stations disconnecting${C.reset}\n`,
      );
      for (const s of stations) {
        if (s.state !== "disconnected" && !s.destroyed) {
          s.disconnect(true);
        }
      }
      const reconnectDelay = randomBetween(30_000, 60_000);
      console.log(
        `${C.dim}    Reconnecting in ${(reconnectDelay / 1000).toFixed(0)}s...${C.reset}`,
      );
      setTimeout(() => {
        console.log(
          `\n${C.bold}${C.green}>>> BLACKOUT RECOVERY — reconnecting all stations${C.reset}\n`,
        );
        const staggerMs = Math.max(30_000, stations.length * 4);
        for (const s of stations) {
          if (!s.destroyed) {
            const jitter = Math.random() * staggerMs;
            setTimeout(() => s.connect(), jitter);
          }
        }
      }, reconnectDelay);
    },
  },
  {
    name: "peak-hour",
    description:
      "Charging probability jumps to 80% for 5 minutes (rush hour)",
    hotkey: "p",
    triggerAt: -1,
    execute(stations) {
      const originalProb = CONFIG.chargeProbability;
      CONFIG.chargeProbability = 0.8;
      console.log(
        `\n${C.bold}${C.yellow}>>> SCENARIO: PEAK HOUR — charge probability 80% for 5 min${C.reset}\n`,
      );
      setTimeout(() => {
        CONFIG.chargeProbability = originalProb;
        console.log(
          `\n${C.bold}${C.green}>>> PEAK HOUR ENDED — charge probability restored to ${(originalProb * 100).toFixed(0)}%${C.reset}\n`,
        );
      }, 5 * 60_000);
    },
  },
  {
    name: "target-failover",
    description:
      "20% of stations disconnect and reconnect (target server restart)",
    hotkey: "t",
    triggerAt: -1,
    execute(stations) {
      const count = Math.ceil(stations.length * 0.2);
      const shuffled = [...stations]
        .filter((s) => s.state !== "disconnected" && !s.destroyed)
        .sort(() => Math.random() - 0.5)
        .slice(0, count);

      console.log(
        `\n${C.bold}${C.magenta}>>> SCENARIO: TARGET FAILOVER — ${shuffled.length} stations disconnecting${C.reset}\n`,
      );

      for (const s of shuffled) {
        s.disconnect(true);
      }

      const reconnectDelay = randomBetween(5_000, 15_000);
      setTimeout(() => {
        console.log(
          `\n${C.bold}${C.green}>>> FAILOVER RECOVERY — reconnecting ${shuffled.length} stations${C.reset}\n`,
        );
        for (const s of shuffled) {
          if (!s.destroyed) {
            const jitter = Math.random() * 3000;
            setTimeout(() => s.connect(), jitter);
          }
        }
      }, reconnectDelay);
    },
  },
  {
    name: "rolling-restart",
    description:
      "Stations disconnect and reconnect one by one with 100ms delay (firmware update)",
    hotkey: "r",
    triggerAt: -1,
    execute(stations) {
      const active = stations.filter(
        (s) => s.state !== "disconnected" && !s.destroyed,
      );
      const maxRestart = Math.min(active.length, Math.ceil(stations.length * 0.2));
      const toRestart = active.slice(0, maxRestart);
      console.log(
        `\n${C.bold}${C.blue}>>> SCENARIO: ROLLING RESTART — ${toRestart.length} stations restarting sequentially${C.reset}\n`,
      );

      toRestart.forEach((s, i) => {
        setTimeout(() => {
          if (!s.destroyed) {
            s.disconnect(true);
            setTimeout(() => {
              if (!s.destroyed) s.connect();
            }, randomBetween(2000, 5000));
          }
        }, i * 100);
      });
    },
  },
  {
    name: "idle-night",
    description:
      "Charging probability drops to 1% for 5 minutes (night hours)",
    hotkey: "n",
    triggerAt: -1,
    execute(stations) {
      const originalProb = CONFIG.chargeProbability;
      CONFIG.chargeProbability = 0.01;
      console.log(
        `\n${C.bold}${C.dim}>>> SCENARIO: IDLE NIGHT — charge probability 1% for 5 min${C.reset}\n`,
      );
      setTimeout(() => {
        CONFIG.chargeProbability = originalProb;
        console.log(
          `\n${C.bold}${C.green}>>> IDLE NIGHT ENDED — charge probability restored to ${(originalProb * 100).toFixed(0)}%${C.reset}\n`,
        );
      }, 5 * 60_000);
    },
  },
  {
    name: "surge",
    description:
      "500 new connections appear within 10 seconds (fleet expansion)",
    hotkey: "s",
    triggerAt: -1,
    execute(stations) {
      // We need access to the allStations array to push new ones — use a dynamic approach
      const surgeCount = 500;
      const baseIndex = stations.length;
      console.log(
        `\n${C.bold}${C.cyan}>>> SCENARIO: SURGE — spawning ${surgeCount} new stations${C.reset}\n`,
      );

      for (let i = 0; i < surgeCount; i++) {
        const station = new Station(
          baseIndex + i + 1,
          baseIndex + surgeCount,
        );
        stations.push(station);
        const delay = Math.random() * 10_000;
        setTimeout(() => {
          if (!station.destroyed) {
            station.connect();
          }
        }, delay);
      }
    },
  },
];

// ---------------------------------------------------------------------------
// Scenario lookup
// ---------------------------------------------------------------------------

export function findScenario(name: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.name === name);
}

export function findScenarioByHotkey(key: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.hotkey === key);
}

// ---------------------------------------------------------------------------
// Schedule scenarios from SCENARIOS env var
// ---------------------------------------------------------------------------

export function scheduleEnvScenarios(stations: Station[]): void {
  if (!CONFIG.scenarios) return;

  const entries = CONFIG.scenarios.split(",").map((e) => e.trim());

  for (const entry of entries) {
    const [name, secondsStr] = entry.split(":");
    if (!name) continue;

    const scenario = findScenario(name);
    if (!scenario) {
      console.log(
        `${C.yellow}Warning: unknown scenario "${name}", skipping${C.reset}`,
      );
      continue;
    }

    const seconds = parseInt(secondsStr ?? "0", 10);
    if (seconds > 0) {
      console.log(
        `${C.dim}  Scheduled: "${name}" at T+${seconds}s${C.reset}`,
      );
      setTimeout(() => scenario.execute(stations), seconds * 1000);
    } else {
      console.log(
        `${C.dim}  Scheduled: "${name}" immediately${C.reset}`,
      );
      scenario.execute(stations);
    }
  }
}

// ---------------------------------------------------------------------------
// Chaos mode — random scenarios in a loop
// ---------------------------------------------------------------------------

const CHAOS_SCENARIOS = SCENARIOS.filter((s) => s.name !== "surge");

export function startChaosLoop(stations: Station[]): void {
  if (!CONFIG.chaosMode) return;

  const scheduleNext = () => {
    const delay =
      CONFIG.chaosMinIntervalMs +
      Math.random() * (CONFIG.chaosMaxIntervalMs - CONFIG.chaosMinIntervalMs);
    const pick =
      CHAOS_SCENARIOS[Math.floor(Math.random() * CHAOS_SCENARIOS.length)];

    setTimeout(() => {
      pick.execute(stations);
      scheduleNext();
    }, delay);

    console.log(
      `${C.dim}  Chaos: next scenario "${pick.name}" in ${(delay / 1000).toFixed(0)}s${C.reset}`,
    );
  };

  console.log(
    `\n${C.bold}${C.magenta}=== CHAOS MODE ACTIVE ===${C.reset}`,
  );
  console.log(
    `${C.dim}  Random scenarios every ${CONFIG.chaosMinIntervalMs / 1000}-${CONFIG.chaosMaxIntervalMs / 1000}s (excluding surge)${C.reset}\n`,
  );

  scheduleNext();
}

// ---------------------------------------------------------------------------
// Interactive keyboard triggers
// ---------------------------------------------------------------------------

export function setupInteractiveInput(
  stations: Station[],
  shutdownFn: () => void,
): void {
  if (!process.stdin.setRawMode) return; // not a TTY

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  process.stdin.on("data", (key: string) => {
    const char = key.toString();

    // Ctrl+C
    if (char === "") {
      shutdownFn();
      return;
    }

    // q = quit
    if (char === "q") {
      shutdownFn();
      return;
    }

    // ? or h = help
    if (char === "?" || char === "h") {
      printHotkeys();
      return;
    }

    // Scenario hotkeys
    const scenario = findScenarioByHotkey(char);
    if (scenario) {
      scenario.execute(stations);
    }
  });
}

export function printHotkeys(): void {
  console.log("");
  console.log(`${C.bold}${C.cyan}=== Interactive Hotkeys ===${C.reset}`);
  for (const s of SCENARIOS) {
    console.log(
      `  ${C.bold}${s.hotkey}${C.reset} — ${s.name}: ${C.dim}${s.description}${C.reset}`,
    );
  }
  console.log(`  ${C.bold}h${C.reset} — Show this help`);
  console.log(`  ${C.bold}q${C.reset} — Quit`);
  console.log("");
}
