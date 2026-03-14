import React, { useState, useEffect } from "react";
import {
  ComposedChart, Area, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { useTheme } from "../../../staff/Director/components/shared/ThemeContext";
import API_URL from "../../../config/api";

// ── Custom Tooltip ──────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  const { dark } = useTheme();
  if (!active || !payload?.length) return null;
  const fmt = (v) => `UGX ${Number(v || 0).toLocaleString()}`;
  
  return (
    <div className={`px-4 py-3 rounded-2xl border shadow-2xl text-xs font-black min-w-[210px]
      ${dark ? "bg-zinc-900 border-white/10 text-white" : "bg-white border-zinc-200 text-zinc-900"}`}>
      <p className="text-zinc-500 text-[9px] uppercase tracking-widest mb-2 border-b border-white/5 pb-2">{label}</p>
      <div className="space-y-2">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
              <span className="text-[9px] uppercase tracking-wide opacity-70">{p.name}</span>
            </div>
            <span className="font-black text-[10px]" style={{ color: p.color }}>{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 7-day Fallback Logic ─────────────────────────────────────────────────────
function buildFallback() {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return { date: days[d.getDay()], gross: 0, petty: 0, profit: 0, cash: 0, card: 0 };
  });
}

export function RevenueChart() {
  const { dark } = useTheme();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/overview/weekly-revenue`);
        if (res.ok) {
          const raw = await res.json();
          if (!cancelled) {
            // Calculate Profit and ensure numeric types
            const processed = (Array.isArray(raw) && raw.length ? raw : buildFallback())
              .map(d => ({
                ...d,
                gross: Number(d.gross || 0),
                petty: Number(d.petty || 0),
                profit: Number(d.gross || 0) - Number(d.petty || 0)
              }));
            setData(processed);
          }
        }
      } catch (e) {
        if (!cancelled) setData(buildFallback());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const gridColor = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
  const axisColor = dark ? "#52525b" : "#a1a1aa";
  const fmtY = (v) => v >= 1_000_000 ? `${(v/1e6).toFixed(1)}M` : v >= 1_000 ? `${(v/1e3).toFixed(0)}K` : v;

  if (loading) return <div className={`h-64 rounded-3xl animate-pulse ${dark ? "bg-zinc-900" : "bg-zinc-100"}`} />;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradGross" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#eab308" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" hide={false} tick={{ fontSize: 10, fontWeight: 800, fill: axisColor }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtY} tick={{ fontSize: 10, fontWeight: 800, fill: axisColor }} axisLine={false} tickLine={false} />
        
        <Tooltip content={<CustomTooltip />} cursor={{ fill: dark ? '#ffffff05' : '#00000005' }} />
        
        <Legend verticalAlign="top" align="right" iconType="circle"
          content={({ payload }) => (
            <div className="flex gap-4 justify-end mb-4">
              {payload.map((entry, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: entry.color }} />
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{entry.display_name || entry.value}</span>
                </div>
              ))}
            </div>
          )}
        />

        {/* 1. Gross Revenue (Background Area) */}
        <Area type="monotone" dataKey="gross" name="Gross Sales" fill="url(#gradGross)" stroke="none" />

        {/* 2. Expenses/Petty Cash (Bars) */}
        <Bar dataKey="petty" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={16} />

        {/* 3. Net Profit (Hero Line) */}
        <Line 
          type="stepAfter" 
          dataKey="profit" 
          name="Net Profit" 
          stroke="#10b981" 
          strokeWidth={4} 
          dot={{ r: 0 }} 
          activeDot={{ r: 6, strokeWidth: 0, fill: "#10b981" }} 
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}