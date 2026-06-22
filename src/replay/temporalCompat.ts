import { Temporal as PolyfillTemporal } from "@js-temporal/polyfill";

// Use the native Temporal global when available (Node >= 26); otherwise fall
// back to the polyfill so tests run on older Node versions.
const native = (globalThis as { Temporal?: typeof PolyfillTemporal }).Temporal;
export const Temporal: typeof PolyfillTemporal = native ?? PolyfillTemporal;
