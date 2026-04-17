import React from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Target, Clock, LogOut, History, LayoutGrid } from "lucide-react";
import logo from "../../../customer/assets/images/logo.jpeg";
import { useData }  from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";

const DEFAULT_MENU = [
  { id: "order",   label: "TAKE ORDER",         icon: <ClipboardList size={20} /> },
  { id: "status",  label: "VIEW ORDER STATUS",  icon: <Clock size={20} /> },
  { id: "history", label: "MANAGE ORDER",       icon: <History size={20} /> },      // Manage Order
  { id: "tables",  label: "MANAGE TABLE",       icon: <LayoutGrid size={20} /> },   // Manage Table (NEW)
  { id: "targets", label: "SET STAFF TARGETS",  icon: <Target size={20} /> },
];

export default function Sidebar({ activeTab, setActiveTab, menuItems }) {
  const { theme } = useTheme();
  const { currentUser } = useData();
  const navigate  = useNavigate();
  const isDark = theme === "dark";

  const items = menuItems || DEFAULT_MENU;

  // Logic to handle name and initials
  const userName = currentUser?.name || "Manager";
  const firstName = userName.split(" ")[0].toUpperCase();
  const initial = userName.charAt(0).toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("kurax_user");
    navigate("/staff/login");
  };

  return (
    <div className={`w-64 h-screen flex flex-col border-r transition-colors duration-300 ${
      isDark ? "bg-zinc-950 border-white/5" : "bg-white border-black/5"
    }`}>

      {/* ── Logo / header ─────────────────────────────────────────────────── */}
      <div className={`p-6 border-b ${isDark ? "border-white/5" : "border-black/5"}`}>
        <div className="flex items-center gap-3">
          <img
            src={logo} alt="Logo"
            className="w-12 h-12 rounded-full object-cover border-2 border-yellow-500/20"
          />
          <div className="flex flex-col">
            <h1 className={`text-[11px] font-black uppercase tracking-tight leading-none ${
              isDark ? "text-white" : "text-zinc-900"
            }`}>
              KURAX LOUNGE
            </h1>
            <p className="text-[9px] font-bold text-yellow-500 mt-1 uppercase tracking-widest italic">
              Management Portal
            </p>
          </div>
        </div>
      </div>

      {/* ── Active User Section ───────────────────────────────────────────── */}
      <div className={`mx-4 mt-4 p-4 rounded-[1.5rem] border flex items-center gap-3 ${
        isDark ? "bg-zinc-900/50 border-white/5" : "bg-zinc-50 border-black/5"
      }`}>
        {/* Avatar Square */}
        <div className="w-10 h-10 rounded-xl bg-yellow-500 flex items-center justify-center font-black text-black text-sm shrink-0 shadow-lg shadow-yellow-500/10">
          {initial}
        </div>
        
        {/* Name and Status */}
        <div className="flex flex-col min-w-0">
          <h2 className={`text-[11px] font-black uppercase tracking-tight truncate ${
            isDark ? "text-white" : "text-zinc-900"
          }`}>
            {firstName}
          </h2>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
              ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* ── Nav items ─────────────────────────────────────────────────────── */}
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

      {/* ── Logout ────────────────────────────────────────────────────────── */}
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