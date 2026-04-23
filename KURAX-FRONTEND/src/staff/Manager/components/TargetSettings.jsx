import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import API_URL from "../../../config/api";
import { 
  Target, TrendingUp, ShoppingBag, 
  Calendar, Download, FileText, Lock, CheckCircle2, Loader2,
  Users, Clock, Banknote, CreditCard, Smartphone, Receipt,
  Printer, ChevronDown, ChevronUp, Search, Wallet,
  Activity, DollarSign, ArrowUpCircle, AlertCircle, RefreshCw
} from "lucide-react";

// --- HELPERS ---
function fmtUGX(n) {
  return `UGX ${Number(n || 0).toLocaleString()}`;
}

function formatTime(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatOrderId(id) {
  if (!id) return "—";
  const idStr = String(id);
  return idStr.length > 6 ? idStr.slice(-6) : idStr;
}

// CRITICAL FIX: Get Kampala date (EAT UTC+3) without timezone conversion issues
function getKampalaDate(date = new Date()) {
  const d = new Date(date);
  // Extract local date parts - this uses the browser's local timezone
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Alternative: using toLocaleDateString (also works)
function getKampalaDateAlt(date = new Date()) {
  return new Date(date.toLocaleString("en-US", { timeZone: "Africa/Nairobi" }))
    .toISOString().split('T')[0];
}

export default function TargetSettings() {
  const { 
    monthlyTargets = {}, 
    orders = [], 
    todaySummary,
    refreshData 
  } = useData() || {};
  const { theme } = useTheme();

  const isDark = theme === 'dark';
  
  // --- Report State - FIXED: Initialize with today's Kampala date ---
  const [reportDate, setReportDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [expandedOrders, setExpandedOrders] = useState(false);
  const [reportType, setReportType] = useState("daily");
  const [searchQuery, setSearchQuery] = useState("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingStaffPDF, setIsGeneratingStaffPDF] = useState(false);
  const [staffPerformanceData, setStaffPerformanceData] = useState(null);
  const [loadingStaffData, setLoadingStaffData] = useState(false);

  // --- Director's Revenue Target Display ---
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });
  const [targetProgress, setTargetProgress] = useState({ target: 0, current: 0, percentage: 0, todayRevenue: 0 });
  const [loadingTarget, setLoadingTarget] = useState(true);
  
  // --- Petty Cash Data ---
  const [pettyCashData, setPettyCashData] = useState({ total_out: 0, total_in: 0, net: 0 });
  const [loadingPettyCash, setLoadingPettyCash] = useState(false);
  
  // --- Credits Data ---
  const [creditsData, setCreditsData] = useState({ 
    total_credits: 0, 
    approved_amount: 0, 
    settled_amount: 0, 
    pending_amount: 0,
    rejected_amount: 0,
    outstanding_amount: 0,
    partially_settled_outstanding: 0,
    approved_count: 0,
    settled_count: 0,
    pending_count: 0,
    rejected_count: 0,
    partially_settled_count: 0
  });
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [error, setError] = useState(null);

  // Helper: get week start/end from a date string using Kampala timezone
  const getWeekRange = (dateStr) => {
    // Parse the date string as local date (YYYY-MM-DD)
    const [year, month, day] = dateStr.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day);
    const dayOfWeek = selectedDate.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(selectedDate);
    weekStart.setDate(selectedDate.getDate() - diff);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const startYear = weekStart.getFullYear();
    const startMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
    const startDay = String(weekStart.getDate()).padStart(2, '0');
    const endYear = weekEnd.getFullYear();
    const endMonth = String(weekEnd.getMonth() + 1).padStart(2, '0');
    const endDay = String(weekEnd.getDate()).padStart(2, '0');
    
    return {
      start: `${startYear}-${startMonth}-${startDay}`,
      end: `${endYear}-${endMonth}-${endDay}`
    };
  };

  // Fetch target progress from backend
  const fetchTargetProgress = useCallback(async () => {
    setLoadingTarget(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/manager/target-progress?month=${selectedMonth}`);
      if (response.ok) {
        const data = await response.json();
        setTargetProgress({
          target: data.target || 0,
          current: data.current || 0,
          percentage: data.percentage || 0,
          todayRevenue: data.todayRevenue || 0
        });
      } else {
        const errorText = await response.text();
        console.error("Target progress failed:", response.status, errorText);
        setError(`Failed to load target progress: ${response.status}`);
      }
    } catch (err) {
      console.error("Failed to fetch target progress:", err);
      setError(`Network error: ${err.message}`);
    } finally {
      setLoadingTarget(false);
    }
  }, [selectedMonth]);

  // Fetch petty cash
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
      } else {
        console.error("Petty cash fetch failed:", response.status);
      }
    } catch (err) {
      console.error("Failed to fetch petty cash:", err);
    } finally {
      setLoadingPettyCash(false);
    }
  }, [reportType]);

  // Fetch credits for the selected period
  const fetchCreditsForPeriod = useCallback(async () => {
    setLoadingCredits(true);
    try {
      let url = "";
      if (reportType === "daily") {
        url = `${API_URL}/api/manager/credits-summary?period=daily&date=${reportDate}`;
      } else if (reportType === "weekly") {
        const { start, end } = getWeekRange(reportDate);
        url = `${API_URL}/api/manager/credits-summary?period=weekly&startDate=${start}&endDate=${end}`;
      } else if (reportType === "monthly") {
        url = `${API_URL}/api/manager/credits-summary?period=monthly&month=${reportDate.substring(0, 7)}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        
        const approvedAmount = Number(data.approved_amount) || 0;
        const pendingAmount = Number(data.pending_amount) || 0;
        const partiallySettledOutstanding = Number(data.partially_settled_outstanding) || 0;
        const totalOutstanding = approvedAmount + pendingAmount + partiallySettledOutstanding;
        
        setCreditsData({
          total_credits: data.total_credits || 0,
          approved_amount: approvedAmount,
          settled_amount: Number(data.settled_amount) || 0,
          pending_amount: pendingAmount,
          rejected_amount: Number(data.rejected_amount) || 0,
          outstanding_amount: totalOutstanding,
          partially_settled_outstanding: partiallySettledOutstanding,
          approved_count: data.approved_count || 0,
          settled_count: data.settled_count || 0,
          pending_count: data.pending_count || 0,
          rejected_count: data.rejected_count || 0,
          partially_settled_count: data.partially_settled_count || 0
        });
        
        console.log("Credits data loaded:", {
          approved: approvedAmount,
          pending: pendingAmount,
          partiallyOutstanding: partiallySettledOutstanding,
          totalOutstanding: totalOutstanding
        });
      } else {
        const errorText = await response.text();
        console.error("Credits fetch failed:", response.status, errorText);
      }
    } catch (err) {
      console.error("Failed to fetch credits:", err);
    } finally {
      setLoadingCredits(false);
    }
  }, [reportType, reportDate]);

  // Fetch staff performance data
  const fetchStaffPerformance = useCallback(async () => {
    setLoadingStaffData(true);
    try {
      const response = await fetch(`${API_URL}/api/manager/staff-performance/monthly?month=${selectedMonth}`);
      if (response.ok) {
        const data = await response.json();
        setStaffPerformanceData(data);
      } else {
        console.error("Staff performance fetch failed:", response.status);
      }
    } catch (err) {
      console.error("Failed to fetch staff performance:", err);
    } finally {
      setLoadingStaffData(false);
    }
  }, [selectedMonth]);

  // Re-fetch target and staff when selectedMonth changes
  useEffect(() => {
    fetchTargetProgress();
    fetchStaffPerformance();
  }, [fetchTargetProgress, fetchStaffPerformance]);

  // Re-fetch petty cash and credits when report date or type changes
  useEffect(() => {
    fetchPettyCashForDate(reportDate);
    fetchCreditsForPeriod();
  }, [reportDate, reportType, fetchPettyCashForDate, fetchCreditsForPeriod]);

  // Refresh context data on mount
  useEffect(() => {
    if (refreshData) refreshData();
  }, [refreshData]);

  // --- Comprehensive Report Data using orders from context - FIXED DATE HANDLING ---
  const reportData = useMemo(() => {
    let filteredOrders = [];
    
    // Normalize status for comparison (handle mixed casing)
    const isPaidOrder = (order) => {
      const status = (order.status || "").toLowerCase();
      return (
        order.is_archived === true ||
        status === "paid" ||
        status === "closed" ||
        status === "confirmed" ||
        status === "credit"
      );
    };

    try {
      if (reportType === "daily") {
        // CRITICAL FIX: Compare dates using Kampala timezone
        filteredOrders = orders.filter(order => {
          const orderDate = order.timestamp || order.date || order.created_at;
          if (!orderDate) return false;
          
          // Convert order date to Kampala date string using local date extraction
          const d = new Date(orderDate);
          const orderYear = d.getFullYear();
          const orderMonth = String(d.getMonth() + 1).padStart(2, '0');
          const orderDay = String(d.getDate()).padStart(2, '0');
          const orderKampalaDate = `${orderYear}-${orderMonth}-${orderDay}`;
          
          return orderKampalaDate === reportDate && isPaidOrder(order);
        });
      } else if (reportType === "weekly") {
        const { start, end } = getWeekRange(reportDate);
        filteredOrders = orders.filter(order => {
          const orderDate = order.timestamp || order.date || order.created_at;
          if (!orderDate) return false;
          
          const d = new Date(orderDate);
          const orderYear = d.getFullYear();
          const orderMonth = String(d.getMonth() + 1).padStart(2, '0');
          const orderDay = String(d.getDate()).padStart(2, '0');
          const orderKampalaDate = `${orderYear}-${orderMonth}-${orderDay}`;
          
          return orderKampalaDate >= start && orderKampalaDate <= end && isPaidOrder(order);
        });
      } else if (reportType === "monthly") {
        const targetMonth = reportDate.substring(0, 7);
        filteredOrders = orders.filter(order => {
          const orderDate = order.timestamp || order.date || order.created_at;
          if (!orderDate) return false;
          
          const d = new Date(orderDate);
          const orderYear = d.getFullYear();
          const orderMonth = String(d.getMonth() + 1).padStart(2, '0');
          const orderKampalaDate = `${orderYear}-${orderMonth}`;
          
          return orderKampalaDate === targetMonth && isPaidOrder(order);
        });
      }

      // Debug logging to verify date filtering
      console.log("=== DATE FILTER DEBUG ===");
      console.log("Report type:", reportType);
      console.log("Selected date:", reportDate);
      console.log("Total orders in DB:", orders.length);
      console.log("Filtered orders count:", filteredOrders.length);
      console.log("Sample order dates (local):", orders.slice(0, 5).map(o => {
        const d = new Date(o.timestamp || o.date || o.created_at);
        return {
          id: o.id,
          original: o.timestamp || o.date || o.created_at,
          local_date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
          status: o.status,
          total: o.total
        };
      }));

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filteredOrders = filteredOrders.filter(order => 
          (order.table_name || "").toLowerCase().includes(q) ||
          (order.staff_name || order.waiter_name || "").toLowerCase().includes(q) ||
          String(order.id || "").includes(q)
        );
      }

      // Station breakdown
      let kitchenItems = 0;
      let baristaItems = 0;
      let barmanItems = 0;

      filteredOrders.forEach(order => {
        let items = order.items || [];
        if (typeof items === "string") {
          try { items = JSON.parse(items); } catch { items = []; }
        }
        if (Array.isArray(items)) {
          items.forEach(item => {
            const station = (item.station || "").toLowerCase();
            const category = (item.category || "").toLowerCase();
            const qty = Number(item.quantity) || 1;
            if (station === "barista" || category.includes("barista") || category.includes("coffee") || category.includes("tea")) {
              baristaItems += qty;
            } else if (station === "barman" || category.includes("bar") || category.includes("cocktail") || category.includes("drink") || category.includes("beer")) {
              barmanItems += qty;
            } else {
              kitchenItems += qty;
            }
          });
        }
      });

      // Payment method breakdown
      const getSumByMethod = (methodPatterns) => filteredOrders
        .filter(o => methodPatterns.some(p => (o.payment_method || "").toUpperCase().includes(p)))
        .reduce((sum, o) => sum + Number(o.total || 0), 0);

      // Staff performance
      const staffPerformance = filteredOrders.reduce((acc, order) => {
        const staffName = order.staff_name || order.waiter_name || "Unknown";
        if (!acc[staffName]) {
          acc[staffName] = { items: 0, revenue: 0, orderIds: [] };
        }
        let items = order.items || [];
        if (typeof items === "string") {
          try { items = JSON.parse(items); } catch { items = []; }
        }
        const itemCount = Array.isArray(items) ? items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0) : 1;
        acc[staffName].items += itemCount;
        acc[staffName].revenue += Number(order.total || 0);
        acc[staffName].orderIds.push(order.id);
        return acc;
      }, {});

      const totalItemsSold = filteredOrders.reduce((sum, order) => {
        let items = order.items || [];
        if (typeof items === "string") {
          try { items = JSON.parse(items); } catch { items = []; }
        }
        return sum + (Array.isArray(items) ? items.reduce((s, item) => s + (Number(item.quantity) || 1), 0) : 1);
      }, 0);

      const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

      return {
        orders: filteredOrders,
        totalTransactions: filteredOrders.length,
        totalItemsSold,
        totalRevenue,
        totalCash: getSumByMethod(['CASH']),
        totalMtn: getSumByMethod(['MTN']),
        totalAirtel: getSumByMethod(['AIRTEL']),
        totalCard: getSumByMethod(['CARD', 'POS', 'VISA']),
        totalCredit: getSumByMethod(['CREDIT']),
        kitchenItems,
        baristaItems,
        barmanItems,
        staffPerformance,
        avgOrderValue: filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0,
        avgItemValue: totalItemsSold > 0 ? totalRevenue / totalItemsSold : 0,
      };
    } catch (err) {
      console.error("Error calculating report data:", err);
      return {
        orders: [], totalTransactions: 0, totalItemsSold: 0, totalRevenue: 0,
        totalCash: 0, totalMtn: 0, totalAirtel: 0, totalCard: 0, totalCredit: 0,
        kitchenItems: 0, baristaItems: 0, barmanItems: 0, staffPerformance: {},
        avgOrderValue: 0, avgItemValue: 0,
      };
    }
  }, [orders, reportDate, reportType, searchQuery]);

  const getDateRangeText = () => {
    try {
      if (reportType === "daily") {
        const [year, month, day] = reportDate.split('-');
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      } else if (reportType === "weekly") {
        const { start, end } = getWeekRange(reportDate);
        const [startYear, startMonth, startDay] = start.split('-');
        const [endYear, endMonth, endDay] = end.split('-');
        const startDate = new Date(Number(startYear), Number(startMonth) - 1, Number(startDay));
        const endDate = new Date(Number(endYear), Number(endMonth) - 1, Number(endDay));
        return `${startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} - ${endDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
      } else {
        const [year, month] = reportDate.split('-');
        const date = new Date(Number(year), Number(month) - 1, 1);
        return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      }
    } catch {
      return reportDate;
    }
  };

  const generatePDF = async () => {
    if (reportData.orders.length === 0) {
      alert("No transactions found for the selected period.");
      return;
    }

    setIsGeneratingPDF(true);
    try {
      let url = "";
      let filename = "";
      
      if (reportType === "daily") {
        url = `${API_URL}/api/manager/export-pdf?type=daily&date=${reportDate}`;
        filename = `Kurax_Daily_Report_${reportDate}.pdf`;
      } else if (reportType === "weekly") {
        url = `${API_URL}/api/manager/export-pdf?type=weekly&date=${reportDate}`;
        filename = `Kurax_Weekly_Report_${reportDate}.pdf`;
      } else if (reportType === "monthly") {
        const monthValue = reportDate.substring(0, 7);
        url = `${API_URL}/api/manager/export-pdf?type=monthly&month=${monthValue}`;
        filename = `Kurax_Monthly_Report_${monthValue}.pdf`;
      }
      
      const res = await fetch(url);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server responded with ${res.status}: ${errorText}`);
      }
      
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
      alert("No staff performance data available for the selected month.");
      return;
    }

    setIsGeneratingStaffPDF(true);
    try {
      const url = `${API_URL}/api/manager/export-staff-pdf?month=${selectedMonth}`;
      const res = await fetch(url);
      
      if (res.ok) {
        const blob = await res.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `Kurax_Staff_Performance_${selectedMonth}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      } else {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        alert(error.error || "Failed to generate staff report");
      }
    } catch (e) {
      console.error("Staff PDF Generation Error:", e);
      alert("Network error during PDF generation. Please try again.\n\nError: " + e.message);
    } finally {
      setIsGeneratingStaffPDF(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    fetchTargetProgress();
    fetchCreditsForPeriod();
    fetchPettyCashForDate(reportDate);
    fetchStaffPerformance();
  };

  const cardClass = isDark ? "bg-zinc-900/40 border-white/5 shadow-2xl" : "bg-white border-black/5 shadow-xl";
  const mutedClass = isDark ? "text-zinc-500" : "text-zinc-400";

  const getProgressColor = (percentage) => {
    if (percentage >= 75) return "text-emerald-500";
    if (percentage >= 50) return "text-yellow-500";
    if (percentage >= 25) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <div className={`p-4 md:p-8 min-h-screen font-[Outfit] transition-colors duration-300 ${isDark ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'}`}>
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
            <AlertCircle size={20} className="text-red-400" />
            <p className="text-sm font-bold text-red-400">{error}</p>
            <button
              onClick={handleRetry}
              className="ml-auto px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-black flex items-center gap-1"
            >
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
              Revenue Tracking & Detailed Reporting
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleRetry}
              className={`px-4 py-3 rounded-2xl font-black uppercase text-[10px] flex items-center gap-2 transition-all duration-300 border
                ${isDark ? "border-white/10 hover:bg-white/5" : "border-black/10 hover:bg-black/5"}`}
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={generateStaffPerformancePDF}
              disabled={isGeneratingStaffPDF || loadingStaffData}
              className="px-5 py-3 bg-purple-500 text-white rounded-2xl font-black uppercase text-[10px] flex items-center gap-2 hover:bg-purple-400 transition-all duration-300 disabled:opacity-50"
            >
              {isGeneratingStaffPDF ? (
                <><Loader2 size={14} className="animate-spin" /> Generating...</>
              ) : (
                <><Users size={14} /> Staff Report</>
              )}
            </button>
          </div>
        </div>

        {/* TWO COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* MONTHLY REVENUE TARGET CARD — Ring Indicator */}
          <div className={`p-6 rounded-2xl border relative overflow-hidden transition-all duration-300 hover:shadow-xl ${cardClass}`}>
            <Lock className="absolute -right-4 -top-4 text-white/5 w-24 h-24 rotate-12" />

            {/* Header */}
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${mutedClass}`}>Monthly Target</p>
                <h3 className="text-2xl font-black tracking-tighter italic">
                  {loadingTarget ? (
                    <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin text-yellow-500" /> Loading...</span>
                  ) : fmtUGX(targetProgress.target)}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className={mutedClass} />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className={`px-2 py-1 rounded-lg text-[9px] font-black border outline-none transition-all duration-200
                    ${isDark ? "bg-zinc-800 border-zinc-700 text-white" : "bg-zinc-100 border-zinc-200 text-zinc-900"}`}
                />
              </div>
            </div>

            {/* Ring + Stats Row */}
            <div className="flex items-center gap-6 mb-6 relative z-10">

              {/* SVG Ring */}
              <div className="relative flex-shrink-0" style={{ width: 140, height: 140 }}>
                <svg
                  width="140" height="140"
                  viewBox="0 0 140 140"
                  style={{ transform: "rotate(-90deg)" }}
                >
                  <defs>
                    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#EAB308" />
                      <stop offset="60%" stopColor="#CA8A04" />
                      <stop offset="100%" stopColor={isDark ? "#3f3f46" : "#27272a"} />
                    </linearGradient>
                  </defs>
                  {/* Track */}
                  <circle
                    cx="70" cy="70" r="54"
                    fill="none"
                    stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
                    strokeWidth="11"
                  />
                  {/* Progress arc */}
                  <circle
                    cx="70" cy="70" r="54"
                    fill="none"
                    stroke="url(#ringGrad)"
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 54}`}
                    strokeDashoffset={`${2 * Math.PI * 54 * (1 - Math.min(targetProgress.percentage, 100) / 100)}`}
                    style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" }}
                  />
                </svg>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                  <span className={`text-2xl font-black italic ${getProgressColor(targetProgress.percentage)}`}>
                    {targetProgress.percentage}%
                  </span>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>done</span>
                </div>
              </div>

              {/* Stat stack */}
              <div className="flex-1 flex flex-col gap-2">
                <div className={`p-3 rounded-xl border-l-2 border-emerald-500 ${isDark ? "bg-white/5" : "bg-black/[0.03]"}`}>
                  <p className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>Current Revenue</p>
                  <p className="text-sm font-black italic text-emerald-500">{fmtUGX(targetProgress.current)}</p>
                </div>
                <div className={`p-3 rounded-xl border-l-2 border-yellow-500 ${isDark ? "bg-white/5" : "bg-black/[0.03]"}`}>
                  <p className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>Target</p>
                  <p className="text-sm font-black italic text-yellow-500">{fmtUGX(targetProgress.target)}</p>
                </div>
                <div className={`p-3 rounded-xl border-l-2 ${isDark ? "border-white/20 bg-white/5" : "border-black/20 bg-black/[0.03]"}`}>
                  <p className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>Remaining</p>
                  <p className={`text-sm font-black italic ${mutedClass}`}>
                    {fmtUGX(Math.max(targetProgress.target - targetProgress.current, 0))}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom strip */}
            <div className={`flex gap-2 pt-4 border-t relative z-10 ${isDark ? "border-white/10" : "border-black/10"}`}>
              <div className={`flex-1 text-center p-2 rounded-xl ${isDark ? "bg-white/5" : "bg-black/[0.04]"}`}>
                <p className={`text-[7px] font-black uppercase tracking-widest ${mutedClass}`}>Today</p>
                <p className="text-[10px] font-black text-yellow-500">{fmtUGX(targetProgress.todayRevenue)}</p>
              </div>
              {targetProgress.percentage >= 100 && (
                <div className="flex-1 flex items-center justify-center gap-1 bg-emerald-500/10 rounded-xl p-2">
                  <CheckCircle2 size={10} className="text-emerald-500" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Goal Met</span>
                </div>
              )}
            </div>
          </div>

          {/* TODAY'S INSIGHTS CARD */}
          <div className={`p-6 rounded-2xl border transition-all duration-300 hover:shadow-xl ${cardClass}`}>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-yellow-500/10">
                <TrendingUp size={16} className="text-yellow-500" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500">
                {reportType === "daily" ? "Selected Day's Insights" : reportType === "weekly" ? "Week Insights" : "Month Insights"}
              </p>
              {(loadingPettyCash) && <Loader2 size={12} className="animate-spin text-zinc-500 ml-auto" />}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={14} className="text-emerald-400" />
                  <p className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>Gross Revenue</p>
                </div>
                <p className="text-xl font-black italic text-emerald-400">{fmtUGX(reportData.totalRevenue)}</p>
                <p className="text-[7px] text-zinc-500 mt-1">For selected {reportType}</p>
              </div>
              
              <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet size={14} className="text-red-400" />
                  <p className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>Petty OUT</p>
                </div>
                <p className="text-xl font-black italic text-red-400">{fmtUGX(pettyCashData.total_out)}</p>
                <p className="text-[7px] text-zinc-500 mt-1">For selected {reportType}</p>
              </div>
              
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpCircle size={14} className="text-emerald-400" />
                  <p className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>Petty IN</p>
                </div>
                <p className="text-xl font-black italic text-emerald-400">{fmtUGX(pettyCashData.total_in)}</p>
                <p className="text-[7px] text-zinc-500 mt-1">Replenishment</p>
              </div>
              
              <div className={`p-4 rounded-xl bg-gradient-to-br ${pettyCashData.net >= 0 ? 'from-emerald-500/10' : 'from-red-500/10'} to-transparent border ${pettyCashData.net >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={14} className={pettyCashData.net >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                  <p className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>Net Position</p>
                </div>
                <p className={`text-xl font-black italic ${pettyCashData.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pettyCashData.net >= 0 ? '+' : ''}{fmtUGX(pettyCashData.net)}
                </p>
                <p className="text-[7px] text-zinc-500 mt-1">IN - OUT</p>
              </div>
            </div>
          </div>
        </div>

        {/* ENHANCED REPORT SECTION */}
        <div className={`p-6 rounded-2xl border transition-all duration-300 ${cardClass}`}>
          {/* Report Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-500/10">
                <FileText size={20} className="text-yellow-500" />
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${mutedClass}`}>Reports</p>
                <h2 className="text-lg font-black italic uppercase">Transaction Reports</h2>
                <p className={`text-[9px] mt-1 ${mutedClass}`}>Generate detailed business insights</p>
              </div>
            </div>
            
            <div className="flex gap-3 flex-wrap">
              <div className={`flex rounded-xl border p-1 ${isDark ? "border-white/10" : "border-gray-200"}`}>
                {[
                  { key: "daily", label: "Daily", icon: <Calendar size={12} /> },
                  { key: "weekly", label: "Weekly", icon: <Clock size={12} /> },
                  { key: "monthly", label: "Monthly", icon: <Target size={12} /> }
                ].map(({ key, label, icon }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setReportType(key);
                      if (key === "monthly") {
                        const today = new Date();
                        const year = today.getFullYear();
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        setReportDate(`${year}-${month}`);
                      } else {
                        const today = new Date();
                        const year = today.getFullYear();
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        const day = String(today.getDate()).padStart(2, '0');
                        setReportDate(`${year}-${month}-${day}`);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-200
                      ${reportType === key 
                        ? "bg-yellow-500 text-black" 
                        : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
              
              <input
                type={reportType === "monthly" ? "month" : "date"}
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase border outline-none transition-all duration-200
                  ${isDark ? "bg-zinc-800/50 border-zinc-700 text-white" : "bg-zinc-100 border-zinc-200 text-zinc-900"}`}
              />
            </div>
          </div>

          {/* Date Range Display */}
          <div className={`mb-6 p-3 rounded-xl text-center ${isDark ? "bg-white/5" : "bg-black/5"}`}>
            <p className="text-[10px] font-black uppercase tracking-widest">
              {reportType.toUpperCase()} REPORT · {getDateRangeText()}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
            <StatCardSmall 
              label="Total Orders" 
              value={reportData.totalTransactions} 
              icon={<Receipt size={14} />} 
              color="text-yellow-500"
              isDark={isDark}
            />
            <StatCardSmall 
              label="Items Sold" 
              value={reportData.totalItemsSold} 
              icon={<ShoppingBag size={14} />} 
              color="text-blue-400"
              isDark={isDark}
            />
            <StatCardSmall 
              label="Gross Revenue" 
              value={fmtUGX(reportData.totalRevenue)} 
              icon={<Banknote size={14} />} 
              color="text-emerald-400"
              isDark={isDark}
            />
            <StatCardSmall 
              label="Credits (Approved)" 
              value={loadingCredits ? "..." : fmtUGX(creditsData.approved_amount)} 
              icon={<CreditCard size={14} />} 
              color="text-purple-400"
              isDark={isDark}
            />
            <StatCardSmall 
              label="Credits (Settled)" 
              value={loadingCredits ? "..." : fmtUGX(creditsData.settled_amount)} 
              icon={<CheckCircle2 size={14} />} 
              color="text-emerald-400"
              isDark={isDark}
            />
            <StatCardSmall 
              label="Credits (Pending)" 
              value={loadingCredits ? "..." : fmtUGX(creditsData.pending_amount)} 
              icon={<Clock size={14} />} 
              color="text-yellow-400"
              isDark={isDark}
            />
          </div>

          {/* Payment Method Breakdown */}
          <div className="mb-6">
            <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${mutedClass}`}>Payment Methods</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <PaymentMethodCard label="Cash" value={fmtUGX(reportData.totalCash)} color="emerald" isDark={isDark} />
              <PaymentMethodCard label="MTN Momo" value={fmtUGX(reportData.totalMtn)} color="yellow" isDark={isDark} />
              <PaymentMethodCard label="Airtel" value={fmtUGX(reportData.totalAirtel)} color="red" isDark={isDark} />
              <PaymentMethodCard label="Card/POS" value={fmtUGX(reportData.totalCard)} color="blue" isDark={isDark} />
            </div>
          </div>

          {/* Credits Breakdown Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <p className={`text-[10px] font-black uppercase tracking-widest ${mutedClass}`}>Credits Breakdown</p>
              {loadingCredits && <Loader2 size={10} className="animate-spin text-zinc-500" />}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <CreditSummaryCard 
                label="Approved" 
                value={fmtUGX(creditsData.approved_amount)} 
                count={creditsData.approved_count}
                color="purple" 
                isDark={isDark} 
              />
              <CreditSummaryCard 
                label="Settled" 
                value={fmtUGX(creditsData.settled_amount)} 
                count={creditsData.settled_count}
                color="green" 
                isDark={isDark} 
              />
              <CreditSummaryCard 
                label="Pending" 
                value={fmtUGX(creditsData.pending_amount)} 
                count={creditsData.pending_count}
                color="yellow" 
                isDark={isDark} 
              />
              <CreditSummaryCard 
                label="Outstanding" 
                value={fmtUGX(creditsData.outstanding_amount)} 
                count={(creditsData.approved_count || 0) + (creditsData.pending_count || 0) + (creditsData.partially_settled_count || 0)}
                color="orange" 
                isDark={isDark} 
              />
            </div>
            {creditsData.partially_settled_outstanding > 0 && (
              <div className={`mt-2 p-2 rounded-lg text-center ${isDark ? "bg-yellow-500/10" : "bg-yellow-50"}`}>
                <p className="text-[8px] font-black uppercase tracking-widest text-yellow-500">
                  Includes {fmtUGX(creditsData.partially_settled_outstanding)} from partially settled credits
                </p>
              </div>
            )}
          </div>

          {/* Search and Order List */}
          <div className="mb-4">
            <div className="relative mb-3">
              <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${mutedClass}`} />
              <input
                type="text"
                placeholder="Search by table, waiter, or order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs font-bold outline-none border transition-all duration-200
                  ${isDark ? "bg-zinc-800/50 border-white/10 focus:border-yellow-500/50 text-white" 
                          : "bg-zinc-100 border-black/10 focus:border-yellow-500 text-zinc-900"}`}
              />
            </div>
            
            <button
              onClick={() => setExpandedOrders(!expandedOrders)}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200
                ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10"}`}
            >
              <div className="flex items-center gap-2">
                <Receipt size={14} className="text-yellow-500" />
                <span className="text-[9px] font-black uppercase tracking-widest">Order Details</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${isDark ? "bg-white/10" : "bg-black/10"}`}>
                  {reportData.orders.length}
                </span>
              </div>
              {expandedOrders ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {expandedOrders && (
            <div className="mb-6 overflow-x-auto max-h-96 overflow-y-auto">
              {reportData.orders.length === 0 ? (
                <div className="py-12 text-center">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${mutedClass}`}>
                    No orders found for the selected {reportType} period
                  </p>
                  <p className={`text-[9px] mt-2 ${mutedClass}`}>
                    Check that orders are marked as Paid, Closed, Confirmed, or archived
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className={`sticky top-0 ${isDark ? "bg-black" : "bg-white"}`}>
                    <tr className={`border-b ${isDark ? "border-white/10" : "border-black/10"}`}>
                      <th className="p-2 text-[8px] font-black uppercase tracking-widest">ID</th>
                      <th className="p-2 text-[8px] font-black uppercase tracking-widest">Table</th>
                      <th className="p-2 text-[8px] font-black uppercase tracking-widest">Waiter</th>
                      <th className="p-2 text-[8px] font-black uppercase tracking-widest text-right">Items</th>
                      <th className="p-2 text-[8px] font-black uppercase tracking-widest text-right">Amount</th>
                      <th className="p-2 text-[8px] font-black uppercase tracking-widest">Method</th>
                      <th className="p-2 text-[8px] font-black uppercase tracking-widest">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.orders.slice(0, 100).map((order, idx) => {
                      let items = order.items || [];
                      if (typeof items === "string") {
                        try { items = JSON.parse(items); } catch { items = []; }
                      }
                      const itemCount = Array.isArray(items) ? items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0) : 1;
                      return (
                        <tr key={order.id || idx} className={`border-b ${isDark ? "border-white/5" : "border-black/5"}`}>
                          <td className="p-2 font-mono text-[9px]">#{formatOrderId(order.id)}</td>
                          <td className="p-2 font-bold text-[9px]">{order.table_name || "—"}</td>
                          <td className="p-2 text-[9px]">{order.staff_name || order.waiter_name || "—"}</td>
                          <td className="p-2 text-[9px] font-bold text-right text-blue-400">{itemCount}</td>
                          <td className="p-2 text-[9px] font-bold text-right text-emerald-400">{fmtUGX(order.total)}</td>
                          <td className="p-2 text-[9px]">{order.payment_method || "—"}</td>
                          <td className="p-2 text-[9px]">{formatTime(order.timestamp || order.date || order.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Download Button */}
          <div className="flex gap-3">
            <button
              onClick={generatePDF}
              disabled={reportData.orders.length === 0 || isGeneratingPDF}
              className="w-full py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-2xl font-black uppercase italic text-xs flex items-center justify-center gap-2 hover:scale-[1.02] transition-all duration-300 disabled:opacity-20 shadow-xl"
            >
              {isGeneratingPDF ? (
                <><Loader2 size={16} className="animate-spin" /> Generating PDF...</>
              ) : (
                <><Printer size={16} /> Download PDF Report</>
              )}
            </button>
          </div>
          
          {reportData.orders.length === 0 && !loadingCredits && (
            <p className={`text-center text-[9px] font-black uppercase tracking-widest mt-4 ${mutedClass}`}>
              No transactions found for the selected {reportType} period
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function StatCardSmall({ label, value, icon, color, isDark }) {
  return (
    <div className={`p-3 rounded-xl transition-all duration-200 hover:scale-[1.02] ${isDark ? "bg-white/5" : "bg-black/5"}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <p className={`text-[7px] font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-gray-500"}`}>{label}</p>
      </div>
      <p className={`text-sm font-black italic ${color}`}>{value}</p>
    </div>
  );
}

function PaymentMethodCard({ label, value, color, isDark }) {
  const colorMap = {
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    red: "bg-red-500/10 border-red-500/20 text-red-400",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
  };
  
  return (
    <div className={`p-3 rounded-xl border transition-all duration-200 hover:scale-[1.02] ${colorMap[color]}`}>
      <p className="text-[8px] font-black uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xs font-black">{value}</p>
    </div>
  );
}

function CreditSummaryCard({ label, value, count, color, isDark }) {
  const colorMap = {
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    green: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    orange: "bg-orange-500/10 border-orange-500/20 text-orange-400",
  };
  
  return (
    <div className={`p-3 rounded-xl border transition-all duration-200 hover:scale-[1.02] ${colorMap[color]}`}>
      <p className="text-[7px] font-black uppercase tracking-widest mb-1">{label}</p>
      <p className="text-sm font-black">{value}</p>
      <p className="text-[8px] opacity-70 mt-1">{count || 0} record{count !== 1 ? 's' : ''}</p>
    </div>
  );
}