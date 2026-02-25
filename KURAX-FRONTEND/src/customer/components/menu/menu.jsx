import { useState, useEffect, useMemo } from "react";
import { Plus, Sparkles, ChevronRight } from "lucide-react";
import { useLocation } from "react-router-dom";
import CartModal from "./cart/CartModal.jsx";
import TopSection from "../common/topSection.jsx";
import { useCart } from "../context/CartContext.jsx";
import axios from "axios";
import { getImageSrc } from "../../../utils/imageHelper.js";

/* =========================
   MENU CARD
========================= */
function MenuCard({ item, onOrder, index }) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div
      className="group font-['Outfit'] relative bg-white dark:bg-[#111111] rounded-[2rem] overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-2 border border-transparent hover:border-yellow-500/20 shadow-sm hover:shadow-xl"
    >
      {/* IMAGE - Removed Category Badge */}
      <div className="relative h-48 md:h-56 overflow-hidden bg-zinc-100 dark:bg-[#1a1a1a]">
        {!imgLoaded && (
          <div className="absolute inset-0 bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        )}

        <img
          src={getImageSrc(item.image_url)}
          alt={item.name}
          onLoad={() => setImgLoaded(true)}
          className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${
            imgLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      </div>

      {/* CONTENT */}
      <div className="p-5 md:p-6 flex-1 flex flex-col gap-3 md:gap-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xl md:text-2xl font-semibold text-zinc-900 dark:text-white leading-tight">
            {item.name}
          </h4>

          <div className="text-right shrink-0">
            <span className="text-base md:text-lg text-yellow-600 dark:text-yellow-400 font-bold">
              {Number(item.price).toLocaleString()}
            </span>
            <div className="text-[8px] md:text-[9px] tracking-widest text-zinc-400 uppercase">
              UGX
            </div>
          </div>
        </div>

        <p className="text-xs md:text-[13px] text-zinc-500 dark:text-zinc-400 italic line-clamp-2 leading-relaxed">
          {item.description || "A signature dish prepared fresh at Kurax Food Lounge."}
        </p>

        <button
          onClick={() => onOrder(item)}
          className="mt-2 md:mt-auto w-full py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-yellow-400 dark:bg-white text-black dark:text-zinc-900 text-[10px] md:text-xs font-bold uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Plus size={14} strokeWidth={3} />
          Add to Order
        </button>
      </div>
    </div>
  );
}

/* =========================
   MAIN MENU
========================= */
export default function Menu() {
  const [dbMenus, setDbMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Starters");

  const {
    cart, isCartOpen, setIsCartOpen, activeDish, setActiveDish,
    handleAddToCart, handleRemoveFromCart, handleQuantityChange,
    totalAmount, checkoutStep, setCheckoutStep, customerDetails, setCustomerDetails,
  } = useCart();

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/menus");
        setDbMenus(res.data);
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMenus();
  }, []);

  const categories = ["Starters", "Local Foods", "Drinks & Cocktails"];
  const filteredMenus = dbMenus.filter((item) => item.category === selectedCategory);

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="font-['Outfit'] bg-[#F9F9F7] dark:bg-[#080808] text-zinc-900 dark:text-white min-h-screen transition-colors duration-500">
      
      {/* NAVBAR */}
      <div className="sticky top-0 z-50 bg-[#F9F9F7]/90 dark:bg-[#080808]/90 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50">
        <TopSection searchPlaceholder="Search flavors..." />

        {/* MOBILE FRIENDLY CATEGORY SCROLL */}
        <div className="flex justify-start md:justify-center gap-4 md:gap-12 px-4 md:px-6 py-4 overflow-x-auto no-scrollbar scroll-smooth">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`relative text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] md:tracking-[0.25em] pb-2 whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "text-zinc-900 dark:text-white scale-105"
                  : "text-zinc-400 dark:text-zinc-600"
              }`}
            >
              {cat}
              {selectedCategory === cat && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-yellow-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* HERO SECTION - Responsive text sizes */}
      <header className="max-w-7xl mx-auto px-5 md:px-12 pt-8 md:pt-16 pb-8 md:pb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-yellow-500">
            <Sparkles size={12} />
            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] md:tracking-[0.4em]">
              Explore Menu
            </span>
          </div>

          <h2 className="text-4xl md:text-7xl font-light tracking-tight">
            {selectedCategory.split(' ')[0]} <span className="italic opacity-50">{selectedCategory.split(' ').slice(1).join(' ')}</span>
          </h2>
        </div>

        <div className="flex items-center gap-4 border-l border-zinc-200 dark:border-zinc-800 pl-5 md:pl-6 h-fit">
          <div className="text-right">
            <p className="text-[8px] md:text-[9px] uppercase tracking-widest text-zinc-400">
             Available  Selection
            </p>
            <p className="text-xl md:text-2xl font-semibold">
              {filteredMenus.length} Dishes
            </p>
          </div>
          <ChevronRight className="text-zinc-300 dark:text-zinc-700 hidden md:block" />
        </div>
      </header>

      {/* MAIN GRID - Optimized for small screens (1 column on tiny phones, 2 on phablets) */}
      <main className="max-w-7xl mx-auto px-5 md:px-12 pb-24 md:pb-32">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {[...Array(4)].map((_, i) => <div key={i} className="h-80 bg-zinc-100 dark:bg-zinc-900 rounded-[2rem] animate-pulse" />)}
          </div>
        ) : filteredMenus.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-[2.5rem]">
            <p className="italic text-zinc-400">Chef is preparing more...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {filteredMenus.map((item, i) => (
              <MenuCard
                key={item.id}
                item={item}
                index={i}
                onOrder={(it) => {
                  setActiveDish({ ...it, quantity: 1 });
                  setIsCartOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* MODAL */}
      {(activeDish || isCartOpen) && (
        <CartModal
          isCartOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          activeDish={activeDish}
          setActiveDish={setActiveDish}
          cart={cart}
          handleAddToCart={handleAddToCart}
          handleRemoveFromCart={handleRemoveFromCart}
          handleQuantityChange={handleQuantityChange}
          totalAmount={totalAmount}
          checkoutStep={checkoutStep}
          setCheckoutStep={setCheckoutStep}
          customerDetails={customerDetails}
          setCustomerDetails={setCustomerDetails}
        />
      )}
    </div>
  );
}