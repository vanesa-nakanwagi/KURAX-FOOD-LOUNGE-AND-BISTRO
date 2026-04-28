import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Bike, RotateCcw, LogOut, X, Wallet, BookOpen, Menu
} from "lucide-react";
import logo from "../../customer/assets/images/logo.jpeg";
import { useTheme } from "../../customer/components/context/ThemeContext";
import { useData } from "../../customer/components/context/DataContext";

// ✅ Store component FUNCTIONS, not JSX
const MENU_ITEMS = [
  { id: "PENDING",     label: "My Collection",  icon: LayoutDashboard },
  { id: "CLOSED",      label: "Order Status",   icon: RotateCcw },
  { id: "CREDITS",     label: "Credit Ledger",  icon: BookOpen },
  { id: "PETTY CASH",  label: "Log Petty Cash", icon: Wallet },
  { id: "DELIVERIES",  label: "Riders",         icon: Bike },
];

// Bottom navigation items for mobile (first two items as example; adjust as needed)
const BOTTOM_NAV_ITEMS = [
  { id: "PENDING",    label: "Collect", icon: LayoutDashboard },
  { id: "DELIVERIES", label: "Riders",  icon: Bike },
];

// Drawer menu items (all except bottom nav items)
const DRAWER_MENU_ITEMS = MENU_ITEMS.filter(
  item => !BOTTOM_NAV_ITEMS.some(nav => nav.id === item.id)
);

export default function SideBar({ 
  activeSection, 
  setActiveSection, 
  isOpen, 
  setIsOpen, 
  onEndShift,
  stats,
  deliveryBadge = 0,
  creditBadge   = 0,
}) {
  const { theme } = useTheme();
  const { currentUser } = useData();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);

  const isDark = theme === "dark";
  const fullName = currentUser?.name || "Cashier";
  const firstName = fullName.split(" ")[0];

  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("kurax_user");
    navigate("/staff/login");
  };

  // Unified NavButton – receives component function, not JSX
  const NavButton = ({ item, showLabel = true, onClick, isActive, badge }) => {
    const Icon = item.icon;
    return (
      <button
        onClick={onClick}
        className={`
          w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all
          ${showLabel ? "justify-start" : "justify-center"}
          ${isActive
            ? "bg-yellow-500 text-black shadow-sm shadow-yellow-500/20"
            : isDark
              ? "text-zinc-500 hover:bg-white/5 hover:text-white"
              : "text-gray-600 hover:bg-gray-100"
          }
        `}
      >
        <Icon size={18} className={isActive ? "text-black" : "text-yellow-500"} />
        {showLabel && <span className="truncate">{item.label}</span>}
        {badge > 0 && (
          <span className={`ml-auto px-1.5 py-0.5 rounded-full text-[8px] font-black shrink-0
            ${isActive ? "bg-black text-yellow-500" : "bg-yellow-500 text-black"}`}>
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>
    );
  };

  // Helper to get badge for an item
  const getBadge = (itemId) => {
    if (itemId === "DELIVERIES") return deliveryBadge;
    if (itemId === "CREDITS") return creditBadge;
    return 0;
  };

  // ========== MOBILE VIEW ==========
  if (isMobile) {
    return (
      <>
        {/* Floating menu button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`fixed top-4 right-4 z-50 p-2 rounded-xl transition-all ${
            isDark
              ? "bg-zinc-900/90 backdrop-blur-md border border-white/10 text-white"
              : "bg-white/90 backdrop-blur-md border border-gray-200 text-gray-700 shadow-sm"
          }`}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Mobile Drawer */}
        <div className={`fixed inset-0 z-40 transition-all duration-300 ${isOpen ? "visible" : "invisible"}`}>
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${isOpen ? "opacity-100 bg-black/70 backdrop-blur-sm" : "opacity-0"}`}
            onClick={() => setIsOpen(false)}
          />
          <div
            className={`absolute right-0 top-0 h-full w-72 transition-transform duration-300 flex flex-col shadow-2xl
              ${isOpen ? "translate-x-0" : "translate-x-full"}
              ${isDark ? "bg-zinc-950 border-l border-white/5" : "bg-white border-l border-gray-200"}`}
          >
            {/* Drawer header */}
            <div className={`flex items-center gap-3 p-5 border-b ${isDark ? "border-white/5" : "border-gray-200"}`}>
              <img src={logo} alt="Kurax" className="w-10 h-10 rounded-xl object-cover border border-yellow-500/30" />
              <div>
                <p className={`text-[11px] font-black uppercase tracking-tighter leading-none
                  ${isDark ? "text-white" : "text-gray-900"}`}>KURAX FOOD LOUNGE</p>
                <p className={`text-[8px] font-bold uppercase tracking-widest mt-0.5
                  ${isDark ? "text-yellow-500" : "text-yellow-600"}`}>CASHIER PANEL</p>
              </div>
            </div>

           

            {/* Drawer menu items */}
            <nav className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
              {DRAWER_MENU_ITEMS.map(item => (
                <NavButton
                  key={item.id}
                  item={item}
                  showLabel={true}
                  isActive={activeSection === item.id}
                  onClick={() => { setActiveSection(item.id); setIsOpen(false); }}
                  badge={getBadge(item.id)}
                />
              ))}
            </nav>

            {/* Logout in drawer */}
            <div className={`p-4 border-t ${isDark ? "border-white/5" : "border-gray-200"}`}>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-white/5"
              >
                <LogOut size={18} /> Logout
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Navigation Bar (two items) */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-30 flex justify-around items-center px-3 py-2 border-t backdrop-blur-lg
            ${isDark ? "bg-zinc-950/95 border-white/10" : "bg-white/95 border-gray-200 shadow-lg"}`}
          style={{ paddingBottom: "env(safe-area-inset-bottom, 6px)" }}
        >
          {BOTTOM_NAV_ITEMS.map(item => {
            const isActive = activeSection === item.id;
            const Icon = item.icon;
            const badge = getBadge(item.id);
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all
                  ${isActive
                    ? "bg-yellow-500 text-black"
                    : isDark
                      ? "text-zinc-500 hover:text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
              >
                <Icon size={20} className={isActive ? "text-black" : "text-yellow-500"} />
                <span className="text-[8px] font-black uppercase tracking-wide">{item.label}</span>
                {badge > 0 && (
                  <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[8px] font-black flex items-center justify-center
                    ${isActive ? "bg-black text-yellow-500" : "bg-yellow-500 text-black"}`}>
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom spacing */}
        <div className="pb-20" />
      </>
    );
  }

  // ========== DESKTOP VIEW ==========
  return (
    <div
      className={`w-64 h-screen flex flex-col border-r transition-colors duration-300
        ${isDark ? "bg-zinc-950 border-white/5" : "bg-white border-gray-200"}`}
    >
      {/* Logo header – unified */}
      <div className={`flex items-center gap-3 p-5 border-b ${isDark ? "border-white/5" : "border-gray-200"}`}>
        <img src={logo} alt="Kurax" className="w-10 h-10 rounded-xl object-cover border border-yellow-500/30 shrink-0" />
        <div className="min-w-0">
          <p className={`text-[11px] font-black uppercase tracking-tighter leading-none truncate
            ${isDark ? "text-white" : "text-gray-900"}`}>
            KURAX FOOD LOUNGE
          </p>
          <p className={`text-[8px] font-bold uppercase tracking-widest mt-0.5
            ${isDark ? "text-yellow-500" : "text-yellow-600"}`}>
            CASHIER PANEL
          </p>
        </div>
      </div>

   

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {MENU_ITEMS.map(item => (
          <NavButton
            key={item.id}
            item={item}
            showLabel={true}
            isActive={activeSection === item.id}
            onClick={() => setActiveSection(item.id)}
            badge={getBadge(item.id)}
          />
        ))}
      </nav>

      {/* Logout – unified */}
      <div className={`px-3 pb-5 pt-3 border-t ${isDark ? "border-white/5" : "border-gray-200"}`}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-white/5"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
}