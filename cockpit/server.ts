import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { type CockpitConfig, DEFAULT_CONFIG, ServiceManager, type ServiceName } from "./services";

const COCKPIT_DIR = __dirname;
const PUBLIC_DIR = path.join(COCKPIT_DIR, "public");
const CONFIG_FILE = path.join(COCKPIT_DIR, "config.json");
const PORT = Number.parseInt(process.env.COCKPIT_PORT ?? "8080", 10);

function loadConfig(): CockpitConfig {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return { ...DEFAULT_CONFIG, ...raw, ports: { ...DEFAULT_CONFIG.ports, ...(raw.ports ?? {}) } };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(cfg: CockpitConfig) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

const manager = new ServiceManager(loadConfig());
const app = new Hono();

// --- SSE clients ---
const sseClients = new Set<(chunk: string) => void>();
function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const send of sseClients) send(payload);
}
manager.on("service", (s) => broadcast("service", s));
manager.on("log", (l) => broadcast("log", l));
manager.on("ocpp", (e) => broadcast("ocpp", e));
manager.on("borne", (b) => broadcast("borne", b));
manager.on("scenarios", (s) => broadcast("scenarios", s));
manager.on("session", (s) => broadcast("session", s));
manager.on("receipt", (r) => broadcast("receipt", r));

// --- static ---
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};
function serveFile(file: string): Response {
  const full = path.resolve(PUBLIC_DIR, file);
  const rel = path.relative(PUBLIC_DIR, full);
  // reject any path that escapes PUBLIC_DIR (path traversal)
  if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(full)) {
    return new Response("Not found", { status: 404 });
  }
  const ext = path.extname(full);
  return new Response(fs.readFileSync(full), {
    headers: { "Content-Type": MIME[ext] ?? "application/octet-stream" },
  });
}

app.get("/", () => serveFile("index.html"));
app.get("/app.js", () => serveFile("app.js"));
// CSS split across css/ (+ css/themes/) — serve any of them safely (path-traversal guarded).
app.get("/css/*", (c) => serveFile(decodeURIComponent(new URL(c.req.url).pathname).replace(/^\//, "")));

// --- SSE stream ---
app.get("/events", (c) => {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          /* closed */
        }
      };
      sseClients.add(send);
      // initial snapshot
      send(`event: snapshot\ndata: ${JSON.stringify({ services: manager.allStates(), borne: manager.borne, config: manager.getConfig(), scenarios: manager.scenarios, sessions: manager.charge.state() })}\n\n`);
      const keepalive = setInterval(() => send(": ping\n\n"), 15000);
      c.req.raw.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        sseClients.delete(send);
      });
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
});

// --- config ---
app.get("/api/config", (c) => c.json(manager.getConfig()));
app.post("/api/config", async (c) => {
  const body = (await c.req.json()) as Partial<CockpitConfig>;
  const prev = manager.getConfig();
  const next = { ...prev, ...body, ports: { ...prev.ports, ...(body.ports ?? {}) } };
  const hadPlatform = !!prev.platformPath;
  manager.setConfig(next);
  saveConfig(next);
  broadcast("config", next);
  broadcast("services", manager.allStates()); // configurable flags depend on paths
  // Run the seed once the platform folder becomes known/changes (boot seed can't have run yet).
  if (next.platformPath && (!hadPlatform || prev.platformPath !== next.platformPath)) {
    manager.runSeed().then((r) => console.log(`  🌱 seed (après config): ${r.ok ? "ok" : "échec/partiel"}`));
  }
  return c.json(next);
});

// --- native folder picker (zenity) ---
app.post("/api/pick-folder", async (c) => {
  const { title } = (await c.req.json().catch(() => ({}))) as { title?: string };
  const result = await new Promise<{ path?: string; error?: string }>((resolve) => {
    const z = spawn("zenity", ["--file-selection", "--directory", `--title=${title ?? "Choisir un dossier"}`]);
    let out = "";
    z.stdout.on("data", (d) => {
      out += d.toString();
    });
    z.on("error", () => resolve({ error: "zenity indisponible" }));
    z.on("exit", (code) => (code === 0 ? resolve({ path: out.trim() }) : resolve({})));
  });
  return c.json(result);
});

// --- services ---
app.get("/api/services", (c) => c.json(manager.allStates()));
app.get("/api/services/:name/logs", (c) => c.json(manager.logsFor(c.req.param("name") as ServiceName)));
app.post("/api/services/start-all", async (c) => {
  manager.startAll();
  return c.json({ ok: true });
});
app.post("/api/services/stop-all", (c) => {
  manager.stopAll();
  return c.json({ ok: true });
});
app.post("/api/services/:name/start", (c) => c.json(manager.start(c.req.param("name") as ServiceName)));
app.post("/api/services/:name/stop", (c) => c.json(manager.stop(c.req.param("name") as ServiceName)));

// --- VCP admin proxy ---
app.post("/api/vcp/command", async (c) => {
  const { action, payload } = (await c.req.json()) as { action: string; payload: unknown };
  const adminPort = manager.getConfig().adminPort;
  try {
    const res = await fetch(`http://localhost:${adminPort}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
      signal: AbortSignal.timeout(2000),
    });
    return c.json({ ok: res.ok, status: res.status });
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message }, 502);
  }
});
app.post("/api/vcp/reconnect", async (c) => {
  await manager.reconnectVcp();
  return c.json({ ok: true });
});
// OCPP configuration of the borne (GetConfiguration view) via the VCP admin API.
app.get("/api/vcp/configuration", async (c) => {
  const port = manager.getConfig().adminPort;
  try {
    const res = await fetch(`http://localhost:${port}/configuration`, { signal: AbortSignal.timeout(2000) });
    return c.json(await res.json());
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});
app.post("/api/vcp/configuration", async (c) => {
  const port = manager.getConfig().adminPort;
  const body = await c.req.json();
  try {
    const res = await fetch(`http://localhost:${port}/configuration`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(2000),
    });
    return c.json(await res.json());
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message }, 502);
  }
});

// --- charge sessions ---
app.get("/api/charge/state", (c) => c.json(manager.charge.state()));
app.post("/api/charge/:connector/start", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { idTag?: string };
  const idTag = body.idTag || manager.getConfig().idTag;
  return c.json(await manager.charge.start(Number(c.req.param("connector")), idTag));
});
app.post("/api/charge/:connector/stop", async (c) => c.json(await manager.charge.stop(Number(c.req.param("connector")))));
app.post("/api/charge/:connector/params", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { voltage?: number; current?: number };
  manager.charge.setParams(Number(c.req.param("connector")), body);
  return c.json({ ok: true });
});

// --- scenarios / seed ---
app.get("/api/scenarios", (c) => c.json(manager.scenarios));
app.post("/api/seed", async (c) => c.json(await manager.runSeed()));

// --- health ---
app.get("/api/ping", async (c) => c.json(await manager.health()));

// --- lifecycle ---
function shutdown() {
  manager.stopAll();
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Bind to loopback only: the cockpit spawns processes & drives the borne — never expose it.
serve({ fetch: app.fetch, port: PORT, hostname: "127.0.0.1" }, (info) => {
  console.log(`\n  🛰  Cockpit prêt → http://localhost:${info.port}\n`);
  // Idempotent seed at boot (non-blocking) so charge scenarios are ready.
  if (manager.getConfig().platformPath) {
    manager.runSeed().then((r) => console.log(`  🌱 seed scénarios: ${r.ok ? "ok" : "échec/partiel"}`));
  }
});
