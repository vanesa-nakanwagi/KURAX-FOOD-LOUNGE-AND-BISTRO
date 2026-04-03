import React from "react";
import { useNavigate } from "react-router-dom";
import { 
  ClipboardList, 
  Clock, 
  LogOut, 
  LayoutGrid // Added for Manage Tables
} from "lucide-react";
import logo from "../../../customer/assets/images/logo.jpeg";
import { useTheme } from "../../../customer/components/context/ThemeContext";

const DEFAULT_MENU = [
  { 
    id: "order",  
    label: "TAKE ORDER",        
    icon: <ClipboardList size={20} /> 
  },
  { 
    id: "manage", 
    label: "MANAGE ORDER",  
    icon: <Clock size={20} /> 
  },
  { 
    id: "tables", 
    label: "MANAGE TABLE", 
    icon: <LayoutGrid size={20} /> // New Item
  },
];

export default function Sidebar({ activeTab, setActiveTab, menuItems }) {
  const { theme } = useTheme();
  const navigate  = useNavigate();

  // Use caller-supplied items if provided, otherwise fall back to default
  const items = menuItems || DEFAULT_MENU;

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("kurax_user");
    navigate("/staff/login");
  };

  return (
    <div className={`w-64 h-screen flex flex-col border-r transition-colors duration-300 ${
      theme === "dark" ? "bg-zinc-950 border-white/5" : "bg-white border-black/5"
    }`}>

      {/* ── Logo / header ─────────────────────────────────────────────────── */}
      <div className={`p-6 border-b ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
        <div className="flex items-center gap-3">
          <img
            src={logo} alt="Logo"
            className="w-12 h-12 rounded-full object-cover border-2 border-yellow-500/20"
          />
          <div className="flex flex-col">
            <h1 className={`text-[11px] font-black uppercase tracking-tight leading-none ${
              theme === "dark" ? "text-white" : "text-zinc-900"
            }`}>
              KURAX FOOD LOUNGE & BISTRO
            </h1>
            <p className="text-[9px] font-bold text-yellow-500 mt-1 uppercase tracking-widest italic">
              Waiter Portal
            </p>
          </div>
        </div>
      </div>

      {/* ── Nav items ─────────────────────────────────────────────────────── */}
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

      {/* ── Logout ────────────────────────────────────────────────────────── */}
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