import React, { useEffect, useState } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { 
  Clock, Banknote, AlertCircle, CreditCard, Smartphone, 
  ChevronRight, CheckCircle, Flame, Timer, ClipboardList, 
  Utensils, User, Search, X 
} from "lucide-react";

import MomoPaymentModal from "./MomoPaymentModal";


export default function OrderHistory() {
  const { orders = [], setOrders } = useData() || {}; 
  const { theme } = useTheme();
  
  const [activeTab, setActiveTab] = useState("Live");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showMomoModal, setShowMomoModal] = useState(false);

  const DAILY_GOAL = 20; 
  const waiterName = "John Doe"; 
  const today = new Date().toISOString().split('T')[0];

  const dailyWaiterOrders = orders.filter(order => {
    const orderDate = new Date(order.timestamp).toISOString().split('T')[0];
    const matchesWaiter = order.waiterName === waiterName && orderDate === today;
    
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      order.tableName?.toLowerCase().includes(searchLower) || 
      order.id?.toLowerCase().includes(searchLower);

    return matchesWaiter && matchesSearch;
  });

  const filteredOrders = dailyWaiterOrders.filter(order => {
    if (activeTab === "Live") return ["Pending", "Preparing", "Ready", "Delayed"].includes(order.status);
    return order.status === "Served";
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));




  const handlePaymentTrigger = (order) => {
    setSelectedOrder(order);
    setShowMomoModal(true);
  };

  const markAsServed = (id) => {
    setOrders(prev => prev.map(order => 
      order.id === id ? { ...order, status: "Served" } : order
    ));
  };

  const progressPercent = Math.min((dailyWaiterOrders.length / DAILY_GOAL) * 100, 100);

 // 1. Calculate confirmed totals only
const totals = dailyWaiterOrders.reduce((acc, order) => {
  // Logic: Only add to the summary cards if the order is actually paid
  if (order.isPaid) {
    acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + order.total;
    acc.all += order.total;
  }
  return acc;
}, { Cash: 0, Card: 0, Momo: 0, all: 0 });


  return (
    <div className={`p-4 md:p-8 min-h-screen font-[Outfit] pb-24 transition-colors duration-300 ${
      theme === 'dark' ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'
    }`}>
      
      <MomoPaymentModal 
        isOpen={showMomoModal} 
        onClose={() => setShowMomoModal(false)} 
        totalAmount={selectedOrder?.total || 0}
        orderId={selectedOrder?.id}
        // This function ensures that clicking 'Confirm' in the modal
        // actually updates the order so the money shows in your cards.
        onConfirm={(id) => {
          setOrders(prev => prev.map(o => o.id === id ? { ...o, isPaid: true } : o));
          setShowMomoModal(false);
        }}
      />

      {/* HEADER */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">My Collections</h1>
            <p className={`${theme === 'dark' ? 'text-slate-500' : 'text-zinc-500'} text-xs font-bold uppercase tracking-tight`}>
              Finalize payments & Track performance
            </p>
          </div>

          <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-2xl border self-start ${
            theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-black/5 shadow-sm'
          }`}>
            <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-black">
              <User size={16} strokeWidth={3} />
            </div>
            <h3 className="text-[11px] font-black uppercase tracking-tight text-yellow-500">{waiterName}</h3>
          </div>
      </div>

      {/* SUMMARY CARDS (Condensed for Mobile) */}
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

      {/* IMPROVED: CONSOLIDATED TABS & SEARCH ROW */}
      <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-2 gap-4">
        <div className="flex gap-4 shrink-0">
          {["Live", "History"].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 text-[10px] font-black uppercase tracking-widest transition-all relative ${
                activeTab === tab ? 'text-yellow-500' : 'text-zinc-500'
              }`}
            >
              {tab} ({dailyWaiterOrders.filter(o => tab === "Live" ? o.status !== "Served" : o.status === "Served").length})
              {activeTab === tab && <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-yellow-500 rounded-full" />}
            </button>
          ))}
        </div>

        {/* COMPACT SEARCH FIELD */}
        <div className="relative flex-1 max-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
          <input 
            type="text"
            placeholder="Search Table..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full py-2 pl-9 pr-8 rounded-xl text-[10px] font-bold outline-none transition-all border ${
              theme === 'dark' 
                ? 'bg-zinc-900 border-white/5 text-white focus:border-yellow-500/50' 
                : 'bg-white border-black/5 text-black focus:border-yellow-500'
            }`}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
              <X size={14} />
            </button>
          )}
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
            <div key={order.id} className={`p-4 rounded-[2rem] flex items-center justify-between transition-all border-2 ${
              theme === 'dark' ? `bg-zinc-900 ${getStatusBorder(order.status, 'dark')}` : `bg-white ${getStatusBorder(order.status, 'light')}`
            }`}>
              {/* UPDATED ORDER INFO SECTION */}
<div>
  <div className="flex flex-wrap items-center gap-2 mb-0.5">
    {/* Table Number - Bold & Primary */}
    <span className="font-black text-sm uppercase italic">
      {order.tableName ? `Table ${order.tableName}` : 'No Table'}
    </span>
    
    {/* Order ID - Distinct secondary tag */}
    <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold border ${
      theme === 'dark' ? 'bg-white/5 border-white/10 text-zinc-400' : 'bg-black/5 border-black/10 text-zinc-500'
    }`}>
      #{order.id.slice(-6)} {/* Showing last 6 characters for clarity */}
    </span>

    {/* Status Badge */}
    <StatusBadge status={order.status} />
  </div>
  
  <p className="text-[9px] uppercase font-black text-zinc-500 tracking-tight">
     {order.items?.length || 0} Items • UGX {order.total.toLocaleString()}
  </p>
              </div>

              <div className="flex items-center gap-2">
                {order.status === "Ready" && (
                  <button onClick={() => markAsServed(order.id)} className="bg-emerald-500 text-black px-4 py-2 rounded-xl text-[9px] font-black uppercase italic shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform">
                    Serve
                  </button>
                )}
                
                {!order.isPaid && (
                  <button 
                    onClick={() => handlePaymentTrigger(order)}
                    className="bg-yellow-500 text-black px-4 py-2 rounded-xl text-[9px] font-black uppercase italic flex items-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <Smartphone size={12} /> Pay
                  </button>
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