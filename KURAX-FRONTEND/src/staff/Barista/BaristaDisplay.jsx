import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom"; // For redirection
import { useData } from "../../customer/components/context/DataContext";
import { 
  Clock, CheckCircle, Coffee, Play, 
  AlertCircle, Search, RotateCcw, Trophy, Bean,
  UserPlus, ClipboardCheck, User, Power
} from "lucide-react";
import Footer from "../../customer/components/common/Foooter";

export default function BaristaDisplay() {
  const { orders = [], setOrders } = useData() || {};
  const navigate = useNavigate();

  // --- AUTH & SESSION LOGIC ---
  const savedUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const baristaName = savedUser.name || "Head Barista";
  const baristaInitials = baristaName.split(' ').map(n => n[0]).join('').toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/staff/login');
  };

  const [audioEnabled, setAudioEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [shiftStats, setShiftStats] = useState({ totalBrewed: 0, totalOrders: 0 });
  const [assigningItem, setAssigningItem] = useState(null); 

  // --- FILTER LOGIC (UNCHANGED) ---
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

  // --- ASSIGN BARISTA LOGIC ---
  const handleAssignBarista = (baristaNameInput) => {
    if (!baristaNameInput) return;
    const { orderId, itemIdx } = assigningItem;
    
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const newItems = [...order.items];
        newItems[itemIdx] = { 
          ...newItems[itemIdx], 
          assignedTo: baristaNameInput,
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
              className="bg-orange-600 text-white px-12 py-5 rounded-2xl font-black uppercase italic hover:scale-105 transition-transform flex items-center gap-3 shadow-2xl shadow-orange-600/20 active:scale-95"
            >
              <Play fill="currentColor" size={20} /> Open Barista Station
            </button>
          </div>
        </div>
      )}

      {/* BARISTA ASSIGNMENT MODAL */}
      {assigningItem && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-500">
                <UserPlus size={20} />
              </div>
              <h3 className="font-black uppercase italic tracking-tighter text-lg">Assign Barista</h3>
            </div>
            
            <input 
              autoFocus id="baristaInput" type="text" placeholder="e.g. Timo" autoComplete="off"
              onKeyDown={(e) => e.key === 'Enter' && handleAssignBarista(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl py-4 px-5 text-sm font-bold text-white outline-none focus:border-orange-500 mb-4"
            />

            <div className="flex flex-col gap-2">
                <button onClick={() => { const val = document.getElementById('baristaInput').value; if(val) handleAssignBarista(val); }} className="w-full py-4 bg-orange-600 text-white font-black rounded-xl uppercase italic text-xs shadow-lg active:scale-95 transition-all">Confirm Assignment</button>
                <button onClick={() => setAssigningItem(null)} className="w-full py-3 text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER: Profile & Session Info */}
      <header className="flex flex-col lg:flex-row justify-between items-center mb-6 bg-zinc-900 p-4 lg:p-5 rounded-[2.5rem] border border-white/5 shadow-2xl gap-4">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg font-black text-xl border-b-4 border-orange-800">
            {baristaInitials[0]}
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter leading-none italic">{baristaName}</h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Certified Brewer Session</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center gap-4 w-full lg:w-auto">
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text" placeholder="Filter coffee orders..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-full py-3 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-orange-600 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
            <button onClick={handleShiftReset} className="flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white transition-all text-[10px] font-black uppercase italic">
                <RotateCcw size={14} /> Clear Feed
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 px-6 py-3 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all text-[10px] font-black uppercase italic">
                <Power size={14} /> Logout
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
            <div key={order.id} className={`flex flex-col rounded-[2.5rem] border-2 bg-zinc-900 transition-all duration-500 h-[450px] overflow-hidden ${isReady ? 'opacity-50 grayscale border-transparent' : isDelayed ? 'border-orange-600 animate-pulse-slow' : 'border-white/5 shadow-xl'}`}>
              
              <div className={`p-5 shrink-0 ${isReady ? 'bg-zinc-800' : isDelayed ? 'bg-orange-600' : 'bg-orange-950'} text-white`}>
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-black italic tracking-tighter uppercase leading-none">T-{order.tableName}</h2>
                  <span className="text-sm font-black italic flex items-center gap-1">
                    <Clock size={14} /> {minutesAgo}m
                  </span>
                </div>
                <p className="text-[9px] font-black uppercase opacity-60 mt-1">{order.waiterName || "Staff"}</p>
              </div>

              <div className="p-6 flex-grow overflow-y-auto space-y-4 custom-scrollbar">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-3 border-b border-white/5 pb-3 last:border-0">
                    <div className="flex items-start gap-2">
                        <span className="bg-orange-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded leading-none">{item.quantity}x</span>
                        <div>
                            <p className={`font-black text-sm uppercase leading-tight ${isReady ? 'line-through text-zinc-500' : 'text-white'}`}>{item.name}</p>
                            {item.note && <p className="text-[10px] text-orange-400 italic font-bold mt-1 bg-orange-600/5 p-1 rounded">"{item.note}"</p>}
                        </div>
                    </div>
                    <div className="shrink-0">
                      {item.assignedTo ? (
                        <span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black px-2 py-1 rounded-full border border-emerald-500/20">{item.assignedTo}</span>
                      ) : (
                        <button onClick={() => setAssigningItem({ orderId: order.id, itemIdx: idx })} className="bg-zinc-800 text-zinc-400 text-[8px] font-black px-2 py-1 rounded-full border border-white/5 hover:bg-orange-600 hover:text-white transition-all">+ Barista</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-black/20 border-t border-white/5">
                {order.status === "Pending" && (
                  <button onClick={() => updateStatus(order.id, "Preparing")} className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase italic active:scale-95 transition-all">
                    <Bean size={16} /> Start Brewing
                  </button>
                )}
                {order.status === "Preparing" && (
                  <button onClick={() => updateStatus(order.id, "Ready")} className="w-full py-4 bg-emerald-500 text-black font-black rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase italic active:scale-95 transition-all">
                    <CheckCircle size={16} /> Order Ready
                  </button>
                )}
                {isReady && (
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
            <h2 className="text-xl font-black uppercase italic mb-2">Shift Recap</h2>
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
              <button onClick={confirmEndShift} className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl uppercase italic text-xs shadow-lg active:scale-95 transition-all">Clear Feed</button>
              <button onClick={() => setShowSummary(false)} className="w-full py-4 text-zinc-500 font-bold uppercase tracking-widest text-[9px]">Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
}