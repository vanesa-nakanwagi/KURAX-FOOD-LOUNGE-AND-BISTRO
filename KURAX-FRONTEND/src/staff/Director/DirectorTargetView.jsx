import React, { useState, useMemo } from "react";
import { useData } from "../../customer/components/context/DataContext";
import { useTheme } from "../../customer/components/context/ThemeContext";
import {
  Target, TrendingUp, Zap, Calendar, Activity,
  ChevronLeft, ChevronRight, BarChart3, Clock, AlertCircle
} from "lucide-react";

// --- HELPERS ---
function fmtUGX(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

export default function DirectorTargetView() {
  const { theme } = useTheme();
  const { orders = [], monthlyTargets = {}, refreshData } = useData();
  const dark = theme === "dark";

  // Month selection
  const [viewDate, setViewDate] = useState(new Date());
  const monthKey = viewDate.toISOString().substring(0, 7);
  const monthLabel = viewDate.toLocaleString("default", { month: "long", year: "numeric" }).toUpperCase();

  // Read target from context (set by manager)
  const target = monthlyTargets?.[monthKey] ?? { revenue: 0 };
  const targetRevenue = Number(target.revenue) || 0;

  // Revenue calculation from orders (only paid/archived orders)
  const filteredOrders = useMemo(() => {
    return (orders || []).filter(o => {
      const orderDate = o.date || o.timestamp;
      const isCorrectMonth = orderDate && orderDate.toString().startsWith(monthKey);
      const isSuccessful = o.is_archived === true || o.status === "Paid" || o.status === "CLOSED";
      return isCorrectMonth && isSuccessful;
    });
  }, [orders, monthKey]);

  const actualSales = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [filteredOrders]);

  // Last update timestamp
  const lastUpdate = useMemo(() => {
    if (filteredOrders.length === 0) return "No sales yet";
    const timestamps = filteredOrders
      .map(o => new Date(o.timestamp || o.date).getTime())
      .filter(t => !isNaN(t));
    if (timestamps.length === 0) return "Waiting for data...";
    return new Date(Math.max(...timestamps)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [filteredOrders]);

  // Projection logic
  const isCurrentMonth = monthKey === new Date().toISOString().substring(0, 7);
  const totalDays = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const elapsedDays = isCurrentMonth ? new Date().getDate() : totalDays;
  const dailyAvg = actualSales / (elapsedDays || 1);
  const projectedRevenue = dailyAvg * totalDays;
  const progress = targetRevenue > 0 ? Math.min((actualSales / targetRevenue) * 100, 100) : 0;
  const dailyPaceNeeded = totalDays - elapsedDays > 0 ? (targetRevenue - actualSales) / (totalDays - elapsedDays) : 0;
  const isOnTrack = projectedRevenue >= targetRevenue;

  const handleMonthChange = (offset) => {
    const d = new Date(viewDate);
    d.setMonth(d.getMonth() + offset);
    setViewDate(d);
  };

  // Theme classes
  const textClass = dark ? "text-white" : "text-gray-900";
  const subtextClass = dark ? "text-zinc-400" : "text-gray-500";
  const mainCardBg = dark ? "bg-yellow-400 border-white/10" : "bg-white border-gray-200 shadow-sm";
  const miniCardBg = dark ? "bg-zinc-900 border-white/10" : "bg-white border-gray-200 shadow-sm";

  return (
    <div className={`space-y-6 font-[Outfit] pb-10 transition-colors duration-300 ${textClass}`}>
      {/* Header with month picker */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-[900] uppercase italic tracking-tighter">Director Dashboard</h2>
          <div className="flex items-center gap-3 mt-1 text-yellow-500">
            <button onClick={() => handleMonthChange(-1)} className="p-1 rounded-lg hover:bg-white/10 transition-all">
              <ChevronLeft size={20} />
            </button>
            <span className="text-[10px] font-black tracking-widest uppercase">{monthLabel}</span>
            <button onClick={() => handleMonthChange(1)} className="p-1 rounded-lg hover:bg-white/10 transition-all">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        {/* No edit button – read‑only */}
      </div>

      {/* Main target card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 p-8 rounded-[2.5rem] border relative overflow-hidden ${mainCardBg}`}>
          <div className={`absolute top-8 right-8 flex items-center gap-2 px-3 py-1 rounded-full border ${dark ? "bg-zinc-800/50 border-white/10" : "bg-gray-100 border-gray-200"}`}>
            <Clock size={10} className={dark ? "text-zinc-400" : "text-gray-500"} />
            <span className={`text-[8px] font-black uppercase tracking-wider ${subtextClass}`}>Last update: {lastUpdate}</span>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-10">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${subtextClass}`}>Monthly Target</p>
              <h3 className="text-5xl font-[900] italic tracking-tighter">{fmtUGX(targetRevenue)}</h3>
            </div>
            <div className="text-right">
              <p className={`text-[10px] font-black text-emerald-500 uppercase tracking-widest`}>Actual Revenue</p>
              <h3 className="text-5xl font-[900] italic tracking-tighter text-emerald-500">{fmtUGX(actualSales)}</h3>
            </div>
          </div>

          <div className="space-y-3">
            <div className={`w-full h-3 rounded-full overflow-hidden ${dark ? "bg-zinc-800 border border-white/10" : "bg-gray-200"}`}>
              <div className="h-full bg-gradient-to-r from-yellow-500 to-yellow-600 shadow-[0_0_20px_rgba(234,179,8,0.3)] transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
              <span className={subtextClass}>Progress</span>
              <span className="text-yellow-500">{progress.toFixed(1)}% of target</span>
              <span className={subtextClass}>Target</span>
            </div>
          </div>
        </div>

        {/* Projection card */}
        <div className={`p-8 rounded-[2.5rem] border flex flex-col justify-between transition-all duration-300
          ${isOnTrack
            ? dark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"
            : dark ? "bg-rose-500/10 border-rose-500/20" : "bg-rose-50 border-rose-200"
          }`}>
          <div className="flex justify-between items-start">
            <BarChart3 className={isOnTrack ? "text-emerald-500" : "text-rose-500"} size={24} />
            <div className={`px-2 py-1 rounded text-[8px] font-black uppercase 
              ${isOnTrack
                ? (dark ? "bg-emerald-500 text-black" : "bg-emerald-600 text-white")
                : (dark ? "bg-rose-500 text-white" : "bg-rose-600 text-white")
              }`}>
              {isOnTrack ? 'On Track' : 'Behind Target'}
            </div>
          </div>
          <div className="mt-4">
            <p className={`text-[10px] font-black uppercase tracking-widest ${subtextClass} mb-1`}>Projected Month End</p>
            <h4 className={`text-4xl font-[900] italic tracking-tighter ${isOnTrack ? 'text-emerald-500' : 'text-rose-500'}`}>
              {fmtUGX(projectedRevenue)}
            </h4>
            <p className={`text-[9px] font-bold mt-2 uppercase italic leading-tight ${subtextClass}`}>
              Based on current daily average ({fmtUGX(dailyAvg)}/day)
            </p>
          </div>
        </div>
      </div>

      {/* Insight cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-6 rounded-2xl border transition-all duration-300 hover:border-yellow-500/30 hover:shadow-lg ${miniCardBg}`}>
          <Zap size={16} className="text-yellow-500 mb-3" />
          <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${subtextClass}`}>Daily Average</p>
          <p className={`text-xl font-[900] italic tracking-tighter ${textClass}`}>{fmtUGX(dailyAvg)}</p>
        </div>
        <div className={`p-6 rounded-2xl border transition-all duration-300 hover:border-yellow-500/30 hover:shadow-lg ${miniCardBg}`}>
          <TrendingUp size={16} className="text-yellow-500 mb-3" />
          <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${subtextClass}`}>Required / Day</p>
          <p className={`text-xl font-[900] italic tracking-tighter ${textClass}`}>{fmtUGX(Math.max(0, dailyPaceNeeded))}</p>
        </div>
        <div className={`p-6 rounded-2xl border transition-all duration-300 hover:border-yellow-500/30 hover:shadow-lg ${miniCardBg}`}>
          <Calendar size={16} className="text-yellow-500 mb-3" />
          <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${subtextClass}`}>Days Left</p>
          <p className={`text-xl font-[900] italic tracking-tighter ${textClass}`}>{isCurrentMonth ? totalDays - elapsedDays : 0}</p>
        </div>
        <div className={`p-6 rounded-2xl border transition-all duration-300 hover:border-yellow-500/30 hover:shadow-lg ${miniCardBg}`}>
          <Activity size={16} className="text-yellow-500 mb-3" />
          <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${subtextClass}`}>Status</p>
          <p className={`text-xl font-[900] italic tracking-tighter ${progress >= 100 ? 'text-emerald-500' : 'text-yellow-500'}`}>
            {progress >= 100 ? "TARGET MET" : "IN PROGRESS"}
          </p>
        </div>
      </div>

      {/* Warning when target not set (read‑only note) */}
      {targetRevenue === 0 && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${dark ? "bg-yellow-500/10 border-yellow-500/20" : "bg-yellow-50 border-yellow-200"}`}>
          <AlertCircle size={16} className="text-yellow-500" />
          <p className={`text-[10px] font-black uppercase tracking-widest ${dark ? "text-yellow-400" : "text-yellow-700"}`}>
            No revenue target set for {monthLabel}. Please ask the manager to set a target.
          </p>
        </div>
      )}
    </div>
  );
}