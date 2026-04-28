import React, { useState, useEffect, useMemo } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import {
  AlertCircle, CheckCircle2, Clock, SearchX,
  Banknote, Timer, User, XCircle, ChefHat,
  BookOpen, Phone, Calendar, CheckCircle, TrendingUp,
  ShieldCheck, Zap, Sparkles, Activity
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

// ─── CATEGORIZE ───────────────────────────────────────────────────────────────
function categorize(order) {
  const status = (order.status || "").toLowerCase();

  let items = order.items || [];
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  if (!Array.isArray(items)) items = [];

  const orderLevelVoided = ["void", "voided", "cancelled", "cancel"].includes(status);
  const allItemsVoided   = items.length > 0 &&
    items.every(item => item.voidProcessed === true || item.status === "VOIDED");
  const anyItemVoided    = items.some(item => item.voidProcessed === true || item.status === "VOIDED");
  if (orderLevelVoided || allItemsVoided || anyItemVoided) return "Voided";

  if (status === "credit") return "Credited";

  const isClosedStatus =
    ["served", "paid", "mixed", "closed", "completed", "archived"].includes(status)
    || order.isArchived || order.isPaid || order.is_paid;
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
          if (!map[key] || new Date(row.assigned_at) > new Date(map[key].assigned_at)) {
            map[key] = row;
          }
        });
        setChefMap(map);
      } catch {}
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const [creditsLedger, setCreditsLedger] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/orders/credits`);
        if (!res.ok) return;
        const all = await res.json();
        const thisMonth = getCurrentMonth();
        setCreditsLedger(
          all.filter(r => {
            const d = r.created_at || r.confirmed_at;
            return d && toLocalDateStr(new Date(d)).substring(0, 7) === thisMonth;
          })
        );
      } catch {}
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

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
    creditsLedger.forEach(c => {
      const key = (c.table_name || "").trim().toUpperCase();
      if (!map[key] || new Date(c.created_at) > new Date(map[key].created_at)) {
        map[key] = c;
      }
    });
    return map;
  }, [creditsLedger]);

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

  const openOrders     = useMemo(() => todayOrders.filter(o => categorize(o) === "Open"),     [todayOrders]);
  const delayedOrders  = useMemo(() => todayOrders.filter(o => categorize(o) === "Delayed"),  [todayOrders]);
  const closedOrders   = useMemo(() => todayOrders.filter(o => categorize(o) === "Closed"),   [todayOrders]);
  const voidedOrders   = useMemo(() => todayOrders.filter(o => categorize(o) === "Voided"),   [todayOrders]);
  const creditedOrders = useMemo(() => creditsLedger, [creditsLedger]);

  const voidedCount = Math.max(voidedOrders.length, voidedLedger.length);

  const counts = {
    Open:     openOrders.length,
    Delayed:  delayedOrders.length,
    Closed:   closedOrders.length,
    Voided:   voidedCount,
    Credited: creditedOrders.length,
  };

  const mergedVoidedDisplay = useMemo(() => {
    const liveIds = new Set(voidedOrders.map(o => String(o.id || o.order_id)));
    const ledgerExtra = voidedLedger
      .filter(r => !liveIds.has(String(r.order_id || r.id)))
      .map(r => ({
        id:         r.order_id || r.id,
        table_name: r.table_name || r.table,
        staff_name: r.waiter_name || r.requested_by,
        status:     "Voided",
        total:      0,
        items:      [],
        timestamp:  r.created_at,
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
    { key: "Delayed",  label: "Delayed",   shortLabel: "Late",  icon: <AlertCircle size={13}/>,  color: "red",     gradient: "from-red-500 to-rose-500" },
    { key: "Open",     label: "Open",       shortLabel: "Open",  icon: <Activity size={13}/>,     color: "yellow",  gradient: "from-yellow-500 to-amber-500" },
    { key: "Closed",   label: "Confirmed",  shortLabel: "Done",  icon: <CheckCircle2 size={13}/>, color: "emerald", gradient: "from-emerald-500 to-teal-500" },
    { key: "Credited", label: "Credits",    shortLabel: "Credit",icon: <BookOpen size={13}/>,     color: "purple",  gradient: "from-purple-500 to-violet-500" },
    { key: "Voided",   label: "Voided",     shortLabel: "Void",  icon: <XCircle size={13}/>,      color: "gray",    gradient: "from-gray-500 to-gray-600" },
  ];

  const iconColor = { yellow: "text-yellow-500", red: "text-red-500", emerald: "text-emerald-500", purple: "text-purple-500", gray: "text-gray-500" };
  const badgeColor = {
    yellow:  isDark ? "bg-yellow-500/15 text-yellow-400"  : "bg-yellow-100 text-yellow-700",
    red:     "bg-red-500 text-white",
    emerald: isDark ? "bg-emerald-500/15 text-emerald-400": "bg-emerald-100 text-emerald-700",
    purple:  isDark ? "bg-purple-500/15 text-purple-400"  : "bg-purple-100 text-purple-700",
    gray:    isDark ? "bg-gray-700 text-gray-400"          : "bg-gray-200 text-gray-600",
  };

  return (
    <div
      className={`min-h-screen font-[Outfit] transition-colors duration-300
        ${isDark ? "bg-gradient-to-br from-zinc-950 to-black text-white" : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900"}`}
      style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
    >
      {/* ── Sticky header + tabs ─────────────────────────────────────────── */}
      <div
        className={`sticky top-0 z-20 px-4 pt-4 pb-2 ${isDark ? "bg-zinc-950/95 backdrop-blur-sm" : "bg-gray-50/95 backdrop-blur-sm"}`}
        style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
      >
        {/* Title row */}
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

        {/* Filter tabs — horizontally scrollable, no overflow clipping */}
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
                {/* Full label on sm+, short label on mobile */}
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

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 md:px-8">
        {filter === "Credited" ? (
          <CreditsPanel credits={creditedOrders} isDark={isDark} />
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
function CreditsPanel({ credits, isDark }) {
  const outstanding = credits.filter(c => !c.paid && !c.settled && c.status !== "settled");
  const settled     = credits.filter(c =>  c.paid ||  c.settled || c.status === "settled");

  const totalOut = outstanding.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalSet = settled.reduce((s, c)     => s + Number(c.amount || 0), 0);

  if (credits.length === 0) {
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
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl p-3 sm:p-4 border ${isDark ? "bg-purple-500/5 border-purple-500/20" : "bg-purple-50 border-purple-100"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-purple-600 mb-1">Outstanding</p>
          {/* Break number onto its own line to avoid overflow */}
          <p className="text-lg sm:text-2xl font-black text-purple-600 leading-tight break-all">
            UGX {totalOut.toLocaleString()}
          </p>
          <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            {outstanding.length} unpaid
          </p>
        </div>
        <div className={`rounded-xl p-3 sm:p-4 border ${isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-100"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600 mb-1">Settled</p>
          <p className="text-lg sm:text-2xl font-black text-emerald-600 leading-tight break-all">
            UGX {totalSet.toLocaleString()}
          </p>
          <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            {settled.length} cleared
          </p>
        </div>
      </div>

      {outstanding.length > 0 && (
        <div className="space-y-2">
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Outstanding · {outstanding.length}
          </p>
          {outstanding.map((c, i) => <CreditLedgerRow key={i} credit={c} isDark={isDark} isSettled={false}/>)}
        </div>
      )}

      {settled.length > 0 && (
        <div className="space-y-2">
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Settled · {settled.length}
          </p>
          {settled.map((c, i) => <CreditLedgerRow key={i} credit={c} isDark={isDark} isSettled={true}/>)}
        </div>
      )}

      <p className={`text-center text-[9px] font-bold uppercase tracking-widest pt-2 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
        Credits clear at month-end · Accountant settles outstanding credits
      </p>
    </div>
  );
}

function CreditLedgerRow({ credit, isDark, isSettled }) {
  const date    = credit.confirmed_at || credit.created_at;
  const dateStr = date
    ? new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (
    <div className={`rounded-xl border p-3 sm:p-4 transition-all hover:shadow-md
      ${isSettled
        ? isDark ? "bg-gray-900/20 border-gray-700/50 opacity-70" : "bg-gray-50 border-gray-200 opacity-70"
        : isDark ? "bg-purple-500/5 border-purple-500/20"         : "bg-purple-50/60 border-purple-200"}`}>

      {/* Stack on mobile: left info block above amount */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0
            ${isSettled ? "bg-emerald-500/10 text-emerald-500" : "bg-purple-500/10 text-purple-500"}`}>
            {isSettled ? <CheckCircle size={16}/> : <BookOpen size={16}/>}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <h3 className={`text-sm font-black uppercase tracking-tighter truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                {credit.table_name || "Table"}
              </h3>
              {isSettled ? (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[7px] font-black uppercase shrink-0">
                  <CheckCircle size={7}/> Settled
                </span>
              ) : (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 text-[7px] font-black uppercase shrink-0">
                  <Clock size={7}/> Outstanding
                </span>
              )}
            </div>

            <div className={`flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] font-bold uppercase tracking-wider
              ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              {credit.client_name && (
                <div className="flex items-center gap-1">
                  <User size={8}/><span className="truncate max-w-[100px]">{credit.client_name}</span>
                </div>
              )}
              {credit.client_phone && (
                <div className="flex items-center gap-1">
                  <Phone size={8}/><span>{credit.client_phone}</span>
                </div>
              )}
            </div>

            {credit.pay_by && !isSettled && (
              <div className="flex items-center gap-1 mt-1">
                <Calendar size={8} className="text-amber-500 shrink-0"/>
                <span className="text-[8px] font-black text-amber-600 uppercase tracking-wider">
                  Pay by: {credit.pay_by}
                </span>
              </div>
            )}
            <p className={`text-[7px] font-bold mt-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>{dateStr}</p>
          </div>
        </div>

        {/* Amount — right-aligned, won't overflow because flex shrink-0 */}
        <div className="text-right shrink-0">
          <p className={`text-sm sm:text-base font-black ${isSettled ? "text-emerald-600" : "text-purple-600"}`}>
            UGX {Number(credit.amount || 0).toLocaleString()}
          </p>
          {isSettled && credit.settle_method && (
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
  const total       = Number(order.total) || 0;
  const fromLedger  = order._fromLedger === true;

  let items = order.items || [];
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  if (!Array.isArray(items)) items = [];

  const voidedItems = items
    .filter(item => item.voidProcessed === true || item.status === "VOIDED")
    .map(item => {
      const key = `${order.id}::${item.name}`;
      const assignment = chefMap[key] || null;
      return { ...item, _assignedChef: assignment?.assigned_to || null };
    });

  const orderVoidReason = order.void_reason || order.reason;
  const isCreditSettled = creditInfo && (creditInfo.paid === true || creditInfo.paid === "t" || creditInfo.settled === true || creditInfo.status === "settled");

  const styles = {
    Delayed: {
      card:     isDark ? "bg-red-500/5 border-red-500/20"              : "bg-red-50 border-red-100",
      icon:     "bg-red-500/10 text-red-500",
      badge:    "bg-red-500/10 border-red-500/20 text-red-600",
      iconType: <AlertCircle size={18} />,
    },
    Closed: {
      card:     isDark ? "bg-gray-900/20 border-gray-700/50"           : "bg-white border-gray-200 shadow-sm",
      icon:     "bg-emerald-500/10 text-emerald-500",
      badge:    "bg-emerald-500/10 border-emerald-500/20 text-emerald-600",
      iconType: <CheckCircle2 size={18} />,
    },
    Credited: {
      card:     isDark ? "bg-purple-500/5 border-purple-500/20"         : "bg-purple-50 border-purple-100",
      icon:     isCreditSettled ? "bg-emerald-500/10 text-emerald-500"  : "bg-purple-500/10 text-purple-500",
      badge:    isCreditSettled ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-purple-500/10 border-purple-500/20 text-purple-600",
      iconType: isCreditSettled ? <CheckCircle size={18}/> : <BookOpen size={18}/>,
    },
    Voided: {
      card:     isDark ? "bg-gray-900/10 border-gray-700/50 opacity-80" : "bg-gray-100 border-gray-200",
      icon:     "bg-gray-500/10 text-gray-500",
      badge:    "bg-gray-500/20 border-gray-500/20 text-gray-600",
      iconType: <XCircle size={18} />,
    },
    Open: {
      card:     isDark ? "bg-gray-900/30 border-gray-700/50"            : "bg-white border-gray-200 shadow-sm",
      icon:     "bg-yellow-500/10 text-yellow-600",
      badge:    "bg-yellow-500/10 border-yellow-500/20 text-yellow-600",
      iconType: <Activity size={18} />,
    },
  };

  const s = styles[category] || styles.Open;
  const badgeLabel =
    category === "Voided"   ? "Cancelled" :
    category === "Credited" ? (isCreditSettled ? "Settled" : "Outstanding") :
    (order.status || category);

  return (
    <div className={`rounded-xl border p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 transition-all hover:shadow-md ${s.card}`}>

      {/* ── Top row ──────────────────────────────────────────────────────── */}
      {/* On mobile: icon + info on left, badge+timer stacked on right */}
      <div className="flex items-start gap-2 sm:gap-3">
        {/* Icon */}
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${s.icon}`}>
          {s.iconType}
        </div>

        {/* Table name + meta — takes remaining space */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {/* Left: name + order id */}
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
              <div className={`flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[9px] font-bold uppercase tracking-wider
                ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                <div className="flex items-center gap-1"><User size={8}/><span className="truncate max-w-[80px]">{waiterName}</span></div>
                {total > 0 && (
                  <div className="flex items-center gap-1">
                    <Banknote size={8}/>
                    <span>UGX {total.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: badge + timer — stacked, shrink-0 */}
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

      {/* ── Credit details ───────────────────────────────────────────────── */}
      {category === "Credited" && creditInfo && (
        <div className={`rounded-lg border divide-y overflow-hidden
          ${isDark ? "border-purple-500/20 divide-purple-500/10" : "border-purple-200 divide-purple-100"}`}>
          {creditInfo.client_name && (
            <div className={`flex items-center gap-2 px-3 py-2 ${isDark ? "bg-purple-500/5" : "bg-purple-50"}`}>
              <User size={10} className="text-gray-500 shrink-0"/>
              <span className={`text-[10px] font-bold truncate ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                {creditInfo.client_name}
              </span>
              {creditInfo.client_phone && (
                <span className={`text-[9px] ml-auto shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  {creditInfo.client_phone}
                </span>
              )}
            </div>
          )}
          {creditInfo.pay_by && !isCreditSettled && (
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

      {/* ── Voided items breakdown ───────────────────────────────────────── */}
      {category === "Voided" && (
        <div className={`rounded-lg border divide-y overflow-hidden
          ${isDark ? "border-gray-700/50 divide-gray-700/30" : "border-gray-200 divide-gray-100"}`}>

          {orderVoidReason && (
            <div className={`flex items-start gap-2 px-3 py-2 ${isDark ? "bg-gray-800/30" : "bg-gray-50"}`}>
              <AlertCircle size={11} className="text-gray-500 mt-0.5 shrink-0"/>
              <div className="min-w-0">
                <p className="text-[7px] font-black uppercase tracking-wider text-gray-500 mb-0.5">Order Void Reason</p>
                <p className={`text-[10px] font-bold italic break-words ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                  "{orderVoidReason}"
                </p>
              </div>
            </div>
          )}

          {voidedItems.length > 0 && (
            <>
              <div className={`px-3 py-1.5 ${isDark ? "bg-gray-800/20" : "bg-gray-100"}`}>
                <p className="text-[7px] font-black uppercase tracking-wider text-gray-500">
                  Voided Items ({voidedItems.length})
                </p>
              </div>
              {voidedItems.map((item, i) => (
                <div key={i} className={`px-3 py-2 ${isDark ? "bg-gray-900/20" : "bg-white"}`}>
                  {/* Stack item name and chef badge so neither truncates the other */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <XCircle size={10} className="text-red-400 shrink-0 mt-px"/>
                      <span className={`text-[10px] font-black truncate line-through
                        ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                        {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}
                      </span>
                    </div>
                    {/* Chef badge: fixed width, never expands */}
                    <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg border text-[7px] font-black uppercase shrink-0 max-w-[90px]
                      ${item._assignedChef
                        ? isDark ? "bg-orange-500/10 border-orange-500/20 text-orange-400" : "bg-orange-50 border-orange-200 text-orange-600"
                        : isDark ? "bg-gray-800 border-gray-700 text-gray-600"              : "bg-gray-100 border-gray-200 text-gray-400"
                      }`}>
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