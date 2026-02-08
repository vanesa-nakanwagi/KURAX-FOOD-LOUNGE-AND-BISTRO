import React, { useState } from "react";
import SideBar from "./SideBar";
import { 
  Menu, Search, ChevronRight, Truck, Banknote, 
  Smartphone, CreditCard, X, Clock, AlertCircle 
} from "lucide-react";
import Footer from "../../customer/components/common/Foooter";
import logo from "../../customer/assets/images/logo.jpeg";
export default function CashierDashboard() {
  const [activeSection, setActiveSection] = useState("PENDING"); 
  const [orderStatusFilter, setOrderStatusFilter] = useState("CLOSED"); // Sub-filter for Order Status
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showShiftSummary, setShowShiftSummary] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [animatingIds, setAnimatingIds] = useState([]); 
  // Change from hardcoded const to dynamic state
const [riders, setRiders] = useState([]);
  // --- REVENUE STATE ---
  const [cashOnCounter, setCashOnCounter] = useState(450000);
  const [cashOnMomo, setCashOnMomo] = useState(120000);
  const [totalViaCard, setTotalViaCard] = useState(300000);
  
  // --- ORDER STATE ---
  const [allOrders, setAllOrders] = useState([
    { id: "8241",  waiter: "JOHN", method: "CASH", total: 45000, status: "PENDING", time: "12:10 PM" },
    { id: "8242", waiter: "JOHN", method: "MOMO", total: 75000, status: "DELAYED", time: "11:45 AM" },
    { id: "8243", waiter: "SARAH", method: "CARD", total: 120000, status: "CLOSED", time: "10:30 AM" },
  ]);

  const addNewRider = () => {
  const name = prompt("Enter Rider Name:"); // Simple for now, or use a custom Modal
  if (name) {
    const newRider = {
      id: Date.now(), // Unique ID for this session
      name: name,
      status: "IN",
      cash: 0,
      momo: 0
    };
    setRiders(prev => [...prev, newRider]);
  }
};

  const handleRiderSettlement = (riderData) => {
  // 1. Move the money to your collection stats
  setCashOnCounter(prev => prev + riderData.cash);
  setCashOnMomo(prev => prev + riderData.momo);

  // 2. Clear the rider's current balance in the UI 
  // This prevents double-counting the same money
  setRiders(prev => prev.map(r => 
    r.id === riderData.id ? { ...r, cash: 0, momo: 0, status: "SETTLED" } : r
  ));

  // 3. Trigger the receipt for the rider to take as proof
  setSelectedSettlement(riderData);
  setShowReceipt(true);
};
const handleConfirmOrder = (order) => {
  // Start animation
  setAnimatingIds((prev) => [...prev, order.id]);

  // Wait 500ms for animation to finish before updating state
  setTimeout(() => {
    setAllOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "CLOSED" } : o));
    
    // Update Revenue
    if (order.method === "CASH") setCashOnCounter(prev => prev + order.total);
    if (order.method === "MOMO") setCashOnMomo(prev => prev + order.total);
    if (order.method === "CARD") setTotalViaCard(prev => prev + order.total);

    // Remove from animating list
    setAnimatingIds((prev) => prev.filter((id) => id !== order.id));
  }, 500);
};

  // Improved Filter Logic: 
  // If in PENDING section, show PENDING. 
  // If in CLOSED section, use the sub-filter (Pending/Delayed/Closed)
  const filteredOrders = allOrders.filter(o => {
    if (activeSection === "PENDING") return o.status === "PENDING";
    if (activeSection === "CLOSED") return o.status === orderStatusFilter;
    return false;
  });

  return (
    <div className="flex h-screen bg-black font-[Outfit] text-slate-200 overflow-hidden">
      
      <SideBar 
        activeSection={activeSection}
        setActiveSection={(section) => {
            setActiveSection(section);
            if(section === "CLOSED") setOrderStatusFilter("CLOSED"); // Reset sub-filter when switching
        }}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onEndShift={() => setShowShiftSummary(true)}
        stats={{ cash: cashOnCounter, momo: cashOnMomo, card: totalViaCard }}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header: Now matching Sidebar Branding */}
<header className="xl:hidden flex items-center justify-between px-6 py-4 bg-[#0c0c0c] border-b border-white/5">
  <div className="flex items-center gap-3">
    <img src={logo} alt="logo" className="w-9 h-9 rounded-full object-cover border border-yellow-500/20" />
    <div className="flex flex-col">
      <h1 className="text-[10px] font-black text-white uppercase tracking-tighter leading-tight">
        KURAX FOOD LOUNGE & BISTRO
      </h1>
      <p className="text-yellow-500 text-[8px] font-bold uppercase tracking-widest leading-tight">
        Accountant Panel
      </p>
    </div>
  </div>
  
  <button 
    onClick={() => setIsSidebarOpen(true)} 
    className="p-2 bg-zinc-900 rounded-xl text-yellow-500 active:scale-95 transition-all"
  >
    <Menu size={20} />
  </button>
</header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10">
  
  {/* 1. SECTION TABS - Only visible when "Order Status" is active */}
  {activeSection === "CLOSED" && (
    <div className="mb-10 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex gap-6 border-b border-white/5 md:ml-4">
          {["PENDING", "DELAYED", "CLOSED"].map((status) => (
            <button
              key={status}
              onClick={() => setOrderStatusFilter(status)}
              className={`pb-2 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${
                orderStatusFilter === status ? "text-yellow-500" : "text-zinc-500"
              }`}
            >
              {status}
              {orderStatusFilter === status && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500 animate-in fade-in slide-in-from-left-2" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )}

  {/* 2. DYNAMIC CONTENT AREA */}
  <div className="space-y-8">
    
   {activeSection === "RIDERS" && (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="flex justify-between items-end">
      <div className="mb-6">
        <h2 className="text-3xl md:text-4xl font-black text-white uppercase  tracking-tighter">
          Rider Details
        </h2>
        <p className="text-zinc-500 text-[10px] md:text-xs mt-2 max-w-2xl">
          Manage funds brought in by delivery personnel. Add a rider to begin reconciliation.
        </p>
      </div>
      
      {/* ADD RIDER BUTTON */}
      <button 
        onClick={addNewRider}
        className="mb-6 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-yellow-500 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
      >
        + Add Rider
      </button>
    </div>

    {riders.length > 0 ? (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {riders.map(rider => (
          <RiderCard 
            key={rider.id} 
            rider={rider} 
            onReconcile={(inputData) => handleRiderSettlement({ ...rider, ...inputData })} 
          />
        ))}
      </div>
    ) : (
      <div className="py-20 border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center opacity-30">
        <Truck size={48} className="mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em]">No riders active in this shift</p>
      </div>
    )}
  </div>
)}
    {/* --- COLLECTION / PENDING VIEW --- */}
    {activeSection === "PENDING" && (
      <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="mb-6">
          <h2 className="text-3xl md:text-4xl font-black text-white uppercase  tracking-tighter">
            My Collection
          </h2>
          <p className="text-zinc-500 text-[10px] md:text-xs mt-2 max-w-2xl leading-relaxed">
            Real-time overview of your shift earnings. Monitor physical cash, mobile money, and card settlements to ensure accurate reconciliation.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <HeaderStat 
            icon={<Banknote size={18}/>} 
            label="PHYSICAL CASH" 
            value={cashOnCounter} 
            color="text-green-500" 
          />
          <HeaderStat 
            icon={<Smartphone size={18}/>} 
            label="MOBILE MONEY" 
            value={cashOnMomo} 
            color="text-yellow-500" 
          />
          <HeaderStat 
            icon={<CreditCard size={18}/>} 
            label="CARD PAYMENTS" 
            value={totalViaCard} 
            color="text-blue-500" 
          />
          <HeaderStat 
            icon={<Banknote size={18}/>} 
            label="TOTAL REVENUE" 
            value={cashOnCounter + cashOnMomo + totalViaCard} 
            color="text-yellow-500"
          />
        </div>
      </div>
    )}

    {/* --- ORDER STATUS VIEW (Filterable List) --- */}
    {activeSection === "CLOSED" && (
      <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
        {filteredOrders.length > 0 ? (
          filteredOrders.map(order => (
            <OrderCard 
              key={order.id} 
              order={order} 
              onConfirm={handleConfirmOrder} 
              isExiting={animatingIds.includes(order.id)}
            />
          ))
        ) : (
          <div className="py-20 text-center opacity-30 uppercase text-[10px] font-black tracking-widest text-zinc-500">
            No orders found in this category
          </div>
        )}
      </div>
    )}
  </div>
</main>
        <Footer />
      </div>

      {/* MODALS */}
      {showReceipt && <ReceiptModal data={selectedSettlement} onClose={() => setShowReceipt(false)} />}
      {showShiftSummary && (
        <ShiftSummaryModal 
          data={{ cash: cashOnCounter, momo: cashOnMomo, card: totalViaCard }} 
          onClose={() => setShowShiftSummary(false)} 
        />
      )}
    </div>
  );
}
// --- SUB-COMPONENTS ---

function OrderCard({ order, onConfirm }) {
  return (
    <div className="bg-zinc-900/30 border border-white/5 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 group hover:bg-zinc-900/50 transition-all">
      <div className="flex items-center gap-5 w-full md:w-auto">
        <div className="w-14 h-14 rounded-2xl bg-black border border-white/10 flex items-center justify-center shrink-0">
          {order.method === "CASH" && <Banknote className="text-green-500" size={24} />}
          {order.method === "MOMO" && <Smartphone className="text-yellow-500" size={24} />}
          {order.method === "CARD" && <CreditCard className="text-blue-500" size={24} />}
        </div>
        <div>
          <h4 className="font-black uppercase italic text-white text-lg tracking-tight">
            <span className="text-yellow-500 mr-2">#{order.id}</span>
            WAITER: {order.waiter}
          </h4>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{order.time} • {order.method}</p>
        </div>
      </div>

      <div className="flex items-center justify-between md:justify-end gap-8 w-full md:w-auto border-t md:border-0 border-white/5 pt-4 md:pt-0">
        <div className="text-left md:text-right">
          <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">TOTAL AMOUNT</p>
          <p className="text-xl font-black text-white whitespace-nowrap">UGX {order.total.toLocaleString()}</p>
        </div>
        {order.status !== "CLOSED" && (
          <button 
            onClick={() => onConfirm(order)}
            className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-2xl uppercase italic flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-yellow-500/10"
          >
            CONFIRM <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

function RiderCard({ rider, onReconcile }) {
  // Local state for the inputs
  const [inputCash, setInputCash] = useState(rider.cash);
  const [inputMomo, setInputMomo] = useState(rider.momo);

  return (
    <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-[2.5rem] transition-all hover:bg-zinc-900/60">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center font-black">
            {rider.name[0]}
          </div>
          <div>
            <h4 className="font-black text-white uppercase italic tracking-tight">{rider.name}</h4>
            <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-black uppercase tracking-widest">
              {rider.status}
            </span>
          </div>
        </div>
        <button 
          onClick={() => onReconcile({ cash: inputCash, momo: inputMomo })} 
          className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all active:scale-95"
        >
          Reconcile
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* CASH INPUT */}
        <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
          <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-2">Cash Brought</p>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-zinc-600">UGX</span>
            <input 
              type="number"
              value={inputCash}
              onChange={(e) => setInputCash(Number(e.target.value))}
              className="bg-transparent border-none outline-none text-white font-black text-sm w-full focus:text-yellow-500 transition-colors"
            />
          </div>
        </div>

        {/* MOMO INPUT */}
        <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
          <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-2">Momo Collected</p>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-zinc-600">UGX</span>
            <input 
              type="number"
              value={inputMomo}
              onChange={(e) => setInputMomo(Number(e.target.value))}
              className="bg-transparent border-none outline-none text-white font-black text-sm w-full focus:text-yellow-500 transition-colors"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ... Keep your existing MoneyBox, ReceiptModal, ShiftSummaryModal, and SummaryRow below ...

function HeaderStat({ icon, label, value, color, hideCurrency }) {
  return (
    <div className="bg-zinc-900/30 p-3 md:p-4 rounded-[1.2rem] border border-white/5 flex flex-col gap-1 min-w-0">
      <div className={`p-1.5 w-fit rounded-lg bg-zinc-800/50 ${color}`}>{icon}</div>
      <div className="overflow-hidden">
        <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest truncate">{label}</p>
        <h3 className="text-sm md:text-lg font-black text-white italic truncate">
          {!hideCurrency && <span className="text-[8px] mr-1 opacity-50 not-italic">UGX</span>}
          {value.toLocaleString()}
        </h3>
      </div>
    </div>
  );
}

function MoneyBox({ label, value, highlight }) {
  return (
    <div className="bg-black/40 p-2 md:p-2.5 rounded-lg md:rounded-xl border border-white/5">
      <p className="text-[7px] md:text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">{label}</p>
      <p className={`text-[9px] md:text-[11px] font-black ${highlight ? 'text-yellow-500' : 'text-white'}`}>UGX {value.toLocaleString()}</p>
    </div>
  );
}

function ReceiptModal({ data, onClose }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white text-black w-full max-w-sm rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-10 font-mono shadow-2xl">
        <h2 className="text-lg md:text-xl font-black uppercase text-center mb-6">SETTLEMENT</h2>
        <div className="space-y-4 border-y border-dashed border-zinc-200 py-6 mb-8 text-sm md:text-base">
          <div className="flex justify-between"><span>RIDER:</span><span className="font-bold">{data?.name}</span></div>
          <div className="flex justify-between"><span>CASH:</span><span className="font-bold">UGX {data?.cash.toLocaleString()}</span></div>
          <div className="flex justify-between"><span>MOMO:</span><span className="font-bold">UGX {data?.momo.toLocaleString()}</span></div>
        </div>
        <button onClick={onClose} className="w-full py-4 bg-black text-white font-black rounded-xl uppercase italic text-sm">PRINT & CONFIRM</button>
      </div>
    </div>
  );
}

function ShiftSummaryModal({ data, onClose }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-white/10 w-full max-w-xl rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl overflow-y-auto max-h-screen">
        <div className="flex justify-between items-center mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl font-black uppercase italic text-yellow-500">Shift Summary</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={24} /></button>
        </div>
        <div className="space-y-3 md:space-y-4 mb-8 md:mb-10">
          <SummaryRow label="Physical Cash" value={data.cash} color="text-white" />
          <SummaryRow label="Mobile Money" value={data.momo} color="text-white" />
          <SummaryRow label="Card Payments" value={data.card} color="text-white" />
          <div className="pt-4 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-2">
            <span className="text-[10px] md:text-sm font-black text-zinc-500 uppercase">Gross Total</span>
            <span className="text-2xl md:text-3xl font-black text-yellow-400 italic">UGX {(data.cash + data.momo + data.card).toLocaleString()}</span>
          </div>
        </div>
        <button className="w-full py-4 md:py-5 bg-yellow-500 text-black font-black rounded-xl uppercase italic text-base md:text-lg shadow-xl shadow-yellow-500/20">
          Close Counter & Save
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color }) {
  return (
    <div className="flex justify-between items-center bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5">
      <span className="text-[9px] md:text-xs font-bold text-zinc-500 uppercase">{label}</span>
      <span className={`text-base md:text-xl font-black italic ${color}`}>UGX {value.toLocaleString()}</span>
    </div>
  ); 

}