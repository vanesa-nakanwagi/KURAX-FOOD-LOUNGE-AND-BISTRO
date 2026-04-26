import React from "react";
import { Calculator, TrendingUp, CheckCircle2, Save, Zap } from "lucide-react";
import PhysInput from "../common/PhysInput";
import VarianceRow from "../common/VarianceRow";
import { fmt } from "../utils/helpers";

export default function PhysicalCount({ 
  dayClosed,
  physLoading,
  physCash,
  setPhysCash,
  physMomoMTN,
  setPhysMomoMTN,
  physMomoAirtel,
  setPhysMomoAirtel,
  physCard,
  setPhysCard,
  physNotes,
  setPhysNotes,
  physSaving,
  physSaved,
  savePhysicalCount,
  pettyCashIn,
  sys,
  adjustedPhysCash,
  varCash,
  varMTN,
  varAirtel,
  varCard,
  varTotal,
  isDark = false,
  cardBgClass = "bg-white border border-gray-200 shadow-sm",
  textClass = "text-gray-900"
}) {
  const subTextClass = "text-gray-500";
  
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className={`text-2xl font-black uppercase leading-none ${textClass}`}>
          Physical Count
        </h2>
        <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">Enter actual cash/card/momo on hand — saved to database</p>
      </div>

      {dayClosed && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center">
          <p className="text-[10px] font-black text-emerald-700">✅ Day is closed - Physical count has been archived and reset to zero</p>
        </div>
      )}

      {pettyCashIn > 0 && !dayClosed && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
          <Zap size={16} className="text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-black uppercase text-yellow-700 tracking-widest">Petty Cash Replenishment Active</p>
            <p className="text-[11px] text-gray-600 mt-1">
              UGX {fmt(pettyCashIn)} was added to the drawer as replenishment today.
              This is automatically deducted from your physical cash before calculating the variance,
              since it is not sales revenue.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`p-8 rounded-2xl transition-all duration-300 ${cardBgClass}`}>
          <h3 className="text-[10px] font-black uppercase text-yellow-600 tracking-widest flex items-center gap-2 mb-5">
            <Calculator size={13}/> Physical Cash Entry
          </h3>
          {physLoading ? (
            <div className="h-40 animate-pulse bg-gray-100 rounded-2xl"/>
          ) : (
            <>
              <PhysInput label="Cash on Hand (including replenishment)" value={physCash} onChange={setPhysCash} color="text-emerald-600"/>
              <PhysInput label="MTN Momo" value={physMomoMTN} onChange={setPhysMomoMTN} color="text-yellow-600"/>
              <PhysInput label="Airtel Momo" value={physMomoAirtel} onChange={setPhysMomoAirtel} color="text-red-600"/>
              <PhysInput label="Card / POS" value={physCard} onChange={setPhysCard} color="text-blue-600"/>
              <div>
                <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${subTextClass}`}>Notes (optional)</p>
                <textarea value={physNotes} onChange={e => setPhysNotes(e.target.value)}
                  placeholder="Any discrepancy notes..."
                  disabled={dayClosed}
                  className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-gray-700 text-sm outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 resize-none h-16 transition-all disabled:opacity-50 disabled:bg-gray-100"/>
              </div>
              <button onClick={savePhysicalCount} disabled={physSaving || dayClosed}
                className={`w-full py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all duration-300
                  ${physSaved ? "bg-emerald-600 text-white" : "bg-yellow-500 text-black hover:bg-yellow-600"}
                  ${(physSaving || dayClosed) ? "opacity-60 cursor-not-allowed" : ""}`}>
                {physSaving ? "Saving…" : dayClosed ? <><CheckCircle2 size={14}/> Day Closed</> : physSaved ? <><CheckCircle2 size={14}/> Saved!</> : <><Save size={14}/> Save Count</>}
              </button>
            </>
          )}
        </div>

        <div className={`p-8 rounded-2xl transition-all duration-300 ${cardBgClass}`}>
          <h3 className="text-[10px] font-black uppercase text-yellow-600 tracking-widest flex items-center gap-2 mb-5">
            <TrendingUp size={13}/> Variance Analysis
          </h3>
          {dayClosed ? (
            <div className="text-center py-12">
              <CheckCircle2 size={48} className="mx-auto text-emerald-600 mb-4" />
              <p className="text-[11px] font-black text-emerald-700">All variances have been reset to zero</p>
              <p className={`text-[9px] ${subTextClass} mt-2`}>Day has been closed and archived</p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <VarianceRow
                  label={pettyCashIn > 0 ? `Cash (adj. −UGX ${fmt(pettyCashIn)} replenishment)` : "System Cash"}
                  system={sys.cash}
                  physical={adjustedPhysCash}
                  variance={varCash}
                />
                <VarianceRow label="System MTN" system={sys.mtn} physical={physMomoMTN} variance={varMTN}/>
                <VarianceRow label="System Airtel" system={sys.airtel} physical={physMomoAirtel} variance={varAirtel}/>
                <VarianceRow label="System Card" system={sys.card} physical={physCard} variance={varCard}/>
              </div>

              <div className={`mt-4 p-6 rounded-2xl border transition-all duration-300
                ${varTotal === 0 ? "bg-emerald-50 border-emerald-200"
                  : varTotal > 0 ? "bg-blue-50 border-blue-200"
                  : "bg-rose-50 border-rose-200"}`}>
                <p className={`text-[9px] font-black uppercase mb-1 ${subTextClass}`}>Total Variance</p>
                <h4 className={`text-2xl font-black italic
                  ${varTotal === 0 ? "text-emerald-700" : varTotal > 0 ? "text-blue-700" : "text-rose-700"}`}>
                  {varTotal >= 0 ? "+" : ""}UGX {fmt(varTotal)}
                </h4>
                <p className={`text-[9px] mt-1 uppercase font-bold ${subTextClass}`}>
                  {varTotal === 0 ? "Perfect match" : varTotal > 0 ? "Surplus on counter" : "Shortage detected"}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200 space-y-2">
                <p className={`text-[9px] font-black uppercase tracking-widest ${subTextClass}`}>System Totals (reference)</p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {[["Cash","emerald",sys.cash],["MTN","yellow",sys.mtn],["Airtel","red",sys.airtel],["Card","blue",sys.card]].map(([lbl,col,val]) => (
                    <div key={lbl} className="bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-colors border border-gray-100">
                      <p className={`text-gray-500 uppercase font-bold mb-0.5`}>{lbl}</p>
                      <p className={`text-${col}-700 font-black`}>UGX {fmt(val)}</p>
                    </div>
                  ))}
                </div>
                {pettyCashIn > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                    <p className="text-[8px] font-black uppercase text-yellow-700 tracking-widest">Replenishment netted from cash</p>
                    <p className="text-yellow-700 font-black text-sm mt-0.5">−UGX {fmt(pettyCashIn)}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}