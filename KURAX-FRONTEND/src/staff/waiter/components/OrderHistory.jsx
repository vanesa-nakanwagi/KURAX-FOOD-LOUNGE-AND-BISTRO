import React, { useEffect, useState } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { Clock, Banknote, AlertCircle, CreditCard, Smartphone, ChevronRight, CheckCircle, Flame, Timer, ClipboardList, Utensils, User } from "lucide-react";

export default function OrderHistory() {
  const { orders = [], setOrders } = useData() || {}; 
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState("Live");

  // Configuration
  const DAILY_GOAL = 20; 
  const waiterName = "John Doe"; 
  const today = new Date().toISOString().split('T')[0];

  const dailyWaiterOrders = orders.filter(order => {
    const orderDate = new Date(order.timestamp).toISOString().split('T')[0];
    return order.waiterName === waiterName && orderDate === today;
  });

  const filteredOrders = dailyWaiterOrders.filter(order => {
    if (activeTab === "Live") return ["Pending", "Preparing", "Ready", "Delayed"].includes(order.status);
    return order.status === "Served";
  }).sort((a, b) => b.timestamp - a.timestamp);

  const markAsServed = (id) => {
    setOrders(prev => prev.map(order => 
      order.id === id ? { ...order, status: "Served" } : order
    ));
  };

  const progressPercent = Math.min((dailyWaiterOrders.length / DAILY_GOAL) * 100, 100);

  const totals = dailyWaiterOrders.reduce((acc, order) => {
    acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + order.total;
    acc.all += order.total;
    return acc;
  }, { Cash: 0, Card: 0, Momo: 0, all: 0 });


  const addMoreToOrder = (existingOrder) => {
  // 1. Load the existing order's items back into the cart
  setCart(existingOrder.items);
  // 2. Set the table name automatically
  setTableName(existingOrder.tableName);
  // 3. Switch tab back to "Order"
  setActiveTab("order");
  // 4. Remove the old entry (it will be replaced by the updated one)
  setOrders(prev => prev.filter(o => o.id !== existingOrder.id));
};

  return (
    <div className={`p-4 md:p-8 min-h-screen font-[Outfit] pb-24 transition-colors duration-300 ${
      theme === 'dark' ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'
    }`}>
      
      {/* HEADER WITH OPTION 2: SERVICE BADGE */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter italic">My Collections</h1>
            <p className={`${theme === 'dark' ? 'text-slate-500' : 'text-zinc-500'} text-sm`}>
              Track performance and serve ready orders
            </p>
          </div>

          {/* ACTIVE WAITER BADGE */}
          <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-2xl border self-start md:self-auto transition-all ${
            theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-black/5 shadow-sm'
          }`}>
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-black shadow-lg shadow-yellow-500/20">
                <User size={16} strokeWidth={3} />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-zinc-900 rounded-full animate-pulse" />
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500 leading-none mb-1">Authenticated</p>
              <h3 className="text-[11px] font-black uppercase tracking-tight text-yellow-500">{waiterName}</h3>
            </div>
          </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className={`p-4 rounded-2xl border transition-all ${
          theme === 'dark' ? 'bg-zinc-900 border-slate-800' : 'bg-white border-black/5 shadow-sm'
        }`}>
          <p className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Goal Progress</p>
          <h3 className="text-xl font-black">{dailyWaiterOrders.length} <span className="text-xs opacity-30">/ {DAILY_GOAL}</span></h3>
          <div className="w-full h-1 bg-zinc-800 mt-2 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <SummaryCard theme={theme} label="Cash" value={totals.Cash} icon={<Banknote size={16} className="text-emerald-500" />} />
        <SummaryCard theme={theme} label="Momo" value={totals.Momo} icon={<Smartphone size={16} className="text-yellow-500" />} />
        <SummaryCard theme={theme} label="Card" value={totals.Card} icon={<CreditCard size={16} className="text-blue-500" />} />
        <SummaryCard theme={theme} label="Total" value={totals.all} highlight />
      </div>

      {/* Tabs and Orders follow... */}
      <div className="flex gap-4 mb-6 border-b border-white/5">
        <button 
          onClick={() => setActiveTab("Live")}
          className={`pb-2 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'Live' ? 'text-yellow-500 border-b-2 border-yellow-500' : 'text-zinc-500'}`}
        >
          Live Orders ({dailyWaiterOrders.filter(o => o.status !== "Served").length})
        </button>
        <button 
          onClick={() => setActiveTab("History")}
          className={`pb-2 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'History' ? 'text-yellow-500 border-b-2 border-yellow-500' : 'text-zinc-500'}`}
        >
          Served ({dailyWaiterOrders.filter(o => o.status === "Served").length})
        </button>
      </div>

      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="py-20 text-center opacity-20">
            <ClipboardList size={40} className="mx-auto mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest">No {activeTab} Orders</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.id} className={`p-4 rounded-[2rem] flex items-center justify-between group transition-all border-2 ${
              theme === 'dark' 
                ? `bg-zinc-900 ${getStatusBorder(order.status, 'dark')}` 
                : `bg-white ${getStatusBorder(order.status, 'light')}`
            }`}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-black' : 'bg-zinc-100'} ${getIconColor(order.paymentMethod)}`}>
                  {order.paymentMethod === 'Cash' && <Banknote size={20} />}
                  {order.paymentMethod === 'Card' && <CreditCard size={20} />}
                  {order.paymentMethod === 'Momo' && <Smartphone size={20} />}
                </div>
                <div>
                  <p className="font-black text-sm flex items-center gap-2">
                    {order.id}
                    <StatusBadge status={order.status} />
                  </p>
                  <p className="text-[10px] uppercase font-bold text-zinc-500">
                     {order.items?.length || 0} Items • UGX {order.total.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {order.status === "Ready" && (
                  <button 
                    onClick={() => markAsServed(order.id)}
                    className="bg-emerald-500 text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase italic animate-pulse shadow-lg shadow-emerald-500/20"
                  >
                    Serve Now
                  </button>
                )}
                <ChevronRight size={16} className="text-zinc-700" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** * HELPER FUNCTIONS (Place these outside the main component) 
 **/

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
        <span className={`text-[9px] font-black uppercase ${highlight ? 'text-black/60' : 'text-slate-500'}`}>Session</span>
      </div>
      <p className={`text-[10px] font-bold uppercase ${highlight ? 'text-black/70' : 'text-zinc-500'}`}>{label}</p>
      <h3 className="text-lg font-black leading-tight">UGX {value.toLocaleString()}</h3>
    </div>
  );
}