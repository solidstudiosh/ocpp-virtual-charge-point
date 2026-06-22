// Parse the VCP child stdout (winston Console + colorize) into structured OCPP events
// and a derived "borne" state. Non-invasive: we never touch the OCPP code, we read its logs.

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI color codes
const ANSI = /\x1B\[[0-9;]*m/g;

const OUT_MARKERS = ["Sending message ➡️", "Responding with ➡️"];
const IN_MARKER = "Receive message ⬅️";

export type OcppDirection = "out" | "in";

export interface OcppEvent {
  direction: OcppDirection;
  messageType: number; // 2 = CALL, 3 = CALLRESULT, 4 = CALLERROR
  messageId: string;
  action?: string; // present for CALL (type 2)
  payload: unknown;
  raw: string;
  ts: string;
}

export interface BorneState {
  status: string; // connector status (Available/Charging/Faulted/...)
  connectorId: number | null;
  transactionId: string | number | null;
  charging: boolean;
  powerKw: number | null;
  energyKwh: number | null;
  lastBoot: string | null;
  lastUpdate: string | null;
}

export function initialBorneState(): BorneState {
  return {
    status: "Unknown",
    connectorId: null,
    transactionId: null,
    charging: false,
    powerKw: null,
    energyKwh: null,
    lastBoot: null,
    lastUpdate: null,
  };
}

// Extract the JSON OCPP array from a log line, if any. Returns null otherwise.
function extractOcppArray(line: string): unknown[] | null {
  const clean = line.replace(ANSI, "");
  const start = clean.indexOf("[");
  if (start === -1) return null;
  const slice = clean.slice(start);
  try {
    const parsed = JSON.parse(slice);
    if (Array.isArray(parsed) && typeof parsed[0] === "number") return parsed;
  } catch {
    // not a complete JSON array on this line
  }
  return null;
}

// Parse a single stdout line into an OcppEvent (or null if not an OCPP message line).
export function parseLine(line: string, ts: string): OcppEvent | null {
  const clean = line.replace(ANSI, "");
  const isOut = OUT_MARKERS.some((m) => clean.includes(m));
  const isIn = clean.includes(IN_MARKER);
  if (!isOut && !isIn) return null;

  const arr = extractOcppArray(clean);
  if (!arr) return null;

  const messageType = arr[0] as number;
  if (messageType === 2) {
    return {
      direction: isOut ? "out" : "in",
      messageType,
      messageId: String(arr[1]),
      action: String(arr[2]),
      payload: arr[3],
      raw: JSON.stringify(arr),
      ts,
    };
  }
  // CALLRESULT (3) / CALLERROR (4): [type, messageId, payload...]
  return {
    direction: isOut ? "out" : "in",
    messageType,
    messageId: String(arr[1]),
    payload: arr[2],
    raw: JSON.stringify(arr),
    ts,
  };
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number.parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

// Pull power (kW) and energy (kWh) out of an OCPP MeterValues / TransactionEvent payload.
function readMeter(payload: any): { powerKw: number | null; energyKwh: number | null } {
  let powerKw: number | null = null;
  let energyKwh: number | null = null;
  const meterValues = payload?.meterValue ?? [];
  for (const mv of meterValues) {
    for (const sv of mv?.sampledValue ?? []) {
      const measurand = sv?.measurand ?? "Energy.Active.Import.Register";
      const unit = (sv?.unit ?? sv?.unitOfMeasure?.unit ?? "").toString().toLowerCase();
      const value = num(sv?.value);
      if (value === null) continue;
      if (measurand === "Power.Active.Import") {
        powerKw = unit === "w" ? value / 1000 : value; // assume kW unless W
      } else if (measurand === "Energy.Active.Import.Register") {
        energyKwh = unit === "wh" ? value / 1000 : value; // assume kWh unless Wh
      }
    }
  }
  return { powerKw, energyKwh };
}

// Mutate borne state from an OCPP event. Handles both v1.6 and v2.0.1 shapes.
export function applyToBorne(state: BorneState, ev: OcppEvent): BorneState {
  state.lastUpdate = ev.ts;
  const p = ev.payload as any;

  if (ev.messageType === 2 && ev.action) {
    switch (ev.action) {
      case "BootNotification":
        state.lastBoot = ev.ts;
        break;
      case "StatusNotification": {
        // v16: {connectorId, status}; v201: {evseId, connectorId, connectorStatus}
        const status = p?.status ?? p?.connectorStatus;
        if (status) state.status = status;
        if (p?.connectorId != null) state.connectorId = p.connectorId;
        state.charging = status === "Charging" || status === "Occupied";
        break;
      }
      case "StartTransaction": {
        state.charging = true;
        state.status = "Charging";
        if (p?.connectorId != null) state.connectorId = p.connectorId;
        break;
      }
      case "StopTransaction": {
        state.charging = false;
        state.status = "Available";
        state.transactionId = null;
        state.powerKw = 0;
        break;
      }
      case "MeterValues": {
        const m = readMeter(p);
        if (m.powerKw !== null) state.powerKw = m.powerKw;
        if (m.energyKwh !== null) state.energyKwh = m.energyKwh;
        if (p?.transactionId != null) state.transactionId = p.transactionId;
        break;
      }
      case "TransactionEvent": {
        // v201 consolidated event
        const evType = p?.eventType;
        if (p?.transactionInfo?.transactionId != null) {
          state.transactionId = p.transactionInfo.transactionId;
        }
        if (p?.evse?.id != null) state.connectorId = p.evse.id;
        if (evType === "Started") {
          state.charging = true;
          state.status = "Charging";
        } else if (evType === "Ended") {
          state.charging = false;
          state.status = "Available";
          state.transactionId = null;
          state.powerKw = 0;
        }
        const m = readMeter(p);
        if (m.powerKw !== null) state.powerKw = m.powerKw;
        if (m.energyKwh !== null) state.energyKwh = m.energyKwh;
        break;
      }
    }
  }

  // CALLRESULT to a StartTransaction gives us the transactionId (v16)
  if (ev.messageType === 3 && p && typeof p === "object" && "transactionId" in p) {
    state.transactionId = (p as any).transactionId;
  }
  return state;
}
