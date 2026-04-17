import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import API_URL from "../../../config/api";
import { 
  Target, TrendingUp, ShoppingBag, 
  Calendar, Download, FileText, Lock, CheckCircle2, Loader2,
  Users, Clock, Banknote, CreditCard, Smartphone, Receipt,
  Printer, ChevronDown, ChevronUp, Search, Wallet,
  Activity, DollarSign, ArrowUpCircle
} from "lucide-react";

// --- HELPERS ---
function fmtUGX(n) {
  return `UGX ${Number(n || 0).toLocaleString()}`;
}

function formatTime(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
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

export default function TargetSettings() {
  const { 
    monthlyTargets = {}, 
    orders = [],
  } = useData() || {};
  const { theme } = useTheme();

  const isDark = theme === 'dark';
  
  // --- Report State ---
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedOrders, setExpandedOrders] = useState(false);
  const [reportType, setReportType] = useState("daily");
  const [searchQuery, setSearchQuery] = useState("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingStaffPDF, setIsGeneratingStaffPDF] = useState(false);
  const [staffPerformanceData, setStaffPerformanceData] = useState(null);
  const [loadingStaffData, setLoadingStaffData] = useState(false);

  // --- Director's Revenue Target Display ---
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [targetProgress, setTargetProgress] = useState({ target: 0, current: 0, percentage: 0, todayRevenue: 0 });
  const [loadingTarget, setLoadingTarget] = useState(true);
  
  // --- Petty Cash Data - Now fetches based on selected report date ---
  const [pettyCashData, setPettyCashData] = useState({ total_out: 0, total_in: 0, net: 0 });
  
  // --- Credits Data for the selected period - UPDATED with full fields ---
  const [creditsData, setCreditsData] = useState({ 
    total_credits: 0, 
    approved_amount: 0, 
    settled_amount: 0, 
    pending_amount: 0,
    rejected_amount: 0,
    outstanding_amount: 0 
  });

  // Fetch target progress from backend
  const fetchTargetProgress = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/manager/target-progress`);
      if (response.ok) {
        const data = await response.json();
        setTargetProgress(data);
      }
    } catch (err) {
      console.error("Failed to fetch target progress:", err);
    } finally {
      setLoadingTarget(false);
    }
  }, []);

  // Fetch petty cash data for a specific date
  const fetchPettyCashForDate = useCallback(async (date) => {
    try {
      const response = await fetch(`${API_URL}/api/summaries/petty-cash?date=${date}`);
      if (response.ok) {
        const data = await response.json();
        const totalOut = Number(data.total_out) || 0;
        const totalIn = Number(data.total_in) || 0;
        setPettyCashData({
          total_out: totalOut,
          total_in: totalIn,
          net: totalIn - totalOut
        });
      }
    } catch (err) {
      console.error("Failed to fetch petty cash:", err);
    }
  }, []);

  // Fetch credits for the selected period - UPDATED with full response handling
  const fetchCreditsForPeriod = useCallback(async () => {
    try {
      let url = "";
      if (reportType === "daily") {
        url = `${API_URL}/api/manager/credits-summary?period=daily&startDate=${reportDate}`;
      } else if (reportType === "weekly") {
        // Calculate week start and end
        const selectedDate = new Date(reportDate);
        const dayOfWeek = selectedDate.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(selectedDate);
        weekStart.setDate(selectedDate.getDate() - diff);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        url = `${API_URL}/api/manager/credits-summary?period=weekly&startDate=${weekStart.toISOString().split('T')[0]}&endDate=${weekEnd.toISOString().split('T')[0]}`;
      } else if (reportType === "monthly") {
        url = `${API_URL}/api/manager/credits-summary?period=monthly&month=${reportDate.substring(0, 7)}`;
      }
      
      console.log("Fetching credits from:", url);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log("Credits data received:", data);
        setCreditsData({
          total_credits: data.total_credits || 0,
          approved_amount: data.approved_amount || 0,
          settled_amount: data.settled_amount || 0,
          pending_amount: data.pending_amount || 0,
          rejected_amount: data.rejected_amount || 0,
          outstanding_amount: data.outstanding_amount || (data.approved_amount + data.pending_amount)
        });
      }
    } catch (err) {
      console.error("Failed to fetch credits:", err);
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
      }
    } catch (err) {
      console.error("Failed to fetch staff performance:", err);
    } finally {
      setLoadingStaffData(false);
    }
  }, [selectedMonth]);

  // Initial loads
  useEffect(() => {
    fetchTargetProgress();
    fetchStaffPerformance();
  }, [fetchTargetProgress, fetchStaffPerformance]);

  // Fetch petty cash and credits when report date or type changes
  useEffect(() => {
    if (reportType === "daily") {
      fetchPettyCashForDate(reportDate);
    } else if (reportType === "weekly") {
      // For weekly, fetch petty cash for each day and sum? Or just show weekly total
      // For simplicity, fetch for the end date
      fetchPettyCashForDate(reportDate);
    } else if (reportType === "monthly") {
      // For monthly, fetch petty cash for the month
      fetchPettyCashForDate(reportDate);
    }
    fetchCreditsForPeriod();
  }, [reportDate, reportType, fetchPettyCashForDate, fetchCreditsForPeriod]);

  // --- Comprehensive Report Data ---
  const reportData = useMemo(() => {
    let filteredOrders = [];
    
    if (reportType === "daily") {
      filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.timestamp || order.date).toISOString().split('T')[0];
        return orderDate === reportDate && (order.is_archived === true || order.status === "Paid" || order.status === "CLOSED");
      });
    } else if (reportType === "weekly") {
      const selectedDate = new Date(reportDate);
      const dayOfWeek = selectedDate.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(selectedDate);
      weekStart.setDate(selectedDate.getDate() - diff);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59);
      
      filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.timestamp || order.date);
        return orderDate >= weekStart && orderDate <= weekEnd && 
               (order.is_archived === true || order.status === "Paid" || order.status === "CLOSED");
      });
    } else if (reportType === "monthly") {
      filteredOrders = orders.filter(order => {
        const orderDate = (order.timestamp || order.date || "").toString();
        return orderDate.startsWith(reportDate.substring(0, 7)) && 
               (order.is_archived === true || order.status === "Paid" || order.status === "CLOSED");
      });
    }

    if (searchQuery) {
      filteredOrders = filteredOrders.filter(order => 
        (order.table_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.staff_name || order.waiter_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(order.id || "").includes(searchQuery)
      );
    }

    // Calculate station breakdown
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
          const qty = item.quantity || 1;
          if (station === "barista" || category.includes("barista") || category.includes("coffee")) {
            baristaItems += qty;
          } else if (station === "barman" || category.includes("bar") || category.includes("cocktail") || category.includes("drink")) {
            barmanItems += qty;
          } else {
            kitchenItems += qty;
          }
        });
      }
    });

    // Calculate payment method breakdown
    const getSumByMethod = (methodPatterns) => filteredOrders
      .filter(o => methodPatterns.some(p => (o.payment_method || "").toUpperCase().includes(p)))
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const totalCredit = getSumByMethod(['CREDIT']);
    
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
      const itemCount = Array.isArray(items) ? items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 1;
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
      return sum + (Array.isArray(items) ? items.reduce((s, item) => s + (item.quantity || 1), 0) : 1);
    }, 0);

    return {
      orders: filteredOrders,
      totalTransactions: filteredOrders.length,
      totalItemsSold: totalItemsSold,
      totalRevenue: filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0),
      totalCash: getSumByMethod(['CASH']),
      totalMtn: getSumByMethod(['MTN']),
      totalAirtel: getSumByMethod(['AIRTEL']),
      totalCard: getSumByMethod(['CARD', 'POS', 'VISA']),
      totalCredit: totalCredit,
      kitchenItems,
      baristaItems,
      barmanItems,
      staffPerformance,
      avgOrderValue: filteredOrders.length > 0 ? filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0) / filteredOrders.length : 0,
      avgItemValue: totalItemsSold > 0 ? filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0) / totalItemsSold : 0,
    };
  }, [orders, reportDate, reportType, searchQuery]);

  const getDateRangeText = () => {
    if (reportType === "daily") {
      return new Date(reportDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    } else if (reportType === "weekly") {
      const selectedDate = new Date(reportDate);
      const dayOfWeek = selectedDate.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(selectedDate);
      weekStart.setDate(selectedDate.getDate() - diff);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} - ${weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    } else {
      return new Date(reportDate).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
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
      
      console.log("Fetching PDF from:", url);
      
      const res = await fetch(url);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("PDF generation failed:", errorText);
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

  // Generate Staff Performance Report
  const generateStaffPerformancePDF = async () => {
    if (!staffPerformanceData || staffPerformanceData.staff.length === 0) {
      alert("No staff performance data available for the selected month.");
      return;
    }

    setIsGeneratingStaffPDF(true);
    try {
      const url = `${API_URL}/api/manager/export-staff-pdf?month=${selectedMonth}`;
      console.log("Fetching staff PDF from:", url);
      
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
        alert("Staff performance report downloaded successfully!");
      } else {
        const error = await res.json();
        console.error("PDF generation failed:", error);
        alert(error.error || "Failed to generate staff report");
      }
    } catch (e) {
      console.error("Staff PDF Generation Error:", e);
      alert("Network error during PDF generation. Please try again.\n\nError: " + e.message);
    } finally {
      setIsGeneratingStaffPDF(false);
    }
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
          
          <button
            onClick={generateStaffPerformancePDF}
            disabled={isGeneratingStaffPDF || loadingStaffData}
            className="px-5 py-3 bg-purple-500 text-white rounded-2xl font-black uppercase text-[10px] flex items-center gap-2 hover:bg-purple-400 transition-all duration-300"
          >
            {isGeneratingStaffPDF ? (
              <><Loader2 size={14} className="animate-spin" /> Generating...</>
            ) : (
              <><Users size={14} /> Staff Report</>
            )}
          </button>
        </div>

        {/* TWO COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* MONTHLY REVENUE TARGET CARD */}
          <div className={`p-6 rounded-2xl border relative overflow-hidden transition-all duration-300 hover:shadow-xl ${cardClass}`}>
            <Lock className="absolute -right-4 -top-4 text-white/5 w-24 h-24 rotate-12" />
            
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${mutedClass}`}>Monthly Target</p>
                <h3 className="text-4xl font-black tracking-tighter italic">
                  {loadingTarget ? "..." : fmtUGX(targetProgress.target)}
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

            <div className="relative mb-6 z-10">
              <p className={`text-[10px] font-black uppercase tracking-widest ${mutedClass}`}>Current Progress</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black italic text-emerald-500">{fmtUGX(targetProgress.current)}</span>
                <span className={`text-sm ${mutedClass}`}>/ {fmtUGX(targetProgress.target)}</span>
              </div>
            </div>

            <div className="mt-auto space-y-3 relative z-10">
              <div className="flex justify-between items-end">
                <span className={`text-[10px] font-black uppercase ${mutedClass}`}>Completion</span>
                <span className={`text-xl font-black italic ${getProgressColor(targetProgress.percentage)}`}>
                  {targetProgress.percentage}%
                </span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden bg-black/40">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-500 to-yellow-600 transition-all duration-1000 ease-out rounded-full"
                  style={{ width: `${Math.min(targetProgress.percentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-zinc-600">
                <span>Earned: {fmtUGX(targetProgress.current)}</span>
                {targetProgress.percentage >= 100 && (
                  <span className="text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 size={10}/> GOAL MET
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* TODAY'S INSIGHTS CARD - Now shows data for selected date */}
          <div className={`p-6 rounded-2xl border transition-all duration-300 hover:shadow-xl ${cardClass}`}>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-yellow-500/10">
                <TrendingUp size={16} className="text-yellow-500" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500">
                {reportType === "daily" ? "Selected Day's Insights" : reportType === "weekly" ? "Week Insights" : "Month Insights"}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Gross Revenue - shows revenue for selected period */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={14} className="text-emerald-400" />
                  <p className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>Gross Revenue</p>
                </div>
                <p className="text-xl font-black italic text-emerald-400">{fmtUGX(reportData.totalRevenue)}</p>
                <p className="text-[7px] text-zinc-500 mt-1">For selected {reportType}</p>
              </div>
              
              {/* Petty OUT - shows for selected date */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet size={14} className="text-red-400" />
                  <p className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>Petty OUT</p>
                </div>
                <p className="text-xl font-black italic text-red-400">{fmtUGX(pettyCashData.total_out)}</p>
                <p className="text-[7px] text-zinc-500 mt-1">For selected {reportType}</p>
              </div>
              
              {/* Petty IN - shows for selected date */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpCircle size={14} className="text-emerald-400" />
                  <p className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>Petty IN</p>
                </div>
                <p className="text-xl font-black italic text-emerald-400">{fmtUGX(pettyCashData.total_in)}</p>
                <p className="text-[7px] text-zinc-500 mt-1">Replenishment</p>
              </div>
              
              {/* Net Position */}
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
            
            <div className="flex gap-3">
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
                      // Reset date based on type if needed
                      if (key === "monthly" && reportDate.length > 7) {
                        setReportDate(reportDate.substring(0, 7));
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

          {/* Stats Grid - UPDATED with 6 credit cards including Credit metrics */}
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
              value={fmtUGX(creditsData.approved_amount)} 
              icon={<CreditCard size={14} />} 
              color="text-purple-400"
              isDark={isDark}
            />
            <StatCardSmall 
              label="Credits (Settled)" 
              value={fmtUGX(creditsData.settled_amount)} 
              icon={<CheckCircle2 size={14} />} 
              color="text-emerald-400"
              isDark={isDark}
            />
            <StatCardSmall 
              label="Credits (Pending)" 
              value={fmtUGX(creditsData.pending_amount)} 
              icon={<Clock size={14} />} 
              color="text-yellow-400"
              isDark={isDark}
            />
          </div>

          {/* Payment Method Breakdown */}
          <div className="mb-6">
            <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${mutedClass}`}>Payment Methods</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <PaymentMethodCard label="Cash" value={fmtUGX(reportData.totalCash)} color="emerald" isDark={isDark} />
              <PaymentMethodCard label="MTN Momo" value={fmtUGX(reportData.totalMtn)} color="yellow" isDark={isDark} />
              <PaymentMethodCard label="Airtel" value={fmtUGX(reportData.totalAirtel)} color="red" isDark={isDark} />
              <PaymentMethodCard label="Card/POS" value={fmtUGX(reportData.totalCard)} color="blue" isDark={isDark} />
             
            </div>
          </div>

          {/* Credits Breakdown Section - NEW */}
          <div className="mb-6">
            <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${mutedClass}`}>Credits Breakdown</p>
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
                count={(creditsData.approved_count || 0) + (creditsData.pending_count || 0)}
                color="orange" 
                isDark={isDark} 
              />
            </div>
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
                    const itemCount = Array.isArray(items) ? items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 1;
                    return (
                      <tr key={idx} className={`border-b ${isDark ? "border-white/5" : "border-black/5"}`}>
                        <td className="p-2 font-mono text-[9px]">#{formatOrderId(order.id)}</td>
                        <td className="p-2 font-bold text-[9px]">{order.table_name || "—"}</td>
                        <td className="p-2 text-[9px]">{order.staff_name || order.waiter_name || "—"}</td>
                        <td className="p-2 text-[9px] font-bold text-right text-blue-400">{itemCount}</td>
                        <td className="p-2 text-[9px] font-bold text-right text-emerald-400">{fmtUGX(order.total)}</td>
                        <td className="p-2 text-[9px]">{order.payment_method || "—"}</td>
                        <td className="p-2 text-[9px]">{formatTime(order.timestamp || order.date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
          
          {reportData.orders.length === 0 && (
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

// ─── NEW CREDIT SUMMARY CARD COMPONENT ────────────────────────────────────────
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