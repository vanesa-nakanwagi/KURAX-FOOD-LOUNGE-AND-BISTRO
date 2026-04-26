import React, { useState } from "react";
import { ChefHat, Coffee, Wine, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { kampalaDate } from "../utils/helpers";

const iconMap = {
  chef: <ChefHat size={22}/>,
  coffee: <Coffee size={22}/>,
  wine: <Wine size={22}/>
};

export default function StationCard({ icon, label, color, borderColor, summary, loading, tickets }) {
  const [expanded, setExpanded] = useState(false);
  const t = summary?.totals || {};
  const IconComponent = typeof icon === 'string' ? iconMap[icon] : icon;

  return (
    <div className={`bg-gradient-to-br from-zinc-900/40 to-zinc-900/20 border ${borderColor} rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.01]`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color.bg} transition-transform duration-300`}>
              <span className={color.text}>{IconComponent}</span>
            </div>
            <div>
              <h3 className="font-black uppercase italic tracking-tighter text-white text-xl leading-none">{label}</h3>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{summary?.date || kampalaDate()}</p>
            </div>
          </div>
          {loading && <RefreshCw size={14} className="text-zinc-600 animate-spin"/>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-black/40 rounded-xl p-4 text-center">
            <p className="text-[8px] font-black uppercase text-zinc-600 mb-1">Tickets</p>
            <p className={`text-3xl font-black italic ${color.text}`}>{t.ticket_count || 0}</p>
          </div>
          <div className="bg-black/40 rounded-xl p-4 text-center">
            <p className="text-[8px] font-black uppercase text-zinc-600 mb-1">Items</p>
            <p className={`text-3xl font-black italic ${color.text}`}>{t.total_items || 0}</p>
          </div>
          <div className="bg-black/40 rounded-xl p-4 col-span-2">
            <p className="text-[8px] font-black uppercase text-zinc-600 mb-2">Status Breakdown</p>
            <div className="flex items-center justify-center gap-6 text-[10px] font-black uppercase">
              <div className="text-center">
                <div className="w-2 h-2 rounded-full bg-zinc-400 mx-auto mb-1" />
                <span className="text-zinc-400">{t.pending_count || 0} Pending</span>
              </div>
              <div className="text-center">
                <div className="w-2 h-2 rounded-full bg-orange-400 mx-auto mb-1 animate-pulse" />
                <span className="text-orange-400">{t.preparing_count || 0} Active</span>
              </div>
              <div className="text-center">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mx-auto mb-1" />
                <span className="text-emerald-400">{t.completed_count || 0} Done</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(summary?.chefs || summary?.baristas || summary?.barmen || []).length > 0 && (
        <div className="px-6 pb-4">
          <p className="text-[8px] font-black uppercase text-zinc-600 tracking-widest mb-2">Staff Breakdown</p>
          <div className="space-y-1.5">
            {(summary?.chefs || summary?.baristas || summary?.barmen || []).map(s => {
              const name  = s.chef || s.barista || s.barman;
              const count = s.items_handled || s.drinks_made;
              return (
                <div key={name} className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-xl hover:bg-black/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full ${color.bg} ${color.text} flex items-center justify-center text-[9px] font-black`}>
                      {name?.[0]}
                    </div>
                    <span className="text-[10px] font-black text-white uppercase">{name}</span>
                  </div>
                  <span className={`text-[10px] font-black ${color.text}`}>
                    {count} item{Number(count) !== 1 ? "s" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tickets && tickets.length > 0 && (
        <div className="px-6 pb-6">
          <button onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-[9px] font-black uppercase text-zinc-500 hover:text-white transition-colors mt-1 group">
            {expanded
              ? <ChevronUp size={11} className="group-hover:-translate-y-0.5 transition-transform"/>
              : <ChevronDown size={11} className="group-hover:translate-y-0.5 transition-transform"/>}
            {expanded ? "Hide" : "Show"} {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
          </button>
          {expanded && (
            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
              {tickets.map(tk => (
                <div key={tk.id} className="bg-black/40 rounded-xl p-3 flex items-center justify-between gap-2 hover:bg-black/60 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black text-white uppercase">T-{tk.table_name}</span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase
                        ${["Ready","Served","Paid"].includes(tk.status)
                          ? "bg-emerald-500/10 text-emerald-400"
                          : tk.status === "Preparing"
                          ? "bg-orange-500/10 text-orange-400"
                          : "bg-zinc-700/50 text-zinc-400"}`}>
                        {tk.status}
                      </span>
                    </div>
                    <p className="text-[9px] text-zinc-600 mt-0.5">
                      {tk.staff_name} · {new Date(tk.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                    </p>
                  </div>
                  <span className={`text-sm font-black italic ${color.text}`}>
                    {Array.isArray(tk.items) ? tk.items.length : 0} item{(Array.isArray(tk.items)?tk.items.length:0) !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}