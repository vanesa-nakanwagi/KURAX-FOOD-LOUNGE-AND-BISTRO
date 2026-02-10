import React, { useState } from "react";
import NewOrder from "./NewOrder";
import OrderHistory from "./OrderHistory";
import TargetSettings from "./TargetSettings"; 
import Sidebar from "./Sidebar"; 
import { Lock, PlusCircle, Receipt } from "lucide-react"; // Added icons for bottom nav
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { useData } from "../../../customer/components/context/DataContext";
import ShiftReportModal from "./ShiftModal";
import LiveOrderStatus from "./LiveOrderStatus";

export default function ManagerLayout() {
  const [activeTab, setActiveTab] = useState("order");
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  
  const { theme } = useTheme();
  const { currentUser } = useData();

  const isPermitted = true; 

  const renderContent = () => {
    if (activeTab === "order" && !isPermitted) {
      return <LockedView name={currentUser?.name} theme={theme} />;
    }

    switch (activeTab) {
      case "order": return <NewOrder />;
      case "target": return <TargetSettings />;
      case "history": return <OrderHistory />;
      case "status": return <LiveOrderStatus />;
      case "logout": 
        return <div className="p-10 text-center font-black uppercase italic">Logging out of system...</div>;
      default: return <NewOrder />;
    }
  };

  const handleTabChange = (tabId) => {
    if (tabId === "shift") {
      setIsShiftModalOpen(true);
    } else {
      setActiveTab(tabId);
    }
  };

  return (
    <div className={`flex h-screen w-full font-[Outfit] overflow-hidden transition-colors duration-300 ${
      theme === 'dark' ? 'bg-black text-slate-100' : 'bg-zinc-50 text-zinc-900'
    }`}>
      
      {/* SIDEBAR */}
      <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 h-full overflow-y-auto relative">
        <div className="absolute top-4 right-6 z-50">
           <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${
             isPermitted 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
           }`}>
             <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isPermitted ? 'bg-emerald-500' : 'bg-rose-500'}`} />
             {isPermitted ? 'System Access Granted' : 'System Locked'}
           </div>
        </div>

        {/* Adjusting padding-bottom so the Bottom Nav doesn't hide content */}
        <div className={`${(activeTab === "order" || activeTab === "status") ? "pb-28" : ""}`}>
          {renderContent()}
        </div>
      </main>

      {/* BOTTOM NAV: Mirrors Waiter style but for Manager content area */}
      {(activeTab === "order" || activeTab === "history") && (
        <nav className={`fixed bottom-0 left-72 right-0 backdrop-blur-xl border-t px-12 py-4 pb-8 flex justify-around items-center z-[100] transition-all duration-300 ${
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
      )}

      <ShiftReportModal 
        isOpen={isShiftModalOpen} 
        onClose={() => setIsShiftModalOpen(false)} 
      />
    </div>
  );
}

/* Sub-component for Nav Buttons - Treated exactly like the Waiter version */
function NavButton({ icon, label, active, onClick, theme }) {
  const inactiveColor = theme === 'dark' ? "text-slate-500" : "text-zinc-400";

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

/* Locked View Component */
function LockedView({ name, theme }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4 bg-transparent">
      <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 border border-rose-500/20">
        <Lock size={40} />
      </div>
      <h2 className="text-2xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white">Access Restricted</h2>
      <p className="text-sm text-zinc-500 max-w-[300px] leading-relaxed">
        Sorry <span className={`${theme === 'dark' ? 'text-white' : 'text-black'} font-bold`}>{name}</span>, your management profile is currently locked by the Director.
      </p>
      <button className="mt-4 px-6 py-3 bg-zinc-900 text-white rounded-2xl border border-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all">
        Contact Admin for Permission
      </button>
    </div>
  );
}