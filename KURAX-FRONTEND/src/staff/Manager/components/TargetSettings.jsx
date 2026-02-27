import React, { useState } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { Target, TrendingUp, Users, Save, CalendarDays, ShoppingBag } from "lucide-react";

export default function TargetSettings() {
  const { 
    dailyGoal, setDailyGoal, 
    monthlyTargets, updateMonthlyTarget, 
    staffList = [] 
  } = useData() || {};
  const { theme } = useTheme();

  // 1. Logic for existing Daily Order Target (Waiters)
  const handleDailyOrderChange = (e) => {
    setDailyGoal(Number(e.target.value));
  };

  // 2. Logic for new Monthly Sales Target (Manager)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [revenueGoal, setRevenueGoal] = useState(
  (monthlyTargets && monthlyTargets[selectedMonth]?.revenue) || 0
);

const handleMonthChange = (e) => {
  const month = e.target.value;
  setSelectedMonth(month);
  // 2. Safe update for revenueGoal
  setRevenueGoal((monthlyTargets && monthlyTargets[month]?.revenue) || 0);
};

const handleSaveMonthly = () => {
  // 3. Safe check for currentQuota
  const currentQuota = (monthlyTargets && monthlyTargets[selectedMonth]?.waiterQuota) || 0;
  updateMonthlyTarget(selectedMonth, Number(revenueGoal), currentQuota);
  alert(`Monthly Revenue Goal for ${selectedMonth} updated!`);
};

  const isDark = theme === 'dark';

  return (
    <div className={`p-8 min-h-screen font-[Outfit] transition-colors duration-300 ${
      isDark ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'
    }`}>
      <div className="max-w-5xl">
        <div className="mb-10">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic flex items-center gap-3">
            <Target className="text-yellow-500" size={36} />
            Performance Hub
          </h1>
          <p className="text-zinc-500 text-xs font-bold uppercase mt-2 tracking-widest">
            Manage staff order targets & business revenue goals
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* SECTION A: STAFF ORDER TARGET (Maintained your existing logic) */}
          <div className={`p-8 rounded-[3rem] border transition-all ${
            isDark ? 'bg-zinc-900 border-white/5 shadow-2xl' : 'bg-white border-black/5 shadow-xl'
          }`}>
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                    <ShoppingBag size={14} className="text-yellow-500" />
                    <p className="text-[10px] font-black uppercase text-yellow-500 tracking-widest">Floor Staff Target</p>
                </div>
                <h2 className="text-5xl font-black tracking-tighter italic">
                  {dailyGoal || 20}<span className="text-xs text-zinc-500 ml-2 uppercase not-italic">Orders / Day</span>
                </h2>
              </div>
              <Users className="text-zinc-700" size={32} />
            </div>

            <div className="space-y-6">
              <input 
                type="range" 
                min="5" 
                max="100" 
                step="5"
                value={dailyGoal || 20}
                onChange={handleDailyOrderChange}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
              <div className="flex justify-between text-[9px] font-black uppercase text-zinc-500 italic tracking-widest">
                <span>Min: 5 Orders</span>
                <span>Max: 100 Orders</span>
              </div>
            </div>
          </div>

          {/* SECTION B: MONTHLY SALES TARGET (New Manager Feature) */}
          <div className={`p-8 rounded-[3rem] border transition-all ${
            isDark ? 'bg-zinc-900 border-white/5 shadow-2xl' : 'bg-white border-black/5 shadow-xl'
          }`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-emerald-500" />
                    <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Business Revenue Goal</p>
                </div>
                <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={handleMonthChange}
                    className="bg-transparent font-black uppercase text-[10px] outline-none border border-zinc-800 rounded-lg px-2 py-1 text-zinc-400"
                />
            </div>

            <div className="relative mb-6">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-zinc-500 font-black text-sm ml-1 uppercase">UGX</span>
              <input 
                type="number"
                value={revenueGoal}
                onChange={(e) => setRevenueGoal(e.target.value)}
                className="w-full bg-transparent border-b-2 border-zinc-800 py-2 pl-10 text-4xl font-black outline-none focus:border-yellow-500 transition-colors"
                placeholder="0"
              />
            </div>

            <button 
              onClick={handleSaveMonthly}
              className="w-full py-4 bg-yellow-500 text-black rounded-2xl font-black uppercase italic text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-white transition-all shadow-lg shadow-yellow-500/10"
            >
              <Save size={16} /> Update Monthly Revenue
            </button>
          </div>

        </div>

        {/* BOTTOM SUMMARY INFO */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-black/5'}`}>
                <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Current Active Staff</p>
                <p className="text-xl font-black italic">{staffList.length} Personnel</p>
            </div>
            <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-black/5'}`}>
                <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Target Sales / Day</p>
                <p className="text-xl font-black italic text-emerald-500">UGX {Math.round(revenueGoal / 30).toLocaleString()}</p>
            </div>
            <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-black/5'}`}>
                <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">System Status</p>
                <p className="text-xl font-black italic text-yellow-500">CLOUD SYNC ACTIVE</p>
            </div>
        </div>
      </div>
    </div>
  );
}