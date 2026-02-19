import React, { useEffect, useRef, useState } from "react";
import { useData } from "../../customer/components/context/DataContext";
import { 
  Clock, CheckCircle, User, Play, Flame, Utensils, 
  Search, RotateCcw, X, Trophy, UserPlus, ShieldCheck, AlertCircle ,
  ChefHat, ClipboardCheck
} from "lucide-react";
import Footer from "../../customer/components/common/Foooter";

// This would ideally come from your database/context
const SUBORDINATES = ["Chef Eddy", "Chef Sarah", "Chef Moses", "Chef Junior", "Chef Anita"];

export default function KitchenDisplay() {
  const { orders = [], setOrders } = useData() || {};
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [shiftStats, setShiftStats] = useState({ totalOrders: 0, totalItems: 0 });
  
  // State for the Assignment Modal
  const [assigningItem, setAssigningItem] = useState(null); // { orderId, itemIdx }

const filteredOrders = (orders || [])
  .filter(order => {
    const isKitchenStatus = ["Pending", "Preparing", "Ready"].includes(order.status);
    
    // CHANGE: Check for items NOT belonging to the Barman station
    const hasKitchenItems = order.items.some(item => item.station !== "Barman");
    
    if (!searchQuery.trim()) return isKitchenStatus && hasKitchenItems;
    
    const searchLower = searchQuery.toLowerCase();
    return isKitchenStatus && hasKitchenItems && (
      order.tableName?.toLowerCase().includes(searchLower) || 
      order.id.toLowerCase().includes(searchLower)
    );
  })
  .map(order => ({
    ...order,
    // CHANGE: Sieve out the Barman items so the Chef never sees them
    items: order.items.filter(item => item.station !== "Barman")
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
  setOrders(prev => prev.map(order => {
    if (order.id === id) {
      // 1. Update status for all Kitchen items in this order
      const updatedItems = order.items.map(item => 
        item.station !== "Barman" ? { ...item, status: newStatus } : item
      );

      // 2. Logic: Only mark the WHOLE order "Ready" if Barman items are ALSO "Ready"
      const kitchenReady = updatedItems.filter(i => i.station !== "Barman").every(i => i.status === "Ready");
      const barReady = updatedItems.filter(i => i.station === "Barman").every(i => i.status === "Ready");

      return { 
        ...order, 
        items: updatedItems, 
        status: (kitchenReady && barReady) ? "Ready" : newStatus 
      };
    }
    return order;
  }));
};

  const handleAssignChef = (chefName) => {
    const { orderId, itemIdx } = assigningItem;
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const newItems = [...order.items];
        newItems[itemIdx] = { 
          ...newItems[itemIdx], 
          assignedTo: chefName,
          assignedAt: new Date().toISOString()
        };
        return { ...order, items: newItems };
      }
      return order;
    }));
    setAssigningItem(null);
  };

  const handleShiftReset = () => {
    const activeKitchenOrders = orders.filter(o => ["Pending", "Preparing", "Ready"].includes(o.status));
    const itemCount = activeKitchenOrders.reduce((sum, o) => sum + o.items.length, 0);
    setShiftStats({ totalOrders: activeKitchenOrders.length, totalItems: itemCount });
    setShowSummary(true);
  };

  const confirmEndShift = () => {
    setOrders(prev => prev.map(order => 
      ["Pending", "Preparing", "Ready"].includes(order.status) ? { ...order, status: "Served" } : order
    ));
    setShowSummary(false);
  };

  return (
    <div className="h-screen bg-zinc-950 p-4 md:p-6 overflow-hidden flex flex-col font-[Outfit] relative text-white">
      
      {/* Audio Permission Overlay */}
      {!audioEnabled && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="text-center">
            <ChefHat size={60} className="text-yellow-500 mx-auto mb-6 animate-pulse" />
            <button 
              onClick={() => { setAudioEnabled(true); playDing(); }}
              className="bg-yellow-500 text-black px-12 py-5 rounded-2xl font-black uppercase italic hover:scale-105 transition-transform flex items-center gap-3 shadow-2xl shadow-yellow-500/20"
            >
              <Play fill="currentColor" size={20} /> Start KItchen Session
            </button>
          </div>
        </div>
      )}

      {/* CHEF ASSIGNMENT MODAL */}
      {assigningItem && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-500">
                <UserPlus size={20} />
              </div>
              <h3 className="font-black uppercase italic tracking-tighter text-lg">Assign Chef</h3>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {SUBORDINATES.map(chef => (
                <button 
                  key={chef} 
                  onClick={() => handleAssignChef(chef)}
                  className="w-full py-4 bg-white/5 hover:bg-yellow-500 hover:text-black text-white text-xs font-black uppercase rounded-xl transition-all text-left px-5 flex justify-between items-center group"
                >
                  {chef}
                  <ClipboardCheck size={14} className="opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
            <button onClick={() => setAssigningItem(null)} className="w-full mt-6 py-3 text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Dismiss</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-6 bg-zinc-900 p-5 rounded-[2rem] border border-white/5 shadow-2xl gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-500 rounded-2xl flex items-center justify-center text-black shadow-lg shadow-yellow-500/20">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter leading-none italic">Production Feed</h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Head Chef Oversight Active</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text" placeholder="Search Table..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-full py-3 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-yellow-500 transition-all"
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
          const orderTime = order.timestamp ? new Date(order.timestamp) : new Date();
          const minutesAgo = Math.floor((new Date() - orderTime) / 60000);
          const isDelayed = minutesAgo >= 20 && order.status !== "Ready";
          
          return (
            <div key={order.id} className={`flex flex-col rounded-[2.5rem] border-2 bg-zinc-900 shadow-2xl transition-all duration-500 h-[450px] overflow-hidden ${order.status === "Ready" ? 'opacity-50 border-transparent grayscale' : isDelayed ? 'border-rose-600 animate-pulse-slow' : 'border-white/5'}`}>
              
              <div className={`p-5 shrink-0 flex justify-between items-start ${order.status === "Ready" ? 'bg-zinc-800' : order.status === "Preparing" ? 'bg-blue-600' : isDelayed ? 'bg-rose-600' : 'bg-zinc-800'}`}>
                <div>
                    <h2 className="text-xl font-black italic tracking-tighter uppercase leading-none">T-{order.tableName}</h2>
                    <p className="text-[9px] font-black text-white/60 uppercase mt-1">Ref: {order.id.slice(-5)}</p>
                </div>
                <div className="text-right">
                    <span className="text-sm font-black italic flex items-center gap-1">
                        <Clock size={14}/> {minutesAgo}m
                    </span>
                    <p className="text-[8px] font-bold uppercase opacity-60 mt-1">{order.waiterName}</p>
                </div>
              </div>

              <div className="p-6 flex-grow overflow-y-auto space-y-4 custom-scrollbar">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-3">
                    <div className="flex items-start gap-2">
                        <span className="bg-yellow-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded leading-none">{item.quantity}x</span>
                        <div>
                            <p className="font-black text-sm uppercase leading-tight">{item.name}</p>
                            {item.note && <p className="text-[10px] text-rose-400 italic font-bold mt-1 bg-rose-500/5 p-1 rounded">"{item.note}"</p>}
                        </div>
                    </div>
                    
                    {/* Assignment Interface */}
                    <div className="shrink-0">
                      {item.assignedTo ? (
                        <div className="flex flex-col items-end">
                          <span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black px-2 py-1 rounded-full border border-emerald-500/20">
                            {item.assignedTo.split(' ')[1] || item.assignedTo}
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
                          className="bg-zinc-800 text-zinc-400 text-[8px] font-black px-2 py-1 rounded-full border border-white/5 hover:bg-yellow-500 hover:text-black transition-all"
                        >
                          + Assign
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-black/20 border-t border-white/5">
                {order.status === "Pending" && (
                  <button onClick={() => updateStatus(order.id, "Preparing")} className="w-full py-4 bg-yellow-500 text-black font-black rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase italic">
                    <Flame size={16} /> Start Preparing
                  </button>
                )}
                {order.status === "Preparing" && (
                  <button onClick={() => updateStatus(order.id, "Ready")} className="w-full py-4 bg-emerald-500 text-black font-black rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase italic">
                    <CheckCircle size={16} /> Mark as Ready
                  </button>
                )}
                {order.status === "Ready" && (
                  <button onClick={() => updateStatus(order.id, "Preparing")} className="w-full py-4 bg-zinc-800 text-zinc-400 font-black rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase italic">
                    <RotateCcw size={16} /> Return to Kitchen
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* SHIFT SUMMARY MODAL WITH CAUTION */}
{showSummary && (
  <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4">
    <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[3rem] p-8 text-center shadow-2xl">
      <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertCircle size={32} />
      </div>
      
      <h2 className="text-xl font-black uppercase italic text-white mb-2">End Kitchen Shift?</h2>
      
      {/* CAUTION TEXT */}
      <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 mb-6">
        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest leading-relaxed">
          Caution: This will clear all active orders from the feed and mark them as served. This action cannot be undone.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-black/40 p-5 rounded-2xl border border-white/5">
          <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Orders</p>
          <p className="text-2xl font-black text-white">{shiftStats.totalOrders}</p>
        </div>
        <div className="bg-black/40 p-5 rounded-2xl border border-white/5">
          <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Items</p>
          <p className="text-2xl font-black text-white">{shiftStats.totalItems}</p>
        </div>
      </div>

      <div className="space-y-3">
        <button 
          onClick={confirmEndShift} 
          className="w-full py-5 bg-yellow-500 text-black font-black rounded-2xl uppercase italic text-xs shadow-lg shadow-yellow-500/10 active:scale-95 transition-all"
        >
          Yes, Confirm & Clear Feed
        </button>
        
        <button 
          onClick={() => setShowSummary(false)} 
          className="w-full py-4 text-zinc-500 font-bold uppercase tracking-widest text-[9px] hover:text-white transition-colors"
        >
          No, Stay on Shift
        </button>
      </div>
    </div>
  </div>
)}
      
      <Footer />
    </div>
  );
}