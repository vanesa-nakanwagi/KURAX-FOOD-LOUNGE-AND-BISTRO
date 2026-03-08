import React, { useState, useEffect } from "react";
import { 
  Lock, PlusCircle, ShieldAlert, 
  ShieldCheck, RefreshCcw, Smartphone,
  Menu as MenuIcon, X, History,
  Zap, Bell
} from "lucide-react"; 

// Component Imports
import NewOrder           from "./NewOrder";
import OrderHistory       from "./OrderHistory";
import TargetSettings     from "./TargetSettings"; 
import Sidebar            from "./Sidebar"; 
import ShiftReportModal   from "./ShiftModal";
import LiveOrderStatus    from "./LiveOrderStatus";
import LiveTableGrid      from "./LiveTableGrid"; 
import PerformanceReports from "./PerformanceReports";

import { useTheme } from "../../../customer/components/context/ThemeContext";
import { useData }  from "../../../customer/components/context/DataContext";

export default function ManagerLayout() {
  const [activeTab, setActiveTab] = useState("order");
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const { theme } = useTheme();
  const { currentUser, isGranted } = useData();
  const isDark = theme === 'dark';

  // --- Content Switcher ---
  const renderContent = () => {
    switch (activeTab) {
      case "order": 
        if (!isGranted) return <LockedView name={currentUser?.name} role={currentUser?.role} theme={theme} />;
        return <NewOrder />;
      case "status":  return <LiveOrderStatus />;
      case "tables":  return <LiveTableGrid />; 
      case "target":  return <TargetSettings />;
      case "history": return <OrderHistory />;
      case "reports": return <PerformanceReports />;
      default:        return <NewOrder />;
    }
  };

  const handleTabChange = (tabId) => {
    if (tabId === "shift") {
      setIsShiftModalOpen(true);
    } else {
      setActiveTab(tabId);
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <div className={`flex h-[100dvh] w-full font-[Outfit] overflow-hidden transition-colors duration-500 ${
      isDark ? 'bg-black text-slate-100' : 'bg-zinc-50 text-zinc-900'
    }`}>
      
      {/* 1. MOBILE HEADER BAR */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 flex items-center px-6 z-[60] bg-transparent">
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2.5 bg-yellow-500 text-black rounded-xl shadow-lg active:scale-90 transition-all"
        >
          <MenuIcon size={20} strokeWidth={3} />
        </button>
      </div>

      {/* 2. SIDEBAR DRAWER (Mobile Overlay) */}
      <div 
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[65] lg:hidden transition-opacity duration-500 ${
          isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside className={`fixed inset-y-0 left-0 z-[70] w-72 transform lg:relative lg:translate-x-0 transition-all duration-500 ease-in-out ${
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} />
      </aside>

      {/* 3. MAIN CONTENT AREA */}
      <main className="flex-1 h-full overflow-y-auto relative flex flex-col min-w-0">
        
        {/* AUTHORIZATION BADGE */}
        <div className="absolute top-6 right-6 z-50">
           <div className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 backdrop-blur-md shadow-xl transition-all ${
             isGranted 
             ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
             : 'bg-rose-500/10 border-rose-500/20 text-rose-500 animate-pulse'
           }`}>
             <div className={`w-1.5 h-1.5 rounded-full ${isGranted ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
             <span className="text-[9px] font-black uppercase tracking-widest leading-none">
               {isGranted ? 'Online' : 'Restricted'}
             </span>
           </div>
        </div>

        {/* Dynamic Content */}
        <div className={`flex-1 ${(activeTab === "order" || activeTab === "history") ? "pb-32" : "pb-10"}`}>
          {renderContent()}
        </div>
      </main>

      {/* 4. FOOTER TABS (Matched to your reference image) */}
      {(activeTab === "order" || activeTab === "history") && (
        <nav className={`fixed bottom-0 left-0 lg:left-72 right-0 px-10 py-4 pb-8 flex justify-center items-center gap-16 md:gap-32 z-[100] border-t ${
          isDark ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-black/5 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]'
        }`}>
          <NavButton 
            active={activeTab === "order"} 
            onClick={() => setActiveTab("order")}
            icon={<PlusCircle size={22} strokeWidth={2.5} />}
            label="Take Order"
          />
          
          <NavButton 
            active={activeTab === "history"} 
            onClick={() => setActiveTab("history")}
            icon={<History size={22} strokeWidth={2.5} />}
            label="History"
          />
        </nav>
      )}

      <ShiftReportModal isOpen={isShiftModalOpen} onClose={() => setIsShiftModalOpen(false)} />
    </div>
  );
}

/**
 * CUSTOM NAV BUTTON
 * Replicates the circular border and bold typography from your screenshot
 */
function NavButton({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex flex-col items-center gap-2 transition-all duration-300 min-w-[90px] ${
        active ? "text-yellow-500" : "text-zinc-600 opacity-60 hover:opacity-100"
      }`}
    >
      <div className={`p-1.5 rounded-full border-2 transition-all duration-300 ${
        active ? "border-yellow-500 scale-110 shadow-[0_0_15px_rgba(234,179,8,0.3)]" : "border-transparent"
      }`}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-center leading-none">
        {label}
      </span>
    </button>
  );
}

/**
 * REWRITTEN LOCKED VIEW
 * Aesthetic permission request screen
 */
function LockedView({ name, role, theme }) {
  const { currentUser } = useData();
  const [requestSent, setRequestSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(`perm_req_${currentUser?.id}`)) setRequestSent(true);
  }, [currentUser?.id]);

  const handleRequest = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/staff/request-permission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: currentUser.id, staffName: currentUser.name })
      });
      if (res.ok) {
        setRequestSent(true);
        localStorage.setItem(`perm_req_${currentUser?.id}`, 'true');
      }
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[75vh] p-8 text-center animate-in fade-in duration-700">
      <div className="relative mb-8">
        <div className={`w-28 h-28 rounded-[2.5rem] flex items-center justify-center border-2 transition-all duration-700 rotate-6 ${
          requestSent ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
        }`}>
          {requestSent ? <ShieldCheck size={48} className="animate-pulse" /> : <Lock size={48} />}
        </div>
        <div className="absolute -top-1 -right-1 p-2.5 rounded-2xl bg-black border border-white/10">
           <Zap className={requestSent ? "text-emerald-500" : "text-yellow-500"} size={20} />
        </div>
      </div>
      
      <div className="space-y-2 mb-10">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter">
          {requestSent ? "Signal Sent" : "Access Locked"}
        </h2>
        <p className="text-zinc-500 max-w-[300px] mx-auto text-[10px] font-bold uppercase tracking-[0.2em] leading-relaxed opacity-60">
          {requestSent 
            ? "Your request is live. Wait for the Director to grant ordering power."
            : `Hey ${name?.split(' ')[0]}, digital authorization is required for ${role}s to take orders.`}
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-[280px]">
        {!requestSent ? (
          <button 
            onClick={handleRequest}
            disabled={loading}
            className="px-6 py-5 bg-yellow-500 text-black rounded-3xl text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {loading ? <RefreshCcw size={16} className="animate-spin" /> : <Bell size={16} />}
            Request Power
          </button>
        ) : (
          <div className="px-6 py-5 bg-emerald-500/10 text-emerald-500 border-2 border-emerald-500/20 rounded-3xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
            <RefreshCcw size={14} className="animate-spin" /> Awaiting Sync
          </div>
        )}
      </div>
    </div>
  );
}