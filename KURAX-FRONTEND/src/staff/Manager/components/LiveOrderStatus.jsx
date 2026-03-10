import React, { useState, useMemo, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import {
  AlertCircle, CheckCircle2, Clock, SearchX,
  Banknote, Timer, User, ChefHat
} from "lucide-react";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
}
function getTodayLocal() { return toLocalDateStr(new Date()); }

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function LiveOrderStatus() {
  const { orders = [] } = useData();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [filter, setFilter] = useState("Open");
  const [, setTick] = useState(0);

  // Tick every minute so delay timers stay current
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // Today resets at local midnight
  const [today, setToday] = useState(getTodayLocal);
  useEffect(() => {
    const schedule = () => {
      const now  = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const t    = setTimeout(() => { setToday(getTodayLocal()); schedule(); }, next - now);
      return t;
    };
    const t = schedule();
    return () => clearTimeout(t);
  }, []);

  // ── Filter today's orders only ─────────────────────────────────────────────
  const todayOrders = useMemo(() =>
    (orders || []).filter(o => {
      const ts = o.timestamp || o.created_at || o.createdAt;
      return ts && toLocalDateStr(new Date(ts)) === today;
    }),
  [orders, today]);

  // ── Categorize ────────────────────────────────────────────────────────────
  // Open:    Pending | Preparing | Delayed (not yet served)
  // Delayed: >30 mins + still open
  // Closed:  Served | Paid | Mixed | Credit | Closed | Completed | Archived
  const categorize = (order) => {
    const ts = order.timestamp || order.created_at || order.createdAt;
    const minsElapsed = ts ? Math.floor((Date.now() - new Date(ts)) / 60000) : 0;

    const isClosedStatus = ["Served","Paid","Mixed","Credit","Closed","Completed","Archived"].includes(order.status)
                        || order.isArchived || order.isPaid || order.is_paid;

    if (isClosedStatus) return "Closed";

    const isDelayed = minsElapsed >= 30 && !isClosedStatus;
    if (isDelayed) return "Delayed";

    return "Open";
  };

  const openOrders    = useMemo(() => todayOrders.filter(o => categorize(o) === "Open"),    [todayOrders]);
  const delayedOrders = useMemo(() => todayOrders.filter(o => categorize(o) === "Delayed"), [todayOrders]);
  const closedOrders  = useMemo(() => todayOrders.filter(o => categorize(o) === "Closed"),  [todayOrders]);

  const counts = {
    Open:    openOrders.length,
    Delayed: delayedOrders.length,
    Closed:  closedOrders.length,
  };

  const displayOrders =
    filter === "Open"    ? openOrders    :
    filter === "Delayed" ? delayedOrders :
    closedOrders;

  const TABS = [
    { key: "Delayed", label: "Delayed",    icon: <AlertCircle size={13}/>,  color: "text-red-500",     alert: true  },
    { key: "Open",    label: "Open",        icon: <Clock size={13}/>,         color: "text-yellow-500", alert: false },
    { key: "Closed",  label: "Confirmed",   icon: <CheckCircle2 size={13}/>, color: "text-emerald-500", alert: false },
  ];

  return (
    <div className={`p-4 md:p-8 space-y-6 md:space-y-8 pb-32 font-[Outfit] ${isDark ? "text-white" : "text-zinc-900"}`}>

      {/* HEADER */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-6 bg-yellow-500 rounded-full" />
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-yellow-500/80">Kitchen & Floor</p>
        </div>
        <h2 className={`text-3xl md:text-4xl font-black uppercase tracking-tighter italic ${isDark ? "text-white" : "text-zinc-900"}`}>
          Live Operations
        </h2>
        <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          Delayed = 30+ mins without resolution
        </p>
      </div>

      {/* FILTER TABS */}
      <div className={`flex p-1.5 rounded-[2rem] border w-full md:w-fit gap-1
        ${isDark ? "bg-zinc-900 border-white/5" : "bg-zinc-100 border-black/5"}`}>
        {TABS.map(({ key, label, icon, color, alert }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 md:px-8 py-3 rounded-[1.5rem]
              text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all
              ${filter === key ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20" : "text-zinc-500 hover:text-zinc-400"}`}>
            {icon}
            <span>{label}</span>
            {counts[key] > 0 && filter !== key && (
              <span className={`w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center
                ${alert ? "bg-red-500 text-white" : isDark ? "bg-zinc-700 text-zinc-300" : "bg-zinc-300 text-zinc-700"}`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ORDERS LIST */}
      <div className="space-y-3 md:space-y-4">
        {displayOrders.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center opacity-20">
            <SearchX size={48} strokeWidth={1} />
            <p className="mt-4 font-black uppercase italic tracking-[0.2em] text-sm">
              No {filter} Orders Today
            </p>
          </div>
        ) : (
          displayOrders
            // Sort: delayed by age descending (most delayed first), closed by time descending
            .slice()
            .sort((a, b) => {
              const tsA = a.timestamp || a.created_at || a.createdAt;
              const tsB = b.timestamp || b.created_at || b.createdAt;
              return new Date(tsA) - new Date(tsB); // oldest first (most urgent)
            })
            .map(order => (
              <OrderStatusCard key={order.id} order={order} filter={filter} isDark={isDark} />
            ))
        )}
      </div>
    </div>
  );
}

// ─── ORDER STATUS CARD ────────────────────────────────────────────────────────
function OrderStatusCard({ order, filter, isDark }) {
  const ts          = order.timestamp || order.created_at || order.createdAt;
  const minsElapsed = ts ? Math.floor((Date.now() - new Date(ts)) / 60000) : null;
  const tableName   = order.table_name || order.tableName || order.tableNumber || "Table";
  const waiterName  = order.staff_name || order.waiterName || "Staff";
  const orderId     = order.id ? String(order.id).slice(-5) : "00000";
  const total       = Number(order.total) || 0;
  const itemCount   = (order.items || []).length;

  const isDelayed = filter === "Delayed";
  const isClosed  = filter === "Closed";

  const cardStyle =
    isDelayed ? isDark ? "bg-red-500/5 border-red-500/30"       : "bg-red-50 border-red-200 shadow-sm" :
    isClosed  ? isDark ? "bg-zinc-900/20 border-white/5"        : "bg-white border-black/5 shadow-sm"  :
                isDark ? "bg-zinc-900/30 border-white/5"        : "bg-white border-black/5 shadow-sm";

  const iconBg =
    isDelayed ? "bg-red-500/10 text-red-400"      :
    isClosed  ? "bg-emerald-500/10 text-emerald-400" :
    "bg-yellow-500/10 text-yellow-400";

  const icon =
    isDelayed ? <AlertCircle size={20} />  :
    isClosed  ? <CheckCircle2 size={20} /> :
    <Clock size={20} />;

  return (
    <div className={`rounded-[1.5rem] md:rounded-[2.5rem] border p-4 md:p-6 flex items-center justify-between gap-4 transition-all ${cardStyle}`}>

      {/* Left: icon + info */}
      <div className="flex items-center gap-3 md:gap-5 min-w-0">
        <div className={`w-11 h-11 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>

        <div className="min-w-0">
          {/* Table + order ID */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className={`text-base md:text-xl font-black uppercase tracking-tighter ${isDark ? "text-white" : "text-zinc-900"}`}>
              {tableName}
            </h3>
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full
              ${isDark ? "bg-white/5 text-zinc-500" : "bg-zinc-100 text-zinc-500"}`}>
              #{orderId}
            </span>
          </div>

          {/* Meta row */}
          <div className={`flex items-center gap-3 flex-wrap text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            <div className="flex items-center gap-1">
              <User size={10} />
              <span>{waiterName}</span>
            </div>
            {itemCount > 0 && (
              <div className="flex items-center gap-1">
                <ChefHat size={10} />
                <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
              </div>
            )}
            {total > 0 && (
              <div className="flex items-center gap-1">
                <Banknote size={10} />
                <span>UGX {total.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Items preview on mobile */}
          {(order.items || []).length > 0 && (
            <p className={`text-[9px] mt-1 truncate max-w-[200px] font-bold md:hidden ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              {order.items.map(i => i.name).join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Right: status badge + timer */}
      <div className="text-right shrink-0 space-y-1.5">
        <span className={`inline-block px-3 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest border
          ${isDelayed ? "bg-red-500/10 border-red-500/20 text-red-400"               :
            isClosed  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"   :
            "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"}`}>
          {isClosed
            ? (order.status === "Paid" || order.is_paid || order.isPaid) ? "Paid"
              : order.status === "Credit" ? "Credit"
              : "Served"
            : isDelayed ? "Overdue"
            : order.status || "Open"}
        </span>

        {minsElapsed !== null && (
          <div className={`flex items-center justify-end gap-1 text-[9px] font-black
            ${isDelayed ? "text-red-400" : isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            <Timer size={10} />
            {minsElapsed < 60
              ? `${minsElapsed}m ago`
              : `${Math.floor(minsElapsed/60)}h ${minsElapsed%60}m`}
          </div>
        )}
      </div>
    </div>
  );
}