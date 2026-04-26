import React from "react";
import { RefreshCw, RotateCcw, CheckCircle2, AlertTriangle } from "lucide-react";
import { fmt } from "../utils/helpers";

export default function EndOfShift({ 
  dayClosed,
  hasPhysicalCount,
  sys,
  physCash,
  physMomoMTN,
  physMomoAirtel,
  physCard,
  varTotal,
  isFinalizing,
  error,
  handleDayClosure,
  setActiveSection,
  isDark,
  cardBgClass,
  textClass
}) {
  const physicalTotal = physCash + physMomoMTN + physMomoAirtel + physCard;

  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="text-center">
        <h2 className={`text-2xl font-black uppercase tracking-tighter transition-colors duration-300 ${textClass}`}>
          Day Finalization
        </h2>
        <p className="text-yellow-600 text-[12px] font-bold mt-2 uppercase tracking-widest italic opacity-80">
          Reconcile system data with physical collections
        </p>
      </div>

      {dayClosed && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">
              ✅ Day has been closed - All totals have been reset to zero
            </p>
          </div>
        </div>
      )}

      {!hasPhysicalCount && !dayClosed && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            <p className="text-[10px] font-black text-red-500 uppercase tracking-wider">
              ⚠️ You must enter physical count before closing the day!
            </p>
          </div>
          <button 
            onClick={() => setActiveSection("PHYSICAL_COUNT")}
            className="mt-3 px-4 py-2 bg-yellow-500 text-black rounded-xl text-[9px] font-black"
          >
            Go to Physical Count
          </button>
        </div>
      )}

      <div className={`rounded-3xl p-10 shadow-2xl relative overflow-hidden transition-all duration-300 ${cardBgClass}`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 blur-[60px] rounded-full"/>

        <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.25em] mb-10 text-center">
          Verification Summary
        </h3>

        <div className="space-y-6 mb-12">
          <div className="flex justify-between items-center border-b border-white/5 pb-6">
            <span className="text-zinc-500 text-[11px] font-black uppercase tracking-wider">System Gross</span>
            <span className={`text-2xl font-black italic transition-colors duration-300 ${textClass}`}>
              {dayClosed ? "UGX 0" : `UGX ${fmt(sys.gross)}`}
            </span>
          </div>
          
          <div className="flex justify-between items-center border-b border-white/5 pb-6">
            <span className="text-zinc-500 text-[11px] font-black uppercase tracking-wider">Physical Total</span>
            <span className={`text-2xl font-black italic transition-colors duration-300 ${textClass}`}>
              {dayClosed ? "UGX 0" : `UGX ${fmt(physicalTotal)}`}
            </span>
          </div>
          
          <div className="flex justify-between items-center pt-4">
            <span className="text-zinc-500 text-[11px] font-black uppercase tracking-wider">Closing Variance</span>
            <div className="text-right">
              <span className={`text-2xl font-black italic ${dayClosed ? "text-emerald-500" : varTotal >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {dayClosed ? "UGX 0" : `${varTotal >= 0 ? "+" : ""}UGX ${fmt(varTotal)}`}
              </span>
              <p className="text-[8px] font-black uppercase opacity-40 mt-1">
                {dayClosed ? "Day Closed" : (varTotal === 0 ? "Balanced" : varTotal > 0 ? "Overage" : "Shortage")}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-black/30 rounded-2xl p-5 mb-8 space-y-2.5">
          <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest mb-3">This will</p>
          {[
            "Archive all today's orders across all staff",
            "Clear kitchen, barista & bar ticket boards",
            "Reset all gross / revenue totals to zero",
            "Reset all physical count entries to zero",
            "Reset variance analysis to zero",
            "Expire any pending void requests",
            "Save a permanent audit record of today's close",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"/>
              </div>
              <p className="text-[10px] font-bold text-zinc-400">{item}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 mb-6">
            <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5"/>
            <p className="text-[11px] font-bold text-rose-400">{error}</p>
          </div>
        )}

        <button onClick={handleDayClosure} disabled={isFinalizing || !hasPhysicalCount || dayClosed}
          className={`w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black uppercase text-[12px] tracking-[0.15em]
            py-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-4 shadow-xl shadow-yellow-500/20
            ${(isFinalizing || !hasPhysicalCount || dayClosed) ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] hover:shadow-2xl"}`}>
          {isFinalizing
            ? <><RefreshCw size={18} className="animate-spin"/> Closing Accounts…</>
            : dayClosed 
              ? <><CheckCircle2 size={18}/> Day Already Closed</>
              : <><RotateCcw size={18}/> Close Accounts & Reset Dashboard</>}
        </button>
        
        {!hasPhysicalCount && !dayClosed && (
          <p className="text-center text-[9px] text-red-400 mt-3">
            Physical count required before closing
          </p>
        )}
        
        {dayClosed && (
          <p className="text-center text-[9px] text-emerald-500 mt-3">
            This day has been closed. All revenue and physical count totals have been archived.
          </p>
        )}
      </div>
    </div>
  );
}