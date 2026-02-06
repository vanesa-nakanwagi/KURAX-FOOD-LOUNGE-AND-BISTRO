import React, { useState } from "react";
import CashierDashboard from "./cashierDashboard";
import { LayoutDashboard, PlusCircle, Receipt, UtensilsCrossed } from "lucide-react";
import logo from "../../../assets/images/logo.jpeg";

export default function WaiterLayout() {
  const [activeTab, setActiveTab] = useState("order"); // Default to taking orders

  const renderContent = () => {
    switch (activeTab) {
      case "order": return <NewOrder />;
      case "history": return <OrderHistory />;
      // You can add more cases here later (e.g., Profile or Settings)
      default: return <NewOrder />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-slate-100 font-[Outfit] overflow-hidden">
      
      {/* Top Header - Minimal for more screen space */}
      <header className="flex items-center justify-between px-6 py-4 bg-zinc-900/50 border-b border-white/5">
      <div className="flex items-center gap-3">
                      <img src={logo} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-yellow-500/20" />
                     <div className="flex flex-col justify-center leading-tight">
        {/* Main Brand Name */}
        <h1 className="text-sm md:text-lg font-black text-white uppercase tracking-tighter leading-none">
          KURAX FOOD LOUNGE & BISTRO
        </h1>
        
        {/* Staff Panel Subtitle */}
        <h1 className="text-[10px] md:text-xs font-bold text-yellow-400 lowercase  mt-0.5">
        Luxury dining, signature drinks & rooftop vibes
        </h1>
      
      </div>
      </div>
        
      </header>

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto pb-24">
        {renderContent()}
      </main>

      {/* Mobile-First Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/80 backdrop-blur-xl border-t border-white/5 px-8 py-3 pb-6 flex justify-around items-center z-[100]">
        
        <NavButton 
          active={activeTab === "order"} 
          onClick={() => setActiveTab("order")}
          icon={<PlusCircle size={24} />}
          label="New Order"
        />

        <NavButton 
          active={activeTab === "history"} 
          onClick={() => setActiveTab("history")}
          icon={<Receipt size={24} />}
          label="History"
        />

      </nav>
    </div>
  );
}

/* Sub-component for Nav Buttons to keep code clean */
function NavButton({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all duration-300 ${
        active ? "text-yellow-500 scale-110" : "text-slate-500 hover:text-slate-300"
      }`}
    >
      <div className={`${active ? "drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]" : ""}`}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}