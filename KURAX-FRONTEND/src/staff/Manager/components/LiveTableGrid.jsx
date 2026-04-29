import React, { useState, useMemo, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import {
  Search, LayoutDashboard, AlertCircle, Clock, CheckCircle,
  Banknote, RefreshCw, Eye, XCircle, Ban, BookOpen, User,
  ChefHat, Utensils, ArrowUpDown, Hourglass
} from "lucide-react";
import API_URL from "../../../config/api";

// --- HELPERS (same as before) ---
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

  // Credit breakdown (for CreditsPanel)
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

  // Filter & sort tables (only used for "all", "active", "delayed", "paid")
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
    { key: "all", label: "All", icon: <LayoutDashboard size={12} /> },
    { key: "active", label: "Active", icon: <Clock size={12} /> },
    { key: "delayed", label: "Delayed", icon: <AlertCircle size={12} />, alert: true },
    { key: "paid", label: "Paid", icon: <CheckCircle size={12} /> },
    { key: "credited", label: "Credits", icon: <BookOpen size={12} />, purple: true },
    { key: "voided", label: "Voided", icon: <Ban size={12} />, red: true },
  ];

  const SORT_OPTIONS = [
    { key: "priority", label: "Priority", icon: <ArrowUpDown size={12} /> },
    { key: "name", label: "Table", icon: <Utensils size={12} /> },
    { key: "waiter", label: "Waiter", icon: <User size={12} /> },
    { key: "time", label: "Time", icon: <Clock size={12} /> },
  ];

  // Determine which content to show
  const showCredits = floorFilter === "credited";
  const showVoided = floorFilter === "voided";
  const showTables = !showCredits && !showVoided;

  return (
    <div className={`min-h-screen p-4 pb-24 font-[Outfit] transition-colors duration-300 ${isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"}`}>
      
      {/* Simple Header */}
      <div className="mb-5 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
            <div className="w-1 h-5 bg-yellow-500 rounded-full" />
            Floor Manager
          </h1>
          <div className="flex gap-2 text-[10px] font-bold text-gray-500 mt-1">
            <span>{today}</span>
            <span>•</span>
            <span>{counts.active} active</span>
            {counts.delayed > 0 && <span className="text-red-500">• {counts.delayed} delayed</span>}
          </div>
        </div>
        <button onClick={handleRefresh} className="p-2 rounded-full bg-white/10 backdrop-blur border border-white/20">
          <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filters (always visible) */}
      <div className="flex overflow-x-auto gap-2 pb-2 mb-4 no-scrollbar">
        {FILTERS.map(({ key, label, icon, alert, red, purple }) => {
          const active = floorFilter === key;
          const count = counts[key];
          let bg = active ? "bg-yellow-500 text-black" : isDark ? "bg-gray-800/50 text-gray-300" : "bg-white text-gray-700";
          if (active && red) bg = "bg-red-500 text-white";
          if (active && purple) bg = "bg-purple-500 text-white";
          return (
            <button
              key={key}
              onClick={() => setFloorFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all ${bg} shadow-sm`}
            >
              {icon}
              <span>{label}</span>
              {count > 0 && <span className="ml-1 text-[9px] bg-white/20 rounded-full px-1.5">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Conditional content */}
      {showCredits && <CreditsPanel credits={creditsLedger} breakdown={creditBreakdown} isDark={isDark} />}
      {showVoided && <VoidedPanel ledger={voidedLedger} groups={tableGroups.filter(t=>t.isAnyVoided)} isDark={isDark} />}
      {showTables && (
        <>
          {/* Search & Sort (only for tables) */}
          <div className="flex flex-col sm:flex-row gap-2 mb-5">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search table or waiter..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 rounded-xl text-[13px] font-medium border outline-none transition-all
                  ${isDark ? "bg-gray-900 border-gray-700 focus:border-yellow-500" : "bg-white border-gray-200 focus:border-yellow-500"}`}
              />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {SORT_OPTIONS.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => {
                    if (sortBy === key) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    else { setSortBy(key); setSortOrder("asc"); }
                  }}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-black uppercase whitespace-nowrap
                    ${sortBy === key ? "bg-yellow-500 text-black" : isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"}`}
                >
                  {icon}
                  {label}
                  {sortBy === key && <span className="text-[8px]">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Table Grid */}
          {filteredTables.length === 0 ? (
            <div className="py-20 text-center border border-dashed rounded-2xl border-gray-300">
              <Utensils size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs font-black uppercase tracking-widest opacity-50">No tables found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTables.map(table => (
                <TableCard key={table.tableName} table={table} isDark={isDark} creditInfo={creditsByTable[table.tableName]} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- Table Card (simplified) ---
function TableCard({ table, isDark, creditInfo }) {
  const { tableName, total, itemCount, status, waiterName, minsElapsed, isDelayed, allPaid, isVoided, isCredited } = table;

  let cardStyle = isDark ? "bg-gray-900/70 border-gray-800" : "bg-white border-gray-200";
  let statusBadge = { text: "", color: "", icon: null };

  if (isVoided) {
    cardStyle += " opacity-60 grayscale";
    statusBadge = { text: "Voided", color: "bg-gray-500 text-white", icon: <Ban size={10} /> };
  } else if (isCredited && creditInfo) {
    const settled = creditInfo.status === "FullySettled" || creditInfo.status === "PartiallySettled";
    if (settled) statusBadge = { text: "Credit Settled", color: "bg-green-500 text-white", icon: <CheckCircle size={10} /> };
    else if (creditInfo.status === "Approved") statusBadge = { text: "Credit Approved", color: "bg-purple-500 text-white", icon: <CheckCircle size={10} /> };
    else statusBadge = { text: "Credit Pending", color: "bg-yellow-500 text-black", icon: <Hourglass size={10} /> };
  } else if (allPaid) {
    statusBadge = { text: "Paid", color: "bg-green-500 text-white", icon: <CheckCircle size={10} /> };
  } else if (status === "Served") {
    statusBadge = { text: "Served", color: "bg-blue-500 text-white", icon: <Eye size={10} /> };
  } else if (status === "Ready") {
    statusBadge = { text: "Ready!", color: "bg-emerald-500 text-black", icon: <ChefHat size={10} /> };
  } else if (isDelayed) {
    statusBadge = { text: `${minsElapsed}m Delayed`, color: "bg-red-500 text-white", icon: <AlertCircle size={10} /> };
  } else {
    statusBadge = { text: status || "Active", color: "bg-yellow-500 text-black", icon: <Clock size={10} /> };
  }

  return (
    <div className={`rounded-xl border p-4 shadow-sm transition-all hover:shadow-md ${cardStyle}`}>
      <div className="flex justify-between items-start gap-2 mb-2">
        <h3 className={`font-black text-md uppercase truncate ${isCredited ? "text-purple-400" : isVoided ? "text-gray-500" : "text-yellow-500"}`}>
          {tableName}
        </h3>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${statusBadge.color}`}>
          {statusBadge.icon}
          <span>{statusBadge.text}</span>
        </div>
      </div>
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className="text-gray-500">Waiter</span>
          <span className="font-medium">{waiterName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Items</span>
          <span>{itemCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Total</span>
          <span className={`font-bold ${isCredited ? "text-purple-400" : allPaid ? "text-green-400" : "text-yellow-500"}`}>
            UGX {total.toLocaleString()}
          </span>
        </div>
        {isCredited && creditInfo && creditInfo.client_name && (
          <div className="flex justify-between text-[9px] mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
            <span className="text-gray-500">Client</span>
            <span className="truncate max-w-[120px]">{creditInfo.client_name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- CREDITS PANEL (original style) ----------
function CreditsPanel({ credits, breakdown, isDark }) {
  const [activeTab, setActiveTab] = useState("pendingCashier");
  const tabs = [
    { key: "pendingCashier", label: "Wait for Cashier", icon: <Hourglass size={12} />, count: breakdown.pendingCashier.length, total: breakdown.totalPendingCashier, color: "yellow" },
    { key: "pendingManager", label: "Wait for Manager", icon: <Clock size={12} />, count: breakdown.pendingManager.length, total: breakdown.totalPendingManager, color: "orange" },
    { key: "approved", label: "Approved", icon: <CheckCircle size={12} />, count: breakdown.approved.length, total: breakdown.totalApproved, color: "purple" },
    { key: "settled", label: "Settled", icon: <CheckCircle size={12} />, count: breakdown.settled.length, total: breakdown.totalSettled, color: "green" },
    { key: "rejected", label: "Rejected", icon: <XCircle size={12} />, count: breakdown.rejected.length, total: breakdown.totalRejected, color: "red" },
  ];
  const currentList = {
    pendingCashier: breakdown.pendingCashier,
    pendingManager: breakdown.pendingManager,
    approved: breakdown.approved,
    settled: breakdown.settled,
    rejected: breakdown.rejected,
  }[activeTab];
  const currentTotal = tabs.find(t => t.key === activeTab)?.total || 0;

  if (credits.length === 0) {
    return (
      <div className={`py-20 text-center border-2 border-dashed rounded-2xl ${isDark ? "border-gray-800" : "border-gray-200"}`}>
        <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-[10px] font-black uppercase">No credits this month</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {tabs.map(tab => (
          <div key={tab.key} className={`p-3 rounded-xl border ${isDark ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"} text-center`}>
            <p className="text-[8px] font-black uppercase text-gray-500">{tab.label.split(' ')[0]}</p>
            <p className={`text-sm font-black ${tab.color === "yellow" ? "text-yellow-500" : tab.color === "orange" ? "text-orange-500" : tab.color === "purple" ? "text-purple-500" : tab.color === "green" ? "text-green-500" : "text-red-500"}`}>
              UGX {tab.total.toLocaleString()}
            </p>
            <p className="text-[9px] text-gray-400">{tab.count} records</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase transition-all
              ${activeTab === tab.key 
                ? `bg-${tab.color === "yellow" ? "yellow" : tab.color === "orange" ? "orange" : tab.color === "purple" ? "purple" : tab.color === "green" ? "green" : "red"}-500 text-white` 
                : isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"}`}
          >
            {tab.icon}
            {tab.label}
            <span className="ml-1 text-[8px] bg-white/20 rounded-full px-1.5">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {currentList.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-xs">No items</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {currentList.map((credit, idx) => (
            <div key={idx} className={`p-4 rounded-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
              <div className="flex justify-between items-start">
                <span className="font-black text-sm uppercase">{credit.table_name || "Table"}</span>
                <span className="text-[10px] text-gray-500">{credit.created_at ? new Date(credit.created_at).toLocaleDateString() : ""}</span>
              </div>
              {credit.client_name && <p className="text-[9px] mt-1 flex items-center gap-1"><User size={9} />{credit.client_name}</p>}
              {credit.client_phone && <p className="text-[8px] text-gray-400">{credit.client_phone}</p>}
              <p className="text-base font-black mt-2">UGX {Number(credit.amount).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- VOIDED PANEL (original style) ----------
function VoidedPanel({ ledger, groups, isDark }) {
  const liveTableNames = new Set(groups.map(g => g.tableName));
  const archivedVoids = ledger.filter(r => !liveTableNames.has((r.table_name || "").trim().toUpperCase()));

  if (groups.length === 0 && archivedVoids.length === 0) {
    return (
      <div className="py-20 text-center border-2 border-dashed rounded-2xl">
        <Ban size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-[10px] font-black uppercase">No voided items today</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active tables with voided items */}
      {groups.length > 0 && (
        <div>
          <h2 className="text-sm font-black uppercase mb-3 flex items-center gap-2">
            <div className="w-1 h-5 bg-red-500 rounded-full" />
            Active tables with voids ({groups.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {groups.map(table => <TableCard key={table.tableName} table={table} isDark={isDark} creditInfo={null} />)}
          </div>
        </div>
      )}
      {/* Archived voids from ledger */}
      {archivedVoids.length > 0 && (
        <div>
          <h2 className="text-sm font-black uppercase mb-3">Archived voids ({archivedVoids.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {archivedVoids.map((v, i) => (
              <div key={i} className={`p-4 rounded-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                <p className="font-black text-sm">{v.table_name || "Table"}</p>
                <p className="text-red-500 line-through text-xs mt-1">{v.item_name}</p>
                {v.reason && <p className="text-[9px] text-gray-500 mt-1">Reason: {v.reason}</p>}
                <p className="text-[8px] text-gray-400 mt-2">{new Date(v.created_at).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}