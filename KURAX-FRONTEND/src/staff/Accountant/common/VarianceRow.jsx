import React from "react";
import { fmt } from "../utils/helpers";

export default function VarianceRow({ label, system, physical, variance }) {
  const variancePercent = system > 0 ? (variance / system) * 100 : 0;
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 hover:bg-white/5 transition-colors duration-200 px-2 rounded-lg">
      <div>
        <p className="text-[9px] font-black uppercase text-zinc-500">{label}</p>
        <p className="text-[10px] text-zinc-600">Sys: {fmt(system)} · Phys: {fmt(physical)}</p>
      </div>
      <div className="text-right">
        <span className={`text-sm font-black italic ${variance === 0 ? "text-zinc-500" : variance > 0 ? "text-blue-400" : "text-rose-500"}`}>
          {variance >= 0 ? "+" : ""}{fmt(variance)}
        </span>
        <p className={`text-[8px] font-bold ${variance === 0 ? "text-zinc-600" : variance > 0 ? "text-blue-400/60" : "text-rose-500/60"}`}>
          ({variancePercent > 0 ? "+" : ""}{variancePercent.toFixed(1)}%)
        </p>
      </div>
    </div>
  );
}