import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../customer/assets/images/logo.jpeg";
import { 
  LayoutDashboard, Bike, RotateCcw, LogOut, X, Wallet 
} from "lucide-react";

export default function SideBar({ 
  activeSection, 
  setActiveSection, 
  isOpen, 
  setIsOpen, 
  onEndShift,
  stats,
  deliveryBadge = 0,
}) {
  const navigate = useNavigate();

  const menuItems = [
    { id: "PENDING",    label: "My Collection",  icon: <LayoutDashboard size={20} /> },
    { id: "CLOSED",     label: "Order Status",   icon: <RotateCcw size={20} /> },
    { id: "PETTY CASH", label: "Log Petty Cash", icon: <Wallet size={20} /> },
    { id: "DELIVERIES", label: "Riders",         icon: <Bike size={20} /> },
  ];

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/staff/login");
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[120] xl:hidden backdrop-blur-sm" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-[130] w-[280px] bg-[#0c0c0c] border-r border-white/5 flex flex-col transition-transform duration-300 transform
        xl:relative xl:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}>

        {/* Branding */}
        <div className="p-6 border-b border-white/5 flex flex-col gap-4">
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-3">
              <img src={logo} alt="logo" className="w-10 h-10 rounded-full object-cover border border-yellow-500/20" />
              <div className="flex flex-col">
                <h1 className="text-[14px] font-black text-white uppercase tracking-tighter leading-tight">
                  KURAX FOOD LOUNG & BISTRO
                </h1>
                <p className="text-yellow-500 text-[8px] font-bold uppercase tracking-widest leading-tight">
                  Staff Panel
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="xl:hidden p-2 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={20}/>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive     = activeSection === item.id;
            const isDeliveries = item.id === "DELIVERIES";
            return (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setIsOpen(false); }}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all font-bold uppercase text-[11px] tracking-widest ${
                  isActive
                    ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/10"
                    : "text-zinc-500 hover:bg-white/5"
                }`}
              >
                {item.icon}
                <span className="flex-1 text-left">{item.label}</span>

                {/* Orange badge — active deliveries count */}
                {isDeliveries && deliveryBadge > 0 && !isActive && (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-black text-[9px] font-black shrink-0">
                    {deliveryBadge > 9 ? "9+" : deliveryBadge}
                  </span>
                )}
              </button>
            );
          })}

          {/* End Shift */}
          <div className="pt-4 mt-4 border-t border-white/5">
            <button 
              onClick={onEndShift}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-rose-500/5 text-rose-500 border border-rose-500/10 font-bold uppercase text-[11px] tracking-widest hover:bg-rose-500 hover:text-white transition-all group"
            >
              <RotateCcw size={18} className="group-hover:rotate-180 transition-transform duration-500" /> 
              End Shift
            </button>
          </div>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/5">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-zinc-700 font-bold uppercase text-[11px] tracking-widest hover:text-zinc-400 transition-all"
          >
            <LogOut size={18} /> 
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}