import React, { useState, useMemo, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import {
  Search, LayoutDashboard, AlertCircle, Clock, CheckCircle,
  Banknote, RefreshCw, Eye, Timer, XCircle, Ban, BookOpen, User,
  ChefHat, Utensils, Users, TrendingUp, Filter, ArrowUpDown, Hourglass
} from "lucide-react";
import API_URL from "../../../config/api";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
}
function getTodayLocal() { return toLocalDateStr(new Date()); }
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
  const status = (order.status || "").toLowerCase();
  if (["void","voided","cancelled","cancel"].includes(status)) return true;
  return items.some(item => item.voidProcessed === true || item.status === "VOIDED");
}
function isTableGroupVoided(group) {
  return group._rawOrders.length > 0 && group._rawOrders.every(isRowAllVoided);
}
function isTableGroupAnyVoided(group) {
  return group._rawOrders.some(isRowAnyVoided);
}

function isTableGroupCredited(group) {
  return !isTableGroupVoided(group) &&
    group._rawOrders.some(o => o.status === "Credit" || o.payment_method === "Credit");
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function LiveTableGrid() {
  const { orders = [], refreshData } = useData();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [searchQuery, setSearchQuery] = useState("");
  const [floorFilter, setFloorFilter] = useState("all");
  const [sortBy, setSortBy] = useState("priority");
  const [sortOrder, setSortOrder] = useState("asc");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, setTick] = useState(0);

  // ── creditsLedger ──────────────────────────────────────────────────────────
  const [creditsLedger, setCreditsLedger] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/cashier-ops/credits`);
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

  // ── voidedLedger ───────────────────────────────────────────────────────────
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
            const approved = r.status === "Approved" || r.status === "approved" || r.voidProcessed === true || r.voidProcessed === "t";
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

  const [today, setToday] = useState(getTodayLocal);
  useEffect(() => {
    const schedule = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const t = setTimeout(() => { setToday(getTodayLocal()); schedule(); }, next - now);
      return t;
    };
    const t = schedule();
    return () => clearTimeout(t);
  }, []);

  // ── Group orders by table ──────────────────────────────────────────────────
  const tableGroups = useMemo(() => {
    const todayOrders = (orders || []).filter(o => {
      const ts = o.timestamp || o.created_at;
      if (!ts || toLocalDateStr(new Date(ts)) !== today) return false;
      const cleared = o.day_cleared === true || o.day_cleared === "t" || o.day_cleared === "true" ||
                      o.shift_cleared === true || o.shift_cleared === "t" || o.shift_cleared === "true";
      return !cleared;
    });

    const groups = {};
    todayOrders.forEach(order => {
      const key = (order.table_name || order.tableName || "WALK-IN").trim().toUpperCase();
      const rowPaid = order.status === "Paid" || order.status === "Credit" || order.status === "Mixed" || order.is_paid || order.isPaid;

      if (!groups[key]) {
        groups[key] = {
          tableName: key,
          total: 0,
          itemCount: 0,
          status: order.status || "Pending",
          timestamp: order.timestamp || order.created_at,
          waiterName: order.staff_name || order.waiterName || "Staff",
          _rows: [],
          _rawOrders: [],
          orderIds: [],
        };
      }

      const g = groups[key];
      g.total += Number(order.total) || 0;
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

    return Object.values(groups).map(g => {
      const allPaid = g._rows.length > 0 && g._rows.every(r => r.paid);
      const minsElapsed = Math.floor((Date.now() - new Date(g.timestamp)) / 60000);
      const isVoided = isTableGroupVoided(g);
      const isAnyVoided = isTableGroupAnyVoided(g);
      const isCredited = isTableGroupCredited(g);
      const isDelayed = !isAnyVoided && !isCredited && !allPaid && minsElapsed >= 30 && ["Pending","Preparing","Ready","Delayed"].includes(g.status);
      return { ...g, allPaid, minsElapsed, isDelayed, isVoided, isAnyVoided, isCredited };
    });
  }, [orders, today]);

  // ── Credit status breakdown (FIXED) ─────────────────────────────────────────
  const creditStatusBreakdown = useMemo(() => {
    const pendingCashier = creditsLedger.filter(c => c.status === "PendingCashier");
    const pendingManager = creditsLedger.filter(c => c.status === "PendingManagerApproval");
    const approved = creditsLedger.filter(c => c.status === "Approved");
    const settled = creditsLedger.filter(c => c.status === "FullySettled" || c.status === "PartiallySettled");
    const rejected = creditsLedger.filter(c => c.status === "Rejected");

    return {
      pendingCashier,
      pendingManager,
      approved,
      settled,
      rejected,
      totalPendingCashier: pendingCashier.reduce((s, c) => s + Number(c.amount || 0), 0),
      totalPendingManager: pendingManager.reduce((s, c) => s + Number(c.amount || 0), 0),
      totalApproved: approved.reduce((s, c) => s + Number(c.amount || 0), 0),
      totalSettled: settled.reduce((s, c) => s + Number(c.amount_paid || c.amount || 0), 0),
      totalRejected: rejected.reduce((s, c) => s + Number(c.amount || 0), 0),
    };
  }, [creditsLedger]);

  // ── Summary counts ─────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all: tableGroups.length,
    active: tableGroups.filter(t => !t.isVoided && !t.isCredited && !t.allPaid && ["Pending","Preparing","Ready","Delayed"].includes(t.status)).length,
    delayed: tableGroups.filter(t => t.isDelayed).length,
    paid: tableGroups.filter(t => !t.isVoided && !t.isCredited && (t.allPaid || ["Paid","Mixed","Served"].includes(t.status))).length,
    credited: creditsLedger.length,
    voided: Math.max(voidedLedger.length, tableGroups.filter(t => t.isAnyVoided).length),
  }), [tableGroups, creditsLedger, voidedLedger]);

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filteredTables = useMemo(() => {
    let filtered = tableGroups.filter(t => {
      const matchSearch = t.tableName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.waiterName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFilter =
        floorFilter === "all" ? true :
        floorFilter === "active" ? !t.isVoided && !t.isCredited && !t.allPaid && ["Pending","Preparing","Ready","Delayed"].includes(t.status) :
        floorFilter === "delayed" ? t.isDelayed :
        floorFilter === "paid" ? !t.isVoided && !t.isCredited && (t.allPaid || ["Paid","Mixed","Served"].includes(t.status)) :
        floorFilter === "credited" ? t.isCredited :
        floorFilter === "voided" ? t.isAnyVoided :
        true;
      return matchSearch && matchFilter;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "priority":
          if (a.isVoided && !b.isVoided) comparison = 1;
          else if (!a.isVoided && b.isVoided) comparison = -1;
          else if (a.isCredited && !b.isCredited) comparison = 1;
          else if (!a.isCredited && b.isCredited) comparison = -1;
          else if (a.isDelayed && !b.isDelayed) comparison = -1;
          else if (!a.isDelayed && b.isDelayed) comparison = 1;
          else if (a.status === "Ready" && b.status !== "Ready") comparison = -1;
          else if (b.status === "Ready" && a.status !== "Ready") comparison = 1;
          else if (a.allPaid && !b.allPaid) comparison = 1;
          else if (!a.allPaid && b.allPaid) comparison = -1;
          else comparison = new Date(b.timestamp) - new Date(a.timestamp);
          break;
        case "name":
          comparison = a.tableName.localeCompare(b.tableName);
          break;
        case "waiter":
          comparison = a.waiterName.localeCompare(b.waiterName);
          break;
        case "time":
          comparison = new Date(a.timestamp) - new Date(b.timestamp);
          break;
        default:
          comparison = new Date(b.timestamp) - new Date(a.timestamp);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [tableGroups, searchQuery, floorFilter, sortBy, sortOrder]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData?.();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const FILTERS = [
    { key: "all", label: "All Tables", icon: <LayoutDashboard size={12} /> },
    { key: "active", label: "Active", icon: <Clock size={12} /> },
    { key: "delayed", label: "Delayed", icon: <AlertCircle size={12} />, alert: true },
    { key: "paid", label: "Settled", icon: <CheckCircle size={12} /> },
    { key: "credited", label: "Credits", icon: <BookOpen size={12} />, purple: true },
    { key: "voided", label: "Voided", icon: <Ban size={12} />, red: true },
  ];

  const SORT_OPTIONS = [
    { key: "priority", label: "Priority", icon: <ArrowUpDown size={12} /> },
    { key: "name", label: "Table Name", icon: <Utensils size={12} /> },
    { key: "waiter", label: "Waiter", icon: <Users size={12} /> },
    { key: "time", label: "Order Time", icon: <Timer size={12} /> },
  ];

  return (
    <div className={`min-h-screen p-4 md:p-8 space-y-6 pb-32 font-[Outfit] transition-colors duration-300 ${isDark ? "bg-gradient-to-b from-zinc-950 to-black text-white" : "bg-gradient-to-b from-zinc-50 to-white text-zinc-900"}`}>

      {/* ── HEADER SECTION ── */}
      <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 bg-gradient-to-r from-yellow-500/20 via-yellow-500/10 to-transparent border border-yellow-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-yellow-500 rounded-full" />
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-yellow-500">Live Floor Management</p>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase">
                Floor <span className="text-yellow-500">Overview</span>
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mt-2 opacity-60">
                {today} · {counts.active} active tables · {counts.delayed} delayed
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                <LayoutDashboard size={12} className="text-yellow-400" />
                <span className="text-[9px] font-black uppercase tracking-widest">Tables</span>
                <span className="text-xs font-black text-yellow-400">{counts.all}</span>
              </div>
              <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                <Clock size={12} className="text-blue-400" />
                <span className="text-[9px] font-black uppercase tracking-widest">Active</span>
                <span className="text-xs font-black text-blue-400">{counts.active}</span>
              </div>
              {counts.delayed > 0 && (
                <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-red-500/20 backdrop-blur-sm border border-red-500/30 animate-pulse">
                  <AlertCircle size={12} className="text-red-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-red-400">Delayed</span>
                  <span className="text-xs font-black text-red-400">{counts.delayed}</span>
                </div>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`p-2.5 rounded-xl transition-all backdrop-blur-sm border border-white/10 hover:bg-white/10 ${isRefreshing ? "animate-spin" : ""}`}
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ── */}
      <div className="sticky top-4 z-20 space-y-4">
        <div className={`flex flex-wrap gap-2 p-2 rounded-2xl backdrop-blur-sm border ${isDark ? "bg-zinc-900/50 border-white/5" : "bg-white/50 border-black/5"}`}>
          {FILTERS.map(({ key, label, icon, alert, red, purple }) => {
            const isActive = floorFilter === key;
            const count = counts[key];
            return (
              <button
                key={key}
                onClick={() => setFloorFilter(key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200
                  ${isActive
                    ? red ? "bg-red-500 text-white shadow-lg shadow-red-500/30 scale-105"
                      : purple ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30 scale-105"
                      : "bg-yellow-500 text-black shadow-lg shadow-yellow-500/30 scale-105"
                    : `hover:scale-105 ${isDark ? "text-zinc-400 hover:bg-white/10" : "text-zinc-600 hover:bg-black/5"}`}`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
                {count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-black
                    ${isActive ? "bg-white/20 text-current" : alert ? "bg-red-500/20 text-red-400" : red ? "bg-red-500/20 text-red-400" : purple ? "bg-purple-500/20 text-purple-400" : isDark ? "bg-white/10 text-zinc-400" : "bg-black/5 text-zinc-500"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input
              type="text"
              placeholder="Search by table name or waiter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-12 pr-4 py-3 rounded-2xl text-sm font-bold outline-none border transition-all duration-200
                ${isDark ? "bg-zinc-900/50 border-white/10 focus:border-yellow-500/50 text-white placeholder-zinc-600" 
                        : "bg-white/50 border-black/10 focus:border-yellow-500 text-zinc-900 placeholder-zinc-400"}`}
            />
          </div>
          
          <div className="flex gap-2">
            <div className={`flex rounded-2xl border p-1 ${isDark ? "border-white/10" : "border-black/10"}`}>
              {SORT_OPTIONS.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => {
                    if (sortBy === key) {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy(key);
                      setSortOrder("asc");
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all
                    ${sortBy === key 
                      ? "bg-yellow-500 text-black" 
                      : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}
                >
                  {icon}
                  <span className="hidden md:inline">{label}</span>
                  {sortBy === key && (
                    <span className="text-[8px]">{sortOrder === "asc" ? "↑" : "↓"}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      {floorFilter === "credited" ? (
        <CreditsPanel 
          credits={creditsLedger} 
          creditBreakdown={creditStatusBreakdown}
          isDark={isDark} 
        />
      ) : floorFilter === "voided" ? (
        <VoidedPanel voidedLedger={voidedLedger} voidedGroups={tableGroups.filter(t => t.isAnyVoided)} isDark={isDark} />
      ) : filteredTables.length === 0 ? (
        <div className={`py-32 text-center border-2 border-dashed rounded-3xl transition-all duration-300
          ${isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5"}`}>
          <Utensils size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm font-black uppercase tracking-[0.3em] opacity-50">
            {searchQuery ? "No matching tables found" : `No ${floorFilter} tables at the moment`}
          </p>
          <p className="text-[10px] mt-2 font-bold uppercase tracking-widest opacity-30">
            {searchQuery ? "Try a different search term" : "Check back later for updates"}
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

// ─── TABLE CARD (Enhanced UI) ─────────────────────────────────────────────────
function TableCard({ table, isDark, creditInfo }) {
  const [isHovered, setIsHovered] = useState(false);
  const { tableName, total, itemCount, status, waiterName, minsElapsed, isDelayed, allPaid, isVoided, isCredited, _rawOrders } = table;

  const isPaid = !isVoided && !isCredited && (allPaid || ["Paid","Mixed"].includes(status));
  const isServed = !isVoided && !isCredited && status === "Served" && !allPaid;
  const isReady = !isVoided && !isCredited && status === "Ready";
  
  // Check credit status from ledger
  const isCreditSettled = isCredited && creditInfo && (creditInfo.status === "FullySettled" || creditInfo.status === "PartiallySettled");
  const isCreditApproved = isCredited && creditInfo && creditInfo.status === "Approved";
  const isCreditPending = isCredited && creditInfo && (creditInfo.status === "PendingCashier" || creditInfo.status === "PendingManagerApproval");
  const isCreditRejected = isCredited && creditInfo && creditInfo.status === "Rejected";

  const voidedItemCount = useMemo(() => {
    if (!isVoided) return 0;
    return (_rawOrders || []).reduce((sum, order) => {
      let items = order.items || [];
      if (typeof items === "string") { try { items = JSON.parse(items); } catch { items = []; } }
      if (!Array.isArray(items)) return sum;
      return sum + items.filter(item => item.voidProcessed === true || item.status === "VOIDED").length;
    }, 0);
  }, [isVoided, _rawOrders]);

  const getCardStyles = () => {
    if (isVoided) return "opacity-60 grayscale-[0.2]";
    if (isCredited && isCreditRejected) return "border-l-4 border-l-red-500";
    if (isCredited && isCreditSettled) return "border-l-4 border-l-emerald-500";
    if (isCredited) return "border-l-4 border-l-purple-500";
    if (isDelayed) return "border-l-4 border-l-red-500";
    if (isReady) return "border-l-4 border-l-emerald-500";
    if (isPaid) return "opacity-70";
    return "";
  };

  const statusLabel = () => {
    if (isVoided) return { text: "Cancelled", color: "bg-zinc-500/20 text-zinc-400", icon: <Ban size={10} /> };
    if (isCreditSettled) return { text: "Credit Settled", color: "bg-emerald-500/20 text-emerald-400", icon: <CheckCircle size={10} /> };
    if (isCreditApproved) return { text: "Credit Approved", color: "bg-purple-500/20 text-purple-400", icon: <CheckCircle size={10} /> };
    if (isCreditPending) return { text: "Credit Pending", color: "bg-yellow-500/20 text-yellow-400", icon: <Hourglass size={10} /> };
    if (isCreditRejected) return { text: "Credit Rejected", color: "bg-red-500/20 text-red-400", icon: <XCircle size={10} /> };
    if (isPaid) return { text: "Paid", color: "bg-emerald-500/20 text-emerald-400", icon: <CheckCircle size={10} /> };
    if (isServed) return { text: "Served", color: "bg-blue-500/20 text-blue-400", icon: <Eye size={10} /> };
    if (isReady) return { text: "Food Ready!", color: "bg-emerald-500/20 text-emerald-400 animate-pulse", icon: <ChefHat size={10} /> };
    if (isDelayed) return { text: `${minsElapsed}m Delayed`, color: "bg-red-500/20 text-red-400 animate-pulse", icon: <AlertCircle size={10} /> };
    return { text: status || "Active", color: "bg-yellow-500/20 text-yellow-400", icon: <Clock size={10} /> };
  };

  const sl = statusLabel();

  return (
    <div
      className={`relative rounded-2xl border transition-all duration-300 overflow-hidden ${getCardStyles()}
        ${isHovered ? "transform -translate-y-1 shadow-xl" : "shadow-md"}
        ${isDark ? "bg-zinc-900/50 border-white/10 hover:border-yellow-500/30" : "bg-white border-black/10 hover:border-yellow-500/30"}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`absolute inset-0 bg-gradient-to-br from-yellow-500/0 to-yellow-500/0 transition-all duration-300 ${isHovered ? "from-yellow-500/5 to-yellow-500/10" : ""}`} />

      <div className="relative p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Utensils size={16} className={isCredited ? "text-purple-400" : isDelayed ? "text-red-400" : "text-yellow-500"} />
              <h3 className={`font-black text-xl italic tracking-tighter uppercase truncate
                ${isVoided ? "text-zinc-500" : isCredited ? "text-purple-400" : isDark ? "text-white" : "text-zinc-900"}`}>
                {tableName}
              </h3>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase ${sl.color}`}>
                {sl.icon}
                <span>{sl.text}</span>
              </div>
              {!isPaid && !isVoided && !isCredited && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black ${isDark ? "bg-white/5 text-zinc-400" : "bg-black/5 text-zinc-600"}`}>
                  <Timer size={10} />
                  <span>{minsElapsed}m</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 py-2 border-y border-dashed border-white/10">
          <div className="flex justify-between items-center">
            <span className={`text-[9px] font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              <User size={10} className="inline mr-1.5" /> Waiter
            </span>
            <span className={`text-[11px] font-bold ${isVoided ? "line-through" : ""} ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              {waiterName}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className={`text-[9px] font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              <Utensils size={10} className="inline mr-1.5" /> Items
            </span>
            <span className={`text-[11px] font-bold ${isVoided ? "line-through" : ""} ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className={`text-[9px] font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              <Banknote size={10} className="inline mr-1.5" /> Total
            </span>
            <span className={`text-base font-black ${isCredited ? "text-purple-400" : isPaid ? "text-emerald-400" : "text-yellow-500"}`}>
              UGX {total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Credit Details if applicable */}
        {isCredited && creditInfo && (
          <div className={`p-2 rounded-xl ${isCreditSettled ? "bg-emerald-500/10" : isCreditRejected ? "bg-red-500/10" : "bg-purple-500/10"}`}>
            <div className="flex justify-between items-center text-[9px] font-black">
              <span className="uppercase tracking-widest">Client</span>
              <span>{creditInfo.client_name || "—"}</span>
            </div>
            {creditInfo.pay_by && !isCreditSettled && !isCreditRejected && (
              <div className="flex justify-between items-center text-[9px] font-black mt-1">
                <span className="uppercase tracking-widest text-amber-400">Pay By</span>
                <span className="text-amber-400">{creditInfo.pay_by}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Footer */}
        {!isVoided && !isCredited && (
          <div className={`flex items-center gap-2 p-3 rounded-xl transition-all
            ${isDelayed ? "bg-red-500/10" : isReady ? "bg-emerald-500/10" : isPaid ? "bg-zinc-500/10" : isServed ? "bg-blue-500/10" : "bg-yellow-500/10"}`}>
            <div className={`p-1.5 rounded-lg ${isDelayed ? "bg-red-500/20" : isReady ? "bg-emerald-500/20" : isPaid ? "bg-zinc-500/20" : isServed ? "bg-blue-500/20" : "bg-yellow-500/20"}`}>
              {isDelayed ? <AlertCircle size={12} className="text-red-400" /> :
               isReady ? <ChefHat size={12} className="text-emerald-400" /> :
               isPaid ? <CheckCircle size={12} className="text-zinc-400" /> :
               isServed ? <Eye size={12} className="text-blue-400" /> :
               <Clock size={12} className="text-yellow-400" />}
            </div>
            <p className={`flex-1 text-[9px] font-black uppercase tracking-widest
              ${isDelayed ? "text-red-400" : isReady ? "text-emerald-400" : isPaid ? "text-zinc-500" : isServed ? "text-blue-400" : "text-yellow-400"}`}>
              {isDelayed ? `Alert ${waiterName}` :
               isReady ? "Ready for service" :
               isPaid ? "Table cleared" :
               isServed ? "Awaiting payment" :
               "Order in progress"}
            </p>
            <TrendingUp size={12} className="opacity-40" />
          </div>
        )}

        {isVoided && (
          <div className={`flex items-center gap-2 p-3 rounded-xl ${isDark ? "bg-zinc-800/50" : "bg-zinc-100"}`}>
            <Ban size={12} className="text-zinc-500" />
            <p className="flex-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">
              {voidedItemCount} item{voidedItemCount !== 1 ? "s" : ""} cancelled
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CREDITS PANEL (FIXED - Proper status breakdown) ──────────────────────────
function CreditsPanel({ credits, creditBreakdown, isDark }) {
  const [activeCreditTab, setActiveCreditTab] = useState("pendingCashier");

  const creditTabs = [
    { key: "pendingCashier", label: "Wait for Cashier", icon: <Hourglass size={12} />, count: creditBreakdown.pendingCashier.length, color: "yellow" },
    { key: "pendingManager", label: "Wait for Manager", icon: <Clock size={12} />, count: creditBreakdown.pendingManager.length, color: "orange" },
    { key: "approved", label: "Approved", icon: <CheckCircle size={12} />, count: creditBreakdown.approved.length, color: "purple" },
    { key: "settled", label: "Settled", icon: <CheckCircle size={12} />, count: creditBreakdown.settled.length, color: "green" },
    { key: "rejected", label: "Rejected", icon: <XCircle size={12} />, count: creditBreakdown.rejected.length, color: "red" },
  ];

  const getCurrentCredits = () => {
    switch (activeCreditTab) {
      case "pendingCashier": return creditBreakdown.pendingCashier;
      case "pendingManager": return creditBreakdown.pendingManager;
      case "approved": return creditBreakdown.approved;
      case "settled": return creditBreakdown.settled;
      case "rejected": return creditBreakdown.rejected;
      default: return [];
    }
  };

  const getCurrentTotal = () => {
    switch (activeCreditTab) {
      case "pendingCashier": return creditBreakdown.totalPendingCashier;
      case "pendingManager": return creditBreakdown.totalPendingManager;
      case "approved": return creditBreakdown.totalApproved;
      case "settled": return creditBreakdown.totalSettled;
      case "rejected": return creditBreakdown.totalRejected;
      default: return 0;
    }
  };

  const currentCredits = getCurrentCredits();
  const currentTotal = getCurrentTotal();

  if (credits.length === 0) {
    return (
      <div className={`py-32 text-center border-2 border-dashed rounded-3xl ${isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5"}`}>
        <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
        <p className="text-sm font-black uppercase tracking-[0.3em] opacity-50">No credit orders this month</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className={`p-4 rounded-2xl border ${isDark ? "bg-yellow-500/10 border-yellow-500/20" : "bg-yellow-50 border-yellow-200"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-yellow-400 mb-1">Wait for Cashier</p>
          <p className="text-xl font-black text-yellow-400">UGX {creditBreakdown.totalPendingCashier.toLocaleString()}</p>
          <p className="text-[9px] font-bold mt-0.5 opacity-60">{creditBreakdown.pendingCashier.length} pending</p>
        </div>
        <div className={`p-4 rounded-2xl border ${isDark ? "bg-orange-500/10 border-orange-500/20" : "bg-orange-50 border-orange-200"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-orange-400 mb-1">Wait for Manager</p>
          <p className="text-xl font-black text-orange-400">UGX {creditBreakdown.totalPendingManager.toLocaleString()}</p>
          <p className="text-[9px] font-bold mt-0.5 opacity-60">{creditBreakdown.pendingManager.length} pending</p>
        </div>
        <div className={`p-4 rounded-2xl border ${isDark ? "bg-purple-500/10 border-purple-500/20" : "bg-purple-50 border-purple-200"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-purple-400 mb-1">Approved</p>
          <p className="text-xl font-black text-purple-400">UGX {creditBreakdown.totalApproved.toLocaleString()}</p>
          <p className="text-[9px] font-bold mt-0.5 opacity-60">{creditBreakdown.approved.length} approved</p>
        </div>
        <div className={`p-4 rounded-2xl border ${isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-emerald-400 mb-1">Settled</p>
          <p className="text-xl font-black text-emerald-400">UGX {creditBreakdown.totalSettled.toLocaleString()}</p>
          <p className="text-[9px] font-bold mt-0.5 opacity-60">{creditBreakdown.settled.length} settled</p>
        </div>
        <div className={`p-4 rounded-2xl border ${isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-red-400 mb-1">Rejected</p>
          <p className="text-xl font-black text-red-400">UGX {creditBreakdown.totalRejected.toLocaleString()}</p>
          <p className="text-[9px] font-bold mt-0.5 opacity-60">{creditBreakdown.rejected.length} rejected</p>
        </div>
      </div>

      {/* Credit Status Tabs */}
      <div className={`flex flex-wrap gap-2 p-2 rounded-2xl ${isDark ? "bg-zinc-900/50" : "bg-white/50"}`}>
        {creditTabs.map(({ key, label, icon, count, color }) => {
          const isActive = activeCreditTab === key;
          const colorClasses = {
            yellow: "bg-yellow-500 text-black",
            orange: "bg-orange-500 text-white",
            purple: "bg-purple-500 text-white",
            green: "bg-emerald-500 text-white",
            red: "bg-red-500 text-white",
          };
          return (
            <button
              key={key}
              onClick={() => setActiveCreditTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                ${isActive 
                  ? colorClasses[color] + " shadow-lg scale-105"
                  : isDark ? "text-zinc-400 hover:bg-white/10" : "text-zinc-600 hover:bg-black/5"}`}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black
                  ${isActive ? "bg-white/20" : isDark ? "bg-white/10" : "bg-black/5"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Current Credit List */}
      {currentCredits.length === 0 ? (
        <div className={`py-16 text-center border-2 border-dashed rounded-2xl ${isDark ? "border-white/10" : "border-black/10"}`}>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-50">No {activeCreditTab} credits</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-yellow-500 rounded-full" />
              <p className="text-[10px] font-black uppercase tracking-widest">Total: UGX {currentTotal.toLocaleString()}</p>
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest opacity-50">{currentCredits.length} record{currentCredits.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {currentCredits.map((credit, i) => (
              <CreditLedgerCard 
                key={i} 
                credit={credit} 
                isDark={isDark} 
                status={activeCreditTab}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CreditLedgerCard({ credit, isDark, status }) {
  const getStatusConfig = () => {
    switch (status) {
      case "pendingCashier":
        return { color: "yellow", bg: "bg-yellow-500/10", border: "border-yellow-500/20", icon: <Hourglass size={12} />, label: "Wait for Cashier" };
      case "pendingManager":
        return { color: "orange", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: <Clock size={12} />, label: "Wait for Manager" };
      case "approved":
        return { color: "purple", bg: "bg-purple-500/10", border: "border-purple-500/20", icon: <CheckCircle size={12} />, label: "Approved" };
      case "settled":
        return { color: "green", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: <CheckCircle size={12} />, label: "Settled" };
      case "rejected":
        return { color: "red", bg: "bg-red-500/10", border: "border-red-500/20", icon: <XCircle size={12} />, label: "Rejected" };
      default:
        return { color: "zinc", bg: "bg-zinc-500/10", border: "border-zinc-500/20", icon: <BookOpen size={12} />, label: "Credit" };
    }
  };

  const config = getStatusConfig();
  const colorMap = {
    yellow: "text-yellow-400",
    orange: "text-orange-400",
    purple: "text-purple-400",
    green: "text-emerald-400",
    red: "text-red-400",
    zinc: "text-zinc-400",
  };

  return (
    <div className={`rounded-2xl border p-4 transition-all hover:transform hover:-translate-y-1 hover:shadow-xl ${config.bg} ${config.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${config.bg}`}>
          {config.icon}
        </div>
        <span className={`text-[8px] font-black uppercase tracking-widest ${colorMap[config.color]}`}>
          {config.label}
        </span>
      </div>
      <h3 className={`font-black text-lg italic tracking-tighter uppercase mb-2 ${colorMap[config.color]}`}>
        {credit.table_name || "Table"}
      </h3>
      <div className="space-y-1.5 mb-3">
        {credit.client_name && (
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Client</span>
            <span className="text-[10px] font-bold">{credit.client_name}</span>
          </div>
        )}
        {credit.client_phone && (
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Phone</span>
            <span className="text-[10px]">{credit.client_phone}</span>
          </div>
        )}
        {credit.pay_by && status !== "settled" && status !== "rejected" && (
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">Pay By</span>
            <span className="text-[10px] font-bold text-amber-400">{credit.pay_by}</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Amount</span>
          <span className={`text-base font-black ${colorMap[config.color]}`}>
            UGX {Number(credit.amount || 0).toLocaleString()}
          </span>
        </div>
      </div>
      <div className={`flex items-center justify-between pt-2 border-t ${isDark ? "border-white/5" : "border-black/5"}`}>
        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">
          {status === "settled" ? "Paid" : status === "rejected" ? "Declined" : "Pending"}
        </span>
        <span className="text-[8px] font-bold">
          {credit.created_at ? new Date(credit.created_at).toLocaleDateString() : ""}
        </span>
      </div>
    </div>
  );
}

// ─── VOIDED PANEL ─────────────────────────────────────────────────────────────
function VoidedPanel({ voidedLedger, voidedGroups, isDark }) {
  const liveTableNames = new Set(voidedGroups.map(g => g.tableName));
  const ledgerOnly = voidedLedger.filter(r => {
    const key = (r.table_name || "").trim().toUpperCase();
    return !liveTableNames.has(key);
  });

  if (voidedGroups.length === 0 && ledgerOnly.length === 0) {
    return (
      <div className={`py-32 text-center border-2 border-dashed rounded-3xl ${isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5"}`}>
        <Ban size={48} className="mx-auto mb-4 opacity-30" />
        <p className="text-sm font-black uppercase tracking-[0.3em] opacity-50">No cancelled items today</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {voidedGroups.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-red-500 rounded-full" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">Active Tables With Voided Items</p>
            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[9px] font-black">{voidedGroups.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {voidedGroups.map(table => (
              <TableCard key={table.tableName} table={table} isDark={isDark} creditInfo={null} />
            ))}
          </div>
        </div>
      )}

      {ledgerOnly.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-zinc-500 rounded-full" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Archived Void Records</p>
            <span className="px-2 py-0.5 rounded-full bg-zinc-500/20 text-zinc-400 text-[9px] font-black">{ledgerOnly.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ledgerOnly.map((r, i) => (
              <VoidLedgerCard key={i} record={r} isDark={isDark} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VoidLedgerCard({ record, isDark }) {
  return (
    <div className={`rounded-2xl border p-4 transition-all hover:transform hover:-translate-y-1 hover:shadow-xl
      ${isDark ? "bg-zinc-900/30 border-white/10" : "bg-white/50 border-black/10"}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-red-500/10">
          <XCircle size={12} className="text-red-400" />
        </div>
        <span className="text-[8px] font-black uppercase tracking-widest text-red-400">Void Approved</span>
      </div>
      <h3 className={`font-black text-lg italic tracking-tighter uppercase mb-2 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
        {record.table_name || "Table"}
      </h3>
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between items-center">
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Item</span>
          <span className="text-[10px] font-black line-through">{record.item_name}</span>
        </div>
        {record.reason && (
          <div className="flex justify-between items-start gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Reason</span>
            <span className="text-[9px] font-bold italic text-right max-w-[60%]">{record.reason}</span>
          </div>
        )}
      </div>
      <div className={`flex items-center justify-between pt-2 border-t ${isDark ? "border-white/5" : "border-black/5"}`}>
        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Archived</span>
        <span className="text-[8px] font-bold">{record.created_at ? new Date(record.created_at).toLocaleTimeString() : ""}</span>
      </div>
    </div>
  );
}