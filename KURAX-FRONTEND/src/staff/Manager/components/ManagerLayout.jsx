import React, { useState, useEffect } from "react";
import { 
  Lock, PlusCircle, Receipt, ShieldAlert, 
  ShieldCheck, RefreshCcw, LayoutDashboard, 
  Users, BarChart3, Target, History, Smartphone 
} from "lucide-react"; 

// Component Imports (Adjust paths as necessary)
import NewOrder from "./NewOrder";
import OrderHistory from "./OrderHistory";
import TargetSettings from "./TargetSettings"; 
import Sidebar from "./Sidebar"; 
import ShiftReportModal from "./ShiftModal";
import LiveOrderStatus from "./LiveOrderStatus";
import LiveTableGrid from "./LiveTableGrid"; 
import PerformanceReports from "./PerformanceReports";

import { useTheme } from "../../../customer/components/context/ThemeContext";
import { useData } from "../../../customer/components/context/DataContext";

export default function ManagerLayout() {
  const [activeTab, setActiveTab] = useState("order");
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  
  const { theme } = useTheme();
  const { currentUser, isGranted } = useData();

  /**
   * Content Resolver
   * Allows full access to all tabs EXCEPT "order", 
   * which shows a lock screen if is_permitted is false.
   */
  const renderContent = () => {
    switch (activeTab) {
      case "order": 
        if (!isGranted) {
          return (
            <LockedView 
              name={currentUser?.name} 
              role={currentUser?.role} 
              theme={theme} 
            />
          );
        }
        return <NewOrder />;

      case "status": 
        return <LiveOrderStatus />;
      case "tables": 
        return <LiveTableGrid />; 
      case "target": 
        return <TargetSettings />;
      case "history": 
        return <OrderHistory />;
      case "reports": 
        return <PerformanceReports />;
      case "logout": 
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            <p className="font-black uppercase tracking-widest italic text-zinc-500">Signing out...</p>
          </div>
        );
      default: 
        return <NewOrder />;
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
      
      {/* SIDEBAR - Always visible */}
      <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 h-full overflow-y-auto relative">
        
        {/* LIVE STATUS BADGE */}
        <div className="absolute top-6 right-8 z-50">
           <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-[0.1em] shadow-lg transition-all duration-500 ${
             isGranted 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-500 animate-pulse'
           }`}>
             <div className={`w-2 h-2 rounded-full ${isGranted ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
             {isGranted ? 'Ordering Active' : 'Ordering Restricted'}
           </div>
        </div>

        <div className={`${(activeTab === "order" || activeTab === "history") ? "pb-32" : ""}`}>
          {renderContent()}
        </div>
      </main>

      {/* BOTTOM NAVIGATION - Always visible for quick access */}
      {(activeTab === "order" || activeTab === "history") && (
        <nav className={`fixed bottom-0 left-64 right-0 backdrop-blur-md border-t px-12 py-4 pb-8 flex justify-around items-center z-[100] transition-all duration-500 ${
          theme === 'dark' ? 'bg-zinc-900/90 border-white/5' : 'bg-white/80 border-black/5'
        }`}>
          <NavButton 
            active={activeTab === "order"} 
            onClick={() => setActiveTab("order")}
            icon={<PlusCircle size={26} />}
            label="Take Order"
            theme={theme}
          />
          <NavButton 
            active={activeTab === "history"} 
            onClick={() => setActiveTab("history")}
            icon={<Receipt size={26} />}
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

/**
 * NEW IMPROVED LOCKED VIEW
 * Includes Permission Request Logic
 */
function LockedView({ name, role, theme }) {
  const { currentUser } = useData();
  const [requestSent, setRequestSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if a request was already sent in this session
  useEffect(() => {
    const sent = localStorage.getItem(`perm_req_${currentUser?.id}`);
    if (sent) setRequestSent(true);
  }, [currentUser?.id]);

  const handleRequestPermission = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/staff/request-permission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          staffId: currentUser.id, 
          staffName: currentUser.name 
        })
      });

      if (response.ok) {
        setRequestSent(true);
        localStorage.setItem(`perm_req_${currentUser?.id}`, 'true');
      }
    } catch (err) {
      console.error("Request failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const displayRole = role ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() : "Staff Member";

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[80vh] p-12 text-center gap-6 animate-in fade-in zoom-in duration-500">
      <div className="relative">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center border transition-all duration-700 ${
          requestSent 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
        }`}>
          {requestSent ? <ShieldCheck size={48} className="animate-bounce" /> : <Lock size={48} />}
        </div>
        <div className="absolute -bottom-2 -right-2 bg-white dark:bg-black p-1 rounded-full">
           <ShieldAlert className={requestSent ? "text-emerald-500" : "text-rose-500"} size={24} />
        </div>
      </div>
      
      <div className="space-y-2">
        <h2 className="text-3xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white">
          {requestSent ? "Request Pending" : "Ordering Locked"}
        </h2>
        <p className="text-zinc-500 max-w-[360px] leading-relaxed text-sm">
          {requestSent 
            ? `We've notified the Director that you are ready to take orders. Please wait for activation.`
            : `Hey ${name}, your access as a ${displayRole} allows dashboard oversight, but ordering requires Director approval.`
          }
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-[280px]">
        {!requestSent ? (
          <button 
            onClick={handleRequestPermission}
            disabled={loading}
            className="px-6 py-4 bg-yellow-500 text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCcw size={14} className="animate-spin" /> : <Smartphone size={14} />}
            Request Ordering Power
          </button>
        ) : (
          <div className="px-6 py-4 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2">
            <ShieldCheck size={14} /> Notification Sent
          </div>
        )}
        
        <button 
          onClick={() => window.location.reload()}
          className="text-[9px] text-zinc-400 uppercase font-black tracking-widest hover:text-zinc-600 transition-colors"
        >
          Refresh Status
        </button>
      </div>
    </div>
  );
}

/**
 * NavButton Helper
 */
function NavButton({ icon, label, active, onClick, theme }) {
  const inactiveColor = theme === 'dark' ? "text-slate-500" : "text-zinc-400";
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 transition-all duration-300 group ${
        active ? "text-yellow-500 scale-110" : `${inactiveColor} hover:text-zinc-600 dark:hover:text-slate-300`
      }`}
    >
      <div className={`${active ? "drop-shadow-[0_0_12px_rgba(234,179,8,0.5)]" : "group-hover:scale-110 transition-transform"}`}>
        {icon}
      </div>
      <span className="text-[11px] font-black uppercase tracking-tight">{label}</span>
    </button>
  );
}