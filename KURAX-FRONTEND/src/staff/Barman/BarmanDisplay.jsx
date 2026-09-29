import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../customer/components/context/DataContext";
import {
  Clock, CheckCircle, Play, AlertCircle,
  Search, RotateCcw, Trophy, UserPlus,
  Power, X, ShieldAlert, Wine
} from "lucide-react";
import API_URL from "../../config/api";

// ─── KAMPALA DATE ─────────────────────────────────────────────────────────────
function kampalaDateStr(d = new Date()) {
  return new Date(d.toLocaleString("en-US", { timeZone: "Africa/Nairobi" }))
    .toISOString().split("T")[0];
}

function formatMoney(value) {
  return `UGX ${Number(value || 0).toLocaleString()}`;
}

// ─── ASSIGN MODAL ────────────────────────────────────────────────────────────
function AssignModal({ assigningItem, onConfirm, onClose, department }) {
  const [name, setName] = useState("");
  const [staff, setStaff] = useState([]);
  useEffect(() => {
    try {
      const token = JSON.parse(localStorage.getItem("kurax_user") || "null")?.token;
      if (!token) return;
      fetch(`${API_URL}/api/departments/${department}/workers`, { headers: { Authorization: `Bearer ${token}` } })
        .then(response => response.ok ? response.json() : [])
        .then(rows => setStaff(Array.isArray(rows) ? rows : []))
        .catch(() => {});
    } catch {}
  }, [department]);
  const handleConfirm = () => { if (name.trim()) { onConfirm(name.trim()); setName(""); } };

  return (
    <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-xl p-6 shadow-2xl text-zinc-900" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 text-amber-700">
            <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center">
              <UserPlus size={20}/>
            </div>
            <div>
              <h3 className="font-black uppercase italic tracking-tighter text-lg leading-none">Assign Mixologist</h3>
              <p className="text-[10px] text-zinc-500 font-bold mt-0.5">{assigningItem.itemName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-all">
            <X size={14} className="text-zinc-600"/>
          </button>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-1 block">Mixologist's Name</label>
          {staff.length ? <select autoFocus required value={name} onChange={e => setName(e.target.value)} className="w-full bg-white border border-zinc-200 rounded-xl py-3 px-4 text-sm font-semibold text-zinc-900 outline-none focus:border-amber-500"><option value="">Choose a mixologist</option>{staff.map(member => <option key={member.id} value={member.name}>{member.name}</option>)}</select> : <input
            autoFocus type="text" placeholder="e.g. Alex" autoComplete="off"
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleConfirm()}
            className="w-full bg-white border border-zinc-200 rounded-xl py-3 px-4 text-sm font-semibold text-zinc-900 outline-none focus:border-amber-500 placeholder:text-zinc-400"
          />}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <ShieldAlert size={14} className="text-amber-700 shrink-0 mt-0.5"/>
            <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
              This mixologist will be held accountable for this drink. Their name is permanently recorded with the order.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <button onClick={handleConfirm} disabled={!name.trim()}
              className="w-full py-3 bg-amber-400 text-zinc-950 font-black rounded-lg uppercase text-xs active:scale-95 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
              Confirm Assignment
            </button>
            <button onClick={onClose} className="w-full py-3 text-zinc-500 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SHIFT SUMMARY MODAL ─────────────────────────────────────────────────────
function ShiftSummaryModal({ stats, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-xl p-6 text-center shadow-2xl text-zinc-900">
        <div className="w-16 h-16 bg-amber-500/10 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trophy size={32}/>
        </div>
        <h2 className="text-xl font-black uppercase italic mb-1">Shift Recap</h2>
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-6 font-bold">End of Bar Shift</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-zinc-50 p-5 rounded-lg border border-zinc-200">
            <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Tickets</p>
            <p className="text-3xl font-black">{stats.totalOrders}</p>
          </div>
          <div className="bg-zinc-50 p-5 rounded-lg border border-zinc-200">
            <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Drinks</p>
            <p className="text-3xl font-black">{stats.totalDrinks}</p>
          </div>
        </div>

        {/* Per-mixologist breakdown from DB */}
        {stats.barmen && stats.barmen.length > 0 && (
          <div className="mb-6 text-left space-y-2">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">Mixologist Breakdown</p>
            {stats.barmen.map(b => (
              <div key={b.barman} className="flex items-center justify-between bg-zinc-50 px-4 py-2.5 rounded-lg border border-zinc-200">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-700 flex items-center justify-center text-[9px] font-black">
                    {b.barman[0]}
                  </div>
                  <span className="font-black text-xs text-white uppercase">{b.barman}</span>
                </div>
                <span className="text-[10px] font-black text-amber-700">
                  {b.drinks_made} drink{Number(b.drinks_made) !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <button onClick={onConfirm}
            className="w-full py-4 bg-amber-400 text-zinc-950 font-black rounded-lg uppercase text-xs shadow-sm active:scale-95 transition-all">
            Clear Feed &amp; End Shift
          </button>
          <button onClick={onClose} className="w-full py-4 text-zinc-500 font-bold uppercase tracking-widest text-[9px]">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ORDER CARD ───────────────────────────────────────────────────────────────
function OrderCard({ order, onUpdateStatus, onAssignBarman }) {
  const minutesAgo  = Math.floor((Date.now() - new Date(order.timestamp || order.created_at)) / 60000);
  const orderTotal = (order.items || []).reduce((total, item) => total + Number(item.price || item.unit_price || 0) * Number(item.quantity || 1), 0);
  const isCompleted = ["Served","Paid","Closed","Credit","Mixed"].includes(order.status);
  const isReady     = order.status === "Ready";
  const isPreparing = order.status === "Preparing";
  const isDelayed   = minutesAgo >= 12 && !isReady && !isCompleted;

  const headerBg = isCompleted || isReady ? "bg-zinc-50" : isDelayed ? "bg-rose-50" : "bg-zinc-50";

  return (
    <div className={`flex flex-col rounded-xl border bg-white transition-all duration-300 h-[460px] overflow-hidden shadow-sm
      ${isCompleted ? "opacity-35 grayscale border-transparent"
        : isReady   ? "opacity-60 grayscale border-transparent"
        : isDelayed ? "border-rose-300"
        : "border-zinc-200"}`}>

      {/* Header */}
      <div className={`p-4 shrink-0 ${headerBg} border-b border-zinc-100`}>
        <div className="flex justify-between items-start mb-2">
          <div><p className="text-xs font-black uppercase tracking-widest text-amber-800">Order #{order.id} · Table {order.table_name || order.tableName}</p><h2 className="mt-1 text-xl font-black text-zinc-900">{formatMoney(orderTotal)}</h2></div>
          {isCompleted ? (
            <span className="text-[9px] font-black px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 uppercase tracking-widest border border-emerald-500/20">
              ✓ Collected
            </span>
          ) : (
            <span className={`text-sm font-black italic flex items-center gap-1.5 px-3 py-1 rounded-full
              ${isDelayed ? "bg-rose-100 text-rose-800" : "bg-white border border-zinc-200 text-zinc-600"}`}>
              <Clock size={12}/> {minutesAgo}m
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[10px] font-black uppercase text-zinc-500">
            {order.staff_name || order.waiterName || "Staff"}
          </p>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${isCompleted ? 'bg-emerald-100 text-emerald-800' : isPreparing ? 'bg-amber-100 text-amber-900' : isReady ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-100 text-zinc-600'}`}>{order.status}</span>
          {isDelayed && (
            <span className="ml-auto flex items-center gap-1 text-[9px] font-black text-white/70 uppercase">
              <AlertCircle size={10}/> Delayed
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="p-5 flex-grow overflow-y-auto space-y-3 custom-scrollbar">
        {order.items.map((item, idx) => (
          <div key={idx} className="border-b border-zinc-100 pb-3 last:border-0">
            <div className="flex justify-between items-start gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <span className="bg-amber-400 text-zinc-950 text-[10px] font-black px-1.5 py-0.5 rounded leading-none shrink-0 mt-0.5">
                  {item.quantity}x
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><p className={`font-black text-sm uppercase leading-tight ${isReady || isCompleted ? "line-through text-zinc-400" : "text-zinc-900"}`}>{item.name}</p><span className="shrink-0 text-xs font-semibold text-zinc-600">{formatMoney(Number(item.price || item.unit_price || 0) * Number(item.quantity || 1))}</span></div>
                  {item.note && (
                    <p className="text-[10px] text-amber-800 italic font-bold mt-1 bg-amber-50 p-1.5 rounded-lg">
                      "{item.note}"
                    </p>
                  )}
                </div>
              </div>

              {/* Mixologist badge */}
              <div className="shrink-0">
                {item.assignedTo ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="bg-amber-50 text-amber-800 text-[8px] font-black px-2 py-1 rounded-full border border-amber-200 whitespace-nowrap">
                      🍹 {item.assignedTo}
                    </span>
                    {item.assignedAt && (
                      <span className="text-[7px] text-zinc-600 font-bold">
                        {new Date(item.assignedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                ) : !isCompleted ? (
                  <button
                    onClick={() => onAssignBarman(order.id, order._ticketId, idx, item.name)}
                    className="bg-white text-zinc-600 text-[8px] font-black px-2 py-1 rounded-full border border-zinc-200 hover:bg-amber-400 hover:text-zinc-950 transition-all whitespace-nowrap">
                    + Barman
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <div className="p-4 bg-zinc-50 border-t border-zinc-100 shrink-0">
        {isCompleted ? (
          <div className="py-3 flex items-center justify-center gap-2">
            <CheckCircle size={13} className="text-emerald-500"/>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Served &amp; Collected</p>
          </div>
        ) : order.status === "Pending" ? (
          <button onClick={() => onUpdateStatus(order.id, order._ticketId, "Preparing")}
            className="w-full py-3 bg-amber-400 text-zinc-950 font-black rounded-lg flex items-center justify-center gap-2 text-[11px] uppercase active:scale-95 transition-all shadow-sm">
            <Wine size={16}/> Start Mixing
          </button>
        ) : isPreparing ? (
          <button onClick={() => onUpdateStatus(order.id, order._ticketId, "Ready")}
            className="w-full py-3 bg-emerald-600 text-white font-black rounded-lg flex items-center justify-center gap-2 text-[11px] uppercase active:scale-95 transition-all shadow-sm">
            <CheckCircle size={16}/> Order Ready — Notify Waiter
          </button>
        ) : isReady ? (
          <button onClick={() => onUpdateStatus(order.id, order._ticketId, "Preparing")}
            className="w-full py-3 bg-white text-zinc-600 border border-zinc-200 font-black rounded-lg flex items-center justify-center gap-2 text-[11px] uppercase active:scale-95 transition-all">
            <RotateCcw size={14}/> Recall Order
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function BarmanDisplay() {
  const { orders = [], setOrders, refreshData } = useData() || {};
  const navigate = useNavigate();

  const savedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}"); }
    catch { return {}; }
  }, []);
  const barmanName     = savedUser.name || "Head Barman";
  const barmanInitials = barmanName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const handleLogout   = () => { localStorage.removeItem("kurax_user"); navigate("/staff/login"); };

  const [audioEnabled,  setAudioEnabled]  = useState(false);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [showSummary,   setShowSummary]   = useState(false);
  const [shiftStats,    setShiftStats]    = useState({ totalOrders: 0, totalDrinks: 0, barmen: [] });
  const [assigningItem, setAssigningItem] = useState(null);

  const ticketMapRef = useRef({});
  const [seenOrderIds, setSeenOrderIds] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/barman/tickets?date=${kampalaDateStr()}`);
        if (res.ok) {
          const rows = await res.json();
          const ids = [];
          rows.forEach(t => {
            if (t.order_id) {
              ticketMapRef.current[t.order_id] = t.id;
              ids.push(Number(t.order_id));
            }
          });
          if (ids.length > 0) setSeenOrderIds(ids);
        }
      } catch (e) { console.error("Load barman tickets:", e); }
    })();
  }, []);

  // ✅ FIXED: only barman station, no category fallbacks
  const isBarmanItem = (item) =>
    item.station?.toLowerCase() === "barman";

  const filteredOrders = useMemo(() => {
    const active    = ["Pending", "Preparing", "Ready"];
    const completed = ["Served", "Paid", "Closed", "Credit", "Mixed"];
    const seenSet   = new Set(seenOrderIds);

    return (orders || [])
      .filter(order => {
        if (order.clearedByBarman) return false;
        if (!(order.items || []).some(isBarmanItem)) return false;

        if (active.includes(order.status)) return true;
        if (completed.includes(order.status) && seenSet.has(Number(order.id))) return true;
        return false;
      })
      .filter(order => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (order.table_name || order.tableName || "").toLowerCase().includes(q) ||
               String(order.id).includes(q);
      })
      .map(order => ({
        ...order,
        _ticketId: ticketMapRef.current[order.id] || null,
        items: (order.items || []).filter(isBarmanItem),
      }))
      .sort((a, b) => {
        const p  = { Pending: 0, Preparing: 1, Ready: 2 };
        const aP = p[a.status] ?? 10;
        const bP = p[b.status] ?? 10;
        if (aP !== bP) return aP - bP;
        return new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at);
      });
  }, [orders, searchQuery, seenOrderIds]);

  const upsertedRef = useRef(new Set());
  useEffect(() => {
    filteredOrders.forEach(async order => {
      if (upsertedRef.current.has(order.id)) return;
      upsertedRef.current.add(order.id);
      try {
        const res = await fetch(`${API_URL}/api/barman/tickets`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id:   order.id,
            table_name: order.table_name || order.tableName || "WALK-IN",
            staff_name: order.staff_name || order.waiterName || null,
            items:      order.items,
            total:      order.total || 0,
            status:     order.status,
          }),
        });
        if (res.ok) {
          const ticket = await res.json();
          ticketMapRef.current[order.id] = ticket.id;
          setSeenOrderIds(prev =>
            prev.includes(Number(order.id)) ? prev : [...prev, Number(order.id)]
          );
        }
      } catch (e) { console.error("Upsert barman ticket:", e); }
    });
  }, [filteredOrders]);

  const prevLen = useRef(orders.length);
  const playChime = () => {
    new Audio("https://assets.mixkit.co/active_storage/sfx/1062/1062-preview.mp3")
      .play().catch(() => setAudioEnabled(false));
  };
  useEffect(() => {
    if (orders.length > prevLen.current) {
      const latest = orders[orders.length - 1];
      const hasBarDrinks = (latest?.items || []).some(isBarmanItem);
      if (latest?.status === "Pending" && hasBarDrinks && audioEnabled) playChime();
    }
    prevLen.current = orders.length;
  }, [orders, audioEnabled]);

  const updateStatus = useCallback(async (orderId, ticketId, newStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    try {
      await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const tId = ticketId || ticketMapRef.current[orderId];
      if (tId) {
        await fetch(`${API_URL}/api/barman/tickets/${tId}/status`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
      }
    } catch (err) {
      console.error("Status update failed:", err);
      refreshData?.();
    }
  }, [setOrders, refreshData]);

  const handleAssignBarman = useCallback(async (nameInput) => {
    if (!nameInput || !assigningItem) return;
    const { orderId, ticketId, itemIdx, itemName } = assigningItem;
    const assignedAt = new Date().toISOString();

    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;
      const newItems = [...order.items];
      newItems[itemIdx] = { ...newItems[itemIdx], assignedTo: nameInput, assignedAt };
      return { ...order, items: newItems };
    }));
    setAssigningItem(null);

    try {
      const currentOrder = orders.find(o => o.id === orderId);
      if (!currentOrder) return;
      const updatedItems = currentOrder.items.map((item, i) =>
        i === itemIdx ? { ...item, assignedTo: nameInput, assignedAt } : item
      );

      await fetch(`${API_URL}/api/orders/${orderId}/assign-chef`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: updatedItems, item_name: itemName, assigned_to: nameInput, assigned_at: assignedAt, assigned_by: barmanName }),
      });

      const tId = ticketId || ticketMapRef.current[orderId];
      if (tId) {
        await fetch(`${API_URL}/api/barman/tickets/${tId}/assign-barman`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: updatedItems, item_name: itemName, assigned_to: nameInput, assigned_at: assignedAt, assigned_by: barmanName }),
        });
      }
    } catch (err) { console.error("Assign barman failed:", err); }
  }, [assigningItem, orders, setOrders, barmanName]);

  const handleShiftReset = async () => {
    let barmen = [];
    try {
      const res = await fetch(`${API_URL}/api/barman/tickets/summary?date=${kampalaDateStr()}`);
      if (res.ok) { const d = await res.json(); barmen = d.barmen || []; }
    } catch {}
    const drinkCount = filteredOrders.reduce((s, o) => s + o.items.length, 0);
    setShiftStats({ totalOrders: filteredOrders.length, totalDrinks: drinkCount, barmen });
    setShowSummary(true);
  };

  const confirmEndShift = async () => {
    try {
      await fetch(`${API_URL}/api/barman/clear-shift`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleared_by: barmanName }),
      });
    } catch (err) { console.error("Clear barman shift:", err); }

    setOrders(prev => prev.map(order => {
      const isActive = ["Pending","Preparing","Ready"].includes(order.status) &&
        (order.items || []).some(isBarmanItem);
      return isActive ? { ...order, clearedByBarman: true } : order;
    }));

    setShowSummary(false);
    upsertedRef.current.clear();
    setSeenOrderIds([]);
  };

  const pendingCount   = filteredOrders.filter(o => o.status === "Pending").length;
  const preparingCount = filteredOrders.filter(o => o.status === "Preparing").length;
  const readyCount     = filteredOrders.filter(o => o.status === "Ready").length;

  return (
    <div className="h-screen bg-[#f4f3ef] p-3 md:p-5 overflow-hidden flex flex-col font-[Outfit] relative text-zinc-900">

      {!audioEnabled && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 text-center">
          <div className="space-y-6">
            <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
              <Wine size={48} className="text-amber-700 animate-pulse"/>
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">Bar Station</h2>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">Kurax Lounge &amp; Bistro</p>
            </div>
            <button onClick={() => { setAudioEnabled(true); playChime(); }}
              className="bg-amber-400 text-zinc-950 px-8 py-4 rounded-lg font-black uppercase hover:bg-amber-300 transition-colors flex items-center gap-3 mx-auto shadow-sm active:scale-95">
              <Play fill="currentColor" size={20}/> Open Bar Station
            </button>
          </div>
        </div>
      )}

      {assigningItem && (
        <AssignModal department="bar" assigningItem={assigningItem} onConfirm={handleAssignBarman} onClose={() => setAssigningItem(null)}/>
      )}
      {showSummary && (
        <ShiftSummaryModal stats={shiftStats} onConfirm={confirmEndShift} onClose={() => setShowSummary(false)}/>
      )}

      <header className="flex flex-col lg:flex-row justify-between items-center mb-4 bg-white p-4 lg:px-6 rounded-xl border border-zinc-200 shadow-sm gap-3 shrink-0">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-amber-300 font-black text-lg shrink-0">
            {barmanInitials}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black uppercase tracking-tight leading-none truncate text-zinc-900">{barmanName}</h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Active Bar Session</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 text-[10px] font-black uppercase">
            <span className="w-2 h-2 rounded-full bg-zinc-400"/>
            <span className="text-zinc-400">{pendingCount} Pending</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-black uppercase">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"/>
            <span className="text-amber-800">{preparingCount} Mixing</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-black uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-400"/>
            <span className="text-emerald-400">{readyCount} Ready</span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14}/>
            <input type="text" placeholder="Search table..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-lg py-2.5 pl-9 pr-4 text-xs font-bold text-zinc-900 outline-none focus:border-amber-500 transition-all"/>
          </div>
          <button onClick={handleShiftReset}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-all text-[10px] font-black uppercase shrink-0">
            <RotateCcw size={13}/> End Shift
          </button>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all text-[10px] font-black uppercase italic shrink-0">
            <Power size={13}/> Out
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-16 custom-scrollbar flex-1">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-32 opacity-20">
            <Wine size={60} className="mb-4"/>
            <p className="text-sm font-black uppercase tracking-[0.3em]">Bar is Clear</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onUpdateStatus={updateStatus}
              onAssignBarman={(orderId, ticketId, itemIdx, itemName) =>
                setAssigningItem({ orderId, ticketId, itemIdx, itemName })
              }
            />
          ))
        )}
      </div>

    </div>
  );
}