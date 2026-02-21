import React, { useState, useMemo } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { 
  Calendar, 
  Download, 
  TrendingUp, 
  Users, 
  ChevronRight, 
  FileText,
  Target
} from "lucide-react";

export default function PerformanceReports() {
  const { theme } = useTheme();
  const { orders, monthlyTargets } = useData();
  
  // 1. Default to today's date (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // 2. Logic to filter and calculate report data
  const reportData = useMemo(() => {
    const dailyOrders = orders.filter(order => 
      order.date === selectedDate && order.status === "CLOSED"
    );

    const totalSales = dailyOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    
    // Group sales by Waiter name
    const waiterStats = dailyOrders.reduce((acc, order) => {
      const name = order.waiter || "Unknown Waiter";
      acc[name] = (acc[name] || 0) + (order.total || 0);
      return acc;
    }, {});

    return { orders: dailyOrders, totalSales, waiterStats };
  }, [orders, selectedDate]);

  // 3. Get targets for the selected month
  const currentMonthKey = selectedDate.substring(0, 7); // Result: "2026-05"
  const monthTarget = monthlyTargets[currentMonthKey] || { revenue: 0, waiterQuota: 0 };

  // 4. CSV Download Function
  const handleDownload = () => {
    const csvRows = [
      ["Order ID", "Table", "Waiter", "Amount", "Time", "Payment Method"], // Headers
      ...reportData.orders.map(o => [
        o.id, 
        o.name || o.table, 
        o.waiter, 
        o.total, 
        o.time, 
        o.paymentMethod || "CASH"
      ])
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Kurax_Report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const isDark = theme === 'dark';

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      
      {/* HEADER & DATE SELECTOR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-5xl font-black italic uppercase tracking-tighter leading-none">
            Analytics
          </h1>
          <p className="text-yellow-500 text-[10px] font-bold tracking-[0.3em] uppercase mt-2 italic">
            Daily Performance & Audit logs
          </p>
        </div>

        <div className={`flex items-center gap-4 p-4 rounded-[2rem] border transition-all ${
          isDark ? 'bg-zinc-900 border-white/5' : 'bg-white border-black/5 shadow-sm'
        }`}>
          <Calendar className="text-yellow-500" size={20} />
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent font-black uppercase text-xs outline-none text-zinc-500 focus:text-yellow-500 transition-colors cursor-pointer"
          />
        </div>
      </div>

      {/* TOP LEVEL STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          label="Gross Revenue" 
          value={`UGX ${reportData.totalSales.toLocaleString()}`} 
          icon={<TrendingUp size={24} />} 
          isDark={isDark} 
        />
        <StatCard 
          label="Transactions" 
          value={reportData.orders.length} 
          icon={<FileText size={24} />} 
          isDark={isDark} 
        />
        <StatCard 
          label="Monthly Revenue Goal" 
          value={`UGX ${monthTarget.revenue.toLocaleString()}`} 
          icon={<Target size={24} />} 
          isDark={isDark} 
          subText={`${((reportData.totalSales / (monthTarget.revenue || 1)) * 100).toFixed(1)}% of Target`}
        />
      </div>

      {/* WAITER LEADERBOARD */}
      <div className={`rounded-[3rem] border p-8 ${
        isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-black/5'
      }`}>
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-500 flex items-center justify-center text-black">
              <Users size={20} />
            </div>
            <h2 className="text-lg font-black italic uppercase tracking-tighter">Staff Performance</h2>
          </div>
          
          <button 
            onClick={handleDownload}
            disabled={reportData.orders.length === 0}
            className="flex items-center gap-2 bg-yellow-500 text-black px-8 py-4 rounded-2xl font-black text-[10px] uppercase italic tracking-widest hover:bg-white hover:scale-105 transition-all disabled:opacity-50 disabled:grayscale"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>

        <div className="space-y-4">
          {Object.entries(reportData.waiterStats).length > 0 ? (
            Object.entries(reportData.waiterStats).map(([name, total]) => (
              <div key={name} className={`flex items-center justify-between p-6 rounded-3xl border ${
                isDark ? 'bg-black/20 border-white/5' : 'bg-zinc-50 border-black/5'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black italic text-sm ${
                    isDark ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-900 border border-black/5'
                  }`}>
                    {name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-black italic uppercase text-sm tracking-tight">{name}</p>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Waitstaff Member</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-lg font-black text-emerald-500 italic leading-none">
                    UGX {total.toLocaleString()}
                  </p>
                  <p className={`text-[9px] font-black uppercase mt-1 ${
                    total >= monthTarget.waiterQuota ? 'text-yellow-500' : 'text-zinc-500'
                  }`}>
                    {total >= monthTarget.waiterQuota ? '★ QUOTA ACHIEVED' : `GOAL: UGX ${monthTarget.waiterQuota.toLocaleString()}`}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 border-2 border-dashed border-zinc-800 rounded-[2rem]">
              <p className="text-zinc-500 font-black italic uppercase text-xs tracking-widest">No transaction data for this date</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Internal Stat Card Component
function StatCard({ label, value, icon, isDark, subText }) {
  return (
    <div className={`p-8 rounded-[2.5rem] border flex flex-col gap-6 transition-all hover:scale-[1.02] ${
      isDark ? 'bg-zinc-900/60 border-white/5' : 'bg-white border-black/5 shadow-sm'
    }`}>
      <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20">
        {icon}
      </div>
      <div>
        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1">{label}</p>
        <p className="text-3xl font-black italic tracking-tighter leading-none">{value}</p>
        {subText && <p className="text-[8px] font-bold text-emerald-500 uppercase mt-3 tracking-widest leading-none">{subText}</p>}
      </div>
    </div>
  );
}