import React, { useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { Clock, Banknote, AlertCircle, CreditCard, Smartphone, ChevronRight, CheckCircle, Flame, Timer, ClipboardList } from "lucide-react";

export default function OrderHistory() {
  // 1. Pull dynamic data from Context
  const { orders = [], currentUser, dailyGoal } = useData() || {};
  const { theme } = useTheme();

  // 2. Use the actual logged-in user's name
  const waiterName = currentUser?.name || "Staff"; 
  const today = new Date().toISOString().split('T')[0];

  // 3. Filter orders belonging ONLY to this staff member for today
  const dailyWaiterOrders = orders.filter(order => {
    // Ensure the timestamp exists before splitting
    const orderDate = order.timestamp ? new Date(order.timestamp).toISOString().split('T')[0] : "";
    return order.waiterName === waiterName && orderDate === today;
  });

  // 4. Sort all orders belonging to this user (Newest first)
  const myOrders = orders.length > 0 
    ? orders
        .filter(order => order.waiterName === waiterName) // Show only MY history
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) 
    : [];

  // 5. Use the dynamic goal from Manager settings
  const currentGoal = dailyGoal || 20; 
  const progressPercent = Math.min((dailyWaiterOrders.length / currentGoal) * 100, 100);

  useEffect(() => {
    const latestOrder = myOrders[0];
    if (latestOrder?.status === "Ready") {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.play().catch(() => console.log("Audio blocked"));
    }
  }, [myOrders.map(o => o.status).join(',')]);

  const totals = myOrders.reduce((acc, order) => {
    // Standardize key names to match your SummaryCard calls (Cash, Card, Momo)
    const method = order.paymentMethod || 'Cash';
    acc[method] = (acc[method] || 0) + (order.total || 0);
    acc.all += (order.total || 0);
    return acc;
  }, { Cash: 0, Card: 0, Momo: 0, all: 0 });

  return (
    <div className={`p-4 md:p-8 min-h-screen font-[Outfit] pb-24 transition-colors duration-300 ${
      theme === 'dark' ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'
    }`}>
      
      <div className="mb-8">
          <h1 className="text-2xl font-black uppercase tracking-tighter">My Collections</h1>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className={`${theme === 'dark' ? 'text-slate-500' : 'text-zinc-500'} text-sm font-bold`}>
              Logged in as: {waiterName}
            </p>
          </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Progress Card using Dynamic Manager Goal */}
        <div className={`p-4 rounded-2xl border transition-all ${
          theme === 'dark' ? 'bg-zinc-900 border-slate-800' : 'bg-white border-black/5 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <ClipboardList className="text-orange-500" size={20} />
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Target</span>
          </div>
          <p className="text-[10px] font-bold uppercase text-zinc-500">Daily Performance</p>
          <div className="flex items-baseline gap-2 mb-3">
            <h3 className="text-2xl font-black">{dailyWaiterOrders.length}</h3>
            <span className="text-[10px] font-bold text-slate-500">/ {currentGoal}</span>
          </div>
          <div className="space-y-1">
            <div className={`w-full h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-black' : 'bg-zinc-100'}`}>
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${progressPercent >= 100 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[8px] font-black uppercase text-zinc-600 text-right">
                {progressPercent.toFixed(0)}% Complete
            </p>
          </div>
        </div>

        <SummaryCard theme={theme} label="Total Cash" value={totals.Cash} icon={<Banknote className="text-emerald-500" />} />
        <SummaryCard theme={theme} label="Mobile Money" value={totals.Momo} icon={<Smartphone className="text-yellow-500" />} />
        <SummaryCard theme={theme} label="Card Sales" value={totals.Card} icon={<CreditCard className="text-blue-500" />} />
        <SummaryCard theme={theme} label="Gross Total" value={totals.all} icon={<Clock className={theme === 'dark' ? 'text-white' : 'text-black'} />} highlight />
      </div>

      <div className="space-y-3">
        {myOrders.length > 0 ? myOrders.map((order) => (
          <div key={order.id} className={`p-4 rounded-2xl flex items-center justify-between group transition-all border ${
            theme === 'dark' 
              ? `bg-zinc-900 ${getStatusBorder(order.status, 'dark')}` 
              : `bg-white ${getStatusBorder(order.status, 'light')}`
          }`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl border ${
                theme === 'dark' ? 'bg-black border-slate-800' : 'bg-zinc-100 border-zinc-200'
              } ${getIconColor(order.paymentMethod)}`}>
                {order.paymentMethod === 'Cash' && <Banknote size={20} />}
                {order.paymentMethod === 'Card' && <CreditCard size={20} />}
                {order.paymentMethod === 'Momo' && <Smartphone size={20} />}
              </div>
              <div>
                <p className={`font-bold text-sm flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                  #{order.id.toString().slice(-5)}
                  <StatusBadge status={order.status} />
                </p>
                <p className={`text-[10px] uppercase font-bold tracking-tighter ${theme === 'dark' ? 'text-slate-500' : 'text-zinc-400'}`}>
                   {order.items?.length || 0} Items • {new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>
            </div>

            <div className="text-right flex items-center gap-4">
              <p className={`text-sm font-black ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                UGX {(order.total || 0).toLocaleString()}
              </p>
              <ChevronRight size={16} className="text-zinc-500" />
            </div>
          </div>
        )) : (
          <div className="text-center py-20 opacity-20">
             <ClipboardList size={48} className="mx-auto mb-2" />
             <p className="font-black uppercase text-xs">No orders found for today</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- HELPER COMPONENTS ---

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

function StatusBadge({ status }) {
  const configs = {
    Pending: { color: "bg-zinc-800 text-zinc-400", icon: <Timer size={10} />, label: "Pending" },
    Preparing: { color: "bg-blue-600 text-white", icon: <Flame size={10} />, label: "Cooking" },
    Ready: { color: "bg-emerald-500 text-black", icon: <CheckCircle size={10} />, label: "Ready" },
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