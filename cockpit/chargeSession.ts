import { EventEmitter } from "node:events";

// Per-connector charge session engine. The single source of truth for charge lifecycle:
// a guarded state machine drives the OCPP messages (via the VCP admin API) and ticks
// MeterValues with a realistic power curve, a smart-charging clamp, and live V/A control.
// The UI is a pure observer (SSE). Running in Node makes it survive page reloads.

export type SessionState = "idle" | "preparing" | "authorizing" | "charging" | "finishing";

export interface SessionView {
  connectorId: number;
  state: SessionState;
  idTag: string | null;
  transactionId: number | null;
  soc: number;
  voltage: number;
  current: number; // target current (A), live-adjustable
  phases: number;
  powerKw: number;
  energyKwh: number;
  cappedBy: "none" | "smart" | "soc";
  samples: number[]; // recent power samples (kW) for the sparkline
}

export interface Receipt {
  connectorId: number;
  transactionId: number | null;
  durationSec: number;
  energyKwh: number;
  avgKw: number;
  peakKw: number;
  ts: string;
}

interface Session extends SessionView {
  startedAt: number | null;
  energyWh: number;
  peakKw: number;
  sumKw: number;
  ticks: number;
  timer?: ReturnType<typeof setInterval>;
}

export interface ChargeConfig {
  adminPort: number;
  voltage: number;
  current: number;
  phases: number;
  connectors: number;
  sessionFullSeconds: number;
}

const TICK_SEC = 5;
const SAMPLE_CAP = 80;

// CC/CV-ish curve: full power until 80% SoC, then taper towards ~8%.
function curveFactor(soc: number): number {
  if (soc < 80) return 1;
  return Math.max(0.08, 1 - ((soc - 80) / 20) * 0.92);
}

// Emits: 'session' (SessionView), 'receipt' (Receipt)
export class ChargeSessionManager extends EventEmitter {
  private sessions = new Map<number, Session>();
  private pendingStart: number[] = []; // connectorIds awaiting their StartTransaction result
  private cfg: () => ChargeConfig;

  constructor(cfgGetter: () => ChargeConfig) {
    super();
    this.cfg = cfgGetter;
  }

  private blank(connectorId: number): Session {
    const c = this.cfg();
    return {
      connectorId,
      state: "idle",
      idTag: null,
      transactionId: null,
      soc: 0,
      voltage: c.voltage,
      current: c.current,
      phases: c.phases,
      powerKw: 0,
      energyKwh: 0,
      cappedBy: "none",
      samples: [],
      startedAt: null,
      energyWh: 0,
      peakKw: 0,
      sumKw: 0,
      ticks: 0,
    };
  }

  private get(connectorId: number): Session {
    let s = this.sessions.get(connectorId);
    if (!s) {
      s = this.blank(connectorId);
      this.sessions.set(connectorId, s);
    }
    return s;
  }

  private view(s: Session): SessionView {
    const { startedAt, energyWh, peakKw, sumKw, ticks, timer, ...view } = s;
    return view;
  }

  private emitSession(s: Session) {
    this.emit("session", this.view(s));
  }

  state(): SessionView[] {
    const c = this.cfg();
    for (let i = 1; i <= c.connectors; i++) this.get(i); // ensure idle sessions exist
    return Array.from(this.sessions.values())
      .sort((a, b) => a.connectorId - b.connectorId)
      .map((s) => this.view(s));
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp payload
  private async send(action: string, payload: any): Promise<boolean> {
    try {
      const res = await fetch(`http://localhost:${this.cfg().adminPort}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
        signal: AbortSignal.timeout(2500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async smartLimitKw(connectorId: number, voltage: number, phases: number): Promise<number | null> {
    try {
      const res = await fetch(`http://localhost:${this.cfg().adminPort}/chargingprofile`, {
        signal: AbortSignal.timeout(1500),
      });
      const profiles = (await res.json()) as Array<{ connectorId: number; limit: number; unit: string }>;
      const p = profiles.find((x) => x.connectorId === connectorId) ?? profiles.find((x) => x.connectorId === 0);
      if (!p) return null;
      return p.unit === "A" ? (p.limit * voltage * phases) / 1000 : p.limit / 1000;
    } catch {
      return null;
    }
  }

  private nowIso() {
    return new Date().toISOString();
  }

  // ---- public actions (guarded) ----
  async start(connectorId: number, idTag: string): Promise<{ ok: boolean; reason?: string }> {
    const s = this.get(connectorId);
    if (s.state !== "idle") return { ok: false, reason: `connecteur ${connectorId} occupé (${s.state})` };
    Object.assign(s, this.blank(connectorId), { idTag });
    s.state = "preparing";
    s.startedAt = Date.now();
    this.emitSession(s);

    const ok = await this.send("StatusNotification", {
      connectorId, errorCode: "NoError", status: "Preparing", timestamp: this.nowIso(),
    });
    if (!ok) {
      Object.assign(s, this.blank(connectorId));
      this.emitSession(s);
      return { ok: false, reason: "VCP injoignable" };
    }
    await this.send("Authorize", { idTag });
    s.state = "authorizing";
    this.emitSession(s);
    this.pendingStart.push(connectorId);
    await this.send("StartTransaction", { connectorId, idTag, meterStart: 0, timestamp: this.nowIso() });
    return { ok: true };
  }

  // Correlate inbound StartTransaction results (type 3, has transactionId + idTagInfo) to the
  // oldest connector awaiting a start (FIFO). Accepted → charging; else abort.
  // biome-ignore lint/suspicious/noExplicitAny: ocpp payload
  onOcppResult(payload: any) {
    if (!payload || payload.transactionId == null || !payload.idTagInfo) return;
    const connectorId = this.pendingStart.shift();
    if (connectorId == null) return;
    const s = this.get(connectorId);
    if (s.state !== "authorizing") return;
    if (payload.idTagInfo.status !== "Accepted") {
      Object.assign(s, this.blank(connectorId));
      this.emitSession(s);
      return;
    }
    s.transactionId = Number(payload.transactionId);
    s.state = "charging";
    this.emitSession(s);
    this.send("StatusNotification", {
      connectorId, errorCode: "NoError", status: "Charging", timestamp: this.nowIso(),
    });
    this.beginTicking(connectorId);
  }

  setParams(connectorId: number, params: { voltage?: number; current?: number }) {
    const s = this.get(connectorId);
    if (params.voltage != null) s.voltage = Math.max(0, params.voltage);
    if (params.current != null) s.current = Math.max(0, params.current);
    this.emitSession(s);
  }

  private beginTicking(connectorId: number) {
    const s = this.get(connectorId);
    if (s.timer) clearInterval(s.timer);
    s.timer = setInterval(() => this.tick(connectorId).catch(() => {}), TICK_SEC * 1000);
    this.tick(connectorId).catch(() => {}); // immediate first sample
  }

  private async tick(connectorId: number) {
    const s = this.sessions.get(connectorId);
    if (!s || s.state !== "charging") return;
    const c = this.cfg();

    // advance SoC on a demo timescale, derive power from live V/A + curve + smart-charging clamp
    s.soc = Math.min(100, s.soc + (TICK_SEC / c.sessionFullSeconds) * 100);
    const targetKw = (s.phases * s.voltage * s.current) / 1000;
    const curveKw = targetKw * curveFactor(s.soc);
    const limitKw = await this.smartLimitKw(connectorId, s.voltage, s.phases);
    let powerKw = curveKw;
    s.cappedBy = curveFactor(s.soc) < 1 ? "soc" : "none";
    if (limitKw != null && limitKw < powerKw) {
      powerKw = limitKw;
      s.cappedBy = "smart";
    }
    s.powerKw = Math.max(0, powerKw);
    s.energyWh += s.powerKw * 1000 * (TICK_SEC / 3600);
    s.energyKwh = s.energyWh / 1000;
    s.peakKw = Math.max(s.peakKw, s.powerKw);
    s.sumKw += s.powerKw;
    s.ticks += 1;
    s.samples.push(Number(s.powerKw.toFixed(2)));
    if (s.samples.length > SAMPLE_CAP) s.samples.shift();

    const ampPerPhase = (s.current * curveFactor(s.soc)).toFixed(1);
    await this.send("MeterValues", {
      connectorId,
      transactionId: s.transactionId ?? undefined,
      meterValue: [{
        timestamp: this.nowIso(),
        sampledValue: [
          { value: String(Math.round(s.energyWh)), measurand: "Energy.Active.Import.Register", unit: "Wh" },
          { value: String(Math.round(s.powerKw * 1000)), measurand: "Power.Active.Import", unit: "W" },
          { value: ampPerPhase, measurand: "Current.Import", unit: "A", phase: "L1" },
          { value: ampPerPhase, measurand: "Current.Import", unit: "A", phase: "L2" },
          { value: ampPerPhase, measurand: "Current.Import", unit: "A", phase: "L3" },
          { value: String(Math.round(s.voltage)), measurand: "Voltage", unit: "V" },
          { value: String(Math.round(s.soc)), measurand: "SoC", unit: "Percent" },
        ],
      }],
    });
    this.emitSession(s);

    if (s.soc >= 100) await this.stop(connectorId); // auto-stop at full
  }

  async stop(connectorId: number): Promise<{ ok: boolean; reason?: string }> {
    const s = this.sessions.get(connectorId);
    if (!s || (s.state !== "charging" && s.state !== "finishing")) {
      return { ok: false, reason: "aucune charge en cours" };
    }
    if (s.timer) { clearInterval(s.timer); s.timer = undefined; }
    s.state = "finishing";
    this.emitSession(s);

    await this.send("StopTransaction", {
      transactionId: s.transactionId ?? 0, idTag: s.idTag ?? undefined,
      meterStop: Math.round(s.energyWh), timestamp: this.nowIso(),
    });
    const receipt: Receipt = {
      connectorId,
      transactionId: s.transactionId,
      durationSec: s.startedAt ? Math.round((Date.now() - s.startedAt) / 1000) : 0,
      energyKwh: Number(s.energyKwh.toFixed(3)),
      avgKw: s.ticks ? Number((s.sumKw / s.ticks).toFixed(2)) : 0,
      peakKw: Number(s.peakKw.toFixed(2)),
      ts: this.nowIso(),
    };
    await this.send("StatusNotification", { connectorId, errorCode: "NoError", status: "Finishing", timestamp: this.nowIso() });
    await this.send("StatusNotification", { connectorId, errorCode: "NoError", status: "Available", timestamp: this.nowIso() });

    Object.assign(s, this.blank(connectorId));
    this.emitSession(s);
    this.emit("receipt", receipt);
    return { ok: true };
  }

  stopAll() {
    for (const s of this.sessions.values()) {
      if (s.timer) clearInterval(s.timer);
    }
  }
}
