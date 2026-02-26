import React from "react";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { Plus, SearchX, UtensilsCrossed, Coffee, Wine, Sparkles } from "lucide-react";
import { getImageSrc } from "../../../utils/imageHelper";

export default function StaffOrderMenu({ onAddItem, items = [], searchQuery = "", activeCategory, setActiveCategory }) {
  const { theme } = useTheme();
  const categories = ["Starters", "Local Foods", "Drinks & Cocktails"];

  const filteredMenus = items.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      (item.category && item.category.toLowerCase().includes(query))
    );
  });

  if (!items || items.length === 0) {
    return (
      <div className={`col-span-full py-20 text-center border-2 border-dashed rounded-3xl ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
        <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">No Menu Items Available</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER ACTIONS */}
      <div className={`flex flex-col md:flex-row items-center justify-between border-b pb-1 gap-6 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
        <div className="flex justify-center items-center flex-1">
          <div className="flex gap-8 md:gap-12 overflow-x-auto no-scrollbar px-4">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`relative pb-4 text-sm font-bold transition-all whitespace-nowrap
                  ${activeCategory === cat 
                    ? "text-yellow-500" 
                    : theme === 'dark' ? "text-zinc-500" : "text-black"}`}
              >
                {cat}
                {activeCategory === cat && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* GRID SECTION */}
      {filteredMenus.length === 0 ? (
        <div className={`py-20 flex flex-col items-center justify-center rounded-[2.5rem] border ${theme === 'dark' ? 'bg-zinc-900/30 border-white/5' : 'bg-zinc-50 border-black/5'}`}>
          <SearchX size={40} className="text-zinc-400 mb-3" />
          <p className="text-zinc-500 text-sm font-bold italic tracking-tighter">
            No items in {activeCategory} match "{searchQuery}"
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 md:gap-8">
          {filteredMenus.map((item) => {
            // --- 48-HOUR NEW BADGE LOGIC ---
            const createdDate = new Date(item.created_at);
            const now = new Date();
            const isNew = (now - createdDate) / (1000 * 60 * 60) <= 48;

            return (
              <div 
                key={item.id} 
                className={`group border rounded-3xl overflow-hidden transition-all flex flex-col shadow-xl
                  ${theme === 'dark' 
                    ? 'bg-zinc-900/50 border-white/5 hover:border-yellow-500/40' 
                    : 'bg-white border-black/5 hover:border-yellow-500/40 shadow-zinc-200/50'}`}
              >
                {/* Image Section */}
                <div className="h-48 md:h-56 bg-zinc-800 relative overflow-hidden">
                  
                  {/* --- NEW BADGE (Top Right) --- */}
                  {isNew && (
                    <div className="absolute top-3 right-3 z-20 bg-yellow-500 text-black text-[9px] font-black px-2.5 py-1 rounded-lg shadow-xl flex items-center gap-1 border border-black/10">
                      <Sparkles size={10} /> NEW
                    </div>
                  )}

                  {/* --- STATION TAG (Top Left) --- */}
                  <div className="absolute top-3 left-3 z-10">
                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border backdrop-blur-md shadow-lg ${
                      item.station === 'Barista' ? 'bg-amber-900/60 text-amber-200 border-amber-500/30' : 
                      item.station === 'Barman' ? 'bg-blue-900/60 text-blue-200 border-blue-500/30' : 
                      'bg-emerald-900/60 text-emerald-200 border-emerald-500/30'
                    }`}>
                      {item.station === 'Barista' && <Coffee className="w-3.5 h-3.5" />}
                      {item.station === 'Barman' && <Wine className="w-3.5 h-3.5" />}
                      {(item.station === 'Kitchen' || !item.station) && <UtensilsCrossed className="w-3.5 h-3.5" />}
                      {item.station || 'Kitchen'}
                    </span>
                  </div>

                  {item.image_url ? (
                    <img 
                      src={getImageSrc(item.image_url)} 
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      onError={(e) => { e.target.src = "https://via.placeholder.com/150?text=No+Image"; }}
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                      <UtensilsCrossed className="text-zinc-400" size={30} />
                    </div>
                  )}
                </div>

                {/* Details Section */}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <h4 className={`text-base md:text-lg font-medium uppercase tracking-tight leading-tight transition-colors ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                      {item.name}
                    </h4>
                    <p className="text-yellow-600 text-sm md:text-base font-black tracking-tighter whitespace-nowrap">
                      UGX {Number(item.price).toLocaleString()}
                    </p>
                  </div>
                  
                  <p className={`text-[11px] line-clamp-2 mb-6 leading-relaxed transition-colors ${theme === 'dark' ? 'text-white/60' : 'text-zinc-500'}`}>
                    {item.description || `Delicious ${item.name} prepared fresh at Kurax.`}
                  </p>

                  <button 
                    onClick={() => onAddItem(item)}
                    className="mt-auto w-full py-4 bg-yellow-400 text-black rounded-2xl text-[10px] font-black flex items-center justify-center gap-2 transition-all uppercase italic shadow-lg active:scale-95 hover:bg-yellow-500"
                  >
                    <Plus size={16} /> Add to Order
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}