import React from "react";
import logo from "../../customer/assets/images/logo.jpeg";
import { 
  LayoutDashboard, Truck, RotateCcw, LogOut, X 
} from "lucide-react";

export default function SideBar({ 
  activeSection, 
  setActiveSection, 
  isOpen, 
  setIsOpen, 
  onEndShift 
}) {
  const menuItems = [
    { id: "PENDING", label: "My Collection", icon: <LayoutDashboard size={20} /> },
    { id: "CLOSED", label: "Order Status", icon: <RotateCcw size={20} /> },
    { id: "RIDERS", label: "Riders", icon: <Truck size={20} /> },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[120] xl:hidden backdrop-blur-sm" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-[130] w-[280px] bg-[#0c0c0c] border-r border-white/5 flex flex-col transition-transform duration-300 transform
        xl:relative xl:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Branding */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3 mb-10">
                      <img src={logo} alt="logo" className="w-10 h-10 rounded-full object-cover border border-yellow-500/20" />
                      <div className="flex flex-col">
                        <h1 className="text-sm font-black text-white uppercase tracking-tighter">KURAX FOOD LOUNGE & BISTRO</h1>
                        <p className="text-yellow-500 text-[9px] font-bold uppercase tracking-widest">Accountant Panel</p>
                      </div>
                    </div>
          <button onClick={() => setIsOpen(false)} className="xl:hidden text-zinc-500 hover:text-white transition-colors">
            <X size={20}/>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveSection(item.id); setIsOpen(false); }}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all font-bold uppercase text-[11px] tracking-widest ${
                activeSection === item.id 
                ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/10" 
                : "text-zinc-500 hover:bg-white/5"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-white/5 space-y-2">
          <button 
            onClick={onEndShift}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-zinc-900/50 text-rose-500 border border-rose-500/10 font-bold uppercase text-[11px] tracking-widest hover:bg-rose-500 hover:text-white transition-all group"
          >
            <RotateCcw size={20} className="group-hover:rotate-180 transition-transform duration-500" /> 
            End Shift
          </button>
          
          <button className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-zinc-500 font-bold uppercase text-[11px] tracking-widest hover:bg-white/5 transition-all">
            <LogOut size={20} /> 
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}