import React, { useEffect, useRef, useState } from "react";
import { useData } from "../../customer/components/context/DataContext";
import { 
  Clock, CheckCircle, Coffee, Play, 
  AlertCircle, Search, RotateCcw, Trophy, Bean,
  UserPlus, ClipboardCheck, User
} from "lucide-react";
import Footer from "../../customer/components/common/Foooter";

export default function BaristaDisplay() {
  const { orders = [], setOrders } = useData() || {};
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [shiftStats, setShiftStats] = useState({ totalBrewed: 0, totalOrders: 0 });
  
  // New State for Barista Assignment
  const [assigningItem, setAssigningItem] = useState(null); // { orderId, itemIdx }

  // --- FILTER LOGIC ---
  const filteredOrders = (orders || [])
    .filter(order => {
      const isActiveStatus = ["Pending", "Preparing", "Ready"].includes(order.status);
      const notCleared = !order.clearedByBarista;
      const hasBaristaItems = order.items.some(item => 
        item.station?.toLowerCase() === "barista" || item.station?.toLowerCase() === "coffee"
      );
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery.trim() || 
                           order.tableName?.toLowerCase().includes(searchLower) || 
                           order.id.toLowerCase().includes(searchLower);
      
      return isActiveStatus && notCleared && hasBaristaItems && matchesSearch;
    })
    .map(order => ({
      ...order,
      items: order.items.filter(item => 
        item.station?.toLowerCase() === "barista" || item.station?.toLowerCase() === "coffee"
      )
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
      const hasNewCoffee = latestOrder?.items.some(item => 
        item.station?.toLowerCase() === "barista" || item.station?.toLowerCase() === "coffee"
      );
      if (latestOrder?.status === "Pending" && hasNewCoffee) playChime();
    }
    prevOrdersLength.current = orders.length;
  }, [orders]);

  // --- NEW: ASSIGN BARISTA FUNCTION ---
  const handleAssignBarista = (baristaName) => {
    if (!baristaName) return;
    const { orderId, itemIdx } = assigningItem;
    
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const newItems = [...order.items];
        newItems[itemIdx] = { 
          ...newItems[itemIdx], 
          assignedTo: baristaName,
          assignedAt: new Date().toISOString()
        };
        return { ...order, items: newItems };
      }
      return order;
    }));
    setAssigningItem(null);
  };

  const updateStatus = (id, newStatus) => {
    setOrders(prev => prev.map(order => 
      order.id === id ? { ...order, status: newStatus } : order
    ));
  };

  const handleShiftReset = () => {
    const cupCount = filteredOrders.reduce((sum, o) => sum + o.items.length, 0);
    setShiftStats({ totalOrders: filteredOrders.length, totalBrewed: cupCount });
    setShowSummary(true);
  };

  const confirmEndShift = () => {
    setOrders(prev => prev.map(order => {
      const isVisibleHere = ["Pending", "Preparing", "Ready"].includes(order.status) && 
                            order.items.some(i => i.station?.toLowerCase() === "barista" || i.station?.toLowerCase() === "coffee");
      if (isVisibleHere) return { ...order, clearedByBarista: true };
      return order;
    }));
    setShowSummary(false);
  };

  return (
    <div className="h-screen bg-zinc-950 p-4 md:p-6 overflow-hidden flex flex-col font-[Outfit] relative text-white">
      
      {/* Audio Permission Overlay */}
      {!audioEnabled && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 text-center">
          <div>
            <Coffee size={60} className="text-orange-500 mx-auto mb-6 animate-pulse" />
            <button 
              onClick={() => { setAudioEnabled(true); playChime(); }}
              className="bg-orange-600 text-white px-12 py-5 rounded-2xl font-black uppercase italic hover:scale-105 transition-transform flex items-center gap-3 shadow-2xl shadow-orange-600/20"
            >
              <Play fill="currentColor" size={20} /> Open Barista Station
            </button>
          </div>
        </div>
      )}

      {/* BARISTA ASSIGNMENT MODAL (By Typing) */}
      {assigningItem && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-500">
                <UserPlus size={20} />
              </div>
              <h3 className="font-black uppercase italic tracking-tighter text-lg">Assign Barista</h3>
            </div>
            
            <input 
              autoFocus
              type="text"
              placeholder="Enter Barista Name (e.g. Timo)"
              onKeyDown={(e) => e.key === 'Enter' && handleAssignBarista(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl py-4 px-5 text-sm font-bold text-white outline-none focus:border-orange-500 mb-4"
              id="baristaInput"
            />

            <button 
              onClick={() => handleAssignBarista(document.getElementById('baristaInput').value)}
              className="w-full py-4 bg-orange-600 text-white font-black rounded-xl uppercase italic text-xs mb-2"
            >
              Confirm Assignment
            </button>
            <button onClick={() => setAssigningItem(null)} className="w-full py-3 text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Cancel</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-6 bg-zinc-900 p-5 rounded-[2rem] border border-white/5 shadow-2xl gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-600/20">
            <Coffee size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter leading-none italic">Barista Feed</h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Head Barista Oversight</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text" placeholder="Search Table..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-full py-3 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-orange-600 transition-all"
            />
          </div>
          <button onClick={handleShiftReset} className="flex items-center gap-2 px-6 py-3 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all text-[10px] font-black uppercase italic">
             <RotateCcw size={14} /> End Shift
          </button>
        </div>
      </header>

      {/* ORDERS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-12 custom-scrollbar">
        {filteredOrders.map((order) => {
          const minutesAgo = Math.floor((new Date() - new Date(order.timestamp)) / 60000);
          const isDelayed = minutesAgo >= 12 && order.status !== "Ready";
          const isReady = order.status === "Ready";

          return (
            <div key={order.id} className={`flex flex-col rounded-[2.5rem] border-2 bg-zinc-900 transition-all duration-500 h-[450px] overflow-hidden ${isReady ? 'opacity-50 grayscale border-transparent' : isDelayed ? 'border-orange-600 animate-pulse-slow' : 'border-white/5'}`}>
              
              <div className={`p-5 shrink-0 ${isReady ? 'bg-zinc-800' : isDelayed ? 'bg-orange-600' : 'bg-orange-950'} text-white`}>
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-black italic tracking-tighter uppercase leading-none">T-{order.tableName}</h2>
                  <div className="text-right">
                    <span className="text-sm font-black italic flex items-center gap-1">
                      <Clock size={14} /> {minutesAgo}m
                    </span>
                  </div>
                </div>
                <p className="text-[9px] font-black uppercase opacity-60 mt-1">{order.waiterName || "Staff"}</p>
              </div>

              <div className="p-6 flex-grow overflow-y-auto space-y-4 custom-scrollbar">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-3">
                    <div className="flex items-start gap-2">
                        <span className="bg-orange-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded leading-none">{item.quantity}x</span>
                        <div>
                            <p className={`font-black text-sm uppercase leading-tight ${isReady ? 'line-through text-zinc-500' : 'text-white'}`}>{item.name}</p>
                            {item.note && <p className="text-[10px] text-rose-400 italic font-bold mt-1 bg-rose-500/5 p-1 rounded">"{item.note}"</p>}
                        </div>
                    </div>
                    
                    {/* Assignment UI */}
                    <div className="shrink-0">
                      {item.assignedTo ? (
                        <div className="flex flex-col items-end">
                          <span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black px-2 py-1 rounded-full border border-emerald-500/20">
                            {item.assignedTo}
                          </span>
                          <button 
                            onClick={() => setAssigningItem({ orderId: order.id, itemIdx: idx })}
                            className="text-[7px] text-zinc-500 mt-1 uppercase font-bold hover:text-white"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setAssigningItem({ orderId: order.id, itemIdx: idx })}
                          className="bg-zinc-800 text-zinc-400 text-[8px] font-black px-2 py-1 rounded-full border border-white/5 hover:bg-orange-600 hover:text-white transition-all"
                        >
                          + Barista
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-black/20 border-t border-white/5">
                {order.status === "Pending" && (
                  <button onClick={() => updateStatus(order.id, "Preparing")} className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase italic">
                    <Bean size={16} /> Start Brewing
                  </button>
                )}
                {order.status === "Preparing" && (
                  <button onClick={() => updateStatus(order.id, "Ready")} className="w-full py-4 bg-emerald-500 text-black font-black rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase italic">
                    <CheckCircle size={16} /> Order Ready
                  </button>
                )}
                {order.status === "Ready" && (
                  <button onClick={() => updateStatus(order.id, "Preparing")} className="w-full py-4 bg-zinc-800 text-zinc-400 font-black rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase italic">
                    <RotateCcw size={16} /> Return to Queue
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* SHIFT SUMMARY MODAL */}
      {showSummary && (
        <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 text-white">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[3rem] p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-orange-600/10 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy size={32} />
            </div>
            <h2 className="text-xl font-black uppercase italic mb-2">Shift Ended</h2>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-black/40 p-5 rounded-2xl border border-white/5">
                <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Dockets</p>
                <p className="text-2xl font-black">{shiftStats.totalOrders}</p>
              </div>
              <div className="bg-black/40 p-5 rounded-2xl border border-white/5">
                <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Cups</p>
                <p className="text-2xl font-black">{shiftStats.totalBrewed}</p>
              </div>
            </div>
            <div className="space-y-3">
              <button onClick={confirmEndShift} className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl uppercase italic text-xs shadow-lg shadow-orange-600/10 active:scale-95 transition-all">Clear My Feed</button>
              <button onClick={() => setShowSummary(false)} className="w-full py-4 text-zinc-500 font-bold uppercase tracking-widest text-[9px]">Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
}