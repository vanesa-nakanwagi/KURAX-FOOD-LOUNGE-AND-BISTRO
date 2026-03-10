import React, { useState, useMemo, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import {
  Search, LayoutDashboard, AlertCircle, Clock, CheckCircle,
  Users, Banknote, RefreshCw, Eye, Timer
} from "lucide-react";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
}
function getTodayLocal() { return toLocalDateStr(new Date()); }

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function LiveTableGrid() {
  const { orders = [], refreshData } = useData();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [searchQuery, setSearchQuery] = useState("");
  const [floorFilter, setFloorFilter] = useState("all"); // all | active | delayed | paid
  const [, setTick]   = useState(0);

  // Tick every minute so delay timers stay live
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

  // ── Group ALL today's orders by table — same logic as ManagerOrderHistory ──
  const tableGroups = useMemo(() => {
    const todayOrders = (orders || []).filter(o => {
      const ts = o.timestamp || o.created_at;
      return ts && toLocalDateStr(new Date(ts)) === today;
    });

    const groups = {};
    todayOrders.forEach(order => {
      const key = (order.table_name || order.tableName || "WALK-IN").trim().toUpperCase();

      const rowPaid = order.status === "Paid" || order.status === "Credit"
                   || order.status === "Mixed" || order.is_paid || order.isPaid;

      if (!groups[key]) {
        groups[key] = {
          tableName:  key,
          total:      0,
          itemCount:  0,
          status:     order.status || "Pending",
          timestamp:  order.timestamp || order.created_at,
          waiterName: order.staff_name || order.waiterName || "Staff",
          _rows:      [],
          orderIds:   [],
        };
      }

      const g = groups[key];
      g.total     += Number(order.total) || 0;
      g.itemCount += (order.items || []).length;
      g.orderIds.push(order.id);
      g._rows.push({ paid: rowPaid });

      // Keep waiter name from any own-order row
      if (order.staff_name || order.waiterName) {
        g.waiterName = order.staff_name || order.waiterName;
      }

      // Promote status: Served > Ready > Delayed > Preparing > Pending
      const rank = { Served: 6, Paid: 7, Mixed: 7, Credit: 7, Ready: 4, Delayed: 3, Preparing: 2, Pending: 1 };
      if ((rank[order.status] || 0) > (rank[g.status] || 0)) g.status = order.status;
    });

    // Annotate: allPaid, minsElapsed, isDelayed
    return Object.values(groups).map(g => {
      const allPaid    = g._rows.length > 0 && g._rows.every(r => r.paid);
      const minsElapsed = Math.floor((Date.now() - new Date(g.timestamp)) / 60000);
      const isDelayed  = !allPaid && minsElapsed >= 30
                       && ["Pending","Preparing","Ready","Delayed"].includes(g.status);
      return { ...g, allPaid, minsElapsed, isDelayed };
    });
  }, [orders, today]);

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filteredTables = useMemo(() => {
    return tableGroups
      .filter(t => {
        const matchSearch = t.tableName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            t.waiterName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchFilter =
          floorFilter === "all"     ? true :
          floorFilter === "active"  ? !t.allPaid && ["Pending","Preparing","Ready","Delayed"].includes(t.status) :
          floorFilter === "delayed" ? t.isDelayed :
          floorFilter === "paid"    ? t.allPaid || ["Paid","Mixed","Credit","Served"].includes(t.status) :
          true;
        return matchSearch && matchFilter;
      })
      .sort((a, b) => {
        // Delayed first, then active, then paid
        if (a.isDelayed && !b.isDelayed) return -1;
        if (!a.isDelayed && b.isDelayed) return  1;
        if (a.status === "Ready" && b.status !== "Ready") return -1;
        if (b.status === "Ready" && a.status !== "Ready") return  1;
        if (a.allPaid && !b.allPaid) return  1;
        if (!a.allPaid && b.allPaid) return -1;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
  }, [tableGroups, searchQuery, floorFilter]);

  // ── Summary counts ─────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all:     tableGroups.length,
    active:  tableGroups.filter(t => !t.allPaid && ["Pending","Preparing","Ready","Delayed"].includes(t.status)).length,
    delayed: tableGroups.filter(t => t.isDelayed).length,
    paid:    tableGroups.filter(t => t.allPaid || ["Paid","Mixed","Credit","Served"].includes(t.status)).length,
  }), [tableGroups]);

  const FILTERS = [
    { key: "all",     label: "All Tables" },
    { key: "active",  label: "Active" },
    { key: "delayed", label: "Delayed",  alert: true },
    { key: "paid",    label: "Settled" },
  ];

  return (
    <div className={`p-4 md:p-10 space-y-6 pb-32 font-[Outfit] ${isDark ? "text-white" : "text-zinc-900"}`}>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 bg-yellow-500 rounded-full" />
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-yellow-500/80">Live Floor</p>
          </div>
          <h2 className={`text-3xl md:text-4xl font-black italic tracking-tighter uppercase ${isDark ? "text-white" : "text-zinc-900"}`}>
            All Floor <span className="text-yellow-500">Overview</span>
          </h2>
          <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Every active table · All staff · Today
          </p>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-3 flex-wrap">
          <SummaryPill icon={<LayoutDashboard size={12}/>} label="Tables" value={counts.all}     color="text-zinc-400" />
          <SummaryPill icon={<Clock size={12}/>}           label="Active"  value={counts.active}  color="text-yellow-500" />
          {counts.delayed > 0 && (
            <SummaryPill icon={<AlertCircle size={12}/>}  label="Delayed" value={counts.delayed} color="text-red-500" pulse />
          )}
          <SummaryPill icon={<CheckCircle size={12}/>}    label="Settled" value={counts.paid}    color="text-emerald-500" />
          <button onClick={() => refreshData?.()}
            className={`p-2.5 rounded-xl transition-all ${isDark ? "bg-zinc-900 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-500 hover:text-zinc-800"}`}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* FILTER TABS + SEARCH */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className={`flex gap-1 p-1 rounded-2xl ${isDark ? "bg-zinc-900" : "bg-zinc-100"}`}>
          {FILTERS.map(({ key, label, alert }) => (
            <button key={key} onClick={() => setFloorFilter(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                ${floorFilter === key
                  ? "bg-yellow-500 text-black shadow"
                  : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}>
              {label}
              {counts[key] > 0 && (
                <span className={`w-4 h-4 rounded-full text-[8px] font-black inline-flex items-center justify-center
                  ${floorFilter === key
                    ? "bg-black/20 text-black"
                    : alert && counts[key] > 0
                      ? "bg-red-500 text-white"
                      : isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-200 text-zinc-500"}`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={13} />
          <input type="text" placeholder="Search table or waiter…" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-4 py-2.5 rounded-2xl text-xs font-bold outline-none border transition-all
              ${isDark ? "bg-zinc-900 border-white/5 focus:border-yellow-500/50 text-white" : "bg-white border-black/5 focus:border-yellow-500 text-zinc-900"}`} />
        </div>
      </div>

      {/* GRID */}
      {filteredTables.length === 0 ? (
        <div className={`py-32 text-center border-2 border-dashed rounded-[3rem] opacity-30
          ${isDark ? "border-white/5" : "border-black/10"}`}>
          <LayoutDashboard size={40} className="mx-auto mb-3" />
          <p className="text-xs font-black uppercase tracking-[0.3em]">
            {searchQuery ? "No matching tables" : `No ${floorFilter} tables right now`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredTables.map(table => (
            <TableCard key={table.tableName} table={table} isDark={isDark} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TABLE CARD ───────────────────────────────────────────────────────────────
function TableCard({ table, isDark }) {
  const { tableName, total, itemCount, status, waiterName, minsElapsed, isDelayed, allPaid } = table;

  const isPaid    = allPaid || ["Paid","Mixed","Credit"].includes(status);
  const isServed  = status === "Served" && !allPaid;
  const isReady   = status === "Ready";

  const cardBg =
    isDelayed  ? isDark ? "bg-red-500/5 border-red-500/30 shadow-[0_0_24px_rgba(239,68,68,0.06)]"
                        : "bg-red-50 border-red-200 shadow-sm" :
    isReady    ? isDark ? "bg-emerald-500/5 border-emerald-500/30"
                        : "bg-emerald-50 border-emerald-200" :
    isPaid     ? isDark ? "bg-zinc-900/20 border-white/5 opacity-60"
                        : "bg-zinc-50 border-black/5 opacity-60" :
    isDark     ? "bg-zinc-900/30 border-white/5"
               : "bg-white border-black/5 shadow-sm";

  const statusLabel = () => {
    if (isPaid)    return { text: "Paid",        color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    if (status === "Credit") return { text: "Credit",  color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" };
    if (isServed)  return { text: "Served",      color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" };
    if (isReady)   return { text: "Food Ready",  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    if (isDelayed) return { text: `${minsElapsed}m — DELAYED`, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" };
    return { text: status || "Active", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" };
  };

  const sl = statusLabel();

  return (
    <div className={`rounded-[2.5rem] border-2 p-6 transition-all duration-300 ${cardBg}`}>

      {/* Delay banner */}
      {isDelayed && (
        <div className="bg-red-500 rounded-2xl px-4 py-2 flex items-center gap-2 mb-4">
          <AlertCircle size={12} className="text-white shrink-0" />
          <p className="text-[9px] font-black text-white uppercase tracking-widest">
            Waiting {minsElapsed}m — Approach Waiter
          </p>
        </div>
      )}

      {/* Ready banner */}
      {isReady && (
        <div className="bg-emerald-500 rounded-2xl px-4 py-2 flex items-center gap-2 mb-4">
          <CheckCircle size={12} className="text-white shrink-0" />
          <p className="text-[9px] font-black text-white uppercase tracking-widest">Food Ready — Notify Waiter</p>
        </div>
      )}

      {/* Table name + status */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className={`font-black text-2xl italic tracking-tighter uppercase ${isDark ? "text-white" : "text-zinc-900"}`}>
            {tableName}
          </h3>
          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border mt-1 inline-block ${sl.bg} ${sl.color}`}>
            {sl.text}
          </span>
        </div>
        {!isPaid && (
          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black
            ${isDelayed ? "bg-red-500/10 text-red-400" : isDark ? "bg-white/5 text-zinc-400" : "bg-zinc-100 text-zinc-500"}`}>
            <Timer size={11} />
            {minsElapsed}m
          </div>
        )}
      </div>

      {/* Data rows */}
      <div className="space-y-2.5 mb-5">
        <DataRow label="Waiter"    value={waiterName}                     isDark={isDark} />
        <DataRow label="Items"     value={`${itemCount} items`}           isDark={isDark} />
        <DataRow label="Bill"      value={`UGX ${total.toLocaleString()}`} isDark={isDark} highlight />
      </div>

      {/* Status action indicator */}
      <div className={`flex items-center gap-2 p-3 rounded-2xl ${
        isDelayed  ? "bg-red-500/10"    :
        isReady    ? "bg-emerald-500/10":
        isPaid     ? "bg-zinc-500/10"   :
        isServed   ? "bg-blue-500/10"   :
        "bg-yellow-500/10"}`}>
        {isDelayed  ? <AlertCircle size={14} className="text-red-400 shrink-0" />    :
         isReady    ? <CheckCircle size={14} className="text-emerald-400 shrink-0" /> :
         isPaid     ? <CheckCircle size={14} className="text-zinc-400 shrink-0" />   :
         isServed   ? <Eye size={14} className="text-blue-400 shrink-0" />           :
         <Clock size={14} className="text-yellow-400 shrink-0" />}
        <p className={`text-[9px] font-black uppercase tracking-widest
          ${isDelayed  ? "text-red-400"    :
            isReady    ? "text-emerald-400" :
            isPaid     ? "text-zinc-500"    :
            isServed   ? "text-blue-400"    :
            "text-yellow-400"}`}>
          {isDelayed  ? `Approach ${waiterName}` :
           isReady    ? "Send Waiter to Kitchen" :
           isPaid     ? "Table Cleared"          :
           isServed   ? "Awaiting Payment"       :
           "Service in Progress"}
        </p>
      </div>
    </div>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function DataRow({ label, value, isDark, highlight }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{label}</span>
      <span className={`text-[11px] font-black ${highlight ? "text-yellow-500" : isDark ? "text-white" : "text-zinc-900"}`}>{value}</span>
    </div>
  );
}

function SummaryPill({ icon, label, value, color, pulse }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 ${pulse ? "animate-pulse" : ""}`}>
      <span className={color}>{icon}</span>
      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
      <span className={`text-[11px] font-black ${color}`}>{value}</span>
    </div>
  );
}