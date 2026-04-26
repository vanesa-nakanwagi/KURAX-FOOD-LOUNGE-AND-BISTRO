import { useState, useEffect, useCallback } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CartModal from "./cart/CartModal.jsx";
import TopSection from "../common/topSection.jsx";
import { useCart } from "../context/CartContext.jsx";
import axios from "axios";
import { getImageSrc } from "../../../utils/imageHelper.js";
import API_URL from "../../../config/api";

/* =========================
   CONSISTENT MENU CARD COMPONENT
========================= */
function MenuCard({ item, onOrder, isNew }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const imageUrl = item.image_url?.startsWith('http') 
    ? item.image_url 
    : `${API_URL}${item.image_url}`;

  return (
    <div className="group relative font-outfit flex flex-col bg-white dark:bg-[#0A0A0A] rounded-[1rem] overflow-hidden shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] hover:shadow-2xl border border-zinc-100 dark:border-zinc-800/40 transition-all duration-500 hover:-translate-y-2">
      
      {isNew && (
        <div className="absolute top-4 left-4 z-30">
          <div className="bg-yellow-500 text-white text-[8px] font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-1 uppercase tracking-widest border border-white/10">
            <Sparkles size={8} /> NEW
          </div>
        </div>
      )}

      <div className="relative h-52 overflow-hidden bg-zinc-50 dark:bg-[#1a1a1a] shrink-0">
        {!imgLoaded && (
          <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        )}
        <img
          src={imageUrl}
          alt={item.name}
          onLoad={() => setImgLoaded(true)}
          className={`w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 ${
            imgLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-30" />
      </div>

      <div className="p-6 flex-1 flex flex-col justify-between">
        <div className="space-y-2 text-left">
          <h4 className="text-lg font-[OUtfit] text-yellow-700 dark:text-white tracking-tight group-hover:text-yellow-600 transition-colors line-clamp-1">
            {item.name}
          </h4>
          <p className="text-zinc-900 dark:text-zinc-400 text-[14px] font-light leading-relaxed line-clamp-2 ">
            {item.description || "A signature dish prepared fresh at Kurax Food Lounge."}
          </p>
        </div>

        <div className="flex items-center justify-between pt-5 mt-4 border-t border-zinc-200 dark:border-zinc-800/50">
          <button
            onClick={() => onOrder(item)}
            className="group/btn flex items-center gap-1 px-3 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-black text-[10px] uppercase tracking-[0.2em] rounded-xl transition-all duration-300 shadow-md active:scale-95"
          >
            <Plus size={14} strokeWidth={3} className="transition-transform group-hover/btn:rotate-90" />
            Order Now
          </button>

          <div className="text-right">
            <span className="block text-xl text-zinc-900 dark:text-white tracking-tighter leading-none">
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
}

/* =========================
   MAIN MENU COMPONENT
========================= */
export default function Menu() {
  const [dbMenus, setDbMenus] = useState([]);
  const [filteredMenus, setFilteredMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Starters");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const {
    cart, isCartOpen, setIsCartOpen, activeDish, setActiveDish,
    handleAddToCart, handleRemoveFromCart, handleQuantityChange,
    totalAmount, checkoutStep, setCheckoutStep, customerDetails, setCustomerDetails,
  } = useCart();

  // Fetch menus
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

  // Check for search query on mount and when localStorage changes
  useEffect(() => {
    const checkForSearch = () => {
      const savedSearch = localStorage.getItem('searchQuery');
      if (savedSearch && savedSearch.trim()) {
        setSearchQuery(savedSearch);
        setIsSearching(true);
        localStorage.removeItem('searchQuery');
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };

    // Check immediately
    checkForSearch();

    // Listen for storage events (in case of multiple tabs)
    window.addEventListener('storage', checkForSearch);
    
    return () => window.removeEventListener('storage', checkForSearch);
  }, []);

  // Listen for custom search event
  useEffect(() => {
    const handleGlobalSearch = (event) => {
      const query = event.detail;
      if (query && query.trim()) {
        setSearchQuery(query);
        setIsSearching(true);
        setSelectedCategory(null); // Clear category when searching
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // Clear search when query is empty
        setSearchQuery("");
        setIsSearching(false);
        setSelectedCategory("Starters"); // Reset to default category
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };

    window.addEventListener('search', handleGlobalSearch);
    return () => window.removeEventListener('search', handleGlobalSearch);
  }, []);

  // Filter menus based on search or category
  useEffect(() => {
    if (dbMenus.length === 0) return;

    let results = [];
    
    if (isSearching && searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      results = dbMenus.filter(item => 
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        item.category.toLowerCase().includes(query)
      );
    } else if (selectedCategory) {
      results = dbMenus.filter(item => item.category === selectedCategory);
    } else {
      // Default to first category if nothing selected
      results = dbMenus.filter(item => item.category === "Starters");
    }
    
    setFilteredMenus(results);
  }, [dbMenus, selectedCategory, searchQuery, isSearching]);

  const categories = ["Starters", "Local Foods", "Drinks & Cocktails"];

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    setIsSearching(false);
    setSearchQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearSearch = () => {
    setIsSearching(false);
    setSearchQuery("");
    setSelectedCategory("Starters");
  };

  return (
    <div className="font-['Outfit'] bg-[#F9F9F7] dark:bg-[#080808] text-zinc-900 dark:text-white min-h-screen transition-colors duration-500">
      
      {/* STICKY NAV */}
      <div className="sticky top-0 z-50 bg-[#F9F9F7]/90 dark:bg-[#080808]/90 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50">
        <TopSection searchPlaceholder="Search flavors..." />
        
        {/* Category Tabs - Mobile Optimized */}
        {!isSearching && (
          <div className="w-full flex justify-center border-b border-zinc-200/50 dark:border-zinc-800/50 overflow-x-auto no-scrollbar">
            <div className="flex justify-start sm:justify-center gap-4 md:gap-8 lg:gap-16 px-4 md:px-6 py-3 md:py-4 min-w-max mx-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`relative text-[10px] md:text-[12px] font-bold pb-2 transition-all whitespace-nowrap uppercase tracking-[0.25em] ${
                    selectedCategory === cat
                      ? "text-zinc-900 dark:text-white"
                      : "text-zinc-700 dark:text-zinc-600 hover:text-zinc-500"
                  }`}
                >
                  {cat}
                  {selectedCategory === cat && (
                    <motion.span 
                      layoutId="underline"
                      className="absolute bottom-0 left-0 w-full h-[3px] bg-yellow-500 rounded-full" 
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* HEADER - Mobile Optimized with title and count on same row */}
      <header className="max-w-7xl mx-auto px-5 md:px-12 pt-8 pb-4">
        <div className="flex flex-row items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-900 pb-8 min-w-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <div className="w-1.5 h-6 md:h-8 bg-yellow-500 rounded-full flex-shrink-0" />
            <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-5xl font-serif leading-[0.95] tracking-tighter truncate">
              {isSearching ? "Search" : "Explore"}{" "}
              <span className="bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 bg-clip-text text-transparent whitespace-nowrap">
                {isSearching ? "Results" : "Menu"}
              </span>
            </h2>
          </div>
          <div className="text-right shrink-0">
            <p className="hidden sm:block text-[8px] md:text-[9px] uppercase tracking-widest text-zinc-700 leading-tight">
              {isSearching ? "Matching your taste" : `Available in ${selectedCategory}`}
            </p>
            <p className="text-base sm:text-lg md:text-2xl font-semibold leading-none">
              {filteredMenus.length}{" "}
              <span className="text-[8px] sm:text-[10px] font-normal opacity-60">
                Dishes
              </span>
            </p>
          </div>
        </div>
      </header>

      {/* MENU GRID */}
      <main className="max-w-7xl mx-auto px-5 md:px-12 pb-24 md:pb-32">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-zinc-100 dark:bg-zinc-900 rounded-[2.5rem] animate-pulse" />
            ))}
          </div>
        ) : filteredMenus.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-[2.5rem]">
            <p className="italic text-zinc-400">
              {isSearching 
                ? `No items found matching "${searchQuery}"`
                : "Our chefs are preparing something new..."
              }
            </p>
            {isSearching && (
              <button
                onClick={clearSearch}
                className="mt-4 text-sm text-yellow-600 hover:text-yellow-700 underline"
              >
                Browse all menus
              </button>
            )}
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