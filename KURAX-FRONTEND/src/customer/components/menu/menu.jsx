import { useState, useEffect } from "react";
import { Plus, Sparkles } from "lucide-react";
import CartModal from "./cart/CartModal.jsx";
import TopSection from "../common/topSection.jsx";
import { useCart } from "../context/CartContext.jsx";
import axios from "axios";
import { getImageSrc } from "../../../utils/imageHelper.js";

/* =========================
   MENU CARD COMPONENT
========================= */
function MenuCard({ item, onOrder }) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className="group font-['Outfit'] relative bg-white dark:bg-[#111111] rounded-[2rem] overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-2 border border-zinc-300 hover:border-yellow-500/20 shadow-sm hover:shadow-xl">
      {/* IMAGE CONTAINER */}
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

      {/* CONTENT SECTION */}
      <div className="p-5 md:p-6 flex-1 flex flex-col gap-3 md:gap-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xl md:text-2xl font-medium text-zinc-900 dark:text-white leading-tight">
            {item.name}
          </h4>
          <div className="text-right shrink-0">
            <span className="text-base md:text-lg text-yellow-600 dark:text-yellow-400 font-bold">
              {Number(item.price).toLocaleString()}
            </span>
            <div className="text-[8px] md:text-[9px] tracking-widest text-zinc-800 uppercase">UGX</div>
          </div>
        </div>

        <p className="text-xs md:text-[13px] text-zinc-800 dark:text-zinc-400 line-clamp-2 leading-relaxed">
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

  // FETCH & FILTER LOGIC
  useEffect(() => {
    const fetchMenus = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/menus");
        
        // IMPROVEMENT: Filter out any items not marked as 'live'
        // This ensures the public only sees finalized content
        const liveItems = res.data.filter(item => item.status === 'live');
        
        setDbMenus(liveItems);
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMenus();
  }, []);

  const categories = ["Starters", "Local Foods", "Drinks & Cocktails"];
  
  // Apply category filtering to the already filtered live list
  const filteredMenus = dbMenus.filter((item) => item.category === selectedCategory);

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="font-['Outfit'] bg-[#F9F9F7] dark:bg-[#080808] text-zinc-900 dark:text-white min-h-screen transition-colors duration-500">
      
      {/* STICKY NAVIGATION */}
      <div className="sticky top-0 z-50 bg-[#F9F9F7]/90 dark:bg-[#080808]/90 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50">
        <TopSection searchPlaceholder="Search flavors..." />

        
       {/* CATEGORY SELECTOR - Increased size and padding */}
        <div className="w-full flex justify-center border-b border-zinc-200/50 dark:border-zinc-800/50">
  <div className="flex justify-start sm:justify-center gap-6 md:gap-16 px-6 py-3 md:py-4 overflow-x-auto no-scrollbar scroll-smooth mx-auto">
    {categories.map((cat) => (
      <button
        key={cat}
        onClick={() => handleCategoryChange(cat)}
        className={`relative text-[12px] md:text-[14px] font-bold pb-2 transition-all whitespace-nowrap ${
          selectedCategory === cat
            ? "text-zinc-900 dark:text-white scale-110"
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

      {/* HERO / HEADER SECTION */}
      <header className="max-w-7xl mx-auto px-5 md:px-12 pt-4 md:pt-6 pb-4 md:pb-4">
        <div className="flex flex-row items-end justify-between gap-2 border-b border-zinc-100 dark:border-zinc-900 pb-8">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-6">
            <div className="w-1.5 h-8 bg-yellow-500 rounded-full" />
            <h2 className="text-3xl font-medium uppercase tracking-widest">Explore Menu</h2>
          </div>
            
          </div>

          <div className="flex items-center gap-3 pl-4 h-fit">
            <div className="text-right">
              <p className="text-[8px] md:text-[9px] uppercase tracking-widest text-zinc-400">Selection</p>
              <p className="text-xl md:text-2xl font-semibold leading-none">
                {filteredMenus.length} <span className="text-[10px] font-normal opacity-60">Items</span>
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* MENU GRID */}
      <main className="max-w-7xl mx-auto px-5 md:px-12 pb-24 md:pb-32">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-80 bg-zinc-100 dark:bg-zinc-900 rounded-[2rem] animate-pulse" />
            ))}
          </div>
        ) : filteredMenus.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-[2.5rem]">
            <p className="italic text-zinc-400">Our chefs are preparing something new for this category...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {filteredMenus.map((item) => (
              <MenuCard
                key={item.id}
  item={item}
  onOrder={(it) => {
    // FIX: Map image_url to image and use getImageSrc
    setActiveDish({ 
      ...it, 
      image: getImageSrc(it.image_url), 
      quantity: 1,
      instructions: "" // Ensure instructions isn't undefined
    });
    setIsCartOpen(true);
  }}
              />
            ))}
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