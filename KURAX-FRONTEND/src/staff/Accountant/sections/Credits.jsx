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
  isDark = false,
  cardBgClass = "bg-white border border-gray-200 shadow-sm"
}) {
  const textClass = "text-gray-900";
  const subTextClass = "text-gray-500";
  
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className={`text-2xl font-medium text-yellow-900 uppercase leading-none ${textClass}`}>
          Credits Ledger
        </h2>
        <p className="text-zinc-700 text-[13px] font-medium mt-1 italic">All on-account orders - pending, approved, settled, and rejected (Persists for current month)</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] bg-white border border-gray-200 shadow-sm`}>
          <div className="p-2.5 w-fit bg-purple-100 rounded-xl text-purple-600 mb-3"><BookOpen size={16}/></div>
          <p className="text-[8px] font-bold uppercase text-yellow-900 tracking-widest mb-1">Outstanding</p>
          <h3 className="text-xl font-black text-purple-600 ">{formatCurrencyCompact(totalOutstanding)}</h3>
          <p className={`text-[9px] ${subTextClass} mt-0.5`}>{creditsLedger.filter(c => c.status === "Approved" || c.status === "PartiallySettled").length} pending</p>
        </div>
        <div className={`rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] bg-white border border-gray-200 shadow-sm`}>
          <div className="p-2.5 w-fit bg-emerald-100 rounded-xl text-emerald-600 mb-3"><CheckCircle2 size={16}/></div>
          <p className="text-[8px] font-bold uppercase text-yellow-900 tracking-widest mb-1">Settled</p>
          <h3 className="text-xl font-black text-emerald-600 ">{formatCurrencyCompact(totalSettled)}</h3>
          <p className={`text-[9px] ${subTextClass} mt-0.5`}>{creditsLedger.filter(c => c.status === "FullySettled" || c.paid === true).length} cleared</p>
        </div>
        <div className={`rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] bg-white border border-gray-200 shadow-sm`}>
          <div className="p-2.5 w-fit bg-red-100 rounded-xl text-red-600 mb-3"><XCircle size={16}/></div>
          <p className="text-[8px] font-bold uppercase text-yellow-900 tracking-widest mb-1">Rejected</p>
          <h3 className="text-xl font-black text-red-600">{formatCurrencyCompact(totalRejected)}</h3>
          <p className={`text-[9px] ${subTextClass} mt-0.5`}>{creditsLedger.filter(c => c.status === "Rejected").length} rejected</p>
        </div>
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-5 rounded-2xl shadow-md">
          <div className="p-2.5 w-fit bg-black/20 rounded-xl text-black mb-3"><Receipt size={16}/></div>
          <p className="text-[8px] font-black uppercase text-black/60 tracking-widest mb-1">All Time Credits</p>
          <h3 className="text-xl font-black text-black ">{formatCurrencyCompact(totalOutstanding + totalSettled + totalRejected)}</h3>
          <p className="text-[9px] text-black/50 mt-0.5">{creditsLedger.length} total entries (current month)</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl w-fit">
        {[
          { key: "all", label: "All" },
          { key: "outstanding", label: "Outstanding" },
          { key: "settled", label: "Settled" },
          { key: "rejected", label: "Rejected" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setCreditFilter(key)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300
              ${creditFilter === key ? "bg-yellow-500 text-black shadow-md" : "text-yellow-900 hover:text-yellow-900"}`}>
            {label}
          </button>
        ))}
      </div>

      {creditsLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_,i) => <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse border border-gray-200"/>)}
        </div>
      ) : filteredCredits.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50">
          <BookOpen size={32} className="mx-auto text-zinc-600 mb-3"/>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">No credits found for this month</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCredits.map(credit => <AccountantCreditRow key={credit.id} credit={credit} isDark={false} />)}
        </div>
      )}
    </div>
  );
}