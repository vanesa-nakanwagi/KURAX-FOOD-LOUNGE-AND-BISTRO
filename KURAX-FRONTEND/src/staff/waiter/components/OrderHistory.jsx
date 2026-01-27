import React, { useEffect } from "react";
import { useData } from "../../../components/context/DataContext";
import { Clock, Banknote, AlertCircle, CreditCard, Smartphone, ChevronRight, Trash2, CheckCircle, Flame, Timer } from "lucide-react";

export default function OrderHistory() {
  const { orders = [], setOrders } = useData() || {};

  // Sort orders by most recent first
  const myOrders = orders.length > 0 
    ? [...orders].sort((a, b) => b.timestamp - a.timestamp) 
    : [];

  

  // Optional: Play a sound for the waiter when an order becomes READY
  useEffect(() => {
    const latestOrder = myOrders[0];
    if (latestOrder?.status === "Ready") {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.play().catch(() => console.log("Audio blocked until user interacts."));
    }
  }, [myOrders.map(o => o.status).join(',')]); // Watch for status changes

  const totals = myOrders.reduce((acc, order) => {
    acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + order.total;
    acc.all += order.total;
    return acc;
  }, { Cash: 0, Card: 0, Momo: 0, all: 0 });

  return (
    <div className="p-4 md:p-8 bg-black min-h-screen text-white font-[Outfit] pb-24">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">My Collections</h1>
          <p className="text-slate-500 text-sm">Review your live order statuses</p>
        </div>
        
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <SummaryCard label="Total Cash" value={totals.Cash} icon={<Banknote className="text-emerald-500" />} />
        <SummaryCard label="Mobile Money" value={totals.Momo} icon={<Smartphone className="text-yellow-500" />} />
        <SummaryCard label="Card Sales" value={totals.Card} icon={<CreditCard className="text-blue-500" />} />
        <SummaryCard label="Gross Total" value={totals.all} icon={<Clock className="text-white" />} highlight />
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Live Status & History</h3>
        
        {myOrders.map((order) => (
          <div key={order.id} className={`bg-zinc-900 border p-4 rounded-2xl flex items-center justify-between group transition-all ${getStatusBorder(order.status)}`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-black border border-slate-800 ${getIconColor(order.paymentMethod)}`}>
                {order.paymentMethod === 'Cash' && <Banknote size={20} />}
                {order.paymentMethod === 'Card' && <CreditCard size={20} />}
                {order.paymentMethod === 'Momo' && <Smartphone size={20} />}
              </div>
              <div>
                <p className="font-bold text-sm flex items-center gap-2">
                  {order.id}
                  <StatusBadge status={order.status} />
                </p>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">
                  {order.timestamp ? new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00'} • {order.items?.length || 0} Items
                </p>
              </div>
            </div>

            <div className="text-right flex items-center gap-4">
              <div>
                <p className="text-sm font-black text-white">UGX {(order.total || 0).toLocaleString()}</p>
                {order.status === "Ready" ? (
                  <span className="text-[9px] font-black text-emerald-500 uppercase animate-pulse">Ready to Serve</span>
                ) : (
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Paid</span>
                )}
              </div>
              <ChevronRight size={16} className="text-slate-700 group-hover:text-yellow-500" />
            </div>
          </div>
        ))}

        {myOrders.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-3xl bg-zinc-900/20">
            <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">No orders recorded yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- HELPER COMPONENTS ---

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
      {config.icon}
      {config.label}
    </span>
  );
}

function getStatusBorder(status) {
  if (status === "Ready") return "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]";
  if (status === "Preparing") return "border-blue-500/50";
  if (status === "Delayed") return "border-rose-500/50";
  return "border-slate-800";
}

function SummaryCard({ label, value, icon, highlight }) {
  return (
    <div className={`p-4 rounded-2xl border transition-all ${highlight ? 'bg-yellow-500 border-yellow-500 text-black' : 'bg-zinc-900 border-slate-800 text-white'}`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
        <span className={`text-[9px] font-black uppercase ${highlight ? 'text-black/60' : 'text-slate-500'}`}>Daily</span>
      </div>
      <p className={`text-[10px] font-bold uppercase ${highlight ? 'text-black/70' : 'text-slate-500'}`}>{label}</p>
      <h3 className="text-lg font-black leading-tight">UGX {value.toLocaleString()}</h3>
    </div>
  );
}

function getIconColor(method) {
  if (method === 'Cash') return 'text-emerald-500';
  if (method === 'Momo') return 'text-yellow-500';
  if (method === 'Card') return 'text-blue-500';
  return 'text-white';
}