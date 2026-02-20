import React, { useState } from "react";
import SideBar from "./SideBar";
import { 
  Menu, Search, ChevronRight, Truck, Banknote, 
  Smartphone, CreditCard, X, Clock, AlertCircle, 
  PlusCircle, Wallet, Trash2, CheckCircle2, XCircle
} from "lucide-react";
import Footer from "../../customer/components/common/Foooter";
import logo from "../../customer/assets/images/logo.jpeg";

export default function CashierDashboard() {
  // 1. NAVIGATION & UI STATE
  const [activeSection, setActiveSection] = useState("PENDING"); 
  const [orderStatusFilter, setOrderStatusFilter] = useState("CLOSED"); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showShiftSummary, setShowShiftSummary] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [animatingIds, setAnimatingIds] = useState([]); 

  // --- NEW: CONFIRMATION MODAL STATE ---
  const [processingOrder, setProcessingOrder] = useState(null);
  const [momoTransactionId, setMomoTransactionId] = useState("");

  // 2. FINANCIAL REVENUE STATE
  const [cashOnCounter, setCashOnCounter] = useState(450000); 
  const [cashOnMomo, setCashOnMomo] = useState(120000);
  const [totalViaCard, setTotalViaCard] = useState(300000);
  
  // 3. PETTY CASH STATE
  const [pettyLogs, setPettyLogs] = useState([]);
  const [pettyCashTotal, setPettyCashTotal] = useState(0);

  // 4. RIDERS & ORDERS STATE
  const [riders, setRiders] = useState([]);
 const [allOrders, setAllOrders] = useState([
  { id: "8241", table: "T-04", waiter: "JOHN", method: "CASH", total: 45000, status: "PENDING", time: "12:10 PM" },
  { id: "8242", table: "VIP-1", waiter: "JOHN", method: "MOMO", total: 75000, status: "DELAYED", time: "11:45 AM" },
  { id: "8243", table: "T-12", waiter: "SARAH", method: "CARD", total: 120000, status: "CLOSED", time: "10:30 AM" },
]);

  // --- CALCULATED VALUES ---
  const netCashRemaining = cashOnCounter - pettyCashTotal;
  const grossRevenue = cashOnCounter + cashOnMomo + totalViaCard;

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
    
    // Process payment
    setTimeout(() => {
      setAllOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "CLOSED", transactionId: momoTransactionId } : o));
      if (order.method === "CASH") setCashOnCounter(prev => prev + order.total);
      if (order.method === "MOMO") setCashOnMomo(prev => prev + order.total);
      if (order.method === "CARD") setTotalViaCard(prev => prev + order.total);
      
      setAnimatingIds((prev) => prev.filter((id) => id !== order.id));
      setProcessingOrder(null);
      setMomoTransactionId("");
    }, 500);
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
        {/* MOBILE HEADER */}
        <header className="xl:hidden flex items-center justify-between px-6 py-4 bg-[#0c0c0c] border-b border-white/5">
          <div className="flex items-center gap-3">
            <img src={logo} alt="logo" className="w-9 h-9 rounded-full object-cover border border-yellow-500/20" />
            <div className="flex flex-col">
              <h1 className="text-[10px] font-black text-white uppercase tracking-tighter leading-tight">KURAX BISTRO</h1>
              <p className="text-yellow-500 text-[8px] font-bold uppercase tracking-widest leading-tight">Cashier Panel</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-zinc-900 rounded-xl text-yellow-500"><Menu size={20} /></button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10">
          
          {activeSection === "CLOSED" && (
            <div className="mb-10 flex gap-6 border-b border-white/5">
              {["PENDING", "DELAYED", "CLOSED"].map((status) => (
                <button
                  key={status}
                  onClick={() => setOrderStatusFilter(status)}
                  className={`pb-2 text-[11px] font-black uppercase tracking-widest relative ${orderStatusFilter === status ? "text-yellow-500" : "text-zinc-500"}`}
                >
                  {status}
                  {orderStatusFilter === status && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500" />}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-8">
            {activeSection === "PENDING" && (
              <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter italic">My Collection</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <HeaderStat icon={<Banknote size={18}/>} label="NET CASH (ON HAND)" value={netCashRemaining} color="text-green-500" />
                  <HeaderStat icon={<Wallet size={18}/>} label="TOTAL EXPENSES" value={pettyCashTotal} color="text-rose-500" />
                  <HeaderStat icon={<Smartphone size={18}/>} label="MOBILE MONEY" value={cashOnMomo} color="text-yellow-500" />
                  <HeaderStat icon={<CreditCard size={18}/>} label="CARD REVENUE" value={totalViaCard} color="text-purple-500" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest italic">Live Confirmations</h3>
                  {filteredOrders.map(order => (
                    <OrderCard 
                      key={order.id} 
                      order={order} 
                      onConfirm={initiatePayment} 
                      isAnimating={animatingIds.includes(order.id)} 
                    />
                  ))}
                </div>
              </div>
            )}

            {/* PETTY CASH, RIDERS, AND CLOSED VIEWS REMAIN UNCHANGED */}
            {activeSection === "PETTY CASH" && (
                <PettyCashManager pettyLogs={pettyLogs} setPettyLogs={setPettyLogs} onTotalChange={(val) => setPettyCashTotal(val)} />
            )}
            
            {activeSection === "RIDERS" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {riders.map(rider => (
                  <RiderCard key={rider.id} rider={rider} onReconcile={(data) => handleRiderSettlement({ ...rider, ...data })} />
                ))}
              </div>
            )}

            {activeSection === "CLOSED" && (
              <div className="space-y-4">
                {filteredOrders.map(order => <OrderCard key={order.id} order={order} />)}
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>

    {/* --- PAYMENT CONFIRMATION MODAL --- */}
{processingOrder && (
  <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
    <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative">
      
      {/* HEADER: TABLE X-ORD#XXXX FORMAT */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <h2 className="text-white font-black uppercase italic text-sm tracking-tighter">
            TABLE {processingOrder.table?.replace('T-', '').replace('TABLE ', '') || "0"} 
          </h2>
          <span className="text-zinc-600 font-black text-sm">-</span>
          <h2 className="text-yellow-500 font-black uppercase italic text-sm tracking-tighter">
            ORD#{processingOrder.id}
          </h2>
        </div>
        
        <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest bg-white/5 px-2 py-1 rounded-md">
          WAITER: {processingOrder.waiter}
        </span>
      </div>

      <div className="flex justify-center mb-6">
        <div className={`p-4 rounded-full ${processingOrder.method === 'MOMO' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500'}`}>
          {processingOrder.method === 'CASH' ? <Banknote size={32} /> : processingOrder.method === 'MOMO' ? <Smartphone size={32} /> : <CreditCard size={32} />}
        </div>
      </div>

      <h3 className="text-xl font-black text-white text-center uppercase italic mb-2">Confirm Receipt</h3>
      
      <p className="text-zinc-400 text-center text-[10px] font-bold uppercase mb-8 tracking-widest leading-relaxed">
        {processingOrder.method === "CASH" && "Are you sure you have received the physical cash?"}
        {processingOrder.method === "CARD" && "Confirm that the Card machine transaction was successful?"}
        {processingOrder.method === "MOMO" && "Enter Trx ID to confirm mobile money receipt:"}
      </p>

      {/* PRICE DISPLAY */}
      <div className="bg-black/40 border border-white/5 rounded-2xl p-4 mb-6 text-center">
        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Total Amount Due</span>
        <span className="text-2xl font-black text-white italic">UGX {processingOrder.total?.toLocaleString()}</span>
      </div>

      {processingOrder.method === "MOMO" && (
        <input 
          autoFocus
          type="text"
          placeholder="ENTER TRANSACTION ID"
          className="w-full bg-black border border-white/10 p-5 rounded-2xl text-white font-[Outfit] font-black mb-6 outline-none focus:border-yellow-500 placeholder:text-zinc-800 text-center uppercase"
          value={momoTransactionId}
          onChange={(e) => setMomoTransactionId(e.target.value)}
        />
      )}

      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <button 
            onClick={() => setProcessingOrder(null)}
            className="flex-1 py-4 text-zinc-500 font-black uppercase text-[10px] hover:text-white transition-colors"
          >
            Cancel
          </button>
          
          {/* OPTIONAL: PRINT BUTTON */}
          <button 
            onClick={() => window.print()} // Replace with your actual print logic
            className="flex-1 py-4 border border-white/10 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 hover:bg-white/5"
          >
            Print Bill
          </button>
        </div>

        <button 
          onClick={handleFinalConfirm}
          disabled={processingOrder.method === "MOMO" && !momoTransactionId}
          className={`w-full py-5 rounded-2xl font-black uppercase text-xs transition-all ${
              (processingOrder.method === "MOMO" && !momoTransactionId) 
              ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" 
              : "bg-yellow-400 text-black shadow-lg shadow-yellow-400/10 active:scale-95"
          }`}
        >
          Finalize & Clear Table
        </button>
      </div>
    </div>
  </div>
)}

      {/* OTHER MODALS */}
{showReceipt && <ReceiptModal data={selectedSettlement} onClose={() => setShowReceipt(false)} />}
{showShiftSummary && (
  <ShiftSummaryModal 
    data={{ 
      cash: cashOnCounter, 
      momo: cashOnMomo, 
      card: totalViaCard, 
      petty: pettyCashTotal, 
      net: netCashRemaining 
    }} 
    onClose={() => setShowShiftSummary(false)} 
  />
)}
    </div>
  );
}

// --- SUB-COMPONENTS ---

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
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-yellow-500 text-black px-6 py-3 rounded-xl font-black uppercase text-[10px] italic">
          <PlusCircle size={14} /> Log Expense
        </button>
      </div>
      <div className="grid gap-3">
        {pettyLogs.map(log => (
          <div key={log.id} className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex justify-between items-center group">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-black rounded-xl text-rose-500"><Wallet size={16} /></div>
              <div><p className="text-xs font-black text-white uppercase italic">{log.reason}</p><p className="text-[9px] text-zinc-500 uppercase">{log.time}</p></div>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-sm font-black text-rose-500">- UGX {log.amount.toLocaleString()}</p>
              <button onClick={() => removeExpense(log.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-500"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      {showModal && (
        <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2rem] p-8 shadow-2xl">
            <h3 className="text-sm font-black italic uppercase text-yellow-500 mb-6 text-center">New Cash Outflow</h3>
            <input placeholder="Reason (e.g. Charcoal)" className="w-full bg-black border border-white/5 p-4 rounded-xl text-xs text-white mb-4 outline-none" onChange={e => setReason(e.target.value)} />
            <input type="number" placeholder="Amount (UGX)" className="w-full bg-black border border-white/5 p-4 rounded-xl text-xs text-white mb-6 outline-none" onChange={e => setAmount(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-4 text-zinc-500 font-black text-[10px] uppercase">Cancel</button>
              <button onClick={handleAddExpense} className="flex-[2] py-4 bg-yellow-500 text-black rounded-xl font-black text-xs uppercase">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShiftSummaryModal({ data, onClose }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-white/10 w-full max-w-xl rounded-[3rem] p-10 shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black uppercase italic text-yellow-500">Shift End Audit</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={24} /></button>
        </div>
        <div className="space-y-3 mb-8">
          <SummaryRow label="Total Cash Sales" value={data.cash} color="text-white" />
          <SummaryRow label="Petty Cash Spent" value={data.petty} color="text-rose-500" />
          <div className="my-2 border-b border-white/5" />
          <SummaryRow label="Net Cash to Handover" value={data.net} color="text-emerald-500" />
          <SummaryRow label="Mobile Money" value={data.momo} color="text-white" />
          <SummaryRow label="Card Payments" value={data.card} color="text-white" />
          <div className="pt-6 border-t border-white/10 flex justify-between items-center">
            <span className="text-sm font-black text-zinc-500 uppercase">Gross Revenue</span>
            <span className="text-3xl font-black text-yellow-400 italic">UGX {(data.cash + data.momo + data.card).toLocaleString()}</span>
          </div>
        </div>
        <button className="w-full py-5 bg-yellow-500 text-black font-black rounded-2xl uppercase italic text-lg active:scale-95 transition-all shadow-xl shadow-yellow-500/10">Confirm & Print Report</button>
      </div>
    </div>
  );
}

function RiderCard({ rider, onReconcile }) {
  const [cash, setCash] = useState(0);
  const [momo, setMomo] = useState(0);
  return (
    <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-[2.5rem] transition-all hover:bg-zinc-900/60">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center font-black uppercase italic">{rider.name[0]}</div>
          <div><h4 className="font-black text-white uppercase italic tracking-tight">{rider.name}</h4><span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-black uppercase tracking-widest">{rider.status}</span></div>
        </div>
        <button onClick={() => onReconcile({ cash, momo })} className="bg-yellow-500 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase italic active:scale-95">Reconcile</button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-black/40 p-3 rounded-2xl border border-white/5"><p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Cash Brought</p><input type="number" value={cash} onChange={e => setCash(Number(e.target.value))} className="bg-transparent text-white font-black text-sm w-full outline-none" /></div>
        <div className="bg-black/40 p-3 rounded-2xl border border-white/5"><p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Momo Brought</p><input type="number" value={momo} onChange={e => setMomo(Number(e.target.value))} className="bg-transparent text-white font-black text-sm w-full outline-none" /></div>
      </div>
    </div>
  );
}

function OrderCard({ order, onConfirm, isAnimating }) {
  return (
    <div className={`bg-zinc-900/40 border border-white/5 p-6 rounded-[2.5rem] flex items-center justify-between transition-all ${isAnimating ? "opacity-50 scale-95" : ""}`}>
      <div className="flex items-center gap-6">
        {/* ICON WITH FLOATING TABLE BADGE */}
        <div className="relative">
            <div className={`p-4 rounded-2xl bg-black/40 border border-white/5 ${order.method === 'CASH' ? 'text-green-500' : 'text-yellow-500'}`}>
                {order.method === 'CASH' ? <Banknote size={20}/> : <Smartphone size={20}/>}
            </div>
            {/* Table Badge */}
            <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase border-2 border-black">
                {order.table}
            </div>
        </div>
        
        <div>
          <h4 className="font-black text-white italic uppercase tracking-tighter">Order #{order.id}</h4>
          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
             Waiter: {order.waiter} • {order.time}
          </p>
        </div>
      </div>
      
      {/* REST OF THE CARD (PRICE & CONFIRM BUTTON) */}
      <div className="flex items-center gap-8">
        <div className="text-right">
          <p className="text-[10px] font-black text-white italic">UGX {order.total.toLocaleString()}</p>
        </div>
        {onConfirm && (
          <button 
            onClick={() => onConfirm(order)}
            className="bg-yellow-500 text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase italic"
          >
            Confirm
          </button>
        )}
      </div>
    </div>
  );
}

function HeaderStat({ icon, label, value, color }) {
  return (
    <div className="bg-zinc-900/30 p-4 rounded-[1.5rem] border border-white/5 flex flex-col gap-1">
      <div className={`p-2 w-fit rounded-lg bg-zinc-800/50 ${color}`}>{icon}</div>
      <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">{label}</p>
      <h3 className="text-lg font-black text-white italic"><span className="text-[8px] mr-1 opacity-50 not-italic">UGX</span>{value.toLocaleString()}</h3>
    </div>
  );
}

function SummaryRow({ label, value, color }) {
  return (
    <div className="flex justify-between items-center bg-black/40 p-5 rounded-2xl border border-white/5">
      <span className="text-[9px] font-bold text-zinc-500 uppercase">{label}</span>
      <span className={`text-xl font-black italic ${color}`}>UGX {value.toLocaleString()}</span>
    </div>
  );
}

function ReceiptModal({ data, onClose }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white text-black w-full max-w-sm rounded-[2rem] p-10 font-mono shadow-2xl">
        <h2 className="text-xl font-black uppercase text-center mb-6">SETTLEMENT</h2>
        <div className="space-y-4 border-y border-dashed border-zinc-200 py-6 mb-8">
          <div className="flex justify-between"><span>RIDER:</span><span className="font-bold uppercase">{data?.name}</span></div>
          <div className="flex justify-between"><span>CASH:</span><span className="font-bold">UGX {data?.cash.toLocaleString()}</span></div>
          <div className="flex justify-between"><span>MOMO:</span><span className="font-bold">UGX {data?.momo.toLocaleString()}</span></div>
        </div>
        <button onClick={onClose} className="w-full py-4 bg-black text-white font-black rounded-xl uppercase italic text-sm">PRINT & CONFIRM</button>
      </div>
    </div>
  );
}