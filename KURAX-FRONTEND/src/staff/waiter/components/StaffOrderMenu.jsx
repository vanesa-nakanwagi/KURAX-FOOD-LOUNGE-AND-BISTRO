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
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 px-3 sm:px-4 md:px-0">
      
      {/* 1. PERSISTENT CATEGORY NAV - FIXED FOR DESKTOP */}
      <div className={`flex flex-col border-b pb-1 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
        <div className="flex justify-center overflow-x-auto no-scrollbar">
          <div className="flex gap-6 sm:gap-8 md:gap-10 lg:gap-12 xl:gap-16">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`relative pb-2 md:pb-3 lg:pb-4 text-[10px] sm:text-[12px] md:text-[13px] lg:text-[12px] font-bold uppercase tracking-[0.25em] sm:tracking-[0.18em] md:tracking-[0.2em] lg:tracking-[0.25em] transition-all whitespace-nowrap
                  ${activeCategory === cat 
                    ? "text-yellow-500" 
                    : theme === 'dark' ? "text-black hover:text-white" : "font-medium hover:text-black"}`}
              >
                {cat}
                {activeCategory === cat && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 md:h-1 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.3)]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. CONDITIONAL CONTENT AREA */}
      {(!items || items.length === 0) ? (
        <div className={`py-16 sm:py-24 md:py-32 text-center border-2 border-dashed rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[3rem] mx-0 ${
          theme === 'dark' ? 'border-zinc-800 bg-zinc-900/20' : 'border-zinc-200 bg-zinc-50'
        }`}>
          <UtensilsCrossed className="mx-auto mb-3 md:mb-4 text-zinc-500 opacity-20" size={32} />
          <p className="text-zinc-500 text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em]">
            No Menu Items Available
          </p>
        </div>
      ) : 
      filteredMenus.length === 0 ? (
        <div className={`py-16 sm:py-20 md:py-24 flex flex-col items-center justify-center rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[3rem] border border-dashed mx-0 ${
          theme === 'dark' ? 'bg-zinc-900/30 border-white/5' : 'bg-zinc-50 border-black/5'
        }`}>
          <SearchX size={24} className="text-zinc-400 mb-2 opacity-50" />
          <p className="text-zinc-500 text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-wider md:tracking-widest text-center px-4">
            No matches in {activeCategory}
          </p>
        </div>
      ) : (
        /* --- RESPONSIVE GRID: Mobile:1, Tablet:2, Desktop:3 --- */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 lg:gap-8 pb-16 md:pb-20">
          {filteredMenus.map((item) => {
            const isNew = item.created_at && (new Date() - new Date(item.created_at)) / (1000 * 60 * 60) <= 48;

            return (
              <div 
                key={item.id} 
                className={`group relative rounded-2xl sm:rounded-[1.5rem] overflow-hidden flex flex-col h-full transition-all duration-300 md:duration-500 border shadow-[0_5px_15px_-10px_rgba(0,0,0,0.05)] md:shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] hover:shadow-xl md:hover:shadow-2xl active:scale-[0.99] md:hover:-translate-y-2
                  ${theme === 'dark' 
                    ? 'bg-[#0A0A0A] border-zinc-800/40 hover:border-yellow-500/30' 
                    : 'bg-white border-zinc-100 hover:border-yellow-500/30'}`}
              >
                {/* --- IMAGE SECTION --- */}
                <div className="h-44 sm:h-48 md:h-52 bg-zinc-100 dark:bg-zinc-900 relative overflow-hidden shrink-0">
                  <div className="absolute top-2 sm:top-3 md:top-4 left-2 sm:left-3 md:left-4 right-2 sm:right-3 md:right-4 flex justify-between items-start z-10 gap-1">
                    <span className={`flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-0.5 md:px-2.5 md:py-1 rounded-md md:rounded-lg text-[6px] sm:text-[7px] md:text-[8px] font-black uppercase tracking-wider md:tracking-widest border backdrop-blur-md shadow-sm ${
                      item.station === 'Barista' ? 'bg-amber-900/60 text-amber-200 border-amber-500/30' : 
                      item.station === 'Barman' ? 'bg-blue-900/60 text-blue-200 border-blue-500/30' : 
                      'bg-emerald-900/60 text-emerald-200 border-emerald-500/30'
                    }`}>
                      {item.station?.substring(0, 6) || 'Kitchen'}
                    </span>
                    {isNew && (
                      <div className="bg-yellow-500 text-black text-[6px] sm:text-[7px] md:text-[8px] font-black px-1.5 py-0.5 sm:px-2 sm:py-0.5 md:px-3 md:py-1 rounded-full shadow-lg flex items-center gap-0.5 md:gap-1 uppercase tracking-wider md:tracking-widest border border-white/10">
                        <Sparkles size={6} className="sm:w-1 sm:h-1 md:w-2 md:h-2" /> NEW
                      </div>
                    )}
                  </div>
                  
                  <img 
                    src={getImageSrc(item.image_url)} 
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-700 md:duration-1000 group-hover:scale-105 md:group-hover:scale-110"
                    onError={(e) => { e.target.src = "https://via.placeholder.com/300?text=No+Image"; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-30" />
                </div>

                {/* --- CONTENT SECTION --- */}
                <div className="p-3 sm:p-4 md:p-5 lg:p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className={`text-sm sm:text-base md:text-lg font-[Outfit] uppercase tracking-tight leading-tight transition-colors line-clamp-2 sm:line-clamp-1
                      ${theme === 'dark' ? 'text-white' : 'text-yellow-900'}`}>
                      {item.name}
                    </h4>
                    <p className={`text-[11px] sm:text-[12px] md:text-[14px] font-light leading-relaxed mt-1 sm:mt-1.5 md:mt-2 line-clamp-2 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {item.description?.substring(0, 80) || `Freshly prepared signature ${item.name}`}
                      {item.description?.length > 80 && '...'}
                    </p>
                  </div>

                  {/* --- INTERACTION BAR (Order Left | Price Right) --- */}
                  <div className={`flex items-center justify-between pt-3 sm:pt-4 md:pt-5 mt-2 sm:mt-3 md:mt-4 border-t ${theme === 'dark' ? 'border-zinc-800/50' : 'border-zinc-100'}`}>
                    
                    {/* ACTION: ORDER BUTTON - Responsive */}
                    <button 
                      onClick={() => onAddItem(item)}
                      className="px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-2.5 lg:px-5 lg:py-2.5 bg-yellow-400 hover:bg-yellow-600 text-black rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] md:text-[10px] flex items-center justify-center gap-1 sm:gap-1.5 transition-all uppercase tracking-[0.1em] sm:tracking-[0.15em] md:tracking-[0.2em] shadow-md active:scale-95"
                    >
                      <Plus size={10} strokeWidth={4} className="sm:w-2.5 sm:h-2.5 md:w-3 md:h-3" /> 
                      <span className="hidden xs:inline text-[8px] sm:text-[9px] md:text-[10px]">Order Now</span>
                      <span className="xs:hidden text-[8px]">+</span>
                    </button>

                    {/* DISPLAY: PRICE */}
                    <div className="text-right">
                      <span className={`block text-base sm:text-lg md:text-xl tracking-tighter leading-none ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                        {Number(item.price).toLocaleString()}
                      </span>
                      <span className="text-[6px] sm:text-[7px] md:text-[9px] text-yellow-600 font-bold uppercase tracking-wider md:tracking-widest leading-none">
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