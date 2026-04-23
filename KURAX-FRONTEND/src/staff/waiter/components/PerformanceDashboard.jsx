import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";
import {
  Activity, Target, ClipboardList, TrendingUp, Award, Calendar,
  Clock, CheckCircle2, Loader2, RefreshCw, AlertCircle, BookOpen,
  CheckCircle, XCircle, Clock as ClockIcon
} from "lucide-react";
import API_URL from "../../../config/api";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getTodayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatOrderDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtUGX(n) {
  return `UGX ${Number(n || 0).toLocaleString()}`;
}

function fmtLargeNumber(n) {
  const num = Number(n || 0);
  if (num >= 1_000_000) {
    return `UGX ${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `UGX ${(num / 1_000).toFixed(0)}K`;
  }
  return `UGX ${num.toLocaleString()}`;
}

function getItemCount(items) {
  if (!items) return 0;
  if (Array.isArray(items)) return items.length;
  if (typeof items === "string") {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed.length : 1;
    } catch { return 1; }
  }
  return 1;
}

function getIndividualItems(order, creditsData) {
  let items = order.items || [];
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  if (!Array.isArray(items)) return [];

  let hasCreditSettlement = false;
  if (creditsData) {
    const orderCredits = creditsData.filter(c => c.order_ids && c.order_ids.includes(order.id));
    hasCreditSettlement = orderCredits.some(c => c.status === "FullySettled" || c.paid === true);
  }

  return items.map(item => {
    const isItemPaidByFlag = item._rowPaid === true;
    const isItemCreditRequested = item.creditRequested === true;
    const isItemPaymentRequested = item.paymentRequested === true;
    const itemPaymentMethod = item.payment_method;

    let isPaid = isItemPaidByFlag;
    let isCredit = isItemCreditRequested;
    let isPaymentRequested = isItemPaymentRequested;
    let finalPaymentMethod = itemPaymentMethod;

    if (!isPaid && !isCredit && !isPaymentRequested && hasCreditSettlement) {
      isCredit = true;
      finalPaymentMethod = "Credit";
    }

    return {
      id: `${order.id}_${item.name}`,
      order_id: order.id,
      name: item.name,
      quantity: item.quantity || 1,
      price: item.price || 0,
      total: (item.price || 0) * (item.quantity || 1),
      is_paid: isPaid,
      is_credit: isCredit,
      is_payment_requested: isPaymentRequested,
      payment_method: finalPaymentMethod,
      table_name: order.table_name,
      timestamp: order.timestamp || order.created_at,
      staff_name: order.staff_name,
      order_status: order.status,
      _raw_item: item,
    };
  });
}

function getCreditStatusDisplay(credit) {
  const status = credit.status;
  if (status === "FullySettled" || credit.paid === true)
    return { label: "Settled ✓", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: <CheckCircle2 size={10} /> };
  if (status === "PartiallySettled")
    return { label: "Partially Settled", color: "text-yellow-500", bg: "bg-yellow-500/10", icon: <ClockIcon size={10} /> };
  if (status === "Rejected")
    return { label: "Rejected ✗", color: "text-red-500", bg: "bg-red-500/10", icon: <XCircle size={10} /> };
  if (status === "PendingManagerApproval" || status === "PendingCashier")
    return { label: "Pending Approval", color: "text-orange-500", bg: "bg-orange-500/10", icon: <Clock size={10} className="animate-pulse" /> };
  if (status === "Approved")
    return { label: "Approved", color: "text-blue-500", bg: "bg-blue-500/10", icon: <CheckCircle size={10} /> };
  return { label: "Outstanding", color: "text-purple-400", bg: "bg-purple-500/10", icon: <BookOpen size={10} /> };
}

function getItemPaymentStatus(item) {
  if (item.is_paid === true)
    return { label: "Paid", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: <CheckCircle2 size={10} /> };
  if (item.is_credit === true)
    return { label: "Credit", color: "text-purple-500", bg: "bg-purple-500/10", icon: <BookOpen size={10} /> };
  if (item.is_payment_requested === true)
    return { label: "Awaiting Cashier", color: "text-yellow-500", bg: "bg-yellow-500/10", icon: <Clock size={10} className="animate-pulse" /> };
  return { label: "Pending", color: "text-zinc-500", bg: "bg-zinc-500/10", icon: <Clock size={10} /> };
}

// ─── CHART TOOLTIP ────────────────────────────────────────────────────────────
const CreditChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white border border-zinc-200 p-3 shadow-md text-[10px] font-black uppercase tracking-wider">
      <p className="text-zinc-500 mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-zinc-700">{entry.name}: {fmtUGX(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PerformanceDashboard({ theme = "light" }) {
  const [staffTargets, setStaffTargets] = useState({ daily_order_target: null, monthly_income_target: null });
  const [confirmedQueue, setConfirmedQueue] = useState([]);
  const [orders, setOrders] = useState([]);
  const [credits, setCredits] = useState([]);
  const [monthlyIncomeData, setMonthlyIncomeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [dayClosed, setDayClosed] = useState(false);

  const savedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}"); }
    catch { return {}; }
  }, []);

  const currentStaffId = savedUser?.id;
  const currentStaffName = savedUser?.name || "Staff Member";
  const staffRole = savedUser?.role || "STAFF";
  const staffInitial = (currentStaffName?.split(" ")[0] || "Staff").toUpperCase();

  const loadTargets = useCallback(async () => {
    if (!currentStaffId) return;
    try {
      const res = await fetch(`${API_URL}/api/staff/performance-list`);
      if (res.ok) {
        const list = await res.json();
        const me = list.find(s => String(s.id) === String(currentStaffId));
        if (me) {
          setStaffTargets({
            daily_order_target: Number(me.daily_order_target) || 0,
            monthly_income_target: Number(me.monthly_income_target) || 0,
          });
        }
      }
    } catch (err) { setFetchError("Failed to load targets"); }
  }, [currentStaffId]);

  const fetchMonthlyIncome = useCallback(async () => {
    if (!currentStaffId && !currentStaffName) return;
    try {
      let url = `${API_URL}/api/summaries/staff-monthly-income?`;
      if (currentStaffId) {
        url += `staffId=${currentStaffId}`;
      } else {
        url += `staffName=${encodeURIComponent(currentStaffName)}`;
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMonthlyIncomeData(data);
        if (data.monthly_target) {
          setStaffTargets(prev => ({
            ...prev,
            monthly_income_target: data.monthly_target
          }));
        }
      } else {
        console.error("Failed to fetch monthly income:", await res.text());
      }
    } catch (err) {
      console.error("Failed to fetch monthly income:", err);
    }
  }, [currentStaffId, currentStaffName]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      setOrders(await res.json());
      setFetchError(null);
    } catch (err) { setFetchError(err.message); }
  }, []);

  const fetchConfirmedQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders/cashier-history`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      setConfirmedQueue(await res.json());
    } catch (err) { console.error("Queue fetch failed:", err); }
  }, []);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/credits`);
      if (res.ok) setCredits(await res.json());
    } catch (err) { console.error("Credits fetch failed:", err); }
  }, []);

  // ─── CHECK DAY CLOSURE STATUS ──────────────────────────────────────────────
  const checkDayClosure = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/day-closure/day-status`);
      if (res.ok) {
        const data = await res.json();
        if (data.is_closed && !dayClosed) {
          console.log("Day is closed, resetting dashboard...");
          setDayClosed(true);
          // Reset all data
          await handleDayClosureReset();
        }
      }
    } catch (err) {
      console.error("Check day closure error:", err);
    }
  }, [dayClosed]);

  // ─── HANDLE DAY CLOSURE RESET ──────────────────────────────────────────────
  const handleDayClosureReset = useCallback(async () => {
    console.log("Resetting waiter dashboard after day closure...");
    
    // Clear all local states
    setConfirmedQueue([]);
    setOrders([]);
    setCredits([]);
    setMonthlyIncomeData(null);
    setStaffTargets({ daily_order_target: null, monthly_income_target: null });
    
    // Force refresh all data
    await Promise.all([
      loadTargets(),
      fetchMonthlyIncome(),
      fetchOrders(),
      fetchConfirmedQueue(),
      fetchCredits()
    ]);
    
    setLastRefresh(new Date());
    
    // Show notification
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="position: fixed; bottom: 20px; right: 20px; z-index: 9999; background: #10B981; color: white; padding: 16px 24px; border-radius: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); animation: slideIn 0.3s ease-out; font-family: system-ui;">
        ✅ Day has been closed! All totals have been reset for the new day.
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }, [loadTargets, fetchMonthlyIncome, fetchOrders, fetchConfirmedQueue, fetchCredits]);

  // ─── DAY CLOSURE EVENT LISTENER ────────────────────────────────────────────
  useEffect(() => {
    const handleDayClosed = () => {
      console.log("Day closed event received - resetting waiter dashboard");
      handleDayClosureReset();
    };

    const handleRefresh = () => {
      console.log("Refresh event received");
      handleRefreshData();
    };

    window.addEventListener('dayClosed', handleDayClosed);
    window.addEventListener('refresh', handleRefresh);
    
    return () => {
      window.removeEventListener('dayClosed', handleDayClosed);
      window.removeEventListener('refresh', handleRefresh);
    };
  }, [handleDayClosureReset]);

  // Main data fetching effect
  useEffect(() => {
    const loadAllData = async () => {
      await Promise.all([
        loadTargets(),
        fetchMonthlyIncome(),
        fetchOrders(),
        fetchConfirmedQueue(),
        fetchCredits()
      ]);
    };
    
    loadAllData();
    
    // Check day closure every 30 seconds
    const closureInterval = setInterval(checkDayClosure, 30000);
    
    const interval = setInterval(() => {
      fetchMonthlyIncome();
      fetchOrders();
      fetchConfirmedQueue();
      fetchCredits();
    }, 30000);
    
    return () => {
      clearInterval(interval);
      clearInterval(closureInterval);
    };
  }, [loadTargets, fetchMonthlyIncome, fetchOrders, fetchConfirmedQueue, fetchCredits, checkDayClosure]);

  const handleRefreshData = async () => {
    setIsLoading(true);
    setFetchError(null);
    await Promise.all([
      loadTargets(),
      fetchMonthlyIncome(),
      fetchOrders(),
      fetchConfirmedQueue(),
      fetchCredits()
    ]);
    setLastRefresh(new Date());
    setIsLoading(false);
  };

  // ─── COMPUTED VALUES ────────────────────────────────────────────────────────
  const dailyStaffItemsCount = useMemo(() => {
    const todayStr = getTodayLocal();
    if (!orders.length) return 0;
    let count = 0;
    orders.forEach(order => {
      const orderDate = order.timestamp || order.created_at || order.date;
      if (!orderDate) return;
      if (formatOrderDate(orderDate) !== todayStr) return;
      const matchName = order.staff_name?.trim().toUpperCase() === currentStaffName?.trim().toUpperCase();
      const matchId = Number(order.staff_id) === Number(currentStaffId);
      if (matchName || matchId) count += getItemCount(order.items);
    });
    return count;
  }, [orders, currentStaffId, currentStaffName]);

  const monthlyRevenue = monthlyIncomeData?.monthly_income || 0;
  const revenueTarget = staffTargets.monthly_income_target || monthlyIncomeData?.monthly_target || 0;
  
  const grossToday = useMemo(() => {
    const todayStr = getTodayLocal();
    if (!confirmedQueue.length) return 0;
    return confirmedQueue.reduce((sum, row) => {
      if (row.status !== "Confirmed") return sum;
      if (formatOrderDate(new Date(row.confirmed_at || row.created_at)) !== todayStr) return sum;
      const isMe = String(row.staff_id) === String(currentStaffId) ||
        row.requested_by?.toLowerCase() === currentStaffName?.toLowerCase();
      return isMe ? sum + (Number(row.amount) || 0) : sum;
    }, 0);
  }, [confirmedQueue, currentStaffId, currentStaffName]);

  const myCredits = useMemo(() => credits.filter(credit =>
    credit.waiter_name?.toLowerCase() === currentStaffName?.toLowerCase()
  ), [credits, currentStaffName]);

  const creditStats = useMemo(() => {
    const fullySettled = myCredits.filter(c => c.status === "FullySettled");
    const partiallySettled = myCredits.filter(c => c.status === "PartiallySettled");
    const approved = myCredits.filter(c => c.status === "Approved");
    const rejected = myCredits.filter(c => c.status === "Rejected");
    
    const fullySettledAmount = fullySettled.reduce((s, c) => s + Number(c.amount_paid || c.amount || 0), 0);
    const partiallySettledPaidAmount = partiallySettled.reduce((s, c) => s + Number(c.amount_paid || 0), 0);
    const settledAmount = fullySettledAmount + partiallySettledPaidAmount;
    
    const approvedAmount = approved.reduce((s, c) => s + Number(c.amount || 0), 0);
    const partiallySettledRemaining = partiallySettled.reduce((s, c) => s + Number(c.balance || c.amount || 0), 0);
    const outstandingAmount = approvedAmount + partiallySettledRemaining;
    
    const rejectedAmount = rejected.reduce((s, c) => s + Number(c.amount || 0), 0);
    
    return {
      settled: { count: fullySettled.length + partiallySettled.length, amount: settledAmount },
      outstanding: { count: approved.length + partiallySettled.length, amount: outstandingAmount },
      rejected: { count: rejected.length, amount: rejectedAmount },
      total: myCredits.length,
      totalAmount: myCredits.reduce((s, c) => s + Number(c.amount || 0), 0),
    };
  }, [myCredits]);

  const recentOrderItems = useMemo(() => {
    if (!orders.length) return [];
    const allItems = [];
    orders.forEach(order => {
      const matchName = order.staff_name?.trim().toUpperCase() === currentStaffName?.trim().toUpperCase();
      const matchId = Number(order.staff_id) === Number(currentStaffId);
      if (matchName || matchId) allItems.push(...getIndividualItems(order, credits));
    });
    allItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return allItems.slice(0, 20);
  }, [orders, currentStaffId, currentStaffName, credits]);

  const creditChartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = formatOrderDate(d);
      const label = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

      let settled = 0, approved = 0, rejected = 0, outstanding = 0;
      
      myCredits.forEach(credit => {
        const creditDate = formatOrderDate(credit.created_at);
        if (creditDate !== dateStr) return;
        const s = credit.status;
        const amount = Number(credit.amount || 0);
        
        if (s === "FullySettled") {
          settled += amount;
        } else if (s === "PartiallySettled") {
          const amountPaid = Number(credit.amount_paid || 0);
          const remaining = Number(credit.balance || credit.amount || 0);
          settled += amountPaid;
          outstanding += remaining;
        } else if (s === "Approved") {
          approved += amount;
          outstanding += amount;
        } else if (s === "Rejected") {
          rejected += amount;
        } else if (s === "PendingCashier" || s === "PendingManager") {
          outstanding += amount;
        }
      });

      days.push({ 
        date: label, 
        Settled: settled, 
        Approved: approved, 
        Rejected: rejected,
        Outstanding: outstanding,
      });
    }
    return days;
  }, [myCredits]);

  const orderTarget = staffTargets.daily_order_target || 0;
  const orderProgress = orderTarget > 0 ? Math.min((dailyStaffItemsCount / orderTarget) * 100, 100) : 0;
  const revenueProgress = revenueTarget > 0 ? Math.min((monthlyRevenue / revenueTarget) * 100, 100) : 0;

  const getProgressColor = (p) => p >= 75 ? "text-emerald-500" : p >= 50 ? "text-yellow-500" : p >= 25 ? "text-orange-500" : "text-red-500";
  const getProgressBarColor = (p) => p >= 75 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : p >= 50 ? "bg-gradient-to-r from-yellow-500 to-amber-400" : p >= 25 ? "bg-gradient-to-r from-orange-500 to-orange-400" : "bg-gradient-to-r from-red-500 to-red-400";

  const today = getTodayLocal();
  const currentMonth = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const isDark = theme === "dark";

  return (
    <div className="min-h-screen p-6 md:p-10 font-[Outfit] bg-gradient-to-br from-zinc-50 to-zinc-100">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center font-black text-black text-2xl leading-none shadow-lg shadow-yellow-500/30">
                {staffInitial[0]}
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-zinc-900">{currentStaffName}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-600 text-[8px] font-black uppercase tracking-wider">{staffRole}</span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{today}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[8px] text-zinc-400">Last refresh: {lastRefresh.toLocaleTimeString()}</span>
            <button onClick={handleRefreshData} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 text-[10px] font-black uppercase tracking-wider hover:bg-zinc-50 transition-all disabled:opacity-50">
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Refresh
            </button>
          </div>
        </div>

        {/* Error */}
        {fetchError && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500" />
            <div className="flex-1">
              <p className="text-[10px] font-black text-red-500 uppercase tracking-wider">Connection Error</p>
              <p className="text-[9px] text-red-400">{fetchError}</p>
            </div>
            <button onClick={handleRefreshData} className="text-[9px] text-red-500 underline">Retry</button>
          </div>
        )}

        {/* Day Closed Banner */}
        {dayClosed && (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">
              ✅ New Day Started - All totals have been reset
            </p>
          </div>
        )}

        {/* ── STAT CARDS (4 CARDS) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* 1 · Daily Items */}
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 border border-zinc-100">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-orange-500/10"><ClipboardList size={18} className="text-orange-500" /></div>
                <span className="text-[8px] font-black text-orange-500 uppercase tracking-wider">Today</span>
              </div>
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider mb-1">Items Sold</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl font-black text-zinc-900 break-words">{dailyStaffItemsCount}</span>
                <span className="text-xs text-zinc-400 break-words">/ {orderTarget || "—"}</span>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-[8px] font-bold mb-1">
                  <span className="text-zinc-500">Progress</span>
                  <span className={getProgressColor(orderProgress)}>{Math.round(orderProgress)}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                  <div className={`h-full rounded-full ${getProgressBarColor(orderProgress)} transition-all duration-1000 ease-out`} style={{ width: `${orderProgress}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* 2 · Today Revenue */}
          <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 border border-zinc-100">
            <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-yellow-500/10"><TrendingUp size={18} className="text-yellow-500" /></div>
                <span className="text-[8px] font-black text-yellow-500 uppercase tracking-wider">Today</span>
              </div>
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider mb-1">Revenue Generated</p>
              <span className="text-2xl font-black text-zinc-900 break-words block" title={fmtUGX(grossToday)}>
                {fmtLargeNumber(grossToday)}
              </span>
              <div className="mt-3 pt-2 border-t border-zinc-100">
                <div className="flex justify-between text-[8px] font-bold">
                  <span className="text-zinc-500">Today's Contribution</span>
                  <span className="text-emerald-500">{revenueTarget > 0 ? Math.round((grossToday / revenueTarget) * 100) : 0}% of monthly</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3 · Monthly Target (ACCUMULATES throughout month) */}
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 shadow-lg">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-white/20"><Target size={18} className="text-white" /></div>
                <span className="text-[8px] font-black text-white/80 uppercase tracking-wider">{currentMonth}</span>
              </div>
              <p className="text-[9px] font-black text-white/70 uppercase tracking-wider mb-1">Monthly Revenue (Accumulated)</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl font-black text-white break-words">{fmtLargeNumber(monthlyRevenue)}</span>
                <span className="text-xs text-white/60 break-words">/ {fmtLargeNumber(revenueTarget)}</span>
              </div>
              <div className="mt-3">
                <div className="w-full h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full rounded-full bg-white transition-all duration-1000 ease-out" style={{ width: `${revenueProgress}%` }} />
                </div>
              </div>
              <div className="mt-2 text-[8px] text-white/70 text-center">
                {monthlyRevenue > 0 && `✨ ${fmtLargeNumber(monthlyRevenue)} earned so far this month`}
              </div>
            </div>
          </div>

          {/* 4 · Credit Summary */}
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-5 shadow-lg">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-white/20"><BookOpen size={18} className="text-white" /></div>
                <span className="text-[8px] font-black text-white/80 uppercase tracking-wider">Credits</span>
              </div>
              <p className="text-[9px] font-black text-white/70 uppercase tracking-wider mb-1">Your Credit Summary</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px] gap-2">
                  <span className="text-white/70 shrink-0">Settled:</span>
                  <span className="text-white font-black text-right break-words">{fmtLargeNumber(creditStats.settled.amount)}</span>
                </div>
                <div className="flex items-center justify-between text-[9px] gap-2">
                  <span className="text-white/70 shrink-0">Outstanding:</span>
                  <span className="text-white font-black text-right break-words">{fmtLargeNumber(creditStats.outstanding.amount)}</span>
                </div>
                <div className="flex items-center justify-between text-[9px] gap-2">
                  <span className="text-white/70 shrink-0">Rejected:</span>
                  <span className="text-white font-black text-right break-words">{fmtLargeNumber(creditStats.rejected.amount)}</span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-white/20">
                <div className="flex items-center justify-between text-[9px] gap-2">
                  <span className="text-white/70 shrink-0">Total:</span>
                  <span className="text-yellow-300 font-black text-right break-words">{fmtLargeNumber(creditStats.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CREDIT ACTIVITY LINE CHART (With Outstanding) ── */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10">
                <TrendingUp size={16} className="text-indigo-500" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tighter text-zinc-900">Daily Credit Activity</h3>
                <p className="text-[9px] text-zinc-400 mt-0.5">Last 7 days — trends by status</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[9px] font-black uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Settled</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Approved</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Rejected</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" />Outstanding</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={creditChartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#a1a1aa", fontFamily: "Outfit, sans-serif", fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#a1a1aa", fontFamily: "Outfit, sans-serif", fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tickFormatter={(value) => fmtLargeNumber(value).replace("UGX ", "")}
              />
              <Tooltip content={<CreditChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
              <Line type="monotone" dataKey="Settled" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Approved" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Rejected" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: "#ef4444" }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Outstanding" stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: "#f97316" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── RECENT ORDER ITEMS ── */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-blue-500/10"><Activity size={16} className="text-blue-500" /></div>
            <h3 className="text-sm font-black uppercase tracking-tighter text-zinc-900">Recent Order Items History</h3>
            <span className="ml-auto text-[9px] text-zinc-400">Last 20 items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-zinc-200">
                <tr>
                  {["Item", "Table", "Qty", "Amount", "Payment Method", "Status", "Date"].map(h => (
                    <th key={h} className="pb-3 text-[9px] font-black text-zinc-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrderItems.length > 0 ? recentOrderItems.map((item, idx) => {
                  const status = getItemPaymentStatus(item);
                  const method = item.payment_method || (item.is_paid ? "Cash" : item.is_credit ? "Credit" : "Pending");
                  const dateStr = new Date(item.timestamp).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
                  return (
                    <tr key={idx} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                      <td className="py-3 text-[11px] font-bold text-zinc-900 break-words max-w-[150px]">{item.name}</td>
                      <td className="py-3 text-[10px] text-zinc-600">{item.table_name || "WALK-IN"}</td>
                      <td className="py-3 text-[10px] text-zinc-600">x{item.quantity}</td>
                      <td className="py-3 text-[11px] font-black text-emerald-500 whitespace-nowrap">{fmtUGX(item.total)}</td>
                      <td className="py-3">
                        <span className={`text-[9px] font-black uppercase whitespace-nowrap ${method === "Credit" ? "text-purple-500" : method === "Cash" ? "text-emerald-500" : "text-zinc-400"}`}>{method}</span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          {status.icon}
                          <span className={`text-[9px] font-black uppercase ${status.color}`}>{status.label}</span>
                        </div>
                      </td>
                      <td className="py-3 text-[9px] text-zinc-400 whitespace-nowrap">{dateStr}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="7" className="py-8 text-center">
                      <p className="text-[10px] text-zinc-400">No order items found</p>
                      <p className="text-[8px] text-zinc-300 mt-1">Items you serve will appear here</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── PERFORMANCE INSIGHTS ── */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-purple-500/10"><Award size={16} className="text-purple-500" /></div>
            <h3 className="text-sm font-black uppercase tracking-tighter text-zinc-900">Performance Insights</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-50 to-transparent">
              <div className="flex items-center gap-2 mb-2">
                <Target size={14} className="text-yellow-500" />
                <span className="text-[9px] font-black text-yellow-600 uppercase tracking-wider">Daily Target Status</span>
              </div>
              <p className="text-[11px] text-zinc-600">
                {dailyStaffItemsCount >= orderTarget && orderTarget > 0
                  ? "🎉 Congratulations! You've achieved your daily item target!"
                  : orderTarget > 0
                    ? `📋 You need ${orderTarget - dailyStaffItemsCount} more item${orderTarget - dailyStaffItemsCount !== 1 ? "s" : ""} to reach today's target`
                    : "📋 No daily target set. Contact your manager to set targets."}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-transparent">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} className="text-emerald-500" />
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Monthly Revenue Status</span>
              </div>
              <p className="text-[11px] text-zinc-600">
                {monthlyRevenue >= revenueTarget && revenueTarget > 0
                  ? "🏆 Amazing! You've exceeded your monthly revenue target!"
                  : revenueTarget > 0
                    ? `💰 You've generated ${Math.round(revenueProgress)}% of your monthly revenue target (${fmtLargeNumber(monthlyRevenue)} of ${fmtLargeNumber(revenueTarget)}). Keep going!`
                    : "💰 No monthly target set. Contact your manager to set targets."}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-transparent">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={14} className="text-blue-500" />
                <span className="text-[9px] font-black text-blue-600 uppercase tracking-wider">Daily Average Needed</span>
              </div>
              <p className="text-[11px] text-zinc-600">
                {revenueTarget > 0
                  ? `To hit your monthly target, aim for approximately ${fmtUGX(Math.ceil(revenueTarget / 30))} per day`
                  : "Set a monthly target to see daily recommendations"}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-transparent">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={14} className="text-purple-500" />
                <span className="text-[9px] font-black text-purple-600 uppercase tracking-wider">Credit Summary</span>
              </div>
              <p className="text-[11px] text-zinc-600">
                {creditStats.total > 0
                  ? `💳 You have ${creditStats.settled.count} settled totaling ${fmtLargeNumber(creditStats.settled.amount)}, ${creditStats.outstanding.count} outstanding totaling ${fmtLargeNumber(creditStats.outstanding.amount)}, and ${creditStats.rejected.count} rejected totaling ${fmtLargeNumber(creditStats.rejected.amount)}`
                  : "💳 No credit records found"}
              </p>
            </div>
          </div>
        </div>

        {/* Achievement Badge */}
        {(orderProgress >= 100 || revenueProgress >= 100) && (
          <div className="rounded-2xl bg-gradient-to-r from-yellow-500 to-yellow-600 p-4 text-center animate-pulse">
            <div className="flex items-center justify-center gap-2">
              <Award size={20} className="text-white" />
              <span className="text-[11px] font-black text-white uppercase tracking-wider">
                {orderProgress >= 100 && revenueProgress >= 100
                  ? "🏆 Double Achievement! You've crushed both targets!"
                  : orderProgress >= 100
                    ? "🎯 Daily Target Achieved! Great work today!"
                    : "🎯 Monthly Revenue Target Achieved! Outstanding performance!"}
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}