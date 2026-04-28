import React, { useState, useMemo, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import {
  Search, LayoutDashboard, AlertCircle, Clock, CheckCircle,
  Banknote, RefreshCw, Eye, XCircle, Ban, BookOpen, User,
  ChefHat, Utensils, ArrowUpDown, Hourglass
} from "lucide-react";
import API_URL from "../../../config/api";

// --- HELPERS ---
function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
}
function getTodayLocal() { return toLocalDateStr(new Date()); }
function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function isRowAllVoided(order) {
  let items = order.items || [];
  if (typeof items === "string") { try { items = JSON.parse(items); } catch { items = []; } }
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.every(item => item.voidProcessed === true || item.status === "VOIDED");
}
function isRowAnyVoided(order) {
  let items = order.items || [];
  if (typeof items === "string") { try { items = JSON.parse(items); } catch { items = []; } }
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

export default function LiveTableGrid() {
  const { orders = [], refreshData } = useData();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [searchQuery, setSearchQuery] = useState("");
  const [floorFilter, setFloorFilter] = useState("all");
  const [sortBy, setSortBy] = useState("priority");
  const [sortOrder, setSortOrder] = useState("asc");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Credits ledger
  const [creditsLedger, setCreditsLedger] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/cashier-ops/credits`);
        if (res.ok) {
          const rows = await res.json();
          const thisMonth = getCurrentMonth();
          setCreditsLedger(rows.filter(r => {
            const d = r.created_at || r.confirmed_at;
            return d && toLocalDateStr(new Date(d)).startsWith(thisMonth);
          }));
        }
      } catch {}
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  // Voided ledger
  const [voidedLedger, setVoidedLedger] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        const today = getTodayLocal();
        const res = await fetch(`${API_URL}/api/orders/void-requests`);
        if (!res.ok) return;
        const rows = await res.json();
        setVoidedLedger(rows.filter(r => {
          const approved = r.status === "Approved" || r.status === "approved" || r.voidProcessed === true;
          const d = r.created_at || r.resolved_at;
          const isToday = d && toLocalDateStr(new Date(d)) === today;
          return approved && isToday;
        }));
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
      if (!map[key] || new Date(c.created_at) > new Date(map[key].created_at)) map[key] = c;
    });
    return map;
  }, [creditsLedger]);

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

  // Group orders by table
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
      if (order.staff_name || order.waiterName) g.waiterName = order.staff_name || order.waiterName;
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

  // Credit breakdown
  const creditBreakdown = useMemo(() => {
    const pendingCashier = creditsLedger.filter(c => c.status === "PendingCashier");
    const pendingManager = creditsLedger.filter(c => c.status === "PendingManagerApproval");
    const approved = creditsLedger.filter(c => c.status === "Approved");
    const settled = creditsLedger.filter(c => c.status === "FullySettled" || c.status === "PartiallySettled");
    const rejected = creditsLedger.filter(c => c.status === "Rejected");
    return {
      pendingCashier, pendingManager, approved, settled, rejected,
      totalPendingCashier: pendingCashier.reduce((s,c)=>s+Number(c.amount||0),0),
      totalPendingManager: pendingManager.reduce((s,c)=>s+Number(c.amount||0),0),
      totalApproved: approved.reduce((s,c)=>s+Number(c.amount||0),0),
      totalSettled: settled.reduce((s,c)=>s+Number(c.amount_paid||c.amount||0),0),
      totalRejected: rejected.reduce((s,c)=>s+Number(c.amount||0),0),
    };
  }, [creditsLedger]);

  const counts = useMemo(() => ({
    all: tableGroups.length,
    active: tableGroups.filter(t => !t.isVoided && !t.isCredited && !t.allPaid && ["Pending","Preparing","Ready","Delayed"].includes(t.status)).length,
    delayed: tableGroups.filter(t => t.isDelayed).length,
    paid: tableGroups.filter(t => !t.isVoided && !t.isCredited && (t.allPaid || ["Paid","Mixed","Served"].includes(t.status))).length,
    credited: creditsLedger.length,
    voided: Math.max(voidedLedger.length, tableGroups.filter(t => t.isAnyVoided).length),
  }), [tableGroups, creditsLedger, voidedLedger]);

  const filteredTables = useMemo(() => {
    let filtered = tableGroups.filter(t => {
      const matchSearch = t.tableName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.waiterName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFilter =
        floorFilter === "all" ? true :
        floorFilter === "active" ? !t.isVoided && !t.isCredited && !t.allPaid && ["Pending","Preparing","Ready","Delayed"].includes(t.status) :
        floorFilter === "delayed" ? t.isDelayed :
        floorFilter === "paid" ? !t.isVoided && !t.isCredited && (t.allPaid || ["Paid","Mixed","Served"].includes(t.status)) :
        false;
      return matchSearch && matchFilter;
    });
    filtered.sort((a,b) => {
      let cmp = 0;
      switch (sortBy) {
        case "priority":
          if (a.isVoided !== b.isVoided) cmp = a.isVoided ? 1 : -1;
          else if (a.isCredited !== b.isCredited) cmp = a.isCredited ? 1 : -1;
          else if (a.isDelayed !== b.isDelayed) cmp = a.isDelayed ? -1 : 1;
          else if (a.status === "Ready" && b.status !== "Ready") cmp = -1;
          else if (b.status === "Ready" && a.status !== "Ready") cmp = 1;
          else if (a.allPaid !== b.allPaid) cmp = a.allPaid ? 1 : -1;
          else cmp = new Date(b.timestamp) - new Date(a.timestamp);
          break;
        case "name": cmp = a.tableName.localeCompare(b.tableName); break;
        case "waiter": cmp = a.waiterName.localeCompare(b.waiterName); break;
        case "time": cmp = new Date(a.timestamp) - new Date(b.timestamp); break;
        default: cmp = new Date(b.timestamp) - new Date(a.timestamp);
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return filtered;
  }, [tableGroups, searchQuery, floorFilter, sortBy, sortOrder]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData?.();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const FILTERS = [
    { key: "all", label: "All", icon: <LayoutDashboard size={11} /> },
    { key: "active", label: "Active", icon: <Clock size={11} /> },
    { key: "delayed", label: "Delayed", icon: <AlertCircle size={11} />, alert: true },
    { key: "paid", label: "Paid", icon: <CheckCircle size={11} /> },
    { key: "credited", label: "Credits", icon: <BookOpen size={11} />, purple: true },
    { key: "voided", label: "Voided", icon: <Ban size={11} />, red: true },
  ];

  const SORT_OPTIONS = [
    { key: "priority", label: "Priority", icon: <ArrowUpDown size={11} /> },
    { key: "name", label: "Table", icon: <Utensils size={11} /> },
    { key: "waiter", label: "Waiter", icon: <User size={11} /> },
    { key: "time", label: "Time", icon: <Clock size={11} /> },
  ];

  const showCredits = floorFilter === "credited";
  const showVoided = floorFilter === "voided";
  const showTables = !showCredits && !showVoided;

  return (
    <div
      className={`min-h-screen font-[Outfit] transition-colors duration-300 ${isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"}`}
      style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
    >
      {/* Sticky header strip */}
      <div
        className={`sticky top-0 z-20 px-3 pt-3 pb-2 ${isDark ? "bg-black/95 backdrop-blur-sm" : "bg-gray-50/95 backdrop-blur-sm"}`}
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        {/* Title row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-black uppercase tracking-tighter flex items-center gap-2 leading-tight">
              <div className="shrink-0 w-1 h-4 sm:h-5 bg-yellow-500 rounded-full" />
              <span className="truncate">Floor Manager</span>
            </h1>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-bold text-gray-500 mt-0.5 ml-3">
              <span>{today}</span>
              <span>•</span>
              <span>{counts.active} active</span>
              {counts.delayed > 0 && <span className="text-red-500">• {counts.delayed} delayed</span>}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className={`shrink-0 p-2 rounded-full border min-w-[36px] min-h-[36px] flex items-center justify-center ${isDark ? "bg-white/10 border-white/20" : "bg-white border-gray-200"}`}
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex overflow-x-auto gap-1.5 pb-1 no-scrollbar -mx-3 px-3">
          {FILTERS.map(({ key, label, icon, alert, red, purple }) => {
            const active = floorFilter === key;
            const count = counts[key];
            let bg = active
              ? red ? "bg-red-500 text-white" : purple ? "bg-purple-500 text-white" : "bg-yellow-500 text-black"
              : isDark ? "bg-gray-800/70 text-gray-300" : "bg-white text-gray-700 border border-gray-200";
            return (
              <button
                key={key}
                onClick={() => setFloorFilter(key)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all shrink-0 min-h-[30px] ${bg} shadow-sm`}
              >
                {icon}
                <span>{label}</span>
                {count > 0 && (
                  <span className={`ml-0.5 text-[9px] rounded-full px-1.5 py-px ${active ? "bg-black/20" : isDark ? "bg-white/10" : "bg-gray-100"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="px-3 pt-3">
        {showCredits && <CreditsPanel credits={creditsLedger} breakdown={creditBreakdown} isDark={isDark} />}
        {showVoided && <VoidedPanel ledger={voidedLedger} groups={tableGroups.filter(t=>t.isAnyVoided)} isDark={isDark} />}
        {showTables && (
          <>
            {/* Search & Sort */}
            <div className="flex flex-col gap-2 mb-4">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search table or waiter…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 rounded-xl text-[13px] font-medium border outline-none transition-all min-h-[40px]
                    ${isDark ? "bg-gray-900 border-gray-700 focus:border-yellow-500" : "bg-white border-gray-200 focus:border-yellow-500"}`}
                />
              </div>
              {/* Sort row — scrollable on mobile, wraps on desktop */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-3 px-3 pb-0.5">
                {SORT_OPTIONS.map(({ key, label, icon }) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (sortBy === key) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      else { setSortBy(key); setSortOrder("asc"); }
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase whitespace-nowrap shrink-0 min-h-[30px] transition-all
                      ${sortBy === key ? "bg-yellow-500 text-black" : isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"}`}
                  >
                    {icon}
                    {label}
                    {sortBy === key && <span className="text-[8px] ml-0.5">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Table Grid */}
            {filteredTables.length === 0 ? (
              <div className={`py-16 text-center border border-dashed rounded-2xl ${isDark ? "border-gray-700" : "border-gray-300"}`}>
                <Utensils size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs font-black uppercase tracking-widest opacity-50">No tables found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredTables.map(table => (
                  <TableCard key={table.tableName} table={table} isDark={isDark} creditInfo={creditsByTable[table.tableName]} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- Table Card ---
function TableCard({ table, isDark, creditInfo }) {
  const { tableName, total, itemCount, status, waiterName, minsElapsed, isDelayed, allPaid, isVoided, isCredited } = table;

  let cardStyle = isDark ? "bg-gray-900/70 border-gray-800" : "bg-white border-gray-200";
  let statusBadge = { text: "", color: "", icon: null };

  if (isVoided) {
    cardStyle += " opacity-60 grayscale";
    statusBadge = { text: "Voided", color: "bg-gray-500 text-white", icon: <Ban size={9} /> };
  } else if (isCredited && creditInfo) {
    const settled = creditInfo.status === "FullySettled" || creditInfo.status === "PartiallySettled";
    if (settled) statusBadge = { text: "Settled", color: "bg-green-500 text-white", icon: <CheckCircle size={9} /> };
    else if (creditInfo.status === "Approved") statusBadge = { text: "Approved", color: "bg-purple-500 text-white", icon: <CheckCircle size={9} /> };
    else statusBadge = { text: "Pending", color: "bg-yellow-500 text-black", icon: <Hourglass size={9} /> };
  } else if (allPaid) {
    statusBadge = { text: "Paid", color: "bg-green-500 text-white", icon: <CheckCircle size={9} /> };
  } else if (status === "Served") {
    statusBadge = { text: "Served", color: "bg-blue-500 text-white", icon: <Eye size={9} /> };
  } else if (status === "Ready") {
    statusBadge = { text: "Ready!", color: "bg-emerald-500 text-black", icon: <ChefHat size={9} /> };
  } else if (isDelayed) {
    statusBadge = { text: `${minsElapsed}m`, color: "bg-red-500 text-white", icon: <AlertCircle size={9} /> };
  } else {
    statusBadge = { text: status || "Active", color: "bg-yellow-500 text-black", icon: <Clock size={9} /> };
  }

  return (
    <div className={`rounded-xl border p-3 shadow-sm transition-all hover:shadow-md ${cardStyle}`}>
      {/* Table name + badge */}
      <div className="flex justify-between items-start gap-1 mb-2">
        <h3 className={`font-black text-sm uppercase truncate leading-tight ${isCredited ? "text-purple-400" : isVoided ? "text-gray-500" : "text-yellow-500"}`}>
          {tableName}
        </h3>
        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase shrink-0 ${statusBadge.color}`}>
          {statusBadge.icon}
          <span className="ml-0.5">{statusBadge.text}</span>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className="text-gray-500 truncate mr-1">Waiter</span>
          <span className="font-medium truncate max-w-[80px] text-right">{waiterName}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-gray-500">Items</span>
          <span>{itemCount}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-gray-500">Total</span>
          <span className={`font-bold text-[11px] ${isCredited ? "text-purple-400" : allPaid ? "text-green-400" : "text-yellow-500"}`}>
            {/* Abbreviate on very small — show full number, let it be */}
            UGX {total.toLocaleString()}
          </span>
        </div>
        {isCredited && creditInfo?.client_name && (
          <div className="flex justify-between text-[9px] mt-1 pt-1 border-t border-gray-200/30">
            <span className="text-gray-500">Client</span>
            <span className="truncate max-w-[90px] text-right">{creditInfo.client_name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Credits Panel ---
function CreditsPanel({ credits, breakdown, isDark }) {
  const [activeTab, setActiveTab] = useState("pendingCashier");
  const tabs = [
    { key: "pendingCashier", label: "Cashier", fullLabel: "Wait for Cashier", icon: <Hourglass size={11} />, count: breakdown.pendingCashier.length, total: breakdown.totalPendingCashier, color: "yellow" },
    { key: "pendingManager", label: "Manager", fullLabel: "Wait for Manager", icon: <Clock size={11} />, count: breakdown.pendingManager.length, total: breakdown.totalPendingManager, color: "orange" },
    { key: "approved", label: "Approved", fullLabel: "Approved", icon: <CheckCircle size={11} />, count: breakdown.approved.length, total: breakdown.totalApproved, color: "purple" },
    { key: "settled", label: "Settled", fullLabel: "Settled", icon: <CheckCircle size={11} />, count: breakdown.settled.length, total: breakdown.totalSettled, color: "green" },
    { key: "rejected", label: "Rejected", fullLabel: "Rejected", icon: <XCircle size={11} />, count: breakdown.rejected.length, total: breakdown.totalRejected, color: "red" },
  ];

  const colorMap = { yellow: "text-yellow-500", orange: "text-orange-500", purple: "text-purple-500", green: "text-green-500", red: "text-red-500" };
  const activeBgMap = { yellow: "bg-yellow-500 text-black", orange: "bg-orange-500 text-white", purple: "bg-purple-500 text-white", green: "bg-green-500 text-white", red: "bg-red-500 text-white" };

  const currentList = {
    pendingCashier: breakdown.pendingCashier,
    pendingManager: breakdown.pendingManager,
    approved: breakdown.approved,
    settled: breakdown.settled,
    rejected: breakdown.rejected,
  }[activeTab];

  if (credits.length === 0) {
    return (
      <div className={`py-16 text-center border-2 border-dashed rounded-2xl ${isDark ? "border-gray-800" : "border-gray-200"}`}>
        <BookOpen size={28} className="mx-auto mb-2 opacity-30" />
        <p className="text-[10px] font-black uppercase">No credits this month</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats — 2-col on mobile, 5-col on sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {tabs.map(tab => (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${isDark ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"} ${activeTab === tab.key ? "ring-2 ring-yellow-500/50" : ""} text-center`}
          >
            <p className="text-[8px] font-black uppercase text-gray-500 mb-1 truncate">{tab.label}</p>
            <p className={`text-xs font-black ${colorMap[tab.color]} leading-tight`}>
              UGX {tab.total.toLocaleString()}
            </p>
            <p className="text-[9px] text-gray-400 mt-0.5">{tab.count} rec.</p>
          </div>
        ))}
      </div>

      {/* Tab pills — scrollable on mobile */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-3 px-3 pb-0.5">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[9px] font-black uppercase whitespace-nowrap shrink-0 min-h-[28px] transition-all
              ${activeTab === tab.key ? activeBgMap[tab.color] : isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"}`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.fullLabel}</span>
            <span className="sm:hidden">{tab.label}</span>
            <span className="ml-1 text-[8px] bg-black/10 rounded-full px-1.5">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {currentList.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-xs">No items</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {currentList.map((credit, idx) => (
            <div key={idx} className={`p-3 rounded-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
              <div className="flex justify-between items-start gap-1">
                <span className="font-black text-sm uppercase truncate">{credit.table_name || "Table"}</span>
                <span className="text-[9px] text-gray-500 shrink-0">{credit.created_at ? new Date(credit.created_at).toLocaleDateString() : ""}</span>
              </div>
              {credit.client_name && (
                <p className="text-[9px] mt-1 flex items-center gap-1 text-gray-400 truncate">
                  <User size={9} className="shrink-0" />{credit.client_name}
                </p>
              )}
              {credit.client_phone && <p className="text-[8px] text-gray-500">{credit.client_phone}</p>}
              <p className="text-sm font-black mt-2">UGX {Number(credit.amount).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Voided Panel ---
function VoidedPanel({ ledger, groups, isDark }) {
  const liveTableNames = new Set(groups.map(g => g.tableName));
  const archivedVoids = ledger.filter(r => !liveTableNames.has((r.table_name || "").trim().toUpperCase()));

  if (groups.length === 0 && archivedVoids.length === 0) {
    return (
      <div className={`py-16 text-center border-2 border-dashed rounded-2xl ${isDark ? "border-gray-700" : "border-gray-200"}`}>
        <Ban size={28} className="mx-auto mb-2 opacity-30" />
        <p className="text-[10px] font-black uppercase">No voided items today</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.length > 0 && (
        <div>
          <h2 className="text-sm font-black uppercase mb-3 flex items-center gap-2">
            <div className="w-1 h-4 bg-red-500 rounded-full" />
            Active tables with voids ({groups.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {groups.map(table => <TableCard key={table.tableName} table={table} isDark={isDark} creditInfo={null} />)}
          </div>
        </div>
      )}
      {archivedVoids.length > 0 && (
        <div>
          <h2 className="text-sm font-black uppercase mb-3 flex items-center gap-2">
            <div className="w-1 h-4 bg-gray-500 rounded-full" />
            Archived voids ({archivedVoids.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {archivedVoids.map((v, i) => (
              <div key={i} className={`p-3 rounded-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                <p className="font-black text-sm truncate">{v.table_name || "Table"}</p>
                <p className="text-red-400 line-through text-xs mt-1 truncate">{v.item_name}</p>
                {v.reason && <p className="text-[9px] text-gray-500 mt-1 leading-tight">Reason: {v.reason}</p>}
                <p className="text-[8px] text-gray-400 mt-2">{new Date(v.created_at).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}