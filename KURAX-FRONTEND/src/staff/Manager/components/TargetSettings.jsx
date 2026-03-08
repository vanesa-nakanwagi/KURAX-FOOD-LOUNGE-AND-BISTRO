import React, { useState, useMemo } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import API_URL from "../../../config/api"; // Ensure this path correctly points to your API_URL
import { 
  Target, TrendingUp, ShoppingBag, 
  Calendar, Download, FileText, Lock, CheckCircle2, Loader2
} from "lucide-react";

// --- HELPERS ---
function fmtUGX(n) {
  return `UGX ${Number(n).toLocaleString()}`;
}

export default function TargetSettings() {
  const { 
    dailyGoal, setDailyGoal, 
    monthlyTargets = {}, 
    orders = [],
  } = useData() || {};
  const { theme } = useTheme();

  const isDark = theme === 'dark';
  const [isSaving, setIsSaving] = useState(false);

  // --- Display State for Director's Revenue Target ---
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  
  // 1. UPDATED REVENUE CALCULATION: Matches Director's logic using is_archived and Paid
  const monthlyActualRevenue = useMemo(() => {
    return orders
      .filter(o => {
        const orderDate = (o.timestamp || o.date || "").toString();
        // Check for specific month and verified payment status
        return (
          orderDate.startsWith(selectedMonth) && 
          (o.is_archived === true || o.status === "Paid" || o.status === "CLOSED")
        );
      })
      .reduce((sum, o) => sum + Number(o.total || 0), 0);
  }, [orders, selectedMonth]);

  const revenueGoal = useMemo(() => {
    return monthlyTargets[selectedMonth]?.revenue || 0;
  }, [selectedMonth, monthlyTargets]);

  // Progress Percentage
  const progressPercent = revenueGoal > 0 
    ? Math.min((monthlyActualRevenue / revenueGoal) * 100, 100).toFixed(1) 
    : 0;

  // 2. STAFF ORDER GOAL PERSISTENCE: Saves to database when slider moves
  const handleStaffGoalChange = async (value) => {
    setDailyGoal(value); // Update UI immediately for responsiveness
    
    try {
      setIsSaving(true);
      const response = await fetch(`${API_URL}/api/manager/staff-goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_count_goal: value })
      });

      if (!response.ok) throw new Error("Failed to sync goal");
    } catch (err) {
      console.error("Staff Goal Sync Error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Daily Report Logic ---
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  const reportData = useMemo(() => {
    const dailyOrders = orders.filter(order => {
      const orderDate = new Date(order.timestamp || order.date).toISOString().split('T')[0];
      // Updated to match the business definition of a completed transaction
      return orderDate === reportDate && (order.is_archived || order.status === "Paid" || order.status === "CLOSED");
    });

    const getSum = (method) => dailyOrders
      .filter(o => (o.payment_method || "").toUpperCase().includes(method))
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    return {
      orders: dailyOrders,
      totalTransactions: dailyOrders.length,
      totalRevenue: dailyOrders.reduce((sum, o) => sum + Number(o.total || 0), 0),
      totalCash: getSum('CASH'),
      totalMomo: getSum('MTN') + getSum('AIRTEL'),
      totalCard: getSum('CARD') + getSum('POS') + getSum('VISA'),
    };
  }, [orders, reportDate]);

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
      [`Mobile Money`, `UGX ${reportData.totalMomo.toLocaleString()}`],
      [`Card/POS`, `UGX ${reportData.totalCard.toLocaleString()}`],
      [],
      [`ORDER BREAKDOWN`],
      [`Order ID`, `Waiter`, `Table`, `Amount (UGX)`, `Payment Method`, `Time`],
      ...reportData.orders.map(o => [
        o.id || "N/A",
        o.waiter_name || "—",
        o.table_name || "—",
        Number(o.total || 0),
        o.payment_method || "—",
        o.timestamp ? new Date(o.timestamp).toLocaleTimeString() : "—"
      ])
    ];

    const csvContent = "data:text/csv;charset=utf-8," + 
      summaryRows.map(row => row.join(",")).join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Kurax_Report_${reportDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cardClass = isDark ? "bg-zinc-900/40 border-white/5 shadow-2xl" : "bg-white border-black/5 shadow-xl";

  return (
    <div className={`p-4 md:p-8 min-h-screen font-[Outfit] ${isDark ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'}`}>
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter flex items-center gap-3">
              <Target className="text-yellow-500" size={32} />
              Performance Hub
            </h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Manager Overview</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* DAILY ORDER GOAL (EDITABLE BY MANAGER + SAVES TO DB) */}
          <div className={`p-8 rounded-[2.5rem] border flex flex-col justify-between transition-all ${cardClass}`}>
            <div>
                <div className="flex justify-between items-start">
                  <p className="text-[10px] font-black uppercase text-yellow-500 tracking-widest mb-6">Staff Order Goal</p>
                  {isSaving && <Loader2 className="animate-spin text-zinc-500" size={12} />}
                </div>
                <h2 className="text-5xl font-black tracking-tighter italic mb-4">
                  {dailyGoal || 20}<span className="text-sm text-zinc-500 italic ml-2">Orders/Day</span>
                </h2>
                <input
                  type="range" min="5" max="200" step="5"
                  value={dailyGoal || 20}
                  onChange={(e) => handleStaffGoalChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                />
            </div>
            <p className="text-[9px] text-zinc-500 font-bold uppercase mt-6 italic">Manager-controlled target for floor efficiency</p>
          </div>

          {/* MONTHLY REVENUE (READ-ONLY DIRECTOR TARGET) */}
          <div className={`p-8 rounded-[2.5rem] border relative overflow-hidden flex flex-col ${cardClass}`}>
            <Lock className="absolute -right-4 -top-4 text-white/5 w-32 h-32 rotate-12" />
            
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest italic">Revenue Objective</p>
                <Lock size={10} className="text-zinc-600" />
              </div>
              <input
                type="month" value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-zinc-800/50 font-black text-[10px] border border-zinc-700 rounded-lg px-2 py-1 outline-none text-zinc-400"
              />
            </div>

            <div className="relative mb-6 z-10">
              <h3 className="text-4xl md:text-5xl font-black tracking-tighter italic">
                {fmtUGX(revenueGoal)}
              </h3>
              <p className="text-zinc-500 font-black text-[9px] uppercase mt-1 tracking-widest italic">Director's Set Target</p>
            </div>

            {/* PROGRESS BAR SECTION */}
            <div className="mt-auto space-y-3 relative z-10">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black uppercase text-zinc-400">Monthly Completion</span>
                <span className="text-xl font-black italic text-emerald-500">{progressPercent}%</span>
              </div>
              <div className="w-full h-2.5 bg-black/40 rounded-full border border-white/5 overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all duration-1000"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-zinc-600">
                <span>Earned: {fmtUGX(monthlyActualRevenue)}</span>
                {Number(progressPercent) >= 100 && <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10}/> GOAL MET</span>}
              </div>
            </div>
          </div>
        </div>

        {/* EXPORT SECTION */}
        <div className={`p-8 rounded-[3rem] border ${cardClass}`}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-yellow-500/10 rounded-2xl text-yellow-500"><FileText /></div>
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Reports</p>
                <h2 className="text-xl font-black italic uppercase">Export Transactions</h2>
              </div>
            </div>
            <input
              type="date" value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="px-4 py-3 rounded-xl font-black text-xs uppercase bg-black/40 border border-zinc-800 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            <StatBox label="Orders" value={reportData.totalTransactions} color="text-white" isDark={isDark} />
            <StatBox label="Revenue Today" value={fmtUGX(reportData.totalRevenue)} color="text-yellow-500" isDark={isDark} />
            <StatBox label="Cash" value={fmtUGX(reportData.totalCash)} color="text-emerald-500" isDark={isDark} />
            <StatBox label="Mobile Money" value={fmtUGX(reportData.totalMomo)} color="text-yellow-400" isDark={isDark} />
            <StatBox label="Card/POS" value={fmtUGX(reportData.totalCard)} color="text-blue-400" isDark={isDark} />
          </div>

          <button
            onClick={handleDownloadReport}
            disabled={reportData.totalTransactions === 0}
            className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase italic text-xs flex items-center justify-center gap-3 hover:bg-yellow-500 transition-all disabled:opacity-20 shadow-xl"
          >
            <Download size={18} /> {reportData.totalTransactions === 0 ? "No Data Available" : "Download Daily CSV"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color, isDark }) {
  return (
    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-black/40 border-white/5' : 'bg-zinc-50 border-black/5'}`}>
      <p className="text-[8px] font-black text-zinc-500 uppercase mb-1 tracking-widest">{label}</p>
      <p className={`text-sm font-black italic truncate ${color}`}>{value}</p>
    </div>
  );
}