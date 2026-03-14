import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Target,
  Flag,
  LayoutDashboard,
  BarChart3,
  LogOut,
  Clock,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  TrendingUp,
} from "lucide-react";
import logo from "../../../customer/assets/images/logo.jpeg";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";

const NAV_ITEMS = [
  { id: "order",   label: "Take Order",    short: "Order",   icon: ClipboardList },
  { id: "tables",  label: "All Floor",     short: "Floor",   icon: LayoutDashboard },
  { id: "status",  label: "Order Status",  short: "Status",  icon: Clock },
  { id: "reports", label: "Sales Reports & Credits", short: "Reports", icon: BarChart3 },
  { id: "target",  label: "Set Target",    short: "Target",  icon: Target },
  { id: "shift",   label: "End Shift",     short: "Shift",   icon: Flag },
];

export default function ManagerSidebar({ activeTab, setActiveTab, debtorCount = 0 }) {
  const { theme } = useTheme();
  const { currentUser } = useData();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDark = theme === "dark";
  const firstName = (currentUser?.name || "Manager").split(" ")[0];

  const handleLogout = () => {
    localStorage.removeItem("kurax_user");
    navigate("/staff/login");
  };

  const handleTab = (id) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  // ── Shared nav button ─────────────────────────────────────────────────────
  const NavBtn = ({ item, showLabel = true }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    const hasBadge = item.id === "tables" && debtorCount > 0;

    return (
      <button
        onClick={() => handleTab(item.id)}
        title={!showLabel ? item.label : undefined}
        className={`relative w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-200
          ${isActive
            ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20 scale-[1.02]"
            : isDark
              ? "text-zinc-500 hover:bg-white/5 hover:text-white"
              : "text-zinc-500 hover:bg-black/5 hover:text-zinc-900"
          }
          ${!showLabel ? "justify-center" : ""}`}
      >
        <Icon size={18} className={isActive ? "text-black" : "text-yellow-500"} />
        {showLabel && <span className="truncate">{item.label}</span>}
        {hasBadge && (
          <span className={`ml-auto px-1.5 py-0.5 rounded-full text-[8px] font-black shrink-0
            ${isActive ? "bg-black text-yellow-500" : "bg-rose-500 text-white"}`}>
            {debtorCount}
          </span>
        )}
      </button>
    );
  };

  // ── DESKTOP SIDEBAR ───────────────────────────────────────────────────────
  const DesktopSidebar = () => (
    <aside className={`hidden md:flex flex-col h-screen border-r shrink-0 transition-all duration-300
      ${collapsed ? "w-[72px]" : "w-60"}
      ${isDark ? "bg-zinc-950 border-white/5" : "bg-white border-black/5"}`}>

      {/* Header */}
      <div className={`flex items-center border-b px-3 py-4 gap-3 min-h-[72px]
        ${isDark ? "border-white/5" : "border-black/5"}`}>
        <img src={logo} alt="Kurax" className="w-9 h-9 rounded-xl object-cover border border-yellow-500/20 shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <p className={`text-[11px] font-black uppercase tracking-tight leading-none truncate
              ${isDark ? "text-white" : "text-zinc-900"}`}>
              KURAX LOUNGE
            </p>
            <p className="text-[9px] font-bold text-yellow-500 mt-0.5 uppercase tracking-widest italic">
              Management
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(p => !p)}
          className={`ml-auto p-1.5 rounded-xl transition-all shrink-0
            ${isDark ? "hover:bg-white/5 text-zinc-500" : "hover:bg-zinc-100 text-zinc-400"}`}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Manager identity pill */}
      {!collapsed && (
        <div className={`mx-3 mt-4 mb-2 px-3 py-2.5 rounded-2xl border flex items-center gap-2.5
          ${isDark ? "bg-zinc-900 border-white/5" : "bg-zinc-50 border-black/5"}`}>
          <div className="w-7 h-7 rounded-xl bg-yellow-500 flex items-center justify-center font-black text-black text-sm shrink-0">
            {firstName[0]}
          </div>
          <div className="min-w-0">
            <p className={`text-[10px] font-black uppercase truncate leading-none
              ${isDark ? "text-white" : "text-zinc-900"}`}>{firstName}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Active</p>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <NavBtn key={item.id} item={item} showLabel={!collapsed} />
        ))}
      </nav>

      {/* Logout */}
      <div className={`px-3 pb-5 pt-3 border-t ${isDark ? "border-white/5" : "border-black/5"}`}>
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all
            ${collapsed ? "justify-center" : ""}
            text-rose-500 hover:bg-rose-500/10`}>
          <LogOut size={18} />
          {!collapsed && "Log Out"}
        </button>
      </div>
    </aside>
  );

  // ── MOBILE: Overlay drawer + bottom tab bar ───────────────────────────────
  const MobileNav = () => (
    <>
      {/* Slide-out drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer panel */}
          <aside className={`relative z-10 w-72 h-full flex flex-col shadow-2xl
            ${isDark ? "bg-zinc-950 border-r border-white/5" : "bg-white border-r border-black/5"}`}>

            {/* Drawer header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b
              ${isDark ? "border-white/5" : "border-black/5"}`}>
              <div className="flex items-center gap-3">
                <img src={logo} alt="Kurax" className="w-9 h-9 rounded-xl object-cover border border-yellow-500/20" />
                <div>
                  <p className={`text-[11px] font-black uppercase tracking-tight leading-none
                    ${isDark ? "text-white" : "text-zinc-900"}`}>KURAX LOUNGE</p>
                  <p className="text-[9px] font-bold text-yellow-500 mt-0.5 uppercase tracking-widest italic">Management</p>
                </div>
              </div>
              <button onClick={() => setMobileOpen(false)}
                className={`p-2 rounded-xl ${isDark ? "hover:bg-white/5 text-zinc-500" : "hover:bg-zinc-100 text-zinc-400"}`}>
                <X size={16} />
              </button>
            </div>

            {/* Manager pill */}
            <div className={`mx-4 mt-4 mb-2 px-4 py-3 rounded-2xl border flex items-center gap-3
              ${isDark ? "bg-zinc-900 border-white/5" : "bg-zinc-50 border-black/5"}`}>
              <div className="w-9 h-9 rounded-xl bg-yellow-500 flex items-center justify-center font-black text-black text-base shrink-0">
                {firstName[0]}
              </div>
              <div>
                <p className={`text-sm font-black uppercase leading-none
                  ${isDark ? "text-white" : "text-zinc-900"}`}>{currentUser?.name || "Manager"}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Session Active</p>
                </div>
              </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-4 py-3 space-y-1.5 overflow-y-auto">
              {NAV_ITEMS.map(item => (
                <NavBtn key={item.id} item={item} showLabel />
              ))}
            </nav>

            {/* Logout */}
            <div className={`px-4 pb-6 pt-3 border-t ${isDark ? "border-white/5" : "border-black/5"}`}>
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-500/10 transition-all">
                <LogOut size={18} /> Log Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Bottom tab bar — always visible on mobile */}
      <nav className={`fixed bottom-0 inset-x-0 z-40 border-t flex items-center justify-around px-1 py-1
        md:hidden
        ${isDark ? "bg-zinc-950/95 backdrop-blur-xl border-white/5" : "bg-white/95 backdrop-blur-xl border-black/5"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 6px)" }}>

        {/* First 4 tabs in bottom bar */}
        {NAV_ITEMS.slice(0, 4).map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const hasBadge = item.id === "tables" && debtorCount > 0;
          return (
            <button key={item.id} onClick={() => handleTab(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl flex-1 transition-all
                ${isActive ? "text-yellow-500" : isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              <div className="relative">
                <Icon size={20} className={isActive ? "scale-110 transition-transform" : ""} />
                {hasBadge && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full text-[7px] font-black text-white flex items-center justify-center">
                    {debtorCount}
                  </span>
                )}
              </div>
              <span className="text-[8px] font-black uppercase tracking-wide">{item.short}</span>
            </button>
          );
        })}

        {/* "More" button opens drawer for remaining items */}
        <button onClick={() => setMobileOpen(true)}
          className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl flex-1 transition-all
            ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
          <Menu size={20} />
          <span className="text-[8px] font-black uppercase tracking-wide">More</span>
        </button>
      </nav>
    </>
  );

  return (
    <>
      <DesktopSidebar />
      <MobileNav />
    </>
  );
}