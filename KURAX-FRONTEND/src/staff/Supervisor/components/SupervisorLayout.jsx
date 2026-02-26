import React, { useState, useEffect } from "react";
import { 
  Lock, PlusCircle, Receipt, ShieldAlert, 
  ShieldCheck, RefreshCcw, Smartphone, Clock, Flag 
} from "lucide-react"; 

// Component Imports
import NewOrder from "./NewOrder";
import OrderHistory from "./OrderHistory";
import Sidebar from "./Sidebar"; 
import ShiftReportModal from "./ShiftModal";
import LiveOrderStatus from "./LiveOrderStatus";
import LiveTableGrid from "./LiveTableGrid"; 

import { useTheme } from "../../../customer/components/context/ThemeContext";
import { useData } from "../../../customer/components/context/DataContext";

export default function StaffPortalLayout() {
  const [activeTab, setActiveTab] = useState("order");
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  
  const { theme } = useTheme();
  const { currentUser, isGranted } = useData();

  /**
   * Universal Content Resolver
   * "status" and "tables" are always open.
   * "order" is ONLY open if isGranted is true.
   */
  const renderContent = () => {
    switch (activeTab) {
      case "order": 
        if (!isGranted) {
          return (
            <LockedView 
              name={currentUser?.name} 
              theme={theme} 
            />
          );
        }
        return <NewOrder />;

      case "status": 
        return <LiveOrderStatus />;
      
      case "tables": 
        return <LiveTableGrid />; 

      case "history": 
        return <OrderHistory />;

      case "logout": 
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            <p className="font-black uppercase tracking-widest italic text-zinc-500">Signing out...</p>
          </div>
        );
      default: 
        return <LiveOrderStatus />; // Default to status if order is locked
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
      
      {/* SIDEBAR - Status and End Shift are always triggers */}
      <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 h-full overflow-y-auto relative">
        
        {/* PERMISSION INDICATOR */}
        <div className="absolute top-6 right-8 z-50">
           <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-[0.1em] shadow-lg transition-all duration-500 ${
             isGranted 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
              : 'bg-zinc-500/10 border-zinc-500/20 text-zinc-500 opacity-50'
           }`}>
             <div className={`w-2 h-2 rounded-full ${isGranted ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
             {isGranted ? 'Ordering Enabled' : 'View Only Mode'}
           </div>
        </div>

        <div className={`${(activeTab === "order" || activeTab === "status") ? "pb-32" : ""}`}>
          {renderContent()}
        </div>
      </main>

      {/* BOTTOM NAVIGATION - Optimized for restricted flow */}
      <nav className={`fixed bottom-0 left-64 right-0 backdrop-blur-md border-t px-12 py-4 pb-8 flex justify-around items-center z-[100] transition-all duration-500 ${
        theme === 'dark' ? 'bg-zinc-900/90 border-white/5' : 'bg-white/80 border-black/5'
      }`}>
        <NavButton 
          active={activeTab === "status"} 
          onClick={() => setActiveTab("status")}
          icon={<Clock size={24} />}
          label="Orders"
          theme={theme}
        />
        <NavButton 
          active={activeTab === "order"} 
          onClick={() => setActiveTab("order")}
          icon={isGranted ? <PlusCircle size={28} /> : <Lock size={24} />}
          label={isGranted ? "New Order" : "Locked"}
          theme={theme}
        />
        <NavButton 
          active={false} 
          onClick={() => setIsShiftModalOpen(true)}
          icon={<Flag size={24} />}
          label="End Shift"
          theme={theme}
        />
      </nav>

      <ShiftReportModal 
        isOpen={isShiftModalOpen} 
        onClose={() => setIsShiftModalOpen(false)} 
      />
    </div>
  );
}

/**
 * UNIVERSAL LOCKED VIEW
 */
function LockedView({ name, theme }) {
  const { currentUser } = useData();
  const [requestSent, setRequestSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sent = localStorage.getItem(`perm_req_${currentUser?.id}`);
    if (sent) setRequestSent(true);
  }, [currentUser?.id]);

  const handleRequestPermission = async () => {
    setLoading(true);
    // Simulating API call for permission
    setTimeout(() => {
      setRequestSent(true);
      localStorage.setItem(`perm_req_${currentUser?.id}`, 'true');
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[80vh] p-12 text-center gap-6 animate-in fade-in zoom-in duration-500">
      <div className={`w-20 h-20 rounded-3xl flex items-center justify-center border transition-all duration-700 ${
        requestSent ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' : 'bg-zinc-500/10 border-white/10 text-zinc-500'
      }`}>
        {requestSent ? <RefreshCcw size={32} className="animate-spin-slow" /> : <Lock size={32} />}
      </div>
      
      <div className="space-y-2">
        <h2 className="text-2xl font-black uppercase tracking-tighter">
          {requestSent ? "Activation Pending" : "Ordering Permission Required"}
        </h2>
        <p className="text-zinc-500 max-w-[320px] leading-relaxed text-[11px] font-bold uppercase tracking-widest">
          {requestSent 
            ? `Hold tight, ${name}. Requesting ordering rights from the Director...`
            : `You can view status and end your shift, but taking new orders requires activation.`
          }
        </p>
      </div>

      {!requestSent && (
        <button 
          onClick={handleRequestPermission}
          disabled={loading}
          className="px-8 py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-yellow-500 transition-all flex items-center gap-2"
        >
          {loading ? <RefreshCcw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          Request Activation
        </button>
      )}
    </div>
  );
}

function NavButton({ icon, label, active, onClick, theme }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
        active ? "text-yellow-500 scale-110" : "text-zinc-500 hover:text-zinc-300"
      }`}>
      {icon}
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}