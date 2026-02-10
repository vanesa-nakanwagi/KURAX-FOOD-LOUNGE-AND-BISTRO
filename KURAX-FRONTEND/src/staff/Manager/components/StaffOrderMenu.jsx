import React, { useState } from "react";
import { useData } from "../../../customer/components/context/DataContext";
// 1. Import your Theme Context hook
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { Plus, SearchX, UtensilsCrossed, Sun, Moon } from "lucide-react";

export default function StaffOrderMenu({ onAddItem, searchQuery = "" }) {
  const { menus = [] } = useData() || {};
  // 2. Access theme and toggle function
  const { theme, toggleTheme } = useTheme();
  
  const [activeCategory, setActiveCategory] = useState("Starters");
  const categories = ["Starters", "Local Foods", "Drinks and Cocktails"];

  const filteredMenus = menus.filter((item) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      item.name.toLowerCase().includes(query) || 
      (item.category && item.category.toLowerCase().includes(query));
    
    const matchesCategory = item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (!menus || menus.length === 0) {
    return (
      <div className={`col-span-full py-20 text-center border-2 border-dashed rounded-3xl ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
        <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Database is empty</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER ACTIONS: Category Nav + Theme Toggle */}
      <div className={`flex flex-col md:flex-row items-center justify-between border-b pb-1 gap-6 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
        
        {/* CENTERED CATEGORY NAV */}
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
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full animate-in fade-in slide-in-from-bottom-1 duration-300" />
                )}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* GRID SECTION */}
      {filteredMenus.length === 0 ? (
        <div className={`py-60 flex flex-col items-center justify-center rounded-[2.5rem] border ${theme === 'dark' ? 'bg-zinc-900/30 border-white/5' : 'bg-zinc-50 border-black/5'}`}>
          <SearchX size={40} className="text-zinc-400 mb-3" />
          <p className="text-zinc-500 text-sm font-bold italic tracking-tighter">
            No items in {activeCategory} match "{searchQuery}"
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2.5 gap-6 md:gap-8">
          {filteredMenus.map((item) => (
            <div 
              key={item.id} 
              className={`group border rounded-3xl overflow-hidden transition-all flex flex-col shadow-xl
                ${theme === 'dark' 
                  ? 'bg-zinc-900/50 border-white/5 hover:border-yellow-500/40' 
                  : 'bg-white border-black/5 hover:border-yellow-500/40 shadow-zinc-200/50'}`}
            >
              {/* Image Section */}
              <div className="h-48 md:h-56 bg-zinc-800 relative overflow-hidden">
                {item.image ? (
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
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
                  <h4 className={`text-base md:text-lg font-black uppercase tracking-tight leading-tight transition-colors ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                    {item.name}
                  </h4>
                  <p className="text-yellow-600 text-sm md:text-base font-black tracking-tighter whitespace-nowrap">
                    UGX {Number(item.price).toLocaleString()}
                  </p>
                </div>
                
                <p className={`text-[11px] line-clamp-2 mb-6 italic leading-relaxed transition-colors ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
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
          ))}
        </div>
      )}
    </div>
  );
}