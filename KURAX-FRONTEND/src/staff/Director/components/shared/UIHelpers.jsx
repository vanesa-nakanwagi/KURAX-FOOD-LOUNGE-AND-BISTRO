import React from "react";
import { Clock } from "lucide-react";
import { useTheme } from "./ThemeContext";

// ── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({ label, value, trend, color, icon, loading }) {
  const { dark, t } = useTheme();
  return (
    <div className={`${t.card} border p-3.5 rounded-2xl transition-all active:scale-[0.98]`}>
      <div className="flex justify-between items-start mb-2.5">
        <div className={`p-1.5 rounded-lg border ${dark ? "border-white/5 bg-black" : "border-zinc-200 bg-zinc-50"} ${color}`}>
          {icon}
        </div>
        {trend && !loading && (
          <span className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-lg">{trend}</span>
        )}
      </div>
      <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${t.subtext}`}>{label}</p>
      {loading
        ? <div className={`h-6 w-20 rounded-lg animate-pulse mt-1 ${dark ? "bg-zinc-800" : "bg-zinc-200"}`} />
        : <h4 className={`text-base md:text-xl font-black italic tracking-tight ${dark ? "text-white" : "text-zinc-900"}`}>
            <span className="text-[8px] mr-1 not-italic opacity-30">UGX</span>
            {(value ?? 0).toLocaleString()}
          </h4>
      }
    </div>
  );
}

// ── FinanceRow ────────────────────────────────────────────────────────────────
export function FinanceRow({ label, value, color, bold }) {
  const { dark } = useTheme();
  return (
    <div className="flex justify-between items-center text-[10px] font-bold uppercase">
      <span className={dark ? "text-zinc-500" : "text-zinc-400"}>{label}</span>
      <span className={`${color} ${bold ? "text-sm font-black italic" : ""}`}>
        {value < 0 ? "-" : ""}UGX {Math.abs(value).toLocaleString()}
      </span>
    </div>
  );
}

// ── OrderRow ──────────────────────────────────────────────────────────────────
export function OrderRow({ id, waiter, method, amount, time, status }) {
  const { t } = useTheme();
  const mc = { MOMO: "text-yellow-500", CASH: "text-emerald-500", CARD: "text-blue-500" };
  return (
    <tr className={`transition-colors ${t.rowHover}`}>
      <td className="p-3 md:p-5 font-black italic text-sm">{id}</td>
      <td className={`p-3 md:p-5 text-xs font-bold uppercase ${t.subtext}`}>{waiter}</td>
      <td className={`p-3 md:p-5 text-[9px] font-black tracking-widest ${mc[method] || ""}`}>{method}</td>
      <td className="p-3 md:p-5 font-black text-sm">
        <span className="text-[8px] mr-1 opacity-30">UGX</span>{amount.toLocaleString()}
      </td>
      <td className={`p-3 md:p-5 text-[9px] font-bold ${t.subtext}`}>{time}</td>
      <td className="p-3 md:p-5">
        <span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black px-2 py-0.5 rounded uppercase border border-emerald-500/20">
          {status}
        </span>
      </td>
    </tr>
  );
}

// ── ActivityItem ──────────────────────────────────────────────────────────────
export function ActivityItem({ type, msg, time, color }) {
  const { t } = useTheme();
  return (
    <div className="flex gap-3 items-start">
      <div className={`w-1 h-8 rounded-full shrink-0 mt-0.5 ${color || "bg-yellow-500/20"}`} />
      <div>
        <p className="text-xs font-bold leading-snug">{msg}</p>
        <p className={`text-[8px] font-black uppercase mt-0.5 ${t.subtext}`}>{time} • {type}</p>
      </div>
    </div>
  );
}

// ── ShiftMiniCard ─────────────────────────────────────────────────────────────
export function ShiftMiniCard({ staff, cash, momo, card, time, type, status }) {
  const { dark, t } = useTheme();
  return (
    <div className={`border p-3 rounded-xl flex justify-between items-center gap-3
      ${dark ? "bg-black/40 border-white/5" : "bg-zinc-50 border-zinc-200"}`}>
      <div className="flex gap-2.5 items-center min-w-0">
        <div className={`p-1.5 rounded-lg shrink-0 ${dark ? "bg-zinc-800" : "bg-zinc-100"}`}>
          <Clock size={11} className="text-zinc-400" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black italic truncate">{staff}</p>
          <p className={`text-[8px] font-bold uppercase ${t.subtext}`}>{time}</p>
          {status && <p className="text-[8px] text-emerald-500 font-black">{status}</p>}
        </div>
      </div>
      {type !== "service" && (
        <div className="flex gap-1.5 text-[8px] font-black uppercase shrink-0">
          <span className={t.subtext}>C:{cash}</span>
          <span className="text-yellow-500">M:{momo}</span>
          <span className="text-blue-500">D:{card}</span>
        </div>
      )}
    </div>
  );
}

// ── fmtK ─────────────────────────────────────────────────────────────────────
export function fmtK(val) {
  const n = Number(val || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}