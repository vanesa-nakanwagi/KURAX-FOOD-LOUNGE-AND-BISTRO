import React, { useState, useEffect, useMemo } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import {
  AlertCircle, CheckCircle2, Clock, SearchX,
  Banknote, Timer, User, XCircle, ChefHat,
  BookOpen, Phone, Calendar, CheckCircle
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

  // 1. VOIDED — order-level, all items voided, OR any item voided (partial void)
  const orderLevelVoided = ["void", "voided", "cancelled", "cancel"].includes(status);
  const allItemsVoided   = items.length > 0 &&
    items.every(item => item.voidProcessed === true || item.status === "VOIDED");
  const anyItemVoided    = items.some(item => item.voidProcessed === true || item.status === "VOIDED");
  if (orderLevelVoided || allItemsVoided || anyItemVoided) return "Voided";

  // 2. CREDITED — status is credit, separate from Closed
  if (status === "credit") return "Credited";

  // 3. CLOSED
  const isClosedStatus =
    ["served", "paid", "mixed", "closed", "completed", "archived"].includes(status)
    || order.isArchived || order.isPaid || order.is_paid;
  if (isClosedStatus) return "Closed";

  // 4. DELAYED — open but 30+ minutes old
  const ts = order.timestamp || order.created_at || order.createdAt;
  const minsElapsed = ts ? Math.floor((Date.now() - new Date(ts)) / 60000) : 0;
  if (minsElapsed >= 30) return "Delayed";

  // 5. OPEN
  return "Open";
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function LiveOrderStatus() {
  const { orders = [] } = useData();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [filter, setFilter] = useState("Open");
  const [, setTick] = useState(0);

  // ── Chef assignments ─────────────────────────────────────────────────────
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

  // ── Credits ledger — current month only, polls every 30s ─────────────────
  // Persists across day-close (not filtered by day_cleared).
  // Clears automatically at month-end when getCurrentMonth() changes.
  // Each row has a status field: "outstanding" or "settled" (set by accountant).
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

  // ── voidedLedger — approved void_requests for today, persists after day_cleared ──
  // After accountant closes the day, orders get day_cleared=true and disappear
  // from todayOrders. The voidedLedger polls void_requests directly so the
  // Voided pill count + list stays intact even after day-close.
  const [voidedLedger, setVoidedLedger] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        const today = getTodayLocal();
        const res = await fetch(`${API_URL}/api/orders/void-requests`);
        if (!res.ok) return;
        const rows = await res.json();
        // Keep only approved voids from today
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

  // Build lookup: table_name → most recent credit ledger row
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

  // Tick every minute to refresh elapsed-time counters
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
  // Credited: use the credits ledger (current month) so it persists across day-close
  const creditedOrders = useMemo(() => creditsLedger, [creditsLedger]);

  // Voided count: take the larger of the two sources so it never drops to 0
  // after day-close (voidedLedger persists; voidedOrders disappears when day_cleared).
  const voidedCount = Math.max(voidedOrders.length, voidedLedger.length);

  const counts = {
    Open:     openOrders.length,
    Delayed:  delayedOrders.length,
    Closed:   closedOrders.length,
    Voided:   voidedCount,
    Credited: creditedOrders.length,
  };

  // For Voided: merge live voidedOrders + ledger-only rows that aren't in live orders.
  // De-dupe by order id so no row appears twice.
  const mergedVoidedDisplay = useMemo(() => {
    const liveIds = new Set(voidedOrders.map(o => String(o.id || o.order_id)));
    // ledger rows that don't have a matching live order
    const ledgerExtra = voidedLedger
      .filter(r => !liveIds.has(String(r.order_id || r.id)))
      .map(r => ({
        // normalise ledger row to look like an order for OrderStatusCard
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
    filter === "Credited" ? []                   : // Credits use a separate panel
    closedOrders;

  const TABS = [
    { key: "Delayed",  label: "Delayed",  icon: <AlertCircle size={13}/>,  alert: true,   color: "red"    },
    { key: "Open",     label: "Open",     icon: <Clock size={13}/>,         alert: false,  color: "yellow" },
    { key: "Closed",   label: "Confirmed",icon: <CheckCircle2 size={13}/>, alert: false,  color: "yellow" },
    { key: "Credited", label: "Credits",  icon: <BookOpen size={13}/>,     alert: false,  color: "purple" },
    { key: "Voided",   label: "Voided",   icon: <XCircle size={13}/>,      alert: false,  color: "yellow" },
  ];

  return (
    <div className={`p-4 md:p-8 space-y-6 md:space-y-8 pb-32 font-[Outfit] ${isDark ? "text-white" : "text-zinc-900"}`}>

      {/* HEADER */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-6 bg-yellow-500 rounded-full" />
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-yellow-500/80">Operations Monitor</p>
        </div>
        <h2 className={`text-3xl md:text-4xl font-black uppercase tracking-tighter italic ${isDark ? "text-white" : "text-zinc-900"}`}>
          Live Status
        </h2>
      </div>

      {/* FILTER TABS */}
      <div className={`flex p-1.5 rounded-[2rem] border w-full gap-1 overflow-x-auto no-scrollbar
        ${isDark ? "bg-zinc-900 border-white/5" : "bg-zinc-100 border-black/5"}`}>
        {TABS.map(({ key, label, icon, alert, color }) => {
          const isActive = filter === key;
          const activeBg =
            color === "purple" ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20" :
            color === "red"    ? "bg-red-500 text-white shadow-lg shadow-red-500/20" :
            "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20";
          const badgeColor =
            alert            ? "bg-red-500 text-white" :
            color === "purple" ? "bg-purple-500/20 text-purple-400" :
            isDark             ? "bg-zinc-700 text-zinc-300" : "bg-zinc-300 text-zinc-700";
          return (
            <button key={key} onClick={() => setFilter(key)}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 md:px-8 py-3 rounded-[1.5rem]
                text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap
                ${isActive ? activeBg : "text-zinc-500 hover:text-zinc-400"}`}>
              {icon}
              <span>{label}</span>
              {counts[key] > 0 && !isActive && (
                <span className={`w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center ${badgeColor}`}>
                  {counts[key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* CREDITS PANEL */}
      {filter === "Credited" ? (
        <CreditsPanel credits={creditedOrders} isDark={isDark} />
      ) : (
        /* ORDERS LIST */
        <div className="space-y-3 md:space-y-4">
          {displayOrders.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center opacity-20">
              <SearchX size={48} strokeWidth={1} />
              <p className="mt-4 font-black uppercase italic tracking-[0.2em] text-sm">
                No {filter} Orders
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
      <div className="py-24 flex flex-col items-center justify-center opacity-20">
        <BookOpen size={48} strokeWidth={1} />
        <p className="mt-4 font-black uppercase italic tracking-[0.2em] text-sm">
          No Credits This Month
        </p>
        <p className="text-[10px] mt-2 font-bold uppercase tracking-widest">
          Credits clear automatically at month-end
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-2xl border p-4 ${isDark ? "bg-purple-500/5 border-purple-500/20" : "bg-purple-50 border-purple-100"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-purple-400 mb-1">Outstanding</p>
          <p className="text-xl font-black text-purple-400">UGX {totalOut.toLocaleString()}</p>
          <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            {outstanding.length} unpaid
          </p>
        </div>
        <div className={`rounded-2xl border p-4 ${isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-100"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-emerald-400 mb-1">Settled</p>
          <p className="text-xl font-black text-emerald-400">UGX {totalSet.toLocaleString()}</p>
          <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            {settled.length} cleared
          </p>
        </div>
      </div>

      {/* Outstanding list */}
      {outstanding.length > 0 && (
        <div className="space-y-2">
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Outstanding · {outstanding.length}
          </p>
          {outstanding.map((c, i) => <CreditLedgerRow key={i} credit={c} isDark={isDark} isSettled={false}/>)}
        </div>
      )}

      {/* Settled list */}
      {settled.length > 0 && (
        <div className="space-y-2">
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Settled · {settled.length}
          </p>
          {settled.map((c, i) => <CreditLedgerRow key={i} credit={c} isDark={isDark} isSettled={true}/>)}
        </div>
      )}

      <p className={`text-center text-[9px] font-bold uppercase tracking-widest pt-2 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>
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
    <div className={`rounded-[1.5rem] md:rounded-[2.2rem] border p-4 md:p-5 flex items-start justify-between gap-3 transition-all
      ${isSettled
        ? isDark ? "bg-zinc-900/20 border-white/5 opacity-70" : "bg-zinc-50 border-black/5 opacity-70"
        : isDark ? "bg-purple-500/5 border-purple-500/20"     : "bg-purple-50/60 border-purple-200"}`}>

      <div className="flex items-start gap-3 md:gap-4 min-w-0 flex-1">
        {/* Icon */}
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0
          ${isSettled ? "bg-emerald-500/10 text-emerald-400" : "bg-purple-500/10 text-purple-400"}`}>
          {isSettled ? <CheckCircle size={20}/> : <BookOpen size={20}/>}
        </div>

        <div className="min-w-0 flex-1">
          {/* Table + status badge */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className={`text-base md:text-xl font-black uppercase tracking-tighter
              ${isDark ? "text-white" : "text-zinc-900"}`}>
              {credit.table_name || "Table"}
            </h3>
            {isSettled ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase">
                <CheckCircle size={8}/> Settled
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[8px] font-black uppercase animate-pulse">
                <Clock size={8}/> Outstanding
              </span>
            )}
          </div>

          {/* Client info */}
          <div className={`flex items-center gap-3 flex-wrap text-[10px] font-bold uppercase tracking-widest
            ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            {credit.client_name && (
              <div className="flex items-center gap-1">
                <User size={10}/>
                <span>{credit.client_name}</span>
              </div>
            )}
            {credit.client_phone && (
              <div className="flex items-center gap-1">
                <Phone size={10}/>
                <span>{credit.client_phone}</span>
              </div>
            )}
            {credit.requested_by && (
              <div className="flex items-center gap-1">
                <User size={10}/>
                <span className="normal-case">{credit.requested_by}</span>
              </div>
            )}
          </div>

          {/* Pay-by date */}
          {credit.pay_by && !isSettled && (
            <div className="flex items-center gap-1 mt-1">
              <Calendar size={9} className="text-amber-400 shrink-0"/>
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider">
                Pay by: {credit.pay_by}
              </span>
            </div>
          )}

          <p className={`text-[8px] font-bold mt-1 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>
            {dateStr}
          </p>
        </div>
      </div>

      {/* Amount + settlement note */}
      <div className="text-right shrink-0">
        <p className={`text-lg font-black ${isSettled ? "text-emerald-400" : "text-purple-400"}`}>
          UGX {Number(credit.amount || 0).toLocaleString()}
        </p>
        {isSettled && credit.settle_method && (
          <p className={`text-[8px] font-bold mt-0.5 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            via {credit.settle_method}
          </p>
        )}
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
  // _fromLedger = this row was synthesised from void_requests, not a real order
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

  // Credit settlement status from ledger
  const isCreditSettled = creditInfo && (creditInfo.paid === true || creditInfo.paid === "t" || creditInfo.settled === true || creditInfo.status === "settled");

  const styles = {
    Delayed: {
      card:     isDark ? "bg-red-500/5 border-red-500/20"          : "bg-red-50 border-red-100",
      icon:     "bg-red-500/10 text-red-400",
      badge:    "bg-red-500/10 border-red-500/20 text-red-400",
      iconType: <AlertCircle size={20} />,
    },
    Closed: {
      card:     isDark ? "bg-zinc-900/20 border-white/5"            : "bg-white border-black/5 shadow-sm",
      icon:     "bg-emerald-500/10 text-emerald-400",
      badge:    "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
      iconType: <CheckCircle2 size={20} />,
    },
    Credited: {
      card:     isDark ? "bg-purple-500/5 border-purple-500/20"     : "bg-purple-50 border-purple-100",
      icon:     isCreditSettled ? "bg-emerald-500/10 text-emerald-400" : "bg-purple-500/10 text-purple-400",
      badge:    isCreditSettled ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-purple-500/10 border-purple-500/20 text-purple-400",
      iconType: isCreditSettled ? <CheckCircle size={20}/> : <BookOpen size={20}/>,
    },
    Voided: {
      card:     isDark ? "bg-zinc-900/10 border-white/5 opacity-80" : "bg-zinc-100 border-black/10",
      icon:     "bg-zinc-500/10 text-zinc-400",
      badge:    "bg-zinc-500/20 border-zinc-500/20 text-zinc-500",
      iconType: <XCircle size={20} />,
    },
    Open: {
      card:     isDark ? "bg-zinc-900/30 border-white/5"            : "bg-white border-black/5 shadow-sm",
      icon:     "bg-yellow-500/10 text-yellow-400",
      badge:    "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
      iconType: <Clock size={20} />,
    },
  };

  const s = styles[category] || styles.Open;

  const badgeLabel =
    category === "Voided"   ? "Cancelled" :
    category === "Credited" ? (isCreditSettled ? "Settled" : "Outstanding") :
    (order.status || category);

  return (
    <div className={`rounded-[1.5rem] md:rounded-[2.2rem] border p-4 md:p-6 flex flex-col gap-4 transition-all ${s.card}`}>

      {/* ── TOP ROW ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 md:gap-5 min-w-0">
          <div className={`w-11 h-11 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 ${s.icon}`}>
            {s.iconType}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className={`text-base md:text-xl font-black uppercase tracking-tighter ${isDark ? "text-white" : "text-zinc-900"}`}>
                {tableName}
              </h3>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full
                ${isDark ? "bg-white/5 text-zinc-500" : "bg-zinc-100 text-zinc-500"}`}>
                #{orderId}
              </span>
            </div>
            <div className={`flex items-center gap-3 flex-wrap text-[10px] font-bold uppercase tracking-widest
              ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              <div className="flex items-center gap-1"><User size={10}/><span>{waiterName}</span></div>
              {total > 0 && (
                <div className="flex items-center gap-1">
                  <Banknote size={10}/>
                  <span>UGX {total.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className={`inline-block px-3 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest border mb-1.5 ${s.badge}`}>
            {badgeLabel}
          </span>
          {minsElapsed !== null && category !== "Credited" && (
            <div className="flex items-center justify-end gap-1 text-[9px] font-black opacity-40">
              <Timer size={10}/>
              <span>{minsElapsed}m</span>
            </div>
          )}
        </div>
      </div>

      {/* ── CREDIT DETAILS (inline on Confirmed tab) ── */}
      {category === "Credited" && creditInfo && (
        <div className={`rounded-xl border divide-y overflow-hidden
          ${isDark ? "border-purple-500/20 divide-purple-500/10" : "border-purple-200 divide-purple-100"}`}>
          {creditInfo.client_name && (
            <div className={`flex items-center gap-2 px-3 py-2.5 ${isDark ? "bg-purple-500/5" : "bg-purple-50"}`}>
              <User size={11} className="text-zinc-500 shrink-0"/>
              <span className={`text-[11px] font-bold ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                {creditInfo.client_name}
              </span>
              {creditInfo.client_phone && (
                <span className={`text-[10px] ml-auto ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                  {creditInfo.client_phone}
                </span>
              )}
            </div>
          )}
          {creditInfo.pay_by && !isCreditSettled && (
            <div className={`flex items-center justify-between px-3 py-2 ${isDark ? "bg-amber-500/5" : "bg-amber-50"}`}>
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">Pay by</span>
              <span className="text-[9px] font-black text-amber-400">{creditInfo.pay_by}</span>
            </div>
          )}
          {isCreditSettled && creditInfo.settle_method && (
            <div className={`flex items-center justify-between px-3 py-2 ${isDark ? "bg-emerald-500/5" : "bg-emerald-50"}`}>
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Settled via</span>
              <span className="text-[9px] font-black text-emerald-400">{creditInfo.settle_method}</span>
            </div>
          )}
        </div>
      )}

      {/* ── VOIDED ITEMS BREAKDOWN ── */}
      {category === "Voided" && (
        <div className={`rounded-xl border divide-y overflow-hidden
          ${isDark ? "border-white/5 divide-white/5" : "border-black/5 divide-black/5"}`}>

          {orderVoidReason && (
            <div className={`flex items-start gap-2 px-3 py-2.5 ${isDark ? "bg-white/4" : "bg-black/3"}`}>
              <AlertCircle size={13} className="text-zinc-500 mt-0.5 shrink-0"/>
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">
                  Order Void Reason
                </p>
                <p className={`text-[11px] font-bold italic ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                  "{orderVoidReason}"
                </p>
              </div>
            </div>
          )}

          {voidedItems.length > 0 && (
            <>
              <div className={`px-3 py-1.5 ${isDark ? "bg-white/3" : "bg-black/2"}`}>
                <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">
                  Voided Items ({voidedItems.length})
                </p>
              </div>
              {voidedItems.map((item, i) => (
                <div key={i} className={`px-3 py-2.5 flex flex-col gap-1 ${isDark ? "bg-white/2" : "bg-white"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <XCircle size={11} className="text-red-400 shrink-0"/>
                      <span className={`text-[11px] font-black truncate line-through
                        ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                        {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}
                      </span>
                    </div>
                    {item._assignedChef ? (
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[8px] font-black uppercase shrink-0
                        ${isDark ? "bg-orange-500/10 border-orange-500/20 text-orange-400" : "bg-orange-50 border-orange-200 text-orange-500"}`}>
                        <ChefHat size={9}/>{item._assignedChef}
                      </span>
                    ) : (
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[8px] font-black uppercase shrink-0
                        ${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-600" : "bg-zinc-100 border-zinc-200 text-zinc-400"}`}>
                        <ChefHat size={9}/>Unassigned
                      </span>
                    )}
                  </div>
                  {item.voidReason && (
                    <p className={`text-[9px] font-bold italic pl-[19px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                      "{item.voidReason}"
                    </p>
                  )}
                </div>
              ))}
            </>
          )}

          {!orderVoidReason && voidedItems.length === 0 && (
            <div className={`flex items-center gap-2 px-3 py-2.5 ${isDark ? "bg-white/4" : "bg-black/3"}`}>
              <AlertCircle size={13} className="text-zinc-500 shrink-0"/>
              <p className={`text-[11px] font-bold italic ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                {fromLedger
                  ? "Order cleared — void record archived"
                  : "No reason recorded"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}