// ---------------------------------------------------------------------------
// Configuration from environment variables
// ---------------------------------------------------------------------------

export const CONFIG = {
  wsUrl: process.env.WS_URL ?? "ws://localhost:3000",
  stationCount: parseInt(process.env.STATION_COUNT ?? "2000", 10),
  chargeProbability: parseFloat(process.env.CHARGE_PROBABILITY ?? "0.05"),
  disconnectProbability: parseFloat(
    process.env.DISCONNECT_PROBABILITY ?? "0.01",
  ),
  sessionMinMinutes: parseFloat(process.env.SESSION_MIN_MINUTES ?? "2"),
  sessionMaxMinutes: parseFloat(process.env.SESSION_MAX_MINUTES ?? "10"),
  logLevel: (process.env.LOG_LEVEL ?? "info") as "info" | "debug",
  scenarios: process.env.SCENARIOS ?? "",
  chaosMode: (process.env.CHAOS_MODE ?? "false").toLowerCase() === "true",
  chaosMinIntervalMs: parseInt(process.env.CHAOS_MIN_INTERVAL ?? "60000", 10),
  chaosMaxIntervalMs: parseInt(process.env.CHAOS_MAX_INTERVAL ?? "180000", 10),
  staggerSeconds: parseInt(
    process.env.STAGGER_SECONDS ??
      String(Math.max(10, Math.ceil(parseInt(process.env.STATION_COUNT ?? "2000", 10) * 0.09))),
    10,
  ),
  meterIntervalMs: 15_000,
  tickIntervalMs: 30_000,
  reconnectMinMs: 10_000,
  reconnectMaxMs: 60_000,
};

// ---------------------------------------------------------------------------
// RFID tag pool
// ---------------------------------------------------------------------------

const RFID_TAGS: string[] = [];
for (let i = 1; i <= 50; i++) {
  RFID_TAGS.push(`RFID-AA${String(i).padStart(2, "0")}`);
}

export function randomRfid(): string {
  return RFID_TAGS[Math.floor(Math.random() * RFID_TAGS.length)];
}

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}
