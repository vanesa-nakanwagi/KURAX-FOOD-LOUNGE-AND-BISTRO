import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../customer/components/context/DataContext";
import {
  Clock, CheckCircle, Play, Flame,
  Search, RotateCcw, Trophy, UserPlus, AlertCircle,
  ChefHat, Power, X, ShieldAlert
} from "lucide-react";
import Footer from "../../customer/components/common/Foooter";
import API_URL from "../../config/api";

// ─── KAMPALA DATE ─────────────────────────────────────────────────────────────
function kampalaDateStr(d = new Date()) {
  return new Date(d.toLocaleString("en-US", { timeZone: "Africa/Nairobi" }))
    .toISOString().split("T")[0];
}

// ─── CHEF ASSIGN MODAL ────────────────────────────────────────────────────────
function AssignModal({ assigningItem, onConfirm, onClose }) {
  const [name, setName] = useState("");
  const handleConfirm = () => { if (name.trim()) { onConfirm(name.trim()); setName(""); } };

  return (
    <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 text-yellow-500">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
              <UserPlus size={20}/>
            </div>
            <div>
              <h3 className="font-black uppercase italic tracking-tighter text-lg leading-none">Assign Chef</h3>
              <p className="text-[10px] text-zinc-500 font-bold mt-0.5">{assigningItem.itemName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all">
            <X size={14} className="text-zinc-400"/>
          </button>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest ml-1 block">Chef's Name</label>
          <input
            autoFocus type="text" placeholder="e.g. Eddy" autoComplete="off"
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleConfirm()}
            className="w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-base font-bold text-white outline-none focus:border-yellow-500 transition-all placeholder:opacity-20"
          />
          <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3">
            <ShieldAlert size={14} className="text-amber-400 shrink-0 mt-0.5"/>
            <p className="text-[10px] text-amber-400/80 font-bold leading-relaxed">
              This chef will be held accountable for this dish. Their name is permanently recorded with the order.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <button onClick={handleConfirm} disabled={!name.trim()}
              className="w-full py-4 bg-yellow-500 text-black font-black rounded-2xl uppercase italic text-xs active:scale-95 transition-all shadow-lg shadow-yellow-500/10 disabled:opacity-40 disabled:cursor-not-allowed">
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

// ─── SHIFT SUMMARY MODAL ──────────────────────────────────────────────────────
function ShiftSummaryModal({ stats, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 text-white">
      <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[3rem] p-8 text-center shadow-2xl">
        <div className="w-16 h-16 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trophy size={32}/>
        </div>
        <h2 className="text-xl font-black uppercase italic mb-1">Service Recap</h2>
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-6 font-bold">End of Shift Summary</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-black/40 p-5 rounded-2xl border border-white/5">
            <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Tickets</p>
            <p className="text-3xl font-black">{stats.totalOrders}</p>
          </div>
          <div className="bg-black/40 p-5 rounded-2xl border border-white/5">
            <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Dishes</p>
            <p className="text-3xl font-black">{stats.totalItems}</p>
          </div>
        </div>

        {stats.chefs && stats.chefs.length > 0 && (
          <div className="mb-6 text-left space-y-2">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">Chef Breakdown</p>
            {stats.chefs.map(c => (
              <div key={c.chef} className="flex items-center justify-between bg-black/30 px-4 py-2.5 rounded-xl border border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center text-[9px] font-black">
                    {c.chef[0]}
                  </div>
                  <span className="font-black text-xs text-white uppercase">{c.chef}</span>
                </div>
                <span className="text-[10px] font-black text-yellow-400">
                  {c.items_handled} dish{Number(c.items_handled) !== 1 ? "es" : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <button onClick={onConfirm}
            className="w-full py-5 bg-yellow-500 text-black font-black rounded-2xl uppercase italic text-xs shadow-lg active:scale-95 transition-all">
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
function OrderCard({ order, onUpdateStatus, onAssignChef }) {
  const minutesAgo = Math.floor((Date.now() - new Date(order.timestamp || order.created_at)) / 60000);
  const isDelayed   = minutesAgo >= 15 && order.status !== "Ready";
  const isReady     = order.status === "Ready";
  const isPreparing = order.status === "Preparing";

  const headerBg = isReady ? "bg-emerald-900/40" : isDelayed ? "bg-rose-700" : "bg-zinc-800";

  return (
    <div className={`flex flex-col rounded-[2.5rem] border-2 bg-zinc-900 transition-all duration-500 h-[460px] overflow-hidden shadow-xl
      ${isReady ? "opacity-60 grayscale border-transparent" : isDelayed ? "border-rose-600" : "border-white/5"}`}>

      <div className={`p-5 shrink-0 ${headerBg}`}>
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none text-white">
            T-{order.table_name || order.tableName}
          </h2>
          <span className={`text-sm font-black italic flex items-center gap-1.5 px-3 py-1 rounded-full
            ${isDelayed ? "bg-white/20 text-white" : "bg-black/30 text-zinc-300"}`}>
            <Clock size={12}/> {minutesAgo}m
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border
            ${order.staff_role === "DIRECTOR"
              ? "bg-rose-500/20 border-rose-500/30 text-rose-400"
              : "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"}`}>
            {order.staff_role || "WAITER"}
          </span>
          <p className="text-[10px] font-black uppercase text-white/50">
            {order.staff_name || order.waiterName || "Staff"}
          </p>
          {isDelayed && (
            <span className="ml-auto flex items-center gap-1 text-[9px] font-black text-white/70 uppercase">
              <AlertCircle size={10}/> Delayed
            </span>
          )}
        </div>
      </div>

      <div className="p-5 flex-grow overflow-y-auto space-y-3 custom-scrollbar">
        {order.items.map((item, idx) => (
          <div key={idx} className="border-b border-white/5 pb-3 last:border-0">
            <div className="flex justify-between items-start gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <span className="bg-yellow-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded leading-none shrink-0 mt-0.5">
                  {item.quantity}x
                </span>
                <div className="min-w-0">
                  <p className={`font-black text-sm uppercase leading-tight ${isReady ? "line-through text-zinc-500" : "text-white"}`}>
                    {item.name}
                  </p>
                  {item.note && (
                    <p className="text-[10px] text-rose-400 italic font-bold mt-1 bg-rose-500/5 p-1.5 rounded-lg">
                      "{item.note}"
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                {item.assignedTo ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="bg-emerald-500/10 text-emerald-400 text-[8px] font-black px-2 py-1 rounded-full border border-emerald-500/20 whitespace-nowrap">
                      👨‍🍳 {item.assignedTo}
                    </span>
                    {item.assignedAt && (
                      <span className="text-[7px] text-zinc-600 font-bold">
                        {new Date(item.assignedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => onAssignChef(order.id, order._ticketId, idx, item.name)}
                    className="bg-zinc-800 text-zinc-400 text-[8px] font-black px-2 py-1 rounded-full border border-white/5 hover:bg-yellow-500 hover:text-black transition-all whitespace-nowrap">
                    + Assign
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-black/20 border-t border-white/5 shrink-0">
        {order.status === "Pending" && (
          <button onClick={() => onUpdateStatus(order.id, order._ticketId, "Preparing")}
            className="w-full py-4 bg-yellow-500 text-black font-black rounded-2xl flex items-center justify-center gap-2 text-[11px] uppercase italic active:scale-95 transition-all shadow-lg shadow-yellow-500/10">
            <Flame size={16}/> Start Fire
          </button>
        )}
        {isPreparing && (
          <button onClick={() => onUpdateStatus(order.id, order._ticketId, "Ready")}
            className="w-full py-4 bg-emerald-500 text-black font-black rounded-2xl flex items-center justify-center gap-2 text-[11px] uppercase italic active:scale-95 transition-all shadow-lg shadow-emerald-500/10">
            <CheckCircle size={16}/> Dish Ready — Notify Waiter
          </button>
        )}
        {isReady && (
          <button onClick={() => onUpdateStatus(order.id, order._ticketId, "Preparing")}
            className="w-full py-4 bg-zinc-800 text-zinc-400 font-black rounded-2xl flex items-center justify-center gap-2 text-[11px] uppercase italic active:scale-95 transition-all">
            <RotateCcw size={14}/> Return to Preparing
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function KitchenDisplay() {
  const { orders = [], setOrders, refreshData } = useData() || {};
  const navigate = useNavigate();

  const savedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}"); }
    catch { return {}; }
  }, []);
  const chefName     = savedUser.name || "Head Chef";
  const chefInitials = chefName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const handleLogout = () => { localStorage.removeItem("kurax_user"); navigate("/staff/login"); };

  const [audioEnabled,  setAudioEnabled]  = useState(false);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [showSummary,   setShowSummary]   = useState(false);
  const [shiftStats,    setShiftStats]    = useState({ totalOrders: 0, totalItems: 0, chefs: [] });
  const [assigningItem, setAssigningItem] = useState(null);

  const ticketMapRef = useRef({});

  // ── Load today's tickets on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/kitchen/tickets?date=${kampalaDateStr()}`);
        if (res.ok) {
          const rows = await res.json();
          rows.forEach(t => { ticketMapRef.current[t.order_id] = t.id; });
        }
      } catch (e) { console.error("Load existing tickets:", e); }
    })();
  }, []);

  // ── Filter: only kitchen-relevant, non-cleared, non-day-closed orders ──────
  // FIX: added day_cleared and shift_cleared checks so accountant close-day
  //      immediately empties the kitchen board without needing a manual refresh.
  const filteredOrders = useMemo(() =>
    (orders || [])
      .filter(order => {
        // ── Status gate: only active kitchen statuses ──────────────────────
        if (!["Pending", "Preparing", "Ready"].includes(order.status)) return false;

        // ── FIX 1: hide orders cleared by accountant end-of-day ───────────
        const dayCleared =
          order.day_cleared   === true || order.day_cleared   === "t" || order.day_cleared   === "true";

        // ── FIX 2: hide orders cleared by waiter/kitchen end-of-shift ─────
        const shiftCleared =
          order.shift_cleared === true || order.shift_cleared === "t" || order.shift_cleared === "true";

        // ── FIX 3: hide orders with in-memory kitchen clear flag ──────────
        const kitchenCleared = order.clearedByKitchen === true;

        if (dayCleared || shiftCleared || kitchenCleared) return false;

        // ── Kitchen-only items (no barman / barista items = skip) ──────────
        if (!(order.items || []).some(i => i.station !== "Barman" && i.station !== "Barista")) return false;

        // ── Search filter ──────────────────────────────────────────────────
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (!(order.table_name || order.tableName || "").toLowerCase().includes(q) &&
              !String(order.id).includes(q)) return false;
        }

        return true;
      })
      .map(order => ({
        ...order,
        _ticketId: ticketMapRef.current[order.id] || null,
        items: (order.items || []).filter(i => i.station !== "Barman" && i.station !== "Barista"),
      }))
      .sort((a, b) => {
        const p = { Pending: 0, Preparing: 1, Ready: 2 };
        return (p[a.status] ?? 3) - (p[b.status] ?? 3);
      }),
  [orders, searchQuery]);

  // ── Auto-upsert tickets to kitchen_tickets DB ─────────────────────────────
  const upsertedRef = useRef(new Set());
  useEffect(() => {
    filteredOrders.forEach(async order => {
      if (upsertedRef.current.has(order.id)) return;
      upsertedRef.current.add(order.id);
      try {
        const waiterName = order.staff_name || order.waiterName || "Staff";
        const waiterRole = order.staff_role || "WAITER";
        const res = await fetch(`${API_URL}/api/kitchen/tickets`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id:   order.id,
            table_name: order.table_name || order.tableName || "WALK-IN",
            staff_name: waiterName,
            staff_role: waiterRole,
            items:      order.items,
            total:      order.total || 0,
            status:     order.status,
          }),
        });
        if (res.ok) {
          const ticket = await res.json();
          ticketMapRef.current[order.id] = ticket.id;
        }
      } catch (e) { console.error("Upsert ticket:", e); }
    });
  }, [filteredOrders]);

  // ── Audio: ding on new kitchen order ─────────────────────────────────────
  const prevLen = useRef(orders.length);
  const playDing = () => {
    new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3")
      .play().catch(() => setAudioEnabled(false));
  };
  useEffect(() => {
    if (orders.length > prevLen.current) {
      const latest = orders[orders.length - 1];
      const hasFood = (latest?.items || []).some(i => i.station !== "Barman" && i.station !== "Barista");
      if (latest?.status === "Pending" && hasFood && audioEnabled) playDing();
    }
    prevLen.current = orders.length;
  }, [orders, audioEnabled]);

  // ── Update status ─────────────────────────────────────────────────────────
  const updateStatus = useCallback(async (orderId, ticketId, newStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    try {
      await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const tId = ticketId || ticketMapRef.current[orderId];
      if (tId) {
        await fetch(`${API_URL}/api/kitchen/tickets/${tId}/status`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
      }
    } catch (err) {
      console.error("Status update failed:", err);
      refreshData?.();
    }
  }, [setOrders, refreshData]);

  // ── Assign chef ───────────────────────────────────────────────────────────
  const handleAssignChef = useCallback(async (chefInput) => {
    if (!chefInput || !assigningItem) return;
    const { orderId, ticketId, itemIdx, itemName } = assigningItem;
    const assignedAt = new Date().toISOString();

    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;
      const newItems = [...order.items];
      newItems[itemIdx] = { ...newItems[itemIdx], assignedTo: chefInput, assignedAt };
      return { ...order, items: newItems };
    }));
    setAssigningItem(null);

    try {
      const currentOrder = orders.find(o => o.id === orderId);
      if (!currentOrder) return;
      const updatedItems = currentOrder.items.map((item, i) =>
        i === itemIdx ? { ...item, assignedTo: chefInput, assignedAt } : item
      );

      await fetch(`${API_URL}/api/orders/${orderId}/assign-chef`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: updatedItems, item_name: itemName, assigned_to: chefInput, assigned_at: assignedAt, assigned_by: chefName }),
      });

      const tId = ticketId || ticketMapRef.current[orderId];
      if (tId) {
        await fetch(`${API_URL}/api/kitchen/tickets/${tId}/assign-chef`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: updatedItems, item_name: itemName, assigned_to: chefInput, assigned_at: assignedAt, assigned_by: chefName }),
        });
      }
    } catch (err) { console.error("Assign chef failed:", err); }
  }, [assigningItem, orders, setOrders, chefName]);

  // ── End Shift ─────────────────────────────────────────────────────────────
  const handleShiftReset = async () => {
    let chefs = [];
    try {
      const res = await fetch(`${API_URL}/api/kitchen/tickets/summary?date=${kampalaDateStr()}`);
      if (res.ok) { const d = await res.json(); chefs = d.chefs || []; }
    } catch {}
    const itemCount = filteredOrders.reduce((s, o) => s + o.items.length, 0);
    setShiftStats({ totalOrders: filteredOrders.length, totalItems: itemCount, chefs });
    setShowSummary(true);
  };

  const confirmEndShift = async () => {
    try {
      await fetch(`${API_URL}/api/kitchen/clear-shift`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleared_by: chefName }),
      });
    } catch (err) { console.error("Clear shift API:", err); }

    setOrders(prev => prev.map(order => {
      const isKitchenActive =
        ["Pending", "Preparing", "Ready"].includes(order.status) &&
        (order.items || []).some(i => i.station !== "Barman" && i.station !== "Barista");
      return isKitchenActive ? { ...order, clearedByKitchen: true } : order;
    }));

    setShowSummary(false);
    upsertedRef.current.clear();
  };

  const pendingCount   = filteredOrders.filter(o => o.status === "Pending").length;
  const preparingCount = filteredOrders.filter(o => o.status === "Preparing").length;
  const readyCount     = filteredOrders.filter(o => o.status === "Ready").length;

  return (
    <div className="h-screen bg-zinc-950 p-3 md:p-5 overflow-hidden flex flex-col font-[Outfit] relative text-white">

      {/* ── AUDIO GATE ── */}
      {!audioEnabled && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 text-center">
          <div className="space-y-6">
            <div className="w-24 h-24 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto">
              <ChefHat size={48} className="text-yellow-500 animate-pulse"/>
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">Kitchen Station</h2>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">Kurax Lounge &amp; Bistro</p>
            </div>
            <button onClick={() => { setAudioEnabled(true); playDing(); }}
              className="bg-yellow-500 text-black px-12 py-5 rounded-2xl font-black uppercase italic hover:scale-105 transition-transform flex items-center gap-3 mx-auto shadow-2xl shadow-yellow-500/20 active:scale-95">
              <Play fill="currentColor" size={20}/> Open Kitchen Station
            </button>
          </div>
        </div>
      )}

      {assigningItem && (
        <AssignModal assigningItem={assigningItem} onConfirm={handleAssignChef} onClose={() => setAssigningItem(null)}/>
      )}
      {showSummary && (
        <ShiftSummaryModal stats={shiftStats} onConfirm={confirmEndShift} onClose={() => setShowSummary(false)}/>
      )}

      {/* ── HEADER ── */}
      <header className="flex flex-col lg:flex-row justify-between items-center mb-4 bg-zinc-900 p-4 lg:px-6 rounded-[2rem] border border-white/5 shadow-2xl gap-3 shrink-0">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="w-12 h-12 bg-yellow-500 rounded-2xl flex items-center justify-center text-black font-black text-lg border-b-4 border-yellow-700 shrink-0">
            {chefInitials}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black uppercase tracking-tighter leading-none italic truncate">{chefName}</h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Active Kitchen Session</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 border border-white/5 text-[10px] font-black uppercase">
            <span className="w-2 h-2 rounded-full bg-zinc-400"/>
            <span className="text-zinc-400">{pendingCount} Pending</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] font-black uppercase">
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"/>
            <span className="text-orange-400">{preparingCount} Cooking</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-400"/>
            <span className="text-emerald-400">{readyCount} Ready</span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14}/>
            <input type="text" placeholder="Search table..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-full py-2.5 pl-9 pr-4 text-xs font-bold text-white outline-none focus:border-yellow-500 transition-all"/>
          </div>
          <button onClick={handleShiftReset}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white transition-all text-[10px] font-black uppercase italic shrink-0">
            <RotateCcw size={13}/> End Shift
          </button>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all text-[10px] font-black uppercase italic shrink-0">
            <Power size={13}/> Out
          </button>
        </div>
      </header>

      {/* ── ORDERS GRID ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-16 custom-scrollbar flex-1">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-32 opacity-20">
            <ChefHat size={60} className="mb-4"/>
            <p className="text-sm font-black uppercase tracking-[0.3em]">Kitchen is Clear</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onUpdateStatus={updateStatus}
              onAssignChef={(orderId, ticketId, itemIdx, itemName) =>
                setAssigningItem({ orderId, ticketId, itemIdx, itemName })
              }
            />
          ))
        )}
      </div>

      <Footer/>
    </div>
  );
}