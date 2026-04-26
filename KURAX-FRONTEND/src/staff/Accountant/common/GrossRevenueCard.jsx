import React from "react";
import { Sparkles, Zap, ArrowUpRight, CircleDollarSign, AlertTriangle } from "lucide-react";
import { formatCurrencyCompact } from "../utils/helpers";

export default function GrossRevenueCard({ grossSales, settledCredits, pendingCredits }) {
  const combinedTotal = grossSales + settledCredits;
  const hasSettledCredits = settledCredits > 0;
  const hasPendingCredits = pendingCredits > 0;

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-500 via-yellow-600 to-amber-600 p-5 shadow-lg shadow-yellow-500/20 hover:shadow-2xl hover:shadow-yellow-500/30 transition-all duration-300 hover:scale-[1.02]">
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-white/20 to-transparent rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-700" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-black/20 to-transparent rounded-full -ml-16 -mb-16 group-hover:scale-150 transition-transform duration-700" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2.5 w-fit rounded-xl bg-black/30 backdrop-blur-sm text-black group-hover:scale-110 transition-transform duration-300">
            <CircleDollarSign size={18} />
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles size={10} className="text-black/60 animate-pulse" />
            <span className="text-[7px] font-black uppercase tracking-widest bg-black/30 text-black/80 px-2 py-1 rounded-lg whitespace-nowrap backdrop-blur-sm">
              Live Today
            </span>
          </div>
        </div>
        
        {/* Pending Credits Warning */}
        {hasPendingCredits && (
          <div className="mb-3 p-2 rounded-lg bg-amber-500/40 backdrop-blur-sm border border-amber-600/30">
            <div className="flex items-center gap-2">
              <AlertTriangle size={10} className="text-amber-900" />
              <p className="text-[7px] font-black text-amber-900 uppercase tracking-wider">
                ⚠️ {formatCurrencyCompact(pendingCredits)} in pending credit requests (not included in gross)
              </p>
            </div>
          </div>
        )}
        
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1 h-3 bg-black/30 rounded-full" />
            <p className="text-[8px] font-black uppercase text-black/60 tracking-[0.2em]">Gross Revenue</p>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-black italic tracking-tighter leading-tight">
            {formatCurrencyCompact(grossSales)}
          </h3>
          <p className="text-[7px] font-bold text-black/40 uppercase tracking-wider mt-1">
            Cash + Card + Mobile Money (Paid Orders Only)
          </p>
        </div>
        
        {hasSettledCredits && (
          <div className="mt-2 pt-2 border-t border-black/20 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 animate-pulse" />
                <p className="text-[7px] font-black uppercase text-black/60 tracking-wider">Credits Settled Today</p>
              </div>
              <div className="flex items-center gap-1">
                <ArrowUpRight size={10} className="text-emerald-800" />
                <p className="text-[10px] font-black text-emerald-900 italic">+ {formatCurrencyCompact(settledCredits)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 bg-black/20 backdrop-blur-sm rounded-xl px-3 py-2 group-hover:bg-black/30 transition-all">
              <div className="flex items-center gap-1.5">
                <Zap size={10} className="text-black/60" />
                <p className="text-[7px] font-black uppercase text-black/70 tracking-wider">Combined Total</p>
              </div>
              <p className="text-[11px] font-black text-black italic tracking-tighter">
                {formatCurrencyCompact(combinedTotal)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}