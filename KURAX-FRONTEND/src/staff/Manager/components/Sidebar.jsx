import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ClipboardList, 
  Target, 
  Clock, 
  LogOut, 
  Flag,
  LayoutDashboard,
  BarChart3,
  Menu,
  X  
} from "lucide-react";
import logo from "../../../customer/assets/images/logo.jpeg";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";

export default function Sidebar({ activeTab, setActiveTab, debtorCount = 0 }) {
  const { theme } = useTheme();
  const { currentUser } = useData();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  // 1. YOUR MANAGER MENU LOGIC
  const menuItems = [
    { id: "order", label: "TAKE ORDER", icon: <ClipboardList size={20} /> },
    { id: "status", label: "VIEW ORDER STATUS", icon: <Clock size={20} /> },
    { 
      id: "tables", 
      label: "LIVE TABLES", 
      icon: <LayoutDashboard size={20} />,
      badge: debtorCount > 0 ? debtorCount : null 
    },
    { id: "reports", label: "SALES REPORTS", icon: <BarChart3 size={20} /> },
    { id: "target", label: "SET TARGET", icon: <Target size={20} /> },
    { id: "shift", label: "END SHIFT", icon: <Flag size={20} /> },
  ];

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    setIsOpen(false); // Close drawer on mobile after selection
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/staff/login'); 
    setIsOpen(false);
  };

  // Reusable Nav Links Component
  const NavLinks = () => (
    <nav className="flex-1 flex flex-col space-y-3 overflow-y-auto pt-4 custom-scrollbar">
      {menuItems.map((item) => (
        <button
          key={item.id}
          onClick={() => handleTabClick(item.id)}
          className={`w-full flex items-center justify-between px-5 py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all border
            ${activeTab === item.id 
              ? "bg-yellow-500 text-black border-yellow-500 shadow-xl shadow-yellow-500/20 scale-[1.02]" 
              : theme === 'dark' 
                ? "text-zinc-500 bg-transparent border-transparent hover:bg-white/5 hover:text-white" 
                : "text-zinc-600 bg-transparent border-transparent hover:bg-black/5 hover:text-black"
            }`}
        >
          <div className="flex items-center gap-4">
            <span className={activeTab === item.id ? "text-black" : "text-yellow-500"}>
              {item.icon}
            </span>
            {item.label}
          </div>
          {item.badge && (
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${
              activeTab === item.id ? "bg-black text-yellow-500" : "bg-rose-500 text-white"
            }`}>
              {item.badge}
            </span>
          )}
        </button>
      ))}
      <div className="h-20 lg:hidden" /> {/* Mobile scroll spacer */}
    </nav>
  );

  return (
    <>
      {/* --- MOBILE TOP BAR (FROM CONTENT MANAGER) --- */}
      <div className={`lg:hidden fixed top-0 left-0 w-full border-b p-4 flex items-center justify-between z-[60] ${
        theme === 'dark' ? 'bg-zinc-950 border-white/5' : 'bg-white border-black/5'
      }`}>
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="w-8 h-8 rounded-full" />
          <div className="flex flex-col">
            <span className={`text-[10px] font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              KURAX LOUNGE
            </span>
            <span className="text-[8px] font-bold text-yellow-500 uppercase italic">Management Portal</span>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(true)}
          className="p-2 bg-yellow-500 text-black rounded-xl"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* --- MOBILE DRAWER (FROM CONTENT MANAGER) --- */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className={`absolute top-0 left-0 w-72 h-full p-6 flex flex-col animate-in slide-in-from-left duration-300 ${
            theme === 'dark' ? 'bg-zinc-950 border-r border-white/5' : 'bg-white border-r border-black/5'
          }`}>
            <div className="flex justify-between items-start mb-8 pb-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <img src={logo} alt="Logo" className="w-10 h-10 rounded-full object-cover" />
                <div className="flex flex-col">
                  <h1 className={`text-xs font-black uppercase tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-black'}`}>MANAGER</h1>
                  <span className="text-[9px] font-bold text-yellow-500 uppercase italic">{currentUser?.name}</span>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="opacity-50 hover:opacity-100">
                <X className="w-6 h-6" />
              </button>
            </div>
            <NavLinks />
            <div className="pt-6 border-t border-white/5">
              <button onClick={handleLogout} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/5">
                <LogOut size={20} /> Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DESKTOP SIDEBAR (YOUR ORIGINAL STYLE) --- */}
      <div className={`hidden lg:flex w-64 h-screen flex-col border-r transition-colors duration-300 sticky top-0 ${
        theme === 'dark' ? 'bg-zinc-950 border-white/5' : 'bg-white border-black/5'
      }`}>
        <div className={`p-6 border-b ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-12 h-12 rounded-full object-cover" />
            <div className="flex flex-col">
              <h1 className={`text-[11px] font-black uppercase tracking-tight leading-none ${theme === 'dark' ? 'text-white' : 'text-black'}`}>KURAX LOUNGE</h1>
              <p className="text-[9px] font-bold text-yellow-500 mt-1 uppercase tracking-widest italic">Management Portal</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4">
          <NavLinks />
        </div>
        <div className={`p-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
          <button onClick={handleLogout} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
            theme === 'dark' ? "text-rose-500 hover:bg-rose-500/10" : "text-rose-600 hover:bg-rose-50/50"
          }`}>
            <LogOut size={20} /> Log Out
          </button>
        </div>
      </div>
    </>
  );
}