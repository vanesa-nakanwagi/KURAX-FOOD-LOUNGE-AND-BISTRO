import React, { useState, useEffect } from "react";
import logo from "../../customer/assets/images/logo.jpeg";
import { 
  Banknote, CheckCircle2, Clock, Search, TrendingUp, Filter, 
  XCircle, ChevronRight, Truck, UserCheck, Receipt, X, Send, 
  Smartphone, CreditCard, AlertCircle, LayoutDashboard
} from "lucide-react";
import Footer from "../../customer/components/common/Foooter";

export default function CashierDashboard() {
  // --- STATE MANAGEMENT ---
  const [activeFilter, setActiveFilter] = useState("PENDING"); 
  const [showShiftSummary, setShowShiftSummary] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [showRidersMobile, setShowRidersMobile] = useState(false); // New state for mobile rider toggle

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

  const riders = [
    { id: 1, name: "Alex B.", status: "OUT", cash: 85000, momo: 120000 },
    { id: 2, name: "Sarah K.", status: "OUT", cash: 45000, momo: 0 },
  ];

  const handleConfirmOrder = (order) => {
    setAllOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "CLOSED" } : o));
    if (order.method === "CASH") setCashOnCounter(prev => prev + order.total);
    if (order.method === "MOMO") setCashOnMomo(prev => prev + order.total);
    if (order.method === "CARD") setTotalViaCard(prev => prev + order.total);
  };

  const filteredOrders = allOrders.filter(o => o.status === activeFilter);

  return (
    <div className="flex h-screen bg-black font-[Outfit] text-slate-200 overflow-hidden flex-col md:flex-row">
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top Header */}
        <header className="flex items-center justify-between px-4 md:px-6 py-4 bg-zinc-900/50 border-b border-white/5">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border border-yellow-500/20" />
            <div className="flex flex-col justify-center leading-tight">
              <h1 className="text-xs md:text-lg font-black text-white uppercase tracking-tighter leading-none">
                KURAX FOOD LOUNGE
              </h1>
              <h1 className="text-[8px] md:text-xs font-bold text-yellow-400 lowercase mt-0.5">
                Luxury dining & rooftop vibes
              </h1>
            </div>
          </div>
          
          {/* Mobile Rider Toggle */}
          <button 
            onClick={() => setShowRidersMobile(!showRidersMobile)}
            className="xl:hidden p-2 bg-zinc-800 rounded-lg text-yellow-500"
          >
            <Truck size={20} />
          </button>
        </header>
        
        {/* 1. REVENUE & STATUS HEADER (Responsive Grid) */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 p-4 md:p-6 bg-[#0a0a0a] border-b border-white/5 overflow-x-auto">
          <HeaderStat icon={<Banknote size={18}/>} label="CASH" value={cashOnCounter} color="text-green-500" />
          <HeaderStat icon={<Smartphone size={18}/>} label="MOMO" value={cashOnMomo} color="text-yellow-500" />
          <HeaderStat icon={<CreditCard size={18}/>} label="CARD" value={totalViaCard} color="text-blue-500" />
          <HeaderStat icon={<CheckCircle2 size={18}/>} label="CLOSED" value={allOrders.filter(o => o.status === "CLOSED").length} color="text-emerald-500" hideCurrency />
          <HeaderStat icon={<Clock size={18}/>} label="PENDING" value={allOrders.filter(o => o.status === "PENDING").length} color="text-amber-500" hideCurrency />
          <HeaderStat icon={<AlertCircle size={18}/>} label="DELAY" value={allOrders.filter(o => o.status === "DELAYED").length} color="text-rose-600 animate-pulse" hideCurrency />
        </div>

        {/* 2. FILTER TOOLBAR */}
        <div className="px-4 md:px-6 py-4 flex items-center justify-between border-b border-white/5 overflow-x-auto whitespace-nowrap">
          <div className="flex gap-4 md:gap-8">
            {["PENDING", "DELAYED", "CLOSED"].map((status) => (
              <button
                key={status}
                onClick={() => setActiveFilter(status)}
                className={`relative pb-2 text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                  activeFilter === status ? "text-yellow-500" : "text-zinc-500"
                }`}
              >
                {status}
                {activeFilter === status && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                )}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setShowShiftSummary(true)}
            className="ml-4 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-[9px] md:text-[10px] font-black uppercase rounded-xl border border-white/10 transition-all shrink-0"
          >
            End Shift
          </button>
        </div>

        {/* 3. DYNAMIC ORDER LIST */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order) => (
              <div key={order.id} className="bg-zinc-900/30 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-900/50 transition-all group">
                
                <div className="flex items-center gap-4 md:gap-5">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-black border border-white/10 flex items-center justify-center shrink-0">
                    {order.method === "CASH" && <Banknote className="text-green-500" size={20} />}
                    {order.method === "MOMO" && <Smartphone className="text-yellow-500" size={20} />}
                    {order.method === "CARD" && <CreditCard className="text-blue-500" size={20} />}
                  </div>

                  <div className="min-w-0">
                    <h4 className="font-black uppercase italic text-white tracking-tight flex items-center gap-2 md:gap-3 text-sm md:text-base">
                      <span className="text-yellow-500">#{order.id.slice(-4)}</span>
                      <span className="opacity-20 text-xs">|</span>
                      <span className="truncate">WAITER: {order.waiter}</span>
                    </h4>
                    
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{order.time}</span>
                      <span className="px-2 py-0.5 bg-white/5 rounded text-[8px] font-black text-zinc-400 uppercase">
                        {order.method}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 md:gap-8 border-t border-white/5 pt-4 sm:pt-0 sm:border-0">
                  <div className="sm:text-right">
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">TOTAL AMOUNT</p>
                    <p className="text-sm md:text-base font-black text-white whitespace-nowrap">UGX {(order.total || 0).toLocaleString()}</p>
                  </div>
                  
                  {order.status !== "CLOSED" && (
                    <button 
                      onClick={() => handleConfirmOrder(order)}
                      className="px-6 md:px-10 py-3 md:py-5 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl md:rounded-2xl uppercase italic flex items-center gap-2 transition-all shadow-xl shadow-yellow-500/10"
                    >
                      CONFIRM <ChevronRight size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-20 italic space-y-2">
              <Search size={48} />
              <p className="font-black uppercase tracking-widest text-xs text-center">No {activeFilter.toLowerCase()} orders found</p>
            </div>
          )}
        </div>
        <Footer />
      </div>

      {/* --- RIDER SIDEBAR (Responsive Behavior) --- */}
      <aside className={`
        fixed inset-y-0 right-0 z-[110] w-[300px] md:w-[380px] bg-[#0c0c0c] border-l border-white/5 flex flex-col transition-transform duration-300 transform
        xl:relative xl:translate-x-0 ${showRidersMobile ? 'translate-x-0 shadow-2xl' : 'translate-x-full'}
      `}>
        <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-base md:text-lg font-black uppercase tracking-widest text-yellow-400 italic flex items-center gap-3">
            <Truck size={20} /> RIDERS
          </h2>
          <button onClick={() => setShowRidersMobile(false)} className="xl:hidden text-zinc-500"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {riders.map((rider) => (
            <div key={rider.id} className="bg-zinc-900/40 border border-white/5 p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem]">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-zinc-800 rounded-full flex items-center justify-center font-black text-xs text-zinc-500">{rider.name[0]}</div>
                  <h4 className="font-black text-white text-xs md:text-sm">{rider.name}</h4>
                </div>
                <button 
                  onClick={() => {setSelectedSettlement(rider); setShowReceipt(true);}}
                  className="text-yellow-400 text-[9px] md:text-[10px] font-black uppercase underline"
                >
                  RECONCILE
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MoneyBox label="CASH" value={rider.cash} />
                <MoneyBox label="MOMO" value={rider.momo} highlight />
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Backdrop for mobile sidebar */}
      {showRidersMobile && (
        <div className="fixed inset-0 bg-black/60 z-[105] xl:hidden" onClick={() => setShowRidersMobile(false)} />
      )}

      {/* MODALS (Simplified for Mobile) */}
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

// Helper components remain largely the same, but with padding/text adjustments
function HeaderStat({ icon, label, value, color, hideCurrency }) {
  return (
    <div className="bg-zinc-900/30 p-3 md:p-4 rounded-[1.2rem] md:rounded-[1.5rem] border border-white/5 flex flex-col gap-1 md:gap-2 min-w-[120px]">
      <div className={`p-1.5 md:p-2 w-fit rounded-lg md:rounded-xl bg-zinc-800/50 ${color}`}>{icon}</div>
      <div>
        <p className="text-[8px] md:text-[9px] font-black uppercase text-zinc-500 tracking-widest leading-none mb-1">{label}</p>
        <h3 className="text-sm md:text-lg font-black text-white italic">
          {!hideCurrency && <span className="text-[8px] md:text-[10px] mr-1 opacity-50 not-italic">UGX</span>}
          {typeof value === 'number' ? value.toLocaleString() : value}
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