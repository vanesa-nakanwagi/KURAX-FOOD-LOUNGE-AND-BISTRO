import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../customer/assets/images/logo.jpeg";
import { 
  LayoutDashboard, Bike, RotateCcw, LogOut, X, Wallet, BookOpen
} from "lucide-react";

export default function SideBar({ 
  activeSection, 
  setActiveSection, 
  isOpen, 
  setIsOpen, 
  onEndShift,
  stats,
  deliveryBadge = 0,
  creditBadge   = 0,
}) {
  const navigate = useNavigate();

  const menuItems = [
    { id: "PENDING",    label: "My Collection",  icon: <LayoutDashboard size={20} /> },
    { id: "CLOSED",     label: "Order Status",   icon: <RotateCcw size={20} /> },
    { id: "CREDITS",    label: "Credit Ledger",  icon: <BookOpen size={20} /> },
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
          className="fixed inset-0 bg-black/30 z-[120] xl:hidden backdrop-blur-sm" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-[130] w-[280px] bg-white border-r border-black/10 flex flex-col transition-transform duration-300 transform
        xl:relative xl:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}>

        {/* Branding */}
        <div className="p-6 border-b border-black/10 flex flex-col gap-4">
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-3">
              <img src={logo} alt="logo" className="w-10 h-10 rounded-full object-cover border border-yellow-500/30" />
              <div className="flex flex-col">
                <h1 className="text-[14px] font-black text-black uppercase tracking-tighter leading-tight">
                  KURAX FOOD LOUNGE & BISTRO
                </h1>
                <p className="text-yellow-600 text-[8px] font-bold uppercase tracking-widest leading-tight">
                  Staff Panel
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="xl:hidden p-2 text-zinc-500 hover:text-black transition-colors"
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
            const isCredits    = item.id === "CREDITS";

            // Badge value for this item
            const badge = isDeliveries ? deliveryBadge
                        : isCredits    ? creditBadge
                        : 0;

            // Badge color: yellow for all badges
            const badgeBg = "bg-yellow-500";

            return (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setIsOpen(false); }}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all font-bold uppercase text-[11px] tracking-widest ${
                  isActive
                    ? isCredits
                      ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                      : "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20"
                    : "text-zinc-600 hover:bg-black/5"
                }`}
              >
                <span className={isActive && !isCredits ? "text-black" : isCredits && isActive ? "text-white" : "text-yellow-600"}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>

                {/* Badge — active count */}
                {badge > 0 && !isActive && (
                  <span className={`flex items-center justify-center w-5 h-5 rounded-full ${badgeBg} text-black text-[9px] font-black shrink-0`}>
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-black/10">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-zinc-500 font-bold uppercase text-[11px] tracking-widest hover:text-black transition-all"
          >
            <LogOut size={18} /> 
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}