import React, { useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext"; // Import theme hook
import { Clock, Banknote, AlertCircle, CreditCard, Smartphone, ChevronRight, CheckCircle, Flame, Timer } from "lucide-react";

export default function OrderHistory() {
  const { orders = [] } = useData() || {};
  const { theme } = useTheme(); // Access theme

  const myOrders = orders.length > 0 
    ? [...orders].sort((a, b) => b.timestamp - a.timestamp) 
    : [];

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
      
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">My Collections</h1>
          <p className={`${theme === 'dark' ? 'text-slate-500' : 'text-zinc-500'} text-sm`}>
            Review your live order statuses
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <SummaryCard theme={theme} label="Total Cash" value={totals.Cash} icon={<Banknote className="text-emerald-500" />} />
        <SummaryCard theme={theme} label="Mobile Money" value={totals.Momo} icon={<Smartphone className="text-yellow-500" />} />
        <SummaryCard theme={theme} label="Card Sales" value={totals.Card} icon={<CreditCard className="text-blue-500" />} />
        <SummaryCard theme={theme} label="Gross Total" value={totals.all} icon={<Clock className={theme === 'dark' ? 'text-white' : 'text-black'} />} highlight />
      </div>

      <div className="space-y-3">
        <h3 className={`text-xs font-black uppercase tracking-widest mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-zinc-400'}`}>
          Live Status & History
        </h3>
        
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
                  {order.timestamp ? new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00'} • {order.items?.length || 0} Items
                </p>
              </div>
            </div>

            <div className="text-right flex items-center gap-4">
              <div>
                <p className={`text-sm font-black ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                  UGX {(order.total || 0).toLocaleString()}
                </p>
                {order.status === "Ready" ? (
                  <span className="text-[9px] font-black text-emerald-500 uppercase animate-pulse">Ready to Serve</span>
                ) : (
                  <span className={`text-[9px] font-bold uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-zinc-400'}`}>Paid</span>
                )}
              </div>
              <ChevronRight size={16} className={`transition-colors ${theme === 'dark' ? 'text-slate-700 group-hover:text-yellow-500' : 'text-zinc-300 group-hover:text-yellow-600'}`} />
            </div>
          </div>
        ))}

        {myOrders.length === 0 && (
          <div className={`text-center py-20 border-2 border-dashed rounded-3xl ${
            theme === 'dark' ? 'border-slate-800 bg-zinc-900/20' : 'border-zinc-200 bg-white'
          }`}>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No orders recorded yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- UPDATED HELPER COMPONENTS ---

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

function getIconColor(method) {
  if (method === 'Cash') return 'text-emerald-500';
  if (method === 'Momo') return 'text-yellow-600';
  if (method === 'Card') return 'text-blue-500';
  return 'text-white';
}