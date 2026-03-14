import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Banknote, CreditCard, Smartphone, BookOpen, Wallet,
  AlertTriangle, Users, ShoppingBag, Wifi, WifiOff, RefreshCw
} from "lucide-react";
import API_URL from "../../../config/api";

// ─── Mapping ALL imported Lucide icons ──────────────────────────────────────
const EVENT_CONFIG = {
  PAYMENT: { color: "bg-emerald-500",  textColor: "text-emerald-400",  icon: <Banknote size={12}/> },
  CREDIT:  { color: "bg-purple-500",   textColor: "text-purple-400",   icon: <BookOpen size={12}/> },
  SHIFT:   { color: "bg-yellow-500",   textColor: "text-yellow-400",   icon: <RefreshCw size={12}/> }, // Used RefreshCw for shift cycles
  STAFF:   { color: "bg-blue-500",     textColor: "text-blue-400",     icon: <Users size={12}/> },
  ORDER:   { color: "bg-cyan-500",     textColor: "text-cyan-400",     icon: <ShoppingBag size={12}/> },
  PETTY:   { color: "bg-rose-500",     textColor: "text-rose-400",     icon: <Wallet size={12}/> },
  VOID:    { color: "bg-orange-500",   textColor: "text-orange-400",   icon: <AlertTriangle size={12}/> },
  CARD:    { color: "bg-indigo-500",   textColor: "text-indigo-400",   icon: <CreditCard size={12}/> },
  MOMO:    { color: "bg-amber-500",    textColor: "text-amber-400",    icon: <Smartphone size={12}/> },
  DEFAULT: { color: "bg-zinc-500",     textColor: "text-zinc-400",     icon: <ShoppingBag size={12}/> },
};

function getConfig(type) {
  const t = type?.toUpperCase();
  if (t?.includes("CASH") || t?.includes("PAYMENT")) return EVENT_CONFIG.PAYMENT;
  if (t?.includes("CARD")) return EVENT_CONFIG.CARD;
  if (t?.includes("MOMO") || t?.includes("MTN") || t?.includes("AIRTEL")) return EVENT_CONFIG.MOMO;
  return EVENT_CONFIG[t] || EVENT_CONFIG.DEFAULT;
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 5)     return "just now";
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

const MAX_LOGS = 50;

export default function LiveLogs({ dark, t }) {
  const [logs,      setLogs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [connected, setConnected] = useState(false);
  const [filter,    setFilter]    = useState("ALL");
  const [newIds,    setNewIds]    = useState(new Set());
  const esRef       = useRef(null);
  const [tick,      setTick]      = useState(0);

  // Time refresher
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/overview/logs?limit=30`);
      if (res.ok) {
        const rows = await res.json();
        setLogs(rows);
      }
    } catch (e) { console.error("Initial fetch failed:", e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadInitial();

    const connect = () => {
      // Close existing if any
      if (esRef.current) esRef.current.close();

      const es = new EventSource(`${API_URL}/api/overview/stream`);
      esRef.current = es;

      es.onopen = () => setConnected(true);

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === 'CONNECTED' || event.message === 'heartbeat') return;

          setLogs(prev => {
            // Prevent duplicate entries if streaming same data as initial fetch
            if (prev.find(p => p.id === event.id)) return prev;
            return [event, ...prev].slice(0, MAX_LOGS);
          });

          setNewIds(prev => new Set(prev).add(event.id));
          setTimeout(() => {
            setNewIds(prev => {
              const next = new Set(prev);
              next.delete(event.id);
              return next;
            });
          }, 2000);
        } catch (err) { console.error("Stream parse error"); }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        setTimeout(connect, 5000); 
      };
    };

    connect();
    return () => esRef.current?.close();
  }, [loadInitial]);

  const filteredLogs = filter === "ALL" ? logs : logs.filter(l => l.type?.toUpperCase() === filter);
  const filterTypes = ["ALL", "PAYMENT", "ORDER", "CREDIT", "SHIFT", "PETTY", "STAFF"];

  return (
    <div className="flex flex-col h-full font-sans">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${dark ? "bg-zinc-800" : "bg-zinc-100"}`}>
            {connected ? <Wifi size={14} className="text-emerald-500" /> : <WifiOff size={14} className="text-rose-500" />}
          </div>
          <h3 className={`text-xs font-black uppercase italic tracking-widest ${t?.subtext || "text-zinc-400"}`}>
            Live Activity
          </h3>
        </div>
        <div className="flex items-center gap-2">
           {connected && <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />}
           <span className={`text-[10px] font-black uppercase tracking-tighter ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
             {logs.length} Events
           </span>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-1.5 flex-wrap mb-4 shrink-0">
        {filterTypes.map(ft => (
          <button key={ft} onClick={() => setFilter(ft)}
            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all
              ${filter === ft 
                ? "bg-yellow-500 text-black shadow-lg" 
                : dark ? "bg-zinc-900 text-zinc-500 hover:text-zinc-300" : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"}`}>
            {ft}
          </button>
        ))}
      </div>

      {/* ── Logs Container ── */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
            <RefreshCw size={24} className="animate-spin text-zinc-500" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Waking up streams...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-30 grayscale">
            <ShoppingBag size={40} className="mb-2" />
            <p className="text-[10px] font-black uppercase">No activity logged today</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const cfg = getConfig(log.type);
            const isNew = newIds.has(log.id);

            return (
              <div key={log.id}
                className={`flex items-start gap-3 p-4 rounded-2xl border transition-all duration-700
                  ${isNew 
                    ? "bg-yellow-500/20 border-yellow-500/50 scale-[1.02] shadow-xl z-10" 
                    : dark ? "bg-zinc-900/40 border-white/5 hover:border-white/10" : "bg-white border-zinc-100 shadow-sm"}`}>
                
                {/* Icon Column */}
                <div className={`p-2.5 rounded-xl shrink-0 ${cfg.color} bg-opacity-10 ${cfg.textColor} border border-current border-opacity-20`}>
                  {cfg.icon}
                </div>

                {/* Content Column */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <p className={`text-[11px] font-bold leading-relaxed mb-1 ${dark ? "text-zinc-100" : "text-zinc-800"}`}>
                      {log.message}
                    </p>
                  </div>
                  
                  <div className="flex-1 min-w-0">
  <div className="flex justify-between items-start gap-2">
    <p className={`text-[11px] font-bold leading-relaxed mb-1 ${dark ? "text-zinc-100" : "text-zinc-800"}`}>
      {log.message}
    </p>
  </div>
  
  <div className="flex items-center gap-3">
    <span className={`text-[8px] font-black uppercase tracking-widest ${cfg.textColor}`}>
      {log.type}
    </span>
    <span className="w-1 h-1 rounded-full bg-zinc-700" />
    <span className={`text-[8px] font-bold uppercase ${dark ? "text-zinc-600" : "text-zinc-400"}`}>
      {/* This line is the magic fix for the Waiter Name */}
      {log.staff_name || log.actor || "System"} 
    </span>
    <span className={`text-[8px] ml-auto font-medium ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
      {timeAgo(log.created_at)}
    </span>
  </div>
</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}