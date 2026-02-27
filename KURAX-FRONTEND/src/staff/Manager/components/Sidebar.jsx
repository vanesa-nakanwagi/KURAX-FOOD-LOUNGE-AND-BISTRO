import React from "react";
import { useNavigate } from "react-router-dom"; // 1. Import useNavigate
import { 
  ClipboardList, 
  Target, 
  Clock, 
  LogOut, 
  Flag,
  LayoutDashboard,
  BarChart3,
  UserCheck  
} from "lucide-react";
import logo from "../../../customer/assets/images/logo.jpeg";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";

export default function Sidebar({ activeTab, setActiveTab, debtorCount = 0 }) {
  const { theme } = useTheme();
  const { currentUser } = useData();
  const navigate = useNavigate(); // 2. Initialize navigate

  const menuItems = [
    { id: "order", label: "TAKE ORDER", icon: <ClipboardList size={20} /> },
    { id: "status", label: "VIEW ORDER STATUS", icon: <Clock size={20} /> },
    { 
      id: "tables", 
      label: "LIVE TABLES", 
      icon: <LayoutDashboard size={20} />,
      badge: debtorCount > 0 ? debtorCount : null 
    },
    { id: "reports", label: "SALES REPORTS", icon: <BarChart3 size={20} /> },
    { id: "target", label: "SET TARGET", icon: <Target size={20} /> },
    { id: "shift", label: "END SHIFT", icon: <Flag size={20} /> },
  ];

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
  };

  // 3. Define the Logout Function
  const handleLogout = () => {
    // Clear the user session from localStorage
    localStorage.removeItem('user');
    // Redirect to the login page
    navigate('/staff/login'); 
  };

  return (
    <div className={`w-64 h-screen flex flex-col border-r transition-colors duration-300 ${
      theme === 'dark' ? 'bg-zinc-950 border-white/5' : 'bg-white border-black/5'
    }`}>
      
      {/* Sidebar Header */}
      <div className={`p-6 border-b ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
        <div className="flex items-center gap-3">
          <div className="relative">
             <img src={logo} alt="Logo" className="w-12 h-12 rounded-full object-cover border-2 border-yellow-500/20" />
          </div>
          <div className="flex flex-col">
            <h1 className={`text-[11px] font-black uppercase tracking-tight leading-none ${
              theme === 'dark' ? 'text-white' : 'text-zinc-900'
            }`}>
              KURAX LOUNGE
            </h1>
            <p className="text-[9px] font-bold text-yellow-500 mt-1 uppercase tracking-widest italic">
              Management Portal
            </p>
          </div>
        </div>
      </div>

      {/* Main Sidebar Buttons */}
      <nav className="flex-1 p-4 space-y-3 mt-6 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabClick(item.id)}
            className={`w-full flex items-center justify-between px-5 py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all border
              ${activeTab === item.id 
                ? "bg-yellow-500 text-black border-yellow-500 shadow-xl shadow-yellow-500/20 scale-[1.02]" 
                : theme === 'dark' 
                  ? "text-zinc-500 bg-transparent border-transparent hover:bg-white/5 hover:text-white" 
                  : "text-zinc-600 bg-transparent border-transparent hover:bg-black/5 hover:text-black"
              }`}
          >
            <div className="flex items-center gap-4">
              <span className={activeTab === item.id ? "text-black" : "text-yellow-500"}>
                {item.icon}
              </span>
              {item.label}
            </div>

            {item.badge && (
              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${
                activeTab === item.id ? "bg-black text-yellow-500" : "bg-rose-500 text-white"
              }`}>
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Logout Button */}
      <div className={`p-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
        <button
          onClick={handleLogout} // 4. Attach the real logout function
          className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all
            ${theme === 'dark' 
              ? "text-rose-500 hover:bg-rose-500/10" 
              : "text-rose-600 hover:bg-rose-50/50"}`}
        >
          <LogOut size={20} />
          Log Out
        </button>
      </div>
    </div>
  );
}