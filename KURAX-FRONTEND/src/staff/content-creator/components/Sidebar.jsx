import React, { useState } from "react";
import logo from "../../../customer/assets/images/logo.jpeg";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Calendar,
  LogOut,
  MoreVertical,
  X,
} from "lucide-react";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  // Bottom navigation items for mobile - Menus and Events
  const BOTTOM_NAV_ITEMS = [
    { icon: UtensilsCrossed, label: "Menus", path: "/content-creator/menus" },
    { icon: Calendar, label: "Events", path: "/content-creator/events" },
  ];

  // Drawer menu items - Dashboard only
  const DRAWER_MENU_ITEMS = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/content-creator" },
  ];

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/staff/login');
    setIsOpen(false);
  };

  const NavLinks = ({ items }) => (
    <nav className="flex-1 flex flex-col space-y-2">
      {items.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
              isActive
                ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium text-sm">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* --- MOBILE TOP BAR --- */}
      <div className="lg:hidden fixed top-0 left-0 w-full bg-zinc-900 border-b border-slate-800 p-4 flex items-center justify-between z-[60]">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Logo" className="w-8 h-8 rounded-full" />
          <span className="text-sm sm:text-base font-black text-white uppercase tracking-tight lg:hidden ml-1">
            Kurax Staff Panel
          </span>
        </div>
        {/* 3 Vertical Dots Button - Naked */}
        <button 
          onClick={() => setIsOpen(true)}
          className="p-1 text-white transition-transform"
        >
          <MoreVertical className="w-6 h-6" />
        </button>
      </div>

      {/* --- MOBILE OVERLAY/DRAWER --- */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-[70]">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setIsOpen(false)}
          />
          
          <div className="absolute right-0 top-0 w-72 h-full bg-zinc-900 border-l border-slate-800 p-6 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Logo and Header Section - Pushed lower */}
            <div className="pt-20 pb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <img src={logo} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-yellow-500/20" />
                <div className="flex flex-col justify-center leading-tight">
                  <h1 className="text-sm font-black text-white uppercase tracking-tighter leading-none">
                    KURAX FOOD LOUNGE
                  </h1>
                  <h1 className="text-[10px] font-bold text-yellow-500 uppercase tracking-[0.2em] mt-0.5">
                    STAFF PANEL
                  </h1>
                </div>
              </div>
            </div>

            {/* Close Button - Top right */}
            <button 
              onClick={() => setIsOpen(false)} 
              className="absolute top-5 right-5 text-slate-400 p-1 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            
            {/* Drawer Menu Items - Only Dashboard */}
            <NavLinks items={DRAWER_MENU_ITEMS} />

            {/* Logout Button */}
            <div className="pt-6 border-t border-slate-800 mt-auto">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- BOTTOM NAVIGATION BAR (Mobile Only) - Menus and Events --- */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center px-2 py-3 border-t border-slate-800 bg-zinc-900/95 backdrop-blur-lg">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all flex-1 max-w-[120px] ${
                isActive
                  ? "bg-yellow-500 text-black"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-black" : "text-yellow-500"}`} />
              <span className={`text-[9px] font-black uppercase tracking-wider ${
                isActive ? "text-black" : ""
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* --- DESKTOP SIDEBAR (All items visible) --- */}
      <div className="hidden lg:flex w-64 bg-zinc-900 text-white h-screen p-6 flex-col border-r border-slate-800 sticky top-0">
        <div className="mb-5 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Kurax Logo" className="w-12 h-12 rounded-full object-cover border border-yellow-500/20" />
            <div className="leading-tight">
              <h1 className="text-sm font-bold text-white uppercase tracking-tighter">KURAX BISTRO</h1>
              <h1 className="text-xs font-medium text-yellow-500 uppercase">STAFF PANEL</h1>
            </div>
          </div>
        </div>

        {/* Desktop shows all items */}
        <NavLinks items={[...DRAWER_MENU_ITEMS, ...BOTTOM_NAV_ITEMS]} />

        <div className="pt-6 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </div>

      {/* Bottom padding for mobile to prevent content from being hidden */}
      <div className="lg:hidden pb-24" />
    </>
  );
}