import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Calendar,
  LogOut,
  MoreVertical,
  X,
} from "lucide-react";
import logo from "../../../customer/assets/images/logo.jpeg";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check screen size for mobile
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // All menu items for desktop
  const DESKTOP_MENU_ITEMS = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/content-creator" },
    { icon: UtensilsCrossed, label: "Menus", path: "/content-creator/menus" },
    { icon: Calendar, label: "Events", path: "/content-creator/events" },
  ];

  // Bottom navigation items for mobile (Menus and Events)
  const BOTTOM_NAV_ITEMS = [
    { icon: UtensilsCrossed, label: "Menus", path: "/content-creator/menus" },
    { icon: Calendar, label: "Events", path: "/content-creator/events" },
  ];

  // Drawer menu items - only Dashboard (since Menus & Events are in bottom nav)
  const DRAWER_MENU_ITEMS = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/content-creator" },
  ];

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/staff/login");
    setIsOpen(false);
  };

  // ========== MOBILE VIEW ==========
  if (isMobile) {
    return (
      <>
        {/* 3 Vertical Dots / X Button - Changes icon when menu is open */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed top-4 right-4 z-50 p-2 rounded-xl transition-all bg-white/90 backdrop-blur-md border border-gray-200 text-black shadow-sm"
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
            } bg-white border-l border-gray-200 shadow-xl`}
          >
            {/* Logo and Header Section */}
            <div className="pt-12 pb-6 px-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <img
                  src={logo}
                  alt="Logo"
                  className="w-12 h-12 rounded-full object-cover border-2 border-yellow-500/20"
                />
                <div className="flex flex-col">
                  <h1 className="text-[11px] font-black tracking-tight leading-none text-zinc-900">
                    KURAX FOOD LOUNGE & BISTRO
                  </h1>
                  <p className="text-[9px] font-bold text-yellow-500 mt-1 tracking-widest">
                    CONTENT CREATOR
                  </p>
                </div>
              </div>
            </div>

            {/* Scrollable Menu Items */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[calc(100vh-160px)]">
              {DRAWER_MENU_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black tracking-wider transition-all
                      ${
                        isActive
                          ? "bg-yellow-500 text-black"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[11px] font-black tracking-wider transition-all bg-red-50 text-red-600 hover:bg-red-100"
              >
                <LogOut size={16} />
                Log Out
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Navigation Bar - Menus and Events */}
        <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-around items-center px-3 py-2 border-t bg-white/95 border-gray-200 shadow-lg">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all ${
                  isActive
                    ? "bg-yellow-500 text-black"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-black" : "text-yellow-500"}`} />
                <span className={`text-[9px] font-black tracking-wider ${
                  isActive ? "text-black" : ""
                }`}>
                  {item.label}
                </span>
              </Link>
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
    <div className="hidden lg:flex w-64 h-full flex-col border-r bg-white border-gray-200 shadow-sm font-['Outfit'] flex-shrink-0">
      {/* Logo / header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Logo"
            className="w-12 h-12 rounded-full object-cover border-2 border-yellow-500/20"
          />
          <div className="flex flex-col">
            <h1 className="text-[13px] font-black tracking-tight leading-tight text-zinc-900">
              KURAX FOOD LOUNGE & BISTRO
            </h1>
            <p className="text-[9px] font-bold text-yellow-600 mt-1 tracking-widest">
              CONTENT CREATOR
            </p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {DESKTOP_MENU_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[12px] font-black tracking-wider transition-all
                ${
                  isActive
                    ? "bg-yellow-500 text-black shadow-md"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[11px] font-black tracking-wider transition-all bg-red-50 text-red-600 hover:bg-red-100"
        >
          <LogOut size={16} />
          Log Out
        </button>
      </div>
    </div>
  );
}