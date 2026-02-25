import React, { useState } from "react";
import NewOrder from "./NewOrder";
import OrderHistory from "./OrderHistory";
import { PlusCircle, Receipt, LogOut, Clock, Printer, X } from "lucide-react"; 
import logo from "../../../customer/assets/images/logo.jpeg";
import { useTheme } from "../../../customer/components/context/ThemeContext"; 
import { useData } from "../../../customer/components/context/DataContext"; 

export default function WaiterLayout() {
  const [activeTab, setActiveTab] = useState("order");
  const [showShiftModal, setShowShiftModal] = useState(false);
  const { theme } = useTheme();
  const { orders = [] } = useData() || {};

  // 1. PULL LOGGED-IN USER FROM STORAGE
  const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const waiterName = savedUser.name || "Staff Member";
  const waiterId = savedUser.id;

  const today = new Date().toISOString().split('T')[0];

  // 2. FILTER ORDERS BY THIS SPECIFIC WAITER ID
  const dailyOrders = orders.filter(order => {
    const orderDate = new Date(order.timestamp).toISOString().split('T')[0];
    // Use ID for better accuracy than Name
    return order.waiterId === waiterId && orderDate === today;
  });

  const shiftTotals = dailyOrders.reduce((acc, order) => {
    acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + (order.total || 0);
    acc.all += (order.total || 0);
    return acc;
  }, { Cash: 0, Card: 0, Momo: 0, all: 0 });

  const renderContent = () => {
    switch (activeTab) {
      case "order": return <NewOrder />;
      case "history": return <OrderHistory />;
      default: return <NewOrder />;
    }
  };

  return (
    <div className={`flex flex-col h-screen font-[Outfit] overflow-hidden transition-colors duration-300 ${
      theme === 'dark' ? 'bg-black text-slate-100' : 'bg-zinc-50 text-zinc-900'
    }`}>
      
      {/* End Shift Modal */}
      <EndShiftModal 
        isOpen={showShiftModal} 
        onClose={() => setShowShiftModal(false)} 
        totals={shiftTotals}
        orderCount={dailyOrders.length}
        waiterName={waiterName}
        theme={theme}
      />

      {/* Top Header */}
      <header className={`flex items-center justify-between px-6 py-4 border-b transition-colors duration-300 ${
        theme === 'dark' ? 'bg-zinc-900/50 border-white/5' : 'bg-white border-black/5'
      }`}>
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-yellow-500/20" />
          <div className="flex flex-col justify-center leading-tight">
            <h1 className={`text-sm md:text-lg font-medium uppercase tracking-tighter leading-none ${
              theme === 'dark' ? 'text-white' : 'text-zinc-900'
            }`}>
              KURAX FOOD LOUNGE & BISTRO
            </h1>
            <h1 className="text-[10px] md:text-xs font-bold text-yellow-500 lowercase mt-0.5">
              Luxury dining, signature drinks & rooftop vibes
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <nav className={`fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t px-8 py-3 pb-6 flex justify-around items-center z-[100] transition-colors duration-300 ${
        theme === 'dark' ? 'bg-zinc-900/80 border-white/5' : 'bg-white/80 border-black/5'
      }`}>
        
        <NavButton 
          active={activeTab === "order"} 
          onClick={() => setActiveTab("order")}
          icon={<PlusCircle size={24} />}
          label="New Order"
          theme={theme}
        />

        <NavButton 
          active={activeTab === "history"} 
          onClick={() => setActiveTab("history")}
          icon={<Receipt size={24} />}
          label="History"
          theme={theme}
        />

        {/* NEW END SHIFT BUTTON */}
        <NavButton 
          active={false} 
          onClick={() => setShowShiftModal(true)}
          icon={<LogOut size={24} />}
          label="End Shift"
          theme={theme}
          isDanger={true}
        />
      </nav>
    </div>
  );
}

/* Modal and Sub-components */
function EndShiftModal({ isOpen, onClose, totals, orderCount, waiterName, theme }) {
  if (!isOpen) return null;

  const cardBg = theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-zinc-50 border-black/5';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className={`w-full max-w-sm rounded-[3rem] p-8 border ${
        theme === 'dark' ? 'bg-zinc-900 border-white/10 text-white' : 'bg-white border-black/5 text-zinc-900'
      }`}>
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mb-4">
            <Clock size={28} />
          </div>
          <h2 className="text-xl font-black uppercase italic tracking-tighter">Shift Summary</h2>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-6">{waiterName}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <SummaryRow label="Orders" value={orderCount} bg={cardBg} />
          <SummaryRow label="Cash" value={`UGX ${totals.Cash.toLocaleString()}`} bg={cardBg} />
          <SummaryRow label="Momo" value={`UGX ${totals.Momo.toLocaleString()}`} bg={cardBg} />
          <SummaryRow label="Card" value={`UGX ${totals.Card.toLocaleString()}`} bg={cardBg} />
        </div>

        <div className="bg-yellow-500 p-5 rounded-[2rem] text-black text-center mb-6">
          <p className="text-[10px] font-black uppercase opacity-60">Total Gross</p>
          <p className="text-2xl font-black">UGX {totals.all.toLocaleString()}</p>
        </div>

        <div className="space-y-3">
          <button className="w-full py-4 bg-zinc-900 text-white dark:bg-white dark:text-black rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2">
             <Printer size={16} /> Print Report
          </button>
          <button onClick={onClose} className="w-full text-zinc-500 font-black uppercase text-[10px] py-2">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, bg }) {
  return (
    <div className={`p-4 rounded-2xl border ${bg}`}>
      <p className="text-[8px] font-black uppercase text-zinc-500 mb-1">{label}</p>
      <p className="text-xs font-black truncate">{value}</p>
    </div>
  );
}

function NavButton({ icon, label, active, onClick, theme, isDanger }) {
  const inactiveColor = theme === 'dark' ? "text-slate-500" : "text-zinc-400";
  const colorClass = isDanger ? "text-rose-500" : active ? "text-yellow-500 scale-110" : inactiveColor;

  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all duration-300 ${colorClass}`}>
      {icon}
      <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}