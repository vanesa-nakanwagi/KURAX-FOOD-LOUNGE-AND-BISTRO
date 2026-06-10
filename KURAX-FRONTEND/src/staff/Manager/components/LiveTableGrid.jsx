import React, { useState, useMemo, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import {
  Search, LayoutDashboard, AlertCircle, Clock, CheckCircle,
  Banknote, RefreshCw, Eye, XCircle, Ban, BookOpen, User,
  ChefHat, Utensils, ArrowUpDown, Hourglass, CreditCard,
  Smartphone, Wallet, Coffee, Pizza, Beef, Soup, Crown
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

// Determine if a table should be listed under "Credits" tab (any pending/approved/partial credit)
function isTableGroupCredited(group, creditsByTable) {
  if (isTableGroupVoided(group)) return false;
  const tableKey = group.tableName;
  const creditEntry = creditsByTable[tableKey];
  if (!creditEntry) return false;
  // Show under Credits tab if the credit is not fully settled
  return creditEntry.status !== "FullySettled";
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

  // ─── Calculate table groups with correct payment status ───────────
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

      let items = order.items || [];
      if (typeof items === "string") {
        try { items = JSON.parse(items); } catch { items = []; }
      }

      let confirmedTotal = 0;
      let hasUnpaidItems = false;
      let hasPendingCredit = false;      // credit item not yet fully settled
      let hasPaidNonCreditItems = false;
      let allItemsPaid = true;
      let cashTotal = 0;
      let mtnTotal = 0;
      let airtelTotal = 0;
      let cardTotal = 0;
      let creditTotal = 0;
      let paidItems = [];
      let unpaidItems = [];

      // Get credit entry for this table if it exists
      const creditEntry = creditsByTable[key];

      items.forEach(item => {
        const isCreditItem =
          item.creditRequested === true ||
          (item.payment_method || "").toUpperCase().includes("CREDIT");
        
        // A credit item is considered "paid" only if the credit is fully settled
        const isCreditFullySettled = isCreditItem && creditEntry?.status === "FullySettled";
        const isCreditPartiallySettled = isCreditItem && creditEntry?.status === "PartiallySettled";
        
        const isItemPaid = (!isCreditItem || isCreditFullySettled) && (
          item._rowPaid === true ||
          item.payment_confirmed === true ||
          item.status === "Paid"
        );

        const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);

        if (isItemPaid) {
          confirmedTotal += itemTotal;
          const orderLevelMethod = (order.payment_method || "").toUpperCase();
          const fallbackMethod = orderLevelMethod === "CREDIT" ? "CASH" : (orderLevelMethod || "CASH");
          const itemPaymentMethod = (item.payment_method || fallbackMethod).toUpperCase();

          paidItems.push({ ...item, total: itemTotal, paymentMethod: itemPaymentMethod });
          hasPaidNonCreditItems = true;

          if (itemPaymentMethod.includes("CASH")) cashTotal += itemTotal;
          else if (itemPaymentMethod.includes("MTN")) mtnTotal += itemTotal;
          else if (itemPaymentMethod.includes("AIRTEL")) airtelTotal += itemTotal;
          else if (itemPaymentMethod.includes("CARD")) cardTotal += itemTotal;

        } else if (isCreditItem && !isCreditFullySettled) {
          allItemsPaid = false;
          hasUnpaidItems = true;
          
          // Calculate remaining balance if partially settled
          let remainingAmount = itemTotal;
          if (isCreditPartiallySettled) {
            remainingAmount = Number(creditEntry.balance || itemTotal);
          }
          
          creditTotal += remainingAmount;
          unpaidItems.push({ 
            ...item, 
            total: remainingAmount, 
            originalTotal: itemTotal,
            paymentMethod: "CREDIT",
            isPartiallySettled: isCreditPartiallySettled,
            amountPaid: creditEntry?.amount_paid || 0
          });

          // If credit is not fully settled and not partially settled, it's pending
          if (!isCreditPartiallySettled && creditEntry?.status !== "FullySettled") {
            hasPendingCredit = true;
          }
        } else {
          // Regular unpaid item (not credit, not yet confirmed)
          hasUnpaidItems = true;
          allItemsPaid = false;
          const itemPaymentMethod = (item.payment_method || "CASH").toUpperCase();
          unpaidItems.push({ ...item, total: itemTotal, paymentMethod: itemPaymentMethod });
        }
      });

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
          hasUnpaidItems: false,
          hasPendingCredit: false,
          hasPaidNonCreditItems: false,
          cashTotal: 0,
          mtnTotal: 0,
          airtelTotal: 0,
          cardTotal: 0,
          creditTotal: 0,
          paidItems: [],
          unpaidItems: [],
        };
      }

      const g = groups[key];
      g.total += confirmedTotal;
      g.itemCount += items.length;
      g.orderIds.push(order.id);

      g._rows.push({
        paid: allItemsPaid,
        hasPendingCredit: hasPendingCredit,
        hasPaidNonCreditItems: hasPaidNonCreditItems
      });

      g._rawOrders.push(order);
      g.hasUnpaidItems = g.hasUnpaidItems || hasUnpaidItems;
      g.hasPendingCredit = g.hasPendingCredit || hasPendingCredit;
      g.hasPaidNonCreditItems = g.hasPaidNonCreditItems || hasPaidNonCreditItems;
      g.cashTotal += cashTotal;
      g.mtnTotal += mtnTotal;
      g.airtelTotal += airtelTotal;
      g.cardTotal += cardTotal;
      g.creditTotal += creditTotal;
      g.paidItems = [...g.paidItems, ...paidItems];
      g.unpaidItems = [...g.unpaidItems, ...unpaidItems];

      if (order.staff_name || order.waiterName) g.waiterName = order.staff_name || order.waiterName;

      // Status determination – use credit entry for more accurate badge
      const tableCreditEntry = creditsByTable[key];
      let orderStatus = order.status;

      if (tableCreditEntry) {
        const creditStatus = tableCreditEntry.status;
        if (creditStatus === "FullySettled") {
          orderStatus = "Fully Paid";
        } else if (creditStatus === "PartiallySettled") {
          orderStatus = "Partially Settled";
        } else if (creditStatus === "Approved") {
          orderStatus = "Approved";
        } else if (creditStatus === "PendingCashier" || creditStatus === "PendingManagerApproval") {
          orderStatus = "Awaiting Approval";
        }
      } else {
        if (hasPendingCredit && hasPaidNonCreditItems) {
          orderStatus = "Partially Paid";
        } else if (hasPendingCredit && !hasPaidNonCreditItems) {
          orderStatus = "Awaiting Approval";
        } else if (hasUnpaidItems && !allItemsPaid && !hasPendingCredit) {
          orderStatus = "Partially Paid";
        } else if (allItemsPaid && confirmedTotal > 0) {
          orderStatus = "Fully Paid";
        }
      }

      const rank = {
        "Awaiting Approval": 1,
        "Partially Paid": 2,
        "Approved": 3,
        "Partially Settled": 4,
        "Pending": 5,
        "Preparing": 6,
        "Delayed": 7,
        "Ready": 8,
        "Served": 9,
        "Fully Paid": 10
      };

      if ((rank[orderStatus] || 0) > (rank[g.status] || 0)) g.status = orderStatus;
    });

    return Object.values(groups).map(g => {
      const creditEntry = creditsByTable[g.tableName];
      const hasFullySettledCredit = creditEntry?.status === "FullySettled";
      
      const allPaid = g._rows.length > 0 &&
        g._rows.every(r => r.paid === true) &&
        !g.hasPendingCredit &&
        (!hasFullySettledCredit || g._rows.every(r => r.paid === true));

      const minsElapsed = Math.floor((Date.now() - new Date(g.timestamp)) / 60000);
      const isVoided = isTableGroupVoided(g);
      const isAnyVoided = isTableGroupAnyVoided(g);

      const isCredited = !isTableGroupVoided(g) &&
        g._rawOrders.some(o => o.status === "Credit" || o.payment_method === "Credit") &&
        !!creditEntry &&
        creditEntry.status !== "FullySettled";
      
      const isDelayed = !isAnyVoided && !isCredited && !allPaid && minsElapsed >= 30 &&
                       ["Pending","Preparing","Ready","Delayed","Partially Paid","Awaiting Approval","Approved","Partially Settled"].includes(g.status);

      return { ...g, allPaid, minsElapsed, isDelayed, isVoided, isAnyVoided, isCredited };
    });
  }, [orders, today, creditsByTable]);

  // Credit breakdown with partial payments
  const creditBreakdown = useMemo(() => {
    const pendingCashier = creditsLedger.filter(c => c.status === "PendingCashier");
    const pendingManager = creditsLedger.filter(c => c.status === "PendingManagerApproval");
    const approved = creditsLedger.filter(c => c.status === "Approved");
    const settled = creditsLedger.filter(c => c.status === "FullySettled");
    const partiallySettled = creditsLedger.filter(c => c.status === "PartiallySettled");
    const rejected = creditsLedger.filter(c => c.status === "Rejected");
    
    return {
      pendingCashier, pendingManager, approved, settled, partiallySettled, rejected,
      totalPendingCashier: pendingCashier.reduce((s,c)=>s+Number(c.amount||0),0),
      totalPendingManager: pendingManager.reduce((s,c)=>s+Number(c.amount||0),0),
      totalApproved: approved.reduce((s,c)=>s+Number(c.amount||0),0),
      totalSettled: settled.reduce((s,c)=>s+Number(c.amount_paid||c.amount||0),0),
      totalPartiallySettled: partiallySettled.reduce((s,c)=>s+Number(c.amount_paid||0),0),
      totalRemainingPartiallySettled: partiallySettled.reduce((s,c)=>s+Number(c.balance||0),0),
      totalRejected: rejected.reduce((s,c)=>s+Number(c.amount||0),0),
    };
  }, [creditsLedger]);

  const counts = useMemo(() => ({
    all: tableGroups.length,
    active: tableGroups.filter(t =>
      !t.isVoided &&
      !t.isCredited &&
      !t.allPaid &&
      !t.hasPendingCredit &&
      ["Pending","Preparing","Ready","Delayed","Partially Paid"].includes(t.status)
    ).length,
    delayed: tableGroups.filter(t => t.isDelayed).length,
    paid: tableGroups.filter(t =>
      !t.isVoided &&
      !t.isCredited &&
      t.allPaid &&
      !t.hasPendingCredit
    ).length,
    credited: creditsLedger.filter(c => c.status !== "FullySettled").length,
    voided: Math.max(voidedLedger.length, tableGroups.filter(t => t.isAnyVoided).length),
  }), [tableGroups, creditsLedger, voidedLedger]);

  const filteredTables = useMemo(() => {
    let filtered = tableGroups.filter(t => {
      const matchSearch = t.tableName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.waiterName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFilter =
        floorFilter === "all" ? true :
        floorFilter === "active" ? !t.isVoided && !t.isCredited && !t.allPaid && !t.hasPendingCredit && ["Pending","Preparing","Ready","Delayed","Partially Paid"].includes(t.status) :
        floorFilter === "delayed" ? t.isDelayed :
        floorFilter === "paid" ? !t.isVoided && !t.isCredited && t.allPaid && !t.hasPendingCredit :
        false;
      return matchSearch && matchFilter;
    });
    filtered.sort((a,b) => {
      let cmp = 0;
      switch (sortBy) {
        case "priority":
          if (a.isVoided !== b.isVoided) cmp = a.isVoided ? 1 : -1;
          else if (a.isCredited !== b.isCredited) cmp = a.isCredited ? 1 : -1;
          else if (a.hasPendingCredit !== b.hasPendingCredit) cmp = a.hasPendingCredit ? 1 : -1;
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
              {/* Sort row */}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

// --- Enhanced Table Card with proper credit status handling ---
function TableCard({ table, isDark, creditInfo }) {
  const {
    tableName, total, itemCount, status, waiterName, minsElapsed,
    isDelayed, allPaid, isVoided, isCredited,
    cashTotal, mtnTotal, airtelTotal, cardTotal, creditTotal,
    paidItems, unpaidItems, hasUnpaidItems, hasPendingCredit, hasPaidNonCreditItems
  } = table;

  let cardStyle = isDark ? "bg-gray-900/70 border-gray-800" : "bg-white border-gray-200";
  let statusBadge = { text: "", color: "", icon: null };

  // Use creditInfo if present (most accurate)
  if (creditInfo) {
    const creditStatus = creditInfo.status;
    if (creditStatus === "FullySettled") {
      statusBadge = { text: "Fully Paid", color: "bg-green-500 text-white", icon: <CheckCircle size={9} /> };
    } else if (creditStatus === "PartiallySettled") {
      statusBadge = { text: "Partially Settled", color: "bg-orange-500 text-white", icon: <Clock size={9} /> };
    } else if (creditStatus === "Approved") {
      statusBadge = { text: "Approved", color: "bg-purple-500 text-white", icon: <CheckCircle size={9} /> };
    } else if (creditStatus === "PendingCashier" || creditStatus === "PendingManagerApproval") {
      statusBadge = { text: "Awaiting Approval", color: "bg-yellow-500 text-black", icon: <Hourglass size={9} /> };
    } else if (creditStatus === "Rejected") {
      statusBadge = { text: "Rejected", color: "bg-red-500 text-white", icon: <XCircle size={9} /> };
    }
  } else if (isVoided) {
    cardStyle += " opacity-60 grayscale";
    statusBadge = { text: "Voided", color: "bg-gray-500 text-white", icon: <Ban size={9} /> };
  } else if (allPaid) {
    statusBadge = { text: "Fully Paid", color: "bg-green-500 text-white", icon: <CheckCircle size={9} /> };
  } else if (hasUnpaidItems && total > 0 && !hasPendingCredit) {
    statusBadge = { text: "Partially Paid", color: "bg-orange-500 text-white", icon: <Clock size={9} /> };
  } else if (status === "Served") {
    statusBadge = { text: "Served", color: "bg-blue-500 text-white", icon: <Eye size={9} /> };
  } else if (status === "Ready") {
    statusBadge = { text: "Ready!", color: "bg-emerald-500 text-black", icon: <ChefHat size={9} /> };
  } else if (isDelayed) {
    statusBadge = { text: `${minsElapsed}m`, color: "bg-red-500 text-white", icon: <AlertCircle size={9} /> };
  } else {
    statusBadge = { text: status || "Active", color: "bg-yellow-500 text-black", icon: <Clock size={9} /> };
  }

  const getPaymentIcon = (method) => {
    if (method.includes('CASH')) return <Banknote size={12} />;
    if (method.includes('MTN')) return <Smartphone size={12} />;
    if (method.includes('AIRTEL')) return <Smartphone size={12} />;
    if (method.includes('CARD')) return <CreditCard size={12} />;
    if (method.includes('CREDIT')) return <Wallet size={12} />;
    return <Banknote size={12} />;
  };

  const getCategoryIcon = (category) => {
    const cat = (category || "").toLowerCase();
    if (cat.includes('pizza')) return <Pizza size={12} />;
    if (cat.includes('beef') || cat.includes('meat')) return <Beef size={12} />;
    if (cat.includes('soup')) return <Soup size={12} />;
    if (cat.includes('coffee') || cat.includes('tea')) return <Coffee size={12} />;
    return <Utensils size={12} />;
  };

  return (
    <div className={`rounded-xl border p-4 shadow-sm transition-all hover:shadow-md ${cardStyle}`}>
      {/* Header */}
      <div className="flex justify-between items-start gap-2 mb-3 pb-2 border-b border-gray-200/20">
        <div className="flex items-center gap-2">
          <Crown size={16} className="text-yellow-500" />
          <h3 className={`font-black text-base uppercase truncate ${isCredited ? "text-purple-400" : isVoided ? "text-gray-500" : "text-yellow-500"}`}>
            {tableName}
          </h3>
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase shrink-0 ${statusBadge.color}`}>
          {statusBadge.icon}
          <span className="ml-0.5">{statusBadge.text}</span>
        </div>
      </div>

      {/* Waiter info */}
      <div className="flex items-center justify-between mb-3 text-[11px]">
        <div className="flex items-center gap-1 text-gray-500">
          <User size={12} />
          <span>Waiter:</span>
        </div>
        <span className="font-medium truncate max-w-[150px] text-right">{waiterName}</span>
      </div>

      {/* Payment Summary */}
      <div className="mb-3 p-2 rounded-lg bg-gray-100/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase text-gray-500">Payment Summary</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">Items: {itemCount}</span>
            <span className="text-[10px] text-gray-500">|</span>
            <span className="text-[10px] text-gray-500">Paid: <span className="font-bold text-yellow-500">UGX {total.toLocaleString()}</span></span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 text-[9px]">
          {cashTotal > 0 && (
            <div className="flex items-center gap-1 text-green-600">
              <Banknote size={10} /> Cash: UGX {cashTotal.toLocaleString()}
            </div>
          )}
          {mtnTotal > 0 && (
            <div className="flex items-center gap-1 text-blue-600">
              <Smartphone size={10} /> MTN: UGX {mtnTotal.toLocaleString()}
            </div>
          )}
          {airtelTotal > 0 && (
            <div className="flex items-center gap-1 text-red-600">
              <Smartphone size={10} /> Airtel: UGX {airtelTotal.toLocaleString()}
            </div>
          )}
          {cardTotal > 0 && (
            <div className="flex items-center gap-1 text-purple-600">
              <CreditCard size={10} /> Card: UGX {cardTotal.toLocaleString()}
            </div>
          )}
          {creditTotal > 0 && (
            <div className="flex items-center gap-1 text-orange-600">
              <Wallet size={10} /> Credit: UGX {creditTotal.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Paid Items */}
      {paidItems.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-1.5">
            <CheckCircle size={10} className="text-green-500" />
            <span className="text-[9px] font-bold uppercase text-green-500">Paid Items ({paidItems.length})</span>
          </div>
          <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
            {paidItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-[10px] p-1.5 rounded bg-green-500/5">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {getCategoryIcon(item.category)}
                  <span className="truncate font-medium">{item.name}</span>
                  {item.quantity > 1 && <span className="text-gray-500">×{item.quantity}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {getPaymentIcon(item.paymentMethod || 'CASH')}
                  <span className="font-bold text-green-600">UGX {item.total.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unpaid / Pending Items */}
      {unpaidItems.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-1.5">
            <Clock size={10} className="text-orange-500" />
            <span className="text-[9px] font-bold uppercase text-orange-500">Pending ({unpaidItems.length})</span>
          </div>
          <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
            {unpaidItems.map((item, idx) => {
              const isCreditItem = (item.paymentMethod || '').includes('CREDIT');
              const isPartiallySettled = item.isPartiallySettled;
              
              return (
                <div key={idx} className={`flex flex-col p-1.5 rounded ${isCreditItem ? 'bg-purple-500/5' : 'bg-orange-500/5'}`}>
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {getCategoryIcon(item.category)}
                      <span className="truncate font-medium">{item.name}</span>
                      {item.quantity > 1 && <span className="text-gray-500">×{item.quantity}</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {getPaymentIcon(item.paymentMethod || 'CASH')}
                      <span className={`font-bold ${isCreditItem ? 'text-purple-600' : 'text-orange-600'}`}>
                        UGX {item.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Show partial payment info for credit items */}
                  {isCreditItem && isPartiallySettled && (
                    <div className="mt-1 pl-4">
                      <div className="flex justify-between text-[8px] text-gray-500">
                        <span>Paid: UGX {item.amountPaid?.toLocaleString()}</span>
                        <span>Remaining: UGX {item.total.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                        <div 
                          className="bg-green-500 h-1 rounded-full" 
                          style={{ width: `${(item.amountPaid / (item.amountPaid + item.total)) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {isCreditItem && !isPartiallySettled && creditInfo?.status === "Approved" && (
                    <span className="text-[8px] text-purple-500 ml-4 mt-0.5">(Approved – awaiting settlement)</span>
                  )}
                  {isCreditItem && !isPartiallySettled && creditInfo?.status === "PendingCashier" && (
                    <span className="text-[8px] text-yellow-500 ml-4 mt-0.5">(Awaiting cashier → manager approval)</span>
                  )}
                  {isCreditItem && !isPartiallySettled && creditInfo?.status === "PendingManagerApproval" && (
                    <span className="text-[8px] text-orange-500 ml-4 mt-0.5">(Awaiting manager approval)</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Credit client info with partial payment details */}
      {creditInfo && creditInfo.status !== "FullySettled" && (
        <div className="mt-3 pt-2 border-t border-gray-200/30">
          <div className="flex justify-between text-[9px]">
            <span className="text-gray-500 flex items-center gap-1">
              <User size={8} /> Client:
            </span>
            <span className="truncate max-w-[120px] text-right">{creditInfo.client_name}</span>
          </div>
          
          {/* Credit payment breakdown */}
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[9px]">
              <span className="text-gray-500">Total Credit:</span>
              <span className="font-bold">UGX {Number(creditInfo.amount).toLocaleString()}</span>
            </div>
            
            {Number(creditInfo.amount_paid) > 0 && (
              <>
                <div className="flex justify-between text-[9px]">
                  <span className="text-gray-500">Amount Paid:</span>
                  <span className="text-green-500 font-bold">UGX {Number(creditInfo.amount_paid).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span className="text-gray-500">Remaining Balance:</span>
                  <span className="text-orange-500 font-bold">UGX {Number(creditInfo.balance).toLocaleString()}</span>
                </div>
                
                {/* Progress bar for partial payments */}
                {creditInfo.status === "PartiallySettled" && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[8px] mb-1">
                      <span className="text-gray-500">Settlement Progress</span>
                      <span className="text-gray-500">{Math.round((Number(creditInfo.amount_paid) / Number(creditInfo.amount)) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-green-500 h-1.5 rounded-full transition-all" 
                        style={{ width: `${(Number(creditInfo.amount_paid) / Number(creditInfo.amount)) * 100}%` }}
                      />
                    </div>
                    <p className="text-[8px] text-center mt-1 text-gray-500">
                      UGX {Number(creditInfo.balance).toLocaleString()} remaining to be paid
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          
          {creditInfo.pay_by && (
            <div className="flex justify-between text-[8px] mt-2">
              <span className="text-gray-500">Pay by:</span>
              <span className="text-amber-600 font-bold">{creditInfo.pay_by}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Credits Panel with Partial Payment Support ---
function CreditsPanel({ credits, breakdown, isDark }) {
  const [activeTab, setActiveTab] = useState("pendingCashier");
  const tabs = [
    { key: "pendingCashier", label: "Cashier", fullLabel: "Wait for Cashier", icon: <Hourglass size={11} />, count: breakdown.pendingCashier.length, total: breakdown.totalPendingCashier, color: "yellow" },
    { key: "pendingManager", label: "Manager", fullLabel: "Wait for Manager", icon: <Clock size={11} />, count: breakdown.pendingManager.length, total: breakdown.totalPendingManager, color: "orange" },
    { key: "approved", label: "Approved", fullLabel: "Approved", icon: <CheckCircle size={11} />, count: breakdown.approved.length, total: breakdown.totalApproved, color: "purple" },
    { key: "partiallySettled", label: "Partial", fullLabel: "Partially Settled", icon: <Clock size={11} />, count: breakdown.partiallySettled.length, total: breakdown.totalRemainingPartiallySettled, color: "orange" },
    { key: "settled", label: "Settled", fullLabel: "Fully Settled", icon: <CheckCircle size={11} />, count: breakdown.settled.length, total: breakdown.totalSettled, color: "green" },
    { key: "rejected", label: "Rejected", fullLabel: "Rejected", icon: <XCircle size={11} />, count: breakdown.rejected.length, total: breakdown.totalRejected, color: "red" },
  ];

  const colorMap = { yellow: "text-yellow-500", orange: "text-orange-500", purple: "text-purple-500", green: "text-green-500", red: "text-red-500" };
  const activeBgMap = { yellow: "bg-yellow-500 text-black", orange: "bg-orange-500 text-white", purple: "bg-purple-500 text-white", green: "bg-green-500 text-white", red: "bg-red-500 text-white" };

  const currentList = {
    pendingCashier: breakdown.pendingCashier,
    pendingManager: breakdown.pendingManager,
    approved: breakdown.approved,
    partiallySettled: breakdown.partiallySettled,
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
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

      {currentList.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-xs">No items</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {currentList.map((credit, idx) => {
            const isPartial = credit.status === "PartiallySettled";
            const remainingBalance = Number(credit.balance || 0);
            const amountPaid = Number(credit.amount_paid || 0);
            const totalAmount = Number(credit.amount || 0);
            const percentPaid = totalAmount > 0 ? (amountPaid / totalAmount) * 100 : 0;
            
            return (
              <div key={idx} className={`p-3 rounded-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                <div className="flex justify-between items-start gap-1">
                  <span className="font-black text-sm uppercase truncate">{credit.table_name || "Table"}</span>
                  <span className="text-[9px] text-gray-500 shrink-0">
                    {credit.created_at ? new Date(credit.created_at).toLocaleDateString() : ""}
                  </span>
                </div>
                
                {credit.client_name && (
                  <p className="text-[9px] mt-1 flex items-center gap-1 text-gray-400 truncate">
                    <User size={9} className="shrink-0" />{credit.client_name}
                  </p>
                )}
                
                {credit.client_phone && (
                  <p className="text-[8px] text-gray-500">{credit.client_phone}</p>
                )}
                
                {/* Show detailed payment info for partially settled credits */}
                {isPartial && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[8px] mb-1">
                      <span className="text-gray-500">Paid:</span>
                      <span className="text-green-500 font-bold">UGX {amountPaid.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[8px] mb-1">
                      <span className="text-gray-500">Remaining:</span>
                      <span className="text-orange-500 font-bold">UGX {remainingBalance.toLocaleString()}</span>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div 
                        className="bg-green-500 h-1.5 rounded-full transition-all" 
                        style={{ width: `${percentPaid}%` }}
                      />
                    </div>
                    <p className="text-[8px] text-gray-500 mt-1 text-center">
                      {Math.round(percentPaid)}% settled
                    </p>
                    
                    {/* Show original total if partial */}
                    <p className="text-[8px] text-gray-400 mt-1 text-center">
                      Original: UGX {totalAmount.toLocaleString()}
                    </p>
                  </div>
                )}
                
                {!isPartial && (
                  <p className="text-sm font-black mt-2">UGX {totalAmount.toLocaleString()}</p>
                )}
                
                {credit.pay_by && (
                  <p className="text-[8px] text-amber-600 font-bold mt-1">Pay by: {credit.pay_by}</p>
                )}
              </div>
            );
          })}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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