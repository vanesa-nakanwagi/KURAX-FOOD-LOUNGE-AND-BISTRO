import React from "react";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { Plus, SearchX, UtensilsCrossed, Sparkles } from "lucide-react";
import { getImageSrc } from "../../../utils/imageHelper";

export default function StaffOrderMenu({ onAddItem, items = [], searchQuery = "", activeCategory, setActiveCategory }) {
  const { theme } = useTheme();
  const categories = ["Starters", "Local Foods", "Drinks & Cocktails"];

  const filteredMenus = items.filter((item) => {
    const query = searchQuery.toLowerCase();
    const matchesQuery =
      item.name.toLowerCase().includes(query) ||
      (item.category && item.category.toLowerCase().includes(query));
    const matchesCategory = item.category === activeCategory;
    return matchesQuery && matchesCategory;
  });

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500 px-3 sm:px-4 md:px-0">

      {/* 1. CATEGORY NAV — scrollable, starts left-aligned on mobile */}
      <div className={`border-b ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex gap-5 sm:gap-8 md:gap-10 lg:gap-12 min-w-max px-1 md:min-w-0 md:w-full md:justify-center">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`relative pb-2.5 md:pb-3 text-[10px] sm:text-[11px] md:text-[13px] font-bold uppercase tracking-[0.2em] transition-all whitespace-nowrap
                  ${
                    activeCategory === cat
                      ? "text-yellow-500"
                      : theme === "dark"
                      ? "text-zinc-400 hover:text-white"
                      : "text-zinc-500 hover:text-black"
                  }`}
              >
                {cat}
                {activeCategory === cat && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.4)]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. CONTENT AREA */}
      {!items || items.length === 0 ? (
        <div
          className={`py-16 text-center border-2 border-dashed rounded-2xl ${
            theme === "dark" ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-200 bg-zinc-50"
          }`}
        >
          <UtensilsCrossed className="mx-auto mb-3 text-zinc-500 opacity-20" size={28} />
          <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.25em]">
            No Menu Items Available
          </p>
        </div>
      ) : filteredMenus.length === 0 ? (
        <div
          className={`py-16 flex flex-col items-center justify-center rounded-2xl border border-dashed ${
            theme === "dark" ? "bg-zinc-900/30 border-white/5" : "bg-zinc-50 border-black/5"
          }`}
        >
          <SearchX size={22} className="text-zinc-400 mb-2 opacity-50" />
          <p className="text-zinc-500 text-[9px] font-black uppercase tracking-wider text-center px-4">
            No matches in {activeCategory}
          </p>
        </div>
      ) : (
        /* GRID: 1 col mobile, 2 col tablet, 3 col desktop */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 lg:gap-8 pb-20">
          {filteredMenus.map((item) => {
            const isNew =
              item.created_at &&
              (new Date() - new Date(item.created_at)) / (1000 * 60 * 60) <= 48;

            return (
              <div
                key={item.id}
                className={`group relative rounded-2xl overflow-hidden flex flex-col transition-all duration-300 border shadow-sm hover:shadow-xl active:scale-[0.99] md:hover:-translate-y-1
                  ${
                    theme === "dark"
                      ? "bg-[#0A0A0A] border-zinc-800/40 hover:border-yellow-500/30"
                      : "bg-white border-zinc-100 hover:border-yellow-500/30"
                  }`}
              >
                {/* IMAGE */}
                <div className="h-40 sm:h-44 md:h-48 relative overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-900">
                  {/* Badges */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between items-start z-10">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider backdrop-blur-md border shadow-sm ${
                        item.station === "Barista"
                          ? "bg-amber-900/70 text-amber-200 border-amber-500/30"
                          : item.station === "Barman"
                          ? "bg-blue-900/70 text-blue-200 border-blue-500/30"
                          : "bg-emerald-900/70 text-emerald-200 border-emerald-500/30"
                      }`}
                    >
                      {item.station?.substring(0, 7) || "Kitchen"}
                    </span>
                    {isNew && (
                      <div className="bg-yellow-500 text-black text-[9px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider border border-white/10 shadow">
                        <Sparkles size={8} /> NEW
                      </div>
                    )}
                  </div>

                  <img
                    src={getImageSrc(item.image_url)}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={(e) => {
                      e.target.src = "https://via.placeholder.com/300?text=No+Image";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </div>

                {/* CONTENT */}
                <div className="p-3.5 sm:p-4 md:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4
                      className={`text-sm sm:text-base md:text-lg font-[Outfit] uppercase tracking-tight leading-tight line-clamp-1 ${
                        theme === "dark" ? "text-white" : "text-yellow-900"
                      }`}
                    >
                      {item.name}
                    </h4>
                    <p
                      className={`text-[11px] sm:text-[12px] leading-relaxed mt-1.5 line-clamp-2 ${
                        theme === "dark" ? "text-zinc-400" : "text-zinc-500"
                      }`}
                    >
                      {item.description?.substring(0, 80) ||
                        `Freshly prepared signature ${item.name}`}
                      {item.description?.length > 80 && "..."}
                    </p>
                  </div>

                  {/* INTERACTION BAR */}
                  <div
                    className={`flex items-center justify-between pt-3 mt-3 border-t ${
                      theme === "dark" ? "border-zinc-800/50" : "border-zinc-100"
                    }`}
                  >
                    {/* ORDER BUTTON — always shows icon + text */}
                    <button
                      onClick={() => onAddItem(item)}
                      className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-yellow-400 hover:bg-yellow-500 active:bg-yellow-600 text-black rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] shadow-md active:scale-95 transition-all"
                    >
                      <Plus size={11} strokeWidth={3.5} />
                      Order Now
                    </button>

                    {/* PRICE */}
                    <div className="text-right">
                      <span
                        className={`block text-base sm:text-lg md:text-xl font-semibold tracking-tight leading-none ${
                          theme === "dark" ? "text-white" : "text-zinc-900"
                        }`}
                      >
                        {Number(item.price).toLocaleString()}
                      </span>
                      <span className="text-[8px] sm:text-[9px] text-yellow-600 font-bold uppercase tracking-wider leading-none">
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