let currentStatus = 'Available';
let cablePlugged = false;
let transactionActive = false;
let meterTotal = 0;
let meterInterval = null;

function updateButtons() {
  const hasIdTag = document.getElementById('idTag').value.trim() !== '';
  document.getElementById('btnPlug').disabled = cablePlugged;
  document.getElementById('btnUnplug').disabled = !cablePlugged || transactionActive;
  document.getElementById('btnStart').disabled = !cablePlugged || transactionActive || !hasIdTag;
  document.getElementById('btnStop').disabled = !transactionActive;
}

function getConfig() {
  return {
    connectorId: parseInt(document.getElementById('connectorId').value) || 1,
    idTag: document.getElementById('idTag').value || 'AABBCCDD',
    transactionId: parseInt(document.getElementById('transactionId').value) || 1,
  };
}

function updatePowerLabel() {
  const val = parseFloat(document.getElementById('powerSlider').value);
  document.getElementById('powerValue').textContent = val.toFixed(1) + ' kW';
}

function updateStatus(status, detail) {
  currentStatus = status;
  document.getElementById('statusDot').className = 'dot ' + status.toLowerCase();
  document.getElementById('statusText').textContent = status;
  if (detail) document.getElementById('statusDetail').textContent = detail;
}

function log(msg, ok) {
  const el = document.getElementById('log');
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = ok ? 'ok' : (ok === false ? 'error' : '');
  entry.innerHTML = '<span class="time">' + time + '</span> ' + msg;
  el.prepend(entry);
  if (el.children.length > 100) el.removeChild(el.lastChild);
}

async function exec(action, payload) {
  try {
    const res = await fetch('/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });
    if (res.ok) {
      log(action + ' OK', true);
    } else {
      log(action + ' FAIL ' + res.status, false);
    }
  } catch (e) {
    log(action + ' ERR ' + e.message, false);
  }
}

async function plugCable() {
  const { connectorId } = getConfig();
  await exec('StatusNotification', {
    connectorId, errorCode: 'NoError', status: 'Preparing',
    timestamp: new Date().toISOString(),
  });
  cablePlugged = true;
  updateStatus('Preparing', 'connector ' + connectorId + ' - cable connected');
  updateButtons();
}

async function unplugCable() {
  const { connectorId } = getConfig();
  if (transactionActive) await stopTransaction();
  await exec('StatusNotification', {
    connectorId, errorCode: 'NoError', status: 'Available',
    timestamp: new Date().toISOString(),
  });
  cablePlugged = false;
  updateStatus('Available', 'connector ' + connectorId + ' - idle');
  updateButtons();
}

async function startTransaction() {
  const { connectorId, idTag } = getConfig();
  await exec('StatusNotification', {
    connectorId, errorCode: 'NoError', status: 'Charging',
    timestamp: new Date().toISOString(),
  });
  await exec('StartTransaction', {
    connectorId, idTag, meterStart: 0,
    timestamp: new Date().toISOString(),
  });
  transactionActive = true;
  meterTotal = 0;
  updateStatus('Charging', 'connector ' + connectorId + ' - ' + idTag);
  updateButtons();
  if (meterInterval) clearInterval(meterInterval);
  meterInterval = setInterval(() => sendMeterValues(), 15000);
}

async function stopTransaction() {
  const { connectorId, transactionId } = getConfig();
  if (meterInterval) { clearInterval(meterInterval); meterInterval = null; }
  await exec('StopTransaction', {
    transactionId, timestamp: new Date().toISOString(),
    meterStop: Math.round(meterTotal * 1000),
  });
  await exec('StatusNotification', {
    connectorId, errorCode: 'NoError', status: 'Finishing',
    timestamp: new Date().toISOString(),
  });
  transactionActive = false;
  updateStatus('Finishing', 'connector ' + connectorId + ' - done');
  updateButtons();
}

async function sendMeterValues() {
  const { connectorId, transactionId } = getConfig();
  const power = parseFloat(document.getElementById('powerSlider').value);
  meterTotal += power * (15 / 3600);
  await exec('MeterValues', {
    connectorId, transactionId,
    meterValue: [{
      timestamp: new Date().toISOString(),
      sampledValue: [
        { value: String(power), measurand: 'Power.Active.Import', unit: 'kW' },
        { value: meterTotal.toFixed(6), measurand: 'Energy.Active.Import.Register', unit: 'kWh' },
      ],
    }],
  });
  if (transactionActive) {
    document.getElementById('statusDetail').textContent =
      'connector ' + connectorId + ' - ' + power.toFixed(1) + ' kW / ' + meterTotal.toFixed(3) + ' kWh';
  }
}

async function authorize() {
  const { idTag } = getConfig();
  await exec('Authorize', { idTag });
}

async function setFaulted() {
  const { connectorId } = getConfig();
  await exec('StatusNotification', {
    connectorId, errorCode: 'InternalError', status: 'Faulted',
    timestamp: new Date().toISOString(),
  });
  updateStatus('Faulted', 'connector ' + connectorId + ' - error');
}

async function setStatus(status) {
  const { connectorId } = getConfig();
  await exec('StatusNotification', {
    connectorId, errorCode: 'NoError', status,
    timestamp: new Date().toISOString(),
  });
  updateStatus(status, 'connector ' + connectorId);
}

document.getElementById('idTag').addEventListener('input', updateButtons);

fetch('/info').then(r => r.json()).then(data => {
  document.getElementById('info').innerHTML =
    '<tr><td>endpoint</td><td>' + data.endpoint + '</td></tr>' +
    '<tr><td>charge point</td><td>' + data.chargePointId + '</td></tr>' +
    '<tr><td>ocpp version</td><td>' + data.ocppVersion + '</td></tr>';
}).catch(() => {});
