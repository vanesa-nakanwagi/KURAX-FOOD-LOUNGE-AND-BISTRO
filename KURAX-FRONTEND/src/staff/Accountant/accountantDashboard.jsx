import React, { useState, useEffect } from "react";
import { 
  Banknote, Smartphone, CreditCard, Receipt, 
  Share2, Menu, Search, Calculator, Wallet, 
  CheckCircle2, PlusCircle, RotateCcw, AlertCircle, Trash2, XCircle 
} from "lucide-react";
import { useData } from "../../customer/components/context/DataContext"; 
import SideBar from "./SideBar"; 
import logo from "../../customer/assets/images/logo.jpeg";
import Footer from "../../customer/components/common/Foooter";

export default function AccountantDashboard() {
  const { orders = [], setOrders } = useData() || {}; 
  const [activeSection, setActiveSection] = useState("FINANCIAL_HISTORY");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPettyModal, setShowPettyModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // --- PERSISTENCE LOGIC ---
  // Load initial state from localStorage or use defaults
  const [isShiftClosed, setIsShiftClosed] = useState(() => {
    return localStorage.getItem("kurax_shift_closed") === "true";
  });

  const [physicalCounts, setPhysicalCounts] = useState(() => {
    const saved = localStorage.getItem("kurax_physical_counts");
    return saved ? JSON.parse(saved) : { cash: 0, momo: 0, card: 0 };
  });

  // Save to localStorage whenever these values change
  useEffect(() => {
    localStorage.setItem("kurax_physical_counts", JSON.stringify(physicalCounts));
  }, [physicalCounts]);

  useEffect(() => {
    localStorage.setItem("kurax_shift_closed", isShiftClosed);
  }, [isShiftClosed]);

  // --- CALCULATIONS ---
  const voidRequests = orders.filter(order => 
    order.items?.some(item => item.voidRequested)
  );

  const validPaidOrders = orders.filter(o => o.isPaid && !o.voidRequested);
  
  const systemTotals = {
    cash: validPaidOrders.filter(o => o.paymentMethod === "Cash").reduce((sum, o) => sum + (o.total || 0), 0),
    momo: validPaidOrders.filter(o => o.paymentMethod === "Momo").reduce((sum, o) => sum + (o.total || 0), 0),
    card: validPaidOrders.filter(o => o.paymentMethod === "Card").reduce((sum, o) => sum + (o.total || 0), 0),
  };

  const totalRevenue = systemTotals.cash + systemTotals.momo + systemTotals.card;

  // --- HANDLERS ---
  const approveItemVoid = (orderId, itemIndex) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const updatedItems = [...order.items];
        updatedItems[itemIndex] = {
          ...updatedItems[itemIndex],
          voidRequested: false, 
          voidProcessed: true,  
          status: "VOIDED",     
          price: 0 
        };
        const newTotal = updatedItems.reduce((sum, i) => sum + (Number(i.price) * (i.quantity || 1)), 0);
        return { ...order, items: updatedItems, total: newTotal };
      }
      return order;
    }));
  };

  const rejectItemVoid = (orderId, itemIndex) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const updatedItems = [...order.items];
        updatedItems[itemIndex] = { ...updatedItems[itemIndex], voidRequested: false };
        return { ...order, items: updatedItems };
      }
      return order;
    }));
  };

  const handleAddPettyCash = (amt, reason) => {
    // Logic for adding petty cash (usually updating a global state or DB)
    console.log(`Expense Logged: ${reason} - UGX ${amt}`);
    setShowPettyModal(false);
  };

  const handleCloseShift = () => {
    setIsShiftClosed(true);
    generateWhatsAppReport();
  };

  const resetDashboard = () => {
    if(window.confirm("This will clear all physical counts for a new shift. Continue?")) {
        setPhysicalCounts({ cash: 0, momo: 0, card: 0 });
        setIsShiftClosed(false);
        localStorage.removeItem("kurax_physical_counts");
        localStorage.removeItem("kurax_shift_closed");
    }
  };

  const generateWhatsAppReport = () => {
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const report = `*KURAX BISTRO - DAILY AUDIT* 📅 *Date:* ${date}\n----------------------------------\n💰 *REVENUE SUMMARY*\n• Cash Sales: UGX ${systemTotals.cash.toLocaleString()}\n• Momo Sales: UGX ${systemTotals.momo.toLocaleString()}\n• Card Sales: UGX ${systemTotals.card.toLocaleString()}\n*TOTAL REVENUE: UGX ${totalRevenue.toLocaleString()}*`;
    navigator.clipboard.writeText(report);
    alert("Report copied to clipboard!");
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#0a0a0a] font-[Outfit] text-slate-200">
      <SideBar activeSection={activeSection} setActiveSection={setActiveSection} isOpen={mobileMenuOpen} setIsOpen={setMobileMenuOpen} />

      <div className="flex-1 flex flex-col">
        {/* HEADER */}
        <header className="flex justify-between items-center p-6 border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-4">
             <div className="lg:hidden p-2 bg-zinc-900 rounded-lg cursor-pointer" onClick={() => setMobileMenuOpen(true)}><Menu size={20}/></div>
             <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">{activeSection.replace("_", " ")}</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center bg-zinc-900 border border-white/5 rounded-xl px-4 py-2">
              <Search size={16} className="text-zinc-500 mr-2" />
              <input 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Orders..." 
                className="bg-transparent border-none outline-none text-xs text-white w-48"
              />
            </div>
            <button onClick={resetDashboard} className="p-3 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/10 hover:bg-rose-500 hover:text-white transition-all">
              <RotateCcw size={18}/>
            </button>
          </div>
        </header>

        <main className="p-4 md:p-10 space-y-10">
          {/* VOID ALERT */}
          {voidRequests.length > 0 && (
            <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <AlertCircle className="text-rose-500 animate-pulse" />
                <p className="text-[10px] font-black uppercase text-zinc-400">{voidRequests.length} Pending Void Requests</p>
              </div>
              <button onClick={() => setActiveSection("LIVE AUDIT")} className="bg-rose-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase">Review</button>
            </div>
          )}

          {/* DYNAMIC SECTIONS */}
          {activeSection === "FINANCIAL_HISTORY" && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <AccountantStatCard label="Cash" value={systemTotals.cash} icon={<Banknote size={16}/>} color="text-emerald-500" />
                <AccountantStatCard label="Momo" value={systemTotals.momo} icon={<Smartphone size={16}/>} color="text-blue-400" />
                <AccountantStatCard label="Card" value={systemTotals.card} icon={<CreditCard size={16}/>} color="text-purple-500" />
                <AccountantStatCard label="Gross" value={totalRevenue} icon={<Receipt size={16}/>} color="text-black" bgColor="bg-yellow-400" isDarkText />
            </div>
          )}

          {activeSection === "PHYSICAL COUNT" && (
             <DailyReconciliation systemTotals={systemTotals} counts={physicalCounts} setCounts={setPhysicalCounts} />
          )}

          {activeSection === "LIVE AUDIT" && (
            <section className="space-y-6 animate-in fade-in duration-500">
              {voidRequests.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-white/10 rounded-[3rem]">
                  <CheckCircle2 size={40} className="mx-auto text-zinc-800 mb-4" />
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest italic">
                    No pending item void requests
                  </p>
                </div>
              ) : (
                voidRequests.map(order => (
                  <div key={order?.id || Math.random()} className="bg-zinc-900/30 border border-white/5 p-8 rounded-[2.5rem]">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <p className="text-white font-black uppercase text-sm italic">Table {order?.tableName ?? "N/A"}</p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                          Order #{order?.id ? order.id.slice(-6) : "000000"}
                        </p>
                      </div>
                      <div className="text-right">
                         <p className="text-[9px] text-zinc-500 font-black uppercase">Current Order Total</p>
                         {/* FIX: Ensuring toLocaleString never hits null */}
                         <p className="text-lg text-yellow-500 italic font-black">
                           UGX {(order?.total ?? 0).toLocaleString()}
                         </p>
                      </div>
                    </div>
          
                    <div className="space-y-3">
                      {order?.items?.map((item, idx) => {
                        if (!item?.voidRequested) return null;
          
                        const stationLower = item?.station?.toLowerCase() ?? "";
                        let staffLabel = "Chef"; 
                        let badgeColor = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
          
                        if (stationLower === "barman") {
                          staffLabel = "Barman";
                          badgeColor = "bg-blue-500/10 text-blue-500 border-blue-500/20";
                        } else if (stationLower === "barista" || stationLower === "coffee") {
                          staffLabel = "Barista";
                          badgeColor = "bg-orange-500/10 text-orange-500 border-orange-500/20";
                        }
          
                        return (
                          <div key={idx} className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 bg-rose-500/5 border border-rose-500/10 rounded-2xl gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center text-rose-500 font-black italic text-xs">
                                {item?.quantity ?? 1}x
                              </div>
                              <div>
                                <p className="text-xs font-black text-white uppercase">{item?.name ?? "Unknown Item"}</p>
                                
                                <div className="flex flex-wrap gap-2 mt-1.5 mb-2">
                                  <span className="text-[10px] font-black bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-white/5 uppercase tracking-tighter">
                                    Waiter: {item?.requestedBy || order?.waiterName || "Staff"}
                                  </span>
                                  
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-tighter ${badgeColor}`}>
                                    {staffLabel}: {item?.assignedTo || "Unassigned"}
                                  </span>
                                </div>
          
                                <p className="text-[10px] text-zinc-400 font-bold uppercase">
                                  Reason: <span className="text-rose-400 italic">"{item?.voidReason || 'No reason provided'}"</span>
                                </p>
                              </div>
                            </div>
          
                            <div className="flex gap-2 w-full md:w-auto">
                              <button 
                                onClick={() => approveItemVoid(order.id, idx)}
                                className="flex-1 md:flex-none bg-rose-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase italic transition-all hover:bg-rose-500 active:scale-95 shadow-lg shadow-rose-600/20"
                              >
                                Approve Void
                              </button>
                              
                              <button 
                                onClick={() => rejectItemVoid(order.id, idx)}
                                className="flex-1 md:flex-none bg-zinc-800 text-zinc-400 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase italic border border-white/5 hover:bg-zinc-700 transition-colors"
                              >
                                Reject Request
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </section>
          )}

          {activeSection === "END OF SHIFT" && (
            <div className="max-w-2xl mx-auto bg-zinc-900 border border-white/10 p-10 rounded-[3rem] text-center">
               {!isShiftClosed ? (
                 <button onClick={handleCloseShift} className="w-full bg-yellow-400 text-black py-5 rounded-2xl font-black uppercase italic">Finalize Shift</button>
               ) : (
                 <div className="text-emerald-500 font-black uppercase italic">Shift Successfully Audited</div>
               )}
            </div>
          )}
        </main>
      </div>

      {showPettyModal && <PettyCashModal onClose={() => setShowPettyModal(false)} onSave={handleAddPettyCash} />}
    </div>
  );
}

// Sub-components as defined in your previous logic...
// (Keep AccountantStatCard, DailyReconciliation, PettyCashModal etc.)
function ShiftSummaryRow({ label, value, color = "text-white", isBold = false }) {
  return (
    <div className="bg-black/20 border border-white/5 p-5 rounded-2xl flex justify-between items-center">
      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</span>
      <span className={`text-sm font-black italic ${color} ${isBold ? 'text-lg text-yellow-500' : ''}`}>
        UGX {value.toLocaleString()}
      </span>
    </div>
  );
}

function DailyReconciliation({ systemTotals, counts, setCounts }) {
  // Logic interpreted from your snippet
  const variances = {
    cash: (counts.cash || 0) - systemTotals.cash,
    momo: (counts.momo || 0) - systemTotals.momo,
    card: (counts.card || 0) - systemTotals.card
  };

  const totalVariance = variances.cash + variances.momo + variances.card;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-zinc-900/30 border border-white/5 p-6 md:p-8 rounded-[2rem]">
        <h3 className="text-[10px] font-black uppercase italic text-yellow-500 mb-6 flex items-center gap-2">
          <Calculator size={14} /> Physical Input
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
         <div className={`mt-6 p-6 rounded-2xl border transition-colors ${totalVariance === 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
            <p className="text-[9px] font-black uppercase text-zinc-500 mb-1">Total Variance</p>
            <h4 className={`text-xl font-black italic ${totalVariance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              UGX {totalVariance.toLocaleString()}
            </h4>
         </div>
      </div>
    </div>
  );
}
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