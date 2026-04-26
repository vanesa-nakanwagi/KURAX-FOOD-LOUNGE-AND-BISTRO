import React from "react";
import { AlertTriangle } from "lucide-react";
import StatCard from "../common/StatCard";
import GrossRevenueCard from "../common/GrossRevenueCard";
import MonthlyCosts from "../MonthlyCosts";

export default function FinancialHistory({ 
  dayClosed, 
  sys, 
  totalMobileMoney, 
  totalSettledToday, 
  selectedMonth, 
  profitData, 
  profitLoad, 
  fetchMonthlyData, 
  API_URL, 
  isDark = false,
  hasPhysicalCount,
  setActiveSection
}) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          
          <p className="text-yellow-900 text-[17px] font-medium mt-1">Live from cashier queue and updates every 15 seconds</p>
          <p className={`text-[12px] italic mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}> Credit requests are NOT included in gross until approved and settled</p>
        </div>
        <div className="flex items-center gap-1 text-[8px] text-zinc-600">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-black uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Two stat cards per row on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          icon="cash"
          label="Cash Revenue"
          value={dayClosed ? 0 : sys.cash}
          color="text-emerald-500"
          gradient="from-emerald-900/30 to-emerald-800/10"
        />
        <StatCard
          icon="card"
          label="Card Payments"
          value={dayClosed ? 0 : sys.card}
          color="text-blue-400"
          gradient="from-blue-900/30 to-blue-800/10"
        />
        <StatCard
          icon="mobile"
          label="Mobile Money"
          value={dayClosed ? 0 : totalMobileMoney}
          color="text-purple-400"
          gradient="from-purple-900/30 to-purple-800/10"
          note="MTN + Airtel"
        />
        <GrossRevenueCard
          grossSales={dayClosed ? 0 : sys.gross}
          settledCredits={dayClosed ? 0 : totalSettledToday}
          pendingCredits={dayClosed ? 0 : sys.pending_credits}
        />
      </div>

      {/* Physical count warning - positioned below stat cards at the far right */}
      <div className="flex justify-end">
        {hasPhysicalCount !== undefined && !hasPhysicalCount && !dayClosed && (
          <div className="rounded-2xl bg-yellow-50 border border-yellow-200 p-3 text-center max-w-md w-full sm:w-auto">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <AlertTriangle size={14} className="text-yellow-600" />
              <span className="text-[9px] font-black text-yellow-700 uppercase tracking-wider">
                ⚠️ Physical count required!
              </span>
              <button 
                onClick={() => setActiveSection && setActiveSection("PHYSICAL_COUNT")}
                className="px-3 py-1 bg-yellow-500 text-black rounded-lg text-[8px] font-black shadow-sm hover:bg-yellow-600 transition-all"
              >
                Go to Physical Count
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Display pending credits info if any */}
      {!dayClosed && sys.pending_credits > 0 && (
        <div className={`rounded-2xl border p-4 ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-3">
            <AlertTriangle size={16} className="text-amber-500" />
            <div>
              <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-amber-600' : 'text-amber-700'}`}>
                Pending Credit Requests
              </p>
              <p className={`text-[9px] ${isDark ? 'text-zinc-600' : 'text-gray-600'}`}>
                UGX {sys.pending_credits.toLocaleString()} in credit requests waiting for approval. 
                These will be added to gross revenue when approved AND settled.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="pt-4">
        <div className="mb-4">
          <h2 className={`text-xl font-medium text-yellow-900 uppercase leading-none transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Monthly Expenses
          </h2>
          <p className={`text-[11px] font-medium mt-1 italic tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
            Fixed Costs & Operational Overheads
          </p>
        </div>
        <MonthlyCosts
          month={selectedMonth}
          monthLabel={selectedMonth}
          fixedItems={profitData?.costs?.fixed_items || []}
          profitLoad={profitLoad}
          onRefresh={fetchMonthlyData}
          API_URL={API_URL}
          dark={isDark}
          t={{
            card: isDark ? "bg-zinc-900/30" : "bg-white/80",
            divider: isDark ? "border-white/5" : "border-gray-200",
            subtext: isDark ? "text-zinc-500" : "text-gray-500"
          }}
        />
      </div>
    </div>
  );
}