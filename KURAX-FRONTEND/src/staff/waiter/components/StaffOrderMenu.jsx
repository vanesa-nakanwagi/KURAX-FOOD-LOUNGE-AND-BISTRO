import React, { useMemo, useState } from "react";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { Plus, SearchX, UtensilsCrossed, Sparkles } from "lucide-react";
import { getImageSrc } from "../../../utils/imageHelper";
import { formatMenuName } from "../../../utils/menuName.js";
import { getDrinkStationLabel } from "../../../utils/menuStation.js";
import { applyDrinkServing, getDrinkServingOptions, isEligibleDrink } from "../../drinkServing.js";

// Helper: determine which tab this item belongs to (case‑insensitive, trimmed)
export const getEffectiveCategory = (item) => {
  const station = String(item.station ?? "").trim().toLowerCase();
  // Barista / Barman always go to Drinks & Cocktails
  if (station === "barista" || station === "barman") {
    return "Drinks & Cocktails";
  }
  // Otherwise use the original category (with fallback)
  const category = String(item.category ?? "").trim().toLowerCase();
  if (category === "fast foods") return "Fast Foods";
  if (category === "local foods") return "Local Foods";
  if (category === "drinks & cocktails") {
    return "Drinks & Cocktails";
  }
  return "Fast Foods";
};

export default function StaffOrderMenu({ onAddItem, items = [], searchQuery = "", activeCategory, setActiveCategory }) {
  const { theme } = useTheme();
  const [selectedServings, setSelectedServings] = useState({});
  const categories = ["Fast Foods", "Local Foods", "Drinks & Cocktails"];

  // --- DEBUG: collect raw station values from first few items ---
  const stationDebug = useMemo(() => {
    if (!items.length) return "No items";
    const firstFew = items.slice(0, 5).map(i => `${i.name}: station="${i.station}" (category="${i.category}")`);
    return firstFew.join(" | ");
  }, [items]);

  // Count per effective category
  const categoryCounts = useMemo(() => {
    const counts = { "Fast Foods": 0, "Local Foods": 0, "Drinks & Cocktails": 0 };
    items.forEach(item => {
      const effective = getEffectiveCategory(item);
      if (counts[effective] !== undefined) counts[effective]++;
    });
    console.log("📊 Category counts (effective):", counts);
    console.log("🔎 Raw station samples:", items.slice(0, 5).map(i => ({ name: i.name, station: i.station, category: i.category })));
    return counts;
  }, [items]);

  const filteredMenus = items.filter((item) => {
    const matchesQuery = String(item?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = getEffectiveCategory(item).toLowerCase() === activeCategory.toLowerCase();
    return matchesQuery && matchesCategory;
  });

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500 px-3 sm:px-4 md:px-0">

      {/* CATEGORY NAV */}
      <div className={`border-b ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex gap-5 sm:gap-8 md:gap-10 lg:gap-12 min-w-max px-1 md:min-w-0 md:w-full md:justify-center">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`relative pb-2.5 md:pb-3 text-[10px] sm:text-[11px] md:text-[13px] font-bold uppercase tracking-[0.2em] transition-all whitespace-nowrap
                  ${activeCategory === cat ? "text-yellow-500" : theme === "dark" ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-black"}`}
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

      {/* CONTENT AREA */}
      {!items || items.length === 0 ? (
        <div className={`py-16 text-center border-2 border-dashed rounded-2xl ${theme === "dark" ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-200 bg-zinc-50"}`}>
          <UtensilsCrossed className="mx-auto mb-3 text-zinc-500 opacity-20" size={28} />
          <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.25em]">No Menu Items Available</p>
        </div>
      ) : filteredMenus.length === 0 ? (
        <div className={`py-16 flex flex-col items-center justify-center rounded-2xl border border-dashed ${theme === "dark" ? "bg-zinc-900/30 border-white/5" : "bg-zinc-50 border-black/5"}`}>
          <SearchX size={22} className="text-zinc-400 mb-2 opacity-50" />
          <p className="text-zinc-500 text-[9px] font-black uppercase tracking-wider text-center px-4">
            No matches in {activeCategory}
          </p>
          {/* DEBUG: Show raw station values */}
          <div className="mt-4 text-[9px] text-zinc-400 max-w-xs text-center break-words">
            <span className="font-mono">{stationDebug}</span>
          </div>
          <div className="text-[8px] text-zinc-500 mt-2">
            (Category counts: Fast Foods={categoryCounts["Fast Foods"]}, Local={categoryCounts["Local Foods"]}, Drinks={categoryCounts["Drinks & Cocktails"]})
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5 pb-6">
          {filteredMenus.map((item) => {
            const displayName = formatMenuName(item.name);
            const isNew = item.created_at && (new Date() - new Date(item.created_at)) / (1000 * 60 * 60) <= 168;
            const originalPrice = Number(item.list_price ?? item.price);
            const currentPrice = Number(item.price);
            const promotionActive = item.promotion_active === true || item.promotion_active === "true";
            const drinkOptions = isEligibleDrink(item) ? getDrinkServingOptions(item) : [];
            const selectedServing = selectedServings[item.id] || drinkOptions[0];
            const displayPrice = currentPrice;
            const displayOriginalPrice = originalPrice;
            const hasPromotion = promotionActive && Number.isFinite(displayOriginalPrice) && displayOriginalPrice > displayPrice;
            const drinkStation = getDrinkStationLabel(item);
            return (
              <div
                key={item.id}
                className={`group relative font-outfit flex h-full flex-col rounded-[1rem] overflow-hidden shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] hover:shadow-2xl border transition-all duration-500 hover:-translate-y-2
                  ${theme === "dark" ? "bg-[#0A0A0A] border-zinc-800/40" : "bg-white border-zinc-100"}`}
              >
                <div className="relative h-52 overflow-hidden bg-zinc-50 dark:bg-[#1a1a1a] shrink-0">
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-end items-start z-10">
                    {drinkStation && (
                      <span className={`mr-auto rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider shadow ${
                        drinkStation === "BARISTA"
                          ? "border-amber-300/50 bg-amber-950/80 text-amber-100"
                          : "border-blue-300/50 bg-blue-950/80 text-blue-100"
                      }`}>
                        {drinkStation}
                      </span>
                    )}
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
                    onError={(e) => { e.target.src = "https://via.placeholder.com/300?text=No+Image"; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="text-left">
                    <h4 className="h-10 overflow-hidden line-clamp-2 text-lg font-semibold leading-5 tracking-normal text-yellow-700 transition-colors group-hover:text-yellow-700 dark:text-yellow-300 dark:group-hover:text-yellow-200">
                      {displayName}
                    </h4>
                    <p className={`h-12 text-[14px] font-light leading-relaxed line-clamp-2 ${theme === "dark" ? "text-zinc-400" : "text-zinc-900"}`}>
                      {item.description?.substring(0, 80) || `Freshly prepared signature ${displayName}`}
                      {item.description?.length > 80 && "..."}
                    </p>
                  </div>
                  {drinkOptions.length > 0 && (
                    <div className="mb-3">
                      <label className="mb-1 block text-[9px] font-black uppercase tracking-widest text-zinc-500">
                        Select Serving
                      </label>
                      <select
                        value={selectedServing ? `${selectedServing.name}|${selectedServing.volumeMl}` : ""}
                        onChange={(event) => {
                          const [name, volumeMl] = event.target.value.split("|");
                          setSelectedServings((previous) => ({
                            ...previous,
                            [item.id]: { name, volumeMl: Number(volumeMl) },
                          }));
                        }}
                        className={`w-full rounded-xl border px-3 py-2 text-xs font-bold outline-none ${
                          theme === "dark"
                            ? "border-zinc-700 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-900"
                        }`}
                      >
                        {drinkOptions.map((option) => (
                          <option key={`${option.name}|${option.volumeMl}`} value={`${option.name}|${option.volumeMl}`}>
                            {option.name} ({option.volumeMl.toLocaleString()} ml)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className={`mt-auto flex items-center justify-between border-t pt-3 ${theme === "dark" ? "border-zinc-800/50" : "border-zinc-200"}`}>
                    <button
                      onClick={() => onAddItem(drinkOptions.length ? applyDrinkServing(item, selectedServing) : item)}
                      className="flex items-center gap-1 px-3 py-2.5 bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-600 text-black text-[10px] uppercase tracking-[0.2em] rounded-xl transition-all duration-300 shadow-md active:scale-95"
                    >
                      <Plus size={11} strokeWidth={3.5} />
                      Add to Cart
                    </button>
                    <div className="text-right">
                      {hasPromotion && (
                        <span className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300 line-through decoration-red-600 decoration-2">
                          {displayOriginalPrice.toLocaleString()}
                        </span>
                      )}
                      <span className={`block text-xl tracking-tighter leading-none ${hasPromotion ? "text-red-600 dark:text-red-400" : theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                        {displayPrice.toLocaleString()}
                      </span>
                      <span className="text-[8px] sm:text-[9px] text-yellow-600 font-bold uppercase tracking-wider leading-none">UGX</span>
                      {hasPromotion && (
                        <span className="mt-1 block text-[8px] font-bold uppercase tracking-wider leading-none text-red-600">
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