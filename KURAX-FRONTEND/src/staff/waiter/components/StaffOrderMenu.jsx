import React from "react";
import { useData } from "../../../components/context/DataContext";
import { Plus, SearchX } from "lucide-react";

export default function StaffOrderMenu({ onAddItem, searchQuery = "" }) {
  const { menus = [] } = useData() || {};

  const filteredMenus = menus.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) || 
      (item.category && item.category.toLowerCase().includes(query))
    );
  });

  if (!menus || menus.length === 0) {
    return (
      <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-800 rounded-3xl">
        <p className="text-zinc-600 text-xs font-black uppercase tracking-widest">Database is empty</p>
      </div>
    );
  }

  if (filteredMenus.length === 0) {
    return (
      <div className="col-span-full py-20 flex flex-col items-center justify-center bg-zinc-900/50 rounded-3xl border border-white/5">
        <SearchX size={40} className="text-zinc-700 mb-3" />
        <p className="text-zinc-500 text-sm font-bold italic">No items match "{searchQuery}"</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
      {filteredMenus.map((item) => (
        <div 
          key={item.id} 
          className="group bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden hover:border-yellow-500/50 transition-all flex flex-col shadow-2xl"
        >
          {/* Large Image Section */}
          <div className="h-56 bg-zinc-800 relative overflow-hidden">
            {item.image ? (
              <img 
                src={item.image} 
                alt={item.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-700 font-black text-xs uppercase tracking-tighter bg-gradient-to-br from-zinc-800 to-zinc-900">
                Kurax Kitchen
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="p-6 flex-1 flex flex-col">
            {/* Title and Price on the same row */}
            <div className="flex justify-between items-start gap-4 mb-3">
              <h4 className="text-lg font-black text-white uppercase tracking-tight leading-tight">
                {item.name}
              </h4>
              <div className="text-right flex-shrink-0">
                <span className="text-yellow-500 text-base font-black tracking-tighter">
                  UGX {Number(item.price).toLocaleString()}
                </span>
              </div>
            </div>
            
            <p className="text-xs text-zinc-500 line-clamp-2 mb-8 italic leading-relaxed">
              {item.description || "Freshly prepared Kurax special available for order now."}
            </p>

            <button 
              onClick={() => onAddItem(item)}
              className="mt-auto w-full py-4 text-color-black bg-yellow-400 text-black rounded-xl text-xs font-black flex items-center justify-center gap-3 transition-all uppercase italic shadow-lg active:scale-95"
            >
              <Plus size={18} /> Add to Order
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}