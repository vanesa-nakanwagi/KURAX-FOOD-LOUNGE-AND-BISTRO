import React, { useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { Clock, Banknote, AlertCircle, CreditCard, Smartphone, ChevronRight, CheckCircle, Flame, Timer, ClipboardList } from "lucide-react";

export default function OrderHistory() {
  const { orders = [] } = useData() || {};
  const { theme } = useTheme();

  // Configuration
  const DAILY_GOAL = 20; 
  const waiterName = "John Doe"; // Replace with your auth logic
  const today = new Date().toISOString().split('T')[0];

  // Logic for daily stats
  const dailyWaiterOrders = orders.filter(order => {
    const orderDate = new Date(order.timestamp).toISOString().split('T')[0];
    return order.waiterName === waiterName && orderDate === today;
  });

  const myOrders = orders.length > 0 
    ? [...orders].sort((a, b) => b.timestamp - a.timestamp) 
    : [];

  const progressPercent = Math.min((dailyWaiterOrders.length / DAILY_GOAL) * 100, 100);

  useEffect(() => {
    const latestOrder = myOrders[0];
    if (latestOrder?.status === "Ready") {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.play().catch(() => console.log("Audio blocked"));
    }
  }, [myOrders.map(o => o.status).join(',')]);

  const totals = myOrders.reduce((acc, order) => {
    acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + order.total;
    acc.all += order.total;
    return acc;
  }, { Cash: 0, Card: 0, Momo: 0, all: 0 });

  return (
    <div className={`p-4 md:p-8 min-h-screen font-[Outfit] pb-24 transition-colors duration-300 ${
      theme === 'dark' ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'
    }`}>
      
      <div className="mb-8">
          <h1 className="text-2xl font-black uppercase tracking-tighter">My Collections</h1>
          <p className={`${theme === 'dark' ? 'text-slate-500' : 'text-zinc-500'} text-sm`}>
            Track your performance and live statuses
          </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Progress Card */}
        <div className={`p-4 rounded-2xl border transition-all ${
          theme === 'dark' ? 'bg-zinc-900 border-slate-800' : 'bg-white border-black/5 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <ClipboardList className="text-orange-500" size={20} />
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Goal</span>
          </div>
          <p className="text-[10px] font-bold uppercase text-zinc-500">Today's Orders</p>
          <div className="flex items-baseline gap-2 mb-3">
            <h3 className="text-2xl font-black">{dailyWaiterOrders.length}</h3>
            <span className="text-[10px] font-bold text-slate-500">/ {DAILY_GOAL}</span>
          </div>
          <div className="space-y-1">
            <div className={`w-full h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-black' : 'bg-zinc-100'}`}>
              <div 
                className="h-full bg-orange-500 rounded-full transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <SummaryCard theme={theme} label="Total Cash" value={totals.Cash} icon={<Banknote className="text-emerald-500" />} />
        <SummaryCard theme={theme} label="Mobile Money" value={totals.Momo} icon={<Smartphone className="text-yellow-500" />} />
        <SummaryCard theme={theme} label="Card Sales" value={totals.Card} icon={<CreditCard className="text-blue-500" />} />
        <SummaryCard theme={theme} label="Gross Total" value={totals.all} icon={<Clock className={theme === 'dark' ? 'text-white' : 'text-black'} />} highlight />
      </div>

      <div className="space-y-3">
        {myOrders.map((order) => (
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
                  {order.id}
                  <StatusBadge status={order.status} />
                </p>
                <p className={`text-[10px] uppercase font-bold tracking-tighter ${theme === 'dark' ? 'text-slate-500' : 'text-zinc-400'}`}>
                   {order.items?.length || 0} Items
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
        ))}
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