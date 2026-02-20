import React, { useState } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { 
  Banknote, AlertCircle, CreditCard, Smartphone, 
  ChevronRight, CheckCircle, Flame, Timer, ClipboardList, 
  Search, X, User, Utensils
} from "lucide-react";

import MomoPaymentModal from "./MomoPaymentModal";

export default function OrderHistory() {
  const { orders = [], setOrders } = useData() || {}; 
  const { theme } = useTheme();
  
  const [activeTab, setActiveTab] = useState("Live");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null); 
  const [voidRequest, setVoidRequest] = useState(null); 
  const [customReason, setCustomReason] = useState("");
  
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [showMomoModal, setShowMomoModal] = useState(false);

  const DAILY_GOAL = 30; 
  const managerName = "John"; 
  const today = new Date().toISOString().split('T')[0];
// 1. UNIVERSAL FILTER:
  // This looks for your name in BOTH possible columns and ignores capitalization
  const dailyWaiterOrders = orders.filter(order => {
    const orderDate = new Date(order.timestamp).toISOString().split('T')[0];
    const isToday = orderDate === today;
    
    // Normalize names to lowercase to prevent "John" vs "john" errors
    const myName = managerName.toLowerCase().trim();
    const orderManager = (order.managerName || "").toLowerCase().trim();
    const orderWaiter = (order.waiterName || "").toLowerCase().trim();

    // Show the order if:
    // 1. It's today AND
    // 2. You are the manager OR you are the waiter
    const belongsToMe = orderManager === myName || orderWaiter === myName;

    return isToday && belongsToMe;
  });

  // 2. FIXED GROUPING: Priority status handling
  const groupedTableOrders = dailyWaiterOrders.reduce((acc, order) => {
    const key = order.tableName?.trim().toUpperCase() || "WALK-IN";
    
    if (!acc[key]) {
      acc[key] = {
        tableName: key,
        displayId: order.id ? order.id.slice(-6) : "000000",
        total: Number(order.total) || 0,
        items: [...(order.items || [])],
        status: order.status || "Pending", 
        isPaid: order.isPaid || false,
        timestamp: order.timestamp,
        orderIds: [order.id],
      };
    } else {
      acc[key].total += Number(order.total) || 0;
      acc[key].items.push(...(order.items || []));
      acc[key].orderIds.push(order.id);
      
      // Status Hierarchy: Show the most "active" status
      const statusPriority = { "Delayed": 4, "Ready": 3, "Preparing": 2, "Pending": 1, "Served": 0 };
      if (statusPriority[order.status] > statusPriority[acc[key].status]) {
        acc[key].status = order.status;
      }
      if (!order.isPaid) acc[key].isPaid = false;
    }
    return acc;
  }, {});

  const filteredOrders = Object.values(groupedTableOrders).filter(group => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = group.tableName.toLowerCase().includes(searchLower);
    const isTabMatch = activeTab === "Live" 
      ? ["Pending", "Preparing", "Ready", "Delayed"].includes(group.status)
      : group.status === "Served";
    return matchesSearch && isTabMatch;
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const currentOpenOrder = Object.values(groupedTableOrders).find(o => 
    o.orderIds.includes(selectedOrderId) || o.displayId === selectedOrderId
  );

  // --- HANDLERS ---

  const handleRequestVoid = (reasonText) => {
    if (!voidRequest) return;
    setOrders(prev => prev.map(order => {
      if (order.id === voidRequest.orderId) {
        return {
          ...order,
          items: order.items.map(item => {
            if (item.name === voidRequest.itemName && !item.voidRequested) {
              return {
                ...item,
                voidRequested: true,
                voidReason: reasonText,
                requestedBy: managerName,
                requestTime: new Date().toISOString()
              };
            }
            return item;
          })
        };
      }
      return order;
    }));
    setVoidRequest(null);
    setCustomReason("");
  };

  const processPayment = (method) => {
    if (method === 'Momo') {
      setShowMethodSelector(false);
      setShowMomoModal(true);
    } else {
      setOrders(prev => prev.map(o => 
        selectedOrderForPayment.orderIds.includes(o.id) ? { ...o, isPaid: true, paymentMethod: method } : o
      ));
      setShowMethodSelector(false);
      setSelectedOrderForPayment(null);
    }
  };

  const markAsServed = (e, orderIds) => {
    e.stopPropagation();
    setOrders(prev => prev.map(order => 
      orderIds.includes(order.id) ? { ...order, status: "Served" } : order
    ));
  };

  const totals = dailyWaiterOrders.reduce((acc, order) => {
    if (order.isPaid) {
      acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + (order.total || 0);
      acc.all += (order.total || 0);
    }
    return acc;
  }, { Cash: 0, Card: 0, Momo: 0, all: 0 });

  return (
    <div className={`p-4 md:p-8 min-h-screen font-[Outfit] pb-24 transition-colors duration-300 ${theme === 'dark' ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'}`}>
      
      <PaymentMethodSelector 
        isOpen={showMethodSelector} 
        onClose={() => { setShowMethodSelector(false); setSelectedOrderForPayment(null); }} 
        onSelect={processPayment} 
        amount={selectedOrderForPayment?.total || 0}
        theme={theme}
      />

      <MomoPaymentModal 
        isOpen={showMomoModal} 
        onClose={() => { setShowMomoModal(false); setSelectedOrderForPayment(null); }} 
        totalAmount={selectedOrderForPayment?.total || 0}
        orderId={selectedOrderForPayment?.orderIds[0]}
        onConfirm={() => {
          setOrders(prev => prev.map(o => selectedOrderForPayment.orderIds.includes(o.id) ? { ...o, isPaid: true, paymentMethod: 'Momo' } : o));
          setShowMomoModal(false);
          setSelectedOrderForPayment(null);
        }}
      />

      {/* TABLE DETAILS MODAL */}
      {currentOpenOrder && !showMethodSelector && !showMomoModal && (
        <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-2xl rounded-[3rem] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-white/5 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">{currentOpenOrder.tableName} Details</h2>
                <p className="text-zinc-500 text-[10px] font-bold uppercase mt-1">Order #{currentOpenOrder.displayId}</p>
              </div>
              <button onClick={() => setSelectedOrderId(null)} className="p-3 bg-white/5 rounded-full text-zinc-400 hover:text-white"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-4">
              {currentOpenOrder.items
                .filter(item => item && item.name && item.status !== "VOIDED" && !item.voidProcessed)
                .map((item, idx) => {
                  const parentOrder = orders.find(o => 
                    currentOpenOrder.orderIds.includes(o.id) && 
                    o.items.some(i => i.name === item.name)
                  );

                  return (
                    <div key={`${item.name}-${idx}`} className="bg-black/40 border border-white/5 rounded-[2rem] p-6 flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <span className="bg-yellow-500 text-black text-xs font-black px-2 py-1 rounded-lg">{item.quantity || 1}x</span>
                        <div>
                          <p className="font-bold text-white uppercase text-sm">{item.name}</p>
                          <p className="text-zinc-500 text-[10px] font-black italic">UGX {(item.price || 0).toLocaleString()}</p>
                        </div>
                      </div>

                      {item.voidRequested ? (
                        <span className="text-[9px] font-black uppercase text-rose-500 bg-rose-500/10 px-4 py-2 rounded-full border border-rose-500/20">Void Pending...</span>
                      ) : (
                        <button 
                          onClick={() => setVoidRequest({ orderId: parentOrder?.id, itemName: item.name })}
                          className="text-[9px] font-black uppercase text-rose-500 border border-rose-500/30 px-4 py-2 rounded-full hover:bg-rose-500 hover:text-white transition-all"
                        >Request Void</button>
                      )}
                    </div>
                  );
                })}
            </div>

            <div className="p-8 bg-black/60 border-t border-white/5 flex justify-between items-center">
              <div className="text-2xl font-black text-white italic">
                <span className="text-[10px] text-zinc-500 uppercase block not-italic">Total Bill</span>
                UGX {(currentOpenOrder.total || 0).toLocaleString()}
              </div>
              <button className="bg-yellow-500 text-black px-8 py-4 rounded-2xl font-black uppercase italic text-sm">Print Bill</button>
            </div>
          </div>
        </div>
      )}

      {/* VOID MODAL */}
      {voidRequest && (
        <div className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-rose-500/30 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-white font-black uppercase tracking-tighter mb-4 text-center">Reason for Void</h3>
            <textarea value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Why is this item being removed?" className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-xs text-white outline-none mb-4 min-h-[100px]" />
            <button onClick={() => handleRequestVoid(customReason)} className="w-full py-4 bg-rose-600 text-white text-[10px] font-black uppercase rounded-xl">Submit to Accountant</button>
            <button onClick={() => setVoidRequest(null)} className="w-full mt-2 py-2 text-zinc-500 text-[9px] uppercase font-black">Cancel</button>
          </div>
        </div>
      )}

      {/* HEADER & STATS */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">Manager Dashboard</h1>
          <p className="text-zinc-500 text-xs font-bold uppercase">Tracking orders for: {managerName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <SummaryCard theme={theme} label="Cash" value={totals.Cash} icon={<Banknote size={14} className="text-emerald-500" />} />
        <SummaryCard theme={theme} label="Momo" value={totals.Momo} icon={<Smartphone size={14} className="text-yellow-500" />} />
        <SummaryCard theme={theme} label="Card" value={totals.Card} icon={<CreditCard size={14} className="text-blue-500" />} />
        <SummaryCard theme={theme} label="Total" value={totals.all} highlight />
      </div>

      {/* TABS & LIST */}
      <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-2">
        <div className="flex gap-4">
          {["Live", "Served"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-2 text-[10px] font-black uppercase tracking-widest relative ${activeTab === tab ? 'text-yellow-500' : 'text-zinc-500'}`}>
              {tab} ({Object.values(groupedTableOrders).filter(o => tab === "Live" ? ["Pending", "Preparing", "Ready", "Delayed"].includes(o.status) : o.status === "Served").length})
              {activeTab === tab && <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-yellow-500 rounded-full" />}
            </button>
          ))}
        </div>
        <div className="relative max-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
          <input type="text" placeholder="Table..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full py-2 pl-9 pr-8 rounded-xl text-[10px] bg-zinc-900 border border-white/5 text-white" />
        </div>
      </div>

      <div className="space-y-3">
        {filteredOrders.map((order) => (
          <div key={order.tableName} onClick={() => setSelectedOrderId(order.orderIds[0])} className={`p-4 rounded-[2rem] flex items-center justify-between cursor-pointer border-2 ${theme === 'dark' ? `bg-zinc-900 border-white/5` : `bg-white border-black/5`}`}>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-black text-sm uppercase italic">{order.tableName}</span>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-[9px] uppercase font-black text-zinc-500 tracking-tight">{order.items.length} Items • UGX {(order.total || 0).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              {order.status === "Ready" && (
                <button onClick={(e) => markAsServed(e, order.orderIds)} className="bg-emerald-500 text-black px-4 py-2 rounded-xl text-[9px] font-black uppercase">Serve</button>
              )}
              {!order.isPaid ? (
                <button onClick={(e) => { e.stopPropagation(); setSelectedOrderForPayment(order); setShowMethodSelector(true); }} className="bg-yellow-500 text-black px-4 py-2 rounded-xl text-[9px] font-black uppercase">Pay</button>
              ) : (
                <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"><CheckCircle size={12} className="text-emerald-500" /></div>
              )}
              <ChevronRight size={16} className="text-zinc-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- SUB COMPONENTS ---

function SummaryCard({ label, value, icon, highlight, theme }) {
  const baseClasses = highlight 
    ? 'bg-yellow-500 border-yellow-500 text-black' 
    : theme === 'dark' ? 'bg-zinc-900 border-slate-800 text-white' : 'bg-white border-black/5 text-zinc-900';

  return (
    <div className={`p-4 rounded-2xl border ${baseClasses}`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
        <span className="text-[9px] font-black uppercase opacity-60">Collected</span>
      </div>
      <p className="text-[10px] font-bold uppercase opacity-70">{label}</p>
      <h3 className="text-lg font-black leading-tight">UGX {(value || 0).toLocaleString()}</h3>
    </div>
  );
}

function StatusBadge({ status }) {
  const configs = {
    Pending: { color: "bg-zinc-800 text-zinc-400", icon: <Timer size={10} /> },
    Preparing: { color: "bg-blue-600 text-white", icon: <Flame size={10} /> },
    Ready: { color: "bg-emerald-500 text-black", icon: <CheckCircle size={10} /> },
    Served: { color: "bg-zinc-800 text-zinc-600", icon: <Utensils size={10} /> },
    Delayed: { color: "bg-rose-600 text-white", icon: <AlertCircle size={10} /> }
  };
  const config = configs[status] || configs.Pending;
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${config.color}`}>
      {config.icon} {status}
    </span>
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
      <div className={`w-full max-w-sm p-8 rounded-[2.5rem] ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'}`}>
        <h3 className="text-center font-black uppercase text-xl mb-4">Total: UGX {amount.toLocaleString()}</h3>
        <div className="space-y-3">
          {methods.map((m) => (
            <button key={m.id} onClick={() => onSelect(m.id)} className="w-full flex items-center justify-between p-5 rounded-2xl border-2 border-white/5 bg-black/20">
              <div className="flex items-center gap-4"><span className={m.color}>{m.icon}</span><span className="font-black uppercase text-sm">{m.id}</span></div>
              <ChevronRight size={18} className="opacity-20" />
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-6 py-2 text-zinc-500 font-black uppercase text-[10px]">Close</button>
      </div>
    </div>
  );
}