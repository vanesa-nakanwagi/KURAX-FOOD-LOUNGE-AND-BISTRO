import React from "react";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { 
  Plus, SearchX, UtensilsCrossed, Coffee, Wine, 
  Sparkles, Lock, ShieldAlert 
} from "lucide-react";
import { getImageSrc } from "../../../utils/imageHelper";

/**
 * UNIVERSAL STAFF ORDER MENU
 * Reusable for Managers, Supervisors, and Waiters.
 * * @param {boolean} isGranted - From Director permission toggle
 * @param {Array} items - The menu data
 * @param {string} searchQuery - Current search filter
 * @param {string} activeCategory - Current category filter
 * @param {function} onAddItem - Action to add to cart
 */
export default function StaffOrderMenu({ 
  onAddItem, 
  items = [], 
  searchQuery = "", 
  activeCategory, 
  setActiveCategory,
  isGranted = true 
}) {
  const { theme } = useTheme();
  const categories = ["Starters", "Local Foods", "Drinks & Cocktails"];

  // Filter logic based on Category and Search Query
  const filteredMenus = items.filter((item) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(query) ||
                         (item.category && item.category.toLowerCase().includes(query));
    const matchesCategory = item.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Empty Database State
  if (!items || items.length === 0) {
    return (
      <div className={`col-span-full py-32 text-center border-2 border-dashed rounded-[3rem] ${
        theme === 'dark' ? 'border-white/5 bg-zinc-900/20' : 'border-black/5 bg-zinc-50'
      }`}>
        <UtensilsCrossed className="mx-auto mb-4 text-zinc-500 opacity-20" size={48} />
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">
          Menu Database Offline
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      
      {/* CATEGORY SELECTION HEADER */}
      <div className={`flex flex-col md:flex-row items-center justify-between border-b pb-1 gap-6 ${
        theme === 'dark' ? 'border-white/5' : 'border-black/5'
      }`}>
        <div className="flex justify-center items-center flex-1">
          <div className="flex gap-8 md:gap-12 overflow-x-auto no-scrollbar px-4">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`relative pb-5 text-[11px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap
                  ${activeCategory === cat 
                    ? "text-yellow-500" 
                    : theme === 'dark' ? "text-zinc-500 hover:text-white" : "text-zinc-400 hover:text-black"}`}
              >
                {cat}
                {activeCategory === cat && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* PRODUCT GRID */}
      {filteredMenus.length === 0 ? (
        <div className={`py-24 flex flex-col items-center justify-center rounded-[3rem] border border-dashed ${
          theme === 'dark' ? 'bg-zinc-900/30 border-white/5' : 'bg-zinc-50 border-black/5'
        }`}>
          <SearchX size={40} className="text-zinc-500/20 mb-4" />
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest italic">
            No items in {activeCategory} match "{searchQuery}"
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 md:gap-8 pb-20">
          {filteredMenus.map((item) => {
            // 48-Hour Logic for New Items
            const isNew = item.created_at && (new Date() - new Date(item.created_at)) / (1000 * 60 * 60) <= 48;

            return (
              <div 
                key={item.id} 
                className={`group border rounded-[2.5rem] overflow-hidden transition-all flex flex-col hover:shadow-2xl hover:-translate-y-1
                  ${theme === 'dark' 
                    ? 'bg-zinc-900/40 border-white/5 hover:border-yellow-500/30' 
                    : 'bg-white border-black/5 hover:border-yellow-500/30 shadow-sm'}`}
              >
                {/* Image & Tags Section */}
                <div className="h-48 md:h-52 bg-zinc-800 relative overflow-hidden">
                  
                  {/* Status Badges */}
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest border backdrop-blur-md shadow-lg ${
                      item.station === 'Barista' ? 'bg-amber-900/60 text-amber-200 border-amber-500/30' : 
                      item.station === 'Barman' ? 'bg-blue-900/60 text-blue-200 border-blue-500/30' : 
                      'bg-emerald-900/60 text-emerald-200 border-emerald-500/30'
                    }`}>
                      {item.station === 'Barista' && <Coffee size={12} />}
                      {item.station === 'Barman' && <Wine size={12} />}
                      {(item.station === 'Kitchen' || !item.station) && <UtensilsCrossed size={12} />}
                      {item.station || 'Kitchen'}
                    </span>

                    {isNew && (
                      <div className="bg-yellow-500 text-black text-[8px] font-black px-2.5 py-1.5 rounded-lg shadow-xl flex items-center gap-1 animate-pulse">
                        <Sparkles size={10} /> NEW
                      </div>
                    )}
                  </div>

                  {/* Image Display */}
                  {item.image_url ? (
                    <img 
                      src={getImageSrc(item.image_url)} 
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      onError={(e) => { e.target.src = "https://via.placeholder.com/300?text=Kurax+Bistro"; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                      <UtensilsCrossed className="text-zinc-700" size={32} />
                    </div>
                  )}
                </div>

                {/* Info & Action Section */}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h4 className={`text-sm font-black uppercase tracking-tight leading-tight ${
                      theme === 'dark' ? 'text-white' : 'text-zinc-900'
                    }`}>
                      {item.name}
                    </h4>
                    <p className="text-yellow-600 text-xs font-black tracking-tighter whitespace-nowrap bg-yellow-500/5 px-2 py-1 rounded-md">
                      {Number(item.price).toLocaleString()}
                    </p>
                  </div>
                  
                  <p className={`text-[10px] line-clamp-2 mb-6 font-bold uppercase tracking-wide opacity-50 leading-relaxed ${
                    theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'
                  }`}>
                    {item.description || `Signature Kurax ${item.name}`}
                  </p>

                  {/* LOGIC: Show Add Button only if Granted, otherwise show Locked */}
                  {isGranted ? (
                    <button 
                      onClick={() => onAddItem(item)}
                      className="mt-auto w-full py-4 bg-yellow-500 text-black rounded-2xl text-[10px] font-black flex items-center justify-center gap-2 transition-all uppercase italic shadow-lg shadow-yellow-500/10 active:scale-95 hover:bg-yellow-400"
                    >
                      <Plus size={16} /> Add To Order
                    </button>
                  ) : (
                    <div className="mt-auto w-full py-4 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-600 rounded-2xl text-[9px] font-black flex items-center justify-center gap-2 border border-black/5 dark:border-white/5 cursor-not-allowed uppercase tracking-widest">
                      <Lock size={14} /> Restricted Access
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}