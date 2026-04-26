import React from "react";
import { BookOpen, CheckCircle2, XCircle, Receipt } from "lucide-react";
import AccountantCreditRow from "../common/AccountantCreditRow";
import { formatCurrencyCompact } from "../utils/helpers";

export default function Credits({ 
  creditsLedger,
  creditsLoading,
  creditFilter,
  setCreditFilter,
  filteredCredits,
  totalOutstanding,
  totalSettled,
  totalRejected,
  isDark,
  cardBgClass
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className={`text-2xl font-black uppercase leading-none transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Credits Ledger
        </h2>
        <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">All on-account orders — pending, approved, settled, and rejected (Persists for current month)</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] ${cardBgClass}`}>
          <div className="p-2.5 w-fit bg-purple-500/10 rounded-xl text-purple-400 mb-3"><BookOpen size={16}/></div>
          <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Outstanding</p>
          <h3 className="text-xl font-black text-purple-400 italic">{formatCurrencyCompact(totalOutstanding)}</h3>
          <p className="text-[9px] text-zinc-600 mt-0.5">{creditsLedger.filter(c => c.status === "Approved" || c.status === "PartiallySettled").length} pending</p>
        </div>
        <div className={`rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] ${cardBgClass}`}>
          <div className="p-2.5 w-fit bg-emerald-500/10 rounded-xl text-emerald-400 mb-3"><CheckCircle2 size={16}/></div>
          <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Settled</p>
          <h3 className="text-xl font-black text-emerald-400 italic">{formatCurrencyCompact(totalSettled)}</h3>
          <p className="text-[9px] text-zinc-600 mt-0.5">{creditsLedger.filter(c => c.status === "FullySettled" || c.paid === true).length} cleared</p>
        </div>
        <div className={`rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] ${cardBgClass}`}>
          <div className="p-2.5 w-fit bg-red-500/10 rounded-xl text-red-400 mb-3"><XCircle size={16}/></div>
          <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Rejected</p>
          <h3 className="text-xl font-black text-red-400 italic">{formatCurrencyCompact(totalRejected)}</h3>
          <p className="text-[9px] text-zinc-600 mt-0.5">{creditsLedger.filter(c => c.status === "Rejected").length} rejected</p>
        </div>
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-5 rounded-2xl">
          <div className="p-2.5 w-fit bg-black/20 rounded-xl text-black mb-3"><Receipt size={16}/></div>
          <p className="text-[8px] font-black uppercase text-black/60 tracking-widest mb-1">All Time Credits</p>
          <h3 className="text-xl font-black text-black italic">{formatCurrencyCompact(totalOutstanding + totalSettled + totalRejected)}</h3>
          <p className="text-[9px] text-black/50 mt-0.5">{creditsLedger.length} total entries (current month)</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-2xl w-fit">
        {[
          { key: "all", label: "All" },
          { key: "outstanding", label: "Outstanding" },
          { key: "settled", label: "Settled" },
          { key: "rejected", label: "Rejected" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setCreditFilter(key)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300
              ${creditFilter === key ? "bg-yellow-500 text-black shadow-lg" : "text-zinc-500 hover:text-zinc-300"}`}>
            {label}
          </button>
        ))}
      </div>

      {creditsLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_,i) => <div key={i} className="h-24 rounded-2xl bg-zinc-900/30 animate-pulse border border-white/5"/>)}
        </div>
      ) : filteredCredits.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
          <BookOpen size={32} className="mx-auto text-zinc-700 mb-3"/>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">No credits found for this month</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCredits.map(credit => <AccountantCreditRow key={credit.id} credit={credit}/>)}
        </div>
      )}
    </div>
  );
}