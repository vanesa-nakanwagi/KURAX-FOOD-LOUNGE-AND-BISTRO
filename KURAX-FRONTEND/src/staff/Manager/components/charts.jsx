import React, { useState, useEffect, useCallback } from "react";
import {
  ComposedChart, Area, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { useTheme } from "../../../staff/Director/components/shared/ThemeContext";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import API_URL from "../../../config/api";

function fmtK(v) {
  const num = Number(v || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return `${num.toLocaleString()}`;
}

function formatMonthDisplay(monthStr) {
  if (!monthStr) return "";
  const [year, month] = monthStr.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function CustomTooltip({ active, payload, label }) {
  const { dark } = useTheme();
  if (!active || !payload?.length) return null;
  const fmt = (v) => `UGX ${Number(v || 0).toLocaleString()}`;
  
  return (
    <div className={`px-4 py-3 rounded-2xl border shadow-2xl text-xs font-black min-w-[260px]
      ${dark ? "bg-zinc-900 border-white/10 text-white" : "bg-white border-zinc-200 text-zinc-900"}`}>
      <p className="text-zinc-500 text-[9px] uppercase tracking-widest mb-2 border-b pb-2">
        {label}
      </p>
      <div className="space-y-2">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
              <span className="text-[9px] uppercase tracking-wide">{p.name}</span>
            </div>
            <span className="font-black text-[10px]" style={{ color: p.color }}>{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RevenueChart() {
  const { dark } = useTheme();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [totals, setTotals] = useState({
    cash: 0,
    card: 0,
    mobileMoney: 0,
    creditSettlements: 0,
    totalRevenue: 0
  });

  const fetchMonthlyRevenue = useCallback(async (month) => {
    try {
      setLoading(true);
      setError(null);
      
      const url = `${API_URL}/api/overview/monthly-revenue?month=${month}&t=${Date.now()}`;
      console.log("🔵 Fetching monthly revenue from:", url);
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const rawData = await res.json();
      console.log("📊 Raw API Response for", month, ":", JSON.stringify(rawData, null, 2));
      
      // Create a map of data by day
      const dataMap = new Map();
      if (Array.isArray(rawData)) {
        rawData.forEach(day => {
          const dayNum = parseInt(day.date);
          dataMap.set(dayNum, {
            cash: Number(day.cash || 0),
            card: Number(day.card || 0),
            momo: Number(day.momo || 0),
            credit_settled: Number(day.credit_settled || 0)
          });
        });
      }
      
      // Get the year and month
      const [year, monthNum] = month.split("-");
      const daysInMonth = getDaysInMonth(parseInt(year), parseInt(monthNum));
      
      // Calculate totals
      let totalCash = 0;
      let totalCard = 0;
      let totalMobileMoney = 0;
      let totalCreditSettlements = 0;
      
      // Build data for ALL days in the month
      const processedData = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dayData = dataMap.get(day) || { cash: 0, card: 0, momo: 0, credit_settled: 0 };
        
        totalCash += dayData.cash;
        totalCard += dayData.card;
        totalMobileMoney += dayData.momo;
        totalCreditSettlements += dayData.credit_settled;
        
        const immediateGross = dayData.cash + dayData.card + dayData.momo;
        const totalRevenue = immediateGross + dayData.credit_settled;
        
        processedData.push({
          date: `${monthNum}/${day}`,
          day: day,
          cash: dayData.cash,
          card: dayData.card,
          mobileMoney: dayData.momo,
          immediateGross: immediateGross,
          creditSettlements: dayData.credit_settled,
          totalRevenue: totalRevenue,
          profit: totalRevenue
        });
      }
      
      const totalImmediate = totalCash + totalCard + totalMobileMoney;
      const totalRevenue = totalImmediate + totalCreditSettlements;
      
      setTotals({
        cash: totalCash,
        card: totalCard,
        mobileMoney: totalMobileMoney,
        creditSettlements: totalCreditSettlements,
        immediate: totalImmediate,
        totalRevenue: totalRevenue
      });
      
      console.log("📈 Monthly Chart Data (all days):", processedData);
      console.log("💰 Monthly Totals:", { totalCash, totalCard, totalMobileMoney, totalCreditSettlements, totalRevenue });
      
      setData(processedData);
      
    } catch (err) {
      console.error("Error fetching monthly revenue:", err);
      setError(err.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonthlyRevenue(selectedMonth);
  }, [selectedMonth, fetchMonthlyRevenue]);

  const handlePreviousMonth = () => {
    const [year, month] = selectedMonth.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 2, 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonth(newMonth);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split("-");
    const date = new Date(parseInt(year), parseInt(month), 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const currentMonth = getCurrentMonth();
    if (newMonth <= currentMonth) {
      setSelectedMonth(newMonth);
    }
  };

  const gridColor = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
  const axisColor = dark ? "#52525b" : "#a1a1aa";
  const fmtY = (v) => v >= 1_000_000 ? `${(v/1e6).toFixed(1)}M` : v >= 1_000 ? `${(v/1e3).toFixed(0)}K` : v;

  if (loading) {
    return <div className={`h-80 rounded-3xl animate-pulse ${dark ? "bg-zinc-900" : "bg-zinc-100"}`} />;
  }

  if (error) {
    return (
      <div className={`h-80 rounded-3xl flex items-center justify-center ${dark ? "bg-zinc-900" : "bg-zinc-100"}`}>
        <div className="text-center">
          <p className="text-red-500 text-sm font-bold">Error loading chart</p>
          <p className="text-xs text-zinc-500 mt-1">{error}</p>
          <button 
            onClick={() => fetchMonthlyRevenue(selectedMonth)}
            className="mt-3 px-3 py-1 bg-yellow-500 text-black rounded-lg text-xs font-bold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`h-80 rounded-3xl flex items-center justify-center ${dark ? "bg-zinc-900" : "bg-zinc-100"}`}>
        <div className="text-center">
          <p className="text-zinc-500 text-sm font-bold">No data available</p>
          <p className="text-xs text-zinc-500 mt-1">Select a different month</p>
        </div>
      </div>
    );
  }

  // Get visible ticks (show every 5th day to avoid crowding)
  const visibleTicks = data.filter((_, index) => {
    const day = index + 1;
    return day === 1 || day === 5 || day === 10 || day === 15 || day === 20 || day === 25 || day === data.length;
  }).map(item => item.date);

  return (
    <div className="space-y-3">
      {/* Month Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon size={14} className={dark ? "text-zinc-500" : "text-zinc-400"} />
          <span className={`text-[10px] font-bold uppercase tracking-wider ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
            Revenue by Day
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviousMonth}
            className={`p-1.5 rounded-lg transition-all ${dark ? "hover:bg-zinc-800" : "hover:bg-gray-100"}`}
          >
            <ChevronLeft size={14} />
          </button>
          <span className={`text-xs font-bold px-3 py-1 rounded-lg ${dark ? "bg-zinc-800" : "bg-gray-100"}`}>
            {formatMonthDisplay(selectedMonth)}
          </span>
          <button
            onClick={handleNextMonth}
            disabled={selectedMonth === getCurrentMonth()}
            className={`p-1.5 rounded-lg transition-all ${selectedMonth === getCurrentMonth() ? "opacity-40 cursor-not-allowed" : dark ? "hover:bg-zinc-800" : "hover:bg-gray-100"}`}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className={`p-2 rounded-lg text-center ${dark ? "bg-yellow-500/10" : "bg-yellow-50"}`}>
          <p className="text-[8px] font-black uppercase text-yellow-500">Cash</p>
          <p className="text-sm font-black text-yellow-500">{fmtK(totals.cash)}</p>
          <p className="text-[7px] text-zinc-500">Total for month</p>
        </div>
        <div className={`p-2 rounded-lg text-center ${dark ? "bg-blue-500/10" : "bg-blue-50"}`}>
          <p className="text-[8px] font-black uppercase text-blue-500">Card</p>
          <p className="text-sm font-black text-blue-500">{fmtK(totals.card)}</p>
          <p className="text-[7px] text-zinc-500">Total for month</p>
        </div>
        <div className={`p-2 rounded-lg text-center ${dark ? "bg-purple-500/10" : "bg-purple-50"}`}>
          <p className="text-[8px] font-black uppercase text-purple-500">Credit Settled</p>
          <p className="text-sm font-black text-purple-500">{fmtK(totals.creditSettlements)}</p>
          <p className="text-[7px] text-zinc-500">Total for month</p>
        </div>
        <div className={`p-2 rounded-lg text-center ${dark ? "bg-green-500/10" : "bg-green-50"}`}>
          <p className="text-[8px] font-black uppercase text-green-500">Total Revenue</p>
          <p className="text-sm font-black text-green-500">{fmtK(totals.totalRevenue)}</p>
          <p className="text-[7px] text-zinc-500">Total for month</p>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradImmediate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#eab308" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradCredit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 9, fontWeight: 800, fill: axisColor }} 
            axisLine={false} 
            tickLine={false}
            ticks={visibleTicks}
            interval={0}
          />
          <YAxis 
            tickFormatter={fmtY} 
            tick={{ fontSize: 10, fontWeight: 800, fill: axisColor }} 
            axisLine={false} 
            tickLine={false} 
          />
          
          <Tooltip content={<CustomTooltip />} cursor={{ fill: dark ? '#ffffff05' : '#00000005' }} />
          
          <Legend 
            verticalAlign="top" 
            align="right" 
            iconType="circle"
            wrapperStyle={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em' }}
          />

          {/* Immediate Gross Sales (Cash + Card + Mobile Money) */}
          <Area 
            type="monotone" 
            dataKey="immediateGross" 
            name="Cash + Card + Mobile Money" 
            fill="url(#gradImmediate)" 
            stroke="#eab308" 
            strokeWidth={2}
          />

          {/* Credit Settlements */}
          <Area 
            type="monotone" 
            dataKey="creditSettlements" 
            name="Credit Settlements" 
            fill="url(#gradCredit)" 
            stroke="#8b5cf6" 
            strokeWidth={2}
            strokeDasharray="5 5"
          />

          {/* Net Revenue */}
          <Line 
            type="monotone" 
            dataKey="profit" 
            name="Net Revenue" 
            stroke="#10b981" 
            strokeWidth={3} 
            dot={{ r: 3, strokeWidth: 0, fill: "#10b981" }} 
            activeDot={{ r: 5, strokeWidth: 0, fill: "#10b981" }} 
          />
        </ComposedChart>
      </ResponsiveContainer>
      
      <div className={`text-center text-[8px] font-bold uppercase tracking-widest ${dark ? "text-zinc-600" : "text-zinc-400"}`}>
        <span className="inline-flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          Immediate Payments (Cash + Card + Mobile Money)
        </span>
        <span className="inline-flex items-center gap-2 ml-3">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          Credit Settlements (Collected from credit customers)
        </span>
        <span className="inline-flex items-center gap-2 ml-3">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          Net Revenue (Total collected)
        </span>
      </div>
    </div>
  );
}