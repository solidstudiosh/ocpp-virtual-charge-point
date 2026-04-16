const API = {
  state: "/api/ui/state",
  connect: "/api/ui/connect",
  disconnect: "/api/ui/disconnect",
  execute: "/api/ui/execute",
  resetTelemetry: "/api/ui/telemetry/reset",
  heartbeatConfig: "/api/ui/heartbeat/config",
  chaosMode: "/api/ui/chaos",
};

const POLL_INTERVAL_MS = 2000;

const dom = {
  wsUrl: document.getElementById("ws-url"),
  connectionChip: document.getElementById("connection-chip"),
  connectForm: document.getElementById("connect-form"),
  endpoint: document.getElementById("endpoint"),
  chargePointId: document.getElementById("chargePointId"),
  ocppVersion: document.getElementById("ocppVersion"),
  basicAuthPassword: document.getElementById("basicAuthPassword"),
  sendBootNotification: document.getElementById("sendBootNotification"),
  sendInitialStatus: document.getElementById("sendInitialStatus"),
  heartbeatConfigMinutes: document.getElementById("heartbeat-config-minutes"),
  heartbeatConfigStatus: document.getElementById("heartbeat-config-status"),
  applyHeartbeatConfigBtn: document.getElementById("apply-heartbeat-config-btn"),
  chaosModeBtn: document.getElementById("chaos-mode-btn"),
  chaosModeStatus: document.getElementById("chaos-mode-status"),
  disconnectBtn: document.getElementById("disconnect-btn"),
  sendHeartbeatBtn: document.getElementById("send-heartbeat-btn"),
  sendAuthorizeBtn: document.getElementById("send-authorize-btn"),
  sendStatusBtn: document.getElementById("send-status-btn"),
  sendMeterBtn: document.getElementById("send-meter-btn"),
  startTransactionBtn: document.getElementById("start-transaction-btn"),
  stopTransactionBtn: document.getElementById("stop-transaction-btn"),
  idTag: document.getElementById("idTag"),
  connectorId: document.getElementById("connectorId"),
  evseId: document.getElementById("evseId"),
  statusValue: document.getElementById("statusValue"),
  errorCode: document.getElementById("errorCode"),
  transactionId: document.getElementById("transactionId"),
  activeTransactionSelect: document.getElementById("active-transaction-select"),
  meterValue: document.getElementById("meterValue"),
  customAction: document.getElementById("customAction"),
  customPayload: document.getElementById("customPayload"),
  sendCustomBtn: document.getElementById("send-custom-btn"),
  formatJsonBtn: document.getElementById("format-json-btn"),
  clearTelemetryBtn: document.getElementById("clear-telemetry-btn"),
  toastHost: document.getElementById("toast-host"),
  kpis: document.getElementById("kpis"),
  heartbeatTable: document.getElementById("heartbeat-table"),
  meterTable: document.getElementById("meter-table"),
  transactionTable: document.getElementById("transaction-table"),
  messageFeed: document.getElementById("message-feed"),
  heartbeatChart: document.getElementById("heartbeat-chart"),
  heartbeatRateChart: document.getElementById("heartbeat-rate-chart"),
  heartbeatRateValue: document.getElementById("heartbeat-rate-value"),
  heartbeatWindowMinutes: document.getElementById("heartbeat-window-minutes"),
  meterChart: document.getElementById("meter-chart"),
  trafficChart: document.getElementById("traffic-chart"),
  logFeed: document.getElementById("log-feed"),
  logLevelFilter: document.getElementById("log-level-filter"),
  logSourceFilter: document.getElementById("log-source-filter"),
};

let latestState = null;
let initializedForm = false;
let pollHandle = null;
let canShowFetchErrorToast = true;

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

init();

function init() {
  bindTabs();
  bindActions();
  pollState(true);
  pollHandle = setInterval(() => pollState(false), POLL_INTERVAL_MS);
  window.addEventListener("resize", () => {
    if (latestState) {
      renderCharts(latestState);
    }
  });
}

function bindTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.tab;
      tabButtons.forEach((b) => b.classList.remove("active"));
      button.classList.add("active");

      tabPanels.forEach((panel) => {
        panel.classList.toggle("active", panel.id === `tab-${target}`);
      });
    });
  });
}

function bindActions() {
  dom.connectForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      endpoint: dom.endpoint.value.trim(),
      chargePointId: dom.chargePointId.value.trim(),
      ocppVersion: dom.ocppVersion.value,
      basicAuthPassword: dom.basicAuthPassword.value,
      sendBootNotification: dom.sendBootNotification.checked,
      sendInitialStatus: dom.sendInitialStatus.checked,
    };

    if (!payload.endpoint || !payload.chargePointId) {
      showToast("Endpoint and Charge Point ID are required", true);
      return;
    }

    const response = await postJson(API.connect, payload);
    if (!response.ok) {
      showToast(response.error || "Connection failed", true);
      return;
    }

    latestState = response.state;
    render(latestState);
    showToast("Charge point connected");
  });

  dom.disconnectBtn.addEventListener("click", async () => {
    const response = await postJson(API.disconnect, {});
    if (!response.ok) {
      showToast(response.error || "Failed to disconnect", true);
      return;
    }

    latestState = response.state;
    render(latestState);
    showToast("Charge point disconnected");
  });

  dom.applyHeartbeatConfigBtn.addEventListener("click", async () => {
    const minutes = Number.parseFloat(dom.heartbeatConfigMinutes.value);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      showToast("Heartbeat interval must be a number greater than 0", true);
      return;
    }

    const response = await postJson(API.heartbeatConfig, { minutes });
    if (!response.ok) {
      showToast(response.error || "Failed to configure heartbeat", true);
      return;
    }

    latestState = response.state;
    render(latestState);
    showToast(`Heartbeat interval set to ${minutes} minute(s)`);
  });

  dom.chaosModeBtn.addEventListener("click", async () => {
    const enabled = !latestState?.chaosMode?.enabled;
    const response = await postJson(API.chaosMode, { enabled });
    if (!response.ok) {
      showToast(response.error || "Failed to toggle chaos mode", true);
      return;
    }

    latestState = response.state;
    render(latestState);
    showToast(enabled ? "Chaos mode enabled" : "Chaos mode disabled");
  });

  dom.activeTransactionSelect.addEventListener("change", () => {
    const selectedTransactionId = dom.activeTransactionSelect.value;
    if (!selectedTransactionId) {
      return;
    }
    dom.transactionId.value = selectedTransactionId;
  });

  dom.sendHeartbeatBtn.addEventListener("click", async () => {
    await sendAction("Heartbeat", {});
  });

  dom.sendAuthorizeBtn.addEventListener("click", async () => {
    await sendAction("Authorize", buildAuthorizePayload());
  });

  dom.sendStatusBtn.addEventListener("click", async () => {
    await sendAction("StatusNotification", buildStatusPayload());
  });

  dom.sendMeterBtn.addEventListener("click", async () => {
    await sendAction("MeterValues", buildMeterPayload());
  });

  dom.startTransactionBtn.addEventListener("click", async () => {
    if (!supportsAction("StartTransaction")) {
      showToast("StartTransaction is not available for selected OCPP version", true);
      return;
    }

    const meterStart = Math.round(Number.parseFloat(dom.meterValue.value) * 1000);
    await sendAction("StartTransaction", {
      connectorId: Number.parseInt(dom.connectorId.value, 10),
      idTag: dom.idTag.value || "DEADBEEF",
      meterStart: Number.isNaN(meterStart) ? 0 : meterStart,
      timestamp: new Date().toISOString(),
    });
  });

  dom.stopTransactionBtn.addEventListener("click", async () => {
    if (!supportsAction("StopTransaction")) {
      showToast("StopTransaction is not available for selected OCPP version", true);
      return;
    }

    const activeTransactions = latestState?.activeTransactions || [];
    const selectedTransactionId =
      dom.activeTransactionSelect.value
      || (activeTransactions.length > 0 ? String(activeTransactions[activeTransactions.length - 1].transactionId) : "");

    const transactionIdRaw = selectedTransactionId || dom.transactionId.value;
    const transactionId = Number.parseInt(transactionIdRaw, 10);
    if (Number.isNaN(transactionId)) {
      showToast("Select an active transaction or enter a valid numeric transaction ID", true);
      return;
    }

    const meterStop = Math.round(Number.parseFloat(dom.meterValue.value) * 1000);
    await sendAction("StopTransaction", {
      transactionId,
      meterStop: Number.isNaN(meterStop) ? 0 : meterStop,
      timestamp: new Date().toISOString(),
      reason: "Local",
    });
  });

  dom.sendCustomBtn.addEventListener("click", async () => {
    const action = dom.customAction.value;
    if (!action) {
      showToast("Select an action", true);
      return;
    }

    let payload;
    try {
      payload = JSON.parse(dom.customPayload.value || "{}");
    } catch {
      showToast("Payload JSON is invalid", true);
      return;
    }

    await sendAction(action, payload);
  });

  dom.formatJsonBtn.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(dom.customPayload.value || "{}");
      dom.customPayload.value = JSON.stringify(parsed, null, 2);
    } catch {
      showToast("Payload JSON is invalid", true);
    }
  });

  dom.customAction.addEventListener("change", () => {
    setTemplateForSelectedAction();
  });

  dom.logLevelFilter.addEventListener("change", () => {
    if (latestState) {
      renderLogs(latestState);
    }
  });

  dom.logSourceFilter.addEventListener("change", () => {
    if (latestState) {
      renderLogs(latestState);
    }
  });

  dom.heartbeatWindowMinutes.addEventListener("change", () => {
    if (latestState) {
      renderCharts(latestState);
    }
  });

  dom.clearTelemetryBtn.addEventListener("click", async () => {
    const response = await postJson(API.resetTelemetry, {});
    if (!response.ok) {
      showToast(response.error || "Failed to clear telemetry", true);
      return;
    }

    latestState = response.state;
    render(latestState);
    showToast("Telemetry reset");
  });
}

async function sendAction(action, payload) {
  if (!latestState?.connection?.connected) {
    showToast("Connect to CSMS first", true);
    return;
  }

  const response = await postJson(API.execute, {
    action,
    payload,
  });

  if (!response.ok) {
    showToast(response.error || `Failed to send ${action}`, true);
    return;
  }

  latestState = response.state;
  render(latestState);
  showToast(`${action} sent`);
}

async function pollState(forceToastOnError) {
  try {
    const state = await getJson(API.state);
    latestState = state;
    render(state);
    canShowFetchErrorToast = true;
  } catch {
    if (forceToastOnError || canShowFetchErrorToast) {
      showToast("Unable to fetch state from VCP server", true);
      canShowFetchErrorToast = false;
    }
  }
}

function render(state) {
  renderConnection(state);
  renderHeartbeatConfiguration(state);
  renderChaosMode(state);
  renderActiveTransactionSelector(state);
  renderActionSelect(state);
  renderKpis(state);
  renderHeartbeats(state);
  renderMeterValues(state);
  renderTransactions(state);
  renderMessageFeed(state);
  renderLogs(state);
  renderCharts(state);
  updateActionAvailability(state);

  if (!initializedForm) {
    dom.endpoint.value = state.options.endpoint;
    dom.chargePointId.value = state.options.chargePointId;
    dom.ocppVersion.value = state.options.ocppVersion;
    initializedForm = true;
  }
}

function renderActiveTransactionSelector(state) {
  const activeTransactions = state.activeTransactions || [];
  const previousValue = dom.activeTransactionSelect.value;

  const options = ['<option value="">Auto (latest active)</option>'];
  activeTransactions.forEach((tx) => {
    const value = String(tx.transactionId);
    const label = `${value} · Connector ${tx.connectorId} · ${numberFormat.format(tx.durationSeconds)}s`;
    options.push(`<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`);
  });
  dom.activeTransactionSelect.innerHTML = options.join("");

  if (previousValue && activeTransactions.some((tx) => String(tx.transactionId) === previousValue)) {
    dom.activeTransactionSelect.value = previousValue;
    return;
  }

  if (activeTransactions.length > 0) {
    const latestId = String(activeTransactions[activeTransactions.length - 1].transactionId);
    dom.activeTransactionSelect.value = latestId;
    if (
      !dom.transactionId.value
      || dom.transactionId.value === "1001"
      || !activeTransactions.some((tx) => String(tx.transactionId) === dom.transactionId.value)
    ) {
      dom.transactionId.value = latestId;
    }
  } else {
    dom.activeTransactionSelect.value = "";
  }
}

function renderConnection(state) {
  const derivedWsUrl = `${state.options.endpoint.replace(/\/+$/, "")}/${state.options.chargePointId}`;
  dom.wsUrl.textContent = state.connection.websocketUrl || derivedWsUrl;

  const chip = dom.connectionChip;
  chip.classList.remove("connected", "connecting", "disconnected");

  if (state.connection.connected) {
    chip.classList.add("connected");
    chip.textContent = "Connected";
  } else if (state.connection.connecting) {
    chip.classList.add("connecting");
    chip.textContent = "Connecting";
  } else {
    chip.classList.add("disconnected");
    chip.textContent = "Disconnected";
  }
}

function renderHeartbeatConfiguration(state) {
  const heartbeatConfiguration = state.heartbeatConfiguration || {};
  const currentMinutes = heartbeatConfiguration.manualOverrideIntervalMinutes
    ?? heartbeatConfiguration.currentIntervalMinutes
    ?? 1;

  if (document.activeElement !== dom.heartbeatConfigMinutes) {
    dom.heartbeatConfigMinutes.value = String(currentMinutes);
  }

  if (heartbeatConfiguration.manualOverrideActive) {
    dom.heartbeatConfigStatus.textContent = `Manual heartbeat interval: ${numberFormat.format(currentMinutes)} minute(s)`;
    return;
  }

  if (heartbeatConfiguration.currentIntervalMinutes !== undefined) {
    dom.heartbeatConfigStatus.textContent = `CSMS heartbeat interval: ${numberFormat.format(heartbeatConfiguration.currentIntervalMinutes)} minute(s)`;
    return;
  }

  dom.heartbeatConfigStatus.textContent = "No heartbeat interval configured yet";
}

function renderChaosMode(state) {
  const chaosMode = state.chaosMode || { enabled: false };
  const isEnabled = Boolean(chaosMode.enabled);
  dom.chaosModeBtn.textContent = isEnabled ? "Disable Chaos Mode" : "Enable Chaos Mode";
  dom.chaosModeBtn.classList.toggle("primary", isEnabled);
  dom.chaosModeBtn.classList.toggle("ghost", !isEnabled);

  if (!isEnabled) {
    dom.chaosModeStatus.textContent = "Chaos mode is off";
    return;
  }

  const nextEvent = chaosMode.nextEventAt ? toTime(chaosMode.nextEventAt) : "pending";
  dom.chaosModeStatus.textContent = `Chaos mode is on · next event around ${nextEvent}`;
}

function renderActionSelect(state) {
  const currentAction = dom.customAction.value;
  const actions = state.supportedActions || [];
  dom.customAction.innerHTML = actions
    .map((action) => `<option value="${escapeHtml(action)}">${escapeHtml(action)}</option>`)
    .join("");

  if (actions.length === 0) {
    dom.customPayload.value = "{}";
    return;
  }

  if (actions.includes(currentAction)) {
    dom.customAction.value = currentAction;
  }

  if (!dom.customAction.value && actions[0]) {
    dom.customAction.value = actions[0];
  }

  if (!dom.customPayload.dataset.userEdited) {
    setTemplateForSelectedAction();
  }

  dom.customPayload.addEventListener("input", () => {
    dom.customPayload.dataset.userEdited = "true";
  }, { once: true });
}

function renderKpis(state) {
  const stats = state.stats;
  const heartbeatLatency =
    stats.averageHeartbeatLatencyMs === undefined
      ? "-"
      : `${numberFormat.format(stats.averageHeartbeatLatencyMs)} ms`;

  const cards = [
    { label: "Sent", value: numberFormat.format(stats.sent) },
    { label: "Received", value: numberFormat.format(stats.received) },
    { label: "Errors", value: numberFormat.format(stats.errors) },
    { label: "Active Transactions", value: numberFormat.format(stats.activeTransactions) },
    {
      label: "Last Heartbeat",
      value: stats.lastHeartbeatAt ? toTime(stats.lastHeartbeatAt) : "-",
    },
    { label: "Avg HB RTT", value: heartbeatLatency },
  ];

  dom.kpis.innerHTML = cards
    .map(
      (card) =>
        `<article class="kpi"><p class="label">${escapeHtml(card.label)}</p><p class="value">${escapeHtml(card.value)}</p></article>`,
    )
    .join("");
}

function renderHeartbeats(state) {
  const rows = (state.heartbeats || [])
    .slice(-30)
    .reverse()
    .map((entry) => [
      toTime(entry.timestamp),
      entry.phase,
      entry.latencyMs === undefined ? "-" : `${numberFormat.format(entry.latencyMs)} ms`,
      entry.messageId,
    ]);

  dom.heartbeatTable.innerHTML = renderTable(
    ["Time", "Phase", "Latency", "Message ID"],
    rows,
  );
}

function renderMeterValues(state) {
  const rows = (state.meterValues || [])
    .slice(-30)
    .reverse()
    .map((entry) => [
      toTime(entry.timestamp),
      entry.transactionId ?? "-",
      entry.connectorId ?? entry.evseId ?? "-",
      `${numberFormat.format(entry.value)} ${entry.unit || ""}`.trim(),
      entry.measurand || "-",
    ]);

  dom.meterTable.innerHTML = renderTable(
    ["Time", "Tx", "Connector/EVSE", "Value", "Measurand"],
    rows,
  );
}

function renderTransactions(state) {
  const timelineRows = (state.transactions || [])
    .slice(-18)
    .reverse()
    .map((entry) => [
      toTime(entry.timestamp),
      entry.event,
      entry.transactionId ?? "-",
      entry.connectorId ?? "-",
      entry.details || "-",
    ]);

  const activeRows = (state.activeTransactions || []).map((tx) => [
    toTime(tx.startedAt),
    tx.transactionId,
    tx.connectorId,
    `${numberFormat.format(tx.meterValue)} Wh`,
    `${numberFormat.format(tx.durationSeconds)} s`,
  ]);

  const timelineHtml = renderTable(
    ["Time", "Event", "Tx", "Connector", "Details"],
    timelineRows,
  );

  const activeHtml = renderTable(
    ["Started", "Tx", "Connector", "Meter", "Duration"],
    activeRows,
  );

  dom.transactionTable.innerHTML = `
    <p class="empty">Timeline</p>
    ${timelineHtml}
    <p class="empty" style="margin-top:10px;">Active</p>
    ${activeHtml}
  `;
}

function renderMessageFeed(state) {
  const items = (state.messages || []).slice(-40).reverse();
  if (items.length === 0) {
    dom.messageFeed.innerHTML = '<p class="empty">No message traffic yet</p>';
    return;
  }

  dom.messageFeed.innerHTML = items
    .map((entry) => {
      const payloadText = safeJson(entry.payload);
      return `
        <article class="feed-item">
          <p class="meta">${toTime(entry.timestamp)} · <span class="dir">${escapeHtml(entry.direction)}</span></p>
          <p class="body"><strong>${escapeHtml(entry.action || "Unknown")}</strong> · ${escapeHtml(payloadText.slice(0, 220))}</p>
        </article>
      `;
    })
    .join("");
}

function renderLogs(state) {
  const levelFilter = dom.logLevelFilter.value;
  const sourceFilter = dom.logSourceFilter.value;

  const items = (state.logs || [])
    .filter((entry) => levelFilter === "all" || entry.level === levelFilter)
    .filter((entry) => sourceFilter === "all" || entry.source === sourceFilter)
    .reverse();

  if (items.length === 0) {
    dom.logFeed.innerHTML = '<p class="empty">No logs for selected filter</p>';
    return;
  }

  dom.logFeed.innerHTML = items
    .map((entry) => {
      const details = entry.metadata ? safeJson(entry.metadata) : "";
      return `
        <article class="log-item">
          <p class="meta">${toTime(entry.timestamp)} · ${escapeHtml(entry.level)} · ${escapeHtml(entry.source)}</p>
          <p class="body">${escapeHtml(entry.message)}</p>
          ${details ? `<p class="meta">${escapeHtml(details)}</p>` : ""}
        </article>
      `;
    })
    .join("");
}

function renderCharts(state) {
  const heartbeatPoints = (state.heartbeats || [])
    .filter((entry) => entry.phase === "ack" && typeof entry.latencyMs === "number")
    .slice(-40)
    .map((entry) => ({ label: toTime(entry.timestamp), value: entry.latencyMs }));

  drawLineChart(dom.heartbeatChart, heartbeatPoints, {
    lineColor: "#ff6b35",
    fillColor: "rgba(255, 107, 53, 0.15)",
    label: "Latency (ms)",
  });

  const heartbeatWindowMinutes = getHeartbeatWindowMinutes();
  const heartbeatRatePoints = buildHeartbeatWaveform(state.heartbeats || [], heartbeatWindowMinutes);
  drawLineChart(dom.heartbeatRateChart, heartbeatRatePoints, {
    lineColor: "#2ec27e",
    fillColor: "rgba(46, 194, 126, 0.16)",
    label: "Waveform",
  });

  const heartbeatRatePerMinute = getHeartbeatRatePerMinute(state.heartbeats || []);
  dom.heartbeatRateValue.textContent = `${numberFormat.format(heartbeatRatePerMinute)} / min`;

  const meterPoints = (state.meterValues || [])
    .slice(-40)
    .map((entry) => ({ label: toTime(entry.timestamp), value: Number(entry.value) }));

  drawLineChart(dom.meterChart, meterPoints, {
    lineColor: "#168aad",
    fillColor: "rgba(22, 138, 173, 0.16)",
    label: "Meter",
  });

  const throughputPoints = aggregateByMinute(state.messages || []);
  drawBarChart(dom.trafficChart, throughputPoints, {
    barColor: "#2a9d8f",
    label: "Messages/min",
  });
}

function updateActionAvailability(state) {
  const actionSupport = {
    heartbeat: supportsAction("Heartbeat", state),
    authorize: supportsAction("Authorize", state),
    status: supportsAction("StatusNotification", state),
    meter: supportsAction("MeterValues", state),
    start: supportsAction("StartTransaction", state),
    stop: supportsAction("StopTransaction", state),
  };

  dom.sendHeartbeatBtn.disabled = !actionSupport.heartbeat;
  dom.sendAuthorizeBtn.disabled = !actionSupport.authorize;
  dom.sendStatusBtn.disabled = !actionSupport.status;
  dom.sendMeterBtn.disabled = !actionSupport.meter;
  dom.startTransactionBtn.disabled = !actionSupport.start;
  dom.stopTransactionBtn.disabled = !actionSupport.stop;
}

function setTemplateForSelectedAction() {
  const action = dom.customAction.value;
  if (!action) {
    return;
  }

  const template = getActionTemplate(action);
  dom.customPayload.value = JSON.stringify(template, null, 2);
  delete dom.customPayload.dataset.userEdited;
}

function getActionTemplate(action) {
  const connectorId = Number.parseInt(dom.connectorId.value || "1", 10);
  const evseId = Number.parseInt(dom.evseId.value || "1", 10);
  const idTag = dom.idTag.value || "DEADBEEF";
  const txIdRaw = dom.transactionId.value || "1001";
  const txId = Number.parseInt(txIdRaw, 10);
  const meter = Number.parseFloat(dom.meterValue.value || "1.2");

  const isV16 = (latestState?.options?.ocppVersion || "OCPP_1.6") === "OCPP_1.6";

  switch (action) {
    case "Heartbeat":
      return {};
    case "Authorize":
      return isV16
        ? { idTag }
        : {
            idToken: {
              idToken: idTag,
              type: "ISO14443",
            },
          };
    case "StatusNotification":
      return buildStatusPayload();
    case "MeterValues":
      return buildMeterPayload();
    case "StartTransaction":
      return {
        connectorId,
        idTag,
        meterStart: Math.round(meter * 1000),
        timestamp: new Date().toISOString(),
      };
    case "StopTransaction":
      return {
        transactionId: Number.isNaN(txId) ? 1001 : txId,
        meterStop: Math.round(meter * 1000),
        reason: "Local",
        timestamp: new Date().toISOString(),
      };
    case "BootNotification":
      return isV16
        ? {
            chargePointVendor: "Solidstudio",
            chargePointModel: "VirtualChargePoint",
            chargePointSerialNumber: "S001",
            firmwareVersion: "1.0.0",
          }
        : {
            reason: "PowerUp",
            chargingStation: {
              model: "VirtualChargePoint",
              vendorName: "Solidstudio",
            },
          };
    default:
      return {};
  }
}

function buildAuthorizePayload() {
  const isV16 = (latestState?.options?.ocppVersion || "OCPP_1.6") === "OCPP_1.6";
  const idTag = dom.idTag.value || "DEADBEEF";

  if (isV16) {
    return { idTag };
  }

  return {
    idToken: {
      idToken: idTag,
      type: "ISO14443",
    },
  };
}

function buildStatusPayload() {
  const connectorId = Number.parseInt(dom.connectorId.value || "1", 10);
  const evseId = Number.parseInt(dom.evseId.value || "1", 10);
  const status = dom.statusValue.value;
  const errorCode = dom.errorCode.value;

  const isV16 = (latestState?.options?.ocppVersion || "OCPP_1.6") === "OCPP_1.6";

  if (isV16) {
    return {
      connectorId,
      errorCode,
      status,
    };
  }

  return {
    evseId,
    connectorId,
    connectorStatus: mapStatusToConnectorStatus(status),
    timestamp: new Date().toISOString(),
  };
}

function buildMeterPayload() {
  const connectorId = Number.parseInt(dom.connectorId.value || "1", 10);
  const evseId = Number.parseInt(dom.evseId.value || "1", 10);
  const txId = Number.parseInt(dom.transactionId.value || "1001", 10);
  const meter = Number.parseFloat(dom.meterValue.value || "1.2");
  const isV16 = (latestState?.options?.ocppVersion || "OCPP_1.6") === "OCPP_1.6";

  if (isV16) {
    return {
      connectorId,
      transactionId: Number.isNaN(txId) ? undefined : txId,
      meterValue: [
        {
          timestamp: new Date().toISOString(),
          sampledValue: [
            {
              value: Number.isNaN(meter) ? "0" : meter.toString(),
              measurand: "Energy.Active.Import.Register",
              unit: "kWh",
            },
          ],
        },
      ],
    };
  }

  return {
    evseId,
    meterValue: [
      {
        timestamp: new Date().toISOString(),
        sampledValue: [
          {
            value: Number.isNaN(meter) ? 0 : meter,
            context: "Sample.Periodic",
            measurand: "Energy.Active.Import.Register",
            unitOfMeasure: {
              unit: "kWh",
            },
          },
        ],
      },
    ],
  };
}

function mapStatusToConnectorStatus(status) {
  if (status === "Available") {
    return "Available";
  }
  if (status === "Reserved") {
    return "Reserved";
  }
  if (status === "Unavailable") {
    return "Unavailable";
  }
  if (status === "Faulted") {
    return "Faulted";
  }
  return "Occupied";
}

function supportsAction(action, state = latestState) {
  return Boolean(state?.supportedActions?.includes(action));
}

function renderTable(headers, rows) {
  if (!rows.length) {
    return '<p class="empty">No data yet</p>';
  }

  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map((value) => `<td>${escapeHtml(String(value ?? "-"))}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function drawLineChart(canvas, points, options) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 600;
  const height = canvas.clientHeight || 220;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);

  const padding = { top: 18, right: 18, bottom: 30, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  drawGrid(ctx, padding, chartWidth, chartHeight);

  if (!points.length) {
    drawEmptyText(ctx, width, height, `No ${options.label} data`);
    return;
  }

  let min = Math.min(...points.map((p) => p.value));
  let max = Math.max(...points.map((p) => p.value));

  if (min === max) {
    min = min * 0.9;
    max = max * 1.1 + 1;
  }

  const toX = (index) =>
    padding.left + (index / Math.max(1, points.length - 1)) * chartWidth;
  const toY = (value) =>
    padding.top + ((max - value) / (max - min || 1)) * chartHeight;

  ctx.beginPath();
  points.forEach((point, index) => {
    const x = toX(index);
    const y = toY(point.value);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.lineWidth = 2.6;
  ctx.strokeStyle = options.lineColor;
  ctx.stroke();

  const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
  gradient.addColorStop(0, options.fillColor);
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.lineTo(toX(points.length - 1), padding.top + chartHeight);
  ctx.lineTo(toX(0), padding.top + chartHeight);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  drawYAxisLabels(ctx, min, max, padding, chartHeight);
  drawXAxisLabels(ctx, points, padding, chartWidth, height);
}

function drawBarChart(canvas, points, options) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 600;
  const height = canvas.clientHeight || 220;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);

  const padding = { top: 18, right: 18, bottom: 32, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  drawGrid(ctx, padding, chartWidth, chartHeight);

  if (!points.length) {
    drawEmptyText(ctx, width, height, `No ${options.label} data`);
    return;
  }

  const max = Math.max(...points.map((point) => point.value), 1);
  const barWidth = chartWidth / points.length;

  points.forEach((point, index) => {
    const barHeight = (point.value / max) * chartHeight;
    const x = padding.left + index * barWidth + 3;
    const y = padding.top + (chartHeight - barHeight);

    ctx.fillStyle = options.barColor;
    ctx.fillRect(x, y, Math.max(4, barWidth - 6), barHeight);
  });

  drawYAxisLabels(ctx, 0, max, padding, chartHeight);
  drawXAxisLabels(ctx, points, padding, chartWidth, height);
}

function drawGrid(ctx, padding, chartWidth, chartHeight) {
  ctx.strokeStyle = "#efe7da";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartWidth, y);
    ctx.stroke();
  }
}

function drawYAxisLabels(ctx, min, max, padding, chartHeight) {
  ctx.fillStyle = "#5e6f7b";
  ctx.font = "11px 'IBM Plex Mono', monospace";

  for (let i = 0; i <= 4; i += 1) {
    const value = max - ((max - min) / 4) * i;
    const y = padding.top + (chartHeight / 4) * i;
    ctx.fillText(numberFormat.format(value), 6, y + 4);
  }
}

function drawXAxisLabels(ctx, points, padding, chartWidth, height) {
  if (!points.length) {
    return;
  }

  ctx.fillStyle = "#6a7b87";
  ctx.font = "11px 'IBM Plex Mono', monospace";

  const desiredTicks = Math.min(5, points.length);
  const step = Math.max(1, Math.floor(points.length / desiredTicks));

  for (let i = 0; i < points.length; i += step) {
    const x = padding.left + (i / Math.max(1, points.length - 1)) * chartWidth;
    const label = points[i].label;
    ctx.fillText(label, x - 20, height - 10);
  }
}

function drawEmptyText(ctx, width, height, text) {
  ctx.fillStyle = "#728391";
  ctx.font = "13px 'Space Grotesk', sans-serif";
  ctx.fillText(text, width / 2 - 56, height / 2);
}

function aggregateByMinute(messages) {
  const map = new Map();

  messages.forEach((message) => {
    const date = new Date(message.timestamp);
    if (Number.isNaN(date.getTime())) {
      return;
    }

    const key = `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    map.set(key, (map.get(key) || 0) + 1);
  });

  const points = Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .slice(-20);

  return points;
}

function buildHeartbeatWaveform(heartbeats, windowMinutes) {
  const now = Date.now();
  const clampedWindowMinutes = Math.max(1, Math.min(60, windowMinutes));
  const windowStart = now - clampedWindowMinutes * 60 * 1000;

  const sentHeartbeats = heartbeats
    .filter((entry) => entry.phase === "sent")
    .map((entry) => new Date(entry.timestamp).getTime())
    .filter((timestamp) => !Number.isNaN(timestamp) && timestamp >= windowStart - 5000)
    .sort((a, b) => a - b);

  const points = [];
  const addPoint = (timestamp, value) => {
    if (timestamp < windowStart || timestamp > now) {
      return;
    }
    points.push({
      label: toTime(timestamp),
      value,
      timestamp,
    });
  };

  addPoint(windowStart, 0.1);

  sentHeartbeats.forEach((beatTs) => {
    addPoint(beatTs - 3500, 0.1);
    addPoint(beatTs - 900, 0.18);
    addPoint(beatTs - 220, 0.08);
    addPoint(beatTs - 70, 0.34);
    addPoint(beatTs, 2.4);
    addPoint(beatTs + 90, 0.35);
    addPoint(beatTs + 240, 0.12);
    addPoint(beatTs + 550, 0.23);
    addPoint(beatTs + 1200, 0.1);
  });

  addPoint(now, 0.1);

  points.sort((a, b) => a.timestamp - b.timestamp);

  const deduped = [];
  for (const point of points) {
    if (!deduped.length || deduped[deduped.length - 1].timestamp !== point.timestamp) {
      deduped.push(point);
    }
  }

  return deduped.map(({ label, value }) => ({ label, value }));
}

function getHeartbeatWindowMinutes() {
  const parsed = Number.parseFloat(dom.heartbeatWindowMinutes.value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10;
  }
  return Math.min(60, parsed);
}

function getHeartbeatRatePerMinute(heartbeats) {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;

  return heartbeats.filter((entry) => {
    if (entry.phase !== "sent") {
      return false;
    }
    const timestamp = new Date(entry.timestamp).getTime();
    return !Number.isNaN(timestamp) && timestamp >= oneMinuteAgo;
  }).length;
}

function toTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return timeFormat.format(date);
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.style.background = isError ? "#9f1d1d" : "#172b37";
  toast.textContent = message;
  dom.toastHost.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2800);
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed`);
  }
  return response.json();
}

async function postJson(url, payload) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        error: body?.error || `POST ${url} failed`,
      };
    }

    return body;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}
