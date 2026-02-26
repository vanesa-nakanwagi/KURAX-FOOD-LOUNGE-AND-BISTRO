import React from "react";
import { useNavigate } from "react-router-dom"; // 1. Import useNavigate
import { 
  Receipt, Calculator, Wallet, CheckCircle2, X, LogOut, RotateCcw 
} from "lucide-react";
import logo from "../../customer/assets/images/logo.jpeg";

export default function SideBar({ activeSection, setActiveSection, isOpen, setIsOpen }) {
  const navigate = useNavigate(); // 2. Initialize navigate

  // 3. Logout Logic
  const handleLogout = () => {
    localStorage.removeItem('user'); // Clear session
    navigate('/staff/login'); // Redirect to login
  };
  
  const menuItems = [
    { key: "FINANCIAL_HISTORY", label: "My Collections", icon: <Receipt size={20} /> },
    { key: "PHYSICAL COUNT", label: "Physical Finances", icon: <Calculator size={20} /> },
    { key: "LIVE AUDIT", label: "Live Audit", icon: <CheckCircle2 size={20} /> },
    { key: "END OF SHIFT", label: "End of Shift", icon: <RotateCcw size={20} /> },
  ];

  return (
    <>
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex flex-col w-72 bg-zinc-950 border-r border-white/5 h-screen sticky top-0">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <img src={logo} alt="logo" className="w-10 h-10 rounded-full object-cover border border-yellow-500/20" />
            <div className="flex flex-col">
              <h1 className="text-sm font-black text-white uppercase tracking-tighter">KURAX FOOD LOUNGE & BISTRO</h1>
              <p className="text-yellow-500 text-[9px] font-bold uppercase tracking-widest">Accountant Panel</p>
            </div>
          </div>

          <nav className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={`flex items-center gap-4 w-full p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all
                  ${activeSection === item.key 
                    ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/10' 
                    : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-white/5">
          <button 
            onClick={handleLogout} // 4. Attach to Desktop Logout
            className="flex items-center gap-3 text-zinc-600 font-black uppercase text-[10px] tracking-widest hover:text-rose-500 transition-colors"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex flex-col p-6 lg:hidden animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-10">
            <img src={logo} alt="Logo" className="w-10 h-10 rounded-full" />
            <button onClick={() => setIsOpen(false)} className="p-3 bg-zinc-900 rounded-full text-zinc-400">
              <X size={20} />
            </button>
          </div>
          <div className="space-y-3 flex-1">
            {menuItems.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setActiveSection(item.key);
                  setIsOpen(false);
                }}
                className={`flex items-center gap-4 w-full p-5 rounded-2xl font-black uppercase text-xs tracking-widest border
                  ${activeSection === item.key 
                    ? 'bg-yellow-500 text-black border-yellow-500' 
                    : 'bg-zinc-900/50 text-zinc-400 border-white/5'}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          {/* Added Logout for Mobile too */}
          <div className="mt-auto pt-6 border-t border-white/5">
            <button 
              onClick={handleLogout} 
              className="flex items-center gap-4 w-full p-5 rounded-2xl font-black uppercase text-xs tracking-widest text-rose-500 bg-rose-500/5 border border-rose-500/10"
            >
              <LogOut size={20} /> Logout
            </button>
          </div>
        </div>
      )}
    </>
  );
}