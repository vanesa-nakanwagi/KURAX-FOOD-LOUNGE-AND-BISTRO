import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ClipboardList, Target, Clock, LogOut, History, LayoutGrid, 
  MoreVertical, X, Menu
} from "lucide-react";
import logo from "../../../customer/assets/images/logo.jpeg";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";

// ✅ Store component FUNCTIONS, not JSX
const DEFAULT_MENU = [
  { id: "order",   label: "Take Order",        icon: ClipboardList },
  { id: "status",  label: "Order Status",      icon: Clock },
  { id: "history", label: "Performance Hub",   icon: History },
  { id: "tables",  label: "Manage Table",      icon: LayoutGrid },
  { id: "targets", label: "Set Staff Targets", icon: Target },
];

const BOTTOM_NAV_ITEMS = [
  { id: "status", label: "Status", icon: Clock },
  { id: "targets", label: "Targets", icon: Target },
];

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
  const fullName = currentUser?.name || "Supervisor";
  const firstName = fullName.split(" ")[0];

  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isMenuOpen && !e.target.closest(".mobile-drawer")) setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("kurax_user");
    navigate("/staff/login");
  };

  // Unified NavButton – expects item.icon to be a component function
  const NavButton = ({ item, showLabel = true, onClick, isActive }) => {
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
      </button>
    );
  };

  // ========== MOBILE VIEW ==========
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`fixed top-4 right-4 z-50 p-2 rounded-xl transition-all ${
            isDark
              ? "bg-zinc-900/90 backdrop-blur-md border border-white/10 text-white"
              : "bg-white/90 backdrop-blur-md border border-gray-200 text-gray-700 shadow-sm"
          }`}
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className={`fixed inset-0 z-40 transition-all duration-300 mobile-drawer ${isMenuOpen ? "visible" : "invisible"}`}>
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${isMenuOpen ? "opacity-100 bg-black/70 backdrop-blur-sm" : "opacity-0"}`}
            onClick={() => setIsMenuOpen(false)}
          />
          <div
            className={`absolute right-0 top-0 h-full w-72 transition-transform duration-300 flex flex-col shadow-2xl
              ${isMenuOpen ? "translate-x-0" : "translate-x-full"}
              ${isDark ? "bg-zinc-950 border-l border-white/5" : "bg-white border-l border-gray-200"}`}
          >
            <div className={`flex items-center gap-3 p-5 border-b ${isDark ? "border-white/5" : "border-gray-200"}`}>
              <img src={logo} alt="Kurax" className="w-10 h-10 rounded-xl object-cover border border-yellow-500/30" />
              <div>
                <p className={`text-[11px] font-black uppercase tracking-tighter leading-none
                  ${isDark ? "text-white" : "text-gray-900"}`}>KURAX FOOD LOUNGE</p>
                <p className={`text-[8px] font-bold uppercase tracking-widest mt-0.5
                  ${isDark ? "text-yellow-500" : "text-yellow-600"}`}>SUPERVISOR PANEL</p>
              </div>
            </div>

            <div className={`mx-4 mt-5 mb-2 px-4 py-3 rounded-xl border flex items-center gap-3
              ${isDark ? "bg-zinc-900 border-white/5" : "bg-gray-50 border-gray-200"}`}>
              <div className="w-9 h-9 rounded-lg bg-yellow-500 flex items-center justify-center font-black text-black text-base">
                {fullName[0]}
              </div>
              <div>
                <p className={`text-sm font-black uppercase leading-none ${isDark ? "text-white" : "text-gray-900"}`}>{fullName}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Active</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
              {DRAWER_MENU_ITEMS.map(item => (
                <NavButton
                  key={item.id}
                  item={item}
                  showLabel={true}
                  isActive={activeTab === item.id}
                  onClick={() => { setActiveTab(item.id); setIsMenuOpen(false); }}
                />
              ))}
            </nav>

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

        <div
          className={`fixed bottom-0 left-0 right-0 z-30 flex justify-around items-center px-3 py-2 border-t backdrop-blur-lg
            ${isDark ? "bg-zinc-950/95 border-white/10" : "bg-white/95 border-gray-200 shadow-lg"}`}
          style={{ paddingBottom: "env(safe-area-inset-bottom, 6px)" }}
        >
          {BOTTOM_NAV_ITEMS.map(item => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
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
              </button>
            );
          })}
        </div>
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
      <div className={`flex items-center gap-3 p-5 border-b ${isDark ? "border-white/5" : "border-gray-200"}`}>
        <img src={logo} alt="Kurax" className="w-10 h-10 rounded-xl object-cover border border-yellow-500/30 shrink-0" />
        <div className="min-w-0">
          <p className={`text-[11px] font-black uppercase tracking-tighter leading-none truncate
            ${isDark ? "text-white" : "text-gray-900"}`}>
            KURAX FOOD LOUNGE
          </p>
          <p className={`text-[8px] font-bold uppercase tracking-widest mt-0.5
            ${isDark ? "text-yellow-500" : "text-yellow-600"}`}>
            SUPERVISOR PANEL
          </p>
        </div>
      </div>

      <div className={`mx-3 mt-5 mb-2 px-3 py-2.5 rounded-xl border flex items-center gap-2.5
        ${isDark ? "bg-zinc-900/50 border-white/5" : "bg-gray-50 border-gray-200"}`}>
        <div className="w-7 h-7 rounded-lg bg-yellow-500 flex items-center justify-center font-black text-black text-sm shrink-0">
          {firstName[0]}
        </div>
        <div className="min-w-0">
          <p className={`text-[10px] font-black uppercase truncate leading-none
            ${isDark ? "text-white" : "text-gray-900"}`}>{firstName}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-none">Active</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map(item => (
          <NavButton
            key={item.id}
            item={item}
            showLabel={true}
            isActive={activeTab === item.id}
            onClick={() => setActiveTab(item.id)}
          />
        ))}
      </nav>

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