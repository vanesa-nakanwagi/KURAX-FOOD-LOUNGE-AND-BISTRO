import React, { useState, useMemo } from "react";
import { useData } from "../../customer/components/context/DataContext";
import { useTheme } from "../../customer/components/context/ThemeContext";
import {
  Target, TrendingUp, Zap, Calendar, Activity, Edit3, Save, X, 
  ChevronLeft, ChevronRight, BarChart3, Clock
} from "lucide-react";
import API_URL from "../../config/api";

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

  // --- MONTH SELECTION STATE ---
  const [viewDate, setViewDate] = useState(new Date());
  const monthKey = viewDate.toISOString().substring(0, 7); 
  const monthLabel = viewDate.toLocaleString("default", { month: "long", year: "numeric" }).toUpperCase();

  const [isEditing, setIsEditing] = useState(false);
  const [editRevenue, setEditRevenue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Target for the SELECTED month
  const target = monthlyTargets?.[monthKey] ?? { revenue: 0 };
  const targetRevenue = Number(target.revenue) || 0;

  // --- IMPROVED REVENUE CALCULATIONS ---
  // This now syncs perfectly with Manager view by checking for 'Paid' status
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

  // NEW: Calculate the "Last Updated" timestamp based on the latest order
  const lastUpdate = useMemo(() => {
    if (filteredOrders.length === 0) return "No sales yet";
    const timestamps = filteredOrders
      .map(o => new Date(o.timestamp || o.date).getTime())
      .filter(t => !isNaN(t));
    if (timestamps.length === 0) return "Waiting for data...";
    return new Date(Math.max(...timestamps)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [filteredOrders]);

  // --- PROJECTION ENGINE ---
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
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editRevenue || isNaN(editRevenue)) {
      alert("Please enter a valid amount");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/manager/targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month_key: monthKey,
          revenue_goal: parseFloat(editRevenue),
          waiter_quota: 0
        })
      });

      if (response.ok) {
        setIsEditing(false);
        if (refreshData) await refreshData(); 
        alert(`Target for ${monthLabel} updated!`);
      }
    } catch (err) {
      alert("Save Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const cardBg = dark ? "bg-zinc-900/40 border-white/5" : "bg-white border-zinc-200 shadow-sm";
  const inputBg = dark ? "bg-black border-zinc-800 text-white" : "bg-white border-zinc-300 text-zinc-900";

  return (
    <div className={`space-y-6 font-[Outfit] pb-10 ${dark ? 'text-white' : 'text-zinc-900'}`}>

      {/* HEADER & PICKER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-[900] uppercase italic tracking-tighter">Director Control</h2>
          <div className="flex items-center gap-3 mt-1 text-yellow-500">
            <button onClick={() => handleMonthChange(-1)} className="hover:scale-125 transition-transform"><ChevronLeft size={20}/></button>
            <span className="text-[10px] font-black tracking-widest uppercase">{monthLabel}</span>
            <button onClick={() => handleMonthChange(1)} className="hover:scale-125 transition-transform"><ChevronRight size={20}/></button>
          </div>
        </div>
        <button 
          onClick={() => { setEditRevenue(targetRevenue); setIsEditing(!isEditing); }}
          className={`p-3 rounded-xl transition-all ${isEditing ? 'bg-zinc-800 text-zinc-400' : 'bg-yellow-500 text-black hover:scale-105'}`}
        >
          {isEditing ? <X size={20}/> : <Edit3 size={20}/>}
        </button>
      </div>

      {/* EDIT DRAWER */}
      {isEditing && (
        <div className={`p-6 rounded-3xl border animate-in slide-in-from-top-2 duration-300 ${cardBg}`}>
          <label className="text-[10px] font-black uppercase text-yellow-500 tracking-widest mb-3 block">Set Goal for {monthLabel}</label>
          <div className="flex flex-col md:flex-row gap-4">
            <input 
              type="number" value={editRevenue} onChange={(e) => setEditRevenue(e.target.value)}
              className={`flex-1 p-4 rounded-2xl font-black text-2xl italic border outline-none focus:border-yellow-500/50 ${inputBg}`}
            />
            <button onClick={handleSave} disabled={isSaving} className="px-10 py-4 bg-emerald-500 text-white font-black uppercase italic rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-600">
              <Save size={18}/> {isSaving ? "Syncing..." : "Save Target"}
            </button>
          </div>
        </div>
      )}

      {/* MAIN TARGET CARD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 p-8 rounded-[2.5rem] border relative overflow-hidden ${cardBg}`}>
          {/* LIVE TIMESTAMP BADGE */}
          <div className="absolute top-8 right-8 flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
           
            
          </div>

          <div className="flex justify-between items-start mb-10">
            <div>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Revenue Objective</p>
              <h3 className="text-5xl font-[900] italic tracking-tighter">{fmtUGX(targetRevenue)}</h3>
            </div>
            <div className="text-right pt-4 md:pt-0">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Real-Time Sales</p>
              <h3 className="text-5xl font-[900] italic tracking-tighter text-emerald-500">{fmtUGX(actualSales)}</h3>
            </div>
          </div>

          <div className="space-y-3">
            <div className="w-full h-3 rounded-full bg-zinc-800/50 border border-white/5 overflow-hidden">
              <div 
                className="h-full bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)] transition-all duration-1000 ease-out" 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <div className="flex justify-between text-[10px] font-black uppercase text-zinc-500 italic">
              <span>Current Effort</span>
              <span className="text-yellow-500">{progress.toFixed(1)}% Goal Completion</span>
              <span>Target</span>
            </div>
          </div>
        </div>

        {/* PREDICTION CARD */}
        <div className={`p-8 rounded-[2.5rem] border flex flex-col justify-between ${isOnTrack ? 'bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.05)]' : 'bg-rose-500/10 border-rose-500/20'}`}>
          <div className="flex justify-between items-start">
             <BarChart3 className={isOnTrack ? 'text-emerald-500' : 'text-rose-500'} size={24} />
             <div className={`px-2 py-1 rounded text-[8px] font-black uppercase ${isOnTrack ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'}`}>
               {isOnTrack ? 'Pace: Healthy' : 'Pace: Slow'}
             </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Projected Finish</p>
            <h4 className={`text-4xl font-[900] italic tracking-tighter ${isOnTrack ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmtUGX(projectedRevenue)}
            </h4>
            <p className="text-[9px] font-bold mt-2 opacity-50 uppercase italic leading-tight">If current performance velocity is maintained.</p>
          </div>
        </div>
      </div>

      {/* GRID INSIGHTS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniCard label="Daily Average" value={fmtUGX(dailyAvg)} icon={<Zap size={16}/>} dark={dark} />
        <MiniCard label="Required / Day" value={fmtUGX(Math.max(0, dailyPaceNeeded))} icon={<TrendingUp size={16}/>} dark={dark} />
        <MiniCard label="Days Left" value={isCurrentMonth ? totalDays - elapsedDays : 0} icon={<Calendar size={16}/>} dark={dark} />
        <MiniCard label="Account Status" value={progress >= 100 ? "TARGET MET" : "COLLECTING"} icon={<Activity size={16}/>} dark={dark} />
      </div>
    </div>
  );
}

function MiniCard({ label, value, icon, dark }) {
  return (
    <div className={`p-6 rounded-[2rem] border transition-all hover:border-yellow-500/30 ${dark ? 'bg-zinc-900/60 border-white/5' : 'bg-white shadow-sm'}`}>
      <div className="text-yellow-500 mb-3">{icon}</div>
      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xl font-[900] italic tracking-tighter">{value}</p>
    </div>
  );
}