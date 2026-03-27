import React from "react";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { 
  Plus, SearchX, UtensilsCrossed, Coffee, Wine, 
  Sparkles, Lock 
} from "lucide-react";
import { getImageSrc } from "../../../utils/imageHelper";

export default function ManagerOrderMenu({ 
  onAddItem, 
  items = [], 
  searchQuery = "", 
  activeCategory, 
  setActiveCategory,
  isGranted = true 
}) {
  const { theme } = useTheme();
  const categories = ["Starters", "Local Foods", "Drinks & Cocktails"];

  const filteredMenus = items.filter((item) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(query) ||
                         (item.category && item.category.toLowerCase().includes(query));
    const matchesCategory = item.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      
      {/* 1. CATEGORY NAVIGATION - MOVED OUTSIDE ANY CHECKS */}
      {/* This ensures the bar stays visible even if the category is empty */}
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

      {/* 2. CONDITIONAL CONTENT AREA */}
      {!items || items.length === 0 ? (
        <div className={`py-32 text-center border-2 border-dashed rounded-[3rem] ${
          theme === 'dark' ? 'border-white/5 bg-zinc-900/20' : 'border-black/5 bg-zinc-50'
        }`}>
          <UtensilsCrossed className="mx-auto mb-4 text-zinc-500 opacity-20" size={48} />
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">
            Menu Database Offline
          </p>
        </div>
      ) : filteredMenus.length === 0 ? (
        /* Empty State for specific category - Nav stays visible above this */
        <div className={`py-24 flex flex-col items-center justify-center rounded-[3rem] border border-dashed ${
          theme === 'dark' ? 'bg-zinc-900/30 border-white/5' : 'bg-zinc-50 border-black/5'
        }`}>
          <SearchX size={32} className="text-zinc-500/20 mb-4" />
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest italic">
            No items in {activeCategory} match "{searchQuery}"
          </p>
        </div>
      ) : (
        /* Grid Section */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 pb-20">
          {filteredMenus.map((item) => {
            const isNew = item.created_at && (new Date() - new Date(item.created_at)) / (1000 * 60 * 60) <= 48;

            return (
              <div 
                key={item.id} 
                className={`group border rounded-[2rem] overflow-hidden transition-all flex flex-col hover:shadow-xl hover:-translate-y-1 h-full
                  ${theme === 'dark' 
                    ? 'bg-[#111111] border-zinc-800 hover:border-yellow-500/30' 
                    : 'bg-white border-zinc-100 hover:border-yellow-500/30 shadow-sm'}`}
              >
                {/* Image Section */}
                <div className="h-44 md:h-48 bg-zinc-50 dark:bg-zinc-900 relative overflow-hidden shrink-0">
                  <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border backdrop-blur-md shadow-sm ${
                      item.station === 'Barista' ? 'bg-amber-900/60 text-amber-200 border-amber-500/30' : 
                      item.station === 'Barman' ? 'bg-blue-900/60 text-blue-200 border-blue-500/30' : 
                      'bg-emerald-900/60 text-emerald-200 border-emerald-500/30'
                    }`}>
                      {item.station || 'Kitchen'}
                    </span>
                    {isNew && (
                      <div className="bg-yellow-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                        NEW
                      </div>
                    )}
                  </div>
                  <img src={getImageSrc(item.image_url)} alt={item.name} className="w-full h-full object-cover" />
                </div>

                {/* Details Section */}
                <div className="p-4 md:p-5 flex-1 flex flex-col items-start text-left">
                  <div className="w-full flex justify-between items-start gap-2 mb-2 min-h-[2.5rem]">
                    <h4 className={`text-sm md:text-base font-medium uppercase tracking-tight leading-tight flex-1 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                      {item.name}
                    </h4>
                    <span className="text-yellow-500 font-black tracking-tighter">
                      {Number(item.price).toLocaleString()}
                    </span>
                  </div>
                  
                  <p className={`text-[11px] md:text-xs line-clamp-2 mb-4 h-8 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {item.description}
                  </p>

                  {isGranted ? (
                    <button onClick={() => onAddItem(item)} className="mt-auto w-full py-2.5 bg-[#FFD700] rounded-xl text-[9px] font-black uppercase tracking-[0.15em]">
                      Add To Order
                    </button>
                  ) : (
                    <div className="mt-auto w-full py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-xl text-[8px] font-black text-center uppercase">
                      Restricted
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