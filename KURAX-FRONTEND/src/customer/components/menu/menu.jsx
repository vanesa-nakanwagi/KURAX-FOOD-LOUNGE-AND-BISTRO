import { useState, useEffect } from "react";
import { Plus, Sparkles } from "lucide-react";
import CartModal from "./cart/CartModal.jsx";
import TopSection from "../common/topSection.jsx";
import { useCart } from "../context/CartContext.jsx";
import axios from "axios";
import { getImageSrc } from "../../../utils/imageHelper.js";
import API_URL from "../../../config/api";

/* =========================
   IMPROVED MENU CARD COMPONENT
========================= */
function MenuCard({ item, onOrder, isNew }) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className="group relative bg-white dark:bg-[#111111] rounded-[2rem] overflow-hidden flex flex-col h-full transition-all duration-500 hover:-translate-y-1 border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-xl">
      
      {/* NEW BADGE: Slimmer & Sparkly */}
      {isNew && (
        <div className="absolute top-3 right-3 z-30 bg-yellow-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 uppercase tracking-widest border border-white/10">
          <Sparkles size={8} fill="black" />
          NEW
        </div>
      )}

      {/* IMAGE CONTAINER */}
      <div className="relative h-44 md:h-48 overflow-hidden bg-zinc-50 dark:bg-[#1a1a1a] shrink-0">
        {!imgLoaded && (
          <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        )}
        <img
          src={item.image_url?.startsWith('http') ? item.image_url : `${API_URL}${item.image_url}`} 
          alt={item.name}
          onLoad={() => setImgLoaded(true)}
          className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${
            imgLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />
      </div>

      {/* CONTENT SECTION - Left Aligned & Scaled Down */}
      <div className="p-4 md:p-5 flex-1 flex flex-col items-start text-left">
        
        {/* TITLE & PRICE ROW - min-h keeps rows aligned */}
        <div className="w-full flex justify-between items-start gap-2 mb-2 min-h-[2.5rem]">
          <h4 className="text-sm md:text-base font-medium text-zinc-900 dark:text-white leading-tight uppercase tracking-tight flex-1">
            {item.name}
          </h4>
          <div className="text-right shrink-0">
            <span className="text-sm md:text-base text-yellow-500 font-black tracking-tighter">
              {Number(item.price).toLocaleString()}
            </span>
            <div className="text-[7px] font-bold text-zinc-400 uppercase -mt-1">UGX</div>
          </div>
        </div>

        {/* DESCRIPTION - Fixed height prevents card layout break */}
        <p className="text-[11px] md:text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-snug mb-4 font-normal h-8 overflow-hidden">
          {item.description || "A signature dish prepared fresh at Kurax Food Lounge."}
        </p>

        {/* BUTTON - Stays at bottom */}
        <button
          onClick={() => onOrder(item)}
          className="mt-auto w-full py-2.5 rounded-xl bg-[#FFD700] hover:bg-[#FFC800] text-black text-[9px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
        >
          <Plus size={12} strokeWidth={4} />
          Add to Order
        </button>
      </div>
    </div>
  );
}

/* =========================
   MAIN MENU COMPONENT
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
        const res = await axios.get(`${API_URL}/api/menus`);
        const sortedLiveItems = res.data
          .filter(item => item.status === 'live')
          .sort((a, b) => b.id - a.id);
        setDbMenus(sortedLiveItems);
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
      
      {/* STICKY NAV */}
      <div className="sticky top-0 z-50 bg-[#F9F9F7]/90 dark:bg-[#080808]/90 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50">
        <TopSection searchPlaceholder="Search flavors..." />
        <div className="w-full flex justify-center border-b border-zinc-200/50 dark:border-zinc-800/50">
          <div className="flex justify-start sm:justify-center gap-6 md:gap-16 px-6 py-3 md:py-4 overflow-x-auto no-scrollbar mx-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`relative text-[10px] md:text-[12px] font-bold pb-2 transition-all whitespace-nowrap uppercase tracking-[0.25em] ${
                  selectedCategory === cat
                    ? "text-zinc-900 dark:text-white"
                    : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-500"
                }`}
              >
                {cat}
                {selectedCategory === cat && (
                  <span className="absolute bottom-0 left-0 w-full h-[3px] bg-yellow-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* HEADER */}
      <header className="max-w-7xl mx-auto px-5 md:px-12 pt-8 pb-4">
        <div className="flex flex-row items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-900 pb-8">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-1.5 h-6 md:h-8 bg-yellow-500 rounded-full" />
            <h2 className="text-lg md:text-2xl font-medium uppercase tracking-widest whitespace-nowrap">
              Explore Menu
            </h2>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[8px] md:text-[9px] uppercase tracking-widest text-zinc-400">
              Available in {selectedCategory}
            </p>
            <p className="text-lg md:text-2xl font-semibold leading-none">
              {filteredMenus.length} <span className="text-[10px] font-normal opacity-60">Dishes</span>
            </p>
          </div>
        </div>
      </header>

      {/* MENU GRID */}
      <main className="max-w-7xl mx-auto px-5 md:px-12 pb-24 md:pb-32">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-zinc-100 dark:bg-zinc-900 rounded-[2rem] animate-pulse" />
            ))}
          </div>
        ) : filteredMenus.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-[2.5rem]">
            <p className="italic text-zinc-400">Our chefs are preparing something new...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {filteredMenus.map((item) => {
              const createdDate = new Date(item.created_at);
              const now = new Date();
              const isNew = (now - createdDate) / (1000 * 60 * 60) <= 48;

              return (
                <MenuCard
                  key={item.id}
                  item={item}
                  isNew={isNew}
                  onOrder={(it) => {
                    setActiveDish({ 
                      ...it, 
                      image: getImageSrc(it.image_url), 
                      quantity: 1,
                      instructions: "" 
                    });
                    setIsCartOpen(true);
                  }}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* CART MODAL */}
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