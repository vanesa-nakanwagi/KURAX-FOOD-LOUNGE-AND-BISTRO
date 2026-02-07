import React, { useState } from "react";
import { 
  Banknote, Smartphone, CreditCard, RotateCcw, Search, 
  CheckCircle2, AlertTriangle, Save, Calculator, 
  PlusCircle, Wallet, Share2 , Receipt, Menu, X
} from "lucide-react";
import logo from "../../customer/assets/images/logo.jpeg";
import Footer from "../../customer/components/common/Foooter";

export default function AccountantDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showPettyModal, setShowPettyModal] = useState(false);
  const [pettyCashTotal, setPettyCashTotal] = useState(0);
  const [pettyLogs, setPettyLogs] = useState([]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("FINANCIAL_HISTORY");

  // ORDERS STATE
  const [orders, setOrders] = useState([
    { id: "#9021", staff: "Alex", amount: 45000, method: "CASH", time: "14:20", status: "ACTIVE" },
    { id: "#9020", staff: "Sarah", amount: 120000, method: "MOMO", time: "14:15", status: "ACTIVE" },
    { id: "#9019", staff: "Alex", amount: 35000, method: "CARD", time: "13:50", status: "ACTIVE" },
  ]);

  const activeOrders = orders.filter(o => o.status === "ACTIVE");
  
  const systemTotals = {
    cash: activeOrders.filter(o => o.method === "CASH").reduce((sum, o) => sum + o.amount, 0),
    momo: activeOrders.filter(o => o.method === "MOMO").reduce((sum, o) => sum + o.amount, 0),
    card: activeOrders.filter(o => o.method === "CARD").reduce((sum, o) => sum + o.amount, 0),
  };

  const totalRevenue = systemTotals.cash + systemTotals.momo + systemTotals.card;

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
    const report = `*KURAX BISTRO - DAILY AUDIT* 📅 *Date:* ${date}\nREVENUE: UGX ${totalRevenue.toLocaleString()}\nEXPECTED CASH: UGX ${netExpectedCash.toLocaleString()}`;
    navigator.clipboard.writeText(report);
    alert("Report copied to clipboard!");
  };

  return (
    // THE FIX: flex flex-col min-h-screen ensures the page fills the screen
    <div className="flex flex-col min-h-screen bg-[#0a0a0a] font-[Outfit] text-slate-200">
      
      {/* WRAP CONTENT IN A DIV THAT GROWS */}
      <div className="flex-grow p-4 md:p-8 space-y-8">

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

          <div className="flex gap-2 items-center">
            <div className="hidden md:flex gap-2">
              <button onClick={generateWhatsAppReport} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-2xl font-black uppercase italic text-[10px]">
                <Share2 size={14} /> WhatsApp Report
              </button>
            </div>
            {/* Hamburger: Only visible on Mobile */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden bg-black/40 border border-white/10 p-3 rounded-xl text-yellow-500"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>

        {/* MOBILE MENU MODAL */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl p-8 flex flex-col justify-center">
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-8 right-8 p-3 bg-white/5 rounded-full text-white hover:bg-yellow-400 hover:text-black transition-all"
            >
              <X size={28} strokeWidth={3} />
            </button>
            <div className="space-y-4">
              {[
                ["FINANCIAL_HISTORY", "Financial History"],
                ["PHYSICAL", "Physical Finances"],
                ["PETTY", "Log Petty Cash"],
                ["AUDIT", "Live Audit"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveSection(key);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-center p-6 rounded-[2rem] font-black uppercase text-sm tracking-tighter transition-all active:scale-95 shadow-lg
                    ${activeSection === key ? 'bg-white text-black ring-4 ring-yellow-400' : 'bg-yellow-400 text-black shadow-yellow-500/10'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SECTION: FINANCIAL HISTORY */}
        {(activeSection === "FINANCIAL_HISTORY" || window.innerWidth >= 768) && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
              <AccountantStatCard label="Total Revenue" value={totalRevenue} icon={<Receipt size={14} />} color="text-yellow-500" />
              <AccountantStatCard label="Expected Cash" value={systemTotals.cash - pettyCashTotal} icon={<Banknote size={14} />} color="text-emerald-500" />
              <AccountantStatCard label="Momo Sales" value={systemTotals.momo} icon={<Smartphone size={14} />} color="text-blue-400" />
              <AccountantStatCard label="Card Sales" value={systemTotals.card} icon={<CreditCard size={14} />} color="text-purple-500" />
            </div>
            {/* WhatsApp button only shows in this section on mobile */}
            <button onClick={generateWhatsAppReport} className="md:hidden w-full bg-emerald-600 p-5 rounded-2xl font-black uppercase text-xs flex justify-center items-center gap-2">
              <Share2 size={16} /> Share WhatsApp Report
            </button>
          </div>
        )}

        {/* SECTION: PHYSICAL FINANCES */}
        {(activeSection === "PHYSICAL" || window.innerWidth >= 768) && (
          <DailyReconciliation systemTotals={{...systemTotals, cash: systemTotals.cash - pettyCashTotal}} />
        )}

        {/* SECTION: PETTY CASH */}
        {(activeSection === "PETTY" || window.innerWidth >= 768) && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
               <h3 className="text-sm font-black uppercase italic text-yellow-500">Petty Cash Management</h3>
               <button onClick={() => setShowPettyModal(true)} className="flex items-center gap-2 bg-yellow-400 text-black px-4 py-3 rounded-2xl font-black uppercase italic text-[10px]">
                 <PlusCircle size={14} /> Log Expense
               </button>
            </div>
            <div className="bg-zinc-900/30 border border-white/5 p-6 rounded-xl">
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {pettyLogs.length > 0 ? pettyLogs.map((log, i) => (
                  <div key={i} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-white uppercase">{log.reason}</p>
                      <p className="text-[8px] text-zinc-500 font-bold">{log.time}</p>
                    </div>
                    <p className="text-xs font-black text-rose-500">-{log.amount.toLocaleString()}</p>
                  </div>
                )) : <p className="text-zinc-600 text-center text-[10px] uppercase font-bold py-10">No history today</p>}
              </div>
            </div>
          </div>
        )}

       {/* SECTION: LIVE AUDIT */}
{(activeSection === "AUDIT" || window.innerWidth >= 768) && (
  <div className="bg-zinc-900/30 border border-white/5 rounded-xl overflow-hidden animate-in fade-in duration-500">
    <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
      <h3 className="text-xl font-black uppercase italic text-yellow-500">Live Audit</h3>
      <div className="relative w-full md:w-72">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
        <input 
          type="text" 
          placeholder="Search Order ID..." 
          className="w-full bg-black border border-white/10 p-3 pl-12 rounded-xl text-xs font-bold outline-none focus:border-yellow-500" 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-white/5 text-[10px] font-black uppercase text-zinc-500">
          <tr>
            <th className="p-6">Order ID</th>
            <th className="p-6">Method</th> {/* RESTORED COLUMN */}
            <th className="p-6">Amount</th>
            <th className="p-6 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {orders
            .filter(o => o.id.toLowerCase().includes(searchTerm.toLowerCase()))
            .map(order => (
              <AuditRow key={order.id} order={order} onVoid={handleVoidOrder} />
            ))
          }
        </tbody>
      </table>
    </div>
  </div>
)}
      </div>

      {/* FOOTER: ALWAYS AT THE BOTTOM */}
      <Footer />

      {/* MODALS */}
      {showPettyModal && <PettyCashModal onClose={() => setShowPettyModal(false)} onSave={handleAddPettyCash} />}
    </div>
  );
}

// ---------------- SUB-COMPONENTS -----------------

function AccountantStatCard({ label, value, icon, color }) {
  return (
    <div className="bg-zinc-900/30 border border-white/5 p-5 md:p-6 rounded-3xl">
      <div className={`p-3 w-fit bg-black rounded-2xl mb-4 border border-white/5 ${color}`}>{icon}</div>
      <p className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase mb-1 tracking-widest">{label}</p>
      <h4 className="text-sm md:text-xl font-black text-white italic truncate leading-none">UGX {value.toLocaleString()}</h4>
    </div>
  );
}

function AuditRow({ order, onVoid }) {
  const isVoided = order.status === "VOIDED";

  // Small helper to color code the method badges
  const getMethodStyle = (method) => {
    switch (method) {
      case 'CASH': return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5';
      case 'MOMO': return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5';
      case 'CARD': return 'text-blue-400 border-blue-400/20 bg-blue-400/5';
      default: return 'text-zinc-500 border-white/10 bg-white/5';
    }
  };

  return (
    <tr className={`hover:bg-white/5 transition-all duration-300 ${isVoided ? 'opacity-30 grayscale' : ''}`}>
      <td className="p-6">
        <div className="flex flex-col">
          <span className="text-white italic font-bold text-xs tracking-tight">{order.id}</span>
          <span className="text-[8px] text-zinc-500 font-bold uppercase">{order.time}</span>
        </div>
      </td>
      
      {/* METHOD COLUMN ADDED HERE */}
      <td className="p-6">
        <span className={`text-[8px] font-black px-2 py-1 rounded-md border uppercase tracking-widest ${getMethodStyle(order.method)}`}>
          {order.method}
        </span>
      </td>

      <td className={`p-6 font-black text-xs tracking-tighter ${isVoided ? 'line-through text-zinc-700' : 'text-white'}`}>
        UGX {order.amount.toLocaleString()}
      </td>

      <td className="p-6 text-right">
        {!isVoided ? (
          <button 
            onClick={() => onVoid(order.id)}
            className="group/btn flex items-center gap-2 ml-auto bg-rose-500/10 text-rose-500 px-3 py-2 rounded-xl hover:bg-rose-500 hover:text-white transition-all active:scale-95 border border-rose-500/20"
          >
            <RotateCcw size={10} className="group-hover/btn:-rotate-45 transition-transform" />
            <span className="text-[9px] font-black uppercase italic">Void</span>
          </button>
        ) : (
          <span className="text-[9px] font-black text-zinc-700 uppercase italic">Voided</span>
        )}
      </td>
    </tr>
  );
}

function DailyReconciliation({ systemTotals }) {
  const [counts, setCounts] = useState({ cash: 0, momo: 0, card: 0 });
  const variances = {
    cash: counts.cash - systemTotals.cash,
    momo: counts.momo - systemTotals.momo,
    card: counts.card - systemTotals.card
  };
  const totalVariance = variances.cash + variances.momo + variances.card;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-zinc-900/30 border border-white/5 p-6 md:p-8 rounded-[2rem]">
        <h3 className="text-[10px] font-black uppercase italic text-yellow-500 mb-6 flex items-center gap-2">
          <Calculator size={14} className="text-sm font-black uppercase italic text-yellow-500" /> Physical Input
        </h3>
        <div className="space-y-4">
          <ReconcileInput label="Cash" value={counts.cash} onChange={(v) => setCounts({...counts, cash: v})} />
          <ReconcileInput label="Momo" value={counts.momo} onChange={(v) => setCounts({...counts, momo: v})} />
          <ReconcileInput label="Card" value={counts.card} onChange={(v) => setCounts({...counts, card: v})} />
        </div>
      </div>
      <div className="bg-zinc-900/30 border border-white/5 p-6 md:p-8 rounded-[2rem]">
         <div className="space-y-3">
            <VarianceRow label="Cash Gap" amount={variances.cash} />
            <VarianceRow label="Momo Gap" amount={variances.momo} />
            <VarianceRow label="Card Gap" amount={variances.card} />
         </div>
         <div className={`mt-6 p-6 rounded-2xl border ${totalVariance === 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
            <h4 className="text-xl font-black italic">UGX {totalVariance.toLocaleString()}</h4>
         </div>
      </div>
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
    <div className="flex justify-between items-center py-2 border-b border-white/5 text-[10px] font-black uppercase">
      <span className="text-zinc-500">{label}</span>
      <span className={amount < 0 ? 'text-rose-500' : 'text-emerald-500'}>{amount.toLocaleString()}</span>
    </div>
  );
}

function PettyCashModal({ onClose, onSave }) {
  const [amt, setAmt] = useState(0);
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8">
        <h3 className="text-sm font-black italic uppercase text-yellow-500 mb-6 text-center">Log New Expense</h3>
        <input type="text" placeholder="Description" className="w-full bg-black border border-white/5 p-4 rounded-xl text-xs font-bold text-white mb-4 outline-none" onChange={(e) => setReason(e.target.value)} />
        <input type="number" placeholder="Amount" className="w-full bg-black border border-white/5 p-4 rounded-xl text-xs font-bold text-white mb-6 outline-none" onChange={(e) => setAmt(Number(e.target.value))} />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-4 text-zinc-500 font-black uppercase text-[10px]">Cancel</button>
          <button onClick={() => onSave(amt, reason)} className="flex-[2] py-4 bg-yellow-400 text-black rounded-2xl font-black uppercase text-xs">Confirm</button>
        </div>
      </div>
    </div>
  );
}