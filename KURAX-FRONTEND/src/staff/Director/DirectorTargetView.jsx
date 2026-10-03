import React, { useState, useEffect } from "react";
import { useTheme } from "../../customer/components/context/ThemeContext";
import MonthlyFinancialBreakdown from "../components/MonthlyFinancialBreakdown";
import API_URL from "../../config/api";
import {
  Target, TrendingUp, Zap, Calendar, Activity,
  ChevronLeft, ChevronRight, BarChart3, Clock, AlertCircle, CheckCircle2, Lock
} from "lucide-react";

// ✅ FULL NUMBER FORMATTER (no abbreviation)
function formatFullAmount(n) {
  const num = Number(n) || 0;
  return `UGX ${num.toLocaleString()}`;
}

export default function DirectorTargetView() {
  const { theme } = useTheme();
  const dark = theme === "dark";

  const [viewDate, setViewDate] = useState(new Date());
  const monthKey = viewDate.toISOString().substring(0, 7);
  const monthLabel = viewDate.toLocaleString("default", { month: "long", year: "numeric" }).toUpperCase();

  const [targetSummary, setTargetSummary] = useState({
    target: 7000000,
    grossSales: 0,
    creditSettlements: 0,
    expenses: 0,
    currentCash: 0,
    remaining: 7000000,
    percentage: 0,
  });

  useEffect(() => {
    const fetchTargetSummary = async () => {
      try {
        const res = await fetch(`${API_URL}/api/manager/target-progress?month=${monthKey}`);
        if (res.ok) {
          setTargetSummary(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch monthly target summary:", err);
      }
    };
    fetchTargetSummary();
  }, [monthKey]);

  const monthlyTarget = Number(targetSummary.target ?? 7000000);
  const grossSales = Number(targetSummary.grossSales) || 0;
  const creditSettlements = Number(targetSummary.creditSettlements) || 0;
  const expenses = Number(targetSummary.expenses) || 0;
  const currentCash = Number(targetSummary.currentCash) || 0;

  const isCurrentMonth = monthKey === new Date().toISOString().substring(0, 7);
  const totalDays = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const elapsedDays = isCurrentMonth ? new Date().getDate() : totalDays;
  const dailyAvg = grossSales / (elapsedDays || 1);
  const projectedRevenue = dailyAvg * totalDays;
  const progress = Number(targetSummary.percentage) || 0;
  const dailyPaceNeeded = totalDays - elapsedDays > 0 ? (monthlyTarget - grossSales) / (totalDays - elapsedDays) : 0;
  const isOnTrack = projectedRevenue >= monthlyTarget;

  const handleMonthChange = (offset) => {
    const d = new Date(viewDate);
    d.setMonth(d.getMonth() + offset);
    setViewDate(d);
  };

  const getProgressColor = (pct) => {
    if (pct >= 75) return "text-emerald-500";
    if (pct >= 50) return "text-yellow-500";
    if (pct >= 25) return "text-orange-500";
    return "text-red-500";
  };

  const textClass = dark ? "text-white" : "text-gray-900";
  const subtextClass = dark ? "text-zinc-400" : "text-gray-500";
  const cardBg = dark ? "bg-zinc-900/40 border-white/5" : "bg-white border-black/5 shadow-sm";
  const miniCardBg = dark ? "bg-zinc-900 border-white/10" : "bg-white border-gray-200 shadow-sm";

  return (
    <div className={`space-y-6 font-[Outfit] pb-10 transition-colors duration-300 ${textClass}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-[900] uppercase italic tracking-tighter">Director Dashboard</h2>
          <div className="flex items-center gap-3 mt-1 text-yellow-500">
            <button onClick={() => handleMonthChange(-1)} className="p-1 rounded-lg hover:bg-white/10 transition-all"><ChevronLeft size={20} /></button>
            <span className="text-[10px] font-black tracking-widest uppercase">{monthLabel}</span>
            <button onClick={() => handleMonthChange(1)} className="p-1 rounded-lg hover:bg-white/10 transition-all"><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
      <div className={`rounded-2xl border relative overflow-hidden transition-all duration-300 hover:shadow-xl ${cardBg}`}>
        <Lock className="absolute -right-4 -top-4 text-white/5 w-24 h-24 rotate-12" />
        <div className="flex justify-between items-start p-6 relative z-10">
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${subtextClass}`}>Monthly Target</p>
            <h3 className="text-2xl font-black tracking-tighter italic break-words">{formatFullAmount(monthlyTarget)}</h3>
          </div>
          <div className="flex items-center gap-2"><Calendar size={14} className={subtextClass} /><span className="text-[9px] font-black">{monthKey}</span></div>
        </div>

        <div className="flex items-center gap-6 mb-6 px-6 relative z-10 flex-wrap sm:flex-nowrap">
          <div className="relative flex-shrink-0" style={{ width: 140, height: 140 }}>
            <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
              <defs><linearGradient id="ringGradDir" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#EAB308" /><stop offset="60%" stopColor="#CA8A04" /><stop offset="100%" stopColor={dark ? "#3f3f46" : "#27272a"} /></linearGradient></defs>
              <circle cx="70" cy="70" r="54" fill="none" stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="11" />
              <circle cx="70" cy="70" r="54" fill="none" stroke="url(#ringGradDir)" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 54}`} strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress / 100)}`} style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <span className={`text-2xl font-black italic ${getProgressColor(progress)}`}>{progress.toFixed(1)}%</span>
              <span className={`text-[8px] font-black uppercase tracking-widest ${subtextClass}`}>done</span>
            </div>
          </div>
              <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className={`p-3 rounded-xl border-l-2 border-emerald-500 ${dark ? "bg-white/5" : "bg-black/[0.03]"}`}>
              <p className={`text-[8px] font-black uppercase tracking-widest ${subtextClass}`}>Gross Sales</p>
              <p className="text-sm font-black italic text-emerald-500 break-words">{formatFullAmount(grossSales)}</p>
            </div>
            <div className={`p-3 rounded-xl border-l-2 border-purple-500 ${dark ? "bg-white/5" : "bg-black/[0.03]"}`}>
              <p className={`text-[8px] font-black uppercase tracking-widest ${subtextClass}`}>Credit Settlements</p>
              <p className="text-sm font-black italic text-purple-500 break-words">{formatFullAmount(creditSettlements)}</p>
            </div>
            <div className={`p-3 rounded-xl border-l-2 border-rose-500 ${dark ? "bg-white/5" : "bg-black/[0.03]"}`}>
              <p className={`text-[8px] font-black uppercase tracking-widest ${subtextClass}`}>Expenses</p>
              <p className="text-sm font-black italic text-rose-500 break-words">{formatFullAmount(expenses)}</p>
            </div>
            <div className={`p-3 rounded-xl border-l-2 border-yellow-500 ${dark ? "bg-white/5" : "bg-black/[0.03]"}`}>
              <p className={`text-[8px] font-black uppercase tracking-widest ${subtextClass}`}>Current Cash</p>
              <p className="text-sm font-black italic text-yellow-500 break-words">{formatFullAmount(currentCash)}</p>
            </div>
            <div className={`p-3 rounded-xl border-l-2 border-emerald-500 ${dark ? "bg-white/5" : "bg-black/[0.03]"}`}>
              <p className={`text-[8px] font-black uppercase tracking-widest ${subtextClass}`}>Remaining</p>
              <p className="text-sm font-black italic text-emerald-500 break-words">{formatFullAmount(Number(targetSummary.remaining) || 0)}</p>
            </div>
          </div>
        </div>
      </div>
      <MonthlyFinancialBreakdown
        month={monthKey}
        target={monthlyTarget}
        grossSales={grossSales}
        creditSettlements={creditSettlements}
        expenses={expenses}
        currentCash={currentCash}
        remaining={Number(targetSummary.remaining) || 0}
        percentage={progress}
        isDark={dark}
      />
      </div>

      <div className={`rounded-2xl border p-6 transition-all duration-300 hover:shadow-xl ${cardBg}`}>
        <div className="flex justify-between items-start flex-wrap gap-2">
          <div>
            <BarChart3 size={22} className={isOnTrack ? "text-emerald-500" : "text-rose-500"} />
            <p className={`text-[9px] font-black uppercase tracking-widest mt-2 ${subtextClass}`}>Projected Month End (based on gross sales)</p>
            <h3 className={`text-3xl font-black italic mt-1 ${isOnTrack ? "text-emerald-500" : "text-rose-500"} break-words`}>{formatFullAmount(projectedRevenue)}</h3>
          </div>
          <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${isOnTrack ? (dark ? "bg-emerald-500 text-black" : "bg-emerald-600 text-white") : (dark ? "bg-rose-500 text-white" : "bg-rose-600 text-white")}`}>
            {isOnTrack ? 'On Track' : 'Behind Target'}
          </div>
        </div>
        <p className={`text-[9px] mt-4 ${subtextClass}`}>
          Based on current daily average of {formatFullAmount(dailyAvg)} over {elapsedDays} days. Credit settlements and expenses are shown separately and do not change sales-target progress.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-5 rounded-2xl border transition-all duration-300 hover:border-yellow-500/30 hover:shadow-lg ${miniCardBg}`}>
          <Zap size={16} className="text-yellow-500 mb-2" />
          <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${subtextClass}`}>Daily Average (Gross)</p>
          <p className={`text-xl font-black italic ${textClass} break-words`}>{formatFullAmount(dailyAvg)}</p>
        </div>
        <div className={`p-5 rounded-2xl border transition-all duration-300 hover:border-yellow-500/30 hover:shadow-lg ${miniCardBg}`}>
          <TrendingUp size={16} className="text-yellow-500 mb-2" />
          <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${subtextClass}`}>Required Gross Sales / Day</p>
          <p className={`text-xl font-black italic ${textClass} break-words`}>{formatFullAmount(Math.max(0, dailyPaceNeeded))}</p>
        </div>
        <div className={`p-5 rounded-2xl border transition-all duration-300 hover:border-yellow-500/30 hover:shadow-lg ${miniCardBg}`}>
          <Calendar size={16} className="text-yellow-500 mb-2" />
          <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${subtextClass}`}>Days Left</p>
          <p className={`text-xl font-black italic ${textClass}`}>{Math.max(0, totalDays - elapsedDays)}</p>
        </div>
        <div className={`p-5 rounded-2xl border transition-all duration-300 hover:border-yellow-500/30 hover:shadow-lg ${miniCardBg}`}>
          <Activity size={16} className="text-yellow-500 mb-2" />
          <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${subtextClass}`}>Status</p>
          <p className={`text-xl font-black italic ${progress >= 100 ? "text-emerald-500" : "text-yellow-500"}`}>{progress >= 100 ? "TARGET MET" : "IN PROGRESS"}</p>
        </div>
      </div>

      {monthlyTarget === 0 && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${dark ? "bg-yellow-500/10 border-yellow-500/20" : "bg-yellow-50 border-yellow-200"}`}>
          <AlertCircle size={16} className="text-yellow-500" />
          <p className={`text-[10px] font-black uppercase tracking-widest ${dark ? "text-yellow-400" : "text-yellow-700"}`}>
            No monthly sales target set for {monthLabel}. Please ask the manager to set a target.
          </p>
        </div>
      )}
    </div>
  );
}