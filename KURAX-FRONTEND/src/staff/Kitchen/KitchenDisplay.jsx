import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../customer/components/context/DataContext";
import LogoutConfirmDialog from "../components/LogoutConfirmDialog";
import ProductionPanel from "../components/ProductionPanel";
import useClaimedProduction from "../components/useClaimedProduction";
import {
  Clock, CheckCircle, Play, Flame,
  Search, RotateCcw, Trophy, AlertCircle,
  ChefHat, Power
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

function isKitchenItem(item) {
  const station = String(item.station || '').trim().toLowerCase();
  return !['barman', 'barista', 'shisha'].includes(station);
}

// ─── SHIFT SUMMARY MODAL ──────────────────────────────────────────────────────
function ShiftSummaryModal({ stats, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-xl p-6 text-center shadow-2xl text-zinc-900">
        <div className="w-16 h-16 bg-amber-500/10 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trophy size={32}/>
        </div>
        <h2 className="text-xl font-black uppercase italic mb-1">Service Recap</h2>
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-6 font-bold">End of Shift Summary</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-zinc-50 p-5 rounded-lg border border-zinc-200">
            <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Tickets</p>
            <p className="text-3xl font-black">{stats.totalOrders}</p>
          </div>
          <div className="bg-zinc-50 p-5 rounded-lg border border-zinc-200">
            <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Dishes</p>
            <p className="text-3xl font-black">{stats.totalItems}</p>
          </div>
        </div>

        {stats.chefs && stats.chefs.length > 0 && (
          <div className="mb-6 text-left space-y-2">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">Chef Breakdown</p>
            {stats.chefs.map(c => (
              <div key={c.chef} className="flex items-center justify-between bg-zinc-50 px-4 py-2.5 rounded-lg border border-zinc-200">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-700 flex items-center justify-center text-[9px] font-black">
                    {c.chef[0]}
                  </div>
                  <span className="font-black text-xs text-white uppercase">{c.chef}</span>
                </div>
                <span className="text-[10px] font-black text-amber-700">
                  {c.items_handled} dish{Number(c.items_handled) !== 1 ? "es" : ""}
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
function OrderCard({ order, onUpdateStatus, isProductionWorker, onProductionStatus, updatingWorkId }) {
  const minutesAgo = Math.floor((Date.now() - new Date(order.timestamp || order.created_at)) / 60000);
  const orderTotal = (order.items || []).reduce((total, item) => total + Number(item.price || item.unit_price || 0) * Number(item.quantity || 1), 0);
  const isDelayed   = minutesAgo >= 15 && order.status !== "Ready";
  const isReady     = order.status === "Ready";
  const isPreparing = order.status === "Preparing";

  const headerBg = isReady ? "bg-emerald-50" : isDelayed ? "bg-rose-50" : "bg-zinc-50";

  return (
    <div className={`flex flex-col rounded-xl border bg-white transition-all duration-300 h-[460px] overflow-hidden shadow-sm
      ${isReady ? "opacity-70 border-zinc-200" : isDelayed ? "border-rose-300" : "border-zinc-200"}`}>

      <div className={`p-4 shrink-0 ${headerBg} border-b border-zinc-100`}>
        <div className="flex justify-between items-start mb-2">
          <div><p className="text-xs font-black uppercase tracking-widest text-amber-800">Order #{order.id} · Table {order.table_name || order.tableName}</p><h2 className="mt-1 text-xl font-black text-zinc-900">{formatMoney(orderTotal)}</h2></div>
          <span className={`text-sm font-black italic flex items-center gap-1.5 px-3 py-1 rounded-full
            ${isDelayed ? "bg-rose-100 text-rose-800" : "bg-white border border-zinc-200 text-zinc-600"}`}>
            <Clock size={12}/> {minutesAgo}m
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border
            ${order.staff_role === "DIRECTOR"
              ? "bg-rose-50 border-rose-200 text-rose-700"
              : "bg-zinc-100 border-zinc-200 text-zinc-600"}`}>
            {order.staff_role || "WAITER"}
          </span>
          <p className="text-[10px] font-black uppercase text-zinc-500">
            {order.staff_name || order.waiterName || "Staff"}
          </p>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${isReady ? 'bg-emerald-100 text-emerald-800' : isPreparing ? 'bg-amber-100 text-amber-900' : 'bg-zinc-100 text-zinc-600'}`}>{order.status}</span>
          {isDelayed && (
            <span className="ml-auto flex items-center gap-1 text-[9px] font-black text-rose-700 uppercase">
              <AlertCircle size={10}/> Delayed
            </span>
          )}
        </div>
      </div>

      <div className="p-5 flex-grow overflow-y-auto space-y-3 custom-scrollbar">
        {order.items.map((item, idx) => (
          <div key={idx} className="border-b border-zinc-100 pb-3 last:border-0">
            <div className="flex justify-between items-start gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <span className="bg-amber-400 text-zinc-950 text-[10px] font-black px-1.5 py-0.5 rounded leading-none shrink-0 mt-0.5">
                  {item.quantity}x
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><p className={`font-black text-sm uppercase leading-tight ${isReady ? "line-through text-zinc-400" : "text-zinc-900"}`}>{item.name}</p><span className="shrink-0 text-xs font-semibold text-zinc-600">{formatMoney(Number(item.price || item.unit_price || 0) * Number(item.quantity || 1))}</span></div>
                  {item.note && (
                    <p className="text-[10px] text-rose-400 italic font-bold mt-1 bg-rose-500/5 p-1.5 rounded-lg">
                      "{item.note}"
                    </p>
                  )}
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>

      {!isProductionWorker && <div className="p-4 bg-zinc-50 border-t border-zinc-100 shrink-0">
        {!isProductionWorker && order.status === "Pending" && (
          <button onClick={() => onUpdateStatus(order.id, order._ticketId, "Preparing")}
            className="w-full py-3 bg-amber-400 text-zinc-950 font-black rounded-lg flex items-center justify-center gap-2 text-[11px] uppercase active:scale-95 transition-all shadow-sm">
            <Flame size={16}/> Start Fire
          </button>
        )}
        {!isProductionWorker && isPreparing && (
          <button onClick={() => onUpdateStatus(order.id, order._ticketId, "Ready")}
            className="w-full py-3 bg-emerald-600 text-white font-black rounded-lg flex items-center justify-center gap-2 text-[11px] uppercase active:scale-95 transition-all shadow-sm">
            <CheckCircle size={16}/> Dish Ready — Notify Waiter
          </button>
        )}
        {!isProductionWorker && isReady && (
          <button onClick={() => onUpdateStatus(order.id, order._ticketId, "Preparing")}
            className="w-full py-3 bg-white text-zinc-600 border border-zinc-200 font-black rounded-lg flex items-center justify-center gap-2 text-[11px] uppercase active:scale-95 transition-all">
            <RotateCcw size={14}/> Return to Preparing
          </button>
        )}
      </div>}
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
  const isProductionWorker = String(savedUser.role || '').toUpperCase() === 'CHEF';
  const {
    items: claimedWork,
    error: claimedWorkError,
    message: claimedWorkMessage,
  } = useClaimedProduction('kitchen', savedUser, false);
  const claimedWorkByOrder = useMemo(() => {
    const workByOrder = new Map();
    claimedWork.forEach(item => {
      if (item.status === 'Completed') return;
      const work = workByOrder.get(Number(item.order_id)) || new Map();
      work.set(Number(item.item_index), item);
      workByOrder.set(Number(item.order_id), work);
    });
    return workByOrder;
  }, [claimedWork]);
  const chefInitials = chefName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const handleLogout = () => setShowLogoutDialog(true);
  const confirmLogout = () => {
    setShowLogoutDialog(false);
    localStorage.removeItem("kurax_user");
    navigate("/staff/login");
  };

  const [audioEnabled,  setAudioEnabled]  = useState(false);
  const [showProduction, setShowProduction] = useState(false);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [showSummary,   setShowSummary]   = useState(false);
  const [shiftStats,    setShiftStats]    = useState({ totalOrders: 0, totalItems: 0, chefs: [] });
  const [ticketOrderIds, setTicketOrderIds] = useState([]);

  const ticketMapRef = useRef({});

  // ── Load today's tickets on mount ─────────────────────────────────────────
  useEffect(() => {
    if (isProductionWorker) return undefined;
    let mounted = true;
    const loadTickets = async () => {
      try {
        const res = await fetch(`${API_URL}/api/kitchen/tickets?active=true`);
        if (!res.ok) return;
        const rows = await res.json();
        if (!mounted) return;
        ticketMapRef.current = Object.fromEntries(rows.map(ticket => [ticket.order_id, ticket.id]));
        setTicketOrderIds(rows.map(ticket => Number(ticket.order_id)));
      } catch (e) { console.error("Load existing tickets:", e); }
    };
    loadTickets();
    const timer = setInterval(loadTickets, 10000);
    return () => { mounted = false; clearInterval(timer); };
  }, [isProductionWorker]);

  const isVisibleKitchenItem = item => isKitchenItem(item);

  // ── Filter: only kitchen-relevant, non-cleared, non-day-closed orders ──────
  // FIX: added day_cleared and shift_cleared checks so accountant close-day
  //      immediately empties the kitchen board without needing a manual refresh.
  const filteredOrders = useMemo(() =>
    (orders || [])
      .filter(order => {
        if (isProductionWorker) return false;
        // ── Status gate: only active kitchen statuses ──────────────────────
        const kitchenStatus = order.kitchen_ticket_status || "Pending";
        if (!["Pending", "Preparing"].includes(kitchenStatus)) return false;
        if (!ticketOrderIds.includes(Number(order.id))) return false;
        if (isProductionWorker && !claimedWorkByOrder.has(Number(order.id))) return false;

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
        if (!(order.items || []).some((item, index) => isVisibleKitchenItem(item)
          && (!isProductionWorker || claimedWorkByOrder.get(Number(order.id))?.has(Number(item?._orderItemIndex ?? index))))) return false;

        // ── Search filter ──────────────────────────────────────────────────
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (!(order.table_name || order.tableName || "").toLowerCase().includes(q) &&
              !String(order.id).includes(q)) return false;
        }

        return true;
      })
      .map(order => {
        const claimedItems = claimedWorkByOrder.get(Number(order.id)) || new Map();
        return {
          ...order,
          status: order.kitchen_ticket_status || "Pending",
          _ticketId: ticketMapRef.current[order.id] || null,
          items: (order.items || [])
            .map((item, index) => ({ ...item, _productionItemIndex: Number(item?._orderItemIndex ?? index) }))
            .filter((item, index) => isVisibleKitchenItem(item)
              && (!isProductionWorker || claimedItems.has(item._productionItemIndex)))
            .map(item => ({
              ...item,
              productionWork: isProductionWorker
                ? claimedItems.get(item._productionItemIndex)
                : null,
            })),
        };
      })
      .sort((a, b) => {
        const p = { Pending: 0, Preparing: 1, Ready: 2 };
        return (p[a.status] ?? 3) - (p[b.status] ?? 3);
      }),
  [orders, searchQuery, ticketOrderIds, isVisibleKitchenItem, isProductionWorker, claimedWorkByOrder]);

  // ── Audio: ding on new kitchen order ─────────────────────────────────────
  const prevLen = useRef(orders.length);
  const playDing = () => {
    new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3")
      .play().catch(() => setAudioEnabled(false));
  };
  useEffect(() => {
    if (orders.length > prevLen.current) {
      const latest = orders[orders.length - 1];
      const hasFood = (latest?.items || []).some(i => !["Barman", "Barista"].includes(i.station));
      if (latest?.status === "Pending" && hasFood && audioEnabled) playDing();
    }
    prevLen.current = orders.length;
  }, [orders, audioEnabled]);

  // ── Update status ─────────────────────────────────────────────────────────
  const updateStatus = useCallback(async (orderId, ticketId, newStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, kitchen_ticket_status: newStatus } : o));
    try {
      const tId = ticketId || ticketMapRef.current[orderId];
      if (tId) {
        const response = await fetch(`${API_URL}/api/kitchen/tickets/${tId}/status`, {
          method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${savedUser.token || ""}` },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!response.ok) throw new Error("Could not update Kitchen ticket status.");
      }
      refreshData?.();
    } catch (err) {
      console.error("Status update failed:", err);
      refreshData?.();
    }
  }, [setOrders, refreshData, savedUser.token]);

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
        ticketOrderIds.includes(Number(order.id)) &&
        ["Pending", "Preparing", "Ready"].includes(order.kitchen_ticket_status || "Pending") &&
        (order.items || []).some(isVisibleKitchenItem);
      return isKitchenActive ? { ...order, clearedByKitchen: true } : order;
    }));

    setShowSummary(false);
  };

  const pendingCount   = filteredOrders.filter(o => o.status === "Pending").length;
  const preparingCount = filteredOrders.filter(o => o.status === "Preparing").length;
  const readyCount     = orders.filter(order => ticketOrderIds.includes(Number(order.id)) &&
    order.kitchen_ticket_status === "Ready" && (order.items || []).some(isVisibleKitchenItem)).length;

  return (
    <div className="h-screen bg-[#f4f3ef] p-3 md:p-5 overflow-hidden flex flex-col font-[Outfit] relative text-zinc-900">
      <LogoutConfirmDialog
        open={showLogoutDialog}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutDialog(false)}
      />
      {showProduction && <ProductionPanel station="kitchen" user={savedUser} onClose={() => setShowProduction(false)} />}
      {claimedWorkError && isProductionWorker && <p role="alert" className="fixed left-4 top-4 z-40 rounded-lg bg-rose-100 px-4 py-2 text-xs font-bold text-rose-800">{claimedWorkError}</p>}
      {claimedWorkMessage && isProductionWorker && <p role="status" className="fixed left-4 top-14 z-40 rounded-lg bg-emerald-100 px-4 py-2 text-xs font-bold text-emerald-900">{claimedWorkMessage}</p>}

      {/* ── AUDIO GATE ── */}
      {!audioEnabled && !isProductionWorker && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 text-center">
          <div className="space-y-6">
            <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
              <ChefHat size={48} className="text-amber-700 animate-pulse"/>
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900">Kitchen Station</h2>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">Kurax Lounge &amp; Bistro</p>
            </div>
            <button onClick={() => { setAudioEnabled(true); playDing(); }}
              className="bg-amber-400 text-zinc-950 px-8 py-4 rounded-lg font-black uppercase hover:bg-amber-300 transition-colors flex items-center gap-3 mx-auto shadow-sm active:scale-95">
              <Play fill="currentColor" size={20}/> Open Kitchen Station
            </button>
          </div>
        </div>
      )}

      {showSummary && (
        <ShiftSummaryModal stats={shiftStats} onConfirm={confirmEndShift} onClose={() => setShowSummary(false)}/>
      )}
      <button onClick={() => setShowProduction(true)} className="fixed bottom-5 right-5 z-30 rounded-full bg-zinc-900 px-5 py-3 text-xs font-black uppercase tracking-wide text-white shadow-xl hover:bg-zinc-700">
        My Production
      </button>

      {/* ── HEADER ── */}
      <header className="flex flex-col lg:flex-row justify-between items-center mb-4 bg-white p-4 lg:px-6 rounded-xl border border-zinc-200 shadow-sm gap-3 shrink-0">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-amber-300 font-black text-lg shrink-0">
            {chefInitials}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black uppercase tracking-tight leading-none truncate text-zinc-900">{chefName}</h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Active Kitchen Session</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 text-[10px] font-black uppercase">
            <span className="w-2 h-2 rounded-full bg-zinc-400"/>
            <span className="text-zinc-400">{pendingCount} Pending</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-black uppercase">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"/>
            <span className="text-amber-800">{preparingCount} Cooking</span>
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

      {/* ── ORDERS GRID ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-16 custom-scrollbar flex-1">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-32 opacity-20">
            <ChefHat size={60} className="mb-4"/>
            <p className="text-sm font-black uppercase tracking-[0.3em]">{isProductionWorker ? "Station tickets are managed by the Kitchen HOD" : "Kitchen is Clear"}</p>
            {isProductionWorker && <button type="button" onClick={() => setShowProduction(true)} className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white">View my production history</button>}
          </div>
        ) : (
          filteredOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onUpdateStatus={updateStatus}
              isProductionWorker={savedUser.role === 'CHEF'}
            />
          ))
        )}
      </div>

    
    </div>
  );
}