import React, { useState, useMemo } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { Target, TrendingUp, Users, Save, ShoppingBag, Calendar, Download, FileText } from "lucide-react";

export default function TargetSettings() {
  const { 
    dailyGoal, setDailyGoal, 
    monthlyTargets = {}, updateMonthlyTarget, 
    staffList = [],
    orders = []
  } = useData() || {};
  const { theme } = useTheme();

  const isDark = theme === 'dark';

  // --- Daily Order Target ---
  const handleDailyOrderChange = (e) => {
    setDailyGoal(Number(e.target.value));
  };

  // --- Monthly Revenue Goal ---
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [revenueGoal, setRevenueGoal] = useState(
    monthlyTargets[selectedMonth]?.revenue || 0
  );

  const handleMonthChange = (e) => {
    const month = e.target.value;
    setSelectedMonth(month);
    setRevenueGoal(monthlyTargets[month]?.revenue || 0);
  };

  const handleSaveMonthly = () => {
    const currentQuota = monthlyTargets[selectedMonth]?.waiterQuota || 0;
    updateMonthlyTarget(selectedMonth, Number(revenueGoal), currentQuota);
    alert(`Monthly Revenue Goal for ${selectedMonth} updated!`);
  };

  // --- Daily Report ---
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  const reportData = useMemo(() => {
    const dailyOrders = orders.filter(order => {
      const orderDate = new Date(order.timestamp || order.date)
        .toISOString()
        .split('T')[0];
      return orderDate === reportDate;
    });

    const totalCash = dailyOrders
      .filter(o => (o.payment_method || o.paymentMethod) === 'CASH')
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const totalMomo = dailyOrders
      .filter(o => (o.payment_method || o.paymentMethod) === 'MOMO')
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const totalCard = dailyOrders
      .filter(o => (o.payment_method || o.paymentMethod) === 'CARD')
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const totalRevenue = totalCash + totalMomo + totalCard;

    return {
      orders: dailyOrders,
      totalTransactions: dailyOrders.length,
      totalRevenue,
      totalCash,
      totalMomo,
      totalCard,
    };
  }, [orders, reportDate]);

  // --- Progress toward monthly goal ---
  const currentMonthKey = reportDate.substring(0, 7);
  const monthTarget = monthlyTargets[currentMonthKey] || { revenue: 0, waiterQuota: 0 };
  const progressPercent = monthTarget.revenue > 0
    ? Math.min((reportData.totalRevenue / monthTarget.revenue) * 100, 100).toFixed(1)
    : 0;

  // --- CSV Download ---
  const handleDownloadReport = () => {
    if (reportData.orders.length === 0) {
      alert("No transactions found for this date.");
      return;
    }

    const summaryRows = [
      [`KURAX FOOD LOUNGE & BISTRO — DAILY REPORT`],
      [`Date: ${reportDate}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      [`SUMMARY`],
      [`Total Transactions`, reportData.totalTransactions],
      [`Total Revenue`, `UGX ${reportData.totalRevenue.toLocaleString()}`],
      [`Cash`, `UGX ${reportData.totalCash.toLocaleString()}`],
      [`Mobile Money (MOMO)`, `UGX ${reportData.totalMomo.toLocaleString()}`],
      [`Card`, `UGX ${reportData.totalCard.toLocaleString()}`],
      [],
      [`ORDER BREAKDOWN`],
      [`Order ID`, `Waiter`, `Table`, `Amount (UGX)`, `Payment Method`, `Time`],
      ...reportData.orders.map(o => [
        o.id,
        o.waiter_name || o.waiterName || o.waiter || "—",
        o.table_name || o.tableName || o.name || "—",
        Number(o.total || 0).toLocaleString(),
        o.payment_method || o.paymentMethod || "—",
        o.timestamp
          ? new Date(o.timestamp).toLocaleTimeString()
          : (o.time || "—")
      ])
    ];

    const csvContent = "data:text/csv;charset=utf-8," +
      summaryRows.map(row => row.join(",")).join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Kurax_Daily_Report_${reportDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`p-4 md:p-8 min-h-screen font-[Outfit] transition-colors duration-300 ${
      isDark ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'
    }`}>
      <div className="max-w-5xl space-y-8">

        {/* PAGE HEADER */}
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic flex items-center gap-3">
            <Target className="text-yellow-500 shrink-0" size={32} />
            Performance Hub
          </h1>
          <p className="text-zinc-500 text-xs font-bold uppercase mt-2 tracking-widest">
            Manage staff order targets & business revenue goals
          </p>
        </div>

        {/* ROW 1: Target Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">

          {/* SECTION A: STAFF ORDER TARGET */}
          <div className={`p-6 md:p-8 rounded-[2.5rem] border transition-all ${
            isDark ? 'bg-zinc-900 border-white/5 shadow-2xl' : 'bg-white border-black/5 shadow-xl'
          }`}>
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingBag size={14} className="text-yellow-500" />
                  <p className="text-[10px] font-black uppercase text-yellow-500 tracking-widest">
                    Floor Staff Target
                  </p>
                </div>
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter italic">
                  {dailyGoal || 20}
                  <span className="text-xs text-zinc-500 ml-2 uppercase not-italic">Orders / Day</span>
                </h2>
              </div>
              <Users className="text-zinc-700 shrink-0" size={28} />
            </div>
            <div className="space-y-4">
              <input
                type="range" min="5" max="100" step="5"
                value={dailyGoal || 20}
                onChange={handleDailyOrderChange}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
              <div className="flex justify-between text-[9px] font-black uppercase text-zinc-500 italic tracking-widest">
                <span>Min: 5</span>
                <span>Max: 100</span>
              </div>
            </div>
          </div>

          {/* SECTION B: MONTHLY REVENUE GOAL */}
          <div className={`p-6 md:p-8 rounded-[2.5rem] border transition-all ${
            isDark ? 'bg-zinc-900 border-white/5 shadow-2xl' : 'bg-white border-black/5 shadow-xl'
          }`}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-emerald-500" />
                <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">
                  Business Revenue Goal
                </p>
              </div>
              <input
                type="month" value={selectedMonth} onChange={handleMonthChange}
                className="bg-transparent font-black uppercase text-[10px] outline-none border border-zinc-800 rounded-lg px-2 py-1 text-zinc-400 cursor-pointer"
              />
            </div>

            <div className="relative mb-6">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-zinc-500 font-black text-sm ml-1 uppercase">
                UGX
              </span>
              <input
                type="number" value={revenueGoal}
                onChange={(e) => setRevenueGoal(e.target.value)}
                className="w-full bg-transparent border-b-2 border-zinc-800 py-2 pl-10 text-3xl md:text-4xl font-black outline-none focus:border-yellow-500 transition-colors"
                placeholder="0"
              />
            </div>

            <button
              onClick={handleSaveMonthly}
              className="w-full py-4 bg-yellow-500 text-black rounded-2xl font-black uppercase italic text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-white transition-all shadow-lg shadow-yellow-500/10 active:scale-95"
            >
              <Save size={16} /> Update Monthly Revenue
            </button>
          </div>
        </div>

        {/* ROW 2: DAILY REPORT DOWNLOADER */}
        <div className={`p-6 md:p-8 rounded-[2.5rem] border transition-all ${
          isDark ? 'bg-zinc-900 border-white/5 shadow-2xl' : 'bg-white border-black/5 shadow-xl'
        }`}>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 shrink-0">
                <FileText size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-yellow-500 tracking-widest">Daily Report</p>
                <h2 className="text-base md:text-lg font-black italic uppercase tracking-tight">
                  Export Transactions
                </h2>
              </div>
            </div>

            {/* Date Picker */}
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shrink-0 ${
              isDark ? 'bg-black/40 border-white/5' : 'bg-zinc-50 border-black/10'
            }`}>
              <Calendar className="text-yellow-500 shrink-0" size={16} />
              <input
                type="date" value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="bg-transparent font-black text-xs uppercase outline-none text-zinc-500 focus:text-yellow-500 transition-colors cursor-pointer"
              />
            </div>
          </div>

          {/* Live Summary Preview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <ReportStatBox label="Transactions" value={reportData.totalTransactions} color="text-white" isDark={isDark} />
            <ReportStatBox label="Total Revenue" value={`UGX ${reportData.totalRevenue.toLocaleString()}`} color="text-yellow-500" isDark={isDark} />
            <ReportStatBox label="Cash" value={`UGX ${reportData.totalCash.toLocaleString()}`} color="text-emerald-500" isDark={isDark} />
            <ReportStatBox label="Momo" value={`UGX ${reportData.totalMomo.toLocaleString()}`} color="text-yellow-400" isDark={isDark} />
            <ReportStatBox label="Card" value={`UGX ${reportData.totalCard.toLocaleString()}`} color="text-blue-500" isDark={isDark} />
          </div>

          {/* Progress Bar toward monthly goal */}
          {monthTarget.revenue > 0 && (
            <div className={`rounded-2xl border p-4 mb-6 ${
              isDark ? 'bg-black/30 border-white/5' : 'bg-zinc-50 border-black/5'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">
                  Monthly Progress — {currentMonthKey}
                </p>
                <p className={`text-[9px] font-black uppercase tracking-widest ${
                  Number(progressPercent) >= 100 ? 'text-emerald-500' : 'text-yellow-500'
                }`}>
                  {progressPercent}%
                </p>
              </div>
              <div className={`w-full h-2 rounded-full overflow-hidden ${
                isDark ? 'bg-zinc-800' : 'bg-zinc-200'
              }`}>
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    Number(progressPercent) >= 100 ? 'bg-emerald-500' : 'bg-yellow-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <p className="text-[8px] text-zinc-600 font-bold uppercase">
                  UGX {reportData.totalRevenue.toLocaleString()} today
                </p>
                <p className="text-[8px] text-zinc-600 font-bold uppercase">
                  Goal: UGX {monthTarget.revenue.toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Download Button */}
          <button
            onClick={handleDownloadReport}
            disabled={reportData.totalTransactions === 0}
            className="w-full py-4 rounded-2xl font-black uppercase italic text-xs tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 bg-yellow-500 text-black hover:bg-white shadow-yellow-500/10 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
          >
            <Download size={16} />
            {reportData.totalTransactions === 0
              ? `No Data for ${reportDate}`
              : `Download Report — ${reportData.totalTransactions} Orders`
            }
          </button>
        </div>

        {/* ROW 3: BOTTOM SUMMARY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryBox
            label="Current Active Staff"
            value={`${staffList.length} Personnel`}
            isDark={isDark}
          />
          <SummaryBox
            label="Target Sales / Day"
            value={`UGX ${Math.round(revenueGoal / 30).toLocaleString()}`}
            valueColor="text-emerald-500"
            isDark={isDark}
          />
          <SummaryBox
            label="System Status"
            value="CLOUD SYNC ACTIVE"
            valueColor="text-yellow-500"
            isDark={isDark}
          />
        </div>

      </div>
    </div>
  );
}

function ReportStatBox({ label, value, color, isDark }) {
  return (
    <div className={`p-4 rounded-2xl border text-center ${
      isDark ? 'bg-black/30 border-white/5' : 'bg-zinc-50 border-black/5'
    }`}>
      <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-sm font-black italic truncate ${color}`}>{value}</p>
    </div>
  );
}

function SummaryBox({ label, value, valueColor = "text-white", isDark }) {
  return (
    <div className={`p-6 rounded-[2rem] border ${
      isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-black/5'
    }`}>
      <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">{label}</p>
      <p className={`text-xl font-black italic ${valueColor}`}>{value}</p>
    </div>
  );
}