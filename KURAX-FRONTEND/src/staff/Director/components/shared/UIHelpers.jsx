import React from "react";
import { Clock } from "lucide-react";

// ─── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({ label, value, trend, color, icon, loading }) {
  return (
    <div className="bg-white border border-gray-200 p-3.5 rounded-2xl transition-all active:scale-[0.98] shadow-sm">
      <div className="flex justify-between items-start mb-2.5">
        <div className={`p-1.5 rounded-lg border border-gray-200 bg-gray-50 ${color}`}>
          {icon}
        </div>
        {trend && !loading && (
          <span className="text-[8px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-lg">
            {trend}
          </span>
        )}
      </div>
      <p className="text-[8px] font-black uppercase tracking-widest mb-0.5 text-gray-500">{label}</p>
      {loading ? (
        <div className="h-6 w-20 rounded-lg animate-pulse bg-gray-200 mt-1" />
      ) : (
        <h4 className="text-base md:text-xl font-black italic tracking-tight text-gray-900">
          <span className="text-[8px] mr-1 not-italic opacity-30">UGX</span>
          {(value ?? 0).toLocaleString()}
        </h4>
      )}
    </div>
  );
}

// ─── FinanceRow ────────────────────────────────────────────────────────────────
export function FinanceRow({ label, value, color, bold }) {
  return (
    <div className="flex justify-between items-center text-[10px] font-bold uppercase">
      <span className="text-gray-500">{label}</span>
      <span className={`${color} ${bold ? "text-sm font-black italic" : ""}`}>
        {value < 0 ? "-" : ""}UGX {Math.abs(value).toLocaleString()}
      </span>
    </div>
  );
}

// ─── OrderRow ──────────────────────────────────────────────────────────────────
export function OrderRow({ id, waiter, method, amount, time, status }) {
  const methodColors = {
    MOMO: "text-yellow-600",
    CASH: "text-emerald-600",
    CARD: "text-blue-600",
  };
  return (
    <tr className="transition-colors hover:bg-gray-50">
      <td className="p-3 md:p-5 font-black italic text-sm text-gray-900">{id}</td>
      <td className="p-3 md:p-5 text-xs font-bold uppercase text-gray-600">{waiter}</td>
      <td className={`p-3 md:p-5 text-[9px] font-black tracking-widest ${methodColors[method] || ""}`}>
        {method}
      </td>
      <td className="p-3 md:p-5 font-black text-sm text-gray-900">
        <span className="text-[8px] mr-1 opacity-30">UGX</span>
        {amount.toLocaleString()}
      </td>
      <td className="p-3 md:p-5 text-[9px] font-bold text-gray-500">{time}</td>
      <td className="p-3 md:p-5">
        <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-2 py-0.5 rounded uppercase border border-emerald-200">
          {status}
        </span>
      </td>
    </tr>
  );
}

// ─── ActivityItem ──────────────────────────────────────────────────────────────
export function ActivityItem({ type, msg, time, color }) {
  return (
    <div className="flex gap-3 items-start">
      <div className={`w-1 h-8 rounded-full shrink-0 mt-0.5 ${color || "bg-yellow-500/30"}`} />
      <div>
        <p className="text-xs font-bold leading-snug text-gray-900">{msg}</p>
        <p className="text-[8px] font-black uppercase mt-0.5 text-gray-500">
          {time} • {type}
        </p>
      </div>
    </div>
  );
}

// ─── ShiftMiniCard ─────────────────────────────────────────────────────────────
export function ShiftMiniCard({ staff, cash, momo, card, time, type, status }) {
  return (
    <div className="border border-gray-200 p-3 rounded-xl flex justify-between items-center gap-3 bg-gray-50">
      <div className="flex gap-2.5 items-center min-w-0">
        <div className="p-1.5 rounded-lg shrink-0 bg-gray-200">
          <Clock size={11} className="text-gray-500" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black italic truncate text-gray-900">{staff}</p>
          <p className="text-[8px] font-bold uppercase text-gray-500">{time}</p>
          {status && <p className="text-[8px] text-emerald-600 font-black">{status}</p>}
        </div>
      </div>
      {type !== "service" && (
        <div className="flex gap-1.5 text-[8px] font-black uppercase shrink-0">
          <span className="text-gray-500">C:{cash}</span>
          <span className="text-yellow-600">M:{momo}</span>
          <span className="text-blue-600">D:{card}</span>
        </div>
      )}
    </div>
  );
}

// ─── fmtK ─────────────────────────────────────────────────────────────────────
export function fmtK(val) {
  const n = Number(val || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}