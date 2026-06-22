import type { ReplaySession, SessionContext } from "./types";

const needsTxIdSubstitution = (action: string) =>
  action === "MeterValues" || action === "StopTransaction";

// Recordings sometimes carry Python-style isoformat timestamps with
// microsecond precision and a `+00:00` offset (e.g.
// "2026-02-09T12:36:01.099000+00:00"). OCPP schemas expect millisecond
// precision with a `Z` suffix. This trims fractional seconds to ms and
// converts `±00:00` to `Z`.
export function normalizeIsoTimestamp(ts: string): string {
  if (typeof ts !== "string") return ts;
  let s = ts.replace(/(\.\d{3})\d+/, "$1");
  s = s.replace(/([+-])(\d{2}):?(\d{2})$/, (_m, sign, hh, mm) =>
    sign === "+" && hh === "00" && mm === "00" ? "Z" : `${sign}${hh}:${mm}`,
  );
  return s;
}

// biome-ignore lint/suspicious/noExplicitAny: ocpp payload
function normalizeTimestampsInPlace(node: any): void {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) normalizeTimestampsInPlace(item);
    return;
  }
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (key === "timestamp" && typeof v === "string") {
      node[key] = normalizeIsoTimestamp(v);
    } else if (v !== null && typeof v === "object") {
      normalizeTimestampsInPlace(v);
    }
  }
}

export function applySubstitutions(
  action: string,
  // biome-ignore lint/suspicious/noExplicitAny: ocpp payload
  body: any,
  ctx: SessionContext,
  // biome-ignore lint/suspicious/noExplicitAny: ocpp payload
): any {
  const copy = JSON.parse(JSON.stringify(body));
  // The replay always poses as a new transaction: whenever we captured a
  // transactionId from this session's StartTransaction.conf, it overrides the
  // recorded one (which belongs to the original session, not this replay).
  // Real converted logs carry a genuine positive id here, so this must not be
  // gated on the recorded value being a placeholder.
  if (needsTxIdSubstitution(action) && ctx.capturedTxId !== undefined) {
    copy.transactionId = ctx.capturedTxId;
  }
  if (ctx.idTagOverride !== undefined && "idTag" in copy) {
    copy.idTag = ctx.idTagOverride;
  }
  normalizeTimestampsInPlace(copy);
  return copy;
}

// biome-ignore lint/suspicious/noExplicitAny: ocpp payload
export function extractEnergyWh(body: any): number | undefined {
  let max: number | undefined;
  const mvs = Array.isArray(body?.meterValue) ? body.meterValue : [];
  for (const mv of mvs) {
    const samples = Array.isArray(mv?.sampledValue) ? mv.sampledValue : [];
    for (const s of samples) {
      if (s?.measurand !== "Energy.Active.Import.Register") continue;
      if (s?.unit && s.unit !== "Wh") continue;
      const n = Number(s.value);
      if (!Number.isFinite(n)) continue;
      if (max === undefined || n > max) max = n;
    }
  }
  return max;
}

export function synthesizeStopTransaction(
  session: ReplaySession,
  ctx: SessionContext,
  // biome-ignore lint/suspicious/noExplicitAny: ocpp payload
): any | undefined {
  if (ctx.capturedTxId === undefined) return undefined;
  const meterStop = ctx.lastEnergyWh ?? ctx.meterStartWh ?? 0;
  return {
    transactionId: ctx.capturedTxId,
    timestamp: normalizeIsoTimestamp(session.windowEnd),
    meterStop,
    idTag: ctx.idTagOverride ?? session.idTag,
    reason: "Local",
  };
}
