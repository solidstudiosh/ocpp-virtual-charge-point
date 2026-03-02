import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { AlertTriangle, BatteryCharging, Activity, Zap, Play, Square, Server, ActivitySquare, Shield, Key } from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  transactionId: string | number;
  connectorId: number;
  meterValue: number;
  status: string;
  soc?: number;
  smartChargingLimitW?: number;
  maxChargingRateW?: number;
}

interface OcppMessage {
  id?: number;
  timestamp: string;
  direction: 'IN' | 'OUT';
  messageType: number;
  messageId: string;
  action?: string;
  payload: any;
}

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [messages, setMessages] = useState<OcppMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [chaosMode, setChaosMode] = useState(false);
  const [urlBase] = useState(window.location.origin.includes('localhost') ? 'http://localhost:9999' : window.location.origin);

  const [endpoint, setEndpoint] = useState("");
  const [chargePointId, setChargePointId] = useState("");
  const [basicAuthPassword, setBasicAuthPassword] = useState("");
  const [clientCert, setClientCert] = useState("");
  const [clientKey, setClientKey] = useState("");
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'trace' | 'security'>('trace');

  const bottomRef = useRef<HTMLDivElement>(null);

  // Initial fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusRes, msgRes, configRes, chaosRes, secRes] = await Promise.all([
          axios.get(`${urlBase}/api/status`),
          axios.get(`${urlBase}/api/messages`),
          axios.get(`${urlBase}/api/config`),
          axios.get(`${urlBase}/api/chaos`),
          axios.get(`${urlBase}/api/security-events`),
        ]);
        setTransactions(statusRes.data.transactions);
        setMessages(msgRes.data.reverse()); // ensure oldest first for trace view
        setSecurityEvents(secRes.data.reverse());
        setEndpoint(configRes.data.endpoint);
        setChargePointId(configRes.data.chargePointId);
        setBasicAuthPassword(configRes.data.basicAuthPassword || "");
        setIsConnected(configRes.data.connectionStatus === "connected");
        setChaosMode(chaosRes.data.enabled);
      } catch (err) {
        console.error("Failed to fetch initial data", err);
      }
    };
    fetchData();
  }, [urlBase]);

  // WebSocket setup
  useEffect(() => {
    const wsUrl = urlBase.replace('http', 'ws');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => { /* connection status managed via api/config */ };
    ws.onclose = () => { /* connection status managed via api/config */ };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ocpp_log') {
          setMessages(prev => [...prev, msg.data].slice(-500)); // keep last 500
        }
      } catch (e) {
        // ignore
      }
    };

    // Polling for status updates since we only push logs
    const interval = setInterval(async () => {
      try {
        const [statusRes, configRes, chaosRes, secRes] = await Promise.all([
          axios.get(`${urlBase}/api/status`),
          axios.get(`${urlBase}/api/config`),
          axios.get(`${urlBase}/api/chaos`),
          axios.get(`${urlBase}/api/security-events`),
        ]);
        setTransactions(statusRes.data.transactions);
        setIsConnected(configRes.data.connectionStatus === "connected");
        setChaosMode(chaosRes.data.enabled);
        setSecurityEvents(secRes.data.reverse());
      } catch (e) { }
    }, 2000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [urlBase]);

  // Actions
  const handleAction = async (action: string, payload: any) => {
    try {
      await axios.post(`${urlBase}/api/execute`, { action, payload });
    } catch (err) {
      alert("Failed to execute action");
    }
  };

  const toggleConnection = async () => {
    try {
      if (isConnected) {
        await axios.post(`${urlBase}/api/disconnect`);
        setIsConnected(false);
      } else {
        const res = await axios.post(`${urlBase}/api/connect`, { endpoint, chargePointId, basicAuthPassword, clientCert, clientKey });
        if (res.data.success) {
          setIsConnected(true);
        } else {
          alert(`Failed to connect: ${res.data.error}`);
        }
      }
    } catch (e) {
      alert("Error toggling connection");
    }
  };

  const toggleChaosMode = async () => {
    try {
      const res = await axios.post(`${urlBase}/api/chaos`, { enabled: !chaosMode });
      setChaosMode(res.data.chaosMode);
    } catch (e) {
      alert("Error toggling chaos mode");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-2xl z-10">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/20 p-2 rounded-lg">
            <Zap className="text-emerald-400 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Virtual Charge Point Dashboard</h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Admin Control Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 bg-slate-800/50 p-1.5 rounded-lg border border-slate-700/50">
            <input
              className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm w-56 focus:border-indigo-500 focus:outline-none"
              placeholder="ws://localhost:3000"
              value={endpoint}
              onChange={e => setEndpoint(e.target.value)}
              disabled={isConnected}
            />
            <input
              className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm w-32 focus:border-indigo-500 focus:outline-none"
              placeholder="CP_ID"
              value={chargePointId}
              onChange={e => setChargePointId(e.target.value)}
              disabled={isConnected}
            />
            <input
              type="password"
              className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm w-32 focus:border-indigo-500 focus:outline-none"
              placeholder="Password"
              value={basicAuthPassword}
              onChange={e => setBasicAuthPassword(e.target.value)}
              disabled={isConnected}
            />
            <button
              onClick={toggleConnection}
              className={`px-4 py-1.5 rounded text-sm font-bold transition-colors ${isConnected ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
          <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700/50">
            <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${isConnected ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-red-500 shadow-red-500/50'}`} />
            <span className="text-sm font-medium">{isConnected ? 'WS Connected' : 'WS Offline'}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">

        {/* Left Column: Control Panel */}
        <div className="w-[450px] flex flex-col gap-6">

          {/* Connector Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="bg-slate-800/50 border-b border-slate-800 px-5 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-400" /> connectors
              </h2>
            </div>
            <div className="p-5 flex flex-col gap-4 bg-gradient-to-b from-slate-900 to-slate-950">
              {[1, 2].map(id => {
                const tx = transactions.find(t => t.connectorId === id);
                const isCharging = !!tx;
                return (
                  <div key={id} className={`p-4 rounded-xl border relative overflow-hidden transition-all duration-300 ${isCharging ? 'bg-blue-900/10 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'}`}>
                    {isCharging && <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />}
                    {!isCharging && <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />}

                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-white">Connector {id}</h3>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-1 ${isCharging ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                          {isCharging ? 'Charging' : 'Available'}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-950/50 rounded-lg">
                        <Zap className={`w-5 h-5 ${isCharging ? 'text-blue-400' : 'text-slate-500'}`} />
                      </div>
                    </div>

                    {isCharging && (
                      <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Meter Value</span>
                            <span className="text-xl font-mono text-blue-400">{(tx.meterValue / 1000).toFixed(2)} <span className="text-sm text-slate-500">kWh</span></span>
                          </div>
                          <Activity className="w-6 h-6 text-blue-500/50 animate-pulse" />
                        </div>
                        {tx.soc !== undefined && (
                          <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                            <div className="flex flex-col flex-1 mr-4 gap-1">
                              <div className="flex justify-between">
                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">EV Battery</span>
                                <span className="text-[10px] text-emerald-400 font-bold">{Math.round(tx.soc)}%</span>
                              </div>
                              <div className="w-full bg-slate-800 rounded-full h-1.5 relative overflow-hidden">
                                <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${Math.round(tx.soc)}%` }}></div>
                              </div>
                            </div>
                            <BatteryCharging className="w-6 h-6 text-emerald-500" />
                          </div>
                        )}
                        {tx.smartChargingLimitW !== undefined && tx.smartChargingLimitW < (tx.maxChargingRateW || 999999) && (
                          <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-orange-400 uppercase font-bold tracking-wider">Smart Charging Profile Limit</span>
                              <span className="text-sm font-mono text-orange-400">{tx.smartChargingLimitW} W</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="bg-slate-800/50 border-b border-slate-800 px-5 py-3 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2">
                <ActivitySquare className="w-4 h-4 text-rose-400" /> Admin Commands
              </h2>
              <div className="flex items-center justify-between bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${chaosMode ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-700 text-slate-400'}`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Chaos Mode</h3>
                    <p className="text-xs text-slate-400">Inject random hardware faults</p>
                  </div>
                </div>
                <button
                  onClick={toggleChaosMode}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${chaosMode ? 'bg-rose-500' : 'bg-slate-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${chaosMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
            <div className="p-5 flex flex-col gap-3 bg-gradient-to-b from-slate-900 to-slate-950">
              <ActionPanel onAction={handleAction} activeTx={transactions} />
            </div>
          </div>

          {/* Security & Certificates */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="bg-slate-800/50 border-b border-slate-800 px-5 py-3 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" /> Security Controls
              </h2>
            </div>
            <div className="p-5 flex flex-col gap-3 bg-gradient-to-b from-slate-900 to-slate-950">
              <div className="flex flex-col gap-1.5 text-xs text-slate-400 font-medium">
                Client Certificate
                <textarea
                  value={clientCert}
                  onChange={e => setClientCert(e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----"
                  className="bg-slate-950 border border-slate-800 rounded-md p-2 text-slate-200 outline-none focus:border-indigo-500 transition-colors h-16 font-mono text-[10px]"
                />
              </div>
              <div className="flex flex-col gap-1.5 text-xs text-slate-400 font-medium">
                Private Key
                <textarea
                  value={clientKey}
                  onChange={e => setClientKey(e.target.value)}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----"
                  className="bg-slate-950 border border-slate-800 rounded-md p-2 text-slate-200 outline-none focus:border-indigo-500 transition-colors h-16 font-mono text-[10px]"
                />
              </div>
              <button
                onClick={async () => {
                  try {
                    await axios.post(`${urlBase}/api/trigger-csr`);
                    alert("Certificate Signing Request (CSR) triggered. Ensure connected to CSMS.");
                  } catch (e) {
                    alert("Failed to trigger CSR");
                  }
                }}
                className="mt-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-600/30 py-2 rounded-lg text-sm flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" /> Trigger Certificate Renewal (CSR)
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Message Trace & Security Events */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col relative">
          <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-5 py-3 flex items-center justify-between z-20 shrink-0">
            <div className="flex gap-4">
              <h2
                className={`text-sm font-semibold tracking-wide uppercase flex items-center gap-2 cursor-pointer ${activeTab === 'trace' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                onClick={() => setActiveTab('trace')}
              >
                <Activity className={`w-4 h-4 ${activeTab === 'trace' ? 'text-emerald-400' : 'text-slate-500'}`} /> Trace Viewer
              </h2>
              <h2
                className={`text-sm font-semibold tracking-wide uppercase flex items-center gap-2 cursor-pointer ${activeTab === 'security' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                onClick={() => setActiveTab('security')}
              >
                <Shield className={`w-4 h-4 ${activeTab === 'security' ? 'text-indigo-400' : 'text-slate-500'}`} /> Security Events
              </h2>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 bg-[#0B1120] space-y-3 font-mono text-[13px]">
            {activeTab === 'trace' && messages.map((m, i) => (
              <MessageRow key={i} msg={m} />
            ))}
            {activeTab === 'security' && securityEvents.map((evt, i) => (
              <div key={i} className="rounded-xl border border-rose-900/50 overflow-hidden bg-rose-950/20 p-4 shrink-0 shadow-[0_0_10px_rgba(225,29,72,0.1)]">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-slate-500 shrink-0">{format(new Date(evt.timestamp), 'HH:mm:ss')}</span>
                  <span className="text-rose-400 font-bold px-2 py-0.5 rounded bg-rose-500/20 text-xs tracking-wider border border-rose-500/30">{evt.type}</span>
                </div>
                <div className="text-slate-300 whitespace-pre-wrap">{evt.message}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

      </main>
    </div>
  );
}

function ActionPanel({ onAction, activeTx }: { onAction: any, activeTx: Transaction[] }) {
  const [conId, setConId] = useState("1");
  const [idTag, setIdTag] = useState("DEADBEEF");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-xs text-slate-400 font-medium">
          Connector ID
          <select value={conId} onChange={e => setConId(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-md p-2 text-slate-200 outline-none focus:border-indigo-500 transition-colors">
            <option value="1">Connector 1</option>
            <option value="2">Connector 2</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-slate-400 font-medium">
          RFID Tag
          <input value={idTag} onChange={e => setIdTag(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-md p-2 text-slate-200 outline-none focus:border-indigo-500 uppercase transition-colors" />
        </label>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => onAction("Authorize", { idTag })}
          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-lg text-sm border border-slate-700 flex items-center justify-center gap-2"
        >
          Auth
        </button>
        <button
          onClick={() => onAction("StartTransaction", { connectorId: parseInt(conId), idTag, meterStart: 0, timestamp: new Date().toISOString() })}
          className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/30 py-2 rounded-lg text-sm flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4" /> Start
        </button>
        <button
          onClick={() => {
            const tx = activeTx.find(t => t.connectorId === parseInt(conId));
            if (!tx) return alert("No active transaction on this connector");
            onAction("StopTransaction", { transactionId: tx.transactionId, meterStop: Math.floor(tx.meterValue), timestamp: new Date().toISOString(), idTag });
          }}
          className="flex-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-600/30 py-2 rounded-lg text-sm flex items-center justify-center gap-2"
        >
          <Square className="w-4 h-4" /> Stop
        </button>
      </div>
    </div>
  );
}

function MessageRow({ msg }: { msg: OcppMessage }) {
  const isRes = msg.messageType === 3;
  const isErr = msg.messageType === 4;

  const [expanded, setExpanded] = useState(false);

  let badgeColor = "bg-slate-700 text-slate-300";
  let dirIcon = "→";

  if (msg.direction === 'IN') {
    badgeColor = "bg-sky-500/20 text-sky-400 border-sky-500/30";
    dirIcon = "↓ IN";
  } else {
    badgeColor = "bg-amber-500/20 text-amber-400 border-amber-500/30";
    dirIcon = "↑ OUT";
  }

  let shadow = "";
  if (isErr) {
    badgeColor = "bg-rose-500/20 text-rose-400 border-rose-500/30";
    shadow = "shadow-[0_0_10px_rgba(225,29,72,0.1)] border-rose-900/50 block bg-rose-950/20";
  }

  return (
    <div className={`rounded-xl border border-slate-800/60 overflow-hidden cursor-pointer bg-slate-900/40 hover:bg-slate-800/60 transition-colors ${shadow}`} onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center gap-3 p-3">
        <span className="text-slate-500 shrink-0 w-[85px]">{format(new Date(msg.timestamp), 'HH:mm:ss.SSS')}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 w-[55px] text-center ${badgeColor}`}>
          {dirIcon}
        </span>
        <span className="text-indigo-400 shrink-0 w-[25px] text-center font-bold">[{msg.messageType}]</span>
        <div className="flex-1 truncate">
          <span className="text-slate-200 font-semibold mr-3">{msg.action || (isRes ? "CallResult" : "CallError")}</span>
          <span className="text-slate-500 text-xs">ID: {msg.messageId}</span>
        </div>
      </div>
      {expanded && (
        <div className="bg-[#0f172a] p-4 border-t border-slate-800">
          <pre className="text-emerald-300/80 whitespace-pre-wrap break-all leading-relaxed">
            {JSON.stringify(msg.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
