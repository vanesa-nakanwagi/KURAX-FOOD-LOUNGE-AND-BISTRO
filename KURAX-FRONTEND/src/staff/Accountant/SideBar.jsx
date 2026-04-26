import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Receipt, Calculator, CheckCircle2, X, LogOut,
  RotateCcw, BookOpen, BarChart3, Wallet, Sparkles, MoreVertical
} from "lucide-react";
import logo from "../../customer/assets/images/logo.jpeg";
import { useTheme } from "../../customer/components/context/ThemeContext";

// Desktop menu items (all items)
const DESKTOP_MENU_ITEMS = [
  { key: "FINANCIAL_HISTORY", label: "Dashboard",    icon: <Receipt size={20}/>     },
  { key: "PHYSICAL_COUNT",    label: "Physical Finances", icon: <Calculator size={20}/>  },
  { key: "LIVE_AUDIT",        label: "Live Audit",        icon: <CheckCircle2 size={20}/> },
  { key: "MONTHLY_COSTS",     label: "Monthly Costs",     icon: <Wallet size={20}/>      },
  { key: "CREDITS",           label: "Credits",           icon: <BookOpen size={20}/>    },
  { key: "VIEW_SALES",        label: "View Sales",        icon: <BarChart3 size={20}/>   },
  { key: "START_NEW_DAY",     label: "Start New Day",     icon: <Sparkles size={20}/>    },
  { key: "REOPEN_DAY",        label: "Reopen Day",        icon: <RotateCcw size={20}/>   },
  { key: "END_OF_SHIFT",      label: "End of Shift",      icon: <RotateCcw size={20}/>   },
];

// Bottom navigation items for mobile (Live Audit and Credits)
const BOTTOM_NAV_ITEMS = [
  { key: "LIVE_AUDIT", label: "Live Audit", icon: <CheckCircle2 size={22}/> },
  { key: "CREDITS",    label: "Credits",    icon: <BookOpen size={22}/> },
];

// Drawer menu items (all items except bottom nav items)
const DRAWER_MENU_ITEMS = DESKTOP_MENU_ITEMS.filter(
  item => !BOTTOM_NAV_ITEMS.some(nav => nav.key === item.key)
);

export default function SideBar({ 
  activeSection, 
  setActiveSection, 
  isOpen, 
  setIsOpen, 
  isDark = false,
  voidCount = 0,
  creditCount = 0
}) {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('kurax_user');
    navigate('/staff/login');
  };

  // ========== MOBILE VIEW ==========
  if (isMobile) {
    return (
      <>
        {/* 3 Vertical Dots / X Button - Changes icon when menu is open */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`fixed top-4 right-4 z-50 p-2 rounded-xl transition-all font-['Outfit'] ${
            isDark 
              ? "bg-zinc-900/90 backdrop-blur-md border border-white/10 text-white" 
              : "bg-white/90 backdrop-blur-md border border-gray-200 text-black shadow-sm"
          }`}
        >
          {isOpen ? <X size={22} /> : <MoreVertical size={22} />}
        </button>

        {/* Mobile Drawer - Slides from right */}
        <div
          className={`fixed inset-0 z-40 transition-all duration-300 ${
            isOpen ? "visible" : "invisible"
          }`}
        >
          {/* Backdrop */}
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${
              isOpen ? "opacity-100 bg-black/50" : "opacity-0"
            }`}
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Content */}
          <div
            className={`absolute right-0 top-0 h-full w-80 transition-transform duration-300 ${
              isOpen ? "translate-x-0" : "translate-x-full"
            } ${
              isDark
                ? "bg-zinc-950 border-l border-white/5"
                : "bg-white border-l border-gray-200 shadow-xl"
            }`}
          >
            {/* Logo and Header Section */}
            <div className={`pt-12 pb-6 px-6 border-b ${isDark ? "border-white/5" : "border-gray-200"}`}>
              <div className="flex items-center gap-3">
                <img
                  src={logo}
                  alt="Logo"
                  className="w-12 h-12 rounded-full object-cover border-2 border-yellow-500/20"
                />
                <div className="flex flex-col">
                  <h1 className={`text-[11px] font-black uppercase tracking-tight leading-none ${
                    isDark ? "text-white" : "text-zinc-900"
                  }`}>
                    KURAX FOOD LOUNGE & BISTRO
                  </h1>
                  <p className="text-[9px] font-bold text-yellow-500 mt-1 uppercase tracking-widest">
                    ACCOUNTANT PANEL
                  </p>
                </div>
              </div>
            </div>

            {/* Scrollable Menu Items */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[calc(100vh-160px)]">
              {DRAWER_MENU_ITEMS.map((item) => {
                let badge = null;
                if (item.key === "LIVE_AUDIT" && voidCount > 0) badge = voidCount;
                if (item.key === "CREDITS" && creditCount > 0) badge = creditCount;
                
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setActiveSection(item.key);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all
                      ${activeSection === item.key
                        ? "bg-yellow-500 text-black"
                        : isDark
                          ? "text-zinc-400 hover:bg-white/5 hover:text-white"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                  >
                    <span className={activeSection === item.key ? "text-black" : "text-yellow-500"}>
                      {item.icon}
                    </span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {badge && (
                      <span className="bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Logout Button */}
            <div className={`p-4 border-t mt-auto ${isDark ? "border-white/5" : "border-gray-200"}`}>
              <button
                onClick={handleLogout}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                  isDark
                    ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "bg-red-50 text-red-600 hover:bg-red-100"
                }`}
              >
                <LogOut size={16} />
                Log Out
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Navigation Bar */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-30 flex justify-around items-center px-3 py-2 border-t backdrop-blur-lg ${
            isDark
              ? "bg-zinc-950/95 border-white/10"
              : "bg-white/95 border-gray-200 shadow-lg"
          }`}
        >
          {BOTTOM_NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.key;
            let badge = null;
            if (item.key === "LIVE_AUDIT" && voidCount > 0) badge = voidCount;
            if (item.key === "CREDITS" && creditCount > 0) badge = creditCount;
            
            return (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all ${
                  isActive
                    ? "bg-yellow-500 text-black"
                    : isDark
                      ? "text-zinc-500 hover:text-white"
                      : "text-gray-600 hover:text-gray-900"
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
                {badge && (
                  <span className={`absolute -top-1 -right-1 min-w-[18px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center
                    ${isActive ? "bg-black text-yellow-500" : "bg-yellow-500 text-black"}`}>
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom padding to prevent content from being hidden */}
        <div className="pb-20" />
      </>
    );
  }

  // ========== DESKTOP VIEW ==========
  return (
    <div
      className={`w-64 h-full flex flex-col border-r transition-colors duration-300 flex-shrink-0 font-['Outfit'] ${
        isDark ? "bg-zinc-950 border-white/5" : "bg-white border-gray-200 shadow-sm"
      }`}
    >
      {/* Logo / header */}
      <div className={`p-6 border-b ${isDark ? "border-white/5" : "border-gray-200"}`}>
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Logo"
            className="w-12 h-12 rounded-full object-cover border-2 border-yellow-500/20"
          />
          <div className="flex flex-col">
            <h1 className={`text-[13px] font-black uppercase tracking-tight leading-tight ${
              isDark ? "text-white" : "text-zinc-900"
            }`}>
              KURAX FOOD LOUNGE & BISTRO
            </h1>
            <p className="text-[9px] font-bold text-yellow-600 mt-1 uppercase tracking-widest">
              ACCOUNTANT PANEL
            </p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {DESKTOP_MENU_ITEMS.map((item) => {
          let badge = null;
          if (item.key === "LIVE_AUDIT" && voidCount > 0) badge = voidCount;
          if (item.key === "CREDITS" && creditCount > 0) badge = creditCount;
          
          return (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all
                ${activeSection === item.key
                  ? "bg-yellow-500 text-black shadow-md"
                  : isDark
                    ? "text-zinc-400 hover:bg-white/5 hover:text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
            >
              <span className={activeSection === item.key ? "text-black" : "text-yellow-500"}>
                {item.icon}
              </span>
              <span className="flex-1 text-left">{item.label}</span>
              {badge && (
                <span className="bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className={`p-4 border-t ${isDark ? "border-white/5" : "border-gray-200"}`}>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
            isDark
              ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
              : "bg-red-50 text-red-600 hover:bg-red-100"
          }`}
        >
          <LogOut size={16} />
          Log Out
        </button>
      </div>
    </div>
  );
}