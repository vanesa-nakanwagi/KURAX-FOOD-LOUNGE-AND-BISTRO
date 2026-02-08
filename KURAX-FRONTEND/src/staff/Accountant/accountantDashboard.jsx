import React, { useState } from "react";
import { 
  Banknote, Smartphone, CreditCard, Receipt, 
  Share2, Menu, Search, Calculator, Wallet, 
  CheckCircle2, PlusCircle, RotateCcw 
} from "lucide-react";
import SideBar from "./SideBar"; 
import logo from "../../customer/assets/images/logo.jpeg";
import Footer from "../../customer/components/common/Foooter";

export default function AccountantDashboard() {
  // 1. STATE MANAGEMENT (Duplicates removed)
  const [activeSection, setActiveSection] = useState("FINANCIAL_HISTORY");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPettyModal, setShowPettyModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pettyCashTotal, setPettyCashTotal] = useState(0);
  const [pettyLogs, setPettyLogs] = useState([]);
  const [isShiftClosed, setIsShiftClosed] = useState(false);

  const [orders, setOrders] = useState([
    { id: "#9021", staff: "Alex", amount: 45000, method: "CASH", time: "14:20", status: "ACTIVE" },
    { id: "#9020", staff: "Sarah", amount: 120000, method: "MOMO", time: "14:15", status: "ACTIVE" },
    { id: "#9019", staff: "Alex", amount: 35000, method: "CARD", time: "13:50", status: "ACTIVE" },
  ]);

  // 2. CALCULATIONS
  const activeOrders = orders.filter(o => o.status === "ACTIVE");
  
  const systemTotals = {
    cash: activeOrders.filter(o => o.method === "CASH").reduce((sum, o) => sum + o.amount, 0),
    momo: activeOrders.filter(o => o.method === "MOMO").reduce((sum, o) => sum + o.amount, 0),
    card: activeOrders.filter(o => o.method === "CARD").reduce((sum, o) => sum + o.amount, 0),
  };

  const totalRevenue = systemTotals.cash + systemTotals.momo + systemTotals.card;

  // 3. HANDLERS
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

  const handleCloseShift = () => {
  const summary = {
    total: totalRevenue,
    cash: systemTotals.cash,
    momo: systemTotals.momo,
    card: systemTotals.card,
    petty: pettyCashTotal,
    net: systemTotals.cash - pettyCashTotal,
    time: new Date().toLocaleTimeString()
  };
  
  setShiftSummary(summary);
  setIsShiftClosed(true);
  generateWhatsAppReport(); // Automatically triggers the report for the Director
};

  const generateWhatsAppReport = () => {
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const netExpectedCash = systemTotals.cash - pettyCashTotal;
    const report = `*KURAX BISTRO - DAILY AUDIT* 📅 *Date:* ${date}\n----------------------------------\n💰 *REVENUE SUMMARY*\n• Cash Sales: UGX ${systemTotals.cash.toLocaleString()}\n• Momo Sales: UGX ${systemTotals.momo.toLocaleString()}\n• Card Sales: UGX ${systemTotals.card.toLocaleString()}\n*TOTAL REVENUE: UGX ${totalRevenue.toLocaleString()}*\n\n💸 *PETTY CASH/EXPENSES*\n${pettyLogs.length > 0 ? pettyLogs.map(log => `• ${log.reason}: -${log.amount.toLocaleString()}`).join('\n') : '• No petty cash logged today.'}\n*TOTAL PETTY CASH: UGX ${pettyCashTotal.toLocaleString()}*\n\n📉 *FINAL CASH HANDOVER*\n*Expected Cash in Hand: UGX ${netExpectedCash.toLocaleString()}*`;
    navigator.clipboard.writeText(report);
    alert("Dynamic report copied to clipboard!");
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#0a0a0a] font-[Outfit] text-slate-200">
      <SideBar 
        activeSection={activeSection} 
        setActiveSection={setActiveSection}
        isOpen={mobileMenuOpen}
        setIsOpen={setMobileMenuOpen}
      />

      <div className="flex-1 flex flex-col">
        {/* MOBILE HEADER */}
<div className="lg:hidden flex justify-between items-center p-4 border-b border-white/5 sticky top-0 bg-black/80 backdrop-blur-md z-[100]">
  <div className="flex items-center gap-3">
    <img src={logo} alt="logo" className="w-8 h-8 rounded-full object-cover border border-yellow-500/20" />
    <div className="flex flex-col justify-center leading-tight">
      <h1 className="text-[10px] font-black text-white uppercase tracking-tighter">
        KURAX FOOD LOUNGE & BISTRO
      </h1>
      <p className="text-yellow-500 text-[8px] font-bold uppercase tracking-widest">ACCOUNTANT PANEL</p>
    </div>
  </div>

  <div className="flex items-center gap-2">
    {/* WhatsApp button restored for Mobile */}
    <button 
      onClick={generateWhatsAppReport} 
      className="p-2.5 bg-emerald-600/20 text-emerald-500 rounded-xl border border-emerald-500/20 active:scale-90 transition-transform"
    >
      <Share2 size={18} />
    </button>
    
    <button 
      onClick={() => setMobileMenuOpen(true)} 
      className="text-yellow-500 p-2.5 bg-zinc-900 rounded-xl border border-white/5"
    >
      <Menu size={20} />
    </button>
  </div>
</div>

        <main className="flex-grow p-4 md:p-10">
          <div className="flex justify-between items-end mb-10">
            <div>
              
              <h2 className="text-2xl md:text-4xl font-black text-white uppercase italic">
                {activeSection === "FINANCIAL_HISTORY" ? "My Collections" : activeSection.replace("_", " ")}
              </h2>
            </div>
            <button onClick={generateWhatsAppReport} className="hidden md:flex items-center gap-2 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 px-5 py-3 rounded-2xl font-black uppercase text-[10px]">
              <Share2 size={14} /> WhatsApp Report
            </button>
          </div>

          <div className="space-y-10">
          {activeSection === "FINANCIAL_HISTORY" && (
  <section className="animate-in slide-in-from-bottom-4 duration-500">
    <h3 className="text-yellow-500 font-black uppercase text-xs mb-6 italic tracking-tighter">
      Daily Revenue Summary
    </h3>
    
    {/* UPDATED GRID CLASSES HERE */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      <AccountantStatCard 
        label="Expected Cash" 
        value={systemTotals.cash - pettyCashTotal} 
        icon={<Banknote size={14} />} 
        color="text-emerald-500" 
      />
      <AccountantStatCard 
        label="Momo Sales" 
        value={systemTotals.momo} 
        icon={<Smartphone size={14} />} 
        color="text-blue-400" 
      />
      <AccountantStatCard 
        label="Card Sales" 
        value={systemTotals.card} 
        icon={<CreditCard size={14} />} 
        color="text-purple-500" 
      />

       <AccountantStatCard 
    label="Total Revenue" 
    value={totalRevenue} 
    icon={<Receipt size={14} />} 
    color="text-black" 
    bgColor="bg-yellow-400"
    isDarkText={true}
  />
    </div>
  </section>
)}

            {activeSection === "PHYSICAL COUNT" && (
              <section className="animate-in slide-in-from-bottom-4 duration-500">
                <DailyReconciliation systemTotals={{...systemTotals, cash: systemTotals.cash - pettyCashTotal}} />
              </section>
            )}

           {activeSection === "PETTY CASH" && (
  <section className="animate-in slide-in-from-bottom-4 duration-500 max-w-4xl">
    <div className="flex justify-between items-center mb-8">
      <div>
        <h3 className="text-yellow-500 font-black uppercase text-xs italic tracking-widest">Expense Management</h3>
        <p className="text-zinc-500 text-[10px] font-bold uppercase mt-1">Total Spent: UGX {pettyCashTotal.toLocaleString()}</p>
      </div>
      <button 
        onClick={() => setShowPettyModal(true)} 
        className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-3 rounded-2xl font-black uppercase italic text-[10px] transition-all active:scale-95 shadow-lg shadow-yellow-500/10"
      >
        <PlusCircle size={14} className="inline mr-2" /> Add New Expense
      </button>
    </div>


    {/* THE LOGS LIST */}
    <div className="grid grid-cols-1 gap-3">
      {pettyLogs.length > 0 ? (
        pettyLogs.map((log, index) => (
          <div 
            key={index} 
            className="bg-zinc-900/40 border border-white/5 p-5 rounded-3xl flex justify-between items-center group hover:border-yellow-500/20 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-black rounded-2xl text-rose-500 border border-white/5">
                <Wallet size={16} />
              </div>
              <div>
                <p className="text-xs font-black text-white uppercase tracking-tight">{log.reason}</p>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{log.time}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-rose-500 italic">- UGX {log.amount.toLocaleString()}</p>
              <p className="text-[8px] text-zinc-600 font-black uppercase tracking-tighter">Approved</p>
            </div>
          </div>
        ))
      ) : (
        /* EMPTY STATE - Shows if pettyLogs array is empty */
        <div className="py-20 flex flex-col items-center justify-center bg-zinc-900/20 border border-dashed border-white/5 rounded-[3rem]">
          <div className="p-4 bg-zinc-900 rounded-full text-zinc-700 mb-4">
            <Receipt size={32} />
          </div>
          <p className="text-zinc-500 font-black uppercase text-[10px] tracking-[0.2em]">No expenses logged today</p>
          <button 
            onClick={() => setShowPettyModal(true)}
            className="mt-4 text-yellow-500 text-[9px] font-black uppercase underline decoration-2 underline-offset-4"
          >
            Log your first petty cash entry
          </button>
        </div>
      )}
    </div>
  </section>
)}

            {activeSection === "AUDIT" && (
              <section className="animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-yellow-500 font-black uppercase text-xs italic tracking-widest">Expense Management</h3>
            <p className="text-zinc-500 text-[10px] font-bold uppercase mt-1">Total Spent: UGX {pettyCashTotal.toLocaleString()}</p>
          </div>
          <button 
            onClick={() => setShowPettyModal(true)} 
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-3 rounded-2xl font-black uppercase italic text-[10px] transition-all active:scale-95 shadow-lg shadow-yellow-500/10"
          >
            <PlusCircle size={14} className="inline mr-2" /> Add New Expense
          </button>
        </div>

        {/* LOGS LIST */}
        <div className="grid grid-cols-1 gap-3">
          {pettyLogs.length > 0 ? (
            pettyLogs.map((log, index) => (
              <div key={index} className="bg-zinc-900/40 border border-white/5 p-5 rounded-3xl flex justify-between items-center group hover:border-yellow-500/20 transition-all">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-black rounded-2xl text-rose-500 border border-white/5">
                    <Wallet size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white uppercase tracking-tight">{log.reason}</p>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{log.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-rose-500 italic">- UGX {log.amount.toLocaleString()}</p>
                  <p className="text-[8px] text-zinc-600 font-black uppercase tracking-tighter">Approved</p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 flex flex-col items-center justify-center bg-zinc-900/20 border border-dashed border-white/5 rounded-[3rem]">
              <div className="p-4 bg-zinc-900 rounded-full text-zinc-700 mb-4">
                <Receipt size={32} />
              </div>
              <p className="text-zinc-500 font-black uppercase text-[10px] tracking-[0.2em]">No expenses logged today</p>
            </div>
          )}
        </div>
      </section>
    )}

   {activeSection === "END_OF_SHIFT" && (
  <section className="animate-in zoom-in-95 duration-500 max-w-2xl mx-auto py-6">
    {!isShiftClosed ? (
      <div className="bg-zinc-900/40 border border-white/5 p-10 rounded-[3rem] text-center">
        <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
          <RotateCcw size={32} />
        </div>
        <h3 className="text-2xl font-black text-white uppercase italic mb-2">Close Daily Shift?</h3>
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-8">
          This will finalize all collections and notify the Director.
        </p>
        <button 
          onClick={handleCloseShift}
          className="w-full py-5 bg-yellow-400  text-black rounded-2xl font-black uppercase italic text-sm transition-all active:scale-95 shadow-xl shadow-rose-900/20"
        >
          Confirm & Send to Director
        </button>
      </div>
    ) : (
      <div className="space-y-6">
        {/* SUCCESS MESSAGE */}
        <div className="bg-emerald-500 text-black p-6 rounded-[2.5rem] flex items-center gap-4">
          <CheckCircle2 size={30} />
          <div>
            <h3 className="font-black uppercase italic leading-none">Shift Closed Successfully</h3>
            <p className="text-[9px] font-bold uppercase opacity-70">Report sent to Director at {shiftSummary?.time}</p>
          </div>
        </div>

        {/* FINAL SUMMARY TABLE */}
        <div className="bg-zinc-900 border border-white/5 rounded-[2.5rem] overflow-hidden">
          <div className="p-6 border-b border-white/5 bg-white/5">
             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500">Official Shift Summary</h4>
          </div>
          <div className="p-6 space-y-4">
            <SummaryLine label="Gross Revenue" value={shiftSummary?.total} />
            <SummaryLine label="Momo/Card Total" value={shiftSummary?.momo + shiftSummary?.card} />
            <SummaryLine label="Petty Cash Spent" value={shiftSummary?.petty} isNegative />
            <div className="pt-4 border-t border-white/10">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-white uppercase italic">Final Cash Handover</span>
                <span className="text-xl font-black text-emerald-500 italic">UGX {shiftSummary?.net.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={() => window.location.reload()}
          className="w-full py-4 bg-zinc-900 text-zinc-500 rounded-2xl font-black uppercase text-[10px] border border-white/5"
        >
          Start New Shift
        </button>
      </div>
    )}
  </section>
)}

    {/* 4. LIVE AUDIT SECTION (Now properly separated) */}
    {activeSection === "LIVE AUDIT" && (
      <section className="bg-zinc-900/30 border border-white/5 rounded-3xl overflow-hidden animate-in fade-in duration-500">
        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="text-sm font-black uppercase italic text-yellow-500">Live Transaction Audit</h3>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text" 
              placeholder="Search Order ID..." 
              className="w-full bg-black border border-white/10 p-3 pl-12 rounded-xl text-xs font-bold outline-none focus:border-yellow-500 placeholder:text-zinc-600" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] font-black uppercase text-zinc-500 tracking-widest">
                <th className="p-6">Order ID</th>
                <th className="p-6">Method</th>
                <th className="p-6 text-right">Amount</th>
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
          {orders.filter(o => o.id.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
            <div className="p-20 text-center text-zinc-600 font-black uppercase text-[10px]">
              No matching orders found
            </div>
          )}
        </div>
              </section>
            )}
          </div>
        </main>
        <Footer />
      </div>

      {showPettyModal && (
        <PettyCashModal 
          onClose={() => setShowPettyModal(false)} 
          onSave={handleAddPettyCash} 
        />
      )}
    </div>
  );
}

// Ensure you include your AccountantStatCard, DailyReconciliation, and PettyCashModal sub-components below!
// ---------------- SUB-COMPONENTS -----------------



function AccountantStatCard({ label, value, icon, color, bgColor = "bg-zinc-900/30", isDarkText = false }) {
  return (
    <div className={`${bgColor} border border-white/5 p-4 md:p-6 rounded-2xl md:rounded-3xl transition-all duration-300`}>
      <div className={`p-2 md:p-3 w-fit bg-black/20 rounded-xl mb-3 border border-white/5 ${color}`}>
        {icon}
      </div>
      <p className={`text-[7px] md:text-[10px] font-black uppercase mb-1 tracking-widest leading-none ${isDarkText ? 'text-black/60' : 'text-zinc-500'}`}>
        {label}
      </p>
      <h4 className={`text-[11px] md:text-xl font-black italic truncate leading-none ${isDarkText ? 'text-black' : 'text-white'}`}>
        UGX {value.toLocaleString()}
      </h4>
    </div>
  );
}

function SummaryLine({ label, value, isNegative = false }) {
  return (
    <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-tight">
      <span className="text-zinc-500">{label}</span>
      <span className={isNegative ? "text-rose-500" : "text-white"}>
        {isNegative ? "-" : ""} UGX {value?.toLocaleString()}
      </span>
    </div>
  );
}

function AuditRow({ order, onVoid }) {

  const isVoided = order.status === "VOIDED";
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
        
        {/* ADDED placeholder:text-zinc-500 TO BOTH INPUTS */}
        <input 
          type="text" 
          placeholder="Description" 
          className="w-full bg-black border border-white/5 p-4 rounded-xl text-xs font-bold text-white mb-4 outline-none placeholder:text-zinc-500" 
          onChange={(e) => setReason(e.target.value)} 
        />
        
        <input 
          type="number" 
          placeholder="Amount" 
          className="w-full bg-black border border-white/5 p-4 rounded-xl text-xs font-bold text-white mb-6 outline-none placeholder:text-zinc-500" 
          onChange={(e) => setAmt(Number(e.target.value))} 
        />

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-4 text-zinc-500 font-black uppercase text-[10px]">Cancel</button>
          <button onClick={() => onSave(amt, reason)} className="flex-[2] py-4 bg-yellow-400 text-black rounded-2xl font-black uppercase text-xs">Confirm</button>
        </div>
      </div>
    </div>
  );
}