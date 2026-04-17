import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Receipt, Calculator, CheckCircle2, X, LogOut,
  RotateCcw, BookOpen, BarChart3, Wallet
} from "lucide-react";
import logo from "../../customer/assets/images/logo.jpeg";

export default function SideBar({ activeSection, setActiveSection, isOpen, setIsOpen, isDark }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('kurax_user');
    navigate('/staff/login');
  };

  const menuItems = [
    { key: "FINANCIAL_HISTORY", label: "My Collections",    icon: <Receipt size={20}/>     },
    { key: "PHYSICAL_COUNT",    label: "Physical Finances", icon: <Calculator size={20}/>  },
    { key: "LIVE_AUDIT",        label: "Live Audit",        icon: <CheckCircle2 size={20}/> },
    { key: "MONTHLY_COSTS",     label: "Monthly Costs",     icon: <Wallet size={20}/>      },
    { key: "CREDITS",           label: "Credits",           icon: <BookOpen size={20}/>    },
    { key: "VIEW_SALES",        label: "View Sales",        icon: <BarChart3 size={20}/>   },
    { key: "END_OF_SHIFT",      label: "End of Shift",      icon: <RotateCcw size={20}/>   },
  ];

  // Dynamic classes based on theme (from dashboard)
  const sidebarBgClass = isDark ? "bg-zinc-950 border-white/5" : "bg-white border-gray-200";
  const textClass = isDark ? "text-white" : "text-gray-900";
  const activeButtonClass = isDark 
    ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/10" 
    : "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20";
  const inactiveButtonClass = isDark 
    ? "text-zinc-500 hover:bg-white/5 hover:text-white" 
    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900";
  const dividerClass = isDark ? "border-white/5" : "border-gray-200";
  const logoutButtonClass = isDark 
    ? "text-zinc-600 hover:text-rose-500" 
    : "text-gray-500 hover:text-rose-500";
  const mobileDrawerBgClass = isDark ? "bg-black/95" : "bg-white/95";
  const mobileButtonClass = (isActive) => {
    if (isActive) {
      return "bg-yellow-500 text-black border-yellow-500";
    }
    return isDark 
      ? "bg-zinc-900/50 text-zinc-400 border-white/5" 
      : "bg-gray-100 text-gray-600 border-gray-200";
  };
  
  // Scrollbar styling based on theme
  const scrollbarClass = isDark 
    ? "scrollbar-thin scrollbar-track-zinc-800 scrollbar-thumb-zinc-600 hover:scrollbar-thumb-zinc-500"
    : "scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400";

  return (
    <>
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className={`hidden lg:flex flex-col w-72 ${sidebarBgClass} border-r h-screen sticky top-0 transition-all duration-300`}>
        {/* Logo Section - Fixed at top */}
        <div className="p-8 flex-shrink-0">
          <div className="flex items-center gap-3 mb-10">
            <img src={logo} alt="logo" className="w-10 h-10 rounded-full object-cover border border-yellow-500/20"/>
            <div className="flex flex-col">
              <h1 className={`text-sm font-black uppercase tracking-tighter ${textClass}`}>KURAX FOOD LOUNGE &amp; BISTRO</h1>
              <p className="text-yellow-500 text-[9px] font-bold uppercase tracking-widest">Accountant Panel</p>
            </div>
          </div>
        </div>

        {/* Scrollable Menu Section */}
        <div className={`flex-1 overflow-y-auto px-4 pb-4 ${scrollbarClass}`}>
          <nav className="space-y-2">
            {menuItems.map(item => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={`flex items-center gap-4 w-full p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all duration-300
                  ${activeSection === item.key ? activeButtonClass : inactiveButtonClass}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Footer Section - Fixed at bottom */}
        <div className={`flex-shrink-0 p-8 border-t ${dividerClass}`}>
          <button 
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full p-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all duration-300
              ${isDark 
                ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20" 
                : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"}`}
          >
            <LogOut size={16}/> Logout
          </button>
        </div>
      </aside>

      {/* ── MOBILE DRAWER ── */}
      {isOpen && (
        <div className={`fixed inset-0 z-[150] ${mobileDrawerBgClass} backdrop-blur-xl flex flex-col p-6 lg:hidden animate-in fade-in duration-300`}>
          {/* Header - Fixed at top */}
          <div className="flex justify-between items-center mb-6 flex-shrink-0">
            <img src={logo} alt="Logo" className="w-10 h-10 rounded-full"/>
            <button onClick={() => setIsOpen(false)} className={`p-3 rounded-full transition-all duration-300 ${isDark ? "bg-zinc-900 text-zinc-400" : "bg-gray-100 text-gray-600"}`}>
              <X size={20}/>
            </button>
          </div>

          {/* Scrollable Menu Section */}
          <div className={`flex-1 overflow-y-auto py-4 ${scrollbarClass}`}>
            <div className="space-y-3">
              {menuItems.map(item => (
                <button
                  key={item.key}
                  onClick={() => { setActiveSection(item.key); setIsOpen(false); }}
                  className={`flex items-center gap-4 w-full p-5 rounded-2xl font-black uppercase text-xs tracking-widest border transition-all duration-300 ${mobileButtonClass(activeSection === item.key)}`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Footer - Fixed at bottom */}
          <div className={`flex-shrink-0 pt-6 border-t ${dividerClass}`}>
            <button 
              onClick={handleLogout}
              className={`flex items-center gap-4 w-full p-5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all duration-300
                ${isDark 
                  ? "text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20" 
                  : "text-red-600 bg-red-50 border border-red-200 hover:bg-red-100"}`}
            >
              <LogOut size={20}/> Logout
            </button>
          </div>
        </div>
      )}
    </>
  );
}