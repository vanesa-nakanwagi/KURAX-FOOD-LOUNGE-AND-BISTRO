import React from "react";
import { 
  ClipboardList, 
  Target, 
  Clock, 
  LogOut, 
  Flag 
} from "lucide-react";
import logo from "../../../customer/assets/images/logo.jpeg";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";

export default function Sidebar({ activeTab, setActiveTab }) {
  const { theme } = useTheme();
  const { currentUser } = useData();

  // Main navigation items
  const menuItems = [
    { id: "order", label: "TAKE ORDER", icon: <ClipboardList size={20} /> },
    { id: "target", label: "SET TARGET", icon: <Target size={20} /> },
    { id: "status", label: "VIEW ORDER STATUS", icon: <Clock size={20} /> },
    { id: "shift", label: "END SHIFT", icon: <Flag size={20} /> },
  ];

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
  };

  return (
    <div className={`w-60 h-screen flex flex-col border-r transition-colors duration-300 ${
      theme === 'dark' ? 'bg-zinc-900 border-white/5' : 'bg-white border-black/5'
    }`}>
      
      {/* Sidebar Header */}
      <div className="p-6 border-b border-black/5">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="w-12 h-12 rounded-full object-cover border border-yellow-500/20" />
          <div className="flex flex-col">
            <h1 className={`text-xs font-black uppercase tracking-tight leading-none ${
              theme === 'dark' ? 'text-white' : 'text-zinc-900'
            }`}>
              KURAX FOOD LOUNGE
            </h1>
            <p className="text-[10px] font-bold text-yellow-500 mt-1 uppercase tracking-tighter">
              & BISTRO
            </p>
          </div>
        </div>
      </div>

      {/* Main Sidebar Buttons */}
      <nav className="flex-1 p-4 space-y-2 mt-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabClick(item.id)}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border
              ${activeTab === item.id 
                ? "bg-yellow-500 text-black border-yellow-500 shadow-lg shadow-yellow-500/10" 
                : theme === 'dark' 
                  ? "text-zinc-500 bg-transparent border-transparent hover:bg-white/5" 
                  : "text-zinc-600 bg-transparent border-transparent hover:bg-black/5"
              }`}
          >
            <span className={activeTab === item.id ? "text-black" : "text-yellow-500"}>
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Logout Button at the Bottom */}
      <div className={`p-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
        <button
          onClick={() => handleTabClick("logout")}
          className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all
            ${theme === 'dark' 
              ? "text-rose-500 hover:bg-rose-500/10" 
              : "text-rose-600 hover:bg-rose-50/50"}`}
        >
          <LogOut size={20} />
          Logout
        </button>
      </div>

    </div>
  );
}