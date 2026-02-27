import React, { useState } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { AlertCircle, CheckCircle2, Clock, SearchX } from "lucide-react";

export default function LiveOrderStatus() {
  const { orders = [] } = useData();
  const { theme } = useTheme();
  const [filter, setFilter] = useState("Open");

  const isDark = theme === 'dark';

  const displayOrders = orders.filter(order => {
    if (filter === "Open") return order.status === "Pending" || order.status === "Processing";
    if (filter === "Closed") return order.status === "Completed";
    if (filter === "Delayed") {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60000);
      return (order.status !== "Completed") && new Date(order.createdAt) < fifteenMinsAgo;
    }
    return true;
  });

  const getTabIcon = (tab) => {
    switch(tab) {
      case "Delayed": return <AlertCircle size={14} />;
      case "Open":    return <Clock size={14} />;
      case "Closed":  return <CheckCircle2 size={14} />;
      default:        return null;
    }
  };

  const getColors = (tab) => {
    switch(tab) {
      case "Delayed": return { bg: "bg-rose-500/10",    text: "text-rose-500",    border: "border-rose-500/20",    icon: <AlertCircle size={22} />  };
      case "Closed":  return { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/20", icon: <CheckCircle2 size={22} /> };
      default:        return { bg: "bg-yellow-500/10",  text: "text-yellow-500",  border: "border-yellow-500/20",  icon: <Clock size={22} />        };
    }
  };

  const colors = getColors(filter);

  // Count per tab for badges
  const counts = {
    Open: orders.filter(o => o.status === "Pending" || o.status === "Processing").length,
    Closed: orders.filter(o => o.status === "Completed").length,
    Delayed: orders.filter(o => {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60000);
      return o.status !== "Completed" && new Date(o.createdAt) < fifteenMinsAgo;
    }).length,
  };

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">

      {/* HEADER */}
      <div>
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic">
          Live Operations
        </h2>
        <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-[0.2em] md:tracking-[0.3em] mt-1">
          Kitchen & Floor Pulse
        </p>
      </div>

      {/* FILTER TABS */}
      <div className={`flex p-1.5 rounded-[2rem] border w-full md:w-fit ${
        isDark ? 'bg-zinc-900 border-white/5' : 'bg-zinc-100 border-black/5'
      }`}>
        {["Delayed", "Open", "Closed"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-4 md:px-8 py-3 rounded-[1.5rem] text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${
              filter === tab
                ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20"
                : "text-zinc-500 hover:text-zinc-400"
            }`}
          >
            {getTabIcon(tab)}
            <span>{tab}</span>
            {/* Count Badge */}
            {counts[tab] > 0 && filter !== tab && (
              <span className={`w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center ${
                isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-300 text-zinc-700'
              }`}>
                {counts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ORDERS LIST */}
      <div className="grid grid-cols-1 gap-3 md:gap-6">
        {displayOrders.length > 0 ? (
          displayOrders.map(order => (
            <div
              key={order.id}
              className={`p-4 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border flex items-center justify-between gap-3 transition-all ${
                isDark ? 'bg-zinc-900/30 border-white/5' : 'bg-white border-black/5 shadow-sm'
              }`}
            >
              {/* LEFT: Icon + Info */}
              <div className="flex items-center gap-3 md:gap-6 min-w-0">
                {/* Status Icon */}
                <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center shrink-0 ${colors.bg} ${colors.text}`}>
                  {colors.icon}
                </div>

                {/* Text */}
                <div className="min-w-0">
                  <h3 className="text-base md:text-xl font-black uppercase tracking-tighter truncate">
                    Table {order.tableNumber || order.table_number || '01'}
                  </h3>
                  <p className="text-[9px] md:text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    Order #{String(order.id)?.slice(-5)}
                  </p>
                  {/* Show items on mobile since there's less space */}
                  {order.items?.length > 0 && (
                    <p className="text-[9px] text-zinc-600 font-bold mt-0.5 truncate max-w-[160px] md:hidden">
                      {order.items.map(i => i.name).join(", ")}
                    </p>
                  )}
                </div>
              </div>

              {/* RIGHT: Status + Time */}
              <div className="text-right shrink-0">
                <span className={`inline-block px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest border ${colors.bg} ${colors.border} ${colors.text}`}>
                  {order.status}
                </span>
                <p className="mt-1.5 text-[10px] md:text-xs font-black italic opacity-40">
                  {new Date(order.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 md:py-32 flex flex-col items-center justify-center opacity-20">
            <SearchX size={48} strokeWidth={1} />
            <p className="mt-4 font-black uppercase italic tracking-[0.2em] text-sm">
              No {filter} Orders
            </p>
          </div>
        )}
      </div>
    </div>
  );
}