import React, { useState } from "react";
import NewOrder from "./NewOrder";
import OrderHistory from "./OrderHistory";
import { LayoutDashboard, PlusCircle, Receipt, UtensilsCrossed } from "lucide-react";
import logo from "../../../customer/assets/images/logo.jpeg";
import { useTheme } from "../../../customer/components/context/ThemeContext"; // Added theme context

export default function WaiterLayout() {
  const [activeTab, setActiveTab] = useState("order");
  const { theme } = useTheme(); // Access current theme

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
      
      {/* Top Header */}
      <header className={`flex items-center justify-between px-6 py-4 border-b transition-colors duration-300 ${
        theme === 'dark' ? 'bg-zinc-900/50 border-white/5' : 'bg-white border-black/5'
      }`}>
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-yellow-500/20" />
          <div className="flex flex-col justify-center leading-tight">
            <h1 className={`text-sm md:text-lg font-black uppercase tracking-tighter leading-none ${
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

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto pb-24">
        {renderContent()}
      </main>

      {/* Mobile-First Bottom Navigation */}
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

      </nav>
    </div>
  );
}

/* Sub-component for Nav Buttons */
function NavButton({ icon, label, active, onClick, theme }) {
  // Determine inactive text color based on theme
  const inactiveColor = theme === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-zinc-400 hover:text-zinc-600";

  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all duration-300 ${
        active ? "text-yellow-500 scale-110" : inactiveColor
      }`}
    >
      <div className={`${active ? "drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]" : ""}`}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}