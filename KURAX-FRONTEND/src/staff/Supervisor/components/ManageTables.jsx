import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import {
  Utensils, ChevronUp, ChevronDown, CheckCircle,
  AlertTriangle, Clock, Receipt, Banknote,
  User, BookOpen, ClipboardList, Search, Hourglass,
  CheckCircle2, XCircle, CircleDollarSign
} from "lucide-react";
import API_URL from "../../../config/api";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(d.toLocaleString("en-US", { timeZone: "Africa/Nairobi" }))
    .toISOString().split("T")[0];
}
function getTodayLocal() { return toLocalDateStr(new Date()); }

function fmtUGX(n) {
  return `UGX ${Number(n || 0).toLocaleString()}`;
}

// ─── CREDIT STATUS HELPER ────────────────────────────────────────────────────
function getCreditStatusDisplay(credit) {
  const status = credit.status;
  const isFullySettled = status === "FullySettled" || credit.paid === true;
  const isPartiallySettled = status === "PartiallySettled";
  const isRejected = status === "Rejected";
  const isPendingManager = status === "PendingManagerApproval";
  const isPendingCashier = status === "PendingCashier";
  const isApproved = status === "Approved";

  if (isFullySettled) return { label: "Settled", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: <CheckCircle2 size={10} /> };
  if (isPartiallySettled) return { label: "Partially Settled", color: "text-yellow-500", bg: "bg-yellow-500/10", icon: <Clock size={10} /> };
  if (isRejected) return { label: "Rejected", color: "text-red-500", bg: "bg-red-500/10", icon: <XCircle size={10} /> };
  if (isPendingManager || isPendingCashier) return { label: "Pending Approval", color: "text-orange-500", bg: "bg-orange-500/10", icon: <Clock size={10} className="animate-pulse" /> };
  if (isApproved) return { label: "Approved", color: "text-purple-500", bg: "bg-purple-500/10", icon: <CheckCircle size={10} /> };
  return { label: "Outstanding", color: "text-purple-400", bg: "bg-purple-500/10", icon: <BookOpen size={10} /> };
}

// ─── SUPERVISOR ORDER CARD (read‑only) ─────────────────────────────────────
function SupervisorOrderCard({ order, theme }) {
  const [expanded, setExpanded] = useState(false);
  const isDark = theme === "dark";

  if (!order) return null;

  const nonVoidedItems = (order.items || []).filter(i => i.status !== "VOIDED" && !i.voidProcessed);
  const allItemsPaid = nonVoidedItems.length > 0 && nonVoidedItems.every(item => item._rowPaid === true);
  const hasAnyPaidItems = nonVoidedItems.some(item => item._rowPaid === true);
  const hasPendingVoid = (order.items || []).some(item => item.voidRequested === true && item.voidProcessed !== true);
  const hasPendingPayment = (order.items || []).some(item => item.paymentRequested === true && !item._rowPaid);

  // Status display
  let displayStatus = order.status;
  let displayColor = "text-zinc-400";
  let displayBg = "bg-zinc-500/10 border-zinc-500/20";
  let statusIcon = null;

  if (allItemsPaid) {
    displayStatus = "Paid";
    displayColor = "text-emerald-400";
    displayBg = "bg-emerald-500/10 border-emerald-500/20";
    statusIcon = <CheckCircle2 size={10} />;
  } else if (hasPendingVoid) {
    displayStatus = "Void Requested";
    displayColor = "text-orange-400";
    displayBg = "bg-orange-500/10 border-orange-500/20";
    statusIcon = <AlertTriangle size={10} />;
  } else if (hasPendingPayment) {
    displayStatus = "Payment Pending";
    displayColor = "text-yellow-400";
    displayBg = "bg-yellow-500/10 border-yellow-500/20";
    statusIcon = <Hourglass size={10} className="animate-pulse" />;
  } else if (order.status === "Served") {
    displayStatus = "Served";
    displayColor = "text-blue-400";
    displayBg = "bg-blue-500/10 border-blue-500/20";
    statusIcon = <Utensils size={10} />;
  } else if (order.status === "Ready") {
    displayStatus = "Ready";
    displayColor = "text-yellow-900";
    displayBg = "bg-yellow-400/10 border-yellow-400/30";
    statusIcon = <Clock size={10} />;
  }

  return (
    <div className={`rounded-xl sm:rounded-2xl border overflow-hidden transition-all duration-300 mb-4
      ${isDark ? "bg-zinc-900 border-white/5" : "bg-white border-black/5 shadow-sm"}`}>
      <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2 sm:pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className={`font-medium text-sm sm:text-base uppercase ${isDark ? "text-white" : "text-yellow-900"}`}>
              {order.tableName}
            </span>
            <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500">
              {nonVoidedItems.length} items · {fmtUGX(order.total || 0)}
              {order.waiterName && <span className="ml-2 text-zinc-400">· {order.waiterName}</span>}
            </p>
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl border text-[7px] sm:text-[8px] font-black uppercase ${displayBg} ${displayColor}`}>
            {statusIcon}
            <span className="w-1 h-1 rounded-full hidden sm:inline-block" /> {displayStatus}
          </div>
        </div>

        <button onClick={() => setExpanded(!expanded)}
          className={`mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all
            ${isDark ? "bg-white/5 text-zinc-400" : "bg-zinc-50 text-yellow-900"}`}>
          <Utensils size={10} /> {expanded ? "Hide Items" : "View Items"} {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      </div>

      {expanded && (
        <div className="px-3 sm:px-4 pb-3 space-y-2 border-t border-black/5 pt-3">
          {nonVoidedItems.map((item, i) => {
            const isPaid = item._rowPaid === true;
            const isPendingPayment = item.paymentRequested === true && !isPaid;
            const isCreditRequested = item.creditRequested === true;
            const isVoidRequested = item.voidRequested && !item.voidProcessed;
            return (
              <div key={i} className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? "bg-white/5" : "bg-zinc-50"}`}>
                <div className="flex justify-between items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-yellow-900 text-[10px] sm:text-[12px] break-words">
                        {item.name}
                        {isPaid && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[7px] sm:text-[8px] text-emerald-400 font-black uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                            <CheckCircle2 size={8} /> Paid
                          </span>
                        )}
                        {isVoidRequested && <span className="ml-1 sm:ml-2 text-[7px] sm:text-[8px] text-orange-400 font-black uppercase">(void pending)</span>}
                        {isPendingPayment && <span className="ml-1 sm:ml-2 text-[7px] sm:text-[8px] text-yellow-400 font-black uppercase">(payment pending)</span>}
                        {isCreditRequested && <span className="ml-1 sm:ml-2 text-[7px] sm:text-[8px] text-purple-400 font-black uppercase">(credit pending)</span>}
                      </p>
                      <p className="text-[8px] sm:text-[9px] font-bold text-zinc-600">
                        ×{item.quantity || 1} · {fmtUGX(item.price || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {(order.items || []).filter(item => item.status === "VOIDED" || item.voidProcessed).length > 0 && (
            <div className="mt-3 pt-2 border-t border-white/10">
              <p className="text-[7px] sm:text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-2">Voided Items</p>
              {(order.items || []).filter(item => item.status === "VOIDED" || item.voidProcessed).map((item, i) => (
                <div key={`voided-${i}`} className="p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div className="flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <p className="font-black text-[9px] sm:text-[11px] line-through text-zinc-500 break-words">{item.name}</p>
                      <p className="text-[7px] sm:text-[8px] font-bold text-zinc-500">×{item.quantity || 1} · {fmtUGX(item.price || 0)}</p>
                    </div>
                    <span className="text-[7px] sm:text-[8px] text-red-400 font-black shrink-0">VOIDED</span>
                  </div>
                  {item.voidReason && <p className="text-[6px] sm:text-[7px] text-zinc-500 mt-1 break-words">Reason: {item.voidReason}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PENDING VOIDS PANEL (with approve/reject) ─────────────────────────────
function PendingVoidsPanel({ pendingVoids, onApprove, onReject, theme }) {
  const isDark = theme === "dark";
  if (!pendingVoids || pendingVoids.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-28 gap-3 sm:gap-4">
        <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center
          ${isDark ? "bg-green-500/10 border border-green-500/20" : "bg-green-50 border border-green-100"}`}>
          <CheckCircle2 size={24} className="text-green-400/60"/>
        </div>
        <div className="text-center">
          <p className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>No pending void requests</p>
          <p className={`text-[8px] sm:text-[10px] mt-1 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>All clear</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingVoids.map((req) => (
        <div key={req.id} className={`p-4 rounded-xl border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-200"}`}>
          <div className="flex flex-col md:flex-row justify-between gap-3">
            <div>
              <p className="font-bold">Table: {req.table_name}</p>
              <p className="text-sm">Item: {req.item_name} × {req.quantity}</p>
              <p className="text-sm">Amount: {fmtUGX(req.amount)}</p>
              <p className="text-xs text-gray-400">Reason: {req.reason}</p>
              <p className="text-xs text-gray-400">Requested by: {req.requested_by}</p>
            </div>
            <div className="flex gap-2 self-start">
              <button
                onClick={() => onApprove('void', req.id)}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition"
              >
                <CheckCircle2 size={14} /> Approve
              </button>
              <button
                onClick={() => onReject('void', req.id)}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-red-500 text-white font-bold text-xs hover:bg-red-400 transition"
              >
                <XCircle size={14} /> Reject
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── PENDING CREDITS PANEL (with approve/reject) ───────────────────────────
function PendingCreditsPanel({ pendingCredits, onApprove, onReject, theme }) {
  const isDark = theme === "dark";
  if (!pendingCredits || pendingCredits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-28 gap-3 sm:gap-4">
        <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center
          ${isDark ? "bg-green-500/10 border border-green-500/20" : "bg-green-50 border border-green-100"}`}>
          <CheckCircle2 size={24} className="text-green-400/60"/>
        </div>
        <div className="text-center">
          <p className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>No pending credit approvals</p>
          <p className={`text-[8px] sm:text-[10px] mt-1 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>All clear</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingCredits.map((req) => {
        const sd = getCreditStatusDisplay(req);
        return (
          <div key={req.id} className={`p-4 rounded-xl border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-200"}`}>
            <div className="flex flex-col md:flex-row justify-between gap-3">
              <div>
                <p className="font-bold">Table: {req.table_name}</p>
                <p className="text-sm">Client: {req.client_name}</p>
                <p className="text-sm">Amount: {fmtUGX(req.amount)}</p>
                {req.pay_by && <p className="text-sm text-gray-400">Pay by: {req.pay_by}</p>}
                <p className="text-xs text-gray-400">Requested by: {req.requested_by}</p>
                <div className="flex items-center gap-1 mt-1">
                  {sd.icon} <span className={`text-xs font-bold ${sd.color}`}>{sd.label}</span>
                </div>
              </div>
              <div className="flex gap-2 self-start">
                <button
                  onClick={() => onApprove('credit', req.id)}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition"
                >
                  <CheckCircle2 size={14} /> Approve
                </button>
                <button
                  onClick={() => onReject('credit', req.id)}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-red-500 text-white font-bold text-xs hover:bg-red-400 transition"
                >
                  <XCircle size={14} /> Reject
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── RECENTLY PAID ITEMS PANEL (unchanged) ─────────────────────────────────
function RecentlyPaidItemsPanel({ orders, theme }) {
  const isDark = theme === "dark";
  const paidItems = useMemo(() => {
    const items = [];
    orders.forEach(order => {
      let orderItems = order.items || [];
      if (typeof orderItems === 'string') {
        try { orderItems = JSON.parse(orderItems); } catch { orderItems = []; }
      }
      orderItems.forEach(item => {
        if (item._rowPaid === true || item.paid_at) {
          items.push({
            id: `${order.id}_${item.name}`,
            order_id: order.id,
            table_name: order.table_name,
            name: item.name,
            quantity: item.quantity || 1,
            price: item.price || 0,
            total: (item.price || 0) * (item.quantity || 1),
            payment_method: item.payment_method || "Cash",
            paid_at: item.paid_at || new Date().toISOString(),
            timestamp: order.timestamp || order.created_at,
          });
        }
      });
    });
    items.sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at));
    return items;
  }, [orders]);

  if (paidItems.length === 0) {
    return (
      <div className={`rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-sm border ${isDark ? "bg-zinc-900 border-white/5" : "bg-white border-zinc-100"} text-center`}>
        <div className="flex flex-col items-center justify-center gap-3">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center ${isDark ? "bg-emerald-500/10" : "bg-emerald-50"}`}>
            <CheckCircle2 size={20} className="text-emerald-400" />
          </div>
          <p className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>No paid items yet</p>
          <p className="text-[8px] sm:text-[9px] text-zinc-400">Items paid by cashier will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border ${isDark ? "bg-zinc-900 border-white/5" : "bg-white border-zinc-100"}`}>
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-wrap">
        <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-emerald-500/10"><CheckCircle2 size={14} className="text-emerald-500" /></div>
        <h3 className={`text-xs sm:text-sm font-semibold uppercase tracking-tighter ${isDark ? "text-white" : "text-yellow-900"}`}>Paid Items History</h3>
        <span className="ml-auto text-[8px] sm:text-[10px] font-medium text-emerald-500 whitespace-nowrap">Total: {paidItems.length} items</span>
      </div>
      <div className="space-y-2 sm:space-y-3 max-h-96 overflow-y-auto">
        {paidItems.map((item, idx) => {
          const date = new Date(item.paid_at);
          const dateStr = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
          return (
            <div key={idx} className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? "bg-zinc-800/50" : "bg-zinc-50"}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-[10px] sm:text-[11px] font-medium break-words ${isDark ? "text-white" : "text-yellow-900"}`}>{item.name}</p>
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[6px] sm:text-[7px] font-black uppercase">Paid</span>
                  </div>
                  <p className={`text-[8px] sm:text-[9px] font-bold uppercase mt-1 ${isDark ? "text-zinc-900" : "text-zinc-600"}`}>
                    Table: {item.table_name || "WALK-IN"} · Order #{String(item.order_id).slice(-6)}
                  </p>
                  <div className="flex items-center gap-2 sm:gap-3 mt-1 flex-wrap">
                    <p className="text-[7px] sm:text-[8px] text-zinc-500">Qty: {item.quantity}</p>
                    <p className="text-[7px] sm:text-[8px] text-emerald-500">Paid via: {item.payment_method}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] sm:text-[11px] font-black text-emerald-500 whitespace-nowrap">{fmtUGX(item.total)}</p>
                  <p className="text-[7px] sm:text-[8px] text-zinc-500 mt-1">{dateStr}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function SupervisorDashboard() {
  const { orders = [], refreshData } = useData() || {};
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState("Live");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingVoids, setPendingVoids] = useState([]);
  const [pendingCredits, setPendingCredits] = useState([]);
  const [loading, setLoading] = useState(false);

  // ── Fetch pending approvals ──
  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      // Replace with your actual endpoints
      const [voidsRes, creditsRes] = await Promise.all([
        fetch(`${API_URL}/api/supervisor/pending-voids`),
        fetch(`${API_URL}/api/supervisor/pending-credits`),
      ]);
      if (voidsRes.ok) setPendingVoids(await voidsRes.json());
      else setPendingVoids([]);
      if (creditsRes.ok) setPendingCredits(await creditsRes.json());
      else setPendingCredits([]);
    } catch (err) {
      console.error("Error fetching pending approvals:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending, refreshData]);

  // ── Approval handlers ──
  const handleApprove = async (type, id) => {
    const endpoint = `${API_URL}/api/supervisor/approve-${type}`;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        alert(`${type} approved`);
        fetchPending();
        refreshData?.();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Error: ${err.error || "Unknown"}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    }
  };

  const handleReject = async (type, id) => {
    const reason = prompt("Enter rejection reason (optional):");
    const endpoint = `${API_URL}/api/supervisor/reject-${type}`;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reason: reason || "No reason" }),
      });
      if (res.ok) {
        alert(`${type} rejected`);
        fetchPending();
        refreshData?.();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Error: ${err.error || "Unknown"}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    }
  };

  // ── Group all orders by table (no staff filter) ──
  const groupedTableOrders = useMemo(() => {
    const groups = {};
    (orders || []).forEach(order => {
      const key = (order.table_name || order.tableName || "WALK-IN").trim().toUpperCase();
      if (!groups[key]) {
        groups[key] = {
          tableName: key,
          waiterName: order.staff_name || order.waiterName || "Unknown",
          total: 0,
          items: [],
          status: order.status || "Pending",
          orderIds: [],
          _rows: [],
        };
      }
      const g = groups[key];
      g.total += Number(order.total) || 0;
      g.orderIds.push(order.id);
      g._rows.push({ id: order.id, paid: order.status === "Paid" || order.is_paid });
      (order.items || []).forEach(item => {
        g.items.push({
          ...item,
          _orderId: order.id,
          _rowPaid: order.status === "Paid" || order.is_paid,
          voidRequested: item.voidRequested || false,
          voidProcessed: item.voidProcessed || false,
          paymentRequested: item.paymentRequested || false,
          creditRequested: item.creditRequested || false,
          voidReason: item.voidReason || null,
          voidedAt: item.voidedAt || null,
          tableName: key,
        });
      });
      const rank = { Paid: 7, Served: 6, Ready: 5, Delayed: 4, Preparing: 3, Pending: 2 };
      if ((rank[order.status] || 0) > (rank[g.status] || 0)) g.status = order.status;
    });
    Object.values(groups).forEach(g => {
      g.total = g.items.reduce((sum, item) => {
        if (item.status !== "VOIDED" && !item.voidProcessed) {
          return sum + (Number(item.price) * Number(item.quantity || 1));
        }
        return sum;
      }, 0);
    });
    return groups;
  }, [orders]);

  // ── Filter orders for Live / Served tabs ──
  const filteredOrders = useMemo(() => {
    const allGroups = Object.values(groupedTableOrders);
    return allGroups.filter(g => {
      const matchSearch = g.tableName.toLowerCase().includes(searchQuery.toLowerCase());
      const nonVoided = (g.items || []).filter(i => i.status !== "VOIDED" && !i.voidProcessed);
      const allPaid = nonVoided.length > 0 && nonVoided.every(i => i._rowPaid === true);
      const hasAnyPaid = nonVoided.some(i => i._rowPaid === true);
      const hasCreditItems = nonVoided.some(i => i.creditRequested === true);
      const isLive = !hasAnyPaid && !hasCreditItems && nonVoided.length > 0;
      const isServed = g.status === "Served" && !allPaid && nonVoided.length > 0;
      let matchTab = false;
      switch (activeTab) {
        case "Live": matchTab = isLive && nonVoided.length > 0; break;
        case "Served": matchTab = isServed; break;
        default: matchTab = false;
      }
      return matchSearch && matchTab;
    });
  }, [groupedTableOrders, searchQuery, activeTab]);

  // ── Counts for tabs ──
  const totalPaidItems = useMemo(() => {
    let count = 0;
    orders.forEach(order => {
      let orderItems = order.items || [];
      if (typeof orderItems === 'string') {
        try { orderItems = JSON.parse(orderItems); } catch { orderItems = []; }
      }
      orderItems.forEach(item => { if (item._rowPaid === true || item.paid_at) count++; });
    });
    return count;
  }, [orders]);

  const counts = useMemo(() => {
    const acc = { Live: 0, Served: 0, Paid: totalPaidItems, Credits: pendingCredits.length, Voided: pendingVoids.length };
    const allGroups = Object.values(groupedTableOrders);
    allGroups.forEach(g => {
      const nonVoided = (g.items || []).filter(i => i.status !== "VOIDED" && !i.voidProcessed);
      const allPaid = nonVoided.length > 0 && nonVoided.every(i => i._rowPaid === true);
      const hasAnyPaid = nonVoided.some(i => i._rowPaid === true);
      const hasCreditItems = nonVoided.some(i => i.creditRequested === true);
      const isLive = !hasAnyPaid && !hasCreditItems && nonVoided.length > 0;
      const isServed = g.status === "Served" && !allPaid && nonVoided.length > 0;
      if (isLive && nonVoided.length > 0) acc.Live++;
      if (isServed) acc.Served++;
    });
    return acc;
  }, [groupedTableOrders, pendingCredits, pendingVoids, totalPaidItems]);

  // ── Render ──
  return (
    <div className={`min-h-screen font-[Outfit] pb-20 sm:pb-28 ${isDark ? "bg-zinc-950 text-white" : "bg-zinc-50 text-zinc-900"}`}>
      {/* Header */}
      <div className={`sticky top-0 z-20 w-full border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between
        ${isDark ? "bg-zinc-950/80 backdrop-blur-xl border-white/5" : "bg-white/80 backdrop-blur-xl border-black/5"}`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-yellow-500 flex items-center justify-center font-black text-black shadow-lg shadow-yellow-500/20">
            S
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-yellow-900 uppercase tracking-tight truncate">
              Supervisor Dashboard
            </h1>
            <p className="text-[8px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {getTodayLocal()}
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
          <ClipboardList size={12} className="text-yellow-500" />
          <span className="text-[8px] font-semibold text-yellow-900 uppercase tracking-widest">
            {orders.length} Orders
          </span>
        </div>
      </div>

      <div className="px-4 sm:px-6 pt-6">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1 p-1 bg-white/5 rounded-xl sm:rounded-2xl border border-white/5 w-fit mb-4">
          {["Live", "Served", "Paid", "Credits", "Voided"].map(tab => {
            const isActive = activeTab === tab;
            const count = counts[tab] || 0;
            let activeStyles = "bg-yellow-500 text-black shadow-yellow-500/20";
            if (tab === "Voided")  activeStyles = "bg-red-500 text-white shadow-red-500/20";
            if (tab === "Credits") activeStyles = "bg-purple-500 text-white shadow-purple-500/20";
            if (tab === "Paid")    activeStyles = "bg-emerald-500 text-white shadow-emerald-500/20";
            const badgeStyles = isActive
              ? "bg-white/20 text-current"
              : isDark ? "bg-white/10 text-zinc-400" : "bg-black/5 text-zinc-500";
            return (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 sm:px-5 py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 sm:gap-2
                  ${isActive ? `${activeStyles} shadow-lg scale-[1.02]` : "text-zinc-500 hover:text-zinc-300"}`}>
                {tab}
                {count > 0 && <span className={`px-1 py-0.5 rounded-md text-[7px] sm:text-[9px] font-black leading-none ${badgeStyles}`}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
          <input
            type="text"
            placeholder="Search table name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl py-2 sm:py-3 pl-9 sm:pl-12 pr-3 sm:pr-4 text-xs sm:text-sm outline-none focus:border-yellow-500/50 transition-all text-white placeholder-zinc-500"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {activeTab === "Voided" && (
              <PendingVoidsPanel
                pendingVoids={pendingVoids}
                onApprove={handleApprove}
                onReject={handleReject}
                theme={theme}
              />
            )}
            {activeTab === "Credits" && (
              <PendingCreditsPanel
                pendingCredits={pendingCredits}
                onApprove={handleApprove}
                onReject={handleReject}
                theme={theme}
              />
            )}
            {activeTab === "Paid" && (
              <RecentlyPaidItemsPanel orders={orders} theme={theme} />
            )}
            {(activeTab === "Live" || activeTab === "Served") && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredOrders.map(order => (
                  <SupervisorOrderCard key={order.tableName} order={order} theme={theme} />
                ))}
                {filteredOrders.length === 0 && (
                  <div className="col-span-full py-20 sm:py-32 text-center opacity-30">
                    <div className="flex justify-center mb-3 sm:mb-4"><Utensils size={36} className="sm:w-12 sm:h-12" /></div>
                    <p className="font-black uppercase tracking-[0.3em] text-[10px] sm:text-xs">No {activeTab} Orders</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}