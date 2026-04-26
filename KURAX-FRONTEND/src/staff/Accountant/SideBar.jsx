import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Receipt, Calculator, CheckCircle2, X, LogOut,
  RotateCcw, BookOpen, BarChart3, Wallet, Sparkles, Menu, AlertTriangle
} from "lucide-react";
import logo from "../../customer/assets/images/logo.jpeg";

export default function SideBar({ 
  activeSection, 
  setActiveSection, 
  isOpen, 
  setIsOpen, 
  isDark,
  voidCount = 0,
  creditCount = 0
}) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('kurax_user');
    navigate('/staff/login');
  };

  // Desktop menu items (all items)
  const desktopMenuItems = [
    { key: "FINANCIAL_HISTORY", label: "My Collections",    icon: <Receipt size={20}/>     },
    { key: "PHYSICAL_COUNT",    label: "Physical Finances", icon: <Calculator size={20}/>  },
    { key: "LIVE_AUDIT",        label: "Live Audit",        icon: <CheckCircle2 size={20}/>, badge: voidCount },
    { key: "MONTHLY_COSTS",     label: "Monthly Costs",     icon: <Wallet size={20}/>      },
    { key: "CREDITS",           label: "Credits",           icon: <BookOpen size={20}/>,    badge: creditCount },
    { key: "VIEW_SALES",        label: "View Sales",        icon: <BarChart3 size={20}/>   },
    { key: "START_NEW_DAY",     label: "Start New Day",     icon: <Sparkles size={20}/>    },
    { key: "REOPEN_DAY",        label: "Reopen Day",        icon: <RotateCcw size={20}/>   },
    { key: "END_OF_SHIFT",      label: "End of Shift",      icon: <RotateCcw size={20}/>   },
  ];

  // Bottom navigation items for mobile (Live Audit and Credits)
  const bottomNavItems = [
    { key: "LIVE_AUDIT", label: "Live Audit", icon: <CheckCircle2 size={22}/>, badge: voidCount },
    { key: "CREDITS",    label: "Credits",    icon: <BookOpen size={22}/>,     badge: creditCount },
  ];

  // Drawer menu items (all items except the ones in bottom nav)
  const drawerMenuItems = desktopMenuItems.filter(
    item => !bottomNavItems.some(nav => nav.key === item.key)
  );

  // Dynamic classes based on theme
  const sidebarBgClass = isDark ? "bg-zinc-950 border-white/5" : "bg-white border-gray-200 shadow-sm";
  const textClass = isDark ? "text-white" : "text-gray-900";
  const activeButtonClass = isDark 
    ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/10" 
    : "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20";
  const inactiveButtonClass = isDark 
    ? "text-zinc-500 hover:bg-white/5 hover:text-white" 
    : "text-gray-600 hover:bg-yellow-50 hover:text-yellow-700";
  const dividerClass = isDark ? "border-white/5" : "border-gray-200";
  const logoutButtonClass = isDark 
    ? "text-zinc-600 hover:text-rose-500 bg-red-500/10 border-red-500/20 hover:bg-red-500/20" 
    : "text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100";
  const mobileDrawerBgClass = isDark ? "bg-black/95" : "bg-white";
  const mobileButtonClass = (isActive) => {
    if (isActive) {
      return "bg-yellow-500 text-black border-yellow-500";
    }
    return isDark 
      ? "bg-zinc-900/50 text-zinc-400 border-white/5" 
      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-yellow-50 hover:text-yellow-700";
  };
  
  // Scrollbar styling based on theme
  const scrollbarClass = isDark 
    ? "scrollbar-thin scrollbar-track-zinc-800 scrollbar-thumb-zinc-600 hover:scrollbar-thumb-zinc-500"
    : "scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400";

  return (
    <>
      {/* ── MOBILE DRAWER ICON (3 lines) ── */}
      <button
        onClick={() => setIsOpen(true)}
        className={`lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl transition-all ${
          isDark
            ? "bg-zinc-900/90 backdrop-blur-md border border-white/10 text-white"
            : "bg-gray-100/90 backdrop-blur-md border border-gray-200 text-gray-800"
        }`}
      >
        <Menu size={22} />
      </button>

      {/* ── MOBILE DRAWER ── */}
      {isOpen && (
        <div className={`fixed inset-0 z-[150] ${mobileDrawerBgClass} backdrop-blur-xl flex flex-col p-6 lg:hidden animate-in slide-in-from-left duration-300`}>
          {/* Header - Fixed at top */}
          <div className="flex justify-between items-center mb-6 flex-shrink-0">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="w-10 h-10 rounded-full border border-yellow-500/30"/>
              <div>
                <h1 className={`text-xs font-black uppercase tracking-tighter ${textClass}`}>KURAX BISTRO</h1>
                <p className="text-yellow-600 text-[8px] font-bold uppercase">Accountant Panel</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className={`p-3 rounded-full transition-all duration-300 ${isDark ? "bg-zinc-900 text-zinc-400" : "bg-gray-100 text-gray-600"}`}>
              <X size={20}/>
            </button>
          </div>

          {/* Scrollable Menu Section */}
          <div className={`flex-1 overflow-y-auto py-4 ${scrollbarClass}`}>
            <div className="space-y-3">
              {drawerMenuItems.map(item => (
                <button
                  key={item.key}
                  onClick={() => { setActiveSection(item.key); setIsOpen(false); }}
                  className={`flex items-center gap-4 w-full p-5 rounded-2xl font-black uppercase text-xs tracking-widest border transition-all duration-300 ${mobileButtonClass(activeSection === item.key)}`}
                >
                  {item.icon}
                  {item.label}
                  {item.badge > 0 && (
                    <span className="ml-auto bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
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
                  : "text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100"}`}
            >
              <LogOut size={20}/> Logout
            </button>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAVIGATION BAR (Mobile Only) - Live Audit & Credits ── */}
      <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center px-2 py-3 border-t backdrop-blur-lg ${
        isDark
          ? "bg-zinc-950/95 border-white/10"
          : "bg-white/95 border-gray-200"
      }`}>
        {bottomNavItems.map((item) => {
          const isActive = activeSection === item.key;
          return (
            <button
              key={item.key}
              onClick={() => {
                setActiveSection(item.key);
              }}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all flex-1 max-w-[120px] ${
                isActive
                  ? "bg-yellow-500 text-black"
                  : isDark
                    ? "hover:bg-white/5 text-zinc-500 hover:text-white"
                    : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              }`}
            >
              <span className={isActive ? "text-black" : "text-yellow-500"}>
                {item.icon}
              </span>
              <span className={`text-[9px] font-black uppercase tracking-wider ${
                isActive ? "text-black" : ""
              }`}>
                {item.label}
              </span>
              {item.badge > 0 && (
                <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center
                  ${isActive ? "bg-black text-yellow-500" : "bg-yellow-500 text-black"}`}>
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom padding for mobile to prevent content from being hidden */}
      <div className="lg:hidden pb-20" />

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className={`hidden lg:flex flex-col w-72 ${sidebarBgClass} border-r h-screen sticky top-0 transition-all duration-300`}>
        {/* Logo Section - Fixed at top */}
        <div className="p-8 flex-shrink-0">
          <div className="flex items-center gap-3 mb-10">
            <img src={logo} alt="logo" className="w-10 h-10 rounded-full object-cover border border-yellow-500/30 shadow-sm"/>
            <div className="flex flex-col">
              <h1 className={`text-sm font-black uppercase tracking-tighter ${textClass}`}>KURAX FOOD LOUNGE &amp; BISTRO</h1>
              <p className="text-yellow-600 text-[9px] font-bold uppercase tracking-widest">Accountant Panel</p>
            </div>
          </div>
        </div>

        {/* Scrollable Menu Section */}
        <div className={`flex-1 overflow-y-auto px-4 pb-4 ${scrollbarClass}`}>
          <nav className="space-y-2">
            {desktopMenuItems.map(item => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={`flex items-center gap-4 w-full p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all duration-300
                  ${activeSection === item.key ? activeButtonClass : inactiveButtonClass}`}
              >
                <span className={activeSection === item.key ? "text-black" : ""}>
                  {item.icon}
                </span>
                {item.label}
                {item.badge > 0 && (
                  <span className="ml-auto bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
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
                : "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"}`}
          >
            <LogOut size={16}/> Logout
          </button>
        </div>
      </aside>
    </>
  );
}