import React, { useState, useMemo, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import {
  Search, LayoutDashboard, AlertCircle, Clock, CheckCircle,
  Banknote, RefreshCw, Eye, Timer, XCircle, Ban, BookOpen, User
} from "lucide-react";
import API_URL from "../../../config/api";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
}
function getTodayLocal() { return toLocalDateStr(new Date()); }

// Current month string e.g. "2026-03"
function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

// ─── VOID DETECTION ───────────────────────────────────────────────────────────
function isRowAllVoided(order) {
  let items = order.items || [];
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.every(item => item.voidProcessed === true || item.status === "VOIDED");
}
function isRowAnyVoided(order) {
  let items = order.items || [];
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  if (!Array.isArray(items)) return false;
  // Also treat order-level voided status
  const status = (order.status || "").toLowerCase();
  if (["void","voided","cancelled","cancel"].includes(status)) return true;
  return items.some(item => item.voidProcessed === true || item.status === "VOIDED");
}
// ALL orders in the group are fully voided
function isTableGroupVoided(group) {
  return group._rawOrders.length > 0 && group._rawOrders.every(isRowAllVoided);
}
// ANY order in the group has at least one voided item
function isTableGroupAnyVoided(group) {
  return group._rawOrders.some(isRowAnyVoided);
}

// ─── CREDIT DETECTION ─────────────────────────────────────────────────────────
// A table is "credited" when at least one of its orders has status === "Credit"
// and it is NOT fully voided.
function isTableGroupCredited(group) {
  return !isTableGroupVoided(group) &&
    group._rawOrders.some(o => o.status === "Credit" || o.payment_method === "Credit");
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function LiveTableGrid() {
  const { orders = [], refreshData } = useData();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [searchQuery,  setSearchQuery]  = useState("");
  const [floorFilter,  setFloorFilter]  = useState("all");
  const [, setTick] = useState(0);

  // ── creditsLedger — fetched from cashier_queue for richer client info ──────
  const [creditsLedger, setCreditsLedger] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/orders/credits`);
        if (res.ok) {
          const rows = await res.json();
          const thisMonth = getCurrentMonth();
          setCreditsLedger(
            rows.filter(r => {
              const d = r.created_at || r.confirmed_at;
              return d && toLocalDateStr(new Date(d)).startsWith(thisMonth);
            })
          );
        }
      } catch {}
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  // ── voidedLedger — fetches today's void_requests that were approved ──────
  // Source of truth for the Voided pill. Persists even after day_cleared
  // because void_requests are not cleared by the accountant end-of-day.
  // Shape: [{ id, order_id, item_name, reason, table_name, waiter_name,
  //           status, created_at, void_reason }]
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
            const approved =
              r.status === "Approved" || r.status === "approved" ||
              r.voidProcessed === true || r.voidProcessed === "t";
            const d = r.created_at || r.resolved_at;
            const isToday = d && toLocalDateStr(new Date(d)) === today;
            return approved && isToday;
          })
        );
      } catch {}
    };
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  // Build a lookup: table_name → credit row (most recent)
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

  // ── Group ALL today's orders by table ──────────────────────────────────────
  const tableGroups = useMemo(() => {
    // Filter today + not day_cleared / shift_cleared
    const todayOrders = (orders || []).filter(o => {
      const ts = o.timestamp || o.created_at;
      if (!ts || toLocalDateStr(new Date(ts)) !== today) return false;
      const cleared =
        o.day_cleared   === true || o.day_cleared   === "t" || o.day_cleared   === "true" ||
        o.shift_cleared === true || o.shift_cleared === "t" || o.shift_cleared === "true";
      return !cleared;
    });

    const groups = {};
    todayOrders.forEach(order => {
      const key = (order.table_name || order.tableName || "WALK-IN").trim().toUpperCase();

      const rowPaid = order.status === "Paid"   || order.status === "Credit"
                   || order.status === "Mixed"  || order.is_paid || order.isPaid;

      if (!groups[key]) {
        groups[key] = {
          tableName:   key,
          total:       0,
          itemCount:   0,
          status:      order.status || "Pending",
          timestamp:   order.timestamp || order.created_at,
          waiterName:  order.staff_name || order.waiterName || "Staff",
          _rows:       [],
          _rawOrders:  [],
          orderIds:    [],
        };
      }

      const g = groups[key];
      g.total     += Number(order.total) || 0;
      g.itemCount += (order.items || []).length;
      g.orderIds.push(order.id);
      g._rows.push({ paid: rowPaid });
      g._rawOrders.push(order);

      if (order.staff_name || order.waiterName) {
        g.waiterName = order.staff_name || order.waiterName;
      }

      const rank = { Served: 6, Paid: 7, Mixed: 7, Credit: 7, Ready: 4, Delayed: 3, Preparing: 2, Pending: 1 };
      if ((rank[order.status] || 0) > (rank[g.status] || 0)) g.status = order.status;
    });

    // Annotate: allPaid, minsElapsed, isDelayed, isVoided, isAnyVoided, isCredited
    return Object.values(groups).map(g => {
      const allPaid     = g._rows.length > 0 && g._rows.every(r => r.paid);
      const minsElapsed = Math.floor((Date.now() - new Date(g.timestamp)) / 60000);
      const isVoided    = isTableGroupVoided(g);    // ALL items voided
      const isAnyVoided = isTableGroupAnyVoided(g); // ANY item voided (partial or full)
      const isCredited  = isTableGroupCredited(g);
      const isDelayed   = !isAnyVoided && !isCredited && !allPaid && minsElapsed >= 30
                        && ["Pending","Preparing","Ready","Delayed"].includes(g.status);
      return { ...g, allPaid, minsElapsed, isDelayed, isVoided, isAnyVoided, isCredited };
    });
  }, [orders, today]);

  // ── Summary counts ─────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all:      tableGroups.length,
    active:   tableGroups.filter(t => !t.isVoided && !t.isCredited && !t.allPaid && ["Pending","Preparing","Ready","Delayed"].includes(t.status)).length,
    delayed:  tableGroups.filter(t => t.isDelayed).length,
    paid:     tableGroups.filter(t => !t.isVoided && !t.isCredited && (t.allPaid || ["Paid","Mixed","Served"].includes(t.status))).length,
    // Credits count: from ledger (persists across day-close)
    credited: creditsLedger.length,
    // Voided count: from voidedLedger (approved void_requests for today)
    // persists after day_cleared — NOT from tableGroups which disappear.
    // Also include any tables in tableGroups that have any voided item.
    voided: Math.max(
      voidedLedger.length,
      tableGroups.filter(t => t.isAnyVoided).length
    ),
  }), [tableGroups, creditsLedger, voidedLedger]);

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filteredTables = useMemo(() => {
    return tableGroups
      .filter(t => {
        const matchSearch = t.tableName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            t.waiterName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchFilter =
          floorFilter === "all"      ? true :
          floorFilter === "active"   ? !t.isVoided && !t.isCredited && !t.allPaid && ["Pending","Preparing","Ready","Delayed"].includes(t.status) :
          floorFilter === "delayed"  ? t.isDelayed :
          floorFilter === "paid"     ? !t.isVoided && !t.isCredited && (t.allPaid || ["Paid","Mixed","Served"].includes(t.status)) :
          floorFilter === "credited" ? t.isCredited :
          floorFilter === "voided"   ? t.isAnyVoided :  // any item voided, not just fully voided
          true;
        return matchSearch && matchFilter;
      })
      .sort((a, b) => {
        // Fully voided always last; partially voided near-last
        if (a.isVoided  && !b.isVoided)  return  1;
        if (!a.isVoided && b.isVoided)   return -1;
        if (a.isAnyVoided && !b.isAnyVoided) return  1;
        if (!a.isAnyVoided && b.isAnyVoided) return -1;
        // Credits second-to-last
        if (a.isCredited && !b.isCredited) return  1;
        if (!a.isCredited && b.isCredited) return -1;
        // Delayed first among active
        if (a.isDelayed  && !b.isDelayed) return -1;
        if (!a.isDelayed && b.isDelayed)  return  1;
        // Ready before others
        if (a.status === "Ready" && b.status !== "Ready") return -1;
        if (b.status === "Ready" && a.status !== "Ready") return  1;
        // Paid last (among non-voided, non-credited)
        if (a.allPaid && !b.allPaid) return  1;
        if (!a.allPaid && b.allPaid) return -1;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
  }, [tableGroups, searchQuery, floorFilter]);

  const FILTERS = [
    { key: "all",      label: "All Tables"               },
    { key: "active",   label: "Active"                   },
    { key: "delayed",  label: "Delayed",  alert: true     },
    { key: "paid",     label: "Settled"                  },
    { key: "credited", label: "Credits",  purple: true    },
    { key: "voided",   label: "Voided",   red: true       },
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
          <SummaryPill icon={<LayoutDashboard size={12}/>} label="Tables"   value={counts.all}      color="text-zinc-400" />
          <SummaryPill icon={<Clock size={12}/>}           label="Active"   value={counts.active}   color="text-yellow-500" />
          {counts.delayed > 0 && (
            <SummaryPill icon={<AlertCircle size={12}/>}  label="Delayed"  value={counts.delayed}  color="text-red-500" pulse />
          )}
          <SummaryPill icon={<CheckCircle size={12}/>}    label="Settled"  value={counts.paid}     color="text-emerald-500" />
          {counts.credited > 0 && (
            <SummaryPill icon={<BookOpen size={12}/>}     label="Credits"  value={counts.credited} color="text-purple-400" />
          )}
          {counts.voided > 0 && (
            <SummaryPill icon={<Ban size={12}/>}          label="Voided"   value={counts.voided}   color="text-zinc-500" />
          )}
          <button onClick={() => refreshData?.()}
            className={`p-2.5 rounded-xl transition-all ${isDark ? "bg-zinc-900 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-500 hover:text-zinc-800"}`}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* FILTER TABS + SEARCH */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className={`flex flex-wrap gap-1 p-1 rounded-2xl ${isDark ? "bg-zinc-900" : "bg-zinc-100"}`}>
          {FILTERS.map(({ key, label, alert, red, purple }) => {
            const isActive = floorFilter === key;
            const activeColor = red ? "bg-red-500 text-white shadow"
              : purple ? "bg-purple-500 text-white shadow"
              : "bg-yellow-500 text-black shadow";
            return (
              <button key={key} onClick={() => setFloorFilter(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                  ${isActive
                    ? activeColor
                    : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}>
                {label}
                {counts[key] > 0 && (
                  <span className={`w-4 h-4 rounded-full text-[8px] font-black inline-flex items-center justify-center
                    ${isActive
                      ? "bg-white/20 text-white"
                      : alert   ? "bg-red-500 text-white"
                      : red     ? "bg-red-500/20 text-red-400"
                      : purple  ? "bg-purple-500/20 text-purple-400"
                      : isDark  ? "bg-zinc-800 text-zinc-400" : "bg-zinc-200 text-zinc-500"}`}>
                    {counts[key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={13} />
          <input type="text" placeholder="Search table or waiter…" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-4 py-2.5 rounded-2xl text-xs font-bold outline-none border transition-all
              ${isDark ? "bg-zinc-900 border-white/5 focus:border-yellow-500/50 text-white" : "bg-white border-black/5 focus:border-yellow-500 text-zinc-900"}`} />
        </div>
      </div>

      {/* GRID / CREDITS PANEL / VOIDED PANEL */}
      {floorFilter === "credited" ? (
        <CreditsPanel credits={creditsLedger} isDark={isDark} />
      ) : floorFilter === "voided" ? (
        // Voided uses a combined view: voidedLedger (persists after day-close)
        // merged with any still-visible voided tableGroups.
        <VoidedPanel
          voidedLedger={voidedLedger}
          voidedGroups={tableGroups.filter(t => t.isAnyVoided)}
          isDark={isDark}
        />
      ) : filteredTables.length === 0 ? (
        <div className={`py-32 text-center border-2 border-dashed rounded-[3rem] opacity-30
          ${isDark ? "border-white/5" : "border-black/10"}`}>
          <LayoutDashboard size={40} className="mx-auto mb-3" />
          <p className="text-xs font-black uppercase tracking-[0.3em]">
            {searchQuery      ? "No matching tables"
              : floorFilter === "voided" ? "No cancelled tables today"
              : `No ${floorFilter} tables right now`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredTables.map(table => (
            <TableCard
              key={table.tableName}
              table={table}
              isDark={isDark}
              creditInfo={creditsByTable[table.tableName] || null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TABLE CARD ───────────────────────────────────────────────────────────────
function TableCard({ table, isDark, creditInfo }) {
  const { tableName, total, itemCount, status, waiterName, minsElapsed, isDelayed, allPaid, isVoided, isCredited, _rawOrders } = table;

  const isPaid   = !isVoided && !isCredited && (allPaid || ["Paid","Mixed"].includes(status));
  const isServed = !isVoided && !isCredited && status === "Served" && !allPaid;
  const isReady  = !isVoided && !isCredited && status === "Ready";

  // Settled = accountant has marked this credit paid.
  // Covers all DB representations: boolean, postgres "t", string "true", or status field.
  const isCreditSettled = isCredited && (
    creditInfo?.paid     === true     || creditInfo?.paid     === "t" || creditInfo?.paid === "true" ||
    creditInfo?.settled  === true     || creditInfo?.settled  === "t" || creditInfo?.settled === "true" ||
    creditInfo?.status   === "settled"|| creditInfo?.status   === "Settled"
  );

  // Voided items for the voided card
  const voidedItemCount = useMemo(() => {
    if (!isVoided) return 0;
    return (_rawOrders || []).reduce((sum, order) => {
      let items = order.items || [];
      if (typeof items === "string") { try { items = JSON.parse(items); } catch { items = []; } }
      if (!Array.isArray(items)) return sum;
      return sum + items.filter(item => item.voidProcessed === true || item.status === "VOIDED").length;
    }, 0);
  }, [isVoided, _rawOrders]);

  const voidedItemNames = useMemo(() => {
    if (!isVoided) return [];
    const names = [];
    (_rawOrders || []).forEach(order => {
      let items = order.items || [];
      if (typeof items === "string") { try { items = JSON.parse(items); } catch { items = []; } }
      if (!Array.isArray(items)) return;
      items.forEach(item => {
        if (item.voidProcessed === true || item.status === "VOIDED") {
          names.push({ name: item.name, qty: item.quantity || 1, reason: item.voidReason || null });
        }
      });
    });
    return names;
  }, [isVoided, _rawOrders]);

  const cardBg =
    isVoided    ? isDark ? "bg-zinc-900/30 border-zinc-700/40 opacity-70"      : "bg-zinc-100 border-zinc-300/60 opacity-80" :
    isCredited  ? isDark ? "bg-purple-500/5 border-purple-500/25"               : "bg-purple-50 border-purple-200" :
    isDelayed   ? isDark ? "bg-red-500/5 border-red-500/30 shadow-[0_0_24px_rgba(239,68,68,0.06)]" : "bg-red-50 border-red-200 shadow-sm" :
    isReady     ? isDark ? "bg-emerald-500/5 border-emerald-500/30"             : "bg-emerald-50 border-emerald-200" :
    isPaid      ? isDark ? "bg-zinc-900/20 border-white/5 opacity-60"           : "bg-zinc-50 border-black/5 opacity-60" :
    isDark      ? "bg-zinc-900/30 border-white/5"  : "bg-white border-black/5 shadow-sm";

  const statusLabel = () => {
    if (isVoided)        return { text: "Cancelled",            color: "text-zinc-500",    bg: "bg-zinc-500/10 border-zinc-500/20" };
    if (isCreditSettled) return { text: "Credit · Settled ✓",  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    if (isCredited)      return { text: "Credit · Outstanding", color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" };
    if (isPaid)          return { text: "Paid",                 color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    if (isServed)        return { text: "Served",               color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" };
    if (isReady)         return { text: "Food Ready",           color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    if (isDelayed)       return { text: `${minsElapsed}m — DELAYED`, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" };
    return { text: status || "Active", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" };
  };

  const sl = statusLabel();

  return (
    <div className={`rounded-[2.5rem] border-2 p-6 transition-all duration-300 ${cardBg}`}>

      {/* ── CREDIT BANNER ── */}
      {isCredited && (
        <div className={`rounded-2xl px-4 py-2 flex items-center gap-2 mb-4
          ${isCreditSettled
            ? isDark ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-200"
            : isDark ? "bg-purple-500/10 border border-purple-500/20"   : "bg-purple-50 border border-purple-200"}`}>
          <BookOpen size={12} className={isCreditSettled ? "text-emerald-400 shrink-0" : "text-purple-400 shrink-0"}/>
          <p className={`text-[9px] font-black uppercase tracking-widest
            ${isCreditSettled ? "text-emerald-400" : "text-purple-400"}`}>
            {isCreditSettled ? "Credit Settled" : "Credit — Payment Pending"}
          </p>
        </div>
      )}

      {/* ── VOIDED BANNER ── */}
      {isVoided && (
        <div className={`rounded-2xl px-4 py-2 flex items-center gap-2 mb-4
          ${isDark ? "bg-zinc-800 border border-zinc-700" : "bg-zinc-200 border border-zinc-300"}`}>
          <XCircle size={12} className="text-zinc-500 shrink-0"/>
          <p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
            Order Cancelled — {voidedItemCount} item{voidedItemCount !== 1 ? "s" : ""} voided
          </p>
        </div>
      )}

      {/* ── DELAY BANNER ── */}
      {isDelayed && (
        <div className="bg-red-500 rounded-2xl px-4 py-2 flex items-center gap-2 mb-4">
          <AlertCircle size={12} className="text-white shrink-0" />
          <p className="text-[9px] font-black text-white uppercase tracking-widest">
            Waiting {minsElapsed}m — Approach Waiter
          </p>
        </div>
      )}

      {/* ── READY BANNER ── */}
      {isReady && (
        <div className="bg-emerald-500 rounded-2xl px-4 py-2 flex items-center gap-2 mb-4">
          <CheckCircle size={12} className="text-white shrink-0" />
          <p className="text-[9px] font-black text-white uppercase tracking-widest">Food Ready — Notify Waiter</p>
        </div>
      )}

      {/* Table name + status badge */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className={`font-black text-2xl italic tracking-tighter uppercase
            ${isVoided ? isDark ? "text-zinc-600" : "text-zinc-400"
              : isCredited ? "text-purple-400"
              : isDark ? "text-white" : "text-zinc-900"}`}>
            {tableName}
          </h3>
          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border mt-1 inline-block ${sl.bg} ${sl.color}`}>
            {sl.text}
          </span>
        </div>
        {!isPaid && !isVoided && !isCredited && (
          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black
            ${isDelayed ? "bg-red-500/10 text-red-400" : isDark ? "bg-white/5 text-zinc-400" : "bg-zinc-100 text-zinc-500"}`}>
            <Timer size={11} />
            {minsElapsed}m
          </div>
        )}
      </div>

      {/* Data rows */}
      <div className="space-y-2.5 mb-5">
        <DataRow label="Waiter" value={waiterName}                      isDark={isDark} muted={isVoided} />
        <DataRow label="Items"  value={`${itemCount} items`}            isDark={isDark} muted={isVoided} />
        <DataRow label="Bill"   value={`UGX ${total.toLocaleString()}`} isDark={isDark} highlight={!isVoided && !isCredited} muted={isVoided} purple={isCredited} />
      </div>

      {/* ── CREDIT DETAILS BLOCK ── */}
      {isCredited && (
        <div className={`rounded-2xl border divide-y overflow-hidden mb-4
          ${isDark ? "border-purple-500/20 divide-purple-500/10" : "border-purple-200 divide-purple-100"}`}>
          <div className={`px-3 py-1.5 ${isDark ? "bg-purple-500/10" : "bg-purple-50"}`}>
            <p className="text-[8px] font-black uppercase tracking-widest text-purple-400">Credit Details</p>
          </div>
          {creditInfo?.client_name && (
            <div className={`flex items-center gap-2 px-3 py-2 ${isDark ? "bg-white/2" : "bg-white"}`}>
              <User size={10} className="text-zinc-500 shrink-0"/>
              <span className={`text-[10px] font-bold ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                {creditInfo.client_name}
              </span>
              {creditInfo.client_phone && (
                <span className={`text-[9px] ml-auto ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                  {creditInfo.client_phone}
                </span>
              )}
            </div>
          )}
          {creditInfo?.pay_by && !isCreditSettled && (
            <div className={`flex items-center justify-between px-3 py-2 ${isDark ? "bg-amber-500/5" : "bg-amber-50"}`}>
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">Pay by</span>
              <span className="text-[9px] font-black text-amber-400">{creditInfo.pay_by}</span>
            </div>
          )}
          <div className={`flex items-center justify-between px-3 py-2 ${isDark ? "bg-white/2" : "bg-white"}`}>
            <span className={`text-[9px] font-black uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              Amount
            </span>
            <span className={`text-sm font-black ${isCreditSettled ? "text-emerald-400" : "text-purple-400"}`}>
              UGX {Number(creditInfo?.amount || total).toLocaleString()}
            </span>
          </div>
          <div className={`px-3 py-1.5 ${isDark ? "bg-white/2" : "bg-white"}`}>
            <p className={`text-[8px] font-bold italic ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              {isCreditSettled ? "✓ Settled by accountant" : "Clears at month-end · Contact accountant to settle"}
            </p>
          </div>
        </div>
      )}

      {/* ── VOIDED ITEMS LIST ── */}
      {isVoided && voidedItemNames.length > 0 && (
        <div className={`rounded-2xl border divide-y overflow-hidden mb-4
          ${isDark ? "border-zinc-700/50 divide-zinc-700/50" : "border-zinc-300/50 divide-zinc-300/50"}`}>
          <div className={`px-3 py-1.5 ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}>
            <p className={`text-[8px] font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              Voided Items
            </p>
          </div>
          {voidedItemNames.map((item, i) => (
            <div key={i} className={`flex items-start justify-between px-3 py-2 gap-2
              ${isDark ? "bg-zinc-900/40" : "bg-zinc-50"}`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <XCircle size={10} className="text-red-400/60 shrink-0 mt-0.5"/>
                <div className="min-w-0">
                  <p className={`text-[10px] font-black line-through truncate ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                    {item.name}{item.qty > 1 ? ` ×${item.qty}` : ""}
                  </p>
                  {item.reason && (
                    <p className={`text-[9px] font-bold italic truncate ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>
                      "{item.reason}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status action footer */}
      {!isVoided && !isCredited && (
        <div className={`flex items-center gap-2 p-3 rounded-2xl ${
          isDelayed ? "bg-red-500/10"     :
          isReady   ? "bg-emerald-500/10" :
          isPaid    ? "bg-zinc-500/10"    :
          isServed  ? "bg-blue-500/10"    :
          "bg-yellow-500/10"}`}>
          {isDelayed ? <AlertCircle size={14} className="text-red-400 shrink-0"    /> :
           isReady   ? <CheckCircle size={14} className="text-emerald-400 shrink-0"/> :
           isPaid    ? <CheckCircle size={14} className="text-zinc-400 shrink-0"   /> :
           isServed  ? <Eye        size={14} className="text-blue-400 shrink-0"    /> :
           <Clock    size={14} className="text-yellow-400 shrink-0"/>}
          <p className={`text-[9px] font-black uppercase tracking-widest
            ${isDelayed ? "text-red-400" : isReady ? "text-emerald-400" : isPaid ? "text-zinc-500" : isServed ? "text-blue-400" : "text-yellow-400"}`}>
            {isDelayed ? `Approach ${waiterName}` :
             isReady   ? "Send Waiter to Kitchen"  :
             isPaid    ? "Table Cleared"           :
             isServed  ? "Awaiting Payment"        :
             "Service in Progress"}
          </p>
        </div>
      )}

      {/* Credit footer */}
      {isCredited && (
        <div className={`flex items-center gap-2 p-3 rounded-2xl
          ${isCreditSettled
            ? isDark ? "bg-emerald-500/10" : "bg-emerald-50"
            : isDark ? "bg-purple-500/10"  : "bg-purple-50"}`}>
          <BookOpen size={14} className={isCreditSettled ? "text-emerald-400 shrink-0" : "text-purple-400 shrink-0"}/>
          <p className={`text-[9px] font-black uppercase tracking-widest
            ${isCreditSettled ? "text-emerald-400" : "text-purple-400"}`}>
            {isCreditSettled ? "Payment Received" : "On Account — Awaiting Settlement"}
          </p>
        </div>
      )}

      {/* Voided footer */}
      {isVoided && (
        <div className={`flex items-center gap-2 p-3 rounded-2xl ${isDark ? "bg-zinc-800/60" : "bg-zinc-200/60"}`}>
          <Ban size={14} className={isDark ? "text-zinc-600 shrink-0" : "text-zinc-400 shrink-0"}/>
          <p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            All Items Cancelled
          </p>
        </div>
      )}
    </div>
  );
}

// ─── VOIDED PANEL ─────────────────────────────────────────────────────────────
// Shown when floorFilter === "voided".
// Merges two sources:
//   1. voidedLedger   — approved void_requests from today (persists after day_cleared)
//   2. voidedGroups   — tableGroups still in memory that have any voided item
// De-duped by table_name so a table doesn't appear twice.
function VoidedPanel({ voidedLedger, voidedGroups, isDark }) {
  // Build a set of table names already covered by live tableGroups
  const liveTableNames = new Set(voidedGroups.map(g => g.tableName));

  // From ledger: keep only rows whose table ISN'T already in live groups
  // (avoids double-showing the same table)
  const ledgerOnly = voidedLedger.filter(r => {
    const key = (r.table_name || "").trim().toUpperCase();
    return !liveTableNames.has(key);
  });

  const hasAnything = voidedGroups.length > 0 || ledgerOnly.length > 0;

  if (!hasAnything) {
    return (
      <div className={`py-32 text-center border-2 border-dashed rounded-[3rem] opacity-30
        ${isDark ? "border-white/5" : "border-black/10"}`}>
        <XCircle size={40} className="mx-auto mb-3" />
        <p className="text-xs font-black uppercase tracking-[0.3em]">No cancelled items today</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Live groups that have at least one voided item — full TableCard */}
      {voidedGroups.length > 0 && (
        <div className="space-y-3">
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Active Tables With Voided Items · {voidedGroups.length}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {voidedGroups.map(table => (
              <TableCard key={table.tableName} table={table} isDark={isDark} creditInfo={null}/>
            ))}
          </div>
        </div>
      )}

      {/* Ledger-only rows (table already cleared for the day) */}
      {ledgerOnly.length > 0 && (
        <div className="space-y-3">
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Archived Void Records · {ledgerOnly.length}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ledgerOnly.map((r, i) => (
              <VoidLedgerCard key={i} record={r} isDark={isDark}/>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VoidLedgerCard({ record, isDark }) {
  const dateStr = record.created_at
    ? new Date(record.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className={`rounded-[2.5rem] border-2 p-5 transition-all
      ${isDark ? "bg-zinc-900/20 border-zinc-700/40 opacity-80" : "bg-zinc-100 border-zinc-300/60 opacity-90"}`}>

      {/* Banner */}
      <div className={`rounded-2xl px-3 py-1.5 flex items-center gap-2 mb-4
        ${isDark ? "bg-zinc-800 border border-zinc-700" : "bg-zinc-200 border border-zinc-300"}`}>
        <XCircle size={10} className="text-red-400/70 shrink-0"/>
        <p className={`text-[8px] font-black uppercase tracking-widest ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          Void Approved
        </p>
      </div>

      {/* Table name */}
      <h3 className={`font-black text-2xl italic tracking-tighter uppercase mb-3
        ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
        {(record.table_name || "Table").toUpperCase()}
      </h3>

      {/* Details */}
      <div className="space-y-2 mb-4">
        {record.item_name && (
          <div className="flex justify-between items-center gap-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Item</span>
            <span className={`text-[10px] font-black line-through truncate max-w-[60%] text-right ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              {record.item_name}
            </span>
          </div>
        )}
        {(record.waiter_name || record.requested_by) && (
          <div className="flex justify-between items-center">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Waiter</span>
            <span className={`text-[10px] font-black ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {record.waiter_name || record.requested_by}
            </span>
          </div>
        )}
        {record.reason && (
          <div className="flex justify-between items-start gap-2">
            <span className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Reason</span>
            <span className={`text-[9px] font-bold italic text-right ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              "{record.reason}"
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`flex items-center gap-2 p-3 rounded-2xl ${isDark ? "bg-zinc-800/60" : "bg-zinc-200/60"}`}>
        <Ban size={12} className={isDark ? "text-zinc-600 shrink-0" : "text-zinc-400 shrink-0"}/>
        <p className={`text-[8px] font-black uppercase tracking-widest flex-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
          Cleared · Archived
        </p>
        <span className={`text-[8px] font-bold ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>{dateStr}</span>
      </div>
    </div>
  );
}

// ─── CREDITS PANEL ────────────────────────────────────────────────────────────
// Shown when floorFilter === "credited". Uses creditsLedger as source of truth
// so credits persist after day-close and clear automatically at month-end.
function CreditsPanel({ credits, isDark }) {
  const outstanding = credits.filter(c =>
    !c.paid && !c.settled && c.status !== "settled" && c.status !== "Settled"
  );
  const settled = credits.filter(c =>
    c.paid === true || c.paid === "t" || c.paid === "true" ||
    c.settled === true || c.settled === "t" || c.settled === "true" ||
    c.status === "settled" || c.status === "Settled"
  );

  const totalOut = outstanding.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalSet = settled.reduce((s, c)     => s + Number(c.amount || 0), 0);

  if (credits.length === 0) {
    return (
      <div className={`py-32 text-center border-2 border-dashed rounded-[3rem] opacity-30
        ${isDark ? "border-white/5" : "border-black/10"}`}>
        <BookOpen size={40} className="mx-auto mb-3" />
        <p className="text-xs font-black uppercase tracking-[0.3em]">No credit orders this month</p>
        <p className={`text-[10px] mt-2 font-bold uppercase tracking-widest ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>
          Credits clear automatically at month-end
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-[2rem] border p-5 ${isDark ? "bg-purple-500/5 border-purple-500/20" : "bg-purple-50 border-purple-100"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-purple-400 mb-1">Outstanding</p>
          <p className="text-2xl font-black italic text-purple-400">UGX {totalOut.toLocaleString()}</p>
          <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            {outstanding.length} unpaid credit{outstanding.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className={`rounded-[2rem] border p-5 ${isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-100"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-emerald-400 mb-1">Settled</p>
          <p className="text-2xl font-black italic text-emerald-400">UGX {totalSet.toLocaleString()}</p>
          <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            {settled.length} cleared
          </p>
        </div>
      </div>

      {/* Outstanding */}
      {outstanding.length > 0 && (
        <div className="space-y-3">
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Outstanding · {outstanding.length}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {outstanding.map((c, i) => <CreditLedgerRow key={i} credit={c} isDark={isDark} isSettled={false}/>)}
          </div>
        </div>
      )}

      {/* Settled */}
      {settled.length > 0 && (
        <div className="space-y-3">
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Settled · {settled.length}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {settled.map((c, i) => <CreditLedgerRow key={i} credit={c} isDark={isDark} isSettled={true}/>)}
          </div>
        </div>
      )}

      <p className={`text-center text-[9px] font-bold uppercase tracking-widest pt-2 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>
        Credits clear at month-end · Contact accountant to settle
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
    <div className={`rounded-[2.5rem] border-2 p-5 transition-all
      ${isSettled
        ? isDark ? "bg-zinc-900/20 border-white/5 opacity-70" : "bg-zinc-50 border-black/5 opacity-70"
        : isDark ? "bg-purple-500/5 border-purple-500/25"     : "bg-purple-50 border-purple-200"}`}>

      {/* Banner */}
      <div className={`rounded-2xl px-3 py-1.5 flex items-center gap-2 mb-4
        ${isSettled
          ? isDark ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-200"
          : isDark ? "bg-purple-500/10 border border-purple-500/20"   : "bg-purple-50 border border-purple-200"}`}>
        <BookOpen size={10} className={isSettled ? "text-emerald-400 shrink-0" : "text-purple-400 shrink-0"}/>
        <p className={`text-[8px] font-black uppercase tracking-widest
          ${isSettled ? "text-emerald-400" : "text-purple-400"}`}>
          {isSettled ? "Credit Settled" : "Credit — Outstanding"}
        </p>
      </div>

      {/* Table name */}
      <h3 className={`font-black text-2xl italic tracking-tighter uppercase mb-1
        ${isSettled ? isDark ? "text-zinc-500" : "text-zinc-400" : "text-purple-400"}`}>
        {credit.table_name || "Table"}
      </h3>

      {/* Data rows */}
      <div className="space-y-2 mb-4">
        {credit.client_name && (
          <div className="flex justify-between items-center">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Client</span>
            <span className={`text-[11px] font-black ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{credit.client_name}</span>
          </div>
        )}
        {credit.client_phone && (
          <div className="flex justify-between items-center">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Phone</span>
            <span className={`text-[11px] font-black ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{credit.client_phone}</span>
          </div>
        )}
        {credit.requested_by && (
          <div className="flex justify-between items-center">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Waiter</span>
            <span className={`text-[11px] font-black ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{credit.requested_by}</span>
          </div>
        )}
        {credit.pay_by && !isSettled && (
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Pay By</span>
            <span className="text-[11px] font-black text-amber-400">{credit.pay_by}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Amount</span>
          <span className={`text-[11px] font-black ${isSettled ? "text-emerald-400" : "text-purple-400"}`}>
            UGX {Number(credit.amount || 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className={`flex items-center gap-2 p-3 rounded-2xl
        ${isSettled
          ? isDark ? "bg-emerald-500/10" : "bg-emerald-50"
          : isDark ? "bg-purple-500/10"  : "bg-purple-50"}`}>
        <BookOpen size={12} className={isSettled ? "text-emerald-400 shrink-0" : "text-purple-400 shrink-0"}/>
        <p className={`text-[8px] font-black uppercase tracking-widest flex-1
          ${isSettled ? "text-emerald-400" : "text-purple-400"}`}>
          {isSettled ? "Cleared by accountant" : "On Account · Awaiting Settlement"}
        </p>
        <span className={`text-[8px] font-bold ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{dateStr}</span>
      </div>
    </div>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function DataRow({ label, value, isDark, highlight, muted, purple }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        {label}
      </span>
      <span className={`text-[11px] font-black
        ${muted   ? isDark ? "text-zinc-600" : "text-zinc-400"
        : purple  ? "text-purple-400"
        : highlight ? "text-yellow-500"
        : isDark  ? "text-white" : "text-zinc-900"}`}>
        {value}
      </span>
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