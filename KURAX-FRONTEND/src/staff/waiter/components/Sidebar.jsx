import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Clock,
  LogOut,
  LayoutGrid,
  MoreVertical,
  X,
  Users,
  DollarSign,
  History,
  Target,
  UserPlus
} from "lucide-react";
import logo from "../../../customer/assets/images/logo.jpeg";
import { useTheme } from "../../../customer/components/context/ThemeContext";

const DEFAULT_MENU = [
  { id: "order", label: "TAKE ORDER", icon: <ClipboardList size={20} /> },
  { id: "manage", label: "MANAGE ORDER", icon: <Clock size={20} /> },
  { id: "tables", label: "MANAGE TABLE", icon: <LayoutGrid size={20} /> },
];

// Bottom navigation items for mobile - ONLY Take Order and Manage Order
const BOTTOM_NAV_ITEMS = [
  { id: "order", label: "TAKE ORDER", icon: <ClipboardList size={22} /> },
  { id: "manage", label: "MANAGE ORDER", icon: <Clock size={22} /> },
];

// All items that go in the drawer menu
const DRAWER_MENU_ITEMS = [
  { id: "order", label: "TAKE ORDER", icon: <ClipboardList size={20} /> },
  { id: "manage", label: "MANAGE ORDER", icon: <Clock size={20} /> },
  { id: "tables", label: "MANAGE TABLE", icon: <LayoutGrid size={20} /> },
];

export default function Sidebar({ activeTab, setActiveTab, menuItems, onLogout }) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isMenuOpen && !e.target.closest(".mobile-drawer")) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("kurax_user");
    if (onLogout) {
      onLogout();
    } else {
      navigate("/staff/login");
    }
  };

  const items = menuItems || DEFAULT_MENU;

  // ========== MOBILE VIEW ==========
  if (isMobile) {
    return (
      <>
        {/* 3 Vertical Dots Button - Naked, on the right */}
        <button
          onClick={() => setIsMenuOpen(true)}
          className={`fixed top-4 right-4 z-50 p-1 transition-all ${
            theme === "dark" ? "text-white" : "text-black"
          }`}
        >
          <MoreVertical size={24} />
        </button>

        {/* Mobile Drawer - Shows Logo, Text, Menu Items, and Logout */}
        <div
          className={`fixed inset-0 z-40 transition-all duration-300 mobile-drawer ${
            isMenuOpen ? "visible" : "invisible"
          }`}
        >
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${
              isMenuOpen ? "opacity-100 bg-black/50" : "opacity-0"
            }`}
            onClick={() => setIsMenuOpen(false)}
          />

          <div
            className={`absolute right-0 top-0 h-full w-72 transition-transform duration-300 ${
              isMenuOpen ? "translate-x-0" : "translate-x-full"
            } ${
              theme === "dark"
                ? "bg-zinc-950 border-l border-white/5"
                : "bg-white border-l border-black/5"
            }`}
          >
            {/* Logo and Header Section - Pushed lower */}
            <div className={`pt-20 pb-6 px-6 border-b ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
              <div className="flex items-center gap-3">
                <img
                  src={logo}
                  alt="Logo"
                  className="w-12 h-12 rounded-full object-cover border-2 border-yellow-500/20"
                />
                <div className="flex flex-col">
                  <h1 className={`text-[11px] font-black uppercase tracking-tight leading-none ${
                    theme === "dark" ? "text-white" : "text-zinc-900"
                  }`}>
                    KURAX FOOD LOUNGE & BISTRO
                  </h1>
                  <p className="text-[9px] font-bold text-yellow-500 mt-1 uppercase tracking-widest">
                    WAITER PANEL
                  </p>
                </div>
              </div>
            </div>

            {/* Close Button - Moved to top right corner */}
            <button
              onClick={() => setIsMenuOpen(false)}
              className="absolute top-5 right-5 p-1 rounded-full hover:bg-black/10"
            >
              <X size={20} />
            </button>

            {/* Menu Items */}
            <nav className="flex-1 p-4 space-y-3 mt-6">
              {DRAWER_MENU_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all border
                    ${activeTab === item.id
                      ? "bg-yellow-500 text-black border-yellow-500 shadow-xl shadow-yellow-500/20 scale-[1.02]"
                      : theme === "dark"
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

            {/* Logout Button */}
            <div className={`p-4 border-t mt-auto ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
              <button
                onClick={handleLogout}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  theme === "dark"
                    ? "text-rose-500 hover:bg-rose-500/10"
                    : "text-rose-600 hover:bg-rose-50/50"
                }`}
              >
                <LogOut size={20} />
                Log Out
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Navigation Bar - Only Take Order and Manage Order */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-30 flex justify-around items-center px-2 py-3 border-t backdrop-blur-lg ${
            theme === "dark"
              ? "bg-zinc-950/95 border-white/10"
              : "bg-white/95 border-black/10"
          }`}
        >
          {BOTTOM_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
              }}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all flex-1 max-w-[120px] ${
                activeTab === item.id
                  ? "bg-yellow-500 text-black"
                  : theme === "dark"
                    ? "hover:bg-white/5 text-zinc-500 hover:text-white"
                    : "hover:bg-black/5 text-zinc-600 hover:text-black"
              }`}
            >
              <span className={activeTab === item.id ? "text-black" : "text-yellow-500"}>
                {item.icon}
              </span>
              <span className={`text-[9px] font-black uppercase tracking-wider ${
                activeTab === item.id ? "text-black" : ""
              }`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>

        {/* Bottom padding to prevent content from being hidden */}
        <div className="pb-24" />
      </>
    );
  }

  // ========== DESKTOP VIEW ==========
  return (
    <div
      className={`w-64 h-full flex flex-col border-r transition-colors duration-300 flex-shrink-0 ${
        theme === "dark" ? "bg-zinc-950 border-white/5" : "bg-white border-black/5"
      }`}
    >
      {/* Logo / header */}
      <div className={`p-6 border-b ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Logo"
            className="w-12 h-12 rounded-full object-cover border-2 border-yellow-500/20"
          />
          <div className="flex flex-col">
            <h1 className={`text-[11px] font-black uppercase tracking-tight leading-none ${
              theme === "dark" ? "text-white" : "text-zinc-900"
            }`}>
              KURAX FOOD LOUNGE & BISTRO
            </h1>
            <p className="text-[9px] font-bold text-yellow-500 mt-1 uppercase tracking-widest italic">
              WAITER PANEL
            </p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-4 space-y-3 mt-6">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all border
              ${activeTab === item.id
                ? "bg-yellow-500 text-black border-yellow-500 shadow-xl shadow-yellow-500/20 scale-[1.02]"
                : theme === "dark"
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
      <div className={`p-4 border-t ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
            theme === "dark"
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