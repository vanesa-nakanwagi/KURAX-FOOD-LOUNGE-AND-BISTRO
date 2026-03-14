import React, { useState, useEffect, useCallback } from "react";
import {
  Bike, ChevronDown, ChevronUp, RefreshCw,
  Phone, MapPin, Clock, CheckCircle2, Package,
  AlertTriangle, ChevronLeft, ChevronRight
} from "lucide-react";
import API_URL from "../../../config/api";

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS = {
  pending:   { label: "Pending",    color: "text-yellow-400",  bg: "bg-yellow-500/10  border-yellow-500/20"  },
  out:       { label: "On the Way", color: "text-orange-400",  bg: "bg-orange-500/10  border-orange-500/20"  },
  delivered: { label: "Delivered",  color: "text-blue-400",    bg: "bg-blue-500/10    border-blue-500/20"    },
  paid:      { label: "Paid ✓",     color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  // FIXED: Added 'collected' so the UI recognizes when the Cashier has the money.
  collected: { label: "Collected",  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
};

function fmtTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

// FIXED: Use a more robust date string to ensure the frontend and backend 
// don't "slip" a day due to timezone offsets.
function kampalaToday() {
  const now = new Date();
  const offset = 3 * 60 * 60 * 1000; // EAT is UTC+3
  const eatNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + offset);
  return eatNow.toISOString().split("T")[0];
}

function prevDay(d) {
  const dt = new Date(d); dt.setDate(dt.getDate() - 1);
  return dt.toISOString().split("T")[0];
}

function nextDay(d) {
  const dt = new Date(d); dt.setDate(dt.getDate() + 1);
  return dt.toISOString().split("T")[0];
}

export default function RiderLedger({ dark = true, t = {} }) {
  const [date,     setDate]     = useState(kampalaToday());
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState({});

  const card  = dark ? "bg-white/3 border-white/8"      : "bg-zinc-50 border-zinc-200";
  const sub   = dark ? "text-zinc-500"                   : "text-zinc-400";
  const text  = dark ? "text-white"                      : "text-zinc-800";
  const rowBg = dark ? "bg-white/2 hover:bg-white/5"     : "bg-white hover:bg-zinc-50";
  const divider = dark ? "divide-white/5"                : "divide-zinc-100";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Ensure we pass the date string to the backend
      const res  = await fetch(`${API_URL}/api/delivery/rider-ledger?date=${date}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Ledger fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const toggleRider = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  const isToday     = date === kampalaToday();

  const ledger      = data?.ledger || [];
  const totalCollected = ledger.reduce((s, r) => s + Number(r.collected || 0), 0);
  const totalOrders    = ledger.reduce((s, r) => s + Number(r.total_orders || 0), 0);
  
  // FIXED: Total paid orders should include both 'paid' (by client) and 'collected' (by lounge)
  const totalPaid      = ledger.reduce((s, r) => s + Number(r.paid_orders || 0), 0);

  return (
    <div className="space-y-4">
      {/* Date Navigator (unchanged logic, improved stability) */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${sub} mb-0.5`}>Delivery</p>
          <h3 className={`text-xl font-black uppercase italic ${text}`}>Rider Ledger</h3>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setDate(prevDay(date))} className={`p-2 rounded-xl border transition-all ${dark ? "bg-white/5 border-white/10 text-zinc-400 hover:text-white" : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-700"}`}>
            <ChevronLeft size={14}/>
          </button>
          <div className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest ${dark ? "bg-white/5 border-white/10 text-white" : "bg-white border-zinc-200 text-zinc-800"}`}>
            {isToday ? "Today" : fmtDate(date)}
          </div>
          <button onClick={() => setDate(nextDay(date))} disabled={isToday} className={`p-2 rounded-xl border transition-all ${isToday ? "opacity-30 cursor-not-allowed" : ""} ${dark ? "bg-white/5 border-white/10 text-zinc-400 hover:text-white" : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-700"}`}>
            <ChevronRight size={14}/>
          </button>
          <button onClick={load} className={`p-2 rounded-xl border transition-all ${dark ? "bg-white/5 border-white/10 text-zinc-400 hover:text-white" : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-700"}`}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""}/>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {!loading && ledger.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Total Orders",    value: totalOrders,    color: sub },
            { label: "Completed",       value: totalPaid,      color: "text-emerald-400" },
            { label: "Total Collected", value: `UGX ${Number(totalCollected).toLocaleString()}`, color: "text-yellow-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className={`${card} border rounded-2xl px-4 py-3`}>
              <p className={`text-[9px] font-black uppercase tracking-widest ${sub} mb-1`}>{label}</p>
              <p className={`text-lg font-black italic ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Rider Rows */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className={`h-20 rounded-2xl ${dark ? "bg-white/5" : "bg-zinc-100"} animate-pulse`}/>)}
        </div>
      ) : ledger.length === 0 ? (
        <div className={`${card} border rounded-2xl py-14 text-center`}>
          <Package size={28} className={`mx-auto mb-3 opacity-30 ${sub}`}/>
          <p className={`text-[10px] font-black uppercase tracking-widest ${sub} opacity-60`}>
            No deliveries recorded for {isToday ? "today" : fmtDate(date)}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ledger.map(rider => {
            const isOpen    = expanded[rider.rider_id];
            const collected = Number(rider.collected    || 0);
            const gross     = Number(rider.gross_total  || 0);
            const pending   = gross - collected;
            const paidCnt   = Number(rider.paid_orders  || 0);
            const totalCnt  = Number(rider.total_orders || 0);
            const pctDone   = totalCnt > 0 ? Math.round((paidCnt / totalCnt) * 100) : 0;

            return (
              <div key={rider.rider_id} className={`${card} border rounded-2xl overflow-hidden`}>
                <button onClick={() => toggleRider(rider.rider_id)} className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-white/3 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shrink-0 ${dark ? "bg-orange-500/15 text-orange-400" : "bg-orange-50 text-orange-500"}`}>
                      {(rider.rider_name || "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-black uppercase italic ${text} truncate`}>{rider.rider_name}</p>
                      <span className={`text-[9px] font-bold ${sub}`}>{totalCnt} orders</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className={`text-[9px] font-black uppercase tracking-widest ${sub}`}>Collected</p>
                      <p className="text-sm font-black italic text-emerald-400">UGX {collected.toLocaleString()}</p>
                    </div>
                    {pending > 0 && (
                      <div className="text-right hidden sm:block">
                        <p className={`text-[9px] font-black uppercase tracking-widest ${sub}`}>Outstanding</p>
                        <p className="text-sm font-black italic text-orange-400">UGX {pending.toLocaleString()}</p>
                      </div>
                    )}
                    <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-black ${pctDone === 100 ? "text-emerald-400 border-emerald-500/20" : "text-zinc-400 border-white/10"}`}>
                      {pctDone}%
                    </div>
                    {isOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                  </div>
                </button>

                {isOpen && (
                  <div className={`border-t ${dark ? "border-white/5" : "border-zinc-100"}`}>
                    {rider.orders.map(order => {
                      // FIXED: This now properly finds 'collected' status in the config
                      const st = STATUS[order.delivery_status] || STATUS.pending;
                      return (
                        <div key={order.id} className={`grid grid-cols-12 gap-2 px-4 py-3 text-xs items-center ${rowBg}`}>
                          <div className="col-span-4 font-black truncate ${text}">{order.client_name}</div>
                          <div className="col-span-3">
                            <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase ${st.bg} ${st.color}`}>
                              {st.label}
                            </span>
                          </div>
                          <div className="col-span-5 text-right font-black italic text-zinc-400">
                            UGX {Number(order.total || 0).toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}