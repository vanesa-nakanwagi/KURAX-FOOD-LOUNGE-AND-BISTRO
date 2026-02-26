import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom"; // Added for redirection
import { useData } from "../../customer/components/context/DataContext";
import { 
  Clock, CheckCircle, User, Play, GlassWater, 
  AlertCircle, Search, RotateCcw, Trophy, Wine,
  UserPlus, Martini, Power
} from "lucide-react";
import Footer from "../../customer/components/common/Foooter";

export default function BarmanDisplay() {
  const { orders = [], setOrders } = useData() || {};
  const navigate = useNavigate();

  // --- AUTH & SESSION LOGIC ---
  const savedUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const barmanName = savedUser.name || "Head Barman";
  const barmanInitials = barmanName.split(' ').map(n => n[0]).join('').toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/staff/login');
  };

  const [audioEnabled, setAudioEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [shiftStats, setShiftStats] = useState({ totalDrinks: 0, totalOrders: 0 });
  const [assigningItem, setAssigningItem] = useState(null); 

  // --- FILTER LOGIC: BARMAN STATION (UNCHANGED) ---
  const filteredOrders = (orders || [])
    .filter(order => {
      const isActiveStatus = ["Pending", "Preparing", "Ready"].includes(order.status);
      const notCleared = !order.clearedByBarman;
      const hasBarItems = order.items.some(item => item.station === "Barman");
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery.trim() || 
                           order.tableName?.toLowerCase().includes(searchLower) || 
                           order.id.toLowerCase().includes(searchLower);
      
      return isActiveStatus && notCleared && hasBarItems && matchesSearch;
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

  // --- ASSIGN BARMAN FUNCTION (UNCHANGED) ---
  const handleAssignBarman = (barmanNameInput) => {
    if (!barmanNameInput) return;
    const { orderId, itemIdx } = assigningItem;
    
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const newItems = [...order.items];
        newItems[itemIdx] = { 
          ...newItems[itemIdx], 
          assignedTo: barmanNameInput,
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
    const drinkCount = filteredOrders.reduce((sum, o) => sum + o.items.length, 0);
    setShiftStats({ totalOrders: filteredOrders.length, totalDrinks: drinkCount });
    setShowSummary(true);
  };

  const confirmEndShift = () => {
    setOrders(prev => prev.map(order => {
      const isVisibleHere = ["Pending", "Preparing", "Ready"].includes(order.status) && 
                            order.items.some(i => i.station === "Barman");
      if (isVisibleHere) return { ...order, clearedByBarman: true };
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
            <Martini size={60} className="text-blue-500 mx-auto mb-6 animate-pulse" />
            <button 
              onClick={() => { setAudioEnabled(true); playChime(); }}
              className="bg-blue-600 text-white px-12 py-5 rounded-2xl font-black uppercase italic hover:scale-105 transition-transform flex items-center gap-3 shadow-2xl shadow-blue-600/20 active:scale-95"
            >
              <Play fill="currentColor" size={20} /> Open Bar Station
            </button>
          </div>
        </div>
      )}

      {/* BARMAN ASSIGNMENT MODAL */}
      {assigningItem && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-500">
                <UserPlus size={20} />
              </div>
              <h3 className="font-black uppercase italic tracking-tighter text-lg text-white">Assign Mixologist</h3>
            </div>
            
            <input 
              autoFocus id="barmanInput" type="text" placeholder="e.g. Alex" autoComplete="off"
              onKeyDown={(e) => e.key === 'Enter' && handleAssignBarman(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl py-4 px-5 text-sm font-bold text-white outline-none focus:border-blue-500 mb-4"
            />

            <div className="flex flex-col gap-2">
              <button onClick={() => { const val = document.getElementById('barmanInput').value; if(val) handleAssignBarman(val); }} className="w-full py-4 bg-blue-600 text-white font-black rounded-xl uppercase italic text-xs shadow-lg active:scale-95 transition-all">Confirm Assignment</button>
              <button onClick={() => setAssigningItem(null)} className="w-full py-3 text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER: Profile & Session Info */}
      <header className="flex flex-col lg:flex-row justify-between items-center mb-6 bg-zinc-900 p-4 lg:p-5 rounded-[2.5rem] border border-white/5 shadow-2xl gap-4">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg font-black text-xl border-b-4 border-blue-800">
            {barmanInitials[0]}
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter leading-none italic">{barmanName}</h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Prime Bar Session</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center gap-4 w-full lg:w-auto">
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text" placeholder="Filter bar orders..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-full py-3 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
            <button onClick={handleShiftReset} className="flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white transition-all text-[10px] font-black uppercase italic">
                <RotateCcw size={14} /> Reset
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
            <div key={order.id} className={`flex flex-col rounded-[2.5rem] border-2 bg-zinc-900 transition-all duration-500 h-[450px] overflow-hidden ${isReady ? 'opacity-50 grayscale border-transparent' : isDelayed ? 'border-rose-600 animate-pulse-slow' : 'border-white/5 shadow-xl'}`}>
              
              <div className={`p-5 shrink-0 ${isReady ? 'bg-zinc-800' : isDelayed ? 'bg-rose-600' : 'bg-blue-600'} text-white`}>
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
                        <span className="bg-blue-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded leading-none">{item.quantity}x</span>
                        <div>
                            <p className={`font-black text-sm uppercase leading-tight ${isReady ? 'line-through text-zinc-500' : 'text-white'}`}>{item.name}</p>
                            {item.note && <p className="text-[10px] text-blue-400 italic font-bold mt-1 bg-blue-500/5 px-2 py-1 rounded">"{item.note}"</p>}
                        </div>
                    </div>
                    <div className="shrink-0">
                      {item.assignedTo ? (
                        <span className="bg-blue-500/10 text-blue-400 text-[8px] font-black px-2 py-1 rounded-full border border-blue-500/20">{item.assignedTo}</span>
                      ) : (
                        <button onClick={() => setAssigningItem({ orderId: order.id, itemIdx: idx })} className="bg-zinc-800 text-zinc-400 text-[8px] font-black px-2 py-1 rounded-full border border-white/5 hover:bg-blue-600 hover:text-white transition-all">+ Barman</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-black/20 border-t border-white/5">
                {order.status === "Pending" && (
                  <button onClick={() => updateStatus(order.id, "Preparing")} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase italic active:scale-95 transition-all">
                    <Martini size={16} /> Start Mixing
                  </button>
                )}
                {order.status === "Preparing" && (
                  <button onClick={() => updateStatus(order.id, "Ready")} className="w-full py-4 bg-emerald-500 text-black font-black rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase italic active:scale-95 transition-all">
                    <CheckCircle size={16} /> Order Ready
                  </button>
                )}
                {isReady && (
                   <button onClick={() => updateStatus(order.id, "Preparing")} className="w-full py-4 bg-zinc-800 text-zinc-400 font-black rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase italic">
                    <RotateCcw size={16} /> Recall Order
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
            <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy size={32} />
            </div>
            <h2 className="text-xl font-black uppercase italic mb-2">Shift Recap</h2>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-black/40 p-5 rounded-2xl border border-white/5">
                <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Tickets</p>
                <p className="text-2xl font-black">{shiftStats.totalOrders}</p>
              </div>
              <div className="bg-black/40 p-5 rounded-2xl border border-white/5">
                <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Drinks</p>
                <p className="text-2xl font-black">{shiftStats.totalDrinks}</p>
              </div>
            </div>
            <div className="space-y-3">
              <button onClick={confirmEndShift} className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl uppercase italic text-xs shadow-lg active:scale-95 transition-all">Clear Feed</button>
              <button onClick={() => setShowSummary(false)} className="w-full py-4 text-zinc-500 font-bold uppercase tracking-widest text-[9px]">Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
}