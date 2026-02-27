import React, { useState, useMemo } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { 
  Calendar, Download, TrendingUp, Users, FileText, Target
} from "lucide-react";

export default function PerformanceReports() {
  const { theme } = useTheme();
  const { orders = [], monthlyTargets = {} } = useData();
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const isDark = theme === 'dark';

  // --- CORE DATA: Flexible date matching + no status filter ---
  const reportData = useMemo(() => {
    const dailyOrders = orders.filter(order => {
      const orderDate = new Date(order.timestamp || order.date)
        .toISOString()
        .split('T')[0];
      return orderDate === selectedDate;
    });

    const totalSales = dailyOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    const waiterStats = dailyOrders.reduce((acc, order) => {
      const name = order.waiter_name || order.waiterName || order.waiter || "Unknown";
      acc[name] = (acc[name] || 0) + Number(order.total || 0);
      return acc;
    }, {});

    return { orders: dailyOrders, totalSales, waiterStats };
  }, [orders, selectedDate]);

  // --- MONTHLY TARGET: reads from same context TargetSettings writes to ---
  const currentMonthKey = selectedDate.substring(0, 7); // e.g. "2026-02"
  const monthTarget = monthlyTargets[currentMonthKey] || { revenue: 0, waiterQuota: 0 };

  // --- CSV DOWNLOAD ---
  const handleDownload = () => {
    if (reportData.orders.length === 0) {
      alert("No transactions found for this date.");
      return;
    }

    const csvRows = [
      [`KURAX FOOD LOUNGE & BISTRO — DAILY REPORT`],
      [`Date: ${selectedDate}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      [`Total Transactions`, reportData.orders.length],
      [`Total Revenue`, `UGX ${reportData.totalSales.toLocaleString()}`],
      [],
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
      csvRows.map(row => row.join(",")).join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Kurax_Report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Progress percentage toward monthly revenue goal
  const progressPercent = monthTarget.revenue > 0
    ? Math.min((reportData.totalSales / monthTarget.revenue) * 100, 100).toFixed(1)
    : 0;

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-700">
      
      {/* HEADER */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-none">
            Analytics
          </h1>
          <p className="text-yellow-500 text-[10px] font-bold tracking-[0.2em] md:tracking-[0.3em] uppercase mt-1 md:mt-2 italic">
            Daily Performance & Audit Logs
          </p>
        </div>
      </div>

      {/* TOP LEVEL STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <StatCard 
          label="Gross Revenue" 
          value={`UGX ${reportData.totalSales.toLocaleString()}`} 
          icon={<TrendingUp size={20} />} 
          isDark={isDark} 
        />
        <StatCard 
          label="Transactions" 
          value={reportData.orders.length} 
          icon={<FileText size={20} />} 
          isDark={isDark} 
        />
        {/* MONTHLY GOAL — now live from TargetSettings context */}
        <StatCard 
          label="Monthly Revenue Goal" 
          value={
            monthTarget.revenue > 0 
              ? `UGX ${monthTarget.revenue.toLocaleString()}` 
              : "No Goal Set"
          }
          icon={<Target size={20} />} 
          isDark={isDark} 
          subText={
            monthTarget.revenue > 0 
              ? `${progressPercent}% of target reached` 
              : "Set a goal in Performance Hub"
          }
          subTextColor={
            Number(progressPercent) >= 100 
              ? "text-emerald-500" 
              : Number(progressPercent) >= 50 
                ? "text-yellow-500" 
                : "text-zinc-500"
          }
        />
      </div>

      {/* MONTHLY GOAL PROGRESS BAR */}
      {monthTarget.revenue > 0 && (
        <div className={`rounded-2xl md:rounded-3xl border p-4 md:p-6 ${
          isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-black/5'
        }`}>
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">
              Monthly Progress — {currentMonthKey}
            </p>
            <p className={`text-[10px] font-black uppercase tracking-widest ${
              Number(progressPercent) >= 100 ? 'text-emerald-500' : 'text-yellow-500'
            }`}>
              {progressPercent}%
            </p>
          </div>
          <div className={`w-full h-2.5 rounded-full overflow-hidden ${
            isDark ? 'bg-zinc-800' : 'bg-zinc-100'
          }`}>
            <div 
              className={`h-full rounded-full transition-all duration-700 ${
                Number(progressPercent) >= 100 
                  ? 'bg-emerald-500' 
                  : 'bg-yellow-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <p className="text-[9px] text-zinc-600 font-bold uppercase">
              UGX {reportData.totalSales.toLocaleString()} earned today
            </p>
            <p className="text-[9px] text-zinc-600 font-bold uppercase">
              Goal: UGX {monthTarget.revenue.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* WAITER LEADERBOARD */}
      <div className={`rounded-[2rem] md:rounded-[3rem] border p-5 md:p-8 ${
        isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-black/5'
      }`}>
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-yellow-500 flex items-center justify-center text-black shrink-0">
              <Users size={18} />
            </div>
            <h2 className="text-base md:text-lg font-black italic uppercase tracking-tighter">
              Staff Performance
            </h2>
          </div>
          
          <button 
            onClick={handleDownload}
            disabled={reportData.orders.length === 0}
            className="flex items-center justify-center gap-2 bg-yellow-500 text-black px-5 py-3 md:px-8 md:py-4 rounded-2xl font-black text-[10px] uppercase italic tracking-widest hover:bg-white hover:scale-105 transition-all disabled:opacity-50 disabled:grayscale w-full sm:w-auto"
          >
            <Download size={14} /> 
            {reportData.orders.length === 0 
              ? "No Data to Export" 
              : `Export CSV — ${reportData.orders.length} Orders`
            }
          </button>
        </div>

        {/* Staff List */}
        <div className="space-y-3 md:space-y-4">
          {Object.entries(reportData.waiterStats).length > 0 ? (
            Object.entries(reportData.waiterStats)
              .sort(([, a], [, b]) => b - a) // Sort highest earner first
              .map(([name, total], index) => (
                <div key={name} className={`flex items-center justify-between p-4 md:p-6 rounded-2xl md:rounded-3xl border gap-3 ${
                  isDark ? 'bg-black/20 border-white/5' : 'bg-zinc-50 border-black/5'
                }`}>
                  {/* Left: Rank + Avatar + Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[10px] font-black w-5 shrink-0 ${
                      index === 0 ? 'text-yellow-500' : 'text-zinc-600'
                    }`}>
                      #{index + 1}
                    </span>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black italic text-sm shrink-0 ${
                      isDark ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-900 border border-black/5'
                    }`}>
                      {name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black italic uppercase text-xs md:text-sm tracking-tight truncate">{name}</p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Waitstaff</p>
                    </div>
                  </div>

                  {/* Right: Revenue + Quota */}
                  <div className="text-right shrink-0">
                    <p className="text-sm md:text-lg font-black text-emerald-500 italic leading-none">
                      UGX {total.toLocaleString()}
                    </p>
                    <p className={`text-[9px] font-black uppercase mt-1 ${
                      monthTarget.waiterQuota > 0 && total >= monthTarget.waiterQuota 
                        ? 'text-yellow-500' 
                        : 'text-zinc-500'
                    }`}>
                      {monthTarget.waiterQuota > 0
                        ? total >= monthTarget.waiterQuota 
                          ? '★ QUOTA HIT' 
                          : `GOAL: UGX ${monthTarget.waiterQuota.toLocaleString()}`
                        : "No quota set"
                      }
                    </p>
                  </div>
                </div>
              ))
          ) : (
            <div className="text-center py-12 md:py-20 border-2 border-dashed border-zinc-800 rounded-[2rem]">
              <p className="text-zinc-500 font-black italic uppercase text-xs tracking-widest px-4">
                No transaction data for {selectedDate}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, isDark, subText, subTextColor = "text-emerald-500" }) {
  return (
    <div className={`p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border flex flex-row md:flex-col items-center md:items-start gap-4 md:gap-6 transition-all hover:scale-[1.02] ${
      isDark ? 'bg-zinc-900/60 border-white/5' : 'bg-white border-black/5 shadow-sm'
    }`}>
      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1">{label}</p>
        <p className="text-xl md:text-3xl font-black italic tracking-tighter leading-none truncate">{value}</p>
        {subText && (
          <p className={`text-[8px] font-bold uppercase mt-2 tracking-widest ${subTextColor}`}>
            {subText}
          </p>
        )}
      </div>
    </div>
  );
}