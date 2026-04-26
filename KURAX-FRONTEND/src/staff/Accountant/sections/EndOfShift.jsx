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
  isDark = false,
  cardBgClass = "bg-white border border-gray-200 shadow-sm",
  textClass = "text-gray-900"
}) {
  const physicalTotal = physCash + physMomoMTN + physMomoAirtel + physCard;

  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="text-center">
        <h2 className={`text-2xl font-black uppercase tracking-tighter ${textClass}`}>
          Day Finalization
        </h2>
        <p className="text-yellow-600 text-[12px] font-bold mt-2 uppercase tracking-widest italic opacity-80">
          Reconcile system data with physical collections
        </p>
      </div>

      {dayClosed && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">
              ✅ Day has been closed - All totals have been reset to zero
            </p>
          </div>
        </div>
      )}

      {!hasPhysicalCount && !dayClosed && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle size={18} className="text-red-600" />
            <p className="text-[10px] font-black text-red-700 uppercase tracking-wider">
              ⚠️ You must enter physical count before closing the day!
            </p>
          </div>
          <button 
            onClick={() => setActiveSection("PHYSICAL_COUNT")}
            className="mt-3 px-4 py-2 bg-yellow-500 text-black rounded-xl text-[9px] font-black hover:bg-yellow-600 transition-all"
          >
            Go to Physical Count
          </button>
        </div>
      )}

      <div className={`rounded-3xl p-10 shadow-lg relative overflow-hidden transition-all duration-300 ${cardBgClass}`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-[60px] rounded-full"/>

        <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-[0.25em] mb-10 text-center">
          Verification Summary
        </h3>

        <div className="space-y-6 mb-12">
          <div className="flex justify-between items-center border-b border-gray-100 pb-6">
            <span className="text-gray-500 text-[11px] font-black uppercase tracking-wider">System Gross</span>
            <span className={`text-2xl font-black italic ${textClass}`}>
              {dayClosed ? "UGX 0" : `UGX ${fmt(sys.gross)}`}
            </span>
          </div>
          
          <div className="flex justify-between items-center border-b border-gray-100 pb-6">
            <span className="text-gray-500 text-[11px] font-black uppercase tracking-wider">Physical Total</span>
            <span className={`text-2xl font-black italic ${textClass}`}>
              {dayClosed ? "UGX 0" : `UGX ${fmt(physicalTotal)}`}
            </span>
          </div>
          
          <div className="flex justify-between items-center pt-4">
            <span className="text-gray-500 text-[11px] font-black uppercase tracking-wider">Closing Variance</span>
            <div className="text-right">
              <span className={`text-2xl font-black italic ${dayClosed ? "text-emerald-600" : varTotal >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {dayClosed ? "UGX 0" : `${varTotal >= 0 ? "+" : ""}UGX ${fmt(varTotal)}`}
              </span>
              <p className="text-[8px] font-black uppercase text-gray-400 mt-1">
                {dayClosed ? "Day Closed" : (varTotal === 0 ? "Balanced" : varTotal > 0 ? "Overage" : "Shortage")}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-2xl p-5 mb-8 space-y-2.5 border border-gray-100">
          <p className="text-[9px] font-black uppercase text-gray-600 tracking-widest mb-3">This will</p>
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
              <div className="w-4 h-4 rounded-full bg-yellow-100 border border-yellow-200 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"/>
              </div>
              <p className="text-[10px] font-bold text-gray-600">{item}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
            <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5"/>
            <p className="text-[11px] font-bold text-red-700">{error}</p>
          </div>
        )}

        <button onClick={handleDayClosure} disabled={isFinalizing || !hasPhysicalCount || dayClosed}
          className={`w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black uppercase text-[12px] tracking-[0.15em]
            py-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-4 shadow-lg shadow-yellow-500/20
            ${(isFinalizing || !hasPhysicalCount || dayClosed) ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] hover:shadow-xl"}`}>
          {isFinalizing
            ? <><RefreshCw size={18} className="animate-spin"/> Closing Accounts…</>
            : dayClosed 
              ? <><CheckCircle2 size={18}/> Day Already Closed</>
              : <><RotateCcw size={18}/> Close Accounts & Reset Dashboard</>}
        </button>
        
        {!hasPhysicalCount && !dayClosed && (
          <p className="text-center text-[9px] text-red-600 mt-3 font-bold">
            Physical count required before closing
          </p>
        )}
        
        {dayClosed && (
          <p className="text-center text-[9px] text-emerald-600 mt-3 font-bold">
            This day has been closed. All revenue and physical count totals have been archived.
          </p>
        )}
      </div>
    </div>
  );
}