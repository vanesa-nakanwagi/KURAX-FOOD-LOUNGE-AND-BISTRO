import React from "react";
import { Banknote, CreditCard, Smartphone } from "lucide-react";

function formatAmount(value, available) {
  if (!available || value === null || value === undefined || Number.isNaN(Number(value))) return "Not available";
  return `UGX ${Number(value || 0).toLocaleString()}`;
}

export default function PaymentReconciliationSection({
  sys,
  physCash,
  physMomoMTN,
  physMomoAirtel,
  physCard,
  varCash,
  varMTN,
  varAirtel,
  varCard,
  summaryAvailable,
  physicalAvailable,
  credits,
  creditsAvailable,
}) {
  const rows = [
    { label: "Cash", icon: <Banknote size={15} className="text-emerald-600" />, expected: sys.cash, counted: physCash, variance: varCash },
    { label: "MTN", icon: <Smartphone size={15} className="text-yellow-600" />, expected: sys.mtn, counted: physMomoMTN, variance: varMTN },
    { label: "Airtel", icon: <Smartphone size={15} className="text-red-600" />, expected: sys.airtel, counted: physMomoAirtel, variance: varAirtel },
    { label: "Card", icon: <CreditCard size={15} className="text-blue-600" />, expected: sys.card, counted: physCard, variance: varCard },
  ];
  const combinedVariance = rows.reduce((sum, row) => sum + Number(row.variance || 0), 0);
  const countsAvailable = summaryAvailable && physicalAvailable;
  const creditRows = Array.isArray(credits) ? credits : [];
  const normalizeStatus = status => String(status || "").trim().toLowerCase();
  const approvedCredits = creditRows.filter(credit => ["approved", "partiallysettled", "fullysettled", "settled"].includes(normalizeStatus(credit.status)));
  const settledCredits = creditRows.filter(credit => ["fullysettled", "settled"].includes(normalizeStatus(credit.status)));
  const partiallyPaidCredits = creditRows.filter(credit => normalizeStatus(credit.status) === "partiallysettled");
  const balanceOf = credit => Math.max(0, Number(credit.balance ?? (Number(credit.amount || 0) - Number(credit.amount_paid || 0))) || 0);
  const totalSettled = settledCredits.reduce((sum, credit) => sum + Number(credit.amount_paid || credit.amount || 0), 0);
  const totalOutstanding = approvedCredits.reduce((sum, credit) => sum + balanceOf(credit), 0);
  const totalPartiallyPaid = partiallyPaidCredits.reduce((sum, credit) => sum + Number(credit.amount_paid || 0), 0);
  const partialRemaining = partiallyPaidCredits.reduce((sum, credit) => sum + balanceOf(credit), 0);
  const totalExpected = approvedCredits.reduce((sum, credit) => sum + Number(credit.amount || 0), 0);

  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-600">Priority control</p>
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-gray-900 mt-1">Payment reconciliation</h2>
          <p className="text-[11px] text-gray-500 mt-1">System expected against physical count. Variance is physical count minus system expected.</p>
        </div>
        <span className="text-[9px] font-black uppercase tracking-wider text-[#651b32]">Cash controls</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left">
          <thead>
            <tr className="border-y border-gray-100 text-[8px] uppercase tracking-widest text-gray-400">
              <th className="py-3 pr-4">Channel</th>
              <th className="py-3 pr-4">System expected</th>
              <th className="py-3 pr-4">Physical count</th>
              <th className="py-3 pr-4">Variance</th>
              <th className="py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const balanced = row.variance === 0;
              const shortage = Number(row.variance) < 0;
              return (
                <tr key={row.label} className="border-b border-gray-50 last:border-0 text-sm">
                  <td className="py-4 pr-4"><span className="inline-flex items-center gap-2 font-black text-gray-800">{row.icon}{row.label}</span></td>
                  <td className="py-4 pr-4 font-bold text-gray-700">{formatAmount(row.expected, summaryAvailable)}</td>
                  <td className="py-4 pr-4 font-bold text-gray-700">{formatAmount(row.counted, countsAvailable)}</td>
                  <td className={`py-4 pr-4 font-black ${!countsAvailable ? "text-gray-400" : balanced ? "text-emerald-700" : shortage ? "text-red-700" : "text-blue-700"}`}>{formatAmount(row.variance, countsAvailable)}</td>
                  <td className="py-4"><span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase ${!countsAvailable ? "bg-gray-100 text-gray-500" : balanced ? "bg-emerald-50 text-emerald-700" : shortage ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{!countsAvailable ? "Not available" : balanced ? "Balanced" : shortage ? "Short" : "Over"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
        <span className="text-[9px] font-black uppercase tracking-wider text-gray-500">Combined variance</span>
        <span className={`text-sm font-black ${countsAvailable ? combinedVariance < 0 ? "text-red-700" : combinedVariance === 0 ? "text-emerald-700" : "text-blue-700" : "text-gray-400"}`}>{formatAmount(combinedVariance, countsAvailable)}</span>
      </div>

      <div className="mt-6 pt-5 border-t border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-600">Receivables</p>
            <h3 className="text-sm font-black text-gray-900 mt-1">Credit position</h3>
          </div>
          <span className="text-[8px] font-black uppercase tracking-wider text-gray-400">Current month</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: "Total credit expected", value: totalExpected, detail: `${approvedCredits.length} approved credit records`, color: "text-[#651b32]", bg: "bg-[#651b32]/5" },
            { label: "Total credit settled", value: totalSettled, detail: `${settledCredits.length} fully settled`, color: "text-emerald-700", bg: "bg-emerald-50" },
            { label: "Total credit outstanding", value: totalOutstanding, detail: `${approvedCredits.filter(credit => balanceOf(credit) > 0).length} approved balances`, color: "text-purple-700", bg: "bg-purple-50" },
            { label: "Total credits partially paid", value: totalPartiallyPaid, detail: `${partiallyPaidCredits.length} partial · ${formatAmount(partialRemaining, creditsAvailable)} remaining`, color: "text-amber-700", bg: "bg-amber-50" },
          ].map(card => (
            <div key={card.label} className={`rounded-xl border border-gray-100 p-4 ${card.bg}`}>
              <p className="text-[8px] font-black uppercase tracking-wider text-gray-500">{card.label}</p>
              <p className={`text-lg font-black mt-2 ${creditsAvailable ? card.color : "text-gray-400"}`}>{formatAmount(card.value, creditsAvailable)}</p>
              <p className="text-[9px] text-gray-500 mt-1">{creditsAvailable ? card.detail : "Data source error."}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
