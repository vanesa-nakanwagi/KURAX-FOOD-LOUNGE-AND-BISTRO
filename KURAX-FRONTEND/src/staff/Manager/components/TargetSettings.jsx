import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import API_URL from "../../../config/api";
import MonthlyFinancialBreakdown from "../../components/MonthlyFinancialBreakdown";
import { 
  Target,
  Calendar, FileText, Lock, CheckCircle2, Loader2,
  Printer,
  Activity, ArrowUpCircle, AlertCircle, RefreshCw, Save,
} from "lucide-react";

// --- HELPERS ---
function fmtUGX(n) {
  return `UGX ${Number(n || 0).toLocaleString()}`;
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString();
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
  const [reportType, setReportType] = useState("daily");
  const [customStart, setCustomStart] = useState(() => getKampalaDate());
  const [customEnd, setCustomEnd] = useState(() => getKampalaDate());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

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
  
  const [targetProgress, setTargetProgress] = useState({
    target: 7000000,
    grossSales: 0,
    creditSettlements: 0,
    expenses: 0,
    currentCash: 0,
    remaining: 7000000,
    percentage: 0,
    cash_on_counter: 0,
  });
  const [loadingTarget, setLoadingTarget] = useState(true);
  
  // --- Petty Cash ---
  const [pettyCashData, setPettyCashData] = useState({ total_out: 0 });
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
        setTargetProgress({
          target: Number(data.target) || 7000000,
          grossSales: Number(data.grossSales) || 0,
          creditSettlements: Number(data.creditSettlements) || 0,
          expenses: Number(data.expenses) || 0,
          currentCash: Number(data.currentCash) || 0,
          remaining: Number(data.remaining) || 0,
          percentage: data.percentage || 0,
          cash_on_counter: Number(data.cash_on_counter) || 0,
        });
      }
    } catch (err) {
      console.error("Failed to fetch target progress:", err);
    } finally {
      setLoadingTarget(false);
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
      } else if (reportType === "custom") {
        url = `${API_URL}/api/manager/petty-cash-summary?period=custom&startDate=${customStart}&endDate=${customEnd}`;
      } else {
        url = `${API_URL}/api/manager/petty-cash-summary?period=monthly&month=${date.substring(0, 7)}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPettyCashData({
          total_out: Number(data.total_out) || 0,
        });
      }
    } catch (err) {
      console.error("Failed to fetch petty cash:", err);
    } finally {
      setLoadingPettyCash(false);
    }
  }, [customEnd, customStart, reportType]);

  useEffect(() => {
    const events = new EventSource(`${API_URL}/api/overview/stream`);
    events.onmessage = (event) => {
      try {
        if (JSON.parse(event.data).type === "PETTY") {
          fetchPettyCashForDate(reportDate);
          fetchTargetProgress();
        }
      } catch {}
    };
    return () => events.close();
  }, [fetchPettyCashForDate, fetchTargetProgress, reportDate]);

  const fetchCreditsForPeriod = useCallback(async () => {
    setLoadingCredits(true);
    try {
      let url = "";
      if (reportType === "daily") {
        url = `${API_URL}/api/manager/credits-summary?period=daily&date=${reportDate}`;
      } else if (reportType === "weekly") {
        const { start, end } = getWeekRange(reportDate);
        url = `${API_URL}/api/manager/credits-summary?period=weekly&startDate=${start}&endDate=${end}`;
      } else if (reportType === "custom") {
        url = `${API_URL}/api/manager/credits-summary?period=custom&startDate=${customStart}&endDate=${customEnd}`;
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
  }, [customEnd, customStart, reportType, reportDate]);

  useEffect(() => {
    fetchTargetProgress();
  }, [fetchTargetProgress]);

  useEffect(() => {
    fetchPettyCashForDate(reportDate);
    fetchCreditsForPeriod();
  }, [reportDate, reportType, customStart, customEnd, fetchPettyCashForDate, fetchCreditsForPeriod]);

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
        } else if (reportType === "monthly") {
          const targetMonthStr = reportDate.substring(0, 7);
          if (kDate.substring(0, 7) === targetMonthStr) dateFilteredOrders.push(order);
        } else if (kDate >= customStart && kDate <= customEnd) {
          dateFilteredOrders.push(order);
        }
      });
    } catch (err) {
      console.error("Date filtering error:", err);
      dateFilteredOrders = [];
    }

    const enrichedOrders = dateFilteredOrders.map(order => {
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
  }, [filteredOrders, allOrders, reportDate, reportType, customStart, customEnd, referencedSourceIds]);

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
      } else if (reportType === "monthly") {
        const [year, month] = reportDate.split('-');
        const date = new Date(Number(year), Number(month) - 1, 1);
        return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      }
      const startDate = new Date(`${customStart}T12:00:00`);
      const endDate = new Date(`${customEnd}T12:00:00`);
      return `${startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} - ${endDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    } catch {
      return reportDate;
    }
  };

  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      let url = "", filename = "";
      if (reportType === "daily") {
        url = `${API_URL}/api/manager/export-pdf?type=daily&date=${reportDate}`;
        filename = `Kurax_Daily_Report_${reportDate}.pdf`;
      } else if (reportType === "weekly") {
        url = `${API_URL}/api/manager/export-pdf?type=weekly&date=${reportDate}`;
        filename = `Kurax_Weekly_Report_${reportDate}.pdf`;
      } else if (reportType === "custom") {
        url = `${API_URL}/api/manager/export-pdf?type=custom&startDate=${customStart}&endDate=${customEnd}`;
        filename = `Kurax_Custom_Report_${customStart}_to_${customEnd}.pdf`;
      } else {
        const monthValue = reportDate.substring(0, 7);
        url = `${API_URL}/api/manager/export-pdf?type=monthly&month=${monthValue}`;
        filename = `Kurax_Monthly_Report_${monthValue}.pdf`;
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

  const handleRetry = () => {
    setError(null);
    fetchTargetProgress();
    fetchCreditsForPeriod();
    fetchPettyCashForDate(reportDate);
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

  const monthlyProgressPercent = Number(targetProgress.percentage) || 0;

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
              Set Monthly Sales Goals & Track Sales, Settlements, Expenses, and Current Cash
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleRetry} className={`px-4 py-3 rounded-2xl font-black uppercase text-[10px] flex items-center gap-2 border ${isDark ? "border-white/10 hover:bg-white/5" : "border-black/10 hover:bg-black/5"}`}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* MONTHLY TARGET SETTING CARD */}
        <div className={`p-6 rounded-2xl border ${cardClass}`}>
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-500/10"><Target size={24} className="text-yellow-500" /></div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${mutedClass}`}>Monthly Sales Target</p>
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
                <span className={mutedClass}>Gross Sales toward target</span>
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
                  <span className={`text-2xl font-black italic ${getProgressColor(monthlyProgressPercent)}`}>{monthlyProgressPercent.toFixed(1)}%</span>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${mutedClass}`}>done</span>
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <div className="p-3 rounded-xl border-l-2 border-emerald-500 bg-white/5"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Gross Sales</p><p className="text-sm font-black italic text-emerald-500">{fmtUGX(targetProgress.grossSales)}</p></div>
                <div className="p-3 rounded-xl border-l-2 border-purple-500 bg-white/5"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Credit Settlements</p><p className="text-sm font-black italic text-purple-500">{fmtUGX(targetProgress.creditSettlements)}</p></div>
                <div className="p-3 rounded-xl border-l-2 border-rose-500 bg-white/5"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Expenses</p><p className="text-sm font-black italic text-rose-500">{fmtUGX(targetProgress.expenses)}</p></div>
                <div className="p-3 rounded-xl border-l-2 border-yellow-500 bg-white/5"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Current Cash</p><p className="text-sm font-black italic text-yellow-500">{fmtUGX(targetProgress.currentCash)}</p></div>
                <div className="p-3 rounded-xl border-l-2 border-white/20 bg-white/5"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Remaining</p><p className="text-sm font-black italic text-zinc-500">{fmtUGX(targetProgress.remaining)}</p></div>
              </div>
            </div>
            <div className="flex gap-2 pt-4 border-t border-white/10">
              {monthlyProgressPercent >= 100 && <div className="flex-1 flex items-center justify-center gap-1 bg-emerald-500/10 rounded-xl p-2"><CheckCircle2 size={10} className="text-emerald-500" /><span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Goal Met</span></div>}
            </div>
          </div>

          <MonthlyFinancialBreakdown
            month={targetMonth}
            target={targetProgress.target}
            grossSales={targetProgress.grossSales}
            creditSettlements={targetProgress.creditSettlements}
            expenses={targetProgress.expenses}
            currentCash={targetProgress.currentCash}
            remaining={targetProgress.remaining}
            percentage={monthlyProgressPercent}
            isDark={isDark}
          />
        </div>

        {/* Report section */}
        <div className={`p-6 rounded-2xl border ${cardClass}`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
            <div className="flex items-center gap-4"><div className="p-3 rounded-xl bg-yellow-500/10"><FileText size={20} className="text-yellow-500" /></div><div><p className={`text-[10px] font-black uppercase tracking-widest ${mutedClass}`}>Reports</p><h2 className="text-lg font-black italic uppercase">Transaction Reports</h2><p className={`text-[9px] mt-1 ${mutedClass}`}>Generate detailed business insights</p></div></div>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Report date range">
              {["daily", "weekly", "monthly", "custom"].map(key => (
                <button key={key} onClick={() => {
                  setReportType(key);
                  const today = getKampalaDate();
                  if (key === "monthly") setReportDate(today.substring(0, 7));
                  else if (key !== "custom") setReportDate(today);
                }} className={`rounded-lg px-3 py-2 text-xs font-bold ${reportType === key ? "bg-yellow-400 text-black" : "border border-zinc-200 bg-white text-zinc-600"}`}>
                  {key[0].toUpperCase() + key.slice(1)}
                </button>
              ))}
              {reportType === "monthly" ? (
                <input aria-label="Report month" type="month" value={reportDate} onChange={event => setReportDate(event.target.value)} className={`rounded-md border px-2 py-2 text-sm ${isDark ? "border-zinc-700 bg-zinc-800 text-white" : "border-stone-300 bg-white"}`} />
              ) : reportType === "custom" ? (
                <>
                  <input aria-label="From date" type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} className={`rounded-md border px-2 py-2 text-sm ${isDark ? "border-zinc-700 bg-zinc-800 text-white" : "border-stone-300 bg-white"}`} />
                  <input aria-label="To date" type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} className={`rounded-md border px-2 py-2 text-sm ${isDark ? "border-zinc-700 bg-zinc-800 text-white" : "border-stone-300 bg-white"}`} />
                </>
              ) : (
                <input aria-label={reportType === "weekly" ? "Week containing date" : "Report date"} type="date" value={reportDate} onChange={event => setReportDate(event.target.value)} className={`rounded-md border px-2 py-2 text-sm ${isDark ? "border-zinc-700 bg-zinc-800 text-white" : "border-stone-300 bg-white"}`} />
              )}
              
            </div>
          </div>

          <div className={`mb-6 p-3 rounded-xl text-center ${isDark ? "bg-white/5" : "bg-black/5"}`}>
            <p className="text-[10px] font-black uppercase tracking-widest">{reportType.toUpperCase()} REPORT · {getDateRangeText()}</p>
          </div>
          
          <button onClick={generatePDF} disabled={isGeneratingPDF} className="w-full py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-2xl font-black uppercase italic text-xs flex items-center justify-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-20 shadow-xl">
            {isGeneratingPDF ? <><Loader2 size={16} className="animate-spin" /> Generating PDF...</> : <><Printer size={16} /> Download PDF Report</>}
          </button>
        </div>
      </div>
    </div>
  );
}
