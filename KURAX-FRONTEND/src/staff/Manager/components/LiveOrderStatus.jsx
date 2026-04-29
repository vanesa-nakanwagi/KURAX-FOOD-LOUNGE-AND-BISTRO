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
    { key: "Delayed",  label: "Delayed",  icon: <AlertCircle size={14}/>,  alert: true,   color: "red",    gradient: "from-red-500 to-rose-500" },
    { key: "Open",     label: "Open",     icon: <Activity size={14}/>,      alert: false,  color: "yellow", gradient: "from-yellow-500 to-amber-500" },
    { key: "Closed",   label: "Confirmed",icon: <CheckCircle2 size={14}/>, alert: false,  color: "emerald",gradient: "from-emerald-500 to-teal-500" },
    { key: "Credited", label: "Credits",  icon: <BookOpen size={14}/>,     alert: false,  color: "purple", gradient: "from-purple-500 to-violet-500" },
    { key: "Voided",   label: "Voided",   icon: <XCircle size={14}/>,      alert: false,  color: "gray",   gradient: "from-gray-500 to-gray-600" },
  ];

  return (
    <div className={`min-h-screen p-4 md:p-8 space-y-6 md:space-y-8 pb-32 font-[Outfit] transition-colors duration-300
      ${isDark ? "bg-gradient-to-br from-zinc-950 to-black text-white" : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900"}`}>

      {/* HEADER with Live Indicator */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-yellow-500 rounded-full" />
            <p className="text-[20px] font-semibold uppercase tracking-[0.15em] text-yellow-900">Operations Monitor</p>
          </div>
          
          <p className={`text-[13px] font-medium mt-1 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
            Real-time order tracking & monitoring
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[8px] font-black uppercase tracking-wider text-emerald-500">Live Updates</span>
        </div>
      </div>

     {/* FILTER TABS - Naked tabs without container background */}
<div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
  {TABS.map(({ key, label, icon, alert, color, gradient }) => {
    const isActive = filter === key;
    const activeBg = `bg-gradient-to-r ${gradient} text-white shadow-md`;
    const badgeColor = alert ? "bg-red-500 text-white" :
      color === "purple" ? "bg-purple-500/20 text-purple-600" :
      color === "emerald" ? "bg-emerald-500/20 text-emerald-600" :
      isDark ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700";
    
    return (
      <button 
        key={key} 
        onClick={() => setFilter(key)}
        className={`flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 rounded-full
          text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all duration-200 whitespace-nowrap
          ${isActive 
            ? activeBg 
            : isDark 
              ? "text-gray-500 hover:bg-white/5 hover:text-white" 
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          }`}
      >
        <span className={isActive ? "text-white" : color === "yellow" ? "text-yellow-500" : color === "red" ? "text-red-500" : color === "emerald" ? "text-emerald-500" : color === "purple" ? "text-purple-500" : "text-gray-500"}>
          {icon}
        </span>
        <span>{label}</span>
        {counts[key] > 0 && (
          <span className={`ml-1 min-w-[20px] h-5 rounded-full text-[9px] font-black flex items-center justify-center px-1.5
            ${isActive ? "bg-white/20 text-white" : badgeColor}`}>
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
            <div className="py-32 flex flex-col items-center justify-center opacity-40">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
                <SearchX size={40} strokeWidth={1.5} />
              </div>
              <p className="font-black uppercase italic tracking-[0.2em] text-sm">
                No {filter} Orders
              </p>
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
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ isDark, label, value, icon, color }) {
  const colors = {
    yellow: { bg: "bg-yellow-500/10", text: "text-yellow-600", border: "border-yellow-200" },
    red: { bg: "bg-red-500/10", text: "text-red-600", border: "border-red-200" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-200" },
    purple: { bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-200" },
    gray: { bg: "bg-gray-500/10", text: "text-gray-600", border: "border-gray-200" },
  };
  const c = colors[color];
  
  return (
    <div className={`rounded-xl p-3 border ${c.border} ${isDark ? "bg-black/20" : "bg-white"} shadow-sm transition-all hover:scale-[1.02] duration-200`}>
      <div className="flex items-center justify-between">
        <div className={`p-1.5 rounded-lg ${c.bg}`}>
          <span className={c.text}>{icon}</span>
        </div>
        <p className={`text-xl font-black ${c.text}`}>{value}</p>
      </div>
      <p className={`text-[8px] font-black uppercase tracking-wider mt-1.5 ${isDark ? "text-gray-500" : "text-gray-500"}`}>{label}</p>
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
      <div className="py-32 flex flex-col items-center justify-center opacity-40">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
          <BookOpen size={40} strokeWidth={1.5} />
        </div>
        <p className="font-black uppercase italic tracking-[0.2em] text-sm">
          No Credits This Month
        </p>
        <p className={`text-[9px] mt-2 font-medium uppercase tracking-wider ${isDark ? "text-gray-600" : "text-gray-400"}`}>
          Credits clear automatically at month-end
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl p-4 border ${isDark ? "bg-purple-500/5 border-purple-500/20" : "bg-purple-50 border-purple-100"} transition-all hover:scale-[1.02] duration-200`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-purple-600 mb-1">Outstanding</p>
          <p className="text-2xl font-black text-purple-600">UGX {totalOut.toLocaleString()}</p>
          <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            {outstanding.length} unpaid
          </p>
        </div>
        <div className={`rounded-xl p-4 border ${isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-100"} transition-all hover:scale-[1.02] duration-200`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600 mb-1">Settled</p>
          <p className="text-2xl font-black text-emerald-600">UGX {totalSet.toLocaleString()}</p>
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
    <div className={`rounded-xl border p-4 flex items-start justify-between gap-3 transition-all hover:shadow-md
      ${isSettled
        ? isDark ? "bg-gray-900/20 border-gray-700/50 opacity-70" : "bg-gray-50 border-gray-200 opacity-70"
        : isDark ? "bg-purple-500/5 border-purple-500/20"     : "bg-purple-50/60 border-purple-200"}`}>

      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
          ${isSettled ? "bg-emerald-500/10 text-emerald-500" : "bg-purple-500/10 text-purple-500"}`}>
          {isSettled ? <CheckCircle size={18}/> : <BookOpen size={18}/>}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className={`text-base font-black uppercase tracking-tighter ${isDark ? "text-white" : "text-gray-900"}`}>
              {credit.table_name || "Table"}
            </h3>
            {isSettled ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[8px] font-black uppercase">
                <CheckCircle size={8}/> Settled
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 text-[8px] font-black uppercase">
                <Clock size={8}/> Outstanding
              </span>
            )}
          </div>

          <div className={`flex items-center gap-3 flex-wrap text-[9px] font-bold uppercase tracking-wider
            ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            {credit.client_name && (
              <div className="flex items-center gap-1">
                <User size={9}/>
                <span>{credit.client_name}</span>
              </div>
            )}
            {credit.client_phone && (
              <div className="flex items-center gap-1">
                <Phone size={9}/>
                <span>{credit.client_phone}</span>
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

          <p className={`text-[7px] font-bold mt-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
            {dateStr}
          </p>
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className={`text-base font-black ${isSettled ? "text-emerald-600" : "text-purple-600"}`}>
          UGX {Number(credit.amount || 0).toLocaleString()}
        </p>
        {isSettled && credit.settle_method && (
          <p className={`text-[7px] font-bold mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
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
      card:     isDark ? "bg-red-500/5 border-red-500/20"          : "bg-red-50 border-red-100",
      icon:     "bg-red-500/10 text-red-500",
      badge:    "bg-red-500/10 border-red-500/20 text-red-600",
      iconType: <AlertCircle size={20} />,
    },
    Closed: {
      card:     isDark ? "bg-gray-900/20 border-gray-700/50"       : "bg-white border-gray-200 shadow-sm",
      icon:     "bg-emerald-500/10 text-emerald-500",
      badge:    "bg-emerald-500/10 border-emerald-500/20 text-emerald-600",
      iconType: <CheckCircle2 size={20} />,
    },
    Credited: {
      card:     isDark ? "bg-purple-500/5 border-purple-500/20"     : "bg-purple-50 border-purple-100",
      icon:     isCreditSettled ? "bg-emerald-500/10 text-emerald-500" : "bg-purple-500/10 text-purple-500",
      badge:    isCreditSettled ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-purple-500/10 border-purple-500/20 text-purple-600",
      iconType: isCreditSettled ? <CheckCircle size={20}/> : <BookOpen size={20}/>,
    },
    Voided: {
      card:     isDark ? "bg-gray-900/10 border-gray-700/50 opacity-80" : "bg-gray-100 border-gray-200",
      icon:     "bg-gray-500/10 text-gray-500",
      badge:    "bg-gray-500/20 border-gray-500/20 text-gray-600",
      iconType: <XCircle size={20} />,
    },
    Open: {
      card:     isDark ? "bg-gray-900/30 border-gray-700/50"        : "bg-white border-gray-200 shadow-sm",
      icon:     "bg-yellow-500/10 text-yellow-600",
      badge:    "bg-yellow-500/10 border-yellow-500/20 text-yellow-600",
      iconType: <Activity size={20} />,
    },
  };

  const s = styles[category] || styles.Open;
  const badgeLabel = category === "Voided" ? "Cancelled" :
    category === "Credited" ? (isCreditSettled ? "Settled" : "Outstanding") :
    (order.status || category);

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-4 transition-all hover:shadow-md ${s.card}`}>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.icon}`}>
            {s.iconType}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className={`text-base font-black uppercase tracking-tighter ${isDark ? "text-white" : "text-gray-900"}`}>
                {tableName}
              </h3>
              <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full
                ${isDark ? "bg-gray-800 text-gray-500" : "bg-gray-100 text-gray-500"}`}>
                #{orderId}
              </span>
            </div>
            <div className={`flex items-center gap-3 flex-wrap text-[9px] font-bold uppercase tracking-wider
              ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              <div className="flex items-center gap-1"><User size={9}/><span>{waiterName}</span></div>
              {total > 0 && (
                <div className="flex items-center gap-1">
                  <Banknote size={9}/>
                  <span>UGX {total.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className={`inline-block px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border mb-1 ${s.badge}`}>
            {badgeLabel}
          </span>
          {minsElapsed !== null && category !== "Credited" && (
            <div className="flex items-center justify-end gap-1 text-[8px] font-black opacity-50">
              <Timer size={9}/>
              <span>{minsElapsed}m</span>
            </div>
          )}
        </div>
      </div>

      {/* CREDIT DETAILS */}
      {category === "Credited" && creditInfo && (
        <div className={`rounded-lg border divide-y overflow-hidden
          ${isDark ? "border-purple-500/20 divide-purple-500/10" : "border-purple-200 divide-purple-100"}`}>
          {creditInfo.client_name && (
            <div className={`flex items-center gap-2 px-3 py-2 ${isDark ? "bg-purple-500/5" : "bg-purple-50"}`}>
              <User size={10} className="text-gray-500 shrink-0"/>
              <span className={`text-[10px] font-bold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                {creditInfo.client_name}
              </span>
              {creditInfo.client_phone && (
                <span className={`text-[9px] ml-auto ${isDark ? "text-gray-500" : "text-gray-400"}`}>
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

      {/* VOIDED ITEMS BREAKDOWN */}
      {category === "Voided" && (
        <div className={`rounded-lg border divide-y overflow-hidden
          ${isDark ? "border-gray-700/50 divide-gray-700/30" : "border-gray-200 divide-gray-100"}`}>

          {orderVoidReason && (
            <div className={`flex items-start gap-2 px-3 py-2 ${isDark ? "bg-gray-800/30" : "bg-gray-50"}`}>
              <AlertCircle size={12} className="text-gray-500 mt-0.5 shrink-0"/>
              <div>
                <p className="text-[7px] font-black uppercase tracking-wider text-gray-500 mb-0.5">
                  Order Void Reason
                </p>
                <p className={`text-[10px] font-bold italic ${isDark ? "text-gray-300" : "text-gray-600"}`}>
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
                <div key={i} className={`px-3 py-2 flex flex-col gap-1 ${isDark ? "bg-gray-900/20" : "bg-white"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <XCircle size={10} className="text-red-400 shrink-0"/>
                      <span className={`text-[10px] font-black truncate line-through
                        ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                        {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}
                      </span>
                    </div>
                    {item._assignedChef ? (
                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[7px] font-black uppercase shrink-0
                        ${isDark ? "bg-orange-500/10 border-orange-500/20 text-orange-400" : "bg-orange-50 border-orange-200 text-orange-600"}`}>
                        <ChefHat size={8}/>{item._assignedChef}
                      </span>
                    ) : (
                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[7px] font-black uppercase shrink-0
                        ${isDark ? "bg-gray-800 border-gray-700 text-gray-600" : "bg-gray-100 border-gray-200 text-gray-400"}`}>
                        <ChefHat size={8}/>Unassigned
                      </span>
                    )}
                  </div>
                  {item.voidReason && (
                    <p className={`text-[8px] font-bold italic pl-[18px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                      "{item.voidReason}"
                    </p>
                  )}
                </div>
              ))}
            </>
          )}

          {!orderVoidReason && voidedItems.length === 0 && (
            <div className={`flex items-center gap-2 px-3 py-2 ${isDark ? "bg-gray-800/30" : "bg-gray-50"}`}>
              <AlertCircle size={12} className="text-gray-500 shrink-0"/>
              <p className={`text-[10px] font-bold italic ${isDark ? "text-gray-500" : "text-gray-400"}`}>
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