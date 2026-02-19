import React, { useEffect, useRef, useState } from "react";
import { useData } from "../../customer/components/context/DataContext";
import { 
  Clock, CheckCircle, User, Play, GlassWater, 
  AlertCircle, Search, RotateCcw, Trophy, Wine
} from "lucide-react";
import Footer from "../../customer/components/common/Foooter";

export default function BarmanDisplay() {
  const { orders = [], setOrders } = useData() || {};
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [shiftStats, setShiftStats] = useState({ totalDrinks: 0, totalOrders: 0 });

  // --- ROUTING LOGIC: Filter only for "Barman" tagged items ---
  const filteredOrders = (orders || [])
    .filter(order => {
      const isActiveStatus = ["Pending", "Preparing", "Ready"].includes(order.status);
      const hasBarItems = order.items.some(item => item.station === "Barman");
      
      if (!searchQuery.trim()) return isActiveStatus && hasBarItems;
      
      const searchLower = searchQuery.toLowerCase();
      return isActiveStatus && hasBarItems && (
        order.tableName?.toLowerCase().includes(searchLower) || 
        order.id.toLowerCase().includes(searchLower)
      );
    })
    .map(order => ({
      ...order,
      items: order.items.filter(item => item.station === "Barman")
    }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const prevOrdersLength = useRef(orders.length);

  const playChime = () => {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/1062/1062-preview.mp3");
    audio.play().catch(() => setAudioEnabled(false));
  };

  useEffect(() => {
    if (orders.length > prevOrdersLength.current) {
      const latestOrder = orders[orders.length - 1];
      const hasNewBarItems = latestOrder?.items.some(item => item.station === "Barman");
      if (latestOrder?.status === "Pending" && hasNewBarItems) playChime();
    }
    prevOrdersLength.current = orders.length;
  }, [orders]);

  const updateStatus = (id, newStatus) => {
    setOrders(prev => prev.map(order => 
      order.id === id ? { ...order, status: newStatus } : order
    ));
  };

  const handleShiftReset = () => {
    const barOrders = orders.filter(o => o.items.some(i => i.station === "Barman"));
    const drinkCount = barOrders.reduce((sum, o) => 
        sum + o.items.filter(i => i.station === "Barman").length, 0);
    
    setShiftStats({ totalOrders: barOrders.length, totalDrinks: drinkCount });
    setShowSummary(true);
  };

  return (
    <div className="h-screen bg-zinc-950 p-4 md:p-6 overflow-hidden flex flex-col font-[Outfit] relative">
      
      {!audioEnabled && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <button 
            onClick={() => { setAudioEnabled(true); playChime(); }}
            className="bg-blue-500 text-white px-10 py-5 rounded-2xl font-black uppercase italic animate-bounce flex items-center gap-3"
          >
            <Play fill="currentColor" size={20} /> Open Bar Station
          </button>
        </div>
      )}

      {showSummary && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[3rem] p-8 shadow-2xl text-center">
            <div className="w-20 h-20 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trophy size={40} />
            </div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">Shift Ended</h2>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-8">Barman Performance Summary</p>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-black/40 p-6 rounded-3xl border border-white/5">
                <p className="text-zinc-500 text-[9px] font-black uppercase mb-1">Tickets</p>
                <p className="text-3xl font-black text-white">{shiftStats.totalOrders}</p>
              </div>
              <div className="bg-black/40 p-6 rounded-3xl border border-white/5">
                <p className="text-zinc-500 text-[9px] font-black uppercase mb-1">Drinks Poured</p>
                <p className="text-3xl font-black text-white">{shiftStats.totalDrinks}</p>
              </div>
            </div>

            <button onClick={() => setShowSummary(false)} className="w-full py-5 bg-blue-500 text-white font-black rounded-2xl uppercase italic text-xs">Close Summary</button>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-center mb-6 bg-zinc-900 p-5 rounded-[2rem] border border-white/5 shadow-2xl gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
            <Wine size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-tighter leading-none">Bar Feed</h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Mixology & Drinks Station</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text"
              placeholder="Search Table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-full py-3 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <button onClick={handleShiftReset} className="flex items-center gap-2 px-5 py-3 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 group">
             <RotateCcw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
             <span className="text-[10px] font-black uppercase tracking-widest">End Shift</span>
          </button>
        </div>

        {/* Using CheckCircle and Clock here to resolve "Unused" errors */}
        <div className="hidden lg:flex items-center gap-6 text-[10px] font-black uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-emerald-500" />
            <span className="text-emerald-500">Ready: {orders.filter(o => o.status === "Ready" && o.items.some(i => i.station === "Barman")).length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-blue-400" />
            <span className="text-blue-400">Active: {filteredOrders.length}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-12">
        {filteredOrders.map((order) => {
          const minutesAgo = Math.floor((new Date() - new Date(order.timestamp)) / 60000);
          const isDelayed = minutesAgo >= 10 && order.status !== "Ready";
          const isReady = order.status === "Ready";

          return (
            <div key={order.id} className={`flex flex-col rounded-[2.5rem] border-2 bg-zinc-900 transition-all duration-500 min-h-[350px] max-h-[450px] overflow-hidden ${isReady ? 'opacity-50 grayscale' : isDelayed ? 'border-rose-600 animate-pulse' : 'border-white/5'}`}>
              <div className={`p-5 shrink-0 ${isReady ? 'bg-zinc-800' : isDelayed ? 'bg-rose-600' : 'bg-blue-600'} text-white`}>
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-black italic">TABLE {order.tableName}</h2>
                  <div className="flex items-center gap-1 text-sm font-black">
                    <Clock size={14} /> {minutesAgo}m
                  </div>
                </div>
                {/* Using User and GlassWater here */}
                <div className="flex items-center gap-1 text-[9px] font-black uppercase opacity-70 mt-2">
                  <User size={10} /> {order.waiterName || "Staff"}
                  <span className="mx-2">|</span>
                  <GlassWater size={10} /> Bar Station
                </div>
              </div>

              <div className="p-6 flex-grow overflow-y-auto space-y-4">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="bg-blue-500/20 text-blue-400 text-[10px] font-black px-2 py-1 rounded-lg">{item.quantity}x</span>
                    <div>
                      <p className={`font-bold text-sm uppercase ${isReady ? 'line-through text-zinc-500' : 'text-white'}`}>{item.name}</p>
                      {item.note && <p className="text-[10px] text-rose-400 italic">"{item.note}"</p>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-black/40">
                {order.status === "Pending" && (
                  <button onClick={() => updateStatus(order.id, "Preparing")} className="w-full py-4 bg-blue-500 text-white font-black rounded-2xl text-[10px] uppercase italic">
                    Start Mixing
                  </button>
                )}
                {order.status === "Preparing" && (
                  <button onClick={() => updateStatus(order.id, "Ready")} className="w-full py-4 bg-emerald-500 text-black font-black rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase italic">
                   <CheckCircle size={16} /> Mark Ready
                  </button>
                )}
                
                {/* Using AlertCircle here for delayed orders */}
                {isDelayed && !isReady && (
                  <div className="mt-3 flex items-center justify-center gap-1 text-rose-500 animate-pulse">
                    <AlertCircle size={12} />
                    <span className="text-[8px] font-black uppercase">Service Delay</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Footer />
    </div>
  );
}