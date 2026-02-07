import React, { useState } from "react";
import { 
  Banknote, Smartphone, CreditCard, RotateCcw, Search, 
  CheckCircle2, AlertTriangle, Save, Calculator, 
  PlusCircle, Wallet, Share2 , Receipt
} from "lucide-react";
import logo from "../../customer/assets/images/logo.jpeg";
import Footer from "../../customer/components/common/Foooter";
export default function AccountantDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showPettyModal, setShowPettyModal] = useState(false);
  const [pettyCashTotal, setPettyCashTotal] = useState(0);
  const [pettyLogs, setPettyLogs] = useState([]);

  // 1. ORDERS STATE (The Source of Truth)
  const [orders, setOrders] = useState([
    { id: "#9021", staff: "Alex", amount: 45000, method: "CASH", time: "14:20", status: "ACTIVE" },
    { id: "#9020", staff: "Sarah", amount: 120000, method: "MOMO", time: "14:15", status: "ACTIVE" },
    { id: "#9019", staff: "Alex", amount: 35000, method: "CARD", time: "13:50", status: "ACTIVE" },
  ]);

  // 2. DYNAMIC CALCULATIONS (No duplicate declarations)
  const activeOrders = orders.filter(o => o.status === "ACTIVE");
  
  const systemTotals = {
    cash: activeOrders.filter(o => o.method === "CASH").reduce((sum, o) => sum + o.amount, 0),
    momo: activeOrders.filter(o => o.method === "MOMO").reduce((sum, o) => sum + o.amount, 0),
    card: activeOrders.filter(o => o.method === "CARD").reduce((sum, o) => sum + o.amount, 0),
  };

  const totalRevenue = systemTotals.cash + systemTotals.momo + systemTotals.card;

  // 3. LOGIC HANDLERS
  const handleAddPettyCash = (amount, reason) => {
    const newLog = { amount, reason, time: new Date().toLocaleTimeString() };
    setPettyLogs([newLog, ...pettyLogs]);
    setPettyCashTotal(prev => prev + amount);
    setShowPettyModal(false);
  };

  const handleVoidOrder = (orderId) => {
    const reason = window.prompt(`Enter reason for voiding ${orderId}:`);
    if (reason && reason.trim() !== "") {
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: "VOIDED", voidReason: reason } : o
      ));
    }
  };

  const generateWhatsAppReport = () => {
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const netExpectedCash = systemTotals.cash - pettyCashTotal;

    const report = `
*KURAX BISTRO - DAILY AUDIT* 📅 *Date:* ${date}
----------------------------------
💰 *REVENUE SUMMARY*
• Cash Sales: UGX ${systemTotals.cash.toLocaleString()}
• Momo Sales: UGX ${systemTotals.momo.toLocaleString()}
• Card Sales: UGX ${systemTotals.card.toLocaleString()}
*TOTAL REVENUE: UGX ${totalRevenue.toLocaleString()}*

💸 *PETTY CASH/EXPENSES*
${pettyLogs.length > 0 
    ? pettyLogs.map(log => `• ${log.reason}: -${log.amount.toLocaleString()}`).join('\n')
    : '• No petty cash logged today.'}
*TOTAL PETTY CASH: UGX ${pettyCashTotal.toLocaleString()}*

📉 *FINAL CASH HANDOVER*
*Expected Cash in Hand: UGX ${netExpectedCash.toLocaleString()}*
----------------------------------`;

    navigator.clipboard.writeText(report);
    alert("Dynamic report copied to clipboard!");
  };

  return (
    <div className="space-y-8 p-4 md:p-8 bg-[#0a0a0a] min-h-screen font-[Outfit] text-slate-200">
      
      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex items-center gap-3">
                    <img src={logo} alt="logo" className="w-10 h-10 rounded-full object-cover border border-yellow-500/20" />
                    <div className="flex flex-col justify-center leading-tight">
                      <h1 className="text-sm md:text-lg font-black text-white uppercase tracking-tighter leading-none">
                        KURAX FOOD LOUNGE & BISTRO
                      </h1>
                      <p className="text-yellow-500 text-[10px] font-bold uppercase tracking-widest">ACCOUNTANT PANEL</p>
                    </div>
                  </div>
        <div className="flex gap-2">
          <button onClick={generateWhatsAppReport} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-2xl font-black uppercase italic text-[10px] hover:bg-emerald-500 transition-all">
            <Share2 size={14} /> WhatsApp Report
          </button>
          <button onClick={() => setShowPettyModal(true)} className="flex items-center gap-2 bg-white text-black px-4 py-3 rounded-2xl font-black uppercase italic text-[10px] hover:bg-yellow-500 transition-all">
            <PlusCircle size={14} /> Log Petty Cash
          </button>
        </div>
      </div>

     {/* 1. STAT CARDS - 2 per row on mobile, 4 on desktop */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
  <AccountantStatCard label="Total Revenue" value={totalRevenue} icon={<Receipt size={14} />} color="text-yellow-500" />
  <AccountantStatCard label="Expected Cash" value={systemTotals.cash - pettyCashTotal} icon={<Banknote size={14} />} color="text-emerald-500" />
  <AccountantStatCard label="Momo Sales" value={systemTotals.momo} icon={<Smartphone size={14} />} color="text-blue-400" />
  <AccountantStatCard label="Card Sales" value={systemTotals.card} icon={<CreditCard size={14} />} color="text-purple-500" />
</div>

      {/* 2. RECONCILIATION & PETTY LOGS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2">
          <DailyReconciliation systemTotals={{...systemTotals, cash: systemTotals.cash - pettyCashTotal}} />
        </div>
        
        <div className="bg-zinc-900/30 border border-white/5 p-6 rounded-[2.5rem]">
          <h3 className="text-[10px] font-black uppercase text-white tracking-widest mb-6 flex items-center gap-2">
            <Wallet size={14} className="text-zinc-500"/> Petty Cash History
          </h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {pettyLogs.map((log, i) => (
              <div key={i} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-white uppercase">{log.reason}</p>
                  <p className="text-[8px] text-zinc-500 font-bold">{log.time}</p>
                </div>
                <p className="text-xs font-black text-rose-500">-{log.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. TRANSACTION AUDIT */}
      <div className="bg-zinc-900/30 border border-white/5 rounded-[2.5rem] overflow-hidden">
        <div className="p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="text-xl font-black uppercase italic text-white">Live Transaction Audit</h3>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input type="text" placeholder="Search Order ID..." className="w-full bg-black border border-white/10 p-3 pl-12 rounded-xl text-xs font-bold outline-none focus:border-yellow-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-[10px] font-black uppercase text-zinc-500">
              <tr>
                <th className="p-6">Order ID</th>
                <th className="p-6">Staff</th>
                <th className="p-6">Amount</th>
                <th className="p-6">Method</th>
                <th className="p-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
  {orders
    .filter(o => o.id.toLowerCase().includes(searchTerm.toLowerCase()))
    .map(order => (
      <AuditRow 
        key={order.id} 
        order={order} 
        onVoid={handleVoidOrder} 
      />
    ))
  }
</tbody>
          </table>
        </div>
      </div>

      {showPettyModal && <PettyCashModal onClose={() => setShowPettyModal(false)} onSave={handleAddPettyCash} />}
      <Footer />
    </div>
  );
}

// Sub-components (StatCard, ReconcileInput, VarianceRow, DailyReconciliation, PettyCashModal, AuditRow) go here...
function DailyReconciliation({ systemTotals }) {
  const [counts, setCounts] = useState({ cash: 0, momo: 0, card: 0 });
  const variances = {
    cash: counts.cash - systemTotals.cash,
    momo: counts.momo - systemTotals.momo,
    card: counts.card - systemTotals.card
  };
  const totalVariance = variances.cash + variances.momo + variances.card;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-zinc-900/30 border border-white/5 p-8 rounded-[2.5rem]">
        <h3 className="text-sm font-black uppercase italic text-white mb-6 flex items-center gap-2">
          <Calculator size={16} className="text-yellow-500" /> Physical Count
        </h3>
        <div className="space-y-4">
          <ReconcileInput label="Cash" value={counts.cash} onChange={(v) => setCounts({...counts, cash: v})} />
          <ReconcileInput label="Momo" value={counts.momo} onChange={(v) => setCounts({...counts, momo: v})} />
          <ReconcileInput label="Card" value={counts.card} onChange={(v) => setCounts({...counts, card: v})} />
        </div>
      </div>
      <div className="bg-zinc-900/30 border border-white/5 p-8 rounded-[2.5rem] flex flex-col justify-between">
        <div className="space-y-3">
          <VarianceRow label="Cash Gap" amount={variances.cash} />
          <VarianceRow label="Momo Gap" amount={variances.momo} />
          <VarianceRow label="Card Gap" amount={variances.card} />
        </div>
        <div className={`mt-6 p-6 rounded-3xl border ${totalVariance === 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
           <p className="text-[10px] font-black uppercase text-zinc-500">Net Variance</p>
           <h4 className="text-2xl font-black italic">UGX {totalVariance.toLocaleString()}</h4>
        </div>
      </div>
    </div>
  );
}

function PettyCashModal({ onClose, onSave }) {
  const [amt, setAmt] = useState(0);
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8">
        <h3 className="text-lg font-black italic uppercase text-yellow-500 mb-6">Log Expense</h3>
        <input type="text" placeholder="Reason" className="w-full bg-black border border-white/5 p-4 rounded-xl text-xs font-bold text-white mb-4 outline-none" onChange={(e) => setReason(e.target.value)} />
        <input type="number" placeholder="Amount" className="w-full bg-black border border-white/5 p-4 rounded-xl text-xs font-bold text-white mb-6 outline-none" onChange={(e) => setAmt(Number(e.target.value))} />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-4 text-zinc-500 font-black uppercase text-[10px]">Cancel</button>
          <button onClick={() => onSave(amt, reason)} className="flex-[2] py-4 bg-yellow-500 text-black rounded-2xl font-black uppercase text-xs">Confirm</button>
        </div>
      </div>
    </div>
  );
}

// Helpers (StatCard, AuditRow, ReconcileInput, VarianceRow) remain mostly same but fixed syntax.
function AccountantStatCard({ label, value, icon, color }) {
  return (
    <div className="bg-zinc-900/30 border border-white/5 p-6 rounded-3xl">
      <div className={`p-3 w-fit bg-black rounded-2xl mb-4 border border-white/5 ${color}`}>{icon}</div>
      <p className="text-[10px] font-black text-zinc-500 uppercase mb-1">{label}</p>
      <h4 className="text-xl font-black text-white italic">UGX {value.toLocaleString()}</h4>
    </div>
  );
}

function ReconcileInput({ label, value, onChange }) {
  return (
    <div>
      <label className="text-[9px] font-black text-zinc-600 uppercase mb-1 block">{label}</label>
      <input type="number" className="w-full bg-black border border-white/5 p-3 rounded-xl text-sm font-black text-white outline-none focus:border-yellow-500" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function VarianceRow({ label, amount }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5">
      <span className="text-[10px] font-black text-zinc-500 uppercase">{label}</span>
      <span className={`text-xs font-black ${amount < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{amount.toLocaleString()}</span>
    </div>
  );
}

function AuditRow({ order, onVoid }) {
  const isVoided = order.status === "VOIDED";

  return (
    <tr className={`hover:bg-white/5 transition-all duration-300 ${isVoided ? 'opacity-30 grayscale' : ''}`}>
      <td className="p-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-white italic font-bold tracking-tight">{order.id}</span>
            {isVoided && (
              <span className="text-[7px] bg-rose-500/20 text-rose-500 border border-rose-500/30 px-1.5 py-0.5 rounded font-black uppercase">
                Voided
              </span>
            )}
          </div>
          {isVoided && (
            <span className="text-[8px] text-zinc-500 font-medium italic">
              Reason: {order.voidReason || "Not specified"}
            </span>
          )}
        </div>
      </td>
      <td className="p-6 text-zinc-500 uppercase text-xs font-bold">{order.staff}</td>
      <td className={`p-6 font-black text-sm tracking-tighter ${isVoided ? 'line-through text-zinc-700' : 'text-white'}`}>
        UGX {order.amount.toLocaleString()}
      </td>
      <td className="p-6">
        <span className="text-[10px] font-black px-2 py-1 rounded border border-white/10 uppercase bg-black/20">
          {order.method}
        </span>
      </td>
      <td className="p-6 text-right">
        {!isVoided ? (
          <button 
            onClick={() => onVoid(order.id)}
            className="group/btn flex items-center gap-2 ml-auto bg-rose-500/10 text-rose-500 px-4 py-2 rounded-xl hover:bg-rose-500 hover:text-white transition-all active:scale-95 border border-rose-500/20"
          >
            <RotateCcw size={12} className="group-hover/btn:-rotate-45 transition-transform" />
            <span className="text-[10px] font-black uppercase italic tracking-wider">Void</span>
          </button>
        ) : (
          <span className="text-[10px] font-black text-zinc-700 uppercase italic">Archived</span>
        )}
      </td>
    </tr>
  );
}