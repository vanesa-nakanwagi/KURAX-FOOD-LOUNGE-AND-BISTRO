import React, { useState, useEffect, useCallback } from "react";
import { Bike, Phone, MapPin, Clock, CheckCircle2, Send, RefreshCw, Package, AlertTriangle, X } from "lucide-react";
import API_URL from "../../config/api";

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS = {
  pending:   { label: "Pending Dispatch", color: "text-yellow-400",  bg: "bg-yellow-500/10  border-yellow-500/20",  dot: "bg-yellow-400" },
  out:       { label: "Out for Delivery", color: "text-orange-400",  bg: "bg-orange-500/10  border-orange-500/20",  dot: "bg-orange-400 animate-pulse" },
  delivered: { label: "Delivered",        color: "text-blue-400",    bg: "bg-blue-500/10    border-blue-500/20",    dot: "bg-blue-400" },
  collected: { label: "Paid ✓",           color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
};

function timeAgo(ts) {
  if (!ts) return "—";
  const mins = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export default function DeliveriesPanel({ dark = true, t = {}, role = "DIRECTOR" }) {
  const [orders,  setOrders]  = useState([]);
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const card = dark ? "bg-white/3 border-white/8" : "bg-zinc-50 border-zinc-100";
  const sub  = dark ? "text-zinc-500"       : "text-zinc-400";

  // ─── FETCHING LOGIC ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [oRes, sRes] = await Promise.all([
        fetch(`${API_URL}/api/delivery/orders`),
        fetch(`${API_URL}/api/delivery/stats`),
      ]);
      if (oRes.ok) {
        const data = await oRes.json();
        setOrders(Array.isArray(data) ? data : []);
      }
      if (sRes.ok) setStats(await sRes.json());
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 10000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // ─── ACTION HANDLERS ────────────────────────────────────────────────────────
  const handleDispatch = async (orderId) => {
    try {
      const res = await fetch(`${API_URL}/api/delivery/orders/${orderId}/dispatch`, { method: "PATCH" });
      if (res.ok) fetchAll();
    } catch (err) { console.error(err); }
    setSelected(null);
  };

  const handleMarkDelivered = async (orderId) => {
    try {
      const res = await fetch(`${API_URL}/api/delivery/orders/${orderId}/delivered`, { method: "PATCH" });
      if (res.ok) fetchAll();
    } catch (err) { console.error(err); }
    setSelected(null);
  };

  // ─── FILTERING (Case Insensitive) ──────────────────────────────────────────
  const active = orders.filter(o => 
    ["pending", "out", "delivered"].includes(o.delivery_status?.toLowerCase())
  );
  
  const history = orders.filter(o => 
    o.delivery_status?.toLowerCase() === "collected" || o.status === "Paid"
  );

  return (
    <div className="space-y-4">
      {/* 1. Stat bar - USES OPTIONAL CHAINING TO PREVENT CRASHES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pending",     value: stats?.pending_assignment || 0, color: "text-yellow-400" },
          { label: "On the Road", value: stats?.out_for_delivery || 0,   color: "text-orange-400" },
          { label: "Delivered",   value: stats?.delivered_unpaid || 0,   color: "text-blue-400"   },
          { label: "Revenue",     value: `UGX ${Number(stats?.revenue || 0).toLocaleString()}`, color: "text-emerald-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`${card} border rounded-2xl px-4 py-3`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${sub} mb-1`}>{label}</p>
            <p className={`text-lg font-black italic ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* 2. Active deliveries */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className={`text-[10px] font-black uppercase tracking-widest ${sub}`}>
            Active Deliveries {active.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400">{active.length}</span>}
          </p>
          <button onClick={fetchAll} className={`p-1.5 rounded-lg ${dark ? "hover:bg-white/5" : "hover:bg-zinc-100"} transition-all`}>
            <RefreshCw size={13} className={sub}/>
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className={`h-20 rounded-2xl ${dark ? "bg-white/5" : "bg-zinc-100"} animate-pulse`}/>)}
          </div>
        ) : active.length === 0 ? (
          <div className={`${card} border rounded-2xl py-12 text-center`}>
            <Package size={28} className={`mx-auto ${sub} mb-3 opacity-40`}/>
            <p className={`text-[10px] font-black uppercase tracking-widest ${sub} opacity-60`}>No active deliveries</p>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map(order => {
              const currentStatus = order.delivery_status?.toLowerCase() || 'pending';
              const st = STATUS[currentStatus] || STATUS.pending;
              const elapsed = order.dispatched_at ? Math.floor((Date.now() - new Date(order.dispatched_at)) / 60000) : null;
              const isLate  = elapsed !== null && elapsed > 60;
              
              return (
                <div key={order.id}
                  onClick={() => setSelected(order)}
                  className={`${card} border rounded-2xl p-4 cursor-pointer transition-all hover:border-orange-500/30 active:scale-[0.99]
                    ${isLate ? "border-red-500/30" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${st.bg} ${st.color}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>
                          {st.label}
                        </div>
                        {isLate && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[9px] font-black text-red-400 uppercase">
                            <AlertTriangle size={9}/> {elapsed}m
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <span className={`text-sm font-black ${dark ? "text-white" : "text-zinc-800"} uppercase italic`}>
                          {order.client_name || "Client"}
                        </span>
                        <span className={`text-[10px] font-bold ${sub}`}>
                          <Bike size={10} className="inline mr-1"/>{order.rider_name || "—"}
                        </span>
                      </div>
                      {order.client_phone && <p className={`text-[10px] font-bold ${sub} flex items-center gap-1`}><Phone size={9}/> {order.client_phone}</p>}
                      {order.delivery_address && <p className={`text-[10px] font-bold ${sub} flex items-center gap-1 mt-0.5`}><MapPin size={9}/> {order.delivery_address}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-black italic text-emerald-400">
                        UGX {Number(order.total || 0).toLocaleString()}
                      </p>
                      <p className={`text-[9px] font-bold ${sub} mt-0.5`}>tap to action</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. History (Completed Today) */}
      {history.length > 0 && (
        <div>
          <p className={`text-[10px] font-black uppercase tracking-widest ${sub} mb-3`}>Completed Today ({history.length})</p>
          <div className="space-y-2">
            {history.slice(0, 5).map(order => (
              <div key={order.id} className={`${card} border rounded-xl px-4 py-3 flex items-center justify-between gap-3 opacity-80`}>
                <div>
                  <p className={`text-xs font-black ${dark ? "text-white" : "text-zinc-800"} uppercase italic`}>{order.client_name || "Client"}</p>
                  <p className={`text-[10px] font-bold ${sub}`}>
                    <Bike size={9} className="inline mr-1"/>{order.rider_name}
                    {" · "}{timeAgo(order.delivered_at || order.updated_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black italic text-emerald-400">UGX {Number(order.total || 0).toLocaleString()}</p>
                  <CheckCircle2 size={14} className="text-emerald-400"/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <DeliveryActionModal
          order={selected}
          dark={dark}
          onClose={() => setSelected(null)}
          onDispatch={handleDispatch}
          onMarkDelivered={handleMarkDelivered}
        />
      )}
    </div>
  );
}

// ─── DELIVERY ACTION MODAL ────────────────────────────────────────────────────
function DeliveryActionModal({ order, dark, onClose, onDispatch, onMarkDelivered }) {
  const [acting, setActing] = useState(false);
  const currentStatus = order.delivery_status?.toLowerCase() || 'pending';
  const st = STATUS[currentStatus] || STATUS.pending;

  const act = async (fn) => { 
    setActing(true); 
    await fn(); 
    setActing(false); 
  };

  return (
    <div className="fixed inset-0 z-[600] bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className={`${dark ? "bg-[#0f0f0f] border-white/10" : "bg-white border-zinc-200"} border w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden shadow-2xl`}>
        
        <div className={`flex items-center justify-between px-6 pt-4 pb-4 sm:pt-6 border-b ${dark ? "border-white/8" : "border-zinc-100"}`}>
          <div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase ${st.bg} ${st.color} mb-2`}>
              <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>{st.label}
            </div>
            <h2 className={`text-base font-black uppercase italic ${dark ? "text-white" : "text-zinc-800"} leading-tight`}>
              {order.client_name || "Client"}
            </h2>
          </div>
          <button onClick={onClose} className={`w-9 h-9 rounded-full flex items-center justify-center ${dark ? "bg-white/5 border-white/10 text-zinc-500" : "bg-zinc-100 border-zinc-200 text-zinc-400"} border transition-all`}>
            <X size={16}/>
          </button>
        </div>

        <div className="px-5 pb-6 pt-4 space-y-4">
          <div className="space-y-2">
            {order.client_phone && <p className={`text-xs font-bold ${dark ? "text-zinc-400" : "text-zinc-500"} flex items-center gap-2`}><Phone size={12}/> {order.client_phone}</p>}
            {order.delivery_address && <p className={`text-xs font-bold ${dark ? "text-zinc-400" : "text-zinc-500"} flex items-center gap-2`}><MapPin size={12}/> {order.delivery_address}</p>}
          </div>

          {currentStatus === "pending" && (
            <button onClick={() => act(() => onDispatch(order.id))} disabled={acting}
              className="w-full py-4 bg-orange-500 text-black font-black rounded-xl uppercase italic text-sm tracking-widest hover:bg-orange-400 disabled:opacity-50 flex items-center justify-center gap-2">
              <Send size={16}/> {acting ? "Dispatching..." : "Dispatch Order (SMS)"}
            </button>
          )}

          {currentStatus === "out" && (
            <button onClick={() => act(() => onMarkDelivered(order.id))} disabled={acting}
              className="w-full py-4 bg-blue-500 text-white font-black rounded-xl uppercase italic text-sm tracking-widest hover:bg-blue-400 disabled:opacity-50 flex items-center justify-center gap-2">
              <CheckCircle2 size={16}/> {acting ? "Confirming..." : "Confirm Delivery"}
            </button>
          )}

          {currentStatus === "delivered" && (
            <div className={`p-4 rounded-xl border ${dark ? "bg-white/5 border-white/10" : "bg-zinc-50 border-zinc-200"} text-center`}>
              <p className={`text-[10px] font-black uppercase tracking-widest ${dark ? "text-zinc-500" : "text-zinc-400"} mb-1`}>Waiting for Payment</p>
              <p className={`text-[9px] leading-relaxed ${dark ? "text-zinc-600" : "text-zinc-500"}`}>The Cashier must confirm payment to clear this from the list.</p>
            </div>
          )}

          <button onClick={onClose} className={`w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-widest ${dark ? "text-zinc-600 hover:text-zinc-400" : "text-zinc-400 hover:text-zinc-600"}`}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}