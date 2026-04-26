import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";
import {
  Activity, Target, ClipboardList, TrendingUp, Award, Calendar,
  Clock, CheckCircle2, Loader2, RefreshCw, AlertCircle, BookOpen,
  CheckCircle, XCircle, Clock as ClockIcon, Sparkles, Crown, Star,
  Coffee, Sunset, Moon, Sun, Zap, Heart, Smile, ThumbsUp
} from "lucide-react";
import API_URL from "../../../config/api";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
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
  if (num >= 1_000_000) return `UGX ${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `UGX ${(num / 1_000).toFixed(0)}K`;
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
      created_at: order.created_at,
      _raw_item: item,
    };
  });
}

function getItemPaymentStatus(item) {
  if (item.is_paid === true)
    return { label: "Paid", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: <CheckCircle2 size={10} /> };
  if (item.is_credit === true)
    return { label: "Credit", color: "text-purple-500", bg: "bg-purple-500/10", icon: <BookOpen size={10} /> };
  if (item.is_payment_requested === true)
    return { label: "Awaiting", color: "text-yellow-500", bg: "bg-yellow-500/10", icon: <Clock size={10} className="animate-pulse" /> };
  return { label: "Pending", color: "text-zinc-400", bg: "bg-zinc-500/10", icon: <Clock size={10} /> };
}

// ─── DAILY MOTIVATIONAL MESSAGES ──────────────────────────────────────────────
// Messages organized by date hash for consistency
const MOTIVATIONAL_MESSAGES = [
  { icon: <Sparkles size={14} />, text: "Every plate tells a story. Make yours unforgettable!" },
  { icon: <Crown size={14} />, text: "Excellence is not a skill. It's an attitude." },
  { icon: <Star size={14} />, text: "Small moments. Big smiles. That's the Kurax way!" },
  { icon: <TrendingUp size={14} />, text: "Today's service creates tomorrow's loyalty." },
  { icon: <Award size={14} />, text: "You're not just serving food. You're crafting experiences." },
  { icon: <Coffee size={14} />, text: "Start your shift with purpose. End it with pride." },
  { icon: <Sun size={14} />, text: "Brighten every table with your positive energy." },
  { icon: <Heart size={14} />, text: "Serve from the heart. That's the secret ingredient." },
  { icon: <Zap size={14} />, text: "Speed + Smile = Perfect Service Formula!" },
  { icon: <Smile size={14} />, text: "Your smile is the first taste of Kurax hospitality." },
  { icon: <ThumbsUp size={14} />, text: "Every satisfied guest is your achievement badge!" },
  { icon: <Moon size={14} />, text: "Evening service shines brighter with your dedication." },
  { icon: <Sunset size={14} />, text: "Close the day knowing you made a difference." },
];

// Function to get daily motivation based on date (consistent for same date across years)
function getDailyMotivation() {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  
  // Create a deterministic hash from the date string
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    hash = hash & hash;
  }
  
  // Use the hash to pick a message (consistent for the same date)
  const messageIndex = Math.abs(hash) % MOTIVATIONAL_MESSAGES.length;
  return MOTIVATIONAL_MESSAGES[messageIndex];
}

// ─── TOOLTIP ──────────────────────────────────────────────────────────────────
const CreditChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white border border-zinc-200 p-3 shadow-md text-[10px] font-bold uppercase tracking-wider">
      <p className="text-zinc-400 mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-zinc-700">{entry.name}: {fmtUGX(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ icon, iconBg, iconColor, badge, label, value, sub, progress, progressColor, accent, children }) {
  const isGradient = !!accent;
  return (
    <div className={`group relative overflow-hidden rounded-2xl p-4 sm:p-5 transition-all duration-300 border
      ${isGradient
        ? `${accent} border-transparent shadow-lg`
        : "bg-white border-zinc-100 shadow-sm hover:shadow-md"
      }`}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2 rounded-xl ${isGradient ? "bg-white/20" : iconBg}`}>
            <span className={isGradient ? "text-white" : iconColor}>{icon}</span>
          </div>
          {badge && (
            <span className={`text-[8px] font-bold uppercase tracking-wider ${isGradient ? "text-white/70" : "text-zinc-400"}`}>
              {badge}
            </span>
          )}
        </div>
        <p className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${isGradient ? "text-white/70" : "text-zinc-400"}`}>
          {label}
        </p>
        {children || (
          <>
            <p className={`text-xl sm:text-2xl font-black leading-tight break-all ${isGradient ? "text-white" : "text-zinc-900"}`}>
              {value}
            </p>
            {sub && (
              <p className={`text-[10px] mt-0.5 ${isGradient ? "text-white/60" : "text-zinc-400"}`}>{sub}</p>
            )}
          </>
        )}
        {progress !== undefined && (
          <div className="mt-3">
            <div className="flex justify-between text-[8px] font-bold mb-1">
              <span className={isGradient ? "text-white/60" : "text-zinc-400"}>Progress</span>
              <span className={isGradient ? "text-white" : progressColor}>{Math.round(progress)}%</span>
            </div>
            <div className={`w-full h-1.5 rounded-full overflow-hidden ${isGradient ? "bg-white/20" : "bg-zinc-100"}`}>
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${isGradient ? "bg-white" : getProgressBarColor(progress)}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getProgressColor(p) {
  return p >= 75 ? "text-emerald-500" : p >= 50 ? "text-yellow-500" : p >= 25 ? "text-orange-500" : "text-red-500";
}
function getProgressBarColor(p) {
  return p >= 75 ? "bg-emerald-500" : p >= 50 ? "bg-yellow-500" : p >= 25 ? "bg-orange-500" : "bg-red-500";
}

// ─── MOBILE ORDER ROW ─────────────────────────────────────────────────────────
function MobileOrderRow({ item }) {
  const status = getItemPaymentStatus(item);
  const method = item.payment_method || (item.is_paid ? "Cash" : item.is_credit ? "Credit" : "Pending");
  const timeStr = new Date(item.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="py-3 border-b border-zinc-100 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-zinc-900 truncate">{item.name}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">{item.table_name || "Walk-in"} · x{item.quantity} · {timeStr}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[12px] font-black text-emerald-500">{fmtLargeNumber(item.total)}</p>
          <div className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full ${status.bg}`}>
            {status.icon}
            <span className={`text-[8px] font-bold uppercase ${status.color}`}>{status.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [currentDayDate, setCurrentDayDate] = useState(getTodayLocal());
  const [activeDay, setActiveDay] = useState(null);
  const [dailyMotivation, setDailyMotivation] = useState(null);

  // Load daily motivation when component mounts
  useEffect(() => {
    setDailyMotivation(getDailyMotivation());
  }, []);

  const savedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}"); }
    catch { return {}; }
  }, []);

  const currentStaffId = savedUser?.id;
  const currentStaffName = savedUser?.name || "Staff Member";
  const staffRole = savedUser?.role || "STAFF";
  const staffInitial = (currentStaffName?.split(" ")[0] || "S")[0].toUpperCase();

  const fetchActiveDay = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/day-closure/active-day`);
      if (res.ok) {
        const data = await res.json();
        setActiveDay(data);
        if (data.date) setCurrentDayDate(data.date);
      }
    } catch (err) { console.error("Failed to fetch active day:", err); }
  }, []);

  const loadTargets = useCallback(async () => {
    if (!currentStaffId) return;
    try {
      const res = await fetch(`${API_URL}/api/staff/performance-list`);
      if (res.ok) {
        const list = await res.json();
        const me = list.find(s => String(s.id) === String(currentStaffId));
        if (me) setStaffTargets({ daily_order_target: Number(me.daily_order_target) || 0, monthly_income_target: Number(me.monthly_income_target) || 0 });
      }
    } catch { setFetchError("Failed to load targets"); }
  }, [currentStaffId]);

  const fetchMonthlyIncome = useCallback(async () => {
    if (!currentStaffId && !currentStaffName) return;
    try {
      let url = `${API_URL}/api/summaries/staff-monthly-income?`;
      url += currentStaffId ? `staffId=${currentStaffId}` : `staffName=${encodeURIComponent(currentStaffName)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMonthlyIncomeData(data);
        if (data.monthly_target) setStaffTargets(prev => ({ ...prev, monthly_income_target: data.monthly_target }));
      }
    } catch (err) { console.error("Failed to fetch monthly income:", err); }
  }, [currentStaffId, currentStaffName]);

  const fetchOrders = useCallback(async () => {
    try {
      const url = activeDay?.date ? `${API_URL}/api/orders?date=${activeDay.date}` : `${API_URL}/api/orders`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const allOrders = await res.json();
      setOrders(allOrders.filter(order => {
        const matchName = order.staff_name?.trim().toUpperCase() === currentStaffName?.trim().toUpperCase();
        const matchId = Number(order.staff_id) === Number(currentStaffId);
        return matchName || matchId;
      }));
      setFetchError(null);
    } catch (err) { setFetchError(err.message); }
  }, [currentStaffId, currentStaffName, activeDay]);

  const fetchConfirmedQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders/cashier-history`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const allQueue = await res.json();
      setConfirmedQueue(allQueue.filter(item => {
        const matchStaff = String(item.staff_id) === String(currentStaffId) ||
          item.requested_by?.toLowerCase() === currentStaffName?.toLowerCase();
        const itemDate = formatOrderDate(item.confirmed_at || item.created_at);
        return matchStaff && itemDate === currentDayDate;
      }));
    } catch (err) { console.error("Queue fetch failed:", err); }
  }, [currentStaffId, currentStaffName, currentDayDate]);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/credits`);
      if (res.ok) {
        const allCredits = await res.json();
        setCredits(allCredits.filter(credit => {
          const matchWaiter = credit.waiter_name?.toLowerCase() === currentStaffName?.toLowerCase();
          const creditDate = formatOrderDate(credit.created_at);
          return matchWaiter && creditDate === currentDayDate;
        }));
      }
    } catch (err) { console.error("Credits fetch failed:", err); }
  }, [currentStaffName, currentDayDate]);

  const checkDayClosure = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/day-closure/day-status`);
      if (res.ok) {
        const data = await res.json();
        if (data.is_closed && !dayClosed) {
          setDayClosed(true);
          setConfirmedQueue([]); setOrders([]); setCredits([]); setMonthlyIncomeData(null);
          await fetchActiveDay();
          await Promise.all([loadTargets(), fetchMonthlyIncome(), fetchOrders(), fetchConfirmedQueue(), fetchCredits()]);
          setLastRefresh(new Date());
        } else if (!data.is_closed && dayClosed) {
          setDayClosed(false);
          await fetchActiveDay();
          await handleRefreshData();
        }
      }
    } catch (err) { console.error("Check day closure error:", err); }
  }, [dayClosed, fetchActiveDay, loadTargets, fetchMonthlyIncome, fetchOrders, fetchConfirmedQueue, fetchCredits]);

  useEffect(() => {
    const initialize = async () => {
      await fetchActiveDay();
      await Promise.all([loadTargets(), fetchMonthlyIncome(), fetchOrders(), fetchConfirmedQueue(), fetchCredits()]);
    };
    initialize();
    const closureInterval = setInterval(checkDayClosure, 30000);
    const interval = setInterval(() => {
      if (!dayClosed) { fetchMonthlyIncome(); fetchOrders(); fetchConfirmedQueue(); fetchCredits(); }
    }, 30000);
    return () => { clearInterval(interval); clearInterval(closureInterval); };
  }, []);

  const handleRefreshData = async () => {
    setIsLoading(true);
    setFetchError(null);
    await Promise.all([loadTargets(), fetchMonthlyIncome(), fetchOrders(), fetchConfirmedQueue(), fetchCredits(), fetchActiveDay()]);
    setLastRefresh(new Date());
    setIsLoading(false);
  };

  // ─── COMPUTED ──────────────────────────────────────────────────────────────
  const dailyStaffItemsCount = useMemo(() => {
    let count = 0;
    orders.forEach(order => {
      if (formatOrderDate(order.created_at || order.timestamp) === currentDayDate)
        count += getItemCount(order.items);
    });
    return count;
  }, [orders, currentDayDate]);

  const monthlyRevenue = monthlyIncomeData?.monthly_income || 0;
  const revenueTarget = staffTargets.monthly_income_target || monthlyIncomeData?.monthly_target || 0;

  const grossToday = useMemo(() => confirmedQueue.reduce((sum, row) => {
    if (row.status !== "Confirmed") return sum;
    if (formatOrderDate(row.confirmed_at || row.created_at) !== currentDayDate) return sum;
    return sum + (Number(row.amount) || 0);
  }, 0), [confirmedQueue, currentDayDate]);

  const creditStats = useMemo(() => {
    const settled = credits.filter(c => c.status === "FullySettled");
    const partial = credits.filter(c => c.status === "PartiallySettled");
    const approved = credits.filter(c => c.status === "Approved");
    const rejected = credits.filter(c => c.status === "Rejected");
    return {
      settled: { count: settled.length + partial.length, amount: settled.reduce((s, c) => s + Number(c.amount_paid || c.amount || 0), 0) + partial.reduce((s, c) => s + Number(c.amount_paid || 0), 0) },
      outstanding: { count: approved.length + partial.length, amount: approved.reduce((s, c) => s + Number(c.amount || 0), 0) + partial.reduce((s, c) => s + Number(c.balance || c.amount || 0), 0) },
      rejected: { count: rejected.length, amount: rejected.reduce((s, c) => s + Number(c.amount || 0), 0) },
      total: credits.length,
      totalAmount: credits.reduce((s, c) => s + Number(c.amount || 0), 0),
    };
  }, [credits]);

  const recentOrderItems = useMemo(() => {
    const allItems = [];
    orders.forEach(order => {
      if (formatOrderDate(order.created_at || order.timestamp) === currentDayDate)
        allItems.push(...getIndividualItems(order, credits));
    });
    return allItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 20);
  }, [orders, credits, currentDayDate]);

  const creditChartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const dateStr = formatOrderDate(d);
      const label = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      let Settled = 0, Approved = 0, Rejected = 0, Outstanding = 0;
      credits.forEach(credit => {
        if (formatOrderDate(credit.created_at) !== dateStr) return;
        const amount = Number(credit.amount || 0);
        const s = credit.status;
        if (s === "FullySettled") { Settled += amount; }
        else if (s === "PartiallySettled") { Settled += Number(credit.amount_paid || 0); Outstanding += Number(credit.balance || amount); }
        else if (s === "Approved") { Approved += amount; Outstanding += amount; }
        else if (s === "Rejected") { Rejected += amount; }
        else { Outstanding += amount; }
      });
      return { date: label, Settled, Approved, Rejected, Outstanding };
    });
  }, [credits]);

  const orderTarget = staffTargets.daily_order_target || 0;
  const orderProgress = orderTarget > 0 ? Math.min((dailyStaffItemsCount / orderTarget) * 100, 100) : 0;
  const revenueProgress = revenueTarget > 0 ? Math.min((monthlyRevenue / revenueTarget) * 100, 100) : 0;
  const currentMonth = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  // Get today's date for display
  const todayDisplay = new Date().toLocaleDateString("en-GB", { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="min-h-screen bg-zinc-50 font-[Outfit]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-4 sm:space-y-6">

        {/* ── HEADER with Captivating Text on Left and Waiter Name on Right ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left side - Captivating motivational text */}
          <div className="flex items-center gap-3 min-w-0">
            
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[19px] text-yellow-900 font-medium uppercase tracking-wider">
                ✨ Today's Motivation ✨
              </p>
              <p className="text-xs sm:text-sm font-medium text-zinc-700 leading-tight mt-0.5">
                {dailyMotivation?.text || "You're amazing! Keep serving with excellence!"}
              </p>
              <p className="text-[8px] text-zinc-400 mt-1 hidden sm:block">
                {todayDisplay}
              </p>
            </div>
          </div>

          {/* Right side - Waiter profile */}
          <div className="flex items-center justify-end gap-3 sm:gap-4 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-zinc-900">{currentStaffName}</p>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-700 text-[8px] font-bold uppercase tracking-wider">
                  {staffRole}
                </span>
                <span className="text-[8px] text-emerald-500 font-bold">✓ Active</span>
              </div>
            </div>
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center font-black text-black text-xl sm:text-2xl shadow-lg">
                {staffInitial}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
            </div>
          </div>
        </div>

        {/* Mobile date display */}
        <div className="sm:hidden">
          <p className="text-[8px] text-zinc-400 mt-0.5 text-center">
            {todayDisplay}
          </p>
        </div>

        {/* Mobile waiter info */}
        <div className="sm:hidden flex items-center justify-between">
          <div>
            <p className="text-[9px] text-zinc-400 uppercase tracking-wider">Logged in as</p>
            <p className="text-sm font-black text-zinc-900">{currentStaffName}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-700 text-[8px] font-bold uppercase tracking-wider">
              {staffRole}
            </span>
            <span className="text-[8px] text-emerald-500 font-bold">Active</span>
          </div>
        </div>

        {/* ── ERROR ── */}
        {fetchError && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-center gap-3">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
            <p className="text-[11px] text-red-600 flex-1 min-w-0 truncate">{fetchError}</p>
            <button onClick={handleRefreshData} className="text-[10px] text-red-500 underline flex-shrink-0">Retry</button>
          </div>
        )}

        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

          {/* Items Sold */}
          <StatCard
            icon={<ClipboardList size={16} />}
            iconBg="bg-orange-500/10" iconColor="text-orange-500"
            badge="Today" label="Items Sold"
            value={dailyStaffItemsCount}
            sub={`/ ${orderTarget || "—"} target`}
            progress={orderProgress}
            progressColor={getProgressColor(orderProgress)}
          />

          {/* Revenue Today */}
          <StatCard
            icon={<TrendingUp size={16} />}
            iconBg="bg-yellow-500/10" iconColor="text-yellow-500"
            badge="Today" label="Revenue"
            value={fmtLargeNumber(grossToday)}
            sub={revenueTarget > 0 ? `${Math.round((grossToday / revenueTarget) * 100)}% of monthly` : ""}
          />

          {/* Monthly Target */}
          <StatCard
            icon={<Target size={16} />}
            badge={currentMonth}
            label="Monthly Revenue"
            accent="bg-gradient-to-br from-emerald-500 to-emerald-600"
            progress={revenueProgress}
          >
            <p className="text-lg sm:text-xl font-black text-white leading-tight break-all">
              {fmtLargeNumber(monthlyRevenue)}
            </p>
            <p className="text-[9px] text-white/60 mt-0.5">/ {fmtLargeNumber(revenueTarget)}</p>
          </StatCard>

          {/* Credits */}
          <StatCard
            icon={<BookOpen size={16} />}
            badge="Today"
            label="Credit Summary"
            accent="bg-gradient-to-br from-purple-500 to-purple-600"
          >
            <div className="space-y-1 mt-1">
              {[
                { k: "Settled", v: creditStats.settled.amount },
                { k: "Outstanding", v: creditStats.outstanding.amount },
                { k: "Rejected", v: creditStats.rejected.amount },
              ].map(({ k, v }) => (
                <div key={k} className="flex items-center justify-between gap-1">
                  <span className="text-[9px] text-white/60">{k}</span>
                  <span className="text-[10px] font-black text-white">{fmtLargeNumber(v)}</span>
                </div>
              ))}
              <div className="pt-1 mt-1 border-t border-white/20 flex items-center justify-between gap-1">
                <span className="text-[9px] text-white/60">Total</span>
                <span className="text-[10px] font-black text-yellow-300">{fmtLargeNumber(creditStats.totalAmount)}</span>
              </div>
            </div>
          </StatCard>
        </div>

        {/* ── CHART ── */}
        <div className="rounded-2xl bg-white p-4 sm:p-6 border border-zinc-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-500/10">
                <TrendingUp size={15} className="text-indigo-500" />
              </div>
              <div>
                <h3 className="text-[16px] font-medium uppercase tracking-tight text-yellow-900">Credit Activity</h3>
                <p className="text-[9px] text-zinc-400">Last 7 days</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-[9px] font-bold uppercase tracking-wider">
              {[["Settled","#10b981"],["Approved","#3b82f6"],["Rejected","#ef4444"],["Outstanding","#f97316"]].map(([name, color]) => (
                <span key={name} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  {name}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={creditChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#a1a1aa", fontFamily: "Outfit, sans-serif" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#a1a1aa", fontFamily: "Outfit, sans-serif" }} tickLine={false} axisLine={false} tickFormatter={v => fmtLargeNumber(v).replace("UGX ", "")} width={45} />
              <Tooltip content={<CreditChartTooltip />} />
              <Line type="monotone" dataKey="Settled" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="Approved" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="Rejected" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="Outstanding" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── ORDER ITEMS ── */}
        <div className="rounded-2xl bg-white p-4 sm:p-6 border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-blue-500/10"><Activity size={15} className="text-blue-500" /></div>
            <h3 className="text-[16px] font-medium uppercase tracking-tight text-yellow-900">Today's Orders</h3>
            <span className="ml-auto text-[9px] text-zinc-900">Last 20</span>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "28%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "9%" }} />
              </colgroup>
              <thead className="border-b border-zinc-100">
                <tr>
                  {["Item", "Table", "Qty", "Amount", "Method", "Status", "Time"].map(h => (
                    <th key={h} className="pb-3 text-[9px] font-bold text-zinc-400 uppercase tracking-wider pr-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrderItems.length > 0 ? recentOrderItems.map((item, idx) => {
                  const status = getItemPaymentStatus(item);
                  const method = item.payment_method || (item.is_paid ? "Cash" : item.is_credit ? "Credit" : "Pending");
                  const timeStr = new Date(item.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <tr key={idx} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                      <td className="py-2.5 text-[11px] font-medium text-yellow-900 truncate pr-2">{item.name}</td>
                      <td className="py-2.5 text-[10px] text-zinc-500 truncate pr-2">{item.table_name || "Walk-in"}</td>
                      <td className="py-2.5 text-[10px] text-zinc-500 pr-2">×{item.quantity}</td>
                      <td className="py-2.5 text-[10px] font-medium text-emerald-500 truncate pr-2">{fmtUGX(item.total)}</td>
                      <td className="py-2.5 pr-2">
                        <span className={`text-[9px] font-bold uppercase ${method === "Credit" ? "text-purple-500" : method === "Cash" ? "text-emerald-500" : "text-zinc-400"}`}>
                          {method}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2">
                        <span className={`text-[9px] font-bold uppercase ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="py-2.5 text-[9px] text-zinc-400">{timeStr}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="7" className="py-10 text-center text-[10px] text-zinc-400">
                      No order items for today
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="sm:hidden">
            {recentOrderItems.length > 0
              ? recentOrderItems.map((item, idx) => <MobileOrderRow key={idx} item={item} />)
              : <p className="py-8 text-center text-[11px] text-zinc-400">No order items for today</p>
            }
          </div>
        </div>

        {/* ── PERFORMANCE INSIGHTS ── */}
        <div className="rounded-2xl bg-white p-4 sm:p-6 border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-purple-500/10"><Award size={15} className="text-purple-500" /></div>
            <h3 className="text-[16px] font-medium uppercase tracking-tight text-yellow-900">Performance Insights</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                icon: <Target size={13} className="text-yellow-500" />,
                label: "Daily Target", color: "text-yellow-600", bg: "bg-yellow-50",
                text: dailyStaffItemsCount >= orderTarget && orderTarget > 0
                  ? "🎉 Daily item target achieved!"
                  : orderTarget > 0
                    ? `📋 ${orderTarget - dailyStaffItemsCount} more item${orderTarget - dailyStaffItemsCount !== 1 ? "s" : ""} to reach today's target`
                    : "📋 No daily target set",
              },
              {
                icon: <TrendingUp size={13} className="text-emerald-500" />,
                label: "Monthly Revenue", color: "text-emerald-600", bg: "bg-emerald-50",
                text: monthlyRevenue >= revenueTarget && revenueTarget > 0
                  ? "🏆 Monthly revenue target exceeded!"
                  : revenueTarget > 0
                    ? `💰 ${Math.round(revenueProgress)}% of monthly target reached`
                    : "💰 No monthly target set",
              },
              {
                icon: <Calendar size={13} className="text-blue-500" />,
                label: "Daily Average Needed", color: "text-blue-600", bg: "bg-blue-50",
                text: revenueTarget > 0
                  ? `Aim for ${fmtUGX(Math.ceil(revenueTarget / 30))} per day`
                  : "Set a monthly target to see daily recommendations",
              },
              {
                icon: <BookOpen size={13} className="text-purple-500" />,
                label: "Credit Summary", color: "text-purple-600", bg: "bg-purple-50",
                text: creditStats.total > 0
                  ? `💳 ${creditStats.settled.count} settled · ${creditStats.outstanding.count} outstanding`
                  : "💳 No credit records for today",
              },
            ].map(({ icon, label, color, bg, text }) => (
              <div key={label} className={`p-3 sm:p-4 rounded-xl ${bg}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  {icon}
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${color}`}>{label}</span>
                </div>
                <p className="text-[11px] text-zinc-600 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── ACHIEVEMENT ── */}
        {(orderProgress >= 100 || revenueProgress >= 100) && (
          <div className="rounded-2xl bg-yellow-500 p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <Award size={18} className="text-black" />
              <span className="text-[11px] font-black text-black uppercase tracking-wider">
                {orderProgress >= 100 && revenueProgress >= 100
                  ? "🏆 Double Achievement! Both targets crushed!"
                  : orderProgress >= 100
                    ? "🎯 Daily target achieved!"
                    : "🎯 Monthly revenue target achieved!"}
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}