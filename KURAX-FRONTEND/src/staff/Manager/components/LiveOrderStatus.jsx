import React, { useState, useEffect, useMemo } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import {
  AlertCircle, CheckCircle2, Clock, SearchX,
  Banknote, Timer, User, XCircle, ChefHat, ChevronDown,
  BookOpen, Phone, Calendar, CheckCircle, TrendingUp,
  ShieldCheck, Zap, Sparkles, Activity, Wallet, TrendingDown
} from "lucide-react";
import API_URL from "../../../config/api";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
function getTodayLocal() { return toLocalDateStr(new Date()); }
function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── CATEGORIZE ───────────────────────────────────────────────────────────────
function categorize(order) {
  const status = (order.status || "").toLowerCase();

  let items = order.items || [];
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  if (!Array.isArray(items)) items = [];

  const orderLevelVoided = ["void", "voided", "cancelled", "cancel"].includes(status);
  const allItemsVoided   = items.length > 0 && items.every(i => i.voidProcessed === true || i.status === "VOIDED");
  const anyItemVoided    = items.some(i => i.voidProcessed === true || i.status === "VOIDED");
  if (orderLevelVoided || allItemsVoided || anyItemVoided) return "Voided";

  if (status === "credit") {
    const isCreditApproved =
      order.credit_approved === true ||
      order.credit_status === "approved" ||
      order.credit_status === "Approved" ||
      order.credit_status === "settled"  ||
      order.credit_status === "Settled"  ||
      order.credit_status === "PartiallySettled";
    return isCreditApproved ? "Credited" : "Open";
  }

  const isClosedStatus =
    ["served","paid","mixed","closed","completed","archived"].includes(status) ||
    order.isArchived || order.isPaid || order.is_paid;
  if (isClosedStatus) return "Closed";

  const ts = order.timestamp || order.created_at || order.createdAt;
  const minsElapsed = ts ? Math.floor((Date.now() - new Date(ts)) / 60000) : 0;
  if (minsElapsed >= 30) return "Delayed";

  return "Open";
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function LiveOrderStatus() {
  const { orders = [] } = useData();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [filter, setFilter] = useState("Open");
  const [, setTick] = useState(0);
  const [refreshCredits, setRefreshCredits] = useState(0);

  const [chefMap, setChefMap] = useState({});
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/kitchen/chef-assignments`);
        if (!res.ok) return;
        const rows = await res.json();
        const map = {};
        rows.forEach(row => {
          const key = `${row.order_id}::${row.item_name}`;
          if (!map[key] || new Date(row.assigned_at) > new Date(map[key].assigned_at)) map[key] = row;
        });
        setChefMap(map);
      } catch {}
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  // ─── Credit state — three separate buckets ────────────────────────────────
  // withCashierCredits   : status === 'PendingCashier'         → read-only, cashier hasn't forwarded yet
  // pendingCredits       : status === 'PendingManagerApproval' → actionable, manager must approve/reject
  // approvedCredits      : status === 'Approved' / 'FullySettled' etc.
  // partiallySettledCredits : status === 'PartiallySettled'
  const [withCashierCredits,      setWithCashierCredits]      = useState([]);
  const [pendingCredits,           setPendingCredits]           = useState([]);
  const [approvedCredits,          setApprovedCredits]          = useState([]);
  const [partiallySettledCredits,  setPartiallySettledCredits]  = useState([]);

  const loadCredits = async () => {
    try {
      const res = await fetch(`${API_URL}/api/cashier-ops/credits`);
      if (!res.ok) return;
      const all = await res.json();
      const thisMonth = getCurrentMonth();

      const filtered = all.filter(r => {
        const d = r.created_at || r.confirmed_at;
        return d && toLocalDateStr(new Date(d)).substring(0, 7) === thisMonth;
      });

      // 1. Still with cashier — NOT yet forwarded to manager
      setWithCashierCredits(
        filtered.filter(r => r.status === "PendingCashier")
      );

      // 2. Forwarded to manager — actionable (approve / reject)
      setPendingCredits(
        filtered.filter(r =>
          r.status === "PendingManagerApproval" ||
          r.status === "PendingManager" ||
          r.status === "Pending" ||
          r.status === "pending"
        )
      );

      // 3. Partially settled
      setPartiallySettledCredits(
        filtered.filter(r =>
          r.status === "PartiallySettled" ||
          r.status === "partially_settled"
        )
      );

      // 4. Approved / fully settled
      setApprovedCredits(
        filtered.filter(r =>
          (r.status === "Approved"      ||
           r.status === "approved"      ||
           r.status === "FullySettled"  ||
           r.status === "settled"       ||
           r.status === "Settled"       ||
           r.credit_approved === true)  &&
          r.status !== "PartiallySettled"
        )
      );
    } catch {}
  };

  useEffect(() => {
    loadCredits();
    const id = setInterval(loadCredits, 30000);
    return () => clearInterval(id);
  }, [refreshCredits]);

  const [voidedLedger, setVoidedLedger] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        const today = getTodayLocal();
        const res = await fetch(`${API_URL}/api/orders/void-requests`);
        if (!res.ok) return;
        const rows = await res.json();
        setVoidedLedger(
          rows.filter(r => {
            const isApproved =
              r.status === "Approved" || r.status === "approved" ||
              r.voidProcessed === true || r.voidProcessed === "t";
            const d = r.created_at || r.resolved_at;
            return isApproved && d && toLocalDateStr(new Date(d)) === today;
          })
        );
      } catch {}
    };
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  const creditsByTable = useMemo(() => {
    const map = {};
    [...approvedCredits, ...partiallySettledCredits].forEach(c => {
      const key = (c.table_name || "").trim().toUpperCase();
      if (!map[key] || new Date(c.created_at) > new Date(map[key].created_at)) map[key] = c;
    });
    return map;
  }, [approvedCredits, partiallySettledCredits]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const [today] = useState(getTodayLocal);

  const todayOrders = useMemo(() =>
    (orders || []).filter(o => {
      const ts = o.timestamp || o.created_at || o.createdAt;
      if (!ts || toLocalDateStr(new Date(ts)) !== today) return false;
      const cleared =
        o.day_cleared   === true || o.day_cleared   === "t" || o.day_cleared   === "true" ||
        o.shift_cleared === true || o.shift_cleared === "t" || o.shift_cleared === "true";
      return !cleared;
    }),
  [orders, today]);

  const openOrders    = useMemo(() => todayOrders.filter(o => categorize(o) === "Open"),    [todayOrders]);
  const delayedOrders = useMemo(() => todayOrders.filter(o => categorize(o) === "Delayed"), [todayOrders]);
  const closedOrders  = useMemo(() => todayOrders.filter(o => categorize(o) === "Closed"),  [todayOrders]);
  const voidedOrders  = useMemo(() => todayOrders.filter(o => categorize(o) === "Voided"),  [todayOrders]);

  const creditedOrders = useMemo(
    () => [...approvedCredits, ...partiallySettledCredits],
    [approvedCredits, partiallySettledCredits]
  );

  const voidedCount = Math.max(voidedOrders.length, voidedLedger.length);

  // Credits tab badge = pending (needs action) + with cashier (in-progress)
  const creditsBadgeCount =
    pendingCredits.length + withCashierCredits.length + creditedOrders.length;

  const counts = {
    Open:     openOrders.length,
    Delayed:  delayedOrders.length,
    Closed:   closedOrders.length,
    Voided:   voidedCount,
    Credited: creditsBadgeCount,
  };

  const mergedVoidedDisplay = useMemo(() => {
    const liveIds = new Set(voidedOrders.map(o => String(o.id || o.order_id)));
    const ledgerExtra = voidedLedger
      .filter(r => !liveIds.has(String(r.order_id || r.id)))
      .map(r => ({
        id:          r.order_id || r.id,
        table_name:  r.table_name || r.table,
        staff_name:  r.waiter_name || r.requested_by,
        status:      "Voided",
        total:       0,
        items:       [],
        timestamp:   r.created_at,
        void_reason: r.reason,
        _fromLedger: true,
      }));
    return [...voidedOrders, ...ledgerExtra];
  }, [voidedOrders, voidedLedger]);

  const displayOrders =
    filter === "Open"     ? openOrders          :
    filter === "Delayed"  ? delayedOrders        :
    filter === "Voided"   ? mergedVoidedDisplay  :
    filter === "Credited" ? []                   :
    closedOrders;

  const TABS = [
    { key: "Delayed",  label: "Delayed",   shortLabel: "Late",   icon: <AlertCircle size={13}/>,  color: "red",     gradient: "from-red-500 to-rose-500" },
    { key: "Open",     label: "Open",       shortLabel: "Open",   icon: <Activity size={13}/>,     color: "yellow",  gradient: "from-yellow-500 to-amber-500" },
    { key: "Closed",   label: "Confirmed",  shortLabel: "Done",   icon: <CheckCircle2 size={13}/>, color: "emerald", gradient: "from-emerald-500 to-teal-500" },
    { key: "Credited", label: "Credits",    shortLabel: "Credit", icon: <BookOpen size={13}/>,     color: "purple",  gradient: "from-purple-500 to-violet-500" },
    { key: "Voided",   label: "Voided",     shortLabel: "Void",   icon: <XCircle size={13}/>,      color: "gray",    gradient: "from-gray-500 to-gray-600" },
  ];

  const iconColor  = { yellow: "text-yellow-500", red: "text-red-500", emerald: "text-emerald-500", purple: "text-purple-500", gray: "text-gray-500" };
  const badgeColor = {
    yellow:  isDark ? "bg-yellow-500/15 text-yellow-400"   : "bg-yellow-100 text-yellow-700",
    red:     "bg-red-500 text-white",
    emerald: isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-100 text-emerald-700",
    purple:  isDark ? "bg-purple-500/15 text-purple-400"   : "bg-purple-100 text-purple-700",
    gray:    isDark ? "bg-gray-700 text-gray-400"           : "bg-gray-200 text-gray-600",
  };

  return (
    <div
      className={`min-h-screen font-[Outfit] transition-colors duration-300
        ${isDark ? "bg-gradient-to-br from-zinc-950 to-black text-white" : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900"}`}
      style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
    >
      <div
        className={`sticky top-0 z-20 px-4 pt-4 pb-2 ${isDark ? "bg-zinc-950/95 backdrop-blur-sm" : "bg-gray-50/95 backdrop-blur-sm"}`}
        style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-yellow-500 rounded-full shrink-0" />
              <p className="text-[15px] sm:text-[20px] font-semibold uppercase tracking-[0.1em] sm:tracking-[0.15em] text-yellow-900 truncate">
                Operations Monitor
              </p>
            </div>
            <p className={`text-[11px] font-medium mt-0.5 ml-3 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
              Real-time order tracking
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-wider text-emerald-500 hidden xs:inline">Live</span>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
          {TABS.map(({ key, label, shortLabel, icon, color, gradient }) => {
            const isActive = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full
                  text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all duration-200 whitespace-nowrap shrink-0 min-h-[34px]
                  ${isActive
                    ? `bg-gradient-to-r ${gradient} text-white shadow-md`
                    : isDark
                      ? "text-gray-500 hover:bg-white/5 hover:text-white"
                      : "text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                  }`}
              >
                <span className={isActive ? "text-white" : iconColor[color]}>{icon}</span>
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{shortLabel}</span>
                {counts[key] > 0 && (
                  <span className={`min-w-[18px] h-[18px] rounded-full text-[8px] font-black flex items-center justify-center px-1
                    ${isActive ? "bg-white/25 text-white" : badgeColor[color]}`}>
                    {counts[key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-4 md:px-8">
        {filter === "Credited" ? (
          <CreditsPanel
            credits={creditedOrders}
            pendingCredits={pendingCredits}
            withCashierCredits={withCashierCredits}
            partiallySettledCredits={partiallySettledCredits}
            isDark={isDark}
            onRefresh={() => { loadCredits(); setRefreshCredits(prev => prev + 1); }}
          />
        ) : (
          <div className="space-y-3 md:space-y-4">
            {displayOrders.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center opacity-40">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
                  <SearchX size={32} strokeWidth={1.5} />
                </div>
                <p className="font-black uppercase italic tracking-[0.2em] text-sm">No {filter} Orders</p>
                <p className={`text-[9px] mt-2 font-medium uppercase tracking-wider ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                  All caught up! 🎉
                </p>
              </div>
            ) : (
              displayOrders
                .slice()
                .sort((a, b) => {
                  const tsA = a.timestamp || a.created_at || a.createdAt;
                  const tsB = b.timestamp || b.created_at || b.createdAt;
                  return filter === "Closed" || filter === "Voided"
                    ? new Date(tsB) - new Date(tsA)
                    : new Date(tsA) - new Date(tsB);
                })
                .map(order => (
                  <OrderStatusCard
                    key={order.id}
                    order={order}
                    category={categorize(order)}
                    isDark={isDark}
                    chefMap={chefMap}
                    creditInfo={creditsByTable[(order.table_name || order.tableName || "").trim().toUpperCase()] || null}
                  />
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CREDITS PANEL ────────────────────────────────────────────────────────────
function CreditsPanel({ credits, pendingCredits, withCashierCredits = [], partiallySettledCredits, isDark, onRefresh }) {
  const [expandedPendingId, setExpandedPendingId] = useState(null);
  const [rejectReason,       setRejectReason]       = useState("");
  const [actionLoading,      setActionLoading]      = useState(false);

  const { currentUser } = useData();
  const managerName = currentUser?.name || (() => {
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}").name || "Manager"; }
    catch { return "Manager"; }
  })();

  const handleApprove = async (creditId) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/manager/credits/${creditId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_by: managerName }),
      });
      if (res.ok) { onRefresh(); }
      else { const err = await res.json(); alert(err.error || "Failed to approve"); }
    } catch { alert("Network error"); }
    setActionLoading(false);
    setExpandedPendingId(null);
  };

  const handleReject = async (creditId) => {
    if (!rejectReason.trim()) { alert("Please enter a rejection reason"); return; }
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/manager/credits/${creditId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejected_by: managerName, reason: rejectReason.trim() }),
      });
      if (res.ok) { onRefresh(); }
      else { const err = await res.json(); alert(err.error || "Failed to reject"); }
    } catch { alert("Network error"); }
    setActionLoading(false);
    setExpandedPendingId(null);
    setRejectReason("");
  };

  // ─── Derived buckets ───────────────────────────────────────────────────────
  // outstanding = Approved, nothing paid yet
  const outstanding = credits.filter(c =>
    c.status === "Approved" && Number(c.amount_paid ?? 0) === 0
  );

  const partiallySettled = partiallySettledCredits;
  const totalPartialRemaining = partiallySettled.reduce((s, c) => s + Number(c.balance ?? (Number(c.amount ?? 0) - Number(c.amount_paid ?? 0))), 0);
  const totalPartialPaid      = partiallySettled.reduce((s, c) => s + Number(c.amount_paid ?? 0), 0);

  const fullySettled    = credits.filter(c => c.status === "FullySettled" || c.status === "settled" || c.status === "Settled");
  const totalFullySettled = fullySettled.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const totalSettledPaid  = totalFullySettled + totalPartialPaid;

  const rejected      = credits.filter(c => c.status === "Rejected");
  const totalRejected = rejected.reduce((s, c) => s + Number(c.amount ?? 0), 0);

  const totalOutstanding  = outstanding.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const totalWithCashier  = withCashierCredits.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const totalPending      = pendingCredits.reduce((s, c) => s + Number(c.amount ?? 0), 0);

  const hasAnything =
    credits.length > 0 || pendingCredits.length > 0 ||
    withCashierCredits.length > 0 || partiallySettledCredits.length > 0;

  if (!hasAnything) {
    return (
      <div className="py-24 flex flex-col items-center justify-center opacity-40">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
          <BookOpen size={32} strokeWidth={1.5} />
        </div>
        <p className="font-black uppercase italic tracking-[0.2em] text-sm">No Credits This Month</p>
        <p className={`text-[9px] mt-2 font-medium uppercase tracking-wider ${isDark ? "text-gray-600" : "text-gray-400"}`}>
          Credits clear automatically at month-end
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── SUMMARY CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">

        {/* With Cashier */}
        {withCashierCredits.length > 0 && (
          <div className={`rounded-xl p-3 sm:p-4 border ${isDark ? "bg-zinc-800/30 border-zinc-700/40" : "bg-zinc-50 border-zinc-200"}`}>
            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">With Cashier</p>
            <p className="text-lg sm:text-2xl font-black text-zinc-400 leading-tight break-all">
              UGX {totalWithCashier.toLocaleString()}
            </p>
            <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              {withCashierCredits.length} not yet forwarded
            </p>
            <p className="text-[7px] text-zinc-500/70 mt-1">Cashier hasn't sent to manager</p>
          </div>
        )}

        {/* Pending Approval */}
        {pendingCredits.length > 0 && (
          <div className={`rounded-xl p-3 sm:p-4 border ${isDark ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-50 border-amber-100"}`}>
            <p className="text-[8px] font-black uppercase tracking-widest text-amber-600 mb-1">Pending Approval</p>
            <p className="text-lg sm:text-2xl font-black text-amber-600 leading-tight break-all">
              UGX {totalPending.toLocaleString()}
            </p>
            <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              {pendingCredits.length} awaiting your decision
            </p>
          </div>
        )}

        {/* Outstanding */}
        <div className={`rounded-xl p-3 sm:p-4 border ${isDark ? "bg-purple-500/5 border-purple-500/20" : "bg-purple-50 border-purple-100"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-purple-600 mb-1">Outstanding</p>
          <p className="text-lg sm:text-2xl font-black text-purple-600 leading-tight break-all">
            UGX {totalOutstanding.toLocaleString()}
          </p>
          <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            {outstanding.length} credit{outstanding.length !== 1 ? "s" : ""} unpaid
          </p>
          <p className="text-[7px] text-purple-400/70 mt-1">Approved — awaiting payment</p>
        </div>

        {/* Partially Settled */}
        {partiallySettled.length > 0 && (
          <div className={`rounded-xl p-3 sm:p-4 border ${isDark ? "bg-orange-500/5 border-orange-500/20" : "bg-orange-50 border-orange-100"}`}>
            <p className="text-[8px] font-black uppercase tracking-widest text-orange-600 mb-1">Partially Settled</p>
            <p className="text-lg sm:text-2xl font-black text-orange-600 leading-tight break-all">
              UGX {totalPartialRemaining.toLocaleString()}
            </p>
            <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              {totalPartialPaid.toLocaleString()} paid · {partiallySettled.length} credits
            </p>
            <p className="text-[7px] text-orange-400/70 mt-1">Remaining to collect</p>
          </div>
        )}

        {/* Settled */}
        <div className={`rounded-xl p-3 sm:p-4 border ${isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-100"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600 mb-1">Total Settled</p>
          <p className="text-lg sm:text-2xl font-black text-emerald-600 leading-tight break-all">
            UGX {totalSettledPaid.toLocaleString()}
          </p>
          <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            {fullySettled.length + partiallySettled.length} credit{(fullySettled.length + partiallySettled.length) !== 1 ? "s" : ""} paid
          </p>
        </div>

        {/* Rejected */}
        {rejected.length > 0 && (
          <div className={`rounded-xl p-3 sm:p-4 border ${isDark ? "bg-red-500/5 border-red-500/20" : "bg-red-50 border-red-100"}`}>
            <p className="text-[8px] font-black uppercase tracking-widest text-red-600 mb-1">Rejected</p>
            <p className="text-lg sm:text-2xl font-black text-red-600 leading-tight break-all">
              UGX {totalRejected.toLocaleString()}
            </p>
            <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              {rejected.length} credit{rejected.length !== 1 ? "s" : ""} rejected
            </p>
          </div>
        )}
      </div>

      {/* ── WITH CASHIER — read-only, no actions ── */}
      {withCashierCredits.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-zinc-500" />
            <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              With Cashier · {withCashierCredits.length}
            </p>
            <span className={`text-[8px] font-bold ml-auto italic ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              Waiting for cashier to forward
            </span>
          </div>
          {withCashierCredits.map(credit => (
            <div key={credit.id}
              className={`border rounded-xl p-4 flex items-center justify-between gap-3 transition-all
                ${isDark ? "bg-zinc-900/30 border-white/5" : "bg-zinc-50 border-zinc-200"}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-lg shrink-0 ${isDark ? "bg-zinc-800 text-zinc-500" : "bg-zinc-200 text-zinc-400"}`}>
                  <Clock size={14} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`font-black text-sm uppercase ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {credit.table_name || "Table"}
                    </span>
                    <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase border
                      ${isDark ? "bg-zinc-800 text-zinc-500 border-zinc-700" : "bg-zinc-100 text-zinc-400 border-zinc-200"}`}>
                      With Cashier
                    </span>
                  </div>
                  <p className={`text-[9px] truncate ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                    {credit.client_name || credit.credit_name || "Client"}
                    {" · by "}
                    {credit.waiter_name || credit.requested_by || "Staff"}
                  </p>
                </div>
              </div>
              <p className={`text-sm font-black shrink-0 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                UGX {Number(credit.amount || 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── PENDING MANAGER APPROVAL — actionable ── */}
      {pendingCredits.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-amber-500" />
            <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Pending Your Approval · {pendingCredits.length}
            </p>
          </div>
          {pendingCredits.map(credit => (
            <div key={credit.id}
              className={`border rounded-xl overflow-hidden transition-all
                ${expandedPendingId === credit.id
                  ? "bg-purple-500/5 border-purple-500/30"
                  : isDark ? "bg-zinc-900/30 border-white/5" : "bg-white border-zinc-200"}`}>
              <button
                onClick={() => setExpandedPendingId(expandedPendingId === credit.id ? null : credit.id)}
                className="w-full p-4 flex items-center gap-3 text-left"
              >
                <div className={`p-2 rounded-lg border shrink-0
                  ${isDark ? "bg-black border-amber-500/20 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-500"}`}>
                  <Clock size={14} className="animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`font-black uppercase text-sm ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {credit.table_name || "Table"}
                    </span>
                    <span className={`text-[8px] px-2 py-0.5 rounded-full border font-bold uppercase
                      ${isDark ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-100 text-amber-600 border-amber-200"}`}>
                      Needs Approval
                    </span>
                  </div>
                  <p className={`text-[9px] font-bold truncate ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                    {credit.client_name || credit.credit_name || "Client"}
                    {" · by "}
                    {credit.waiter_name || credit.requested_by || "Staff"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-black ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                    UGX {Number(credit.amount || 0).toLocaleString()}
                  </p>
                </div>
                <ChevronDown size={14} className={`text-zinc-500 transition-transform shrink-0 ${expandedPendingId === credit.id ? "rotate-180" : ""}`} />
              </button>

              {expandedPendingId === credit.id && (
                <div className={`px-4 pb-4 space-y-3 border-t ${isDark ? "border-amber-500/10" : "border-amber-100"}`}>
                  <div className="pt-3 grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <p className="text-[8px] font-black text-zinc-600 uppercase">Client Info</p>
                      <div className="flex items-center gap-1.5">
                        <User size={10} className="text-amber-400"/>
                        <span className={`text-xs ${isDark ? "text-white" : "text-zinc-900"}`}>
                          {credit.client_name || credit.credit_name || "N/A"}
                        </span>
                      </div>
                      {(credit.client_phone || credit.credit_phone) && (
                        <div className="flex items-center gap-1.5">
                          <Phone size={10} className="text-amber-400"/>
                          <span className={`text-xs ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                            {credit.client_phone || credit.credit_phone}
                          </span>
                        </div>
                      )}
                      {(credit.pay_by || credit.credit_pay_by) && (
                        <div className="flex items-center gap-1.5">
                          <Calendar size={10} className="text-amber-400"/>
                          <span className={`text-xs ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                            Pay by: {credit.pay_by || credit.credit_pay_by}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[8px] font-black text-zinc-600 uppercase">Order Details</p>
                      <div className={`border rounded-lg p-2 text-center ${isDark ? "bg-black border-white/5" : "bg-zinc-50 border-zinc-200"}`}>
                        <p className="text-[8px] text-zinc-600 uppercase font-black">Credit Amount</p>
                        <p className={`text-base font-black ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                          UGX {Number(credit.amount || 0).toLocaleString()}
                        </p>
                      </div>
                      {credit.item_name && (
                        <p className="text-[9px] text-zinc-500">
                          Item: <span className={`font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{credit.item_name}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[8px] font-black text-red-400 uppercase mb-1">Rejection Reason</p>
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Required if rejecting…"
                      className={`w-full border rounded-lg p-2 text-xs resize-none
                        ${isDark ? "bg-black border-red-500/30 text-white placeholder:text-zinc-600" : "bg-white border-red-300 text-zinc-900"}`}
                      rows={2}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => handleReject(credit.id)}
                      disabled={actionLoading}
                      className="flex-1 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all disabled:opacity-50">
                      <XCircle size={14}/> Reject
                    </button>
                    <button
                      onClick={() => handleApprove(credit.id)}
                      disabled={actionLoading}
                      className="flex-[2] py-3 bg-emerald-500 text-black rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all disabled:opacity-50">
                      <CheckCircle size={14}/> Approve Credit
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── OUTSTANDING (approved, unpaid) ── */}
      {outstanding.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen size={12} className="text-purple-500"/>
            <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Outstanding Credits · {outstanding.length}
            </p>
          </div>
          {outstanding.map((c, i) => (
            <CreditLedgerRow key={`out-${i}`} credit={c} isDark={isDark} variant="outstanding"/>
          ))}
        </div>
      )}

      {/* ── PARTIALLY SETTLED ── */}
      {partiallySettled.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendingDown size={12} className="text-orange-500"/>
            <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Partially Settled · {partiallySettled.length}
            </p>
          </div>
          {partiallySettled.map((c, i) => (
            <CreditLedgerRow key={`partial-${i}`} credit={c} isDark={isDark} variant="partial"/>
          ))}
        </div>
      )}

      {/* ── FULLY SETTLED ── */}
      {fullySettled.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle size={12} className="text-emerald-500"/>
            <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Settled Credits · {fullySettled.length}
            </p>
          </div>
          {fullySettled.map((c, i) => (
            <CreditLedgerRow key={`set-${i}`} credit={c} isDark={isDark} variant="settled"/>
          ))}
        </div>
      )}

      {/* ── REJECTED ── */}
      {rejected.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <XCircle size={12} className="text-red-500"/>
            <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Rejected · {rejected.length}
            </p>
          </div>
          {rejected.map((c, i) => (
            <CreditLedgerRow key={`rej-${i}`} credit={c} isDark={isDark} variant="rejected"/>
          ))}
        </div>
      )}

      <p className={`text-center text-[9px] font-bold uppercase tracking-widest pt-2 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
        Credits clear at month-end · Accountant settles outstanding credits
      </p>
    </div>
  );
}

// ─── CREDIT LEDGER ROW ────────────────────────────────────────────────────────
// variant: 'outstanding' | 'partial' | 'settled' | 'rejected'
function CreditLedgerRow({ credit, isDark, variant }) {
  const date    = credit.confirmed_at || credit.created_at;
  const dateStr = date
    ? new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  const totalAmount      = Number(credit.amount      ?? 0);
  const amountPaid       = Number(credit.amount_paid ?? 0);
  const remainingBalance = Number(credit.balance     ?? (totalAmount - amountPaid));
  const percentPaid      = totalAmount > 0 ? (amountPaid / totalAmount) * 100 : 0;

  const styles = {
    outstanding: {
      bg:       isDark ? "bg-purple-500/5 border-purple-500/20"  : "bg-purple-50 border-purple-200",
      icon:     isDark ? "bg-purple-500/10 text-purple-500"      : "bg-purple-100 text-purple-600",
      iconEl:   <BookOpen size={16}/>,
      badge:    isDark ? "bg-purple-500/10 border-purple-500/20 text-purple-400" : "bg-purple-100 border-purple-200 text-purple-600",
      badgeTxt: "Outstanding",
      amount:   isDark ? "text-purple-400" : "text-purple-600",
    },
    partial: {
      bg:       isDark ? "bg-orange-500/5 border-orange-500/20"  : "bg-orange-50 border-orange-200",
      icon:     isDark ? "bg-orange-500/10 text-orange-500"      : "bg-orange-100 text-orange-600",
      iconEl:   <TrendingDown size={16}/>,
      badge:    isDark ? "bg-orange-500/10 border-orange-500/20 text-orange-400" : "bg-orange-100 border-orange-200 text-orange-600",
      badgeTxt: "Partially Settled",
      amount:   isDark ? "text-orange-400" : "text-orange-600",
    },
    settled: {
      bg:       isDark ? "bg-emerald-500/5 border-emerald-500/20 opacity-70" : "bg-emerald-50 border-emerald-200 opacity-70",
      icon:     isDark ? "bg-emerald-500/10 text-emerald-500"   : "bg-emerald-100 text-emerald-600",
      iconEl:   <CheckCircle size={16}/>,
      badge:    isDark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-emerald-100 border-emerald-200 text-emerald-600",
      badgeTxt: "Settled",
      amount:   isDark ? "text-emerald-400" : "text-emerald-600",
    },
    rejected: {
      bg:       isDark ? "bg-red-500/5 border-red-500/20"        : "bg-red-50 border-red-200",
      icon:     isDark ? "bg-red-500/10 text-red-500"            : "bg-red-100 text-red-600",
      iconEl:   <XCircle size={16}/>,
      badge:    isDark ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-red-100 border-red-200 text-red-600",
      badgeTxt: "Rejected",
      amount:   isDark ? "text-red-400" : "text-red-600",
    },
  };

  const s = styles[variant] || styles.outstanding;

  return (
    <div className={`rounded-xl border p-3 sm:p-4 transition-all hover:shadow-md ${s.bg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${s.icon}`}>
            {s.iconEl}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <h3 className={`text-sm font-black uppercase tracking-tighter truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                {credit.table_name || "Table"}
              </h3>
              <span className={`px-1.5 py-0.5 rounded-full border text-[7px] font-black uppercase shrink-0 ${s.badge}`}>
                {s.badgeTxt}
              </span>
            </div>

            <div className={`flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] font-bold uppercase tracking-wider
              ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              {(credit.client_name || credit.credit_name) && (
                <div className="flex items-center gap-1">
                  <User size={8}/>
                  <span className="truncate max-w-[100px]">{credit.client_name || credit.credit_name}</span>
                </div>
              )}
              {(credit.client_phone || credit.credit_phone) && (
                <div className="flex items-center gap-1">
                  <Phone size={8}/>
                  <span>{credit.client_phone || credit.credit_phone}</span>
                </div>
              )}
            </div>

            {variant === "partial" && (
              <div className="mt-2">
                <div className="flex justify-between text-[8px] mb-1">
                  <span className="text-gray-500">Paid:</span>
                  <span className="text-green-500 font-bold">UGX {amountPaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[8px] mb-1">
                  <span className="text-gray-500">Remaining:</span>
                  <span className="text-orange-500 font-bold">UGX {remainingBalance.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                  <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${percentPaid}%` }}/>
                </div>
                <p className="text-[7px] text-gray-500 mt-1 text-right">{Math.round(percentPaid)}% settled</p>
              </div>
            )}

            {(credit.pay_by || credit.credit_pay_by) && variant === "outstanding" && (
              <div className="flex items-center gap-1 mt-1">
                <Calendar size={8} className="text-amber-500 shrink-0"/>
                <span className="text-[8px] font-black text-amber-600 uppercase tracking-wider">
                  Pay by: {credit.pay_by || credit.credit_pay_by}
                </span>
              </div>
            )}

            <p className={`text-[7px] font-bold mt-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>{dateStr}</p>
          </div>
        </div>

        <div className="text-right shrink-0">
          {variant === "partial" ? (
            <>
              <p className={`text-sm sm:text-base font-black ${s.amount}`}>
                UGX {remainingBalance.toLocaleString()}
              </p>
              <p className={`text-[7px] font-bold mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                of UGX {totalAmount.toLocaleString()}
              </p>
            </>
          ) : (
            <p className={`text-sm sm:text-base font-black ${s.amount}`}>
              UGX {totalAmount.toLocaleString()}
            </p>
          )}
          {variant === "settled" && credit.settle_method && (
            <p className={`text-[7px] font-bold mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              via {credit.settle_method}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ORDER STATUS CARD ────────────────────────────────────────────────────────
function OrderStatusCard({ order, category, isDark, chefMap, creditInfo }) {
  const ts          = order.timestamp || order.created_at || order.createdAt;
  const minsElapsed = ts ? Math.floor((Date.now() - new Date(ts)) / 60000) : null;
  const tableName   = order.table_name  || order.tableName  || "Table";
  const waiterName  = order.staff_name  || order.waiterName || "Staff";
  const orderId     = order.id ? String(order.id).slice(-5) : "00000";
  const fromLedger  = order._fromLedger === true;

  let items = order.items || [];
  if (typeof items === "string") { try { items = JSON.parse(items); } catch { items = []; } }
  if (!Array.isArray(items)) items = [];

  let paidAmount = 0, pendingAmount = 0;
  items.forEach(item => {
    const isVoided = item.voidProcessed === true || item.status === "VOIDED";
    if (isVoided) return;
    const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
    if (item._rowPaid === true) paidAmount += itemTotal;
    else pendingAmount += itemTotal;
  });

  const isFullyPaid = items.filter(i => !(i.voidProcessed === true || i.status === "VOIDED")).every(i => i._rowPaid === true) && items.length > 0;

  const voidedItems = items
    .filter(item => item.voidProcessed === true || item.status === "VOIDED")
    .map(item => {
      const key = `${order.id}::${item.name}`;
      return { ...item, _assignedChef: chefMap[key]?.assigned_to || null };
    });

  const orderVoidReason = order.void_reason || order.reason;

  const isCreditSettled = creditInfo && (
    creditInfo.paid === true || creditInfo.paid === "t" ||
    creditInfo.settled === true || creditInfo.status === "settled" || creditInfo.status === "FullySettled"
  );
  const isCreditPartial    = creditInfo && creditInfo.status === "PartiallySettled";
  const remainingBalance   = creditInfo ? Number(creditInfo.balance    || 0) : 0;
  const amountPaid         = creditInfo ? Number(creditInfo.amount_paid || 0) : 0;
  const totalAmount        = creditInfo ? Number(creditInfo.amount      || 0) : 0;

  const styles = {
    Delayed:  { card: isDark ? "bg-red-500/5 border-red-500/20"              : "bg-red-50 border-red-100",        icon: "bg-red-500/10 text-red-500",       badge: "bg-red-500/10 border-red-500/20 text-red-600",         iconType: <AlertCircle size={18}/> },
    Closed:   { card: isDark ? "bg-gray-900/20 border-gray-700/50"           : "bg-white border-gray-200 shadow-sm", icon: "bg-emerald-500/10 text-emerald-500", badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600", iconType: <CheckCircle2 size={18}/> },
    Credited: {
      card:     isDark ? "bg-purple-500/5 border-purple-500/20" : "bg-purple-50 border-purple-100",
      icon:     isCreditSettled ? "bg-emerald-500/10 text-emerald-500" : isCreditPartial ? "bg-orange-500/10 text-orange-500" : "bg-purple-500/10 text-purple-500",
      badge:    isCreditSettled ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : isCreditPartial ? "bg-orange-500/10 border-orange-500/20 text-orange-600" : "bg-purple-500/10 border-purple-500/20 text-purple-600",
      iconType: isCreditSettled ? <CheckCircle size={18}/> : isCreditPartial ? <TrendingDown size={18}/> : <BookOpen size={18}/>,
    },
    Voided: { card: isDark ? "bg-gray-900/10 border-gray-700/50 opacity-80" : "bg-gray-100 border-gray-200",   icon: "bg-gray-500/10 text-gray-500",     badge: "bg-gray-500/20 border-gray-500/20 text-gray-600",       iconType: <XCircle size={18}/> },
    Open:   { card: isDark ? "bg-gray-900/30 border-gray-700/50"            : "bg-white border-gray-200 shadow-sm", icon: "bg-yellow-500/10 text-yellow-600", badge: "bg-yellow-500/10 border-yellow-500/20 text-yellow-600",  iconType: <Activity size={18}/> },
  };

  const s = styles[category] || styles.Open;

  let badgeLabel = category === "Voided" ? "Cancelled" : (order.status || category);
  if (category === "Credited") {
    badgeLabel = isCreditSettled ? "Settled" : isCreditPartial ? "Partial Settlement" : "Outstanding";
  } else if (category === "Open" || category === "Delayed") {
    if (paidAmount > 0 && pendingAmount > 0) badgeLabel = "Partially Paid";
    else if (isFullyPaid || (paidAmount > 0 && pendingAmount === 0)) badgeLabel = "Fully Paid";
  }

  return (
    <div className={`rounded-xl border p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 transition-all hover:shadow-md ${s.card}`}>
      <div className="flex items-start gap-2 sm:gap-3">
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${s.icon}`}>
          {s.iconType}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className={`text-sm sm:text-base font-black uppercase tracking-tighter leading-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                  {tableName}
                </h3>
                <span className={`text-[7px] sm:text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0
                  ${isDark ? "bg-gray-800 text-gray-500" : "bg-gray-100 text-gray-500"}`}>
                  #{orderId}
                </span>
              </div>
              <div className={`flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[9px] font-bold uppercase tracking-wider ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                <div className="flex items-center gap-1"><User size={8}/><span className="truncate max-w-[80px]">{waiterName}</span></div>
                {!fromLedger && (paidAmount > 0 || pendingAmount > 0) && (
                  <div className="flex items-center gap-1"><Banknote size={8}/><span>UGX {(paidAmount + pendingAmount).toLocaleString()}</span></div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[7px] sm:text-[8px] font-black uppercase tracking-wider border ${s.badge}`}>
                {badgeLabel}
              </span>
              {minsElapsed !== null && category !== "Credited" && (
                <div className={`flex items-center gap-0.5 text-[8px] font-black ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                  <Timer size={8}/><span>{minsElapsed}m</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {(category === "Open" || category === "Delayed") && !isFullyPaid && paidAmount > 0 && (
        <div className={`rounded-lg border overflow-hidden ${isDark ? "border-gray-700/30" : "border-gray-200"}`}>
          <div className={`flex flex-col gap-1.5 px-3 py-2 ${isDark ? "bg-gray-800/20" : "bg-gray-50"}`}>
            <div className="flex justify-between text-[9px]"><span className="text-gray-500">Paid:</span><span className="font-bold text-green-500">UGX {paidAmount.toLocaleString()}</span></div>
            <div className="flex justify-between text-[9px]"><span className="text-gray-500">Pending:</span><span className="font-bold text-orange-500">UGX {pendingAmount.toLocaleString()}</span></div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${(paidAmount / (paidAmount + pendingAmount)) * 100}%` }}/>
            </div>
            <p className="text-[8px] text-center text-gray-500 mt-1">{Math.round((paidAmount / (paidAmount + pendingAmount)) * 100)}% settled</p>
          </div>
        </div>
      )}

      {category === "Credited" && creditInfo && (
        <div className={`rounded-lg border divide-y overflow-hidden ${isDark ? "border-purple-500/20 divide-purple-500/10" : "border-purple-200 divide-purple-100"}`}>
          {creditInfo.client_name && (
            <div className={`flex items-center gap-2 px-3 py-2 ${isDark ? "bg-purple-500/5" : "bg-purple-50"}`}>
              <User size={10} className="text-gray-500 shrink-0"/>
              <span className={`text-[10px] font-bold truncate ${isDark ? "text-gray-300" : "text-gray-700"}`}>{creditInfo.client_name}</span>
              {creditInfo.client_phone && <span className={`text-[9px] ml-auto shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`}>{creditInfo.client_phone}</span>}
            </div>
          )}
          {isCreditPartial && (
            <div className={`px-3 py-2 space-y-1.5 ${isDark ? "bg-orange-500/5" : "bg-orange-50"}`}>
              <div className="flex justify-between text-[9px]"><span className="text-gray-500">Total Credit:</span><span className="font-bold">UGX {totalAmount.toLocaleString()}</span></div>
              <div className="flex justify-between text-[9px]"><span className="text-gray-500">Amount Paid:</span><span className="text-green-500 font-bold">UGX {amountPaid.toLocaleString()}</span></div>
              <div className="flex justify-between text-[9px]"><span className="text-gray-500">Remaining:</span><span className="text-orange-500 font-bold">UGX {remainingBalance.toLocaleString()}</span></div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1"><div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${(amountPaid / totalAmount) * 100}%` }}/></div>
              <p className="text-[8px] text-center text-gray-500 mt-1">{Math.round((amountPaid / totalAmount) * 100)}% settled</p>
            </div>
          )}
          {creditInfo.pay_by && !isCreditSettled && !isCreditPartial && (
            <div className={`flex items-center justify-between px-3 py-2 ${isDark ? "bg-amber-500/5" : "bg-amber-50"}`}>
              <span className="text-[8px] font-black uppercase tracking-wider text-amber-600">Pay by</span>
              <span className="text-[8px] font-black text-amber-600">{creditInfo.pay_by}</span>
            </div>
          )}
          {isCreditSettled && creditInfo.settle_method && (
            <div className={`flex items-center justify-between px-3 py-2 ${isDark ? "bg-emerald-500/5" : "bg-emerald-50"}`}>
              <span className="text-[8px] font-black uppercase tracking-wider text-emerald-600">Settled via</span>
              <span className="text-[8px] font-black text-emerald-600">{creditInfo.settle_method}</span>
            </div>
          )}
        </div>
      )}

      {category === "Voided" && (
        <div className={`rounded-lg border divide-y overflow-hidden ${isDark ? "border-gray-700/50 divide-gray-700/30" : "border-gray-200 divide-gray-100"}`}>
          {orderVoidReason && (
            <div className={`flex items-start gap-2 px-3 py-2 ${isDark ? "bg-gray-800/30" : "bg-gray-50"}`}>
              <AlertCircle size={11} className="text-gray-500 mt-0.5 shrink-0"/>
              <div className="min-w-0">
                <p className="text-[7px] font-black uppercase tracking-wider text-gray-500 mb-0.5">Void Reason</p>
                <p className={`text-[10px] font-bold italic break-words ${isDark ? "text-gray-300" : "text-gray-600"}`}>"{orderVoidReason}"</p>
              </div>
            </div>
          )}
          {voidedItems.length > 0 && (
            <>
              <div className={`px-3 py-1.5 ${isDark ? "bg-gray-800/20" : "bg-gray-100"}`}>
                <p className="text-[7px] font-black uppercase tracking-wider text-gray-500">Voided Items ({voidedItems.length})</p>
              </div>
              {voidedItems.map((item, i) => (
                <div key={i} className={`px-3 py-2 ${isDark ? "bg-gray-900/20" : "bg-white"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <XCircle size={10} className="text-red-400 shrink-0 mt-px"/>
                      <span className={`text-[10px] font-black truncate line-through ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                        {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}
                      </span>
                    </div>
                    <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg border text-[7px] font-black uppercase shrink-0 max-w-[90px]
                      ${item._assignedChef
                        ? isDark ? "bg-orange-500/10 border-orange-500/20 text-orange-400" : "bg-orange-50 border-orange-200 text-orange-600"
                        : isDark ? "bg-gray-800 border-gray-700 text-gray-600"             : "bg-gray-100 border-gray-200 text-gray-400"}`}>
                      <ChefHat size={8} className="shrink-0"/>
                      <span className="truncate">{item._assignedChef || "Unassigned"}</span>
                    </span>
                  </div>
                  {item.voidReason && (
                    <p className={`text-[8px] font-bold italic mt-1 pl-[22px] break-words ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                      "{item.voidReason}"
                    </p>
                  )}
                </div>
              ))}
            </>
          )}
          {!orderVoidReason && voidedItems.length === 0 && (
            <div className={`flex items-center gap-2 px-3 py-2 ${isDark ? "bg-gray-800/30" : "bg-gray-50"}`}>
              <AlertCircle size={11} className="text-gray-500 shrink-0"/>
              <p className={`text-[10px] font-bold italic ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                {fromLedger ? "Order cleared — void record archived" : "No reason recorded"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}