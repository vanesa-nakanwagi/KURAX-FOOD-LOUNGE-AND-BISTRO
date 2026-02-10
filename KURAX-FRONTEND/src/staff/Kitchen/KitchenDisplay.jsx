import React, { useEffect, useRef, useState } from "react";
import { useData } from "../../customer/components/context/DataContext";
import { 
  Clock, CheckCircle, User, Play, Flame, Utensils, 
  AlertCircle, Search, RotateCcw // Added Search and RotateCcw
} from "lucide-react";
import Footer from "../../customer/components/common/Foooter";

export default function KitchenDisplay() {
  const { orders = [], setOrders } = useData() || {};
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState(""); // State for search


  const filteredOrders = (orders || [])
    .filter(order => {
      const isKitchenStatus = ["Pending", "Preparing", "Ready"].includes(order.status);
      
      // Check if the order has at least one item that is NOT a Drink
      const hasFoodItems = order.items.some(item => item.category !== "Drinks");

      if (!searchQuery.trim()) return isKitchenStatus && hasFoodItems;

      const searchLower = searchQuery.toLowerCase();
      return isKitchenStatus && hasFoodItems && (
        order.tableName?.toLowerCase().includes(searchLower) || 
        order.id.toLowerCase().includes(searchLower)
      );
    })
    .map(order => ({
      ...order,
      // Only send items that are NOT drinks to the Chef's view
      items: order.items.filter(item => item.category !== "Drinks")
    }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

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
      
      {/* Audio Permission Overlay */}
      {!audioEnabled && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <button 
            onClick={() => { setAudioEnabled(true); playDing(); }}
            className="bg-yellow-500 text-black px-10 py-5 rounded-2xl font-black uppercase italic animate-bounce flex items-center gap-3"
          >
            <Play fill="currentColor" size={20} /> Open Kitchen Station
          </button>
        </div>
      )}

      {/* HEADER WITH SEARCH BAR */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-6 bg-zinc-900 p-5 rounded-[2rem] border border-white/5 shadow-2xl gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center text-black">
            <Utensils size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-tighter leading-none">Kitchen Feed</h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Live Order Management</p>
          </div>
        </div>

        {/* NEW: SEARCH INPUT */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input 
            type="text"
            placeholder="Search Table (e.g. T04)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-white/10 rounded-full py-3 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-yellow-500 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-emerald-500">Ready: {orders.filter(o => o.status === "Ready").length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-blue-400">Cooking: {orders.filter(o => o.status === "Preparing").length}</span>
          </div>
        </div>
      </header>

      {/* ORDERS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-12">
        {filteredOrders.map((order) => {
          const orderTime = order.timestamp ? new Date(order.timestamp) : new Date();
          const minutesAgo = Math.floor((new Date() - orderTime) / 60000);
          const isDelayed = minutesAgo >= 20 && order.status !== "Ready";
          
          // CHANGE: Visual styles for "Ready" orders
          const isReady = order.status === "Ready";
          const headerColor = isReady 
            ? "bg-zinc-700 opacity-50" 
            : order.status === "Preparing" 
              ? "bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.3)]" 
              : isDelayed ? "bg-rose-600" : "bg-zinc-800";

          return (
            <div key={order.id} className={`flex flex-col rounded-[2.5rem] border-2 bg-zinc-900 shadow-2xl transition-all duration-500 min-h-[350px] max-h-[450px] overflow-hidden ${isReady ? 'opacity-60 border-transparent grayscale-[0.5]' : isDelayed ? 'border-rose-600' : 'border-white/5'}`}>
              
              {/* Header Section */}
              <div className={`p-5 shrink-0 flex justify-between items-start ${headerColor} text-white`}>
                <div>
                  <h2 className="text-xl font-black tracking-tighter italic leading-none">
                    {order.tableName ? `TABLE ${order.tableName}` : order.id.slice(-5)}
                  </h2>
                  <div className="flex items-center gap-1 text-[9px] font-black uppercase opacity-70 mt-2">
                    <User size={10} /> {order.waiterName || "Staff"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 text-sm font-black italic">
                    <Clock size={14} /> {minutesAgo} Minutes Ago
                  </div>
                  {isReady && <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-500 text-black px-2 py-0.5 rounded mt-1 inline-block">Finished</span>}
                </div>
              </div>

              {/* Items List */}
              <div className="p-6 flex-grow overflow-y-auto space-y-3 custom-scrollbar">
                {order.items.map((item, idx) => (
                  <div key={idx} className="mb-3 last:mb-0">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`${isReady ? 'bg-zinc-600' : 'bg-yellow-500'} text-black text-[10px] font-black px-2 py-0.5 rounded-md`}>
                          {item.quantity}x
                        </span>
                        <span className={`font-bold text-sm uppercase tracking-tight ${isReady ? 'line-through text-zinc-500' : ''}`}>
                          {item.name}
                        </span>
                      </div>
                    </div>
                    {item.note && (
                      <div className="mt-1 ml-7 flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                        <AlertCircle size={12} className="text-rose-500" />
                        <p className="text-[11px] font-bold text-rose-500 leading-tight">{item.note}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Area */}
              <div className="p-4 mt-auto bg-black/40 border-t border-white/5 shrink-0">
                {order.status === "Pending" && (
                  <button onClick={() => updateStatus(order.id, "Preparing")} className="w-full py-4 bg-yellow-500 text-black font-black rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase italic">
                    <Flame size={16} /> Start Cooking
                  </button>
                )}
                {order.status === "Preparing" && (
                  <button onClick={() => updateStatus(order.id, "Ready")} className="w-full py-4 bg-emerald-500 text-black font-black rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase italic">
                    <CheckCircle size={16} /> Mark Ready
                  </button>
                )}
                {/* NEW: Allow Chef to "Undo" or restart a finished order if the waiter added more items */}
                {isReady && (
                  <button onClick={() => updateStatus(order.id, "Preparing")} className="w-full py-4 bg-zinc-800 text-zinc-400 font-black rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase italic border border-white/10">
                    <RotateCcw size={16} /> Back to Prep
                  </button>
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