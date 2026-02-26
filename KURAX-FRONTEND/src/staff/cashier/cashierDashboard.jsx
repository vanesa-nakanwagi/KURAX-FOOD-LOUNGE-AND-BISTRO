import React, { useState, useMemo } from "react";
import SideBar from "./SideBar";
import { 
  Menu, Banknote, Smartphone, CreditCard, X, Wallet, 
  Trash2, CheckCircle2, PlusCircle, UserCircle,
  Printer, ArrowRightLeft, ShieldCheck
} from "lucide-react";
import Footer from "../../customer/components/common/Foooter";
import logo from "../../customer/assets/images/logo.jpeg";

export default function CashierDashboard() {
  // --- 1. USER SESSION (Read-only) ---
  const loggedInUser = useMemo(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  }, []);

  const cashierName = loggedInUser?.name || "Staff Member";
  const cashierInitials = cashierName.split(' ').map(n => n[0]).join('').toUpperCase();

  // --- 2. NAVIGATION & UI STATE ---
  const [activeSection, setActiveSection] = useState("PENDING"); 
  const [orderStatusFilter, setOrderStatusFilter] = useState("CLOSED"); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showShiftSummary, setShowShiftSummary] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [animatingIds, setAnimatingIds] = useState([]); 

  // --- 3. TRANSACTION MODAL STATE ---
  const [processingOrder, setProcessingOrder] = useState(null);
  const [momoTransactionId, setMomoTransactionId] = useState("");

  // --- 4. FINANCIAL STATE ---
  const [cashOnCounter, setCashOnCounter] = useState(450000); 
  const [cashOnMomo, setCashOnMomo] = useState(120000);
  const [totalViaCard, setTotalViaCard] = useState(300000);
  const [pettyLogs, setPettyLogs] = useState([]);
  const [pettyCashTotal, setPettyCashTotal] = useState(0);

  // --- 5. RIDERS & ORDERS DATA ---
  const [riders, setRiders] = useState([]);
  const [allOrders, setAllOrders] = useState([
    { id: "8241", table: "T-04", waiter: "JOHN", method: "CASH", total: 45000, status: "PENDING", time: "12:10 PM" },
    { id: "8242", table: "VIP-1", waiter: "JOHN", method: "MOMO", total: 75000, status: "DELAYED", time: "11:45 AM" },
    { id: "8243", table: "T-12", waiter: "SARAH", method: "CARD", total: 120000, status: "CLOSED", time: "10:30 AM" },
  ]);

  // --- CALCULATED VALUES ---
  const netCashRemaining = cashOnCounter - pettyCashTotal;

  // --- HANDLERS ---
  const initiatePayment = (order) => {
    setProcessingOrder(order);
    setMomoTransactionId(""); 
  };

  const handleFinalConfirm = () => {
    const order = processingOrder;
    if (order.method === "MOMO" && !momoTransactionId) {
      alert("Please enter the Momo Transaction ID first!");
      return;
    }

    setAnimatingIds((prev) => [...prev, order.id]);
    
    setTimeout(() => {
      setAllOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "CLOSED", transactionId: momoTransactionId } : o));
      if (order.method === "CASH") setCashOnCounter(prev => prev + order.total);
      if (order.method === "MOMO") setCashOnMomo(prev => prev + order.total);
      if (order.method === "CARD") setTotalViaCard(prev => prev + order.total);
      
      setAnimatingIds((prev) => prev.filter((id) => id !== order.id));
      setProcessingOrder(null);
      setMomoTransactionId("");
    }, 600);
  };

  const addNewRider = () => {
    const name = prompt("Enter Rider Name:"); 
    if (name) {
      setRiders(prev => [...prev, { id: Date.now(), name, status: "IN", cash: 0, momo: 0 }]);
    }
  };

  const handleRiderSettlement = (riderData) => {
    setCashOnCounter(prev => prev + riderData.cash);
    setCashOnMomo(prev => prev + riderData.momo);
    setRiders(prev => prev.map(r => 
      r.id === riderData.id ? { ...r, cash: 0, momo: 0, status: "SETTLED" } : r
    ));
    setSelectedSettlement(riderData);
    setShowReceipt(true);
  };

  const filteredOrders = allOrders.filter(o => {
    if (activeSection === "PENDING") return o.status === "PENDING" || o.status === "DELAYED";
    if (activeSection === "CLOSED") return o.status === orderStatusFilter;
    return false;
  });

  return (
    <div className="flex h-screen bg-black font-[Outfit] text-slate-200 overflow-hidden">
      
      <SideBar 
        activeSection={activeSection}
        setActiveSection={(section) => {
            setActiveSection(section);
            if(section === "CLOSED") setOrderStatusFilter("CLOSED");
        }}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onEndShift={() => setShowShiftSummary(true)}
        stats={{ cash: netCashRemaining, momo: cashOnMomo, card: totalViaCard }}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* --- SIMPLIFIED HEADER (No Logout) --- */}
        <header className="flex items-center justify-between px-6 py-4 bg-[#0c0c0c] border-b border-white/5 sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-zinc-900 rounded-xl text-yellow-500">
              <Menu size={20} />
            </button>
            {/* Header Section */}
          <div className="mb-2 flex justify-between items-end">
            <div>
              <div className="flex items-center gap-3 mb-2">
                  <div className="w-1 h-6 bg-yellow-500 rounded-full" />
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-yellow-500/80">Cashier Overview</h4>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Welcome back, <span className="text-yellow-400 capitalize">{cashierName}</span>
              </h2>
            </div>
             </div>
            
          </div>

         
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10">
          
          {activeSection === "CLOSED" && (
            <div className="mb-10 flex gap-6 border-b border-white/5">
              {["PENDING", "DELAYED", "CLOSED"].map((status) => (
                <button
                  key={status}
                  onClick={() => setOrderStatusFilter(status)}
                  className={`pb-2 text-[11px] font-black uppercase tracking-widest relative transition-colors ${orderStatusFilter === status ? "text-yellow-500" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  {status}
                  {orderStatusFilter === status && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500" />}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-4">
            
            {activeSection === "PENDING" && (
  <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
    <div> {/* Wrap headers in a div to stop space-y-8 from separating them */}
      <h2 className="text-xl font-black text-white uppercase leading-none">
        My Live Collection
      </h2>
      <p className="text-yellow-600 text-[14px] font-medium mt-1 italic tracking-tight">
        Track your daily cash, card and mobile money collection
      </p>
    </div>

    {/* The rest of your content stays inside the space-y-8 flow */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <HeaderStat icon={<Banknote size={18}/>} label="Cash on Counter" value={netCashRemaining} color="text-green-500" />
      <HeaderStat icon={<Wallet size={18}/>} label="Petty Expenses" value={pettyCashTotal} color="text-rose-500" />
      <HeaderStat icon={<Smartphone size={18}/>} label="Mobile Money" value={cashOnMomo} color="text-yellow-500" />
      <HeaderStat icon={<CreditCard size={18}/>} label="Card Revenue" value={totalViaCard} color="text-purple-500" />
    </div>
  
                <div className="space-y-4">
                  {filteredOrders.length > 0 ? filteredOrders.map(order => (
                    <OrderCard 
                      key={order.id} 
                      order={order} 
                      onConfirm={initiatePayment} 
                      isAnimating={animatingIds.includes(order.id)} 
                    />
                  )) : (
                    <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-zinc-900/10">
                        <ShieldCheck size={32} className="mx-auto text-zinc-700 mb-4" />
                        <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest italic">All Tables Settled & Clear</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* ... RIDERS, PETTY CASH, CLOSED sections remain exactly as before ... */}
            {activeSection === "RIDERS" && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Delivery Riders</h2>
                            <p className="text-yellow-500 text-[15px] italic font-medium mt-1">Settlement & Reconciliation</p>
                        </div>
                        <button onClick={addNewRider} className="flex items-center gap-2 bg-yellow-500 text-black px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase italic shadow-xl shadow-yellow-500/10">
                            <PlusCircle size={16} /> Register Rider
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {riders.length > 0 ? riders.map(rider => (
                            <RiderCard key={rider.id} rider={rider} onReconcile={(data) => handleRiderSettlement({ ...rider, ...data })} />
                        )) : (
                            <div className="col-span-full py-20 text-center opacity-20 text-[10px] font-black uppercase tracking-[0.2em]">No active riders today</div>
                        )}
                    </div>
                </div>
            )}

            {activeSection === "PETTY CASH" && (
                <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-500">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase">Petty Cash</h2>
                            <p className="text-yellow-600 text-[14px] font-medium mt-1 italic tracking-tight">Track your daily expenses</p>
                        </div>
                        <div className="px-6 py-4 bg-zinc-900/50 border border-white/5 rounded-[2rem] flex items-center gap-4">
                            <div className="p-3 bg-rose-500/20 rounded-xl text-rose-500"><Wallet size={18} /></div>
                            <div>
                                <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest leading-none mb-1.5">Shift Outflow</p>
                                <p className="text-lg font-black text-white italic">UGX {pettyCashTotal.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                    <PettyCashManager pettyLogs={pettyLogs} setPettyLogs={setPettyLogs} onTotalChange={(val) => setPettyCashTotal(val)} />
                </div>
            )}

            {activeSection === "CLOSED" && (
                <div className="space-y-4 animate-in fade-in duration-500">
                    {filteredOrders.map(order => <OrderCard key={order.id} order={order} />)}
                </div>
            )}

          </div>
        </main>
        <Footer />
      </div>

      {/* --- PAYMENT MODAL --- */}
      {processingOrder && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-[3rem] p-8 shadow-2xl relative">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <h2 className="text-white font-black uppercase italic text-sm tracking-tighter">TABLE {processingOrder.table?.replace('T-', '').replace('TABLE ', '') || "0"}</h2>
                <span className="text-zinc-700 font-black">•</span>
                <h2 className="text-yellow-500 font-black uppercase italic text-sm tracking-tighter">ORD#{processingOrder.id}</h2>
              </div>
              <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full">STAFF: {processingOrder.waiter}</span>
            </div>

            <div className="flex justify-center mb-6">
                <div className={`p-6 rounded-full ${processingOrder.method === 'MOMO' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500'}`}>
                    {processingOrder.method === 'CASH' ? <Banknote size={40} /> : processingOrder.method === 'MOMO' ? <Smartphone size={40} /> : <CreditCard size={40} />}
                </div>
            </div>

            <h3 className="text-2xl font-black text-white text-center uppercase italic mb-2 tracking-tighter">Confirm Receipt</h3>
            <div className="bg-black border border-white/5 rounded-3xl p-6 mb-8 text-center">
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] block mb-2">Grand Total</span>
                <span className="text-3xl font-black text-white italic tracking-tighter">UGX {processingOrder.total?.toLocaleString()}</span>
            </div>

            {processingOrder.method === "MOMO" && (
                <input 
                    autoFocus type="text" placeholder="ENTER TRANSACTION ID"
                    className="w-full bg-black border border-yellow-500/30 p-5 rounded-2xl text-white font-black outline-none focus:border-yellow-500 text-center uppercase tracking-widest text-sm mb-6"
                    value={momoTransactionId} onChange={(e) => setMomoTransactionId(e.target.value)}
                />
            )}

            <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <button onClick={() => setProcessingOrder(null)} className="flex-1 py-4 text-zinc-600 font-black uppercase text-[10px]">Cancel</button>
                    <button onClick={() => window.print()} className="flex-1 py-4 border border-white/10 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2">
                        <Printer size={14} /> Print
                    </button>
                </div>
                <button 
                    onClick={handleFinalConfirm}
                    disabled={processingOrder.method === "MOMO" && !momoTransactionId}
                    className={`w-full py-5 rounded-2xl font-black uppercase text-xs transition-all duration-300 ${(processingOrder.method === "MOMO" && !momoTransactionId) ? "bg-zinc-800 text-zinc-600 grayscale" : "bg-yellow-500 text-black shadow-xl"}`}
                >Finalize Settlement</button>
            </div>
          </div>
        </div>
      )}

      {/* OTHER MODALS */}
      {showReceipt && <ReceiptModal data={selectedSettlement} onClose={() => setShowReceipt(false)} />}
      {showShiftSummary && (
        <ShiftSummaryModal data={{ cash: cashOnCounter, momo: cashOnMomo, card: totalViaCard, petty: pettyCashTotal, net: netCashRemaining }} onClose={() => setShowShiftSummary(false)} />
      )}
    </div>
  );
}

// ... HeaderStat, PettyCashManager, ShiftSummaryModal, RiderCard, OrderCard, SummaryRow, ReceiptModal components same as previous ...
function HeaderStat({ icon, label, value, color }) {
    return (
      <div className="bg-zinc-900/30 p-5 rounded-[2rem] border border-white/5 flex flex-col gap-2 hover:bg-zinc-900/50 transition-colors group">
        <div className={`p-2.5 w-fit rounded-xl bg-black border border-white/5 shadow-inner ${color} group-hover:scale-110 transition-transform`}>{icon}</div>
        <div>
          <p className="text-[8px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-1">{label}</p>
          <h3 className="text-xl font-black text-white italic tracking-tighter"><span className="text-[9px] mr-1 opacity-40 not-italic">UGX</span>{value.toLocaleString()}</h3>
        </div>
      </div>
    );
  }
  
  function PettyCashManager({ pettyLogs, setPettyLogs, onTotalChange }) {
    const [showModal, setShowModal] = useState(false);
    const [reason, setReason] = useState("");
    const [amount, setAmount] = useState("");
  
    const handleAddExpense = () => {
      if (!reason || !amount) return;
      const newLogs = [{ id: Date.now(), reason, amount: Number(amount), time: new Date().toLocaleTimeString() }, ...pettyLogs];
      setPettyLogs(newLogs);
      onTotalChange(newLogs.reduce((sum, l) => sum + l.amount, 0));
      setReason(""); setAmount(""); setShowModal(false);
    };
  
    const removeExpense = (id) => {
      const newLogs = pettyLogs.filter(l => l.id !== id);
      setPettyLogs(newLogs);
      onTotalChange(newLogs.reduce((sum, l) => sum + l.amount, 0));
    };
  
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-yellow-500 text-black px-6 py-3.5 rounded-2xl font-black uppercase text-[10px] italic shadow-lg shadow-yellow-500/10">
            <PlusCircle size={14} /> New Log
          </button>
        </div>
        <div className="grid gap-3">
          {pettyLogs.length > 0 ? pettyLogs.map(log => (
            <div key={log.id} className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex justify-between items-center group hover:border-rose-500/20 transition-all">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-black rounded-xl text-rose-500"><Wallet size={16} /></div>
                <div><p className="text-xs font-black text-white uppercase italic">{log.reason}</p><p className="text-[9px] text-zinc-600 uppercase tracking-widest">{log.time}</p></div>
              </div>
              <div className="flex items-center gap-6">
                <p className="text-sm font-black text-rose-500">- UGX {log.amount.toLocaleString()}</p>
                <button onClick={() => removeExpense(log.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-500 transition-all"><Trash2 size={16} /></button>
              </div>
            </div>
          )) : (
              <div className="text-center py-12 text-[10px] font-black text-zinc-700 uppercase tracking-widest border border-dashed border-white/5 rounded-[2rem]">No expenses logged yet</div>
          )}
        </div>
        {showModal && (
          <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-md flex items-center justify-center p-6">
            <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
              <h3 className="text-sm font-black italic uppercase text-yellow-500 mb-8 text-center tracking-widest underline underline-offset-8">New Outflow</h3>
              <input placeholder="Expense Reason" className="w-full bg-black border border-white/5 p-4 rounded-xl text-xs text-white mb-4 outline-none focus:border-yellow-500/50" onChange={e => setReason(e.target.value)} />
              <input type="number" placeholder="Amount (UGX)" className="w-full bg-black border border-white/5 p-4 rounded-xl text-xs text-white mb-8 outline-none focus:border-yellow-500/50" onChange={e => setAmount(e.target.value)} />
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="flex-1 py-4 text-zinc-500 font-black text-[10px] uppercase">Discard</button>
                <button onClick={handleAddExpense} className="flex-[2] py-4 bg-yellow-500 text-black rounded-2xl font-black text-xs uppercase shadow-lg shadow-yellow-500/10">Post Expense</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  function ShiftSummaryModal({ data, onClose }) {
    return (
      <div className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-4">
        <div className="bg-[#0c0c0c] border border-white/10 w-full max-w-xl rounded-[4rem] p-12 shadow-[0_0_100px_-20px_rgba(234,179,8,0.2)]">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-3xl font-black uppercase italic text-yellow-500 tracking-tighter">Shift Audit Report</h2>
            <button onClick={onClose} className="p-2 bg-zinc-900 rounded-full text-zinc-500 hover:text-white"><X size={20} /></button>
          </div>
          <div className="space-y-4 mb-10">
            <SummaryRow label="Gross Cash Collections" value={data.cash + data.petty} color="text-white" />
            <SummaryRow label="Total Petty Outflow" value={data.petty} color="text-rose-500" />
            <div className="my-4 border-b border-dashed border-white/10" />
            <SummaryRow label="Actual Drawer Handover" value={data.net} color="text-emerald-500" />
            <SummaryRow label="Mobile Money Records" value={data.momo} color="text-white" />
            <SummaryRow label="POS Card Settlements" value={data.card} color="text-white" />
            <div className="pt-8 border-t border-white/10 flex justify-between items-center">
              <div>
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] block mb-1">Total Shift Revenue</span>
                  <span className="text-4xl font-black text-yellow-400 italic tracking-tighter">UGX {(data.cash + data.momo + data.card).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <button className="w-full py-6 bg-yellow-500 text-black font-black rounded-[2rem] uppercase italic text-xl shadow-2xl shadow-yellow-500/20 hover:scale-[1.02] transition-all">Submit & Finalize Audit</button>
        </div>
      </div>
    );
  }
  
  function RiderCard({ rider, onReconcile }) {
    const [cash, setCash] = useState(0);
    const [momo, setMomo] = useState(0);
    return (
      <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-[2.5rem] transition-all hover:bg-zinc-900/60 hover:border-yellow-500/20 group">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-yellow-500/10 text-yellow-500 rounded-2xl flex items-center justify-center font-black text-xl italic border border-yellow-500/10 shadow-inner group-hover:scale-110 transition-transform duration-500">{rider.name[0]}</div>
            <div>
              <h4 className="font-black text-white uppercase italic tracking-tight text-lg">{rider.name}</h4>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full font-black uppercase tracking-widest border border-emerald-500/10">{rider.status}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-black/40 p-4 rounded-2xl border border-white/5"><p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">Cash</p><input type="number" value={cash} onChange={e => setCash(Number(e.target.value))} className="bg-transparent text-white font-black text-sm w-full outline-none" /></div>
          <div className="bg-black/40 p-4 rounded-2xl border border-white/5"><p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">Momo</p><input type="number" value={momo} onChange={e => setMomo(Number(e.target.value))} className="bg-transparent text-white font-black text-sm w-full outline-none" /></div>
        </div>
        <button onClick={() => onReconcile({ cash, momo })} className="w-full bg-white/5 text-white hover:bg-yellow-500 hover:text-black py-4 rounded-2xl text-[10px] font-black uppercase italic tracking-widest transition-all">Post Settlement</button>
      </div>
    );
  }
  
  function OrderCard({ order, onConfirm, isAnimating }) {
    return (
      <div className={`bg-zinc-900/20 border border-white/5 p-6 rounded-[2.5rem] flex items-center justify-between transition-all duration-500 hover:bg-zinc-900/40 hover:border-white/10 ${isAnimating ? "opacity-0 scale-90" : "opacity-100"}`}>
        <div className="flex items-center gap-6">
          <div className={`p-5 rounded-2xl bg-black border border-white/5 shadow-inner ${order.method === 'CASH' ? 'text-green-500' : 'text-yellow-500'}`}>
            {order.method === 'CASH' ? <Banknote size={24}/> : order.method === 'MOMO' ? <Smartphone size={24}/> : <CreditCard size={24}/>}
          </div>
  
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <h4 className="font-black text-white italic uppercase tracking-tighter text-base">TABLE {order.table?.replace('T-', '').replace('TABLE ', '') || "0"}</h4>
              <span className="text-zinc-700 font-black">•</span>
              <h4 className="font-black text-yellow-500 italic uppercase tracking-tighter text-base">ORD#{order.id}</h4>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">STAFF: {order.waiter}</p>
              <div className="w-1 h-1 bg-zinc-700 rounded-full" />
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{order.time}</p>
            </div>
          </div>
        </div>
  
        <div className="flex items-center gap-10">
          <div className="text-right">
            <p className="text-xl font-black text-white italic tracking-tighter">UGX {order.total.toLocaleString()}</p>
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${order.status === 'DELAYED' ? 'text-rose-500 bg-rose-500/10' : 'text-zinc-500 bg-white/5'}`}>{order.status}</span>
          </div>
  
          {onConfirm && (
            <button 
              onClick={() => onConfirm(order)}
              className="group bg-yellow-500 text-black px-8 py-4 rounded-[1.5rem] text-[11px] font-black uppercase italic shadow-2xl shadow-yellow-500/10 hover:bg-yellow-400 transition-all active:scale-95 flex items-center gap-2"
            >
              Confirm
              <ArrowRightLeft size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>
      </div>
    );
  }
  
  function SummaryRow({ label, value, color }) {
    return (
      <div className="flex justify-between items-center bg-zinc-900/40 p-6 rounded-3xl border border-white/5">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
        <span className={`text-2xl font-black italic ${color}`}>UGX {value.toLocaleString()}</span>
      </div>
    );
  }
  
  function ReceiptModal({ data, onClose }) {
    return (
      <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-white text-black w-full max-w-sm rounded-[3rem] p-12 font-mono shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-yellow-500" />
          <h2 className="text-2xl font-black uppercase text-center mb-2 tracking-tighter">KURAX BISTRO</h2>
          <p className="text-[10px] text-center mb-8 uppercase font-bold text-zinc-500">Official Settlement Voucher</p>
          
          <div className="space-y-4 border-y border-dashed border-zinc-200 py-8 mb-8">
            <div className="flex justify-between text-xs"><span>REFERENCE:</span><span className="font-bold">#SETL-{Date.now().toString().slice(-4)}</span></div>
            <div className="flex justify-between text-xs"><span>RIDER:</span><span className="font-bold uppercase">{data?.name}</span></div>
            <div className="my-4 border-t border-zinc-100" />
            <div className="flex justify-between text-sm"><span>CASH:</span><span className="font-bold">UGX {data?.cash.toLocaleString()}</span></div>
            <div className="flex justify-between text-sm"><span>MOMO:</span><span className="font-bold">UGX {data?.momo.toLocaleString()}</span></div>
          </div>
  
          <div className="flex flex-col gap-3">
              <button onClick={() => window.print()} className="w-full py-4 bg-black text-white font-black rounded-2xl uppercase italic text-sm flex items-center justify-center gap-3">
                  <Printer size={18} /> Print Voucher
              </button>
              <button onClick={onClose} className="w-full py-4 text-zinc-400 font-bold uppercase text-[10px]">Close Window</button>
          </div>
        </div>
      </div>
    );
  }