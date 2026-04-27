import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ClipboardList, Target, Clock, LogOut, History, LayoutGrid, 
  MoreVertical, X 
} from "lucide-react";
import logo from "../../../customer/assets/images/logo.jpeg";
import { useData }  from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";

const DEFAULT_MENU = [
  { id: "order",   label: "TAKE ORDER",         icon: <ClipboardList size={20} /> },
  { id: "status",  label: "VIEW ORDER STATUS",  icon: <Clock size={20} /> },
  { id: "history", label: "PERFORMANCE HUB ",       icon: <History size={20} /> },
  { id: "tables",  label: "MANAGE TABLE",       icon: <LayoutGrid size={20} /> },
  { id: "targets", label: "SET STAFF TARGETS",  icon: <Target size={20} /> },
];

// Bottom navigation items for mobile - VIEW ORDER STATUS and SET STAFF TARGETS
const BOTTOM_NAV_ITEMS = [
  { id: "status", label: "ORDER STATUS", icon: <Clock size={22} /> },
  { id: "targets", label: "STAFF TARGETS", icon: <Target size={22} /> },
];

// Drawer menu items (all items except bottom nav items)
const DRAWER_MENU_ITEMS = DEFAULT_MENU.filter(
  item => !BOTTOM_NAV_ITEMS.some(nav => nav.id === item.id)
);

export default function Sidebar({ activeTab, setActiveTab, menuItems }) {
  const { theme } = useTheme();
  const { currentUser } = useData();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isDark = theme === "dark";

  const items = menuItems || DEFAULT_MENU;

  // Check screen size for mobile
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Handle click outside to close drawer
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isMenuOpen && !e.target.closest(".mobile-drawer")) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const userName = currentUser?.name || "Manager";
  const firstName = userName.split(" ")[0].toUpperCase();
  const initial = userName.charAt(0).toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("kurax_user");
    navigate("/staff/login");
  };

  // ========== MOBILE VIEW ==========
  if (isMobile) {
    return (
      <>
        {/* 3 Vertical Dots / X Button - Changes icon when menu is open */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`fixed top-4 right-4 z-50 p-2 rounded-xl transition-all ${
            isDark
              ? "bg-zinc-900/90 backdrop-blur-md border border-white/10 text-white"
              : "bg-white/90 backdrop-blur-md border border-gray-200 text-black shadow-sm"
          }`}
        >
          {isMenuOpen ? <X size={22} /> : <MoreVertical size={22} />}
        </button>

        {/* Mobile Drawer - Slides from right */}
        <div
          className={`fixed inset-0 z-40 transition-all duration-300 mobile-drawer ${
            isMenuOpen ? "visible" : "invisible"
          }`}
        >
          {/* Backdrop */}
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${
              isMenuOpen ? "opacity-100 bg-black/50" : "opacity-0"
            }`}
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div
            className={`absolute right-0 top-0 h-full w-80 transition-transform duration-300 ${
              isMenuOpen ? "translate-x-0" : "translate-x-full"
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
                    KURAX LOUNGE FOOD LOUNGE & BISTRO
                  </h1>
                  <p className="text-[9px] font-bold text-yellow-500 mt-1 uppercase tracking-widest">
                    MANAGEMENT PORTAL
                  </p>
                </div>
              </div>
            </div>

            {/* Scrollable Menu Items */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[calc(100vh-160px)]">
              {DRAWER_MENU_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all
                    ${activeTab === item.id
                      ? "bg-yellow-500 text-black"
                      : isDark
                        ? "text-zinc-400 hover:bg-white/5 hover:text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                >
                  <span className={activeTab === item.id ? "text-black" : "text-yellow-500"}>
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Logout Button */}
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
        </div>

        {/* Bottom Navigation Bar - ORDER STATUS and STAFF TARGETS */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-30 flex justify-around items-center px-3 py-2 border-t backdrop-blur-lg ${
            isDark
              ? "bg-zinc-950/95 border-white/10"
              : "bg-white/95 border-gray-200 shadow-lg"
          }`}
        >
          {BOTTOM_NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
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
                <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider ${
                  isActive ? "text-black" : ""
                }`}>
                  {item.label}
                </span>
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
      className={`w-64 h-screen flex flex-col border-r transition-colors duration-300 ${
        isDark ? "bg-zinc-950 border-white/5" : "bg-white border-black/5"
      }`}
    >
      {/* Logo / header */}
      <div className={`p-6 border-b ${isDark ? "border-white/5" : "border-black/5"}`}>
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
              KURAX LOUNGE FOOD LOUNGE & BISTRO
            </h1>
            <p className="text-[9px] font-bold text-yellow-500 mt-1 uppercase tracking-widest italic">
              Management Portal
            </p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-4 space-y-3 mt-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all border
              ${activeTab === item.id
                ? "bg-yellow-500 text-black border-yellow-500 shadow-xl shadow-yellow-500/20 scale-[1.02]"
                : isDark
                  ? "text-zinc-500 bg-transparent border-transparent hover:bg-white/5 hover:text-white"
                  : "text-zinc-600 bg-transparent border-transparent hover:bg-black/5 hover:text-black"
              }`}
          >
            <span className={activeTab === item.id ? "text-black" : "text-yellow-500"}>
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className={`p-4 border-t ${isDark ? "border-white/5" : "border-black/5"}`}>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
            isDark
              ? "text-rose-500 hover:bg-rose-500/10"
              : "text-rose-600 hover:bg-rose-50/50"
          }`}
        >
          <LogOut size={20} />
          Log Out
        </button>
      </div>
    </div>
  );
}