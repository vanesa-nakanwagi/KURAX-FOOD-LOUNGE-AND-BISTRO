import React, { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useTheme } from "./components/shared/ThemeContext";
import API_URL from "../../config/api";

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  const { dark } = useTheme();
  if (!active || !payload?.length) return null;
  const fmt = (v) => `UGX ${Number(v || 0).toLocaleString()}`;
  return (
    <div className={`px-4 py-3 rounded-2xl border shadow-2xl text-xs font-black min-w-[190px]
      ${dark ? "bg-zinc-900 border-white/10 text-white" : "bg-white border-zinc-200 text-zinc-900"}`}>
      <p className="text-zinc-500 text-[9px] uppercase tracking-widest mb-2 border-b border-white/5 pb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex justify-between items-center gap-4">
            <span className="text-[9px] uppercase tracking-wide" style={{ color: p.color }}>{p.name}</span>
            <span className="font-black text-[10px]" style={{ color: p.color }}>{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Custom Legend ─────────────────────────────────────────────────────────────
function CustomLegend({ payload }) {
  return (
    <div className="flex flex-wrap gap-3 justify-center mt-2">
      {(payload || []).map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── 7-day zero fallback ───────────────────────────────────────────────────────
function buildFallback() {
  const days  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return { date: days[d.getDay()], cash: 0, card: 0, momo_mtn: 0, momo_airtel: 0, gross: 0 };
  });
}

// ── Chart areas config ────────────────────────────────────────────────────────
const AREAS = [
  { key: "cash",        name: "Cash",       color: "#10b981", grad: "gradCash",   opacity: 0.20, width: 2   },
  { key: "card",        name: "Card",        color: "#3b82f6", grad: "gradCard",   opacity: 0.15, width: 2   },
  { key: "momo_mtn",    name: "MTN Momo",    color: "#facc15", grad: "gradMtn",    opacity: 0.15, width: 2   },
  { key: "momo_airtel", name: "Airtel Momo", color: "#f87171", grad: "gradAirtel", opacity: 0.15, width: 2   },
  { key: "gross",       name: "Gross",       color: "#eab308", grad: "gradGross",  opacity: 0.30, width: 2.5 },
];

// ── RevenueChart ──────────────────────────────────────────────────────────────
export function RevenueChart() {
  const { dark }           = useTheme();
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/overview/weekly-revenue`);
        if (res.ok) {
          const raw = await res.json();
          if (!cancelled) setData(Array.isArray(raw) && raw.length ? raw : buildFallback());
        } else {
          if (!cancelled) setData(buildFallback());
        }
      } catch (e) {
        console.error("Weekly revenue fetch failed:", e);
        if (!cancelled) setData(buildFallback());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const gridColor = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
  const axisColor = dark ? "#52525b" : "#a1a1aa";
  const fmtY      = (v) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000   ? `${(v / 1_000).toFixed(0)}K`
    : String(v);

  if (loading) {
    return <div className={`h-56 rounded-2xl animate-pulse ${dark ? "bg-zinc-800" : "bg-zinc-100"}`} />;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <defs>
          {AREAS.map(({ grad, color, opacity }) => (
            <linearGradient key={grad} id={grad} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={opacity} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />

        <XAxis dataKey="date"
          tick={{ fontSize: 9, fontWeight: 700, fill: axisColor, fontFamily: "Outfit" }}
          axisLine={false} tickLine={false} />

        <YAxis tickFormatter={fmtY}
          tick={{ fontSize: 9, fontWeight: 700, fill: axisColor, fontFamily: "Outfit" }}
          axisLine={false} tickLine={false} />

        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} />

        {AREAS.map(({ key, name, color, grad, width }) => (
          <Area key={key} type="monotone" dataKey={key} name={name}
            stroke={color} strokeWidth={width}
            fill={`url(#${grad})`}
            dot={false}
            activeDot={{ r: 4, fill: color, strokeWidth: 0 }} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}