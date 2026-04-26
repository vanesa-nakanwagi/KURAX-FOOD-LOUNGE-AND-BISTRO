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

  // Light theme colors
  const lightColor = {
    text: color?.text?.replace('text-', 'text-') || "text-gray-800",
    bg: color?.bg?.replace('bg-', 'bg-') || "bg-gray-100"
  };

  return (
    <div className={`bg-white border ${borderColor || 'border-gray-200'} rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-yellow-300 shadow-sm`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${lightColor.bg} transition-transform duration-300`}>
              <span className={lightColor.text}>{IconComponent}</span>
            </div>
            <div>
              <h3 className="font-medium uppercase tracking-tighter text-yellow-900 text-xl leading-none">{label}</h3>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">{summary?.date || kampalaDate()}</p>
            </div>
          </div>
          {loading && <RefreshCw size={14} className="text-gray-400 animate-spin"/>}
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
            <p className="text-[8px] font-black uppercase text-gray-500 mb-1">Tickets</p>
            <p className={`text-3xl font-black italic ${lightColor.text}`}>{t.ticket_count || 0}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
            <p className="text-[8px] font-black uppercase text-gray-500 mb-1">Items</p>
            <p className={`text-3xl font-black italic ${lightColor.text}`}>{t.total_items || 0}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 col-span-2 border border-gray-100">
            <p className="text-[8px] font-black uppercase text-gray-500 mb-2">Status Breakdown</p>
            <div className="flex items-center justify-center gap-6 text-[10px] font-black uppercase">
              <div className="text-center">
                <div className="w-2 h-2 rounded-full bg-gray-400 mx-auto mb-1" />
                <span className="text-gray-500">{t.pending_count || 0} Pending</span>
              </div>
              <div className="text-center">
                <div className="w-2 h-2 rounded-full bg-orange-500 mx-auto mb-1 animate-pulse" />
                <span className="text-orange-600">{t.preparing_count || 0} Active</span>
              </div>
              <div className="text-center">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mx-auto mb-1" />
                <span className="text-emerald-600">{t.completed_count || 0} Done</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(summary?.chefs || summary?.baristas || summary?.barmen || []).length > 0 && (
        <div className="px-6 pb-4">
          <p className="text-[8px] font-black uppercase text-gray-500 tracking-widest mb-2">Staff Breakdown</p>
          <div className="space-y-1.5">
            {(summary?.chefs || summary?.baristas || summary?.barmen || []).map(s => {
              const name  = s.chef || s.barista || s.barman;
              const count = s.items_handled || s.drinks_made;
              return (
                <div key={name} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full ${lightColor.bg} ${lightColor.text} flex items-center justify-center text-[9px] font-black`}>
                      {name?.[0]}
                    </div>
                    <span className="text-[10px] font-black text-gray-800 uppercase">{name}</span>
                  </div>
                  <span className={`text-[10px] font-black ${lightColor.text}`}>
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
            className="flex items-center gap-1.5 text-[9px] font-black uppercase text-gray-500 hover:text-gray-700 transition-colors mt-1 group">
            {expanded
              ? <ChevronUp size={11} className="group-hover:-translate-y-0.5 transition-transform"/>
              : <ChevronDown size={11} className="group-hover:translate-y-0.5 transition-transform"/>}
            {expanded ? "Hide" : "Show"} {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
          </button>
          {expanded && (
            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
              {tickets.map(tk => (
                <div key={tk.id} className="bg-gray-50 rounded-xl p-3 flex items-center justify-between gap-2 hover:bg-gray-100 transition-colors border border-gray-100">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black text-gray-800 uppercase">T-{tk.table_name}</span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase
                        ${["Ready","Served","Paid"].includes(tk.status)
                          ? "bg-emerald-100 text-emerald-700"
                          : tk.status === "Preparing"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-gray-200 text-gray-600"}`}>
                        {tk.status}
                      </span>
                    </div>
                    <p className="text-[9px] text-gray-500 mt-0.5">
                      {tk.staff_name} · {new Date(tk.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                    </p>
                  </div>
                  <span className={`text-sm font-black italic ${lightColor.text}`}>
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