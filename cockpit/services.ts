import { type ChildProcess, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import * as net from "node:net";
import * as path from "node:path";
import { applyToBorne, type BorneState, initialBorneState, parseLine } from "./logParser";
import { type ChargeConfig, ChargeSessionManager } from "./chargeSession";

export type ServiceName = "websocket" | "subscriber" | "sidekiq" | "rails" | "vite" | "vcp";
export type ServiceStatus = "stopped" | "starting" | "running" | "exited" | "error";

export interface CockpitConfig {
  websocketPath: string;
  platformPath: string;
  identity: string;
  ocppVersion: "OCPP_1.6" | "OCPP_2.0.1";
  wsUrl: string;
  adminPort: number;
  idTag: string;
  redisUrl: string;
  ports: { websocket: number; rails: number; vite: number; redis: number };
  // charge engine
  voltage: number;
  current: number;
  phases: number;
  connectors: number;
  sessionFullSeconds: number;
  // connection mode
  mode: "local" | "staging";
  staging: { wsUrl: string; identity: string; password: string };
}

export const DEFAULT_CONFIG: CockpitConfig = {
  websocketPath: "",
  platformPath: "",
  identity: "jasonborne",
  ocppVersion: "OCPP_1.6",
  wsUrl: "ws://localhost:3334",
  adminPort: 9999,
  idTag: "SIMTAG", // whitelist tag → authorised on private stations without a card
  redisUrl: "redis://localhost:6379",
  ports: { websocket: 3334, rails: 3000, vite: 3036, redis: 6379 },
  voltage: 230,
  current: 32,
  phases: 3,
  connectors: 2,
  sessionFullSeconds: 120,
  mode: "local",
  staging: { wsUrl: "", identity: "", password: "" },
};

export interface Scenario {
  id: string;
  label: string;
  idTag: string;
  expected: "accepted" | "blocked" | "unknown";
  note?: string;
}

// Fallback list (matches cockpit/seeds/charge_scenarios.rb) so the UI works before/without the
// seed. The Mobilypass scenarios resolve their idTag from the seed; until then only SIMTAG is sure.
export const DEFAULT_SCENARIOS: Scenario[] = [
  { id: "js", label: "JS — Mobilypass", idTag: "", expected: "unknown",
    note: "Résolu par le seed (faurejs@gmail.com)." },
  { id: "max", label: "Max — Mobilypass", idTag: "", expected: "unknown",
    note: "Résolu par le seed (mbrachet@mobilygreen.fr)." },
  { id: "whitelist", label: "SIMTAG — whitelist", idTag: "SIMTAG", expected: "accepted",
    note: "Tag whitelist accepté sans carte sur station privée commissionnée." },
];

interface ServiceDef {
  name: ServiceName;
  label: string;
  // Returns null when the service can't start with the current config (e.g. missing path).
  build: (cfg: CockpitConfig) => { cmd: string; cwd: string; env: Record<string, string> } | null;
  // network port to ping for health, if any
  port?: (cfg: CockpitConfig) => number | undefined;
}

const REPO_ROOT = path.resolve(__dirname, "..");

function indexEntrypoint(cfg: CockpitConfig): string {
  return cfg.ocppVersion === "OCPP_1.6" ? "index_16.ts" : "index_201.ts";
}

function wsModule(cfg: CockpitConfig): string {
  return cfg.ocppVersion === "OCPP_1.6" ? "Ocpp::V16::Ws.start" : "Ocpp::V201::Ws.start";
}

const SERVICE_DEFS: ServiceDef[] = [
  {
    name: "websocket",
    label: "Serveur WebSocket (puma)",
    build: (cfg) =>
      cfg.websocketPath
        ? {
            cmd: `bundle exec puma -p ${cfg.ports.websocket}`,
            cwd: cfg.websocketPath,
            env: { REDIS_URL: cfg.redisUrl },
          }
        : null,
    port: (cfg) => cfg.ports.websocket,
  },
  {
    name: "subscriber",
    label: "Subscriber OCPP (Ws.start)",
    build: (cfg) =>
      cfg.platformPath
        ? {
            cmd: `bundle exec rails runner '${wsModule(cfg)}'`,
            cwd: cfg.platformPath,
            env: { REDIS_URL: cfg.redisUrl, RAILS_ENV: "development" },
          }
        : null,
  },
  {
    name: "sidekiq",
    label: "Sidekiq",
    build: (cfg) =>
      cfg.platformPath
        ? {
            cmd: "bundle exec sidekiq -C ./config/sidekiq.development.yml",
            cwd: cfg.platformPath,
            env: { REDIS_URL: cfg.redisUrl, RAILS_ENV: "development" },
          }
        : null,
  },
  {
    name: "rails",
    label: "Rails web (dashboard)",
    build: (cfg) =>
      cfg.platformPath
        ? {
            cmd: `bin/rails server -p ${cfg.ports.rails}`,
            cwd: cfg.platformPath,
            env: { REDIS_URL: cfg.redisUrl, RAILS_ENV: "development" },
          }
        : null,
    port: (cfg) => cfg.ports.rails,
  },
  {
    name: "vite",
    label: "Vite (assets)",
    build: (cfg) =>
      cfg.platformPath
        ? { cmd: "bin/vite dev", cwd: cfg.platformPath, env: { RAILS_ENV: "development" } }
        : null,
    port: (cfg) => cfg.ports.vite,
  },
  {
    name: "vcp",
    label: "Borne virtuelle (VCP)",
    build: (cfg) => {
      // v16 reads ADMIN_PORT, v201/21 read ADMIN_WS_PORT
      const adminEnv =
        cfg.ocppVersion === "OCPP_1.6"
          ? { ADMIN_PORT: String(cfg.adminPort) }
          : { ADMIN_WS_PORT: String(cfg.adminPort) };
      // staging mode: dial the staging OCPP endpoint with the real borne identity (+ basic auth)
      const staging = cfg.mode === "staging";
      const wsUrl = staging ? cfg.staging.wsUrl : cfg.wsUrl;
      const cpId = staging ? cfg.staging.identity : cfg.identity;
      const password = staging ? cfg.staging.password : "";
      if (staging && (!wsUrl || !cpId)) return null; // staging not configured yet
      return {
        cmd: `npx tsx ${indexEntrypoint(cfg)}`,
        cwd: REPO_ROOT,
        env: {
          WS_URL: wsUrl,
          CP_ID: cpId,
          ...(password ? { PASSWORD: password } : {}),
          ...adminEnv,
        },
      };
    },
    port: (cfg) => cfg.adminPort,
  },
];

interface ServiceRuntime {
  def: ServiceDef;
  status: ServiceStatus;
  child?: ChildProcess;
  logs: string[]; // ring buffer
  exitCode?: number | null;
  startedAt?: string;
}

const LOG_CAP = 400;

// Emits: 'service' (status change), 'log' ({name, line}), 'ocpp' (OcppEvent), 'borne' (BorneState)
export class ServiceManager extends EventEmitter {
  private cfg: CockpitConfig;
  private runtimes = new Map<ServiceName, ServiceRuntime>();
  borne: BorneState = initialBorneState();
  scenarios: Scenario[] = DEFAULT_SCENARIOS;
  seeding = false;
  charge: ChargeSessionManager;

  constructor(cfg: CockpitConfig) {
    super();
    this.cfg = cfg;
    for (const def of SERVICE_DEFS) {
      this.runtimes.set(def.name, { def, status: "stopped", logs: [] });
    }
    const chargeCfg = (): ChargeConfig => ({
      adminPort: this.cfg.adminPort,
      voltage: this.cfg.voltage,
      current: this.cfg.current,
      phases: this.cfg.phases,
      connectors: this.cfg.connectors,
      sessionFullSeconds: this.cfg.sessionFullSeconds,
    });
    this.charge = new ChargeSessionManager(chargeCfg);
    this.charge.on("session", (v) => this.emit("session", v));
    this.charge.on("receipt", (r) => this.emit("receipt", r));
    this.charge.on("notice", (n) => this.emit("notice", n));
  }

  setConfig(cfg: CockpitConfig) {
    this.cfg = cfg;
  }

  getConfig(): CockpitConfig {
    return this.cfg;
  }

  isRunning(name: ServiceName): boolean {
    const rt = this.runtimes.get(name);
    return !!rt?.child && (rt.status === "running" || rt.status === "starting");
  }

  private now(): string {
    return new Date().toISOString();
  }

  private pushLog(name: ServiceName, line: string) {
    const rt = this.runtimes.get(name);
    if (!rt) return;
    rt.logs.push(line);
    if (rt.logs.length > LOG_CAP) rt.logs.shift();
    this.emit("log", { name, line, ts: this.now() });
  }

  private setStatus(name: ServiceName, status: ServiceStatus) {
    const rt = this.runtimes.get(name);
    if (!rt) return;
    rt.status = status;
    this.emit("service", this.serviceState(name));
  }

  start(name: ServiceName): { ok: boolean; error?: string } {
    const rt = this.runtimes.get(name);
    if (!rt) return { ok: false, error: "unknown service" };
    if (rt.child && rt.status === "running") return { ok: true };

    const spec = rt.def.build(this.cfg);
    if (!spec) return { ok: false, error: "chemin non configuré" };

    if (name === "vcp") this.borne = initialBorneState();

    this.setStatus(name, "starting");
    // Login shell so per-directory version managers (RVM/rbenv/nvm) activate the right
    // Ruby/Node — the websocket repo needs Ruby 3.2.1, platform needs 3.4.x. The explicit
    // `cd` triggers RVM's auto-switch on .ruby-version. detached:true → own process group,
    // so we can SIGTERM the whole tree (bash + its children) on stop.
    const fullCmd = `cd '${spec.cwd.replace(/'/g, "'\\''")}' && ${spec.cmd}`;
    const child = spawn("bash", ["-lc", fullCmd], {
      env: { ...process.env, ...spec.env },
      detached: true,
    });
    rt.child = child;
    rt.startedAt = this.now();
    rt.exitCode = undefined;

    const onData = (buf: Buffer) => {
      for (const raw of buf.toString().split("\n")) {
        const line = raw.replace(/\r$/, "");
        if (!line.trim()) continue;
        this.pushLog(name, line);
        if (rt.status === "starting") this.setStatus(name, "running");
        if (name === "vcp") this.handleVcpLine(line);
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);

    child.on("error", (err) => {
      this.pushLog(name, `[spawn error] ${err.message}`);
      this.setStatus(name, "error");
    });
    child.on("exit", (code) => {
      rt.exitCode = code;
      rt.child = undefined;
      this.pushLog(name, `[exited code=${code}]`);
      this.setStatus(name, code === 0 ? "stopped" : "exited");
      if (name === "vcp") {
        this.borne.charging = false;
        this.borne.status = "Disconnected";
        this.emit("borne", this.borne);
      }
    });

    // Treat as running after a short grace if it didn't crash immediately.
    setTimeout(() => {
      if (rt.child && rt.status === "starting") this.setStatus(name, "running");
    }, 800);

    return { ok: true };
  }

  stop(name: ServiceName): { ok: boolean } {
    const rt = this.runtimes.get(name);
    if (!rt?.child) {
      this.setStatus(name, "stopped");
      return { ok: true };
    }
    // Kill the whole process group (bash + puma/rails/node children).
    const pid = rt.child.pid;
    try {
      if (pid) process.kill(-pid, "SIGTERM");
      else rt.child.kill("SIGTERM");
    } catch {
      try {
        rt.child.kill("SIGTERM");
      } catch {
        /* already gone */
      }
    }
    return { ok: true };
  }

  async reconnectVcp(): Promise<void> {
    this.stop("vcp");
    await new Promise((r) => setTimeout(r, 600));
    this.start("vcp");
  }

  // Ordered boot: websocket first, then platform stack, VCP last (after ws is reachable).
  async startAll(): Promise<void> {
    // In staging mode the borne dials a remote endpoint → only the VCP runs locally.
    if (this.cfg.mode === "staging") {
      this.start("vcp");
      return;
    }
    this.start("websocket");
    await this.waitForPort(this.cfg.ports.websocket, 8000).catch(() => {});
    this.start("rails");
    this.start("vite");
    this.start("sidekiq");
    this.start("subscriber");
    await new Promise((r) => setTimeout(r, 1500));
    this.start("vcp");
  }

  stopAll() {
    this.charge.stopAll();
    for (const name of this.runtimes.keys()) this.stop(name);
  }

  // Run the idempotent charge-scenarios seed in the platform repo and parse its manifest.
  async runSeed(): Promise<{ ok: boolean; scenarios: Scenario[]; log: string }> {
    if (!this.cfg.platformPath) return { ok: false, scenarios: this.scenarios, log: "platformPath non défini" };
    if (this.seeding) return { ok: false, scenarios: this.scenarios, log: "seed déjà en cours" };
    this.seeding = true;
    const seedPath = path.join(__dirname, "seeds", "charge_scenarios.rb");
    // identity & path go through env / escaped cd — never interpolated raw into the shell.
    const cmd = `cd '${this.cfg.platformPath.replace(/'/g, "'\\''")}' && bundle exec rails runner "$SEED_SCRIPT"`;
    return new Promise((resolve) => {
      const child = spawn("bash", ["-lc", cmd], {
        env: {
          ...process.env,
          REDIS_URL: this.cfg.redisUrl,
          SEED_IDENTITY: this.cfg.identity,
          SEED_SCRIPT: seedPath,
        },
      });
      let out = "";
      const onData = (b: Buffer) => {
        out += b.toString();
        for (const line of b.toString().split("\n")) {
          if (line.trim()) this.emit("log", { name: "seed", line: line.replace(/\r$/, ""), ts: this.now() });
        }
      };
      child.stdout?.on("data", onData);
      child.stderr?.on("data", onData);
      child.on("error", (e) => {
        this.seeding = false;
        resolve({ ok: false, scenarios: this.scenarios, log: e.message });
      });
      child.on("exit", (code) => {
        this.seeding = false;
        const m = out.match(/__SCENARIOS__ (.+)/);
        if (m) {
          try {
            this.scenarios = JSON.parse(m[1]);
            this.emit("scenarios", this.scenarios);
          } catch {
            /* keep previous */
          }
        }
        resolve({ ok: code === 0 && !!m, scenarios: this.scenarios, log: out.slice(-2000) });
      });
    });
  }

  private handleVcpLine(line: string) {
    const ev = parseLine(line, this.now());
    if (!ev) return;
    this.emit("ocpp", ev);
    // Feed inbound CALLRESULTs to the charge engine (captures StartTransaction transactionId).
    if (ev.direction === "in" && ev.messageType === 3) this.charge.onOcppResult(ev.payload);
    // Remote stop from the CSMS: the VCP closes the transaction itself, so halt the local charge
    // engine (its tick loop keeps emitting MeterValues otherwise) without re-sending OCPP messages.
    if (
      ev.direction === "in" &&
      ev.messageType === 2 &&
      (ev.action === "RemoteStopTransaction" || ev.action === "RequestStopTransaction")
    ) {
      const txId = (ev.payload as { transactionId?: string | number })?.transactionId ?? null;
      this.charge.remoteStopped(txId).catch(() => {});
    }
    applyToBorne(this.borne, ev);
    this.emit("borne", this.borne);
  }

  serviceState(name: ServiceName) {
    const rt = this.runtimes.get(name)!;
    return {
      name,
      label: rt.def.label,
      status: rt.status,
      configurable: rt.def.build(this.cfg) !== null,
      port: rt.def.port?.(this.cfg) ?? null,
      startedAt: rt.startedAt ?? null,
      exitCode: rt.exitCode ?? null,
    };
  }

  allStates() {
    return SERVICE_DEFS.map((d) => this.serviceState(d.name));
  }

  logsFor(name: ServiceName): string[] {
    return this.runtimes.get(name)?.logs ?? [];
  }

  // --- health ---
  pingPort(port: number, host = "127.0.0.1", timeout = 700): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const done = (ok: boolean) => {
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(timeout);
      socket.once("connect", () => done(true));
      socket.once("timeout", () => done(false));
      socket.once("error", () => done(false));
      socket.connect(port, host);
    });
  }

  private waitForPort(port: number, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
      const tick = async () => {
        if (await this.pingPort(port)) return resolve();
        if (Date.now() > deadline) return reject(new Error("timeout"));
        setTimeout(tick, 400);
      };
      tick();
    });
  }

  async health() {
    const c = this.cfg;
    const [redis, websocket, rails, vcp] = await Promise.all([
      this.pingPort(c.ports.redis),
      this.pingPort(c.ports.websocket),
      this.pingPort(c.ports.rails),
      this.pingPort(c.adminPort),
    ]);
    return { redis, websocket, rails, vcp };
  }
}
