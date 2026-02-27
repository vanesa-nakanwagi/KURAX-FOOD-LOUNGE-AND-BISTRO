import React, { useEffect, useState, useMemo } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { 
  Clock, Banknote, AlertCircle, CreditCard, Smartphone, 
  ChevronRight, CheckCircle, Flame, Timer, ClipboardList, XCircle,
  Utensils, User, Search, X, Activity
} from "lucide-react";

import MomoPaymentModal from "./MomoPaymentModal";

export default function OrderHistory() {
  const { orders = [], setOrders, currentUser } = useData() || {}; 
  const { theme } = useTheme();
  
  // --- USER IDENTIFICATION (Ensures name always shows) ---
  const savedUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const currentStaffId = currentUser?.id || savedUser?.id;
  const currentStaffName = currentUser?.name || savedUser?.name || "Staff Member"; 
  const userInitials = currentStaffName.split(' ').map(n => n[0]).join('').toUpperCase();
  // -------------------------------------------------------

  const [activeTab, setActiveTab] = useState("Live");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [showMomoModal, setShowMomoModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null); 
  const [voidRequest, setVoidRequest] = useState(null);

  const DAILY_GOAL = 20; 
  const today = new Date().toISOString().split('T')[0];

  // 1. Filter orders specifically for the logged-in user
  const dailyStaffOrders = useMemo(() => {
    return orders.filter(order => {
      const orderDate = new Date(order.timestamp).toISOString().split('T')[0];
      const isMyOrder = order.staffId === currentStaffId || order.waiterName === currentStaffName;
      return isMyOrder && orderDate === today;
    });
  }, [orders, currentStaffId, currentStaffName, today]);

  // 2. Grouping Logic
  const groupedTableOrders = useMemo(() => {
    return dailyStaffOrders.reduce((acc, order) => {
      const key = order.tableName?.trim().toUpperCase() || "WALK-IN";
      if (!acc[key]) {
        acc[key] = {
          tableName: key,
          displayId: order.id ? String(order.id).slice(-6) : "000000",
          total: Number(order.total) || 0,
          items: [...(order.items || [])],
          status: order.status, 
          isPaid: order.isPaid,
          timestamp: order.timestamp,
          orderIds: [order.id],
          waiterName: order.waiterName
        };
      } else {
        acc[key].total += Number(order.total) || 0;
        acc[key].items.push(...(order.items || []));
        acc[key].orderIds.push(order.id);
        if (order.status !== "Ready" && acc[key].status === "Ready") acc[key].status = order.status;
        if (!order.isPaid) acc[key].isPaid = false;
      }
      return acc;
    }, {});
  }, [dailyStaffOrders]);

  // 3. Final Filter
  const filteredOrders = useMemo(() => {
    return Object.values(groupedTableOrders).filter(group => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = group.tableName.toLowerCase().includes(searchLower);
      const isTabMatch = activeTab === "Live" 
        ? ["Pending", "Preparing", "Ready", "Delayed"].includes(group.status)
        : group.status === "Served";
      return matchesSearch && isTabMatch;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [groupedTableOrders, searchQuery, activeTab]);

  const currentOpenOrder = useMemo(() => {
    return Object.values(groupedTableOrders).find(o => 
      o.orderIds.includes(selectedOrderId) || o.displayId === selectedOrderId
    );
  }, [groupedTableOrders, selectedOrderId]);

  const progressPercent = Math.min((dailyStaffOrders.length / DAILY_GOAL) * 100, 100);

  const totals = useMemo(() => {
    return dailyStaffOrders.reduce((acc, order) => {
      if (order.isPaid) {
        acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + order.total;
        acc.all += order.total;
      }
      return acc;
    }, { Cash: 0, Card: 0, Momo: 0, all: 0 });
  }, [dailyStaffOrders]);

  return (
    <div className={`p-4 md:p-8 min-h-screen font-[Outfit] pb-32 transition-colors duration-300 ${theme === 'dark' ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'}`}>
      
      {/* HEADER SECTION - CUSTOMIZED FOR USER */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Session Active</p>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter  leading-none">
            {currentStaffName.split(' ')[0]}'s <span className="text-yellow-500">Dashboard</span>
          </h1>
          <p className="text-yellow-900 text-[10px] font-medium  mt-2 tracking-widest">
            Tracking {dailyStaffOrders.length} orders for today
          </p>
        </div>

        
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        <div className={`p-5 rounded-[2rem] border ${theme === 'dark' ? 'bg-zinc-900 border-white/5' : 'bg-white border-black/5'}`}>
          <div className="flex justify-between items-center mb-3">
             <p className="text-[10px] font-black uppercase text-zinc-500">Target</p>
             <Activity size={14} className="text-orange-500" />
          </div>
          <h3 className="text-2xl font-black italic">{dailyStaffOrders.length}<span className="text-xs text-zinc-600 not-italic ml-1">/{DAILY_GOAL}</span></h3>
          <div className="w-full h-1.5 bg-zinc-800 mt-3 rounded-full overflow-hidden">
             <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <SummaryCard theme={theme} label="Cash" value={totals.Cash} icon={<Banknote size={16} className="text-emerald-500" />} />
        <SummaryCard theme={theme} label="Momo" value={totals.Momo} icon={<Smartphone size={16} className="text-yellow-500" />} />
        <SummaryCard theme={theme} label="Card" value={totals.Card} icon={<CreditCard size={16} className="text-blue-500" />} />
        <SummaryCard theme={theme} label="Gross" value={totals.all} highlight />
      </div>

      {/* SEARCH AND TABS */}
      <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4 gap-6">
        <div className="flex gap-6 shrink-0">
          {["Live", "Served"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-3 text-[11px] font-black uppercase tracking-widest relative transition-colors ${activeTab === tab ? 'text-yellow-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {tab} ({Object.values(groupedTableOrders).filter(o => tab === "Live" ? ["Pending", "Preparing", "Ready", "Delayed"].includes(o.status) : o.status === "Served").length})
              {activeTab === tab && <div className="absolute bottom-[-2px] left-0 right-0 h-1 bg-yellow-500 rounded-full" />}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input type="text" placeholder="Filter tables..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full py-3 pl-12 pr-6 rounded-2xl text-xs font-bold outline-none border transition-all ${theme === 'dark' ? 'bg-zinc-900 border-white/5 focus:border-yellow-500/50 text-white' : 'bg-white border-black/5 focus:border-yellow-500'}`} />
        </div>
      </div>

      {/* ORDERS LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full py-32 text-center opacity-20">
             <ClipboardList size={60} className="mx-auto mb-4" />
             <p className="text-xs font-black uppercase tracking-[0.3em]">No orders in {activeTab}</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.tableName} onClick={() => setSelectedOrderId(order.orderIds[0])} className={`p-6 rounded-[2.5rem] flex items-center justify-between cursor-pointer transition-all border-2 group hover:scale-[1.02] ${theme === 'dark' ? `bg-zinc-900 border-white/5 hover:border-yellow-500/30` : `bg-white border-black/5 shadow-sm hover:border-yellow-500`}`}>
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-black flex flex-col items-center justify-center border border-white/5">
                   <p className="text-[8px] font-black text-zinc-500 leading-none">TBL</p>
                   <p className="text-xl font-black text-white italic">{order.tableName.replace('TABLE', '')}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-lg uppercase italic tracking-tighter">{order.tableName}</span>
                    <span className="text-[9px] font-bold text-zinc-500">#{order.displayId}</span>
                  </div>
                  <p className="text-[10px] uppercase font-black text-zinc-500 tracking-tight">
                    {order.items.length} items • UGX {order.total.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {order.isPaid ? (
                  <div className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                    <CheckCircle size={14} className="text-emerald-500" />
                    <span className="text-[9px] font-black text-emerald-500 uppercase">Paid</span>
                  </div>
                ) : (
                   <div className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-[9px] font-black text-yellow-500 uppercase tracking-widest">Unpaid</div>
                )}
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <ChevronRight size={18} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- SHARED UI HELPERS ---

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
        <span className={`text-[9px] font-black uppercase ${highlight ? 'text-black/60' : 'text-slate-500'}`}>
          {highlight ? 'Total' : 'Collected'}
        </span>
      </div>
      <p className={`text-[10px] font-bold uppercase ${highlight ? 'text-black/70' : 'text-zinc-500'}`}>{label}</p>
      <h3 className="text-lg font-black leading-tight">UGX {value?.toLocaleString() || 0}</h3>
    </div>
  );
}

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