import React, { useState } from "react";
import logo from "../../../assets/images/logo.jpeg";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Calendar,
  LogOut,
  Menu,
  X,
} from "lucide-react";

export default function Sidebar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/content-creator" },
    { icon: UtensilsCrossed, label: "Menus", path: "/content-creator/menus" },
    { icon: Calendar, label: "Events", path: "/content-creator/events" },
  ];

  const NavLinks = () => (
    <nav className="flex-1 flex flex-col space-y-2">
      {navItems.map((item) => {
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
          {/* Optional: Add a short version of the name here if you want it on the bar itself */}
          <span className="text-[10px] font-bold text-white uppercase tracking-tighter lg:hidden">Kurax Staff</span>
        </div>
        <button 
          onClick={() => setIsOpen(true)}
          className="p-2 text-white bg-zinc-800 rounded-lg active:scale-95 transition-transform"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* --- MOBILE OVERLAY/DRAWER --- */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-[70]">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setIsOpen(false)}
          />
          
          <div className="absolute top-0 left-0 w-72 h-full bg-zinc-900 border-r border-slate-800 p-6 flex flex-col animate-in slide-in-from-left duration-300">
            <div className="flex justify-between items-start mb-8 pb-6 border-b border-slate-800">
              {/* FIXED: Added the brand text here for mobile users */}
              <div className="flex items-center gap-3">
                <img src={logo} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-yellow-500/20" />
                <div className="leading-tight">
                  <h1 className="text-[11px] font-bold text-white uppercase tracking-tighter">KURAX FOOD LOUNGE</h1>
                  <h1 className="text-[9px] font-medium text-yellow-500 uppercase">STAFF PANEL</h1>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 p-1 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <NavLinks />

            <div className="pt-6 border-t border-slate-800">
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                <LogOut className="w-5 h-5" />
                <span className="font-medium text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DESKTOP SIDEBAR --- */}
      <div className="hidden lg:flex w-64 bg-zinc-900 text-white h-screen p-6 flex-col border-r border-slate-800 sticky top-0">
        <div className="mb-5 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Kurax Logo" className="w-12 h-12 rounded-full object-cover border border-yellow-500/20" />
            <div className="leading-tight">
              <h1 className="text-sm font-bold text-white uppercase tracking-tighter">KURAX FOOD LOUNGE & BISTRO</h1>
              <h1 className="text-xs font-medium text-yellow-500 uppercase">STAFF PANEL</h1>
            </div>
          </div>
        </div>

        <NavLinks />

        <div className="pt-6 border-t border-slate-800">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all">
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}