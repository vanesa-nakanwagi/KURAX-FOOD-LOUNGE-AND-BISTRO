import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import API_URL from "../../../config/api";
import { 
  Target, TrendingUp, ShoppingBag, 
  Calendar, FileText, Lock, CheckCircle2, Loader2,
  Users, Clock, Banknote, CreditCard, Receipt,
  Printer, ChevronDown, ChevronUp, Search, Wallet,
  Activity, DollarSign, ArrowUpCircle, AlertCircle, RefreshCw, Save,
  Info, PlusCircle
} from "lucide-react";

// --- HELPERS (unchanged) ---
function fmtUGX(n) {
  return `UGX ${Number(n || 0).toLocaleString()}`;
}

function formatTime(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatOrderId(id) {
  if (!id) return "—";
  const idStr = String(id);
  return idStr.length > 6 ? idStr.slice(-6) : idStr;
}

function getKampalaDate(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function includeOrderInReport(order) {
  if (!order.payment_confirmed) return false;
  const status = (order.status || "").toLowerCase();
  const allowed = ["paid", "closed", "confirmed", "served", "credit"];
  return allowed.includes(status);
}

function getDisplayPaymentMethod(order) {
  let items = order.items;
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  if (!Array.isArray(items)) items = [];

  let hasCreditItem = false;
  let settlementMethods = new Set();

  items.forEach(item => {
    const isCredit = (item.payment_method && item.payment_method.toUpperCase().includes("CREDIT")) 
                     || item.creditRequested === true 
                     || (item.credit_status === "Approved");
    if (isCredit) {
      hasCreditItem = true;
      const method = item.payment_method;
      if (method && !method.toUpperCase().includes("CREDIT")) {
        settlementMethods.add(method.toLowerCase());
      }
    }
  });

  if (hasCreditItem) {
    if (settlementMethods.size > 0) {
      return `credit/${Array.from(settlementMethods).join(",")}`;
    }
    return "Credit";
  }

  return order.payment_method || "—";
}

function getOrderDisplayTotal(order) {
  let items = order.items;
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  if (!Array.isArray(items)) items = [];

  let total = 0;
  items.forEach(item => {
    const isPaid = item._rowPaid === true;
    const isCredit = (item.payment_method && item.payment_method.toUpperCase().includes("CREDIT")) 
                     || item.creditRequested === true 
                     || (item.credit_status === "Approved");
    if (isPaid || isCredit) {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.price) || 0;
      total += qty * price;
    }
  });
  return total > 0 ? total : Number(order.total || 0);
}

function parseItems(raw) {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(raw) ? raw : [];
}

function resolveItems(order, allOrders) {
  const ownItems = parseItems(order.items);
  if (ownItems.length > 0) return ownItems;

  let sourceIds = order.original_order_ids;
  if (typeof sourceIds === 'string') {
    try { sourceIds = JSON.parse(sourceIds); } catch { sourceIds = []; }
  }
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) return [];

  for (const sid of sourceIds) {
    const src = allOrders.find(o => o.id === sid || o.id === Number(sid));
    if (src) {
      const srcItems = parseItems(src.items);
      if (srcItems.length > 0) return srcItems;
    }
  }
  return [];
}

export default function TargetSettings() {
  const { 
    monthlyTargets = {}, 
    orders: filteredOrders,
    allOrders,
    refreshData 
  } = useData() || {};
  const { theme } = useTheme();

  const isDark = theme === 'dark';
  
  // --- Report State ---
  const [reportDate, setReportDate] = useState(() => getKampalaDate());
  const [expandedOrders, setExpandedOrders] = useState(false);
  const [reportType, setReportType] = useState("daily");
  const [searchQuery, setSearchQuery] = useState("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingStaffPDF, setIsGeneratingStaffPDF] = useState(false);
  const [staffPerformanceData, setStaffPerformanceData] = useState(null);
  const [loadingStaffData, setLoadingStaffData] = useState(false);

  // --- Time filter for PDFs ---
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // --- Target Setting ---
  const [targetMonth, setTargetMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const monthLabel = (() => {
    const [year, month] = targetMonth.split('-');
    const d = new Date(Number(year), Number(month) - 1, 1);
    return d.toLocaleString("default", { month: "long", year: "numeric" }).toUpperCase();
  })();
  const currentTarget = monthlyTargets?.[targetMonth]?.revenue || 0;
  const [editTargetValue, setEditTargetValue] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);
  
  const [targetProgress, setTargetProgress] = useState({ target: 0, percentage: 0 });
  const [loadingTarget, setLoadingTarget] = useState(true);
  const [monthlyCreditSettled, setMonthlyCreditSettled] = useState(0);
  
  // --- Petty Cash ---
  const [pettyCashData, setPettyCashData] = useState({ total_out: 0, total_in: 0, net: 0 });
  const [loadingPettyCash, setLoadingPettyCash] = useState(false);
  
  // --- Credits ---
  const [creditsData, setCreditsData] = useState({ 
    total_credits: 0, 
    settled_amount: 0, 
    outstanding_amount: 0,
    partially_settled_outstanding: 0,
    settled_count: 0,
  });
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [error, setError] = useState(null);

  // --- Credit settlements list (for order details table) ---
  const [creditSettlementsList, setCreditSettlementsList] = useState([]);
  const [loadingSettlements, setLoadingSettlements] = useState(false);

  // Helper: get week start/end
  const getWeekRange = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day);
    const dayOfWeek = selectedDate.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(selectedDate);
    weekStart.setDate(selectedDate.getDate() - diff);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { start: fmt(weekStart), end: fmt(weekEnd) };
  };

  // Fetch target progress
  const fetchTargetProgress = useCallback(async () => {
    setLoadingTarget(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/manager/target-progress?month=${targetMonth}`);
      if (response.ok) {
        const data = await response.json();
        setTargetProgress({ target: data.target || 0, percentage: data.percentage || 0 });
      }
    } catch (err) {
      console.error("Failed to fetch target progress:", err);
    } finally {
      setLoadingTarget(false);
    }
  }, [targetMonth]);

  const fetchMonthlyCreditSettled = useCallback(async () => {
    try {
      const url = `${API_URL}/api/manager/credits-summary?period=monthly&month=${targetMonth}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setMonthlyCreditSettled(Number(data.settled_amount) || 0);
      }
    } catch (err) {
      console.error("Failed to fetch monthly credit settlements:", err);
    }
  }, [targetMonth]);

  const saveTarget = async () => {
    if (!editTargetValue || isNaN(editTargetValue)) {
      alert("Please enter a valid amount");
      return;
    }
    setSavingTarget(true);
    try {
      const res = await fetch(`${API_URL}/api/manager/targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month_key: targetMonth,
          revenue_goal: parseFloat(editTargetValue),
          waiter_quota: 0
        })
      });
      if (res.ok) {
        alert(`Target for ${monthLabel} set to UGX ${Number(editTargetValue).toLocaleString()}`);
        setEditTargetValue("");
        if (refreshData) refreshData();
        fetchTargetProgress();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update target");
      }
    } catch (err) {
      alert("Network error: " + err.message);
    } finally {
      setSavingTarget(false);
    }
  };

  const fetchPettyCashForDate = useCallback(async (date) => {
    setLoadingPettyCash(true);
    try {
      let url = "";
      if (reportType === "daily") {
        url = `${API_URL}/api/manager/petty-cash-summary?period=daily&date=${date}`;
      } else if (reportType === "weekly") {
        const { start, end } = getWeekRange(date);
        url = `${API_URL}/api/manager/petty-cash-summary?period=weekly&startDate=${start}&endDate=${end}`;
      } else {
        url = `${API_URL}/api/manager/petty-cash-summary?period=monthly&month=${date.substring(0, 7)}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPettyCashData({
          total_out: Number(data.total_out) || 0,
          total_in: Number(data.total_in) || 0,
          net: (Number(data.total_in) || 0) - (Number(data.total_out) || 0)
        });
      }
    } catch (err) {
      console.error("Failed to fetch petty cash:", err);
    } finally {
      setLoadingPettyCash(false);
    }
  }, [reportType]);

  const fetchCreditsForPeriod = useCallback(async () => {
    setLoadingCredits(true);
    try {
      let url = "";
      if (reportType === "daily") {
        url = `${API_URL}/api/manager/credits-summary?period=daily&date=${reportDate}`;
      } else if (reportType === "weekly") {
        const { start, end } = getWeekRange(reportDate);
        url = `${API_URL}/api/manager/credits-summary?period=weekly&startDate=${start}&endDate=${end}`;
      } else {
        url = `${API_URL}/api/manager/credits-summary?period=monthly&month=${reportDate.substring(0, 7)}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setCreditsData({
          total_credits: data.total_credits || 0,
          settled_amount: Number(data.settled_amount) || 0,
          outstanding_amount: Number(data.outstanding_amount) || 0,
          partially_settled_outstanding: Number(data.partially_settled_outstanding) || 0,
          settled_count: data.settled_count || 0,
        });
      }
    } catch (err) {
      console.error("Failed to fetch credits:", err);
    } finally {
      setLoadingCredits(false);
    }
  }, [reportType, reportDate]);

  // Fetch credit settlements for the order details table (reusing history endpoint)
  const fetchCreditSettlementsForPeriod = useCallback(async () => {
    setLoadingSettlements(true);
    try {
      let url = "";
      if (reportType === "daily") {
        url = `${API_URL}/api/history/orders?date=${reportDate}&limit=500`;
      } else if (reportType === "weekly") {
        const { start, end } = getWeekRange(reportDate);
        url = `${API_URL}/api/history/orders?from=${start}&to=${end}&limit=500`;
      } else {
        const monthValue = reportDate.substring(0, 7);
        const year = parseInt(monthValue.split('-')[0]);
        const month = parseInt(monthValue.split('-')[1]);
        const start = `${year}-${String(month).padStart(2,'0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const end = `${year}-${String(month).padStart(2,'0')}-${lastDay}`;
        url = `${API_URL}/api/history/orders?from=${start}&to=${end}&limit=500`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const settlements = data.filter(item => item.type === 'credit_settlement');
        setCreditSettlementsList(settlements);
      } else {
        setCreditSettlementsList([]);
      }
    } catch (err) {
      console.error("Failed to fetch credit settlements:", err);
      setCreditSettlementsList([]);
    } finally {
      setLoadingSettlements(false);
    }
  }, [reportType, reportDate]);

  const fetchStaffPerformance = useCallback(async () => {
    setLoadingStaffData(true);
    try {
      const response = await fetch(`${API_URL}/api/manager/staff-performance/monthly?month=${targetMonth}`);
      if (response.ok) {
        const data = await response.json();
        setStaffPerformanceData(data);
      }
    } catch (err) {
      console.error("Failed to fetch staff performance:", err);
    } finally {
      setLoadingStaffData(false);
    }
  }, [targetMonth]);

  useEffect(() => {
    fetchTargetProgress();
    fetchMonthlyCreditSettled();
    fetchStaffPerformance();
  }, [fetchTargetProgress, fetchMonthlyCreditSettled, fetchStaffPerformance]);

  useEffect(() => {
    fetchPettyCashForDate(reportDate);
    fetchCreditsForPeriod();
    fetchCreditSettlementsForPeriod();
  }, [reportDate, reportType, fetchPettyCashForDate, fetchCreditsForPeriod, fetchCreditSettlementsForPeriod]);

  useEffect(() => {
    if (refreshData) refreshData();
  }, [refreshData]);

  // ─── Build a set of order IDs that are referenced as source orders (use allOrders) ──────────
  const referencedSourceIds = useMemo(() => {
    const ids = new Set();
    allOrders.forEach(order => {
      if (!order.original_order_ids) return;
      let sourceIds = order.original_order_ids;
      if (typeof sourceIds === 'string') {
        try { sourceIds = JSON.parse(sourceIds); } catch { return; }
      }
      if (Array.isArray(sourceIds)) {
        sourceIds.forEach(id => ids.add(Number(id)));
      }
    });
    return ids;
  }, [allOrders]);

  // ─── REPORT DATA (choose source based on reportType) ──────────────────
  const reportData = useMemo(() => {
    // Choose order source: daily uses filteredOrders, weekly/monthly use allOrders
    const sourceOrders = reportType === "daily" ? filteredOrders : allOrders;

    const orderKampalaDate = (order) => {
      const raw = order.timestamp || order.date || order.created_at;
      if (!raw) return null;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };

    let dateFilteredOrders = [];
    try {
      sourceOrders.forEach(order => {
        if (referencedSourceIds.has(Number(order.id))) return;
        if (!includeOrderInReport(order)) return;

        const kDate = orderKampalaDate(order);
        if (!kDate) return;

        if (reportType === "daily") {
          if (kDate === reportDate) dateFilteredOrders.push(order);
        } else if (reportType === "weekly") {
          const { start, end } = getWeekRange(reportDate);
          if (kDate >= start && kDate <= end) dateFilteredOrders.push(order);
        } else {
          const targetMonthStr = reportDate.substring(0, 7);
          if (kDate.substring(0, 7) === targetMonthStr) dateFilteredOrders.push(order);
        }
      });
    } catch (err) {
      console.error("Date filtering error:", err);
      dateFilteredOrders = [];
    }

    let filteredOrdersBySearch = dateFilteredOrders;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredOrdersBySearch = filteredOrdersBySearch.filter(order =>
        (order.table_name || "").toLowerCase().includes(q) ||
        (order.staff_name || order.waiter_name || "").toLowerCase().includes(q) ||
        String(order.id || "").includes(q)
      );
    }

    const enrichedOrders = filteredOrdersBySearch.map(order => {
      const resolvedItems = resolveItems(order, allOrders);
      return {
        ...order,
        display_total: getOrderDisplayTotal(order),
        display_method: getDisplayPaymentMethod(order),
        items_parsed: resolvedItems,
      };
    });

    let totalGrossRevenue = 0;
    let totalCash = 0, totalMtn = 0, totalAirtel = 0, totalCard = 0;
    let totalItemsSold = 0;
    let kitchenItems = 0, baristaItems = 0, barmanItems = 0;
    const staffMap = {};

    enrichedOrders.forEach(order => {
      const amount = order.display_total;
      totalGrossRevenue += amount;

      const method = (order.display_method || "").toLowerCase();
      if (method.includes("cash"))                                                    totalCash   += amount;
      else if (method.includes("mtn"))                                                totalMtn    += amount;
      else if (method.includes("airtel"))                                             totalAirtel += amount;
      else if (method.includes("card") || method.includes("visa") || method.includes("pos")) totalCard += amount;
      else                                                                            totalCash   += amount;

      const items = order.items_parsed;
      items.forEach(item => {
        if (item.status === "VOIDED" || item.voidProcessed === true) return;
        const qty = Number(item.quantity) || 1;
        totalItemsSold += qty;

        const station  = (item.station   || "").toLowerCase();
        const category = (item.category  || "").toLowerCase();
        if (station === "barista" || category.includes("barista") || category.includes("coffee") || category.includes("tea")) {
          baristaItems += qty;
        } else if (station === "barman" || category.includes("bar") || category.includes("cocktail") || category.includes("drink") || category.includes("beer")) {
          barmanItems += qty;
        } else {
          kitchenItems += qty;
        }
      });

      const staffName = order.staff_name || order.waiter_name || "Unknown";
      if (!staffMap[staffName]) {
        staffMap[staffName] = { items: 0, revenue: 0, orderIds: [] };
      }
      staffMap[staffName].revenue += amount;
      items.forEach(item => {
        if (item.status !== "VOIDED") staffMap[staffName].items += Number(item.quantity) || 1;
      });
      if (!staffMap[staffName].orderIds.includes(order.id)) {
        staffMap[staffName].orderIds.push(order.id);
      }
    });

    const staffPerformanceArray = Object.entries(staffMap).map(([name, data]) => ({
      staff_name: name,
      ...data
    }));

    return {
      orders: enrichedOrders,
      totalTransactions: enrichedOrders.length,
      totalItemsSold,
      totalRevenue: totalGrossRevenue,
      totalCash,
      totalMtn,
      totalAirtel,
      totalCard,
      kitchenItems,
      baristaItems,
      barmanItems,
      staffPerformance: staffPerformanceArray,
      avgOrderValue: enrichedOrders.length > 0 ? totalGrossRevenue / enrichedOrders.length : 0,
      avgItemValue: totalItemsSold > 0 ? totalGrossRevenue / totalItemsSold : 0,
    };
  }, [filteredOrders, allOrders, reportDate, reportType, searchQuery, referencedSourceIds]);

  const periodTotalRevenue = reportData.totalRevenue + (creditsData.settled_amount || 0);

  const getDateRangeText = () => {
    try {
      if (reportType === "daily") {
        const [year, month, day] = reportDate.split('-');
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      } else if (reportType === "weekly") {
        const { start, end } = getWeekRange(reportDate);
        const [sy, sm, sd] = start.split('-');
        const [ey, em, ed] = end.split('-');
        const startDate = new Date(Number(sy), Number(sm)-1, Number(sd));
        const endDate   = new Date(Number(ey), Number(em)-1, Number(ed));
        return `${startDate.toLocaleDateString("en-GB", { day:"numeric", month:"short" })} - ${endDate.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}`;
      } else {
        const [year, month] = reportDate.split('-');
        const date = new Date(Number(year), Number(month) - 1, 1);
        return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      }
    } catch {
      return reportDate;
    }
  };

  // ✅ FIXED: Always allow PDF generation (backend has data even if frontend table empty)
  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      let url = "", filename = "";
      const timeParams = `${startTime ? `&start_time=${startTime}` : ''}${endTime ? `&end_time=${endTime}` : ''}`;
      if (reportType === "daily") {
        url = `${API_URL}/api/manager/export-pdf?type=daily&date=${reportDate}${timeParams}`;
        filename = `Kurax_Daily_Report_${reportDate}${startTime ? `_${startTime.replace(':', '-')}` : ''}${endTime ? `_to_${endTime.replace(':', '-')}` : ''}.pdf`;
      } else if (reportType === "weekly") {
        url = `${API_URL}/api/manager/export-pdf?type=weekly&date=${reportDate}${timeParams}`;
        filename = `Kurax_Weekly_Report_${reportDate}${startTime ? `_${startTime.replace(':', '-')}` : ''}${endTime ? `_to_${endTime.replace(':', '-')}` : ''}.pdf`;
      } else {
        const monthValue = reportDate.substring(0, 7);
        url = `${API_URL}/api/manager/export-pdf?type=monthly&month=${monthValue}${timeParams}`;
        filename = `Kurax_Monthly_Report_${monthValue}${startTime ? `_${startTime.replace(':', '-')}` : ''}${endTime ? `_to_${endTime.replace(':', '-')}` : ''}.pdf`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      console.error("PDF Generation Error:", e);
      alert(`Failed to generate PDF: ${e.message}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const generateStaffPerformancePDF = async () => {
    if (!staffPerformanceData || !staffPerformanceData.staff || staffPerformanceData.staff.length === 0) {
      alert("No staff performance data available.");
      return;
    }
    setIsGeneratingStaffPDF(true);
    try {
      const timeParams = `${startTime ? `&start_time=${startTime}` : ''}${endTime ? `&end_time=${endTime}` : ''}`;
      const url = `${API_URL}/api/manager/export-staff-pdf?month=${targetMonth}${timeParams}`;
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `Kurax_Staff_Performance_${targetMonth}${startTime ? `_${startTime.replace(':', '-')}` : ''}${endTime ? `_to_${endTime.replace(':', '-')}` : ''}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      } else {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        alert(error.error || "Failed to generate staff report");
      }
    } catch (e) {
      console.error("Staff PDF Error:", e);
      alert("Network error during PDF generation.");
    } finally {
      setIsGeneratingStaffPDF(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    fetchTargetProgress();
    fetchMonthlyCreditSettled();
    fetchCreditsForPeriod();
    fetchPettyCashForDate(reportDate);
    fetchStaffPerformance();
    fetchCreditSettlementsForPeriod();
  };

  const cardClass = isDark ? "bg-zinc-900/40 border-white/5 shadow-2xl" : "bg-white border-black/5 shadow-xl";
  const mutedClass = isDark ? "text-zinc-500" : "text-zinc-400";

  const getProgressColor = (percentage) => {
    if (percentage >= 75) return "text-emerald-500";
    if (percentage >= 50) return "text-yellow-500";
    if (percentage >= 25) return "text-orange-500";
    return "text-red-500";
  };

  // Monthly target ring: use allOrders (so it never clears)
  const monthlyGrossSales = useMemo(() => {
    return allOrders
      .filter(order => {
        if (referencedSourceIds.has(Number(order.id))) return false;
        if (!includeOrderInReport(order)) return false;
        const raw = order.timestamp || order.date || order.created_at;
        if (!raw) return false;
        const d = new Date(raw);
        const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        return ym === targetMonth;
      })
      .reduce((sum, o) => sum + getOrderDisplayTotal(o), 0);
  }, [allOrders, targetMonth, referencedSourceIds]);

  const totalMonthlyRevenue = monthlyGrossSales + monthlyCreditSettled;
  const totalMonthlyRemaining = Math.max(targetProgress.target - totalMonthlyRevenue, 0);
  const monthlyProgressPercent = targetProgress.target > 0 ? (totalMonthlyRevenue / targetProgress.target) * 100 : 0;

  return (
    <div className={`p-4 md:p-8 min-h-screen font-[Outfit] transition-colors duration-300 ${isDark ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'}`}>
      <div className="max-w-7xl mx-auto space-y-8">
        
        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
            <AlertCircle size={20} className="text-red-400" />
            <p className="text-sm font-bold text-red-400">{error}</p>
            <button onClick={handleRetry} className="ml-auto px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-black flex items-center gap-1">
              <RefreshCw size={10} /> Retry
            </button>
          </div>
        )}

        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter flex items-center gap-3">
              <Target className="text-yellow-500" size={32} />
              Performance Analytics
            </h1>
            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${mutedClass}`}>
              Set Monthly Goals & Track Revenue (Gross Sales + Credit Settlements)
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleRetry} className={`px-4 py-3 rounded-2xl font-black uppercase text-[10px] flex items-center gap-2 border ${isDark ? "border-white/10 hover:bg-white/5" : "border-black/10 hover:bg-black/5"}`}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={generateStaffPerformancePDF} disabled={isGeneratingStaffPDF || loadingStaffData} className="px-5 py-3 bg-purple-500 text-white rounded-2xl font-black uppercase text-[10px] flex items-center gap-2 hover:bg-purple-400 disabled:opacity-50">
              {isGeneratingStaffPDF ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Users size={14} /> Staff Report</>}
            </button>
          </div>
        </div>

        {/* MONTHLY TARGET SETTING CARD */}
        <div className={`p-6 rounded-2xl border ${cardClass}`}>
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-500/10"><Target size={24} className="text-yellow-500" /></div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${mutedClass}`}>Monthly Revenue Goal</p>
                <h2 className="text-xl font-black italic">{monthLabel}</h2>
                {currentTarget > 0 && <p className="text-[9px] text-emerald-500 mt-1">Target: {fmtUGX(currentTarget)}</p>}
              </div>
            </div>
            <div className="flex gap-3 flex-wrap items-center">
              <input type="month" value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} className={`px-3 py-2 rounded-xl text-xs font-black border outline-none ${isDark ? "bg-zinc-800 border-zinc-700 text-white" : "bg-white border-gray-300"}`} />
              <div className="flex gap-2">
                <input type="number" value={editTargetValue} onChange={(e) => setEditTargetValue(e.target.value)} placeholder="Target amount UGX" className={`px-4 py-3 rounded-xl font-black text-sm w-48 border outline-none ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-300"}`} />
                <button onClick={saveTarget} disabled={savingTarget} className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-black uppercase text-[10px] flex items-center gap-2 hover:bg-yellow-400 disabled:opacity-50">
                  {savingTarget ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Set Target
                </button>
              </div>
            </div>
          </div>
          {currentTarget > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex justify-between text-[9px] font-black uppercase">
                <span className={mutedClass}>Progress (Gross Sales + Credit Settlements)</span>
                <span className="text-yellow-500">{monthlyProgressPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${Math.min(monthlyProgressPercent, 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* TWO COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly target ring */}
          <div className={`p-6 rounded-2xl border relative overflow-hidden ${cardClass}`}>
            <Lock className="absolute -right-4 -top-4 text-white/5 w-24 h-24 rotate-12" />
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${mutedClass}`}>Monthly Target</p>
                <h3 className="text-2xl font-black tracking-tighter italic">{loadingTarget ? <Loader2 size={18} className="animate-spin text-yellow-500" /> : fmtUGX(targetProgress.target)}</h3>
              </div>
              <div className="flex items-center gap-2"><Calendar size={14} className={mutedClass} /><span className="text-[9px] font-black">{targetMonth}</span></div>
            </div>
            <div className="flex items-center gap-6 mb-6">
              <div className="relative flex-shrink-0" style={{ width: 140, height: 140 }}>
                <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
                  <defs><linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#EAB308" /><stop offset="60%" stopColor="#CA8A04" /><stop offset="100%" stopColor={isDark ? "#3f3f46" : "#27272a"} /></linearGradient></defs>
                  <circle cx="70" cy="70" r="54" fill="none" stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="11" />
                  <circle cx="70" cy="70" r="54" fill="none" stroke="url(#ringGrad)" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 54}`} strokeDashoffset={`${2 * Math.PI * 54 * (1 - Math.min(monthlyProgressPercent, 100) / 100)}`} style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                  <span className={`text-2xl font-black italic ${getProgressColor(monthlyProgressPercent)}`}>{monthlyProgressPercent.toFixed(0)}%</span>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>done</span>
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <div className="p-3 rounded-xl border-l-2 border-emerald-500 bg-white/5"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Total Revenue (Gross + Settlements)</p><p className="text-sm font-black italic text-emerald-500">{fmtUGX(totalMonthlyRevenue)}</p></div>
                <div className="p-3 rounded-xl border-l-2 border-yellow-500 bg-white/5"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Target</p><p className="text-sm font-black italic text-yellow-500">{fmtUGX(targetProgress.target)}</p></div>
                <div className="p-3 rounded-xl border-l-2 border-white/20 bg-white/5"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Remaining</p><p className="text-sm font-black italic text-zinc-500">{fmtUGX(totalMonthlyRemaining)}</p></div>
              </div>
            </div>
            <div className="flex gap-2 pt-4 border-t border-white/10">
              {monthlyProgressPercent >= 100 && <div className="flex-1 flex items-center justify-center gap-1 bg-emerald-500/10 rounded-xl p-2"><CheckCircle2 size={10} className="text-emerald-500" /><span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Goal Met</span></div>}
            </div>
          </div>

          {/* Insights card */}
          <div className={`p-6 rounded-2xl border ${cardClass}`}>
            <div className="flex items-center gap-2 mb-4"><div className="p-2 rounded-xl bg-yellow-500/10"><TrendingUp size={16} className="text-yellow-500" /></div><p className="text-[10px] font-black uppercase tracking-widest text-yellow-500">{reportType === "daily" ? "Selected Day's Insights" : reportType === "weekly" ? "Week Insights" : "Month Insights"}</p>{loadingPettyCash && <Loader2 size={12} className="animate-spin ml-auto" />}</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20"><div className="flex items-center gap-2 mb-2"><DollarSign size={14} className="text-emerald-400" /><p className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>Gross Revenue</p></div><p className="text-xl font-black italic text-emerald-400">{fmtUGX(reportData.totalRevenue)}</p><p className="text-[7px] text-zinc-500 mt-1">For selected {reportType}</p></div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20"><div className="flex items-center gap-2 mb-2"><Wallet size={14} className="text-red-400" /><p className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>Petty OUT</p></div><p className="text-xl font-black italic text-red-400">{fmtUGX(pettyCashData.total_out)}</p><p className="text-[7px] text-zinc-500 mt-1">For selected {reportType}</p></div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20"><div className="flex items-center gap-2 mb-2"><ArrowUpCircle size={14} className="text-emerald-400" /><p className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>Petty IN</p></div><p className="text-xl font-black italic text-emerald-400">{fmtUGX(pettyCashData.total_in)}</p><p className="text-[7px] text-zinc-500 mt-1">Replenishment</p></div>
              <div className={`p-4 rounded-xl bg-gradient-to-br ${pettyCashData.net >= 0 ? 'from-emerald-500/10' : 'from-red-500/10'} to-transparent border ${pettyCashData.net >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}`}><div className="flex items-center gap-2 mb-2"><Activity size={14} className={pettyCashData.net >= 0 ? 'text-emerald-400' : 'text-red-400'} /><p className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>Net Position</p></div><p className={`text-xl font-black italic ${pettyCashData.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pettyCashData.net >= 0 ? '+' : ''}{fmtUGX(pettyCashData.net)}</p><p className="text-[7px] text-zinc-500 mt-1">IN - OUT</p></div>
            </div>
          </div>
        </div>

        {/* Report section */}
        <div className={`p-6 rounded-2xl border ${cardClass}`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
            <div className="flex items-center gap-4"><div className="p-3 rounded-xl bg-yellow-500/10"><FileText size={20} className="text-yellow-500" /></div><div><p className={`text-[10px] font-black uppercase tracking-widest ${mutedClass}`}>Reports</p><h2 className="text-lg font-black italic uppercase">Transaction Reports</h2><p className={`text-[9px] mt-1 ${mutedClass}`}>Generate detailed business insights</p></div></div>
            <div className="flex gap-3 flex-wrap">
              <div className={`flex rounded-xl border p-1 ${isDark ? "border-white/10" : "border-gray-200"}`}>
                {[
                  { key: "daily",   label: "Daily",   icon: <Calendar size={12} /> },
                  { key: "weekly",  label: "Weekly",  icon: <Clock size={12} /> },
                  { key: "monthly", label: "Monthly", icon: <Target size={12} /> }
                ].map(({ key, label, icon }) => (
                  <button key={key} onClick={() => {
                    setReportType(key);
                    const today = new Date();
                    if (key === "monthly") {
                      setReportDate(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`);
                    } else {
                      setReportDate(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`);
                    }
                  }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-200 ${reportType === key ? "bg-yellow-500 text-black" : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}>{icon}{label}</button>
                ))}
              </div>
              <input type={reportType === "monthly" ? "month" : "date"} value={reportDate} onChange={(e) => setReportDate(e.target.value)} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase border outline-none ${isDark ? "bg-zinc-800/50 border-zinc-700 text-white" : "bg-zinc-100 border-zinc-200 text-zinc-900"}`} />
              
              {/* Time pickers */}
              <input
                type="time"
                value={startTime || ""}
                onChange={(e) => setStartTime(e.target.value)}
                className={`px-3 py-2 rounded-xl font-black text-[10px] uppercase border outline-none ${isDark ? "bg-zinc-800/50 border-zinc-700 text-white" : "bg-zinc-100 border-zinc-200 text-zinc-900"}`}
                step="60"
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={`px-3 py-2 rounded-xl font-black text-[10px] uppercase border outline-none ${isDark ? "bg-zinc-800/50 border-zinc-700 text-white" : "bg-zinc-100 border-zinc-200 text-zinc-900"}`}
              />
            </div>
          </div>

          <div className={`mb-6 p-3 rounded-xl text-center ${isDark ? "bg-white/5" : "bg-black/5"}`}>
            <p className="text-[10px] font-black uppercase tracking-widest">{reportType.toUpperCase()} REPORT · {getDateRangeText()}</p>
          </div>
          
          {/* Total Revenue Hero */}
          <div className="mb-6 p-5 rounded-2xl border-2 border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-emerald-500/5 relative overflow-hidden">
            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px' }} />
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <PlusCircle size={14} className="text-yellow-500" />
                  <p className={`text-[9px] font-black uppercase tracking-widest ${mutedClass}`}>Total Revenue · {getDateRangeText()}</p>
                  <span title="Gross Sales (confirmed payment records) + Credit Settlements collected in this period" className="cursor-help"><Info size={11} className="text-zinc-400" /></span>
                </div>
                <p className="text-3xl font-black italic text-yellow-500">
                  {loadingCredits ? <span className="flex items-center gap-2 text-base"><Loader2 size={16} className="animate-spin" /> Calculating...</span> : fmtUGX(periodTotalRevenue)}
                </p>
              </div>
              <div className="flex gap-3 flex-wrap">
                <div className={`px-4 py-2 rounded-xl ${isDark ? "bg-white/5" : "bg-black/[0.04]"}`}><p className={`text-[7px] font-black uppercase tracking-widest ${mutedClass}`}>Gross Sales</p><p className="text-sm font-black text-emerald-400">{fmtUGX(reportData.totalRevenue)}</p></div>
                <div className="flex items-center"><span className={`text-lg font-black ${mutedClass}`}>+</span></div>
                <div className={`px-4 py-2 rounded-xl ${isDark ? "bg-white/5" : "bg-black/[0.04]"}`}><p className={`text-[7px] font-black uppercase tracking-widest ${mutedClass}`}>Credit Settled</p><p className="text-sm font-black text-blue-400">{loadingCredits ? "..." : fmtUGX(creditsData.settled_amount)}</p></div>
                <div className="flex items-center"><span className={`text-lg font-black ${mutedClass}`}>=</span></div>
                <div className="px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30"><p className="text-[7px] font-black uppercase tracking-widest text-yellow-600">Total</p><p className="text-sm font-black text-yellow-500">{loadingCredits ? "..." : fmtUGX(periodTotalRevenue)}</p></div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCardSmall label="Total Orders"    value={reportData.totalTransactions} icon={<Receipt size={14} />}      color="text-yellow-500"  isDark={isDark} />
            <StatCardSmall label="Items Sold"      value={reportData.totalItemsSold}    icon={<ShoppingBag size={14} />}   color="text-blue-400"    isDark={isDark} />
            <StatCardSmall label="Gross Revenue"   value={fmtUGX(reportData.totalRevenue)} icon={<Banknote size={14} />}  color="text-emerald-400" isDark={isDark} tooltip="Confirmed payment records only (Cash + Card + Mobile Money). Excludes credit settlements and source/kitchen orders." />
            <StatCardSmall label="Credits Settled" value={loadingCredits ? "..." : fmtUGX(creditsData.settled_amount)} icon={<CheckCircle2 size={14} />} color="text-emerald-400" isDark={isDark} />
          </div>

          {/* Payment Methods */}
          <div className="mb-6">
            <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${mutedClass}`}>Payment Methods</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <PaymentMethodCard label="Cash"     value={fmtUGX(reportData.totalCash)}   color="emerald" isDark={isDark} />
              <PaymentMethodCard label="MTN Momo" value={fmtUGX(reportData.totalMtn)}    color="yellow"  isDark={isDark} />
              <PaymentMethodCard label="Airtel"   value={fmtUGX(reportData.totalAirtel)} color="red"     isDark={isDark} />
              <PaymentMethodCard label="Card/POS" value={fmtUGX(reportData.totalCard)}   color="blue"    isDark={isDark} />
            </div>
          </div>

          {/* Credits Summary */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <p className={`text-[10px] font-black uppercase tracking-widest ${mutedClass}`}>Credits Summary</p>
              {loadingCredits && <Loader2 size={10} className="animate-spin" />}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <CreditSummaryCard label="Total Credits"                  value={fmtUGX(creditsData.total_credits)}                  count="All"       color="purple" isDark={isDark} />
              <CreditSummaryCard label="Settled"                        value={fmtUGX(creditsData.settled_amount)}                  count={creditsData.settled_count} color="green" isDark={isDark} />
              <CreditSummaryCard label="Outstanding"                    value={fmtUGX(creditsData.outstanding_amount)}              count="Due"       color="orange" isDark={isDark} />
              <CreditSummaryCard label="Partially Settled Outstanding"  value={fmtUGX(creditsData.partially_settled_outstanding)}   count="Remaining" color="yellow" isDark={isDark} />
            </div>
          </div>

          {/* Search & Orders Table */}
          <div className="mb-4">
            <div className="relative mb-3">
              <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${mutedClass}`} />
              <input type="text" placeholder="Search by table, waiter, or order ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs font-bold outline-none border ${isDark ? "bg-zinc-800/50 border-white/10 focus:border-yellow-500/50 text-white" : "bg-zinc-100 border-black/10 focus:border-yellow-500 text-zinc-900"}`} />
            </div>
            <button onClick={() => setExpandedOrders(!expandedOrders)} className={`w-full flex items-center justify-between p-3 rounded-xl ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10"}`}>
              <div className="flex items-center gap-2">
                <Receipt size={14} className="text-yellow-500" />
                <span className="text-[9px] font-black uppercase tracking-widest">Order Details</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${isDark ? "bg-white/10" : "bg-black/10"}`}>{reportData.orders.length}</span>
              </div>
              {expandedOrders ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {expandedOrders && (
            <div className="mb-6 overflow-x-auto max-h-96 overflow-y-auto">
              {reportData.orders.length === 0 && creditSettlementsList.length === 0 ? (
                <div className="py-12 text-center">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${mutedClass}`}>No transactions found</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className={`sticky top-0 ${isDark ? "bg-black" : "bg-white"}`}>
                    <tr className={`border-b ${isDark ? "border-white/10" : "border-black/10"}`}>
                      <th className="p-2 text-[8px] font-black uppercase tracking-widest">ID</th>
                      <th className="p-2 text-[8px] font-black uppercase tracking-widest">Table</th>
                      <th className="p-2 text-[8px] font-black uppercase tracking-widest">Waiter</th>
                      <th className="p-2 text-[8px] font-black uppercase tracking-widest text-right">Amount</th>
                      <th className="p-2 text-[8px] font-black uppercase tracking-widest">Method</th>
                      <th className="p-2 text-[8px] font-black uppercase tracking-widest">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const allEntries = [
                        ...reportData.orders.map(order => ({
                          ...order,
                          _type: 'order',
                          _date: order.timestamp || order.date || order.created_at,
                          _displayAmount: order.display_total,
                          _displayMethod: order.display_method,
                          _staffName: order.staff_name || order.waiter_name || "—",
                          _tableName: order.table_name,
                          _id: order.id,
                        })),
                        ...creditSettlementsList.map(settlement => ({
                          ...settlement,
                          _type: 'settlement',
                          _date: settlement.date,
                          _displayAmount: settlement.amount,
                          _displayMethod: settlement.method,
                          _staffName: settlement.staff_name,
                          _tableName: settlement.table_name,
                          _id: settlement.source_id,
                        })),
                      ];
                      allEntries.sort((a, b) => new Date(b._date) - new Date(a._date));
                      const displayEntries = allEntries.slice(0, 100);
                      return displayEntries.map((entry, idx) => {
                        const waiterName = entry._staffName;
                        return (
                          <tr key={`${entry._type}_${entry._id}`} className={`border-b ${isDark ? "border-white/5" : "border-black/5"}`}>
                            <td className="p-2 font-mono text-[9px]">#{formatOrderId(entry._id)}</td>
                            <td className="p-2 font-bold text-[9px]">{entry._tableName || "—"}</td>
                            <td className="p-2 text-[9px]">{waiterName}</td>
                            <td className="p-2 text-[9px] font-bold text-right text-emerald-400">{fmtUGX(entry._displayAmount)}</td>
                            <td className="p-2 text-[9px]">{entry._displayMethod || "—"}</td>
                            <td className="p-2 text-[9px]">{formatTime(entry._date)}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ✅ FIXED: Button always enabled – only disabled while generating */}
          <button onClick={generatePDF} disabled={isGeneratingPDF} className="w-full py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-2xl font-black uppercase italic text-xs flex items-center justify-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-20 shadow-xl">
            {isGeneratingPDF ? <><Loader2 size={16} className="animate-spin" /> Generating PDF...</> : <><Printer size={16} /> Download PDF Report</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SUB-COMPONENTS (unchanged) ───────────────────────────────────────────────
function StatCardSmall({ label, value, icon, color, isDark, tooltip = "" }) {
  return (
    <div className={`p-3 rounded-xl transition-all duration-200 hover:scale-[1.02] ${isDark ? "bg-white/5" : "bg-black/5"}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <div className="flex items-center gap-1">
          <p className={`text-[7px] font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-gray-500"}`}>{label}</p>
          {tooltip && <span title={tooltip} className="cursor-help"><Info size={10} className="text-zinc-400" /></span>}
        </div>
      </div>
      <p className={`text-sm font-black italic ${color}`}>{value}</p>
    </div>
  );
}

function PaymentMethodCard({ label, value, color }) {
  const colorMap = {
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    yellow:  "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    red:     "bg-red-500/10 border-red-500/20 text-red-400",
    blue:    "bg-blue-500/10 border-blue-500/20 text-blue-400"
  };
  return (
    <div className={`p-3 rounded-xl border transition-all duration-200 hover:scale-[1.02] ${colorMap[color]}`}>
      <p className="text-[8px] font-black uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xs font-black">{value}</p>
    </div>
  );
}

function CreditSummaryCard({ label, value, count, color }) {
  const colorMap = {
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    green:  "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    orange: "bg-orange-500/10 border-orange-500/20 text-orange-400"
  };
  return (
    <div className={`p-3 rounded-xl border transition-all duration-200 hover:scale-[1.02] ${colorMap[color]}`}>
      <p className="text-[7px] font-black uppercase tracking-widest mb-1">{label}</p>
      <p className="text-sm font-black">{value}</p>
      <p className="text-[8px] opacity-70 mt-1">{count || 0} record{count !== 1 ? 's' : ''}</p>
    </div>
  );
}