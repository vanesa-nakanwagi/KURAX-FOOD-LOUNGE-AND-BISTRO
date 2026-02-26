import React from "react";
import { useData } from "../../customer/components/context/DataContext";
import { useTheme } from "../../customer/components/context/ThemeContext";
import { Target, ArrowUpRight, TrendingUp } from "lucide-react";

export default function DirectorTargetView() {
  const { theme } = useTheme();
  // Ensure we provide default empty arrays/objects to prevent 'undefined' crashes
  const { orders = [], monthlyTargets = {}, loading } = useData();

  // 1. Get current month key (e.g., "2026-02")
  const currentMonthKey = new Date().toISOString().substring(0, 7);
  
  // SAFETY: Use optional chaining ?. and provide a default object
  const target = monthlyTargets?.[currentMonthKey] || { revenue: 0 };

  // 2. Calculate Actual Sales
  const actualSales = (orders || [])
    .filter(o => {
      // Safety check: ensure 'o' exists, 'o.date' exists and matches current month
      return (
        o && 
        typeof o.date === 'string' && 
        o.date.startsWith(currentMonthKey) && 
        o.status === "CLOSED"
      );
    })
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  // 3. Calculate percentage (Prevent Division by Zero)
  const targetRevenue = Number(target.revenue) || 0;
  const progress = targetRevenue > 0 ? (actualSales / targetRevenue) * 100 : 0;
  const isDark = theme === 'dark';

  // 4. Loading State UI
  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-zinc-500 font-black animate-pulse uppercase tracking-widest text-xs">
          Synchronizing Live Targets...
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-700">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">Manager's Goal</h2>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Target vs. Actual Performance</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-yellow-500 uppercase">Current Month</p>
          <p className="text-xl font-black italic">
            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase()}
          </p>
        </div>
      </div>

      <div className={`p-10 rounded-[3rem] border ${isDark ? 'bg-zinc-900 border-white/5' : 'bg-white border-black/5'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-10">
          {/* Target Set by Manager */}
          <div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">Target Set by Manager</p>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-black text-zinc-500 uppercase">UGX</span>
              <h3 className={`text-5xl font-black italic tracking-tighter ${isDark ? 'text-white' : 'text-black'}`}>
                {targetRevenue.toLocaleString()}
              </h3>
            </div>
          </div>

          {/* Actual Realized Revenue */}
          <div>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-2">Actual Revenue (Live)</p>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-black text-emerald-500 uppercase">UGX</span>
              <h3 className="text-5xl font-black italic tracking-tighter text-emerald-500">
                {actualSales.toLocaleString()}
              </h3>
            </div>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <p className="text-[10px] font-black uppercase italic tracking-widest text-zinc-400">Monthly Completion</p>
            <p className="text-2xl font-black italic text-yellow-500">{progress.toFixed(1)}%</p>
          </div>
          <div className="w-full h-4 bg-black rounded-full overflow-hidden border border-white/5 p-1">
            <div 
              className="h-full bg-yellow-500 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(234,179,8,0.5)]" 
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* QUICK INSIGHTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InsightCard 
          label="Remaining Balance" 
          value={`UGX ${Math.max(0, targetRevenue - actualSales).toLocaleString()}`} 
          icon={<ArrowUpRight size={18}/>}
          isDark={isDark}
        />
        <InsightCard 
          label="Daily Required Pace" 
          value={`UGX ${Math.round((targetRevenue - actualSales) / 10).toLocaleString()}`} 
          icon={<TrendingUp size={18}/>}
          isDark={isDark}
        />
        <InsightCard 
          label="Target Integrity" 
          value={targetRevenue > 0 ? "VERIFIED" : "NOT SET"} 
          icon={<Target size={18}/>}
          isDark={isDark}
        />
      </div>
    </div>
  );
}

function InsightCard({ label, value, icon, isDark }) {
  return (
    <div className={`p-6 rounded-3xl border flex items-center gap-4 transition-all hover:scale-105 ${isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-black/5 shadow-sm'}`}>
      <div className="p-3 bg-zinc-800 rounded-2xl text-yellow-500">{icon}</div>
      <div>
        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{label}</p>
        <p className="text-lg font-black italic tracking-tighter">{value}</p>
      </div>
    </div>
  );
}