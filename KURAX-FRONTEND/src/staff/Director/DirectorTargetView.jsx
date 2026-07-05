import React, { useState, useMemo, useEffect } from "react";
import { useData } from "../../customer/components/context/DataContext";
import { useTheme } from "../../customer/components/context/ThemeContext";
import API_URL from "../../config/api";
import {
  Target, TrendingUp, Zap, Calendar, Activity,
  ChevronLeft, ChevronRight, BarChart3, Clock, AlertCircle, CheckCircle2, Lock, Info
} from "lucide-react";

// ✅ FULL NUMBER FORMATTER (no abbreviation)
function formatFullAmount(n) {
  const num = Number(n) || 0;
  return `UGX ${num.toLocaleString()}`;
}

export default function DirectorTargetView() {
  const { theme } = useTheme();
  const { allOrders = [], monthlyTargets = {}, refreshData } = useData();
  const dark = theme === "dark";

  const [viewDate, setViewDate] = useState(new Date());
  const monthKey = viewDate.toISOString().substring(0, 7);
  const monthLabel = viewDate.toLocaleString("default", { month: "long", year: "numeric" }).toUpperCase();

  const targetRevenue = monthlyTargets?.[monthKey]?.revenue || 0;

  const [creditSettlements, setCreditSettlements] = useState(0);
  const [loadingCredits, setLoadingCredits] = useState(false);

  useEffect(() => {
    const fetchCreditSettlements = async () => {
      setLoadingCredits(true);
      try {
        const url = `${API_URL}/api/manager/credits-summary?period=monthly&month=${monthKey}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setCreditSettlements(Number(data.settled_amount) || 0);
        }
      } catch (err) {
        console.error("Failed to fetch credit settlements:", err);
      } finally {
        setLoadingCredits(false);
      }
    };
    fetchCreditSettlements();
  }, [monthKey]);

  // Filter orders using allOrders – only by date and valid payment method/status
  const filteredOrders = useMemo(() => {
    return (allOrders || []).filter(o => {
      const orderDate = o.date || o.timestamp;
      if (!orderDate) return false;
      const isCorrectMonth = orderDate.toString().startsWith(monthKey);
      const isSuccessful = o.is_archived === true || 
                           o.status === "Paid" || 
                           o.status === "CLOSED" ||
                           o.status === "Served";
      const hasValidPaymentMethod = (o.payment_method && o.payment_method.trim() !== '') ||
                                     o.status?.toLowerCase() === 'credit';
      return isCorrectMonth && isSuccessful && hasValidPaymentMethod;
    });
  }, [allOrders, monthKey]);

  const grossSales = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [filteredOrders]);

  const totalRevenue = grossSales + creditSettlements;

  const isCurrentMonth = monthKey === new Date().toISOString().substring(0, 7);
  const totalDays = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const elapsedDays = isCurrentMonth ? new Date().getDate() : totalDays;
  const dailyAvg = grossSales / (elapsedDays || 1);
  const projectedRevenue = dailyAvg * totalDays;
  const progress = targetRevenue > 0 ? Math.min((totalRevenue / targetRevenue) * 100, 100) : 0;
  const dailyPaceNeeded = totalDays - elapsedDays > 0 ? (targetRevenue - totalRevenue) / (totalDays - elapsedDays) : 0;
  const isOnTrack = projectedRevenue >= targetRevenue;

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

      <div className={`rounded-2xl border relative overflow-hidden transition-all duration-300 hover:shadow-xl ${cardBg}`}>
        <Lock className="absolute -right-4 -top-4 text-white/5 w-24 h-24 rotate-12" />
        <div className="flex justify-between items-start p-6 relative z-10">
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${subtextClass}`}>Monthly Target</p>
            <h3 className="text-2xl font-black tracking-tighter italic break-words">{formatFullAmount(targetRevenue)}</h3>
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
              <div className="flex items-center justify-between">
                <p className={`text-[8px] font-black uppercase tracking-widest ${subtextClass}`}>Current Revenue</p>
                <span className="text-[7px] text-gray-400 flex items-center gap-1 cursor-help" title="Gross Sales + Credit Settlements collected this month"><Info size={8} /> info</span>
              </div>
              <p className="text-sm font-black italic text-emerald-500 break-words">{formatFullAmount(totalRevenue)}</p>
              <p className="text-[7px] font-bold text-gray-500 mt-0.5 break-words">{formatFullAmount(grossSales)} + {formatFullAmount(creditSettlements)} (credits)</p>
            </div>
            <div className={`p-3 rounded-xl border-l-2 border-yellow-500 ${dark ? "bg-white/5" : "bg-black/[0.03]"}`}>
              <p className={`text-[8px] font-black uppercase tracking-widest ${subtextClass}`}>Target</p>
              <p className="text-sm font-black italic text-yellow-500 break-words">{formatFullAmount(targetRevenue)}</p>
            </div>
            <div className={`p-3 rounded-xl border-l-2 ${dark ? "border-white/20 bg-white/5" : "border-black/20 bg-black/[0.03]"}`}>
              <p className={`text-[8px] font-black uppercase tracking-widest ${subtextClass}`}>Remaining</p>
              <p className={`text-sm font-black italic ${subtextClass} break-words`}>{formatFullAmount(Math.max(targetRevenue - totalRevenue, 0))}</p>
            </div>
          </div>
        </div>
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
          Based on current daily average of {formatFullAmount(dailyAvg)} over {elapsedDays} days (gross sales only). Credit settlements add {formatFullAmount(creditSettlements)} to total revenue.
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
          <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${subtextClass}`}>Required / Day (incl. credits)</p>
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