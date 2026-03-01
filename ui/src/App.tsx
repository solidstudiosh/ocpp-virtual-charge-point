import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Activity, Zap, Play, Square, Server, ActivitySquare } from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  transactionId: string | number;
  connectorId: number;
  meterValue: number;
  status: string;
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
  const [urlBase] = useState(window.location.origin.includes('localhost') ? 'http://localhost:9999' : window.location.origin);

  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Initial fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusRes, msgRes] = await Promise.all([
          axios.get(`${urlBase}/api/status`),
          axios.get(`${urlBase}/api/messages`),
        ]);
        setTransactions(statusRes.data.transactions);
        setMessages(msgRes.data.reverse()); // ensure oldest first for trace view
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

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
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
        const statusRes = await axios.get(`${urlBase}/api/status`);
        setTransactions(statusRes.data.transactions);
      } catch (e) { }
    }, 2000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [urlBase]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Actions
  const handleAction = async (action: string, payload: any) => {
    try {
      await axios.post(`${urlBase}/api/execute`, { action, payload });
    } catch (err) {
      alert("Failed to execute action");
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
        <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700/50">
          <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${isConnected ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-red-500 shadow-red-500/50'}`} />
          <span className="text-sm font-medium">{isConnected ? 'WS Connected' : 'WS Offline'}</span>
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
                      <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Meter Value</span>
                          <span className="text-xl font-mono text-blue-400">{tx?.meterValue?.toFixed(2)} <span className="text-sm text-slate-500">kWh</span></span>
                        </div>
                        <Activity className="w-6 h-6 text-blue-500/50 animate-pulse" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="bg-slate-800/50 border-b border-slate-800 px-5 py-3 flex flex-col">
              <h2 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2">
                <ActivitySquare className="w-4 h-4 text-rose-400" /> Admin Commands
              </h2>
            </div>
            <div className="p-5 flex flex-col gap-3 bg-gradient-to-b from-slate-900 to-slate-950">
              <ActionPanel onAction={handleAction} activeTx={transactions} />
            </div>
          </div>

        </div>

        {/* Right Column: Message Trace */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col relative">
          <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-5 py-3 flex items-center justify-between absolute w-full top-0 z-20">
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Trace Viewer
            </h2>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${autoScroll ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              Auto-Scroll {autoScroll ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 pt-16 bg-[#0B1120] space-y-3 font-mono text-[13px]" onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            const isAtBottom = target.scrollHeight - target.scrollTop === target.clientHeight;
            if (!isAtBottom && autoScroll) setAutoScroll(false);
          }}>
            {messages.map((m, i) => (
              <MessageRow key={i} msg={m} />
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
