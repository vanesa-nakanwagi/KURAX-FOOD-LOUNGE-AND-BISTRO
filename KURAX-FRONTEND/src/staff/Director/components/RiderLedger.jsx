import React, { useState, useEffect, useCallback } from "react";
import {
  Bike, ChevronDown, ChevronUp, RefreshCw,
  Phone, MapPin, Clock, CheckCircle2, Package,
  AlertTriangle, ChevronLeft, ChevronRight
} from "lucide-react";
import API_URL from "../../../config/api";

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS = {
  pending:   { label: "Pending",    color: "text-yellow-700",  bg: "bg-yellow-50 border-yellow-200"  },
  out:       { label: "On the Way", color: "text-orange-700",  bg: "bg-orange-50 border-orange-200"  },
  delivered: { label: "Delivered",  color: "text-blue-700",    bg: "bg-blue-50 border-blue-200"    },
  paid:      { label: "Paid ✓",     color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  collected: { label: "Collected",  color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
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

function kampalaToday() {
  const now = new Date();
  const offset = 3 * 60 * 60 * 1000;
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

export default function RiderLedger() {
  const [date,     setDate]     = useState(kampalaToday());
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
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
  const totalPaid      = ledger.reduce((s, r) => s + Number(r.paid_orders || 0), 0);

  return (
    <div className="space-y-4">
      {/* Date Navigator */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-0.5">Delivery</p>
          <h3 className="text-xl font-black uppercase italic text-gray-900">Rider Ledger</h3>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setDate(prevDay(date))} 
            className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all"
          >
            <ChevronLeft size={14}/>
          </button>
          <div className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-black uppercase tracking-widest text-gray-800">
            {isToday ? "Today" : fmtDate(date)}
          </div>
          <button 
            onClick={() => setDate(nextDay(date))} 
            disabled={isToday} 
            className={`p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all ${isToday ? "opacity-30 cursor-not-allowed" : ""}`}
          >
            <ChevronRight size={14}/>
          </button>
          <button 
            onClick={load} 
            className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""}/>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {!loading && ledger.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Total Orders",    value: totalOrders,    color: "text-gray-600" },
            { label: "Completed",       value: totalPaid,      color: "text-emerald-600" },
            { label: "Total Collected", value: `UGX ${Number(totalCollected).toLocaleString()}`, color: "text-yellow-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">{label}</p>
              <p className={`text-lg font-black italic ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Rider Rows */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse"/>)}
        </div>
      ) : ledger.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl py-14 text-center">
          <Package size={28} className="mx-auto mb-3 opacity-30 text-gray-400"/>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 opacity-60">
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
              <div key={rider.rider_id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <button 
                  onClick={() => toggleRider(rider.rider_id)} 
                  className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-yellow-50/50 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shrink-0 bg-yellow-100 text-yellow-700">
                      {(rider.rider_name || "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black uppercase italic text-gray-900 truncate">{rider.rider_name}</p>
                      <span className="text-[9px] font-bold text-gray-500">{totalCnt} orders</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Collected</p>
                      <p className="text-sm font-black italic text-emerald-600">UGX {collected.toLocaleString()}</p>
                    </div>
                    {pending > 0 && (
                      <div className="text-right hidden sm:block">
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Outstanding</p>
                        <p className="text-sm font-black italic text-orange-600">UGX {pending.toLocaleString()}</p>
                      </div>
                    )}
                    <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-black 
                      ${pctDone === 100 
                        ? "text-emerald-600 border-emerald-200 bg-emerald-50" 
                        : "text-gray-500 border-gray-200 bg-gray-50"}`}>
                      {pctDone}%
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-gray-500"/> : <ChevronDown size={16} className="text-gray-500"/>}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-200">
                    {rider.orders.map(order => {
                      const st = STATUS[order.delivery_status] || STATUS.pending;
                      return (
                        <div key={order.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-xs items-center hover:bg-gray-50 transition-all">
                          <div className="col-span-4 font-black truncate text-gray-900">{order.client_name}</div>
                          <div className="col-span-3">
                            <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase ${st.bg} ${st.color}`}>
                              {st.label}
                            </span>
                          </div>
                          <div className="col-span-5 text-right font-black italic text-gray-500">
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