import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Target,
  LayoutDashboard,
  BarChart3,
  LogOut,
  Clock,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  History,
  Table,
} from "lucide-react";
import logo from "../../../customer/assets/images/logo.jpeg";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";

const NAV_ITEMS = [
  { id: "order",   label: "Take Order",       short: "Order",   icon: ClipboardList },
  { id: "history", label: "Manage Orders",     short: "History", icon: History },
  { id: "manage",  label: "Manage Table",      short: "Table",   icon: Table },
  { id: "tables",  label: "All Floor",         short: "Floor",   icon: LayoutDashboard },
  { id: "status",  label: "Order Status",      short: "Status",  icon: Clock },
  { id: "reports", label: "Sales & Credits",   short: "Reports", icon: BarChart3 },
  { id: "target",  label: "Set Target",        short: "Target",  icon: Target },
];

export default function ManagerSidebar({ activeTab, setActiveTab, debtorCount = 0 }) {
  const { theme } = useTheme();
  const { currentUser } = useData();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDark = theme === "dark";
  const fullName = currentUser?.name || "Manager";
  const firstName = fullName.split(" ")[0];

  const handleLogout = () => {
    localStorage.removeItem("kurax_user");
    navigate("/staff/login");
  };

  const handleTab = (id) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  // Consistent NavButton style (mirrors Director sidebar)
  const NavBtn = ({ item, showLabel = true }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    const hasBadge = item.id === "tables" && debtorCount > 0; // adjust if needed

    return (
      <button
        onClick={() => handleTab(item.id)}
        className={`
          w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all
          ${showLabel ? "justify-start" : "justify-center"}
          ${
            isActive
              ? "bg-yellow-500 text-black shadow-sm shadow-yellow-500/20"
              : isDark
              ? "text-zinc-500 hover:bg-white/5 hover:text-white"
              : "text-gray-600 hover:bg-gray-100"
          }
        `}
      >
        <Icon size={18} className={isActive ? "text-black" : "text-yellow-500"} />
        {showLabel && <span className="truncate">{item.label}</span>}
        {hasBadge && (
          <span
            className={`ml-auto px-1.5 py-0.5 rounded-full text-[8px] font-black shrink-0
              ${isActive ? "bg-black text-yellow-500" : "bg-rose-500 text-white"}`}
          >
            {debtorCount}
          </span>
        )}
      </button>
    );
  };

  const DesktopSidebar = () => (
    <div
      className={`hidden md:flex flex-col h-full w-full transition-all duration-300
        ${isDark ? "bg-zinc-950" : "bg-white border-r border-gray-200"}`}
    >
      {/* Logo area – now matches Director exactly */}
      <div
        className={`flex items-center border-b px-4 py-4 gap-3 min-h-[72px]
          ${isDark ? "border-white/5" : "border-gray-200"}`}
      >
        <img
          src={logo}
          alt="Kurax"
          className="w-10 h-10 rounded-xl object-cover border border-yellow-500/30 shrink-0"
        />
        {!collapsed && (
          <div className="min-w-0">
            <p
              className={`text-[11px] font-black uppercase tracking-tighter leading-none truncate
                ${isDark ? "text-white" : "text-gray-900"}`}
            >
              KURAX FOOD LOUNGE
            </p>
            <p
              className={`text-[8px] font-bold uppercase tracking-widest mt-0.5
                ${isDark ? "text-yellow-500" : "text-yellow-600"}`}
            >
              MANAGEMENT PANEL
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed((p) => !p)}
          className={`ml-auto p-1.5 rounded-xl transition-all shrink-0
            ${isDark ? "hover:bg-white/5 text-zinc-500" : "hover:bg-gray-100 text-gray-400"}`}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavBtn key={item.id} item={item} showLabel={!collapsed} />
        ))}
      </nav>

      {/* Logout */}
      <div className={`px-3 pb-5 pt-3 border-t ${isDark ? "border-white/5" : "border-gray-200"}`}>
        <button
          onClick={handleLogout}
          className={`
            w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all
            ${collapsed ? "justify-center" : ""}
            text-gray-500 hover:text-red-600 hover:bg-gray-100
          `}
        >
          <LogOut size={18} />
          {!collapsed && "Logout"}
        </button>
      </div>
    </div>
  );

  const MobileNav = () => (
    <>
      {/* Overlay & Slide-out sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside
            className={`relative z-10 w-72 h-full flex flex-col shadow-2xl
              ${isDark ? "bg-zinc-950" : "bg-white border-r border-gray-200"}`}
          >
            <div
              className={`flex items-center justify-between px-5 py-4 border-b
                ${isDark ? "border-white/5" : "border-gray-200"}`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={logo}
                  alt="Kurax"
                  className="w-10 h-10 rounded-xl object-cover border border-yellow-500/30"
                />
                <div>
                  <p className="text-[11px] font-black uppercase tracking-tighter leading-none text-gray-900 dark:text-white">
                    KURAX FOOD LOUNGE
                  </p>
                  <p className="text-[8px] font-bold uppercase tracking-widest mt-0.5 text-yellow-600 dark:text-yellow-500">
                    MANAGEMENT PANEL
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:text-zinc-500 dark:hover:bg-white/5"
              >
                <X size={16} />
              </button>
            </div>

            {/* Mobile user pill */}
            <div
              className={`mx-4 mt-5 mb-2 px-4 py-3 rounded-xl border flex items-center gap-3
                ${isDark ? "bg-zinc-900 border-white/5" : "bg-gray-50 border-gray-200"}`}
            >
              <div className="w-9 h-9 rounded-lg bg-yellow-500 flex items-center justify-center font-black text-black text-base shrink-0">
                {fullName[0]}
              </div>
              <div>
                <p className="text-sm font-black uppercase leading-none text-gray-900 dark:text-white">
                  {fullName}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                    Active
                  </p>
                </div>
              </div>
            </div>

            <nav className="flex-1 px-4 py-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => (
                <NavBtn key={item.id} item={item} showLabel={true} />
              ))}
            </nav>

            <div className={`px-4 pb-6 pt-3 border-t ${isDark ? "border-white/5" : "border-gray-200"}`}>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-white/5"
              >
                <LogOut size={18} /> Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Bottom tab bar (mobile) – unchanged but uses consistent icon/color */}
      <nav
        className={`fixed bottom-0 inset-x-0 z-40 border-t flex items-center justify-around px-1 py-1 md:hidden
          ${isDark ? "bg-zinc-950/95 backdrop-blur-xl border-white/5" : "bg-white/95 backdrop-blur-xl border-gray-200"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 6px)" }}
      >
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTab(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl flex-1 transition-all
                ${isActive ? "text-yellow-500" : isDark ? "text-zinc-600" : "text-gray-400"}`}
            >
              <Icon size={20} className={isActive ? "scale-110" : ""} />
              <span className="text-[8px] font-black uppercase tracking-wide">{item.short}</span>
            </button>
          );
        })}
        <button
          onClick={() => setMobileOpen(true)}
          className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl flex-1
            ${isDark ? "text-zinc-600" : "text-gray-400"}`}
        >
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