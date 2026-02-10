import React, { useState } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
// These will now be used below
import { AlertCircle, CheckCircle2, Clock, SearchX } from "lucide-react";

export default function LiveOrderStatus() {
  const { orders = [] } = useData();
  const { theme } = useTheme();
  const [filter, setFilter] = useState("Open");

  // Filter Logic
  const displayOrders = orders.filter(order => {
    if (filter === "Open") return order.status === "Pending" || order.status === "Processing";
    if (filter === "Closed") return order.status === "Completed";
    if (filter === "Delayed") {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60000);
      return (order.status !== "Completed") && new Date(order.createdAt) < fifteenMinsAgo;
    }
    return true;
  });

  // Helper to render the correct icon per tab
  const getTabIcon = (tab) => {
    switch(tab) {
      case "Delayed": return <AlertCircle size={16} />;
      case "Open": return <Clock size={16} />;
      case "Closed": return <CheckCircle2 size={16} />;
      default: return null;
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-4xl font-black uppercase tracking-tighter italic">Live Operations</h2>
        <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-[0.3em]">Kitchen & Floor Pulse</p>
      </div>

      {/* FILTER TABS WITH ICONS */}
      <div className={`flex p-1.5 rounded-[2rem] w-fit border ${theme === 'dark' ? 'bg-zinc-900 border-white/5' : 'bg-zinc-100 border-black/5'}`}>
        {["Delayed", "Open", "Closed"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex items-center gap-2 px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
              filter === tab 
                ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20" 
                : "text-zinc-500 hover:text-zinc-400"
            }`}
          >
            {getTabIcon(tab)}
            {tab}
          </button>
        ))}
      </div>

      {/* ORDERS LIST */}
      <div className="grid grid-cols-1 gap-6">
        {displayOrders.length > 0 ? (
           displayOrders.map(order => (
             <div key={order.id} className={`p-8 rounded-[2.5rem] border flex items-center justify-between transition-all ${
               theme === 'dark' ? 'bg-zinc-900/30 border-white/5' : 'bg-white border-black/5 shadow-sm'
             }`}>
                <div className="flex items-center gap-6">
                  {/* Status Icon Indicator */}
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                    filter === 'Delayed' ? 'bg-rose-500/10 text-rose-500' : 
                    filter === 'Closed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-yellow-500/10 text-yellow-500'
                  }`}>
                    {filter === 'Delayed' ? <AlertCircle size={28} /> : 
                     filter === 'Closed' ? <CheckCircle2 size={28} /> : <Clock size={28} />}
                  </div>

                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter">Table {order.tableNumber || '01'}</h3>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Order #{order.id?.slice(-5)}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                    filter === 'Delayed' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 
                    filter === 'Closed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                  }`}>
                    {order.status}
                  </span>
                  <p className="mt-2 text-xs font-black italic opacity-40">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
             </div>
           ))
        ) : (
          <div className="py-32 flex flex-col items-center justify-center opacity-20">
            <SearchX size={60} strokeWidth={1} />
            <p className="mt-4 font-black uppercase italic tracking-[0.2em]">No {filter} Orders</p>
          </div>
        )}
      </div>
    </div>
  );
}