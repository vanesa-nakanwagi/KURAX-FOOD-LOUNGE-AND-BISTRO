import React, { useState } from "react";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { Plus, SearchX, UtensilsCrossed, Sparkles } from "lucide-react";
import { getImageSrc } from "../../../utils/imageHelper";
import { formatMenuName } from "../../../utils/menuName.js";
import { applyDrinkServing, getDrinkServingOptions, isEligibleDrink } from "../../drinkServing.js";

export default function StaffOrderMenu({ onAddItem, items = [], searchQuery = "", activeCategory, setActiveCategory }) {
  const { theme } = useTheme();
  const [selectedServings, setSelectedServings] = useState({});
  const categories = ["Fast Foods", "Local Foods", "Drinks & Cocktails"];

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
        /* GRID: 1 col mobile, 2 col tablet, 4 col desktop */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5 pb-20">
          {filteredMenus.map((item) => {
            const displayName = formatMenuName(item.name);
            const isNew =
              item.created_at &&
              (new Date() - new Date(item.created_at)) / (1000 * 60 * 60) <= 48;
            const originalPrice = Number(item.list_price ?? item.price);
            const currentPrice = Number(item.price);
            const promotionActive = item.promotion_active === true || item.promotion_active === "true";
            const drinkOptions = isEligibleDrink(item) ? getDrinkServingOptions(item) : [];
            const selectedServing = selectedServings[item.id] || drinkOptions[0];
            const displayPrice = currentPrice;
            const displayOriginalPrice = originalPrice;
            const hasPromotion = promotionActive && Number.isFinite(displayOriginalPrice) && displayOriginalPrice > displayPrice;

            return (
              <div
                key={item.id}
                className={`group relative font-outfit flex h-full flex-col rounded-[1rem] overflow-hidden shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] hover:shadow-2xl border transition-all duration-500 hover:-translate-y-2
                  ${
                    theme === "dark"
                      ? "bg-[#0A0A0A] border-zinc-800/40 hover:border-yellow-500/30"
                      : "bg-white border-zinc-100 hover:border-yellow-500/30"
                  }`}
              >
                {/* IMAGE */}
                <div className="relative h-52 overflow-hidden bg-zinc-50 dark:bg-[#1a1a1a] shrink-0">
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
                    alt={displayName}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    onError={(e) => {
                      e.target.src = "https://via.placeholder.com/300?text=No+Image";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </div>

                {/* CONTENT */}
                <div className="flex flex-1 flex-col p-4">
                  <div className="text-left">
                    <h4 className="h-10 overflow-hidden line-clamp-2 text-lg font-semibold leading-5 tracking-normal text-yellow-700 transition-colors group-hover:text-yellow-700 dark:text-yellow-300 dark:group-hover:text-yellow-200">
                      {displayName}
                    </h4>
                    <p
                      className={`h-12 text-[14px] font-light leading-relaxed line-clamp-2 ${
                        theme === "dark" ? "text-zinc-400" : "text-zinc-900"
                      }`}
                    >
                      {item.description?.substring(0, 80) ||
                        `Freshly prepared signature ${displayName}`}
                      {item.description?.length > 80 && "..."}
                    </p>
                  </div>

                  {/* INTERACTION BAR */}
                  {drinkOptions.length > 0 && (
                    <div className="mb-3">
                      <label className="mb-1 block text-[9px] font-black uppercase tracking-widest text-zinc-500">Select Serving</label>
                      <select
                        value={selectedServing ? `${selectedServing.name}|${selectedServing.volumeMl}` : ""}
                        onChange={(event) => {
                          const [name, volumeMl] = event.target.value.split("|");
                          setSelectedServings((previous) => ({ ...previous, [item.id]: { name, volumeMl: Number(volumeMl) } }));
                        }}
                        className={`w-full rounded-xl border px-3 py-2 text-xs font-bold outline-none ${theme === "dark" ? "border-zinc-700 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-900"}`}
                      >
                        {drinkOptions.map((option) => (
                          <option key={`${option.name}|${option.volumeMl}`} value={`${option.name}|${option.volumeMl}`}>
                            {option.name} ({option.volumeMl.toLocaleString()} ml)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div
                    className={`mt-auto flex items-center justify-between border-t pt-3 ${
                      theme === "dark" ? "border-zinc-800/50" : "border-zinc-200"
                    }`}
                  >
                    {/* ORDER BUTTON — always shows icon + text */}
                    <button
                      onClick={() => onAddItem(drinkOptions.length ? applyDrinkServing(item, selectedServing) : item)}
                      className="flex items-center gap-1 px-3 py-2.5 bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-600 text-black text-[10px] uppercase tracking-[0.2em] rounded-xl transition-all duration-300 shadow-md active:scale-95"
                    >
                      <Plus size={11} strokeWidth={3.5} />
                      Add to Cart
                    </button>

                    {/* PRICE */}
                    <div className="text-right">
                      {hasPromotion && (
                        <span className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300 line-through decoration-red-600 decoration-2">
                          {displayOriginalPrice.toLocaleString()}
                        </span>
                      )}
                      <span
                        className={`block text-xl tracking-tighter leading-none ${
                          hasPromotion ? "text-red-600 dark:text-red-400" : theme === "dark" ? "text-white" : "text-zinc-900"
                        }`}
                      >
                        {displayPrice.toLocaleString()}
                      </span>
                      <span className="text-[8px] sm:text-[9px] text-yellow-600 font-bold uppercase tracking-wider leading-none">
                        UGX
                      </span>
                      {hasPromotion && (
                        <span className="mt-1 block text-[8px] font-bold uppercase tracking-wider leading-none text-red-600 dark:text-red-400">
                          Limited-time offer
                        </span>
                      )}
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