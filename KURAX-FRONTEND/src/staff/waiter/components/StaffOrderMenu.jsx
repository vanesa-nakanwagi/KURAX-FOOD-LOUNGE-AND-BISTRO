import React from "react";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { Plus, SearchX, UtensilsCrossed, Sparkles } from "lucide-react";
import { getImageSrc } from "../../../utils/imageHelper";

export default function StaffOrderMenu({ onAddItem, items = [], searchQuery = "", activeCategory, setActiveCategory }) {
  const { theme } = useTheme();
  const categories = ["Starters", "Local Foods", "Drinks & Cocktails"];

  const filteredMenus = items.filter((item) => {
    const query = searchQuery.toLowerCase();
    const matchesQuery = item.name.toLowerCase().includes(query) ||
      (item.category && item.category.toLowerCase().includes(query));
    const matchesCategory = item.category === activeCategory;
    return matchesQuery && matchesCategory;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 1. PERSISTENT CATEGORY NAV */}
      <div className={`flex flex-col md:flex-row items-center justify-between border-b pb-1 gap-6 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
        <div className="flex justify-center items-center flex-1">
          <div className="flex gap-8 md:gap-12 overflow-x-auto no-scrollbar px-4">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`relative pb-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap
                  ${activeCategory === cat 
                    ? "text-yellow-500" 
                    : theme === 'dark' ? "text-zinc-500 hover:text-white" : "text-zinc-400 hover:text-black"}`}
              >
                {cat}
                {activeCategory === cat && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.3)]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. CONDITIONAL CONTENT AREA */}
      {(!items || items.length === 0) ? (
        <div className={`py-32 text-center border-2 border-dashed rounded-[3rem] ${
          theme === 'dark' ? 'border-zinc-800 bg-zinc-900/20' : 'border-zinc-200 bg-zinc-50'
        }`}>
          <UtensilsCrossed className="mx-auto mb-4 text-zinc-500 opacity-20" size={48} />
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">
            No Menu Items Available
          </p>
        </div>
      ) : 
      filteredMenus.length === 0 ? (
        <div className={`py-24 flex flex-col items-center justify-center rounded-[3rem] border border-dashed ${
          theme === 'dark' ? 'bg-zinc-900/30 border-white/5' : 'bg-zinc-50 border-black/5'
        }`}>
          <SearchX size={32} className="text-zinc-400 mb-3 opacity-50" />
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
            No matches in {activeCategory}
          </p>
        </div>
      ) : (
        /* --- CONSISTENT GRID --- */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 pb-20">
          {filteredMenus.map((item) => {
            const isNew = item.created_at && (new Date() - new Date(item.created_at)) / (1000 * 60 * 60) <= 48;

            return (
              <div 
                key={item.id} 
                className={`group relative rounded-[2.5rem] overflow-hidden flex flex-col h-full transition-all duration-500 border shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] hover:shadow-2xl hover:-translate-y-2
                  ${theme === 'dark' 
                    ? 'bg-[#0A0A0A] border-zinc-800/40 hover:border-yellow-500/30' 
                    : 'bg-white border-zinc-100 hover:border-yellow-500/30'}`}
              >
                {/* --- IMAGE SECTION --- */}
                <div className="h-52 bg-zinc-100 dark:bg-zinc-900 relative overflow-hidden shrink-0">
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border backdrop-blur-md shadow-sm ${
                      item.station === 'Barista' ? 'bg-amber-900/60 text-amber-200 border-amber-500/30' : 
                      item.station === 'Barman' ? 'bg-blue-900/60 text-blue-200 border-blue-500/30' : 
                      'bg-emerald-900/60 text-emerald-200 border-emerald-500/30'
                    }`}>
                      {item.station || 'Kitchen'}
                    </span>
                    {isNew && (
                      <div className="bg-yellow-500 text-white text-[8px] font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-1 uppercase tracking-widest border border-white/10">
                        <Sparkles size={8} /> NEW
                      </div>
                    )}
                  </div>
                  
                  <img 
                    src={getImageSrc(item.image_url)} 
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    onError={(e) => { e.target.src = "https://via.placeholder.com/300?text=No+Image"; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-30" />
                </div>

                {/* --- CONTENT SECTION --- */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-2 text-left">
                    <h4 className={`text-lg font-serif font-bold uppercase tracking-tight leading-tight group-hover:text-yellow-600 transition-colors line-clamp-1 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                      {item.name}
                    </h4>
                    <p className={`text-[11px] font-light leading-relaxed line-clamp-2 italic ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {item.description || `Freshly prepared signature ${item.name}`}
                    </p>
                  </div>

                  {/* --- INTERACTION BAR (Order Left | Price Right) --- */}
                  <div className={`flex items-center justify-between pt-5 mt-4 border-t ${theme === 'dark' ? 'border-zinc-800/50' : 'border-zinc-50'}`}>
                    
                    {/* ACTION: ORDER BUTTON */}
                    <button 
                      onClick={() => onAddItem(item)}
                      className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 transition-all uppercase tracking-[0.2em] shadow-md active:scale-95"
                    >
                      <Plus size={12} strokeWidth={4} /> Order
                    </button>

                    {/* DISPLAY: PRICE */}
                    <div className="text-right">
                      <span className={`block text-xl font-black tracking-tighter leading-none ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                        {Number(item.price).toLocaleString()}
                      </span>
                      <span className="text-[9px] text-yellow-600 font-bold uppercase tracking-widest leading-none">
                        UGX
                      </span>
                    </div>

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}