import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Activity, Target, ClipboardList, TrendingUp, Award, Calendar, Clock, CheckCircle2, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import API_URL from "../../../config/api";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getTodayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatOrderDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fmtUGX(n) {
  return `UGX ${Number(n || 0).toLocaleString()}`;
}

// Helper to parse items array from order
function getItemCount(items) {
  if (!items) return 0;
  if (Array.isArray(items)) return items.length;
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed.length : 1;
    } catch {
      return 1;
    }
  }
  return 1;
}

export default function PerformanceDashboard({ theme = "light" }) {
  const [staffTargets, setStaffTargets] = useState({
    daily_order_target: null,
    monthly_income_target: null,
  });
  const [confirmedQueue, setConfirmedQueue] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Retrieve user info from localStorage
  const savedUser = useMemo(() => {
    try { 
      const user = JSON.parse(localStorage.getItem("kurax_user") || "{}");
      console.log("📦 Saved user:", user);
      return user;
    }
    catch { return {}; }
  }, []);

  const currentStaffId = savedUser?.id;
  const currentStaffName = savedUser?.name || "Staff Member";
  const staffRole = savedUser?.role || "STAFF";
  const staffInitial = (currentStaffName?.split(" ")[0] || "Staff").toUpperCase();

  console.log("👤 Current Staff ID:", currentStaffId);
  console.log("👤 Current Staff Name:", currentStaffName);

  // 1. Load Performance Targets from API
  const loadTargets = useCallback(async () => {
    if (!currentStaffId) return;
    try {
      const res = await fetch(`${API_URL}/api/staff/performance-list`);
      if (res.ok) {
        const list = await res.json();
        console.log("📋 Staff list:", list);
        const me = list.find(s => String(s.id) === String(currentStaffId));
        if (me) {
          console.log("🎯 Found staff member:", me);
          setStaffTargets({
            daily_order_target: Number(me.daily_order_target) || 0,
            monthly_income_target: Number(me.monthly_income_target) || 0,
          });
        }
      }
    } catch (err) { 
      console.error("Target load failed", err);
      setFetchError("Failed to load targets");
    }
  }, [currentStaffId]);

  // 2. Fetch Orders
  const fetchOrders = useCallback(async () => {
    try {
      console.log("📡 Fetching orders from:", `${API_URL}/api/orders`);
      const res = await fetch(`${API_URL}/api/orders`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const allOrders = await res.json();
      console.log(`📋 Fetched ${allOrders.length} total orders`);
      
      // Log sample order to see structure
      if (allOrders.length > 0) {
        console.log("Sample order:", allOrders[0]);
        console.log("Sample order staff_name:", allOrders[0].staff_name);
        console.log("Sample order staff_id:", allOrders[0].staff_id);
      }
      
      setOrders(allOrders);
      setFetchError(null);
    } catch (err) { 
      console.error("Orders fetch failed:", err);
      setFetchError(err.message);
    }
  }, []);

  // 3. Fetch Confirmed Queue for Revenue
  const fetchConfirmedQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders/cashier-history`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      console.log(`💰 Fetched ${data.length} confirmed payments`);
      setConfirmedQueue(data);
    } catch (err) { 
      console.error("Queue fetch failed:", err);
    }
  }, []);

  // Initial load and polling
  useEffect(() => {
    loadTargets();
    fetchOrders();
    fetchConfirmedQueue();
    
    const interval = setInterval(() => {
      fetchOrders();
      fetchConfirmedQueue();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadTargets, fetchOrders, fetchConfirmedQueue]);

  // Manual refresh
  const handleRefresh = async () => {
    setIsLoading(true);
    setFetchError(null);
    await Promise.all([loadTargets(), fetchOrders(), fetchConfirmedQueue()]);
    setLastRefresh(new Date());
    setIsLoading(false);
  };

  // FIXED: Count ORDER ITEMS (not orders) for today
  const dailyStaffItemsCount = useMemo(() => {
    const todayStr = getTodayLocal();
    console.log("📅 Today's date (local):", todayStr);
    
    if (!orders.length) {
      console.log("No orders in state");
      return 0;
    }
    
    const storedUser = JSON.parse(localStorage.getItem("kurax_user") || "{}");
    const currentStaffNameStr = storedUser.name || currentStaffName;
    const currentStaffIdNum = Number(storedUser.id || currentStaffId);
    
    console.log("Looking for staff name:", currentStaffNameStr);
    console.log("Looking for staff ID:", currentStaffIdNum);
    console.log("Total orders in state:", orders.length);
    
    // Count ITEMS, not orders
    let totalItemsCount = 0;
    
    orders.forEach(order => {
      const orderDate = order.timestamp || order.created_at || order.date;
      if (!orderDate) return;
      
      const formattedDate = formatOrderDate(orderDate);
      const isToday = formattedDate === todayStr;
      
      // Check by staff_name (from JOIN) OR staff_id
      const matchesStaffName = order.staff_name && 
        order.staff_name.trim().toUpperCase() === currentStaffNameStr.trim().toUpperCase();
      const matchesStaffId = Number(order.staff_id) === currentStaffIdNum;
      
      const isMyOrder = matchesStaffName || matchesStaffId;
      
      if (isToday && isMyOrder) {
        // Count the number of items in this order
        const itemCount = getItemCount(order.items);
        totalItemsCount += itemCount;
        
        console.log(`Order #${order.id}: ${itemCount} items - Total items so far: ${totalItemsCount}`);
      }
    });
    
    console.log(`✅ Found ${totalItemsCount} total items for today (staff: ${currentStaffNameStr})`);
    return totalItemsCount;
  }, [orders, currentStaffId, currentStaffName]);

  // Calculate Gross Revenue Progress for Today
  const grossToday = useMemo(() => {
    const todayStr = getTodayLocal();
    if (!confirmedQueue.length) return 0;
    
    return confirmedQueue.reduce((sum, row) => {
      if (row.status !== "Confirmed") return sum;
      const d = new Date(row.confirmed_at || row.created_at);
      const rowDate = formatOrderDate(d);
      if (rowDate === todayStr) {
        const isMyPayment = String(row.staff_id) === String(currentStaffId) ||
                           (row.requested_by && row.requested_by.toLowerCase() === currentStaffName?.toLowerCase());
        if (isMyPayment) {
          return sum + (Number(row.amount) || 0);
        }
      }
      return sum;
    }, 0);
  }, [confirmedQueue, currentStaffId, currentStaffName]);

  // Calculate Monthly Revenue Progress
  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    if (!confirmedQueue.length) return 0;
    
    return confirmedQueue.reduce((sum, row) => {
      if (row.status !== "Confirmed") return sum;
      const d = new Date(row.confirmed_at || row.created_at);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        const isMyPayment = String(row.staff_id) === String(currentStaffId) ||
                           (row.requested_by && row.requested_by.toLowerCase() === currentStaffName?.toLowerCase());
        if (isMyPayment) {
          return sum + (Number(row.amount) || 0);
        }
      }
      return sum;
    }, 0);
  }, [confirmedQueue, currentStaffId, currentStaffName]);

  const orderTarget = staffTargets.daily_order_target || 0;
  const revenueTarget = staffTargets.monthly_income_target || 0;

  const orderProgress = orderTarget > 0 ? Math.min((dailyStaffItemsCount / orderTarget) * 100, 100) : 0;
  const revenueProgress = revenueTarget > 0 ? Math.min((monthlyRevenue / revenueTarget) * 100, 100) : 0;

  const getProgressColor = (percentage) => {
    if (percentage >= 75) return "text-emerald-500";
    if (percentage >= 50) return "text-yellow-500";
    if (percentage >= 25) return "text-orange-500";
    return "text-red-500";
  };

  const getProgressBarColor = (percentage) => {
    if (percentage >= 75) return "bg-gradient-to-r from-emerald-500 to-emerald-400";
    if (percentage >= 50) return "bg-gradient-to-r from-yellow-500 to-amber-400";
    if (percentage >= 25) return "bg-gradient-to-r from-orange-500 to-orange-400";
    return "bg-gradient-to-r from-red-500 to-red-400";
  };

  const getMessage = (percentage, type) => {
    if (percentage >= 100) return "🎉 Excellent! Target achieved!";
    if (percentage >= 75) return "🔥 Great progress! Almost there!";
    if (percentage >= 50) return "💪 Good work! Keep pushing!";
    if (percentage >= 25) return "📈 Making progress! Stay focused!";
    return type === "order" ? "📋 Start taking orders to reach your target" : "💰 Keep serving to increase revenue";
  };

  const today = getTodayLocal();
  const currentMonth = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  // FIXED: Recent orders with item counts
  const recentOrders = useMemo(() => {
    const todayStr = getTodayLocal();
    if (!orders.length) return [];
    
    const storedUser = JSON.parse(localStorage.getItem("kurax_user") || "{}");
    const currentStaffNameStr = storedUser.name || currentStaffName;
    const currentStaffIdNum = Number(storedUser.id || currentStaffId);
    
    const filtered = orders
      .filter(o => {
        const formattedDate = formatOrderDate(o.timestamp || o.created_at || o.date);
        const matchesStaffName = o.staff_name && 
          o.staff_name.trim().toUpperCase() === currentStaffNameStr.trim().toUpperCase();
        const matchesStaffId = Number(o.staff_id) === currentStaffIdNum;
        return formattedDate === todayStr && (matchesStaffName || matchesStaffId);
      })
      .map(o => ({
        ...o,
        item_count: getItemCount(o.items)
      }))
      .slice(0, 10);
    
    console.log(`Recent orders found: ${filtered.length}`);
    return filtered;
  }, [orders, currentStaffId, currentStaffName]);

  return (
    <div className="min-h-screen p-6 md:p-10 font-[Outfit] bg-gradient-to-br from-zinc-50 to-zinc-100">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center font-black text-black text-2xl leading-none shadow-lg shadow-yellow-500/30">
                {staffInitial[0]}
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-zinc-900">
                {currentStaffName}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-600 text-[8px] font-black uppercase tracking-wider">
                  {staffRole}
                </span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
                  {today}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-[8px] text-zinc-400">
              Last refresh: {lastRefresh.toLocaleTimeString()}
            </span>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 text-[10px] font-black uppercase tracking-wider hover:bg-zinc-50 transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Refresh
            </button>
          </div>
        </div>

       

        {/* Error Display */}
        {fetchError && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500" />
            <div className="flex-1">
              <p className="text-[10px] font-black text-red-500 uppercase tracking-wider">Connection Error</p>
              <p className="text-[9px] text-red-400">{fetchError}</p>
            </div>
            <button onClick={handleRefresh} className="text-[9px] text-red-500 underline">Retry</button>
          </div>
        )}

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Daily Items Card */}
          <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300 border border-zinc-100">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-orange-500/10">
                  <ClipboardList size={20} className="text-orange-500" />
                </div>
                <span className="text-[9px] font-black text-orange-500 uppercase tracking-wider">Today</span>
              </div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">Items Sold</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-zinc-900">{dailyStaffItemsCount}</span>
                <span className="text-sm text-zinc-400">/ {orderTarget || '—'}</span>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-[9px] font-bold mb-1">
                  <span className="text-zinc-500">Progress</span>
                  <span className={getProgressColor(orderProgress)}>{Math.round(orderProgress)}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${getProgressBarColor(orderProgress)} transition-all duration-1000 ease-out`}
                    style={{ width: `${orderProgress}%` }}
                  />
                </div>
                <p className="text-[9px] text-zinc-400 mt-2">{getMessage(orderProgress, "order")}</p>
              </div>
            </div>
          </div>

          {/* Today's Revenue Card */}
          <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300 border border-zinc-100">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-yellow-500/10">
                  <TrendingUp size={20} className="text-yellow-500" />
                </div>
                <span className="text-[9px] font-black text-yellow-500 uppercase tracking-wider">Today</span>
              </div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">Revenue Generated</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-zinc-900">{fmtUGX(grossToday)}</span>
              </div>
              <div className="mt-4 pt-2 border-t border-zinc-100">
                <div className="flex justify-between text-[9px] font-bold">
                  <span className="text-zinc-500">Monthly Target Progress</span>
                  <span className={getProgressColor(revenueProgress)}>{Math.round(revenueProgress)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Target Card */}
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 shadow-lg">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-white/20">
                  <Target size={20} className="text-white" />
                </div>
                <span className="text-[9px] font-black text-white/80 uppercase tracking-wider">{currentMonth}</span>
              </div>
              <p className="text-[10px] font-black text-white/70 uppercase tracking-wider mb-1">Monthly Target</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{fmtUGX(monthlyRevenue)}</span>
                <span className="text-sm text-white/60">/ {fmtUGX(revenueTarget)}</span>
              </div>
              <div className="mt-3">
                <div className="w-full h-2 rounded-full bg-white/20 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-white transition-all duration-1000 ease-out"
                    style={{ width: `${revenueProgress}%` }}
                  />
                </div>
                <p className="text-[9px] text-white/80 mt-2">{getMessage(revenueProgress, "revenue")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Orders */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-blue-500/10">
                <Activity size={16} className="text-blue-500" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-tighter text-zinc-900">Recent Orders</h3>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentOrders.length > 0 ? (
                recentOrders.map((order, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-zinc-900">
                          Order #{String(order.id || '').slice(-6)}
                          <span className="ml-2 text-[9px] text-zinc-400">({order.item_count} item{order.item_count !== 1 ? 's' : ''})</span>
                        </p>
                        <p className="text-[8px] font-bold text-zinc-400 uppercase">Table {order.table_name || 'WALK-IN'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-black text-emerald-500">{fmtUGX(order.total)}</p>
                      <p className="text-[8px] font-bold text-zinc-400">{order.payment_method || 'Pending'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-[10px] text-zinc-400">No orders today yet</p>
                  <p className="text-[8px] text-zinc-300 mt-1">Orders you complete will appear here</p>
                </div>
              )}
            </div>
          </div>

          {/* Performance Insights */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-purple-500/10">
                <Award size={16} className="text-purple-500" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-tighter text-zinc-900">Performance Insights</h3>
            </div>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-50 to-transparent">
                <div className="flex items-center gap-2 mb-2">
                  <Target size={14} className="text-yellow-500" />
                  <span className="text-[9px] font-black text-yellow-600 uppercase tracking-wider">Daily Target Status</span>
                </div>
                <p className="text-[11px] text-zinc-600">
                  {dailyStaffItemsCount >= orderTarget && orderTarget > 0
                    ? "🎉 Congratulations! You've achieved your daily item target!"
                    : orderTarget > 0
                      ? `📋 You need ${orderTarget - dailyStaffItemsCount} more item${orderTarget - dailyStaffItemsCount !== 1 ? 's' : ''} to reach today's target`
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
                      ? `💰 You've generated ${Math.round(revenueProgress)}% of your monthly revenue target. Keep going!`
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