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
  isDark,
  cardBgClass,
  textClass
}) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className={`text-2xl font-black uppercase leading-none transition-colors duration-300 ${textClass}`}>
          Physical Count
        </h2>
        <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">Enter actual cash/card/momo on hand — saved to database</p>
      </div>

      {dayClosed && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
          <p className="text-[10px] font-black text-emerald-600">✅ Day is closed - Physical count has been archived and reset to zero</p>
        </div>
      )}

      {pettyCashIn > 0 && !dayClosed && (
        <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
          <Zap size={16} className="text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-black uppercase text-yellow-400 tracking-widest">Petty Cash Replenishment Active</p>
            <p className="text-[11px] text-zinc-400 mt-1">
              UGX {fmt(pettyCashIn)} was added to the drawer as replenishment today.
              This is automatically deducted from your physical cash before calculating the variance,
              since it is not sales revenue.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`p-8 rounded-2xl transition-all duration-300 ${cardBgClass}`}>
          <h3 className="text-[10px] font-black uppercase text-yellow-500 tracking-widest flex items-center gap-2 mb-5">
            <Calculator size={13}/> Physical Cash Entry
          </h3>
          {physLoading ? (
            <div className="h-40 animate-pulse bg-zinc-800/30 rounded-2xl"/>
          ) : (
            <>
              <PhysInput label="Cash on Hand (including replenishment)" value={physCash} onChange={setPhysCash} color="text-emerald-400"/>
              <PhysInput label="MTN Momo" value={physMomoMTN} onChange={setPhysMomoMTN} color="text-yellow-400"/>
              <PhysInput label="Airtel Momo" value={physMomoAirtel} onChange={setPhysMomoAirtel} color="text-red-400"/>
              <PhysInput label="Card / POS" value={physCard} onChange={setPhysCard} color="text-blue-400"/>
              <div>
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Notes (optional)</p>
                <textarea value={physNotes} onChange={e => setPhysNotes(e.target.value)}
                  placeholder="Any discrepancy notes..."
                  disabled={dayClosed}
                  className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-yellow-500/50 resize-none h-16 transition-all disabled:opacity-50"/>
              </div>
              <button onClick={savePhysicalCount} disabled={physSaving || dayClosed}
                className={`w-full py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all duration-300
                  ${physSaved ? "bg-emerald-500 text-black" : "bg-gradient-to-r from-yellow-500 to-yellow-600 text-black hover:scale-[1.02]"}
                  ${(physSaving || dayClosed) ? "opacity-60 cursor-not-allowed" : ""}`}>
                {physSaving ? "Saving…" : dayClosed ? <><CheckCircle2 size={14}/> Day Closed</> : physSaved ? <><CheckCircle2 size={14}/> Saved!</> : <><Save size={14}/> Save Count</>}
              </button>
            </>
          )}
        </div>

        <div className={`p-8 rounded-2xl transition-all duration-300 ${cardBgClass}`}>
          <h3 className="text-[10px] font-black uppercase text-yellow-500 tracking-widest flex items-center gap-2 mb-5">
            <TrendingUp size={13}/> Variance Analysis
          </h3>
          {dayClosed ? (
            <div className="text-center py-12">
              <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4" />
              <p className="text-[11px] font-black text-emerald-600">All variances have been reset to zero</p>
              <p className="text-[9px] text-zinc-500 mt-2">Day has been closed and archived</p>
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
                ${varTotal === 0 ? "bg-emerald-500/10 border-emerald-500/20"
                  : varTotal > 0 ? "bg-blue-500/10 border-blue-500/20"
                  : "bg-rose-500/10 border-rose-500/20"}`}>
                <p className="text-[9px] font-black uppercase text-zinc-500 mb-1">Total Variance</p>
                <h4 className={`text-2xl font-black italic
                  ${varTotal === 0 ? "text-emerald-500" : varTotal > 0 ? "text-blue-400" : "text-rose-500"}`}>
                  {varTotal >= 0 ? "+" : ""}UGX {fmt(varTotal)}
                </h4>
                <p className="text-[9px] text-zinc-600 mt-1 uppercase font-bold">
                  {varTotal === 0 ? "Perfect match" : varTotal > 0 ? "Surplus on counter" : "Shortage detected"}
                </p>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-2">
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">System Totals (reference)</p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {[["Cash","emerald",sys.cash],["MTN","yellow",sys.mtn],["Airtel","red",sys.airtel],["Card","blue",sys.card]].map(([lbl,col,val]) => (
                    <div key={lbl} className="bg-black/40 rounded-xl p-3 hover:bg-black/60 transition-colors">
                      <p className="text-zinc-600 uppercase font-bold mb-0.5">{lbl}</p>
                      <p className={`text-${col}-400 font-black`}>UGX {fmt(val)}</p>
                    </div>
                  ))}
                </div>
                {pettyCashIn > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                    <p className="text-[8px] font-black uppercase text-yellow-500 tracking-widest">Replenishment netted from cash</p>
                    <p className="text-yellow-400 font-black text-sm mt-0.5">−UGX {fmt(pettyCashIn)}</p>
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