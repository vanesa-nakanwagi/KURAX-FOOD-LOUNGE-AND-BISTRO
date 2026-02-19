import React, { useEffect, useState } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { 
  Clock, Banknote, AlertCircle, CreditCard, Smartphone, 
  ChevronRight, CheckCircle, Flame, Timer, ClipboardList, XCircle,
  Utensils, User, Search, X 
} from "lucide-react";

import MomoPaymentModal from "./MomoPaymentModal";


export default function OrderHistory() {
  const { orders = [], setOrders } = useData() || {}; 
  const { theme } = useTheme();
  
  const [activeTab, setActiveTab] = useState("Live");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null); 
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [voidRequest, setVoidRequest] = useState(null); 
  const [customReason, setCustomReason] = useState("");
  
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [showMomoModal, setShowMomoModal] = useState(false);

  const DAILY_GOAL = 20; 
  const waiterName = "John Doe"; 
  const today = new Date().toISOString().split('T')[0];

  const dailyWaiterOrders = orders.filter(order => {
    const orderDate = new Date(order.timestamp).toISOString().split('T')[0];
    const matchesWaiter = order.waiterName === waiterName && orderDate === today;
    const searchLower = searchQuery.toLowerCase();
    return matchesWaiter && (order.tableName?.toLowerCase().includes(searchLower) || order.id?.toLowerCase().includes(searchLower));
  });

  const filteredOrders = dailyWaiterOrders.filter(order => {
  // LIVE TAB: Show everything that isn't "Served" yet
  if (activeTab === "Live") {
    return ["Pending", "Preparing", "Ready", "Delayed"].includes(order.status);
  }
  
  // SERVED TAB: Only show orders that have been officially served
  return order.status === "Served";
}).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const currentOpenOrder = orders.find(o => o.id === selectedOrderId);

  const handlePaymentTrigger = (e, order) => {
    e.stopPropagation(); // Stop click from opening the Table Details modal
    setSelectedOrder(order);
    setShowMethodSelector(true);
  };

  const handleRequestVoid = (reasonText) => {
  setOrders(prev => prev.map(order => {
    if (order.id === voidRequest.orderId) {
      const updatedItems = [...order.items];
      updatedItems[voidRequest.itemIdx] = {
        ...updatedItems[voidRequest.itemIdx],
        voidRequested: true,
        voidReason: reasonText, // Saves the typed text
        requestedBy: waiterName,
        requestTime: new Date().toISOString()
      };
      
      const updatedOrder = { ...order, items: updatedItems };
      setSelectedOrder(updatedOrder); 
      return updatedOrder;
    }
    return order;
  }));
  setVoidRequest(null);
};

  const processPayment = (method) => {
    if (method === 'Momo') {
      setShowMethodSelector(false);
      setShowMomoModal(true);
    } else {
      setOrders(prev => prev.map(o => 
        o.id === selectedOrder.id ? { ...o, isPaid: true, paymentMethod: method } : o
      ));
      setShowMethodSelector(false);
      setSelectedOrder(null);
    }
  };

  const markAsServed = (e, id) => {
    e.stopPropagation();
    setOrders(prev => prev.map(order => order.id === id ? { ...order, status: "Served" } : order));
  };

  const progressPercent = Math.min((dailyWaiterOrders.length / DAILY_GOAL) * 100, 100);

  const totals = dailyWaiterOrders.reduce((acc, order) => {
    if (order.isPaid) {
      acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + order.total;
      acc.all += order.total;
    }
    return acc;
  }, { Cash: 0, Card: 0, Momo: 0, all: 0 });

  return (
    <div className={`p-4 md:p-8 min-h-screen font-[Outfit] pb-24 transition-colors duration-300 ${theme === 'dark' ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'}`}>
      
      {/* 1. Payment Method Selector Modal */}
      <PaymentMethodSelector 
        isOpen={showMethodSelector} 
        onClose={() => { setShowMethodSelector(false); setSelectedOrder(null); }} 
        onSelect={processPayment} 
        amount={selectedOrder?.total || 0}
        theme={theme}
      />

      {/* 2. Momo Merchant Codes Modal */}
      <MomoPaymentModal 
        isOpen={showMomoModal} 
        onClose={() => { setShowMomoModal(false); setSelectedOrder(null); }} 
        totalAmount={selectedOrder?.total || 0}
        orderId={selectedOrder?.id}
        onConfirm={(id) => {
          setOrders(prev => prev.map(o => o.id === id ? { ...o, isPaid: true, paymentMethod: 'Momo' } : o));
          setShowMomoModal(false);
          setSelectedOrder(null);
        }}
      />

      {/* 3. TABLE DETAILS MODAL (Now fully reactive) */}
{currentOpenOrder && !showMethodSelector && !showMomoModal && (
  <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
    <div className="bg-zinc-900 border border-white/10 w-full max-w-2xl rounded-[3rem] overflow-hidden flex flex-col max-h-[90vh]">
      
      {/* Header */}
      <div className="p-8 border-b border-white/5 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">
            {currentOpenOrder.tableName} Details
          </h2>
          <p className="text-zinc-500 text-[10px] font-bold uppercase mt-1">
            Order #{currentOpenOrder.id.slice(-6)}
          </p>
        </div>
        {/* Close button now clears the ID state */}
        <button 
          onClick={() => setSelectedOrderId(null)} 
          className="p-3 bg-white/5 rounded-full text-zinc-400 hover:text-white"
        >
          <X size={24} />
        </button>
      </div>

      {/* Items List - Reactive to Accountant Approval */}
      <div className="flex-1 overflow-y-auto p-8 space-y-4">
        {currentOpenOrder.items
          .filter(item => item.status !== "VOIDED") 
          .map((item, idx) => (
            <div key={idx} className="bg-black/40 border border-white/5 rounded-[2rem] p-6 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <span className="bg-yellow-500 text-black text-xs font-black px-2 py-1 rounded-lg">
                  {item.quantity}x
                </span>
                <div>
                  <p className="font-bold text-white uppercase text-sm">{item.name}</p>
                  <p className="text-zinc-500 text-[10px] font-black italic">
                    UGX {item.price.toLocaleString()}
                  </p>
                </div>
              </div>

              {item.voidRequested ? (
                <span className="text-[9px] font-black uppercase text-rose-500 bg-rose-500/10 px-4 py-2 rounded-full border border-rose-500/20">
                  Void Pending...
                </span>
              ) : (
                <button 
                  onClick={() => setVoidRequest({ 
                    orderId: currentOpenOrder.id, 
                    itemIdx: idx, 
                    itemName: item.name 
                  })}
                  className="text-[9px] font-black uppercase text-rose-500 border border-rose-500/30 px-4 py-2 rounded-full hover:bg-rose-500 hover:text-white transition-all"
                >
                  Request Void
                </button>
              )}
            </div>
          ))}
        
        {/* State message if all items are voided */}
        {currentOpenOrder.items.filter(item => item.status !== "VOIDED").length === 0 && (
          <div className="py-20 text-center opacity-40">
            <XCircle size={40} className="mx-auto mb-2 text-rose-500" />
            <p className="text-[10px] font-black uppercase tracking-widest text-white">
              All items in this order have been voided
            </p>
          </div>
        )}
      </div>

      {/* Footer Summary (Updates Live) */}
      <div className="p-8 bg-black/60 border-t border-white/5 flex justify-between items-center">
        <div className="text-2xl font-black text-white italic">
          <span className="text-[10px] text-zinc-500 uppercase block not-italic">Total Bill</span>
          UGX {currentOpenOrder.total.toLocaleString()}
        </div>
        <button className="bg-yellow-500 text-black px-8 py-4 rounded-2xl font-black uppercase italic text-sm">
          Print Bill
        </button>
      </div>
    </div>
  </div>
)}

      {/* 4. CUSTOM VOID REASON MODAL */}
{voidRequest && (
  <div className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
    <div className="bg-zinc-900 border border-rose-500/30 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500">
          <AlertCircle size={20} />
        </div>
        <div>
          <h3 className="text-white font-black uppercase tracking-tighter leading-none">Request Void</h3>
          <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">{voidRequest.itemName}</p>
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 ml-2">
          Explain the reason for the Accountant:
        </label>
        
        <textarea 
          autoFocus
          value={customReason}
          onChange={(e) => setCustomReason(e.target.value)}
          placeholder="e.g. Customer changed mind after chef started cooking..."
          className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-xs text-white outline-none focus:border-rose-500/50 transition-all min-h-[120px] resize-none font-medium"
        />

        <div className="flex flex-col gap-2">
          <button 
            onClick={() => {
              if (customReason.trim().length < 3) return alert("Please provide a valid reason");
              handleRequestVoid(customReason);
              setCustomReason(""); // Reset for next time
            }}
            disabled={!customReason.trim()}
            className="w-full py-4 bg-rose-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-[10px] font-black uppercase rounded-xl hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/10"
          >
            Submit Request to Accountant
          </button>
          
          <button 
            onClick={() => {
              setVoidRequest(null);
              setCustomReason("");
            }} 
            className="w-full py-3 text-zinc-500 font-bold text-[9px] uppercase tracking-widest hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
)}

      {/* HEADER & SUMMARY CARDS */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">My Collections</h1>
            <p className={`${theme === 'dark' ? 'text-slate-500' : 'text-zinc-500'} text-xs font-bold uppercase tracking-tight`}>Finalize payments & Track performance</p>
          </div>
          <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-2xl border self-start ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-black/5 shadow-sm'}`}>
            <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-black"><User size={16} strokeWidth={3} /></div>
            <h3 className="text-[11px] font-black uppercase tracking-tight text-yellow-500">{waiterName}</h3>
          </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-zinc-900 border-slate-800' : 'bg-white border-black/5'}`}>
          <p className="text-[9px] font-black uppercase text-zinc-500 mb-1">Goal Progress</p>
          <h3 className="text-lg font-black">{dailyWaiterOrders.length} <span className="text-[10px] opacity-30">/ {DAILY_GOAL}</span></h3>
          <div className="w-full h-1 bg-zinc-800 mt-2 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <SummaryCard theme={theme} label="Cash" value={totals.Cash} icon={<Banknote size={14} className="text-emerald-500" />} />
        <SummaryCard theme={theme} label="Momo" value={totals.Momo} icon={<Smartphone size={14} className="text-yellow-500" />} />
        <SummaryCard theme={theme} label="Card" value={totals.Card} icon={<CreditCard size={14} className="text-blue-500" />} />
        <SummaryCard theme={theme} label="Total" value={totals.all} highlight />
      </div>

      {/* TABS & SEARCH */}
      <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-2 gap-4">
        <div className="flex gap-4 shrink-0">
          {["Live", "Served"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-2 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-yellow-500' : 'text-zinc-500'}`}>
              {tab} ({dailyWaiterOrders.filter(o => tab === "Live" ? o.status !== "Served" : o.status === "Served").length})
              {activeTab === tab && <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-yellow-500 rounded-full" />}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
          <input type="text" placeholder="Search Table..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full py-2 pl-9 pr-8 rounded-xl text-[10px] font-bold outline-none border ${theme === 'dark' ? 'bg-zinc-900 border-white/5 text-white' : 'bg-white border-black/5'}`} />
        </div>
      </div>

      {/* ORDERS LIST */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="py-20 text-center opacity-20">
            <ClipboardList size={40} className="mx-auto mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest">No matching orders</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div 
              key={order.id} 
              onClick={() => setSelectedOrderId(order.id)}
              className={`p-4 rounded-[2rem] flex items-center justify-between cursor-pointer transition-all border-2 hover:scale-[1.01] active:scale-95 ${
              theme === 'dark' ? `bg-zinc-900 border-white/5` : `bg-white border-black/5`
            }`}>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-black text-sm uppercase italic">{order.tableName || 'No Table'}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold border ${theme === 'dark' ? 'bg-white/5 border-white/10 text-zinc-400' : 'bg-black/5 border-black/10 text-zinc-500'}`}>#{order.id.slice(-6)}</span>
                  {order.items.some(i => i.voidRequested) && (
                    <span className="bg-rose-500 text-white px-2 py-0.5 rounded-md text-[8px] font-black uppercase italic animate-pulse">Void Pending</span>
                  )}
                </div>
                <p className="text-[9px] uppercase font-black text-zinc-500 tracking-tight">
            {order.items?.filter(i => i.status !== "VOIDED").length || 0} Items • UGX {order.total.toLocaleString()}
          </p>
              </div>

              <div className="flex items-center gap-2">
                {/* 1. SERVE BUTTON */}
{/* We check if status is "Ready" AND it's not currently pending a void */}
{order.status === "Ready" && !order.items.some(i => i.voidRequested) && (
  <button 
    onClick={(e) => markAsServed(e, order.id)} 
    className="bg-emerald-500 text-black px-4 py-2 rounded-xl text-[9px] font-black uppercase italic shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"
  >
    Serve
  </button>
)}
                {/* 2. PAY BUTTON / PAID INDICATOR */}
{!order.isPaid ? (
  <button 
    onClick={(e) => handlePaymentTrigger(e, order)}
    disabled={order.items.some(i => i.voidRequested)}
    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase italic flex items-center gap-1.5 transition-all ${
      order.items.some(i => i.voidRequested) 
      ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50' 
      : 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20 active:scale-95'
    }`}
  >
    <Banknote size={12} /> Pay
  </button>
) : (
  <div className="flex items-center gap-1 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
    <CheckCircle size={12} className="text-emerald-500" />
    <span className="text-[8px] font-black text-emerald-500 uppercase">Paid</span>
  </div>
)}
                <ChevronRight size={16} className="text-zinc-700 ml-1" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
// --- NEW COMPONENT: PAYMENT SELECTOR ---
function PaymentMethodSelector({ isOpen, onClose, onSelect, theme, amount }) {
  if (!isOpen) return null;
  const methods = [
    { id: 'Cash', icon: <Banknote size={24}/>, color: 'text-emerald-500' },
    { id: 'Card', icon: <CreditCard size={24}/>, color: 'text-blue-500' },
    { id: 'Momo', icon: <Smartphone size={24}/>, color: 'text-yellow-500' }
  ];
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className={`w-full max-w-sm p-8 rounded-[2.5rem] ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'}`}>
        <h3 className="text-center font-black uppercase tracking-tighter text-xl mb-1">Select Payment</h3>
        <p className="text-center text-zinc-500 text-[10px] mb-8 font-black uppercase">Table Total: UGX {amount.toLocaleString()}</p>
        <div className="space-y-3">
          {methods.map((m) => (
            <button key={m.id} onClick={() => onSelect(m.id)} className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all active:scale-95 ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-zinc-50 border-black/5'}`}>
              <div className="flex items-center gap-4"><span className={m.color}>{m.icon}</span><span className="font-black uppercase tracking-widest text-sm">{m.id}</span></div>
              <ChevronRight size={18} className="opacity-20" />
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-6 py-2 text-zinc-500 font-black uppercase text-[10px] tracking-[0.2em]">Close</button>
      </div>
    </div>
  );
}





// --- HELPER COMPONENTS (Paste these at the bottom of the file) ---

function SummaryCard({ label, value, icon, highlight, theme }) {
  const baseClasses = highlight 
    ? 'bg-yellow-500 border-yellow-500 text-black shadow-lg shadow-yellow-500/10' 
    : theme === 'dark' 
      ? 'bg-zinc-900 border-slate-800 text-white' 
      : 'bg-white border-black/5 text-zinc-900 shadow-sm';

  return (
    <div className={`p-4 rounded-2xl border transition-all ${baseClasses}`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
        {/* Changed 'Session' to 'Collected' to clarify it's confirmed money */}
        <span className={`text-[9px] font-black uppercase ${highlight ? 'text-black/60' : 'text-slate-500'}`}>
          {highlight ? 'Total' : 'Collected'}
        </span>
      </div>
      <p className={`text-[10px] font-bold uppercase ${highlight ? 'text-black/70' : 'text-zinc-500'}`}>{label}</p>
      <h3 className="text-lg font-black leading-tight">UGX {value?.toLocaleString() || 0}</h3>
      
      {/* Optional: Visual hint that this only counts paid orders */}
      {!highlight && (
        <div className={`mt-2 h-1 w-8 rounded-full ${value > 0 ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const configs = {
    Pending: { color: "bg-zinc-800 text-zinc-400", icon: <Timer size={10} />, label: "Pending" },
    Preparing: { color: "bg-blue-600 text-white", icon: <Flame size={10} />, label: "Cooking" },
    Ready: { color: "bg-emerald-500 text-black", icon: <CheckCircle size={10} />, label: "Ready" },
    Served: { color: "bg-zinc-800 text-zinc-600", icon: <Utensils size={10} />, label: "Served" },
    Delayed: { color: "bg-rose-600 text-white", icon: <AlertCircle size={10} />, label: "Late" }
  };
  const config = configs[status] || configs.Pending;
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter ${config.color}`}>
      {config.icon} {config.label}
    </span>
  );
}

function getStatusBorder(status, mode) {
  if (status === "Ready") return "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]";
  if (status === "Preparing") return mode === 'dark' ? "border-blue-500/50" : "border-blue-200";
  if (status === "Delayed") return mode === 'dark' ? "border-rose-500/50" : "border-rose-200";
  return mode === 'dark' ? "border-slate-800" : "border-black/5";
}

function getIconColor(method) {
  if (method === 'Cash') return 'text-emerald-500';
  if (method === 'Momo') return 'text-yellow-600';
  if (method === 'Card') return 'text-blue-500';
  return 'text-white';
}