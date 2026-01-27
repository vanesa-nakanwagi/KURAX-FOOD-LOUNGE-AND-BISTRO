import React from "react";
import { useData } from "../../../components/context/DataContext";
import { Power, PowerOff, Package } from "lucide-react";

export default function KitchenInventory() {
  const { menus, setMenus } = useData();

  const toggleStatus = (id) => {
    setMenus(prev => prev.map(item => 
      item.id === id ? { ...item, available: !item.available } : item
    ));
  };

  return (
    <div className="p-6 bg-zinc-950 min-h-screen text-white font-[Outfit]">
      <div className="flex items-center gap-3 mb-8">
        <Package className="text-yellow-500" />
        <h1 className="text-2xl font-black uppercase">Menu Availability</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {menus.map((item) => (
          <div key={item.id} className={`p-4 rounded-2xl border-2 transition-all ${item.available !== false ? 'bg-zinc-900 border-slate-800' : 'bg-red-500/5 border-red-500/50 opacity-60'}`}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg">{item.name}</h3>
                <p className="text-xs text-slate-500 uppercase font-bold">Category: Main Course</p>
              </div>
              <button 
                onClick={() => toggleStatus(item.id)}
                className={`p-3 rounded-xl transition-colors ${item.available !== false ? 'bg-zinc-800 text-emerald-500' : 'bg-red-500 text-white'}`}
              >
                {item.available !== false ? <Power size={20} /> : <PowerOff size={20} />}
              </button>
            </div>
            
            <div className="mt-4 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${item.available !== false ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {item.available !== false ? 'In Stock / Active' : 'Sold Out / Hidden'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}