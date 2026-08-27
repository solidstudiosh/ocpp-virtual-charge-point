export const NOOP = () => {};
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Connector and EVSE counts come from the CONNECTORS and EVSES env vars, which
 * are also read to decide how widely a ChangeAvailability fans out. A missing
 * or malformed value falls back to a single connector rather than an empty
 * range, so a typo does not silently stop the VCP reporting any status at all.
 */
export const countFromEnv = (name: "CONNECTORS" | "EVSES"): number => {
  const count = Number.parseInt(process.env[name] ?? "1");
  return Number.isNaN(count) || count < 1 ? 1 : count;
};

export const range = (count: number): number[] =>
  Array.from({ length: count }, (_, i) => i + 1);
