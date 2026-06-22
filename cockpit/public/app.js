"use strict";

const $ = (s) => document.querySelector(s);
const api = (url, opts) => fetch(url, opts).then((r) => r.json());

let config = null;
let borne = { status: "Unknown", charging: false };
let services = [];
let scenarios = [];
let selectedSvc = null;
let sessions = {};            // connectorId -> SessionView
let selectedConnector = 1;
const CFG_FIELDS = ["websocketPath", "platformPath", "identity", "wsUrl"];
const SHORT = { websocket: "WS", subscriber: "SUB", sidekiq: "SIDEKIQ", rails: "RAILS", vite: "VITE", vcp: "VCP" };

const STATUS_V16 = ["Available", "Preparing", "Charging", "SuspendedEV", "Finishing", "Faulted", "Unavailable"];
const STATUS_V201 = ["Available", "Occupied", "Reserved", "Unavailable", "Faulted"];

function nowIso() { return new Date().toISOString(); }
function isV16() { return (config?.ocppVersion ?? "OCPP_1.6") === "OCPP_1.6"; }
const DOT_STATE = (s) => (s === "running" ? "running" : s === "starting" ? "starting" : s === "stopped" ? "stopped" : "exited");

// =================== config ===================
function renderConfig() {
  if (!config) return;
  for (const f of CFG_FIELDS) { const el = $(`#cfg-${f}`); if (el) el.value = config[f] ?? ""; }
  $("#cfg-ocppVersion").value = config.ocppVersion;
  $("#cfg-adminPort").value = config.adminPort;
  $("#cfg-connectors").value = config.connectors ?? 2;
  $("#cfg-sessionFullSeconds").value = config.sessionFullSeconds ?? 120;
  $("#cfg-mode").value = config.mode ?? "local";
  $("#staging-fields").classList.toggle("hidden", (config.mode ?? "local") !== "staging");
  $("#cfg-staging-wsUrl").value = config.staging?.wsUrl ?? "";
  $("#cfg-staging-identity").value = config.staging?.identity ?? "";
  $("#cfg-staging-password").value = config.staging?.password ?? "";
  $("#borne-identity").textContent = config.identity || "—";
  $("#v201-warning").classList.toggle("hidden", isV16());
  // config screen view (reflects active mode)
  const staging = config.mode === "staging";
  $("#scr-identity").textContent = (staging ? config.staging?.identity : config.identity) || "—";
  $("#scr-version").textContent = isV16() ? "1.6" : "2.0.1";
  $("#scr-endpoint").textContent = staging
    ? (config.staging?.wsUrl || "—")
    : `${config.wsUrl}/${config.identity}`;
  renderEvseToggle();
  renderScenarios();
  renderStatusButtons();
}

function renderScenarios() {
  const sel = $("#charge-scenario");
  if (!sel) return;
  const cur = config?.idTag;
  sel.innerHTML = "";
  for (const s of scenarios) {
    const o = document.createElement("option");
    o.value = s.idTag;
    o.textContent = s.label;
    if (s.idTag === cur) o.selected = true;
    sel.appendChild(o);
  }
  updateScenarioHint();
}
function updateScenarioHint() {
  const hint = $("#scenario-hint");
  const sel = $("#charge-scenario");
  if (!hint || !sel) return;
  const s = scenarios.find((x) => x.idTag === sel.value);
  if (!s) { hint.textContent = ""; return; }
  const ok = s.expected === "accepted";
  hint.style.color = ok ? "#34d399" : "#f87171";
  hint.textContent = `${ok ? "✓ attendu : accepté" : "✕ attendu : refusé"} — ${s.note ?? ""}`;
}

function renderStatusButtons() {
  const wrap = $("#status-actions");
  wrap.innerHTML = "";
  for (const st of isV16() ? STATUS_V16 : STATUS_V201) {
    const b = document.createElement("button");
    b.className = "kbtn text-[11px]";
    b.textContent = st;
    b.dataset.status = st;
    if (borne.status === st) b.classList.add("on");
    b.onclick = () => sendStatus(st);
    wrap.appendChild(b);
  }
}

// =================== services ===================
function renderStatusChips() {
  const wrap = $("#status-chips");
  wrap.innerHTML = "";
  for (const s of services) {
    const chip = document.createElement("button");
    chip.className = "status-chip" + (selectedSvc === s.name ? " active" : "");
    chip.title = s.configurable ? s.label : `${s.label} — chemin manquant`;
    chip.innerHTML = `<span class="dot ${DOT_STATE(s.status)}"></span>${SHORT[s.name] ?? s.name}` +
      (s.configurable ? "" : ' <span class="text-amber-500 ml-1">⚠</span>');
    chip.onclick = () => { openDrawer("servers", true); selectService(s.name); };
    wrap.appendChild(chip);
  }
}

function renderServices() {
  const wrap = $("#services");
  wrap.innerHTML = "";
  for (const s of services) {
    const row = document.createElement("div");
    row.className = "svc" + (selectedSvc === s.name ? " ring-1 ring-cyan-500/40" : "");
    const portTxt = s.port ? `:${s.port}` : "";
    const cfgWarn = s.configurable ? "" : ' <span class="text-amber-500">(chemin manquant)</span>';
    row.innerHTML = `
      <div class="svc-name cursor-pointer flex-1"><span class="dot ${DOT_STATE(s.status)}"></span>${s.label}
        <span class="text-slate-600">${portTxt}</span>${cfgWarn}</div>
      <div class="flex gap-1">
        <button class="btn" data-start="${s.name}" ${s.configurable ? "" : "disabled"}>▶</button>
        <button class="btn" data-stop="${s.name}">■</button>
      </div>`;
    row.querySelector(".svc-name").onclick = () => selectService(s.name);
    row.querySelector("[data-start]").onclick = () => api(`/api/services/${s.name}/start`, { method: "POST" });
    row.querySelector("[data-stop]").onclick = () => api(`/api/services/${s.name}/stop`, { method: "POST" });
    wrap.appendChild(row);
  }
}

function upsertService(s) {
  const i = services.findIndex((x) => x.name === s.name);
  if (i >= 0) services[i] = s; else services.push(s);
  renderStatusChips();
  renderServices();
  pollHealthSoon(); // refresh health dots promptly on start/stop
}

// =================== logs viewer ===================
async function selectService(name) {
  selectedSvc = name;
  $("#log-target").textContent = services.find((s) => s.name === name)?.label ?? name;
  renderStatusChips();
  renderServices();
  const logs = await api(`/api/services/${name}/logs`).catch(() => []);
  const box = $("#svc-logs");
  box.innerHTML = "";
  for (const line of logs) appendLog(line);
  box.scrollTop = box.scrollHeight;
}
function appendLog(line) {
  const box = $("#svc-logs");
  const div = document.createElement("div");
  if (/error|exception|rejected|failed|raise/i.test(line)) div.className = "err";
  div.textContent = line;
  box.appendChild(div);
  while (box.children.length > 500) box.firstChild.remove();
  box.scrollTop = box.scrollHeight;
}

// =================== borne / connectors ===================
const SESS_STATUS = { preparing: "PREPARING", authorizing: "AUTHORIZING", charging: "CHARGING", finishing: "FINISHING" };

function activeSession(connectorId) {
  const s = sessions[connectorId];
  return s && s.state !== "idle" ? s : null;
}

// Compact inline EVSE selector in the borne head (no extra vertical space).
function renderEvseToggle() {
  const wrap = $("#evse-toggle");
  if (!wrap) return;
  const n = config?.connectors ?? 2;
  if (selectedConnector > n) selectedConnector = 1;
  wrap.innerHTML = "";
  for (let i = 1; i <= n; i++) {
    const sess = activeSession(i);
    const st = sess ? (sess.state === "charging" ? "charging" : "busy") : "free";
    const b = document.createElement("button");
    b.className = "evse-pill" + (i === selectedConnector ? " sel" : "");
    b.dataset.state = st;
    b.title = `EVSE ${i}${sess ? ` — ${sess.powerKw.toFixed(1)} kW` : " — libre"}`;
    b.innerHTML = `<span class="evse-dot"></span>${i}`;
    b.onclick = () => selectConnector(i);
    wrap.appendChild(b);
  }
  const lbl = $("#charge-evse");
  if (lbl) lbl.textContent = selectedConnector;
}

function selectConnector(i) {
  selectedConnector = i;
  renderEvseToggle();
  renderBorneView();
  syncSliders();
}

function syncSliders() {
  const sess = sessions[selectedConnector];
  const v = sess?.voltage ?? config?.voltage ?? 230;
  const a = sess?.current ?? config?.current ?? 32;
  $("#v-slider").value = v; $("#v-val").textContent = v;
  $("#a-slider").value = a; $("#a-val").textContent = a;
}

function renderBorneView() {
  const unit = $("#borne-unit");
  const sess = activeSession(selectedConnector);
  // pick display source: live session on the selected connector, else global borne
  const status = sess ? (SESS_STATUS[sess.state] ?? "—") : (borne.status || "UNKNOWN");
  const powerKw = sess ? sess.powerKw : borne.powerKw;
  const energyKwh = sess ? sess.energyKwh : borne.energyKwh;
  const tx = sess ? sess.transactionId : borne.transactionId;

  let state = "available";
  const st = status.toLowerCase();
  if (sess?.state === "charging" || st === "charging" || st === "occupied") state = "charging";
  else if (st.includes("fault")) state = "faulted";
  else if (!sess && (st === "disconnected" || st === "unknown")) state = "offline";
  unit.dataset.state = state;

  $("#borne-status").textContent = status;
  $("#borne-power").textContent = powerKw != null ? powerKw.toFixed(1) : "—";
  $("#borne-energy").textContent = energyKwh != null ? energyKwh.toFixed(2) : "—";
  $("#borne-connector").textContent = selectedConnector;
  $("#borne-tx").textContent = tx ?? "—";
  $("#borne-boot").textContent = borne.lastBoot ? new Date(borne.lastBoot).toLocaleTimeString() : "—";
  $("#power-bar").style.width = `${Math.min(100, ((powerKw ?? 0) / 22) * 100)}%`;
  $("#energy-bar").style.width = `${Math.min(100, (sess ? sess.soc : 0))}%`;
  // actions screen
  $("#scr-link").textContent = state === "offline" ? "OFFLINE" : "ONLINE";
  $("#scr-connector").textContent = selectedConnector;
  $("#scr-boot").textContent = borne.lastBoot ? new Date(borne.lastBoot).toLocaleTimeString() : "—";
  document.querySelectorAll("#status-actions .kbtn").forEach((b) =>
    b.classList.toggle("on", b.dataset.status === status));
  // live power-limit reason badge
  const cap = $("#cap-badge");
  if (cap) {
    const reason = sess?.cappedBy;
    if (reason === "smart") { cap.textContent = "⚡ limité (smart charging)"; cap.dataset.kind = "smart"; cap.classList.remove("hidden"); }
    else if (reason === "soc") { cap.textContent = "🔋 taper fin de charge"; cap.dataset.kind = "soc"; cap.classList.remove("hidden"); }
    else cap.classList.add("hidden");
  }
  // charge buttons reflect the state machine
  const idle = !sess;
  const startBtn = $('[data-charge="start"]'), stopBtn = $('[data-charge="stop"]');
  if (startBtn) startBtn.disabled = !idle;
  if (stopBtn) stopBtn.disabled = idle || sess.state === "finishing";
  drawCurve(sessions[selectedConnector]?.samples ?? []);
}

function drawCurve(samples) {
  const cv = $("#curve");
  if (!cv) return;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== w) cv.width = w;
  if (cv.height !== h) cv.height = h;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  if (!samples || samples.length < 2) return;
  const max = Math.max(22, ...samples) * 1.1;
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--cyan").trim() || "#22d3ee";
  ctx.beginPath();
  samples.forEach((p, idx) => {
    const x = (idx / (samples.length - 1)) * w;
    const y = h - (p / max) * h * 0.9 - 4;
    idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = accent; ctx.globalAlpha = 0.28; ctx.lineWidth = 2; ctx.stroke();
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  ctx.globalAlpha = 0.08; ctx.fillStyle = accent; ctx.fill();
  ctx.globalAlpha = 1;
}

// =================== feed ===================
const TYPE_LABEL = { 2: "CALL", 3: "RESULT", 4: "ERROR" };
function addFeed(ev) {
  const feed = $("#feed");
  const line = document.createElement("div");
  const arrow = ev.direction === "out" ? "➡" : "⬅";
  line.className = `feed-line feed-${ev.direction}` + (ev.messageType === 4 ? " err" : "");
  const label = ev.action || TYPE_LABEL[ev.messageType] || "?";
  line.innerHTML = `<span class="ts">${new Date(ev.ts).toLocaleTimeString()}</span> ${arrow}
    <span class="act">${label}</span>
    <span class="pl">${escapeHtml(JSON.stringify(ev.payload))}</span>`;
  feed.prepend(line);
  while (feed.children.length > 300) feed.lastChild.remove();

  // Surface authorisation / transaction verdicts so a blocked charge is obvious.
  const info = ev.payload?.idTagInfo;
  if (ev.direction === "in" && ev.messageType === 3 && info?.status) {
    const ok = info.status === "Accepted";
    toast(`Réponse borne : ${info.status}${ev.payload.transactionId ? ` (tx ${ev.payload.transactionId})` : ""}`, !ok);
  }
}
function escapeHtml(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]); }

// =================== health ===================
let healthDebounce = null;
function pollHealthSoon() {
  clearTimeout(healthDebounce);
  healthDebounce = setTimeout(pollHealth, 400);
}
async function pollHealth() {
  try {
    const h = await api("/api/ping");
    $("#health-row").innerHTML = [["Redis", h.redis], ["WS", h.websocket], ["Rails", h.rails], ["VCP", h.vcp]]
      .map(([n, up]) => `<span class="health-pill"><span class="dot ${up ? "running" : "stopped"}"></span>${n}</span>`).join("");
  } catch { /* ignore */ }
}

// =================== actions ===================
async function sendStatus(status) {
  const c = selectedConnector;
  const payload = isV16()
    ? { connectorId: c, errorCode: "NoError", status, timestamp: nowIso() }
    : { evseId: c, connectorId: c, connectorStatus: status, timestamp: nowIso() };
  await vcpCommand("StatusNotification", payload);
}

// charge sessions are driven by the Node engine; the UI just commands it.
function chargeIdTag() {
  return $("#charge-scenario")?.value || config?.idTag || "SIMTAG";
}
async function startCharge() {
  const c = selectedConnector;
  const res = await api(`/api/charge/${c}/start`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idTag: chargeIdTag() }),
  }).catch((e) => ({ ok: false, reason: e.message }));
  if (!res.ok) toast(`Charge EVSE ${c} : ${res.reason ?? "refusée"}`, true);
}
async function stopCharge() {
  await api(`/api/charge/${selectedConnector}/stop`, { method: "POST" }).catch(() => {});
}
let paramsTimer = null;
function pushParams() {
  const c = selectedConnector;
  const voltage = Number($("#v-slider").value);
  const current = Number($("#a-slider").value);
  $("#v-val").textContent = voltage;
  $("#a-val").textContent = current;
  clearTimeout(paramsTimer);
  paramsTimer = setTimeout(() => {
    api(`/api/charge/${c}/params`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voltage, current }),
    }).catch(() => {});
  }, 120);
}
function onSession(view) {
  sessions[view.connectorId] = view;
  renderEvseToggle();
  if (view.connectorId === selectedConnector) renderBorneView();
}
let receiptTimer = null;
function showReceipt(r) {
  $("#rcp-connector").textContent = `EVSE ${r.connectorId}`;
  $("#rcp-duration").textContent = `${Math.floor(r.durationSec / 60)}m ${r.durationSec % 60}s`;
  $("#rcp-energy").textContent = `${r.energyKwh.toFixed(3)} kWh`;
  $("#rcp-power").textContent = `${r.avgKw} / ${r.peakKw} kW`;
  $("#rcp-tx").textContent = r.transactionId ?? "—";
  const el = $("#receipt");
  el.classList.remove("hidden");
  clearTimeout(receiptTimer);
  receiptTimer = setTimeout(() => el.classList.add("hidden"), 7000);
}

async function vcpCommand(action, payload) {
  const res = await api("/api/vcp/command", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }),
  }).catch((e) => ({ ok: false, error: e.message }));
  if (!res.ok) toast(`Échec ${action} : ${res.error ?? res.status ?? "VCP injoignable ?"}`, true);
}

function toast(msg, isErr) {
  const t = document.createElement("div");
  t.className = `fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg font-mono text-xs
    border ${isErr ? "border-red-500/50 text-red-300 bg-red-950/80" : "border-cyan-500/50 text-cyan-200 bg-slate-900/90"}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// =================== screen views + OCPP config ===================
let msgIn = 0, msgOut = 0;
function bumpMsg(ev) {
  if (ev.direction === "out") msgOut++; else msgIn++;
  const o = $("#scr-msgout"), i = $("#scr-msgin");
  if (o) o.textContent = msgOut;
  if (i) i.textContent = msgIn;
}
function setScreen(tab) {
  document.querySelectorAll(".screen-view").forEach((v) => v.classList.toggle("hidden", v.dataset.screen !== tab));
  if (tab === "config") loadOcppConfig();
}
async function loadOcppConfig() {
  const box = $("#ocpp-config");
  if (!box) return;
  box.innerHTML = '<div class="text-[11px] text-slate-500 font-mono">Lecture…</div>';
  const data = await api("/api/vcp/configuration").catch(() => null);
  if (!data || data.error || !Array.isArray(data)) {
    box.innerHTML = '<div class="text-[11px] text-amber-400 font-mono">Borne injoignable (admin API).</div>';
    return;
  }
  box.innerHTML = "";
  for (const e of data) {
    const row = document.createElement("div");
    row.className = "ocfg-row";
    if (e.readonly) {
      row.innerHTML = `<span class="k" title="${escapeHtml(e.key)}">${e.key}</span>` +
        `<span class="v ro" title="${escapeHtml(e.value)}">${escapeHtml(e.value)}</span><span class="lock">🔒</span>`;
    } else {
      row.innerHTML = `<span class="k" title="${escapeHtml(e.key)}">${e.key}</span><input class="v" value="${escapeHtml(e.value)}" />`;
      const inp = row.querySelector("input");
      inp.onchange = async () => {
        const res = await api("/api/vcp/configuration", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: e.key, value: inp.value }),
        }).catch((err) => ({ error: err.message }));
        toast(`${e.key} → ${res.status ?? res.error ?? "?"}`, res.status !== "Accepted");
        if (e.key === "HeartbeatInterval") $("#scr-heartbeat").textContent = `${inp.value}s`;
      };
    }
    box.appendChild(row);
    if (e.key === "HeartbeatInterval") $("#scr-heartbeat").textContent = `${e.value}s`;
  }
}

// =================== theme & boot ===================
const THEMES = [
  { id: "futuristic", label: "🌃 Futuriste", color: "#22d3ee" },
  { id: "kawaii", label: "☁️ Kawaii", color: "#ff3d9a" },
  { id: "retro", label: "📺 Rétro", color: "#ffb000" },
  { id: "terminal", label: "🖥️ Terminal", color: "#e5e5e5" },
  { id: "pastel", label: "🍬 Pastel", color: "#9aa0f0" },
];
function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  document.documentElement.dataset.theme = theme.id;
  try { localStorage.setItem("cockpit-theme", theme.id); } catch { /* ignore */ }
  markActiveTheme();
}
function markActiveTheme() {
  const cur = document.documentElement.dataset.theme;
  document.querySelectorAll("#theme-picker .theme-btn").forEach((b) => b.classList.toggle("on", b.dataset.theme === cur));
}
function renderThemePicker() {
  const wrap = $("#theme-picker");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (const t of THEMES) {
    const b = document.createElement("button");
    b.className = "theme-btn";
    b.dataset.theme = t.id;
    b.style.setProperty("--sw", t.color);
    b.innerHTML = `<span class="theme-swatch"></span>${t.label}`;
    b.onclick = () => applyTheme(t.id);
    wrap.appendChild(b);
  }
  markActiveTheme();
}
function runBoot() {
  const el = $("#boot");
  if (!el) return;
  const dismiss = () => {
    if (!el.isConnected || el.classList.contains("done")) return;
    el.classList.add("done");
    setTimeout(() => el.remove(), 900);
  };
  el.addEventListener("click", dismiss);
  setTimeout(dismiss, 10000); // stays 10s after load, or click to continue
}

// =================== drawers ===================
function openDrawer(which, force) {
  const panel = $(`#panel-${which}`);
  const btn = $(`#toggle-${which}`);
  const open = force != null ? force : !panel.classList.contains("open");
  panel.classList.toggle("open", open);
  btn.setAttribute("aria-pressed", String(open));
}

// =================== wiring ===================
function bindControls() {
  $("#btn-start-all").onclick = () => api("/api/services/start-all", { method: "POST" });
  $("#btn-stop-all").onclick = () => api("/api/services/stop-all", { method: "POST" });
  $("#btn-clear-feed").onclick = () => ($("#feed").innerHTML = "");
  $("#btn-clear-logs").onclick = () => ($("#svc-logs").innerHTML = "");
  $("#toggle-servers").onclick = () => openDrawer("servers");
  $("#toggle-config").onclick = () => openDrawer("config");
  renderThemePicker();

  // borne control tabs (charge / actions / config)
  document.querySelectorAll("#ctrl-tabs .seg-btn").forEach((b) => (b.onclick = () => {
    document.querySelectorAll("#ctrl-tabs .seg-btn").forEach((x) => x.classList.toggle("on", x === b));
    document.querySelectorAll(".ctrl-panel").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== b.dataset.tab));
    setScreen(b.dataset.tab);
  }));
  $("#charge-scenario").onchange = async () => {
    const idTag = $("#charge-scenario").value;
    config = await api("/api/config", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idTag }),
    });
    renderConfig();
    updateScenarioHint();
  };
  $("#ocfg-refresh").onclick = loadOcppConfig;

  document.querySelectorAll("[data-charge]").forEach((b) =>
    (b.onclick = () => (b.dataset.charge === "start" ? startCharge() : stopCharge())));
  $("#v-slider").oninput = pushParams;
  $("#a-slider").oninput = pushParams;
  document.querySelectorAll("[data-conn]").forEach((b) => (b.onclick = async () => {
    if (b.dataset.conn === "disconnect") await api("/api/services/vcp/stop", { method: "POST" });
    else await api("/api/vcp/reconnect", { method: "POST" });
  }));
  $("#cfg-mode").onchange = () =>
    $("#staging-fields").classList.toggle("hidden", $("#cfg-mode").value !== "staging");

  document.querySelectorAll("[data-pick]").forEach((b) => (b.onclick = async () => {
    const key = b.dataset.pick;
    const res = await api("/api/pick-folder", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: `Choisir ${key}` }),
    });
    if (res.path) $(`#cfg-${key}`).value = res.path;
    else if (res.error) toast(res.error + " — saisis le chemin à la main", true);
  }));

  $("#cfg-ocppVersion").onchange = () =>
    $("#v201-warning").classList.toggle("hidden", $("#cfg-ocppVersion").value === "OCPP_1.6");

  $("#btn-save-config").onclick = async () => {
    const body = {
      websocketPath: $("#cfg-websocketPath").value.trim(),
      platformPath: $("#cfg-platformPath").value.trim(),
      identity: $("#cfg-identity").value.trim(),
      ocppVersion: $("#cfg-ocppVersion").value,
      wsUrl: $("#cfg-wsUrl").value.trim(),
      adminPort: Number.parseInt($("#cfg-adminPort").value, 10) || 9999,
      connectors: Number.parseInt($("#cfg-connectors").value, 10) || 2,
      sessionFullSeconds: Number.parseInt($("#cfg-sessionFullSeconds").value, 10) || 120,
      mode: $("#cfg-mode").value,
      staging: {
        wsUrl: $("#cfg-staging-wsUrl").value.trim(),
        identity: $("#cfg-staging-identity").value.trim(),
        password: $("#cfg-staging-password").value,
      },
    };
    config = await api("/api/config", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    renderConfig();
    toast("Configuration enregistrée");
  };
}

function connectSSE() {
  const es = new EventSource("/events");
  es.addEventListener("snapshot", (e) => {
    const d = JSON.parse(e.data);
    config = d.config; borne = d.borne; services = d.services; scenarios = d.scenarios || [];
    sessions = {};
    for (const s of d.sessions || []) sessions[s.connectorId] = s;
    renderConfig(); renderStatusChips(); renderServices();
    renderEvseToggle(); syncSliders(); renderBorneView();
  });
  es.addEventListener("scenarios", (e) => { scenarios = JSON.parse(e.data); renderScenarios(); });
  es.addEventListener("services", (e) => { services = JSON.parse(e.data); renderStatusChips(); renderServices(); });
  es.addEventListener("service", (e) => upsertService(JSON.parse(e.data)));
  es.addEventListener("log", (e) => { const l = JSON.parse(e.data); if (l.name === selectedSvc) appendLog(l.line); });
  es.addEventListener("ocpp", (e) => { const ev = JSON.parse(e.data); bumpMsg(ev); addFeed(ev); });
  es.addEventListener("borne", (e) => { borne = JSON.parse(e.data); renderBorneView(); });
  es.addEventListener("session", (e) => onSession(JSON.parse(e.data)));
  es.addEventListener("receipt", (e) => showReceipt(JSON.parse(e.data)));
  es.addEventListener("config", (e) => { config = JSON.parse(e.data); renderConfig(); renderEvseToggle(); });
  es.onerror = () => {/* browser auto-reconnects */};
}

(async function init() {
  applyTheme(localStorage.getItem("cockpit-theme") || "futuristic");
  runBoot();
  bindControls();
  connectSSE();
  await pollHealth();
  setInterval(pollHealth, 4000);
})();
