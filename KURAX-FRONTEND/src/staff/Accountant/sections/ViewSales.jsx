import React from "react";
import { RefreshCw, BarChart3 } from "lucide-react";
import StationCard from "../common/StationCard";

export default function ViewSales({ 
  salesDate,
  setSalesDate,
  salesLoading,
  kitchenSummary,
  baristaSummary,
  barmanSummary,
  loadSales,
  isDark,
  textClass
}) {
  const totalTickets = [kitchenSummary, baristaSummary, barmanSummary].reduce((s,d) => s + Number(d?.totals?.ticket_count || 0), 0);
  const totalItems = [kitchenSummary, baristaSummary, barmanSummary].reduce((s,d) => s + Number(d?.totals?.total_items || 0), 0);
  const totalDone = [kitchenSummary, baristaSummary, barmanSummary].reduce((s,d) => s + Number(d?.totals?.completed_count || 0), 0);
  const hasData = kitchenSummary || baristaSummary || barmanSummary;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-black uppercase leading-none transition-colors duration-300 ${textClass}`}>
            Station Sales
          </h2>
          <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">Kitchen · Barista · Bar — daily output per station</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={salesDate} onChange={e => setSalesDate(e.target.value)}
            className="bg-zinc-900 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-xs font-bold outline-none focus:border-yellow-500/50"/>
          <button onClick={() => loadSales(salesDate)}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-white/5 rounded-2xl text-[10px] font-black text-zinc-400 uppercase hover:text-white transition-colors">
            <RefreshCw size={12} className={salesLoading ? "animate-spin" : ""}/> Refresh
          </button>
        </div>
      </div>

      {hasData && (
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
          <div>
            <p className="text-[9px] font-black uppercase text-black/60 tracking-widest">All Stations Combined</p>
            <h3 className="text-3xl font-black text-black italic mt-0.5">{totalTickets} tickets</h3>
          </div>
          <div className="flex items-center gap-6 text-black">
            <div className="text-center">
              <p className="text-[8px] font-black uppercase opacity-60">Total Items</p>
              <p className="text-2xl font-black">{totalItems}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] font-black uppercase opacity-60">Completed</p>
              <p className="text-2xl font-black">{totalDone}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] font-black uppercase opacity-60">Date</p>
              <p className="text-sm font-black">{salesDate}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <StationCard icon="chef" label="Kitchen"
          color={{ text: "text-yellow-400", bg: "bg-yellow-500/10" }} borderColor="border-yellow-500/20"
          summary={kitchenSummary} loading={salesLoading} tickets={kitchenSummary?.tickets || []}/>
        <StationCard icon="coffee" label="Barista"
          color={{ text: "text-orange-400", bg: "bg-orange-500/10" }} borderColor="border-orange-500/20"
          summary={baristaSummary} loading={salesLoading} tickets={baristaSummary?.tickets || []}/>
        <StationCard icon="wine" label="Bar"
          color={{ text: "text-blue-400", bg: "bg-blue-500/10" }} borderColor="border-blue-500/20"
          summary={barmanSummary} loading={salesLoading} tickets={barmanSummary?.tickets || []}/>
      </div>

      {!salesLoading && !hasData && (
        <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-3xl">
          <BarChart3 size={40} className="mx-auto text-zinc-700 mb-4"/>
          <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">No station data for {salesDate}</p>
          <p className="text-zinc-700 text-[9px] mt-2">Orders must pass through a station for tickets to be recorded</p>
        </div>
      )}
    </div>
  );
}