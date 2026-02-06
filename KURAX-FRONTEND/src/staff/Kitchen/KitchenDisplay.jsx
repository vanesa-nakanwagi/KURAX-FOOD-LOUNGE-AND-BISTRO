import React, { useEffect, useRef, useState } from "react";
import { useData } from "../../customer/components/context/DataContext";
import { Clock, CheckCircle, Utensils, AlertCircle, User, Volume2, Play, Flame, Timer } from "lucide-react";
import Footer from "../../customer/components/common/Foooter";
export default function KitchenDisplay() {
  const { orders = [], setOrders } = useData() || {};
  const [audioEnabled, setAudioEnabled] = useState(false);
  
  // We now show Pending, Preparing, and Delayed (which is just a late Pending/Preparing)
  const activeOrders = orders.filter(order => 
    ["Pending", "Preparing", "Delayed"].includes(order.status)
  );
  
  const prevOrdersLength = useRef(orders.length);

  const playDing = () => {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    audio.play().catch(() => setAudioEnabled(false));
  };

  useEffect(() => {
    if (orders.length > prevOrdersLength.current) {
      const latestOrder = orders[orders.length - 1];
      if (latestOrder?.status === "Pending") playDing();
    }
    prevOrdersLength.current = orders.length;
  }, [orders]);

  const updateStatus = (id, newStatus) => {
    setOrders(prev => prev.map(order => 
      order.id === id ? { ...order, status: newStatus } : order
    ));
  };

  return (
    <div className="h-screen bg-zinc-950 p-4 md:p-6 overflow-hidden flex flex-col font-[Outfit] relative">
      
      {/* AUDIO UNLOCK OVERLAY */}
      {!audioEnabled && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <button 
            onClick={() => { setAudioEnabled(true); playDing(); }}
            className="bg-yellow-500 text-black px-10 py-5 rounded-2xl font-black uppercase italic animate-bounce flex items-center gap-3"
          >
            <Play fill="currentColor" /> Start Kitchen Session
          </button>
        </div>
      )}

      <header className="flex justify-between items-center mb-6 bg-zinc-900 p-4 rounded-2xl border border-slate-800 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${audioEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`} />
          <h1 className="text-xl font-black text-white uppercase tracking-tighter">Kitchen Live Feed</h1>
        </div>
        
        <div className="flex items-center gap-4 text-xs font-black uppercase">
          <span className="text-yellow-400">Preparing: {orders.filter(o => o.status === "Preparing").length}</span>
          <span className="text-rose-500">Delayed: {orders.filter(o => o.status === "Delayed").length}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-10">
        {activeOrders.map((order) => {
          const minutesAgo = Math.floor((new Date() - new Date(order.timestamp)) / 60000);
          
          // Logic: Auto-set "Delayed" if over 20 mins and not ready
          const isDelayed = minutesAgo >= 20;
          const statusColor = order.status === "Preparing" ? "bg-blue-600" : isDelayed ? "bg-rose-600" : "bg-zinc-800";

          return (
            <div key={order.id} className={`flex flex-col rounded-[2rem] border-2 bg-zinc-900 overflow-hidden shadow-2xl transition-all ${isDelayed ? 'border-rose-600 animate-pulse' : 'border-slate-800'}`}>
              
              {/* Ticket Header */}
              <div className={`p-4 flex justify-between items-center ${statusColor} text-white`}>
                <div>
                  <h2 className="text-xl font-black">{order.id}</h2>
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase opacity-80">
                    <User size={10} /> {order.waiterName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs font-black uppercase">
                    <Clock size={14} /> {minutesAgo}m
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-widest bg-black/20 px-2 py-0.5 rounded">
                    {isDelayed ? "DELAYED" : order.status}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="p-5 flex-1 space-y-4">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 border-b border-white/5 pb-3 last:border-0">
                    <span className="bg-yellow-500 text-black text-xs font-black px-2 py-1 rounded-md">{item.quantity}x</span>
                    <p className="text-md font-bold text-white uppercase">{item.name}</p>
                  </div>
                ))}
              </div>

              {/* Multi-Status Actions */}
              <div className="p-3 grid grid-cols-2 gap-2 bg-black/40 border-t border-white/5">
                {order.status === "Pending" ? (
                  <button 
                    onClick={() => updateStatus(order.id, "Preparing")}
                    className="col-span-2 py-3 bg-yellow-500 text-black font-black rounded-xl flex items-center justify-center gap-2 text-xs uppercase italic"
                  >
                    <Flame size={16} /> Start Cooking
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => updateStatus(order.id, "Ready")}
                      className="col-span-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl flex items-center justify-center gap-2 text-xs uppercase italic"
                    >
                      <CheckCircle size={16} /> Mark Ready
                    </button>
                  </>
                )}
                
                {/* Manual Delayed Toggle for extreme cases */}
                {!isDelayed && (
                   <button 
                    onClick={() => updateStatus(order.id, "Delayed")}
                    className="col-span-2 py-2 border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 font-bold rounded-xl text-[10px] uppercase transition-all"
                  >
                    Flag as Delayed
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      < Footer/>
    </div>
  );
}