import { useState, useEffect, useMemo } from "react";
import { Plus, Search, ShoppingBag, Sparkles } from "lucide-react";
import CartModal from "./cart/CartModal.jsx";
import ThemeToggle from "../context/ThemeToggle"; 
import { useCart } from "../context/CartContext.jsx";
import axios from "axios";
import { getImageSrc } from "../../../utils/imageHelper.js";
import logo from "../../assets/images/logo.jpeg";

const StyleInjector = () => {
  useEffect(() => {
    if (document.getElementById("kurax-menu-styles")) return;
    const link = document.createElement("link");
    link.id = "kurax-menu-styles";
    link.rel = "stylesheet";
    // Loading Outfit specifically for your categories
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Outfit:wght@300;400;600;700;900&display=swap";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.id = "kurax-menu-css";
    style.textContent = `
      .kurax-card { transition: transform 0.45s cubic-bezier(0.23,1,0.32,1), box-shadow 0.45s cubic-bezier(0.23,1,0.32,1); }
      .kurax-card:hover { transform: translateY(-8px) scale(1.01); box-shadow: 0 32px 64px rgba(0,0,0,0.18), 0 0 0 1px rgba(234,179,8,0.15); }
      .kurax-img { transition: transform 0.7s cubic-bezier(0.23,1,0.32,1); }
      .kurax-card:hover .kurax-img { transform: scale(1.08); }
      /* DNA for the Outfit Category Font */
      .category-font { 
        font-family: 'Outfit', sans-serif; 
        font-weight: 700; 
        letter-spacing: 0.15em; 
        text-transform: uppercase; 
      }
      .kurax-title-font { font-family: 'Cormorant Garamond', serif; }
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `;
    document.head.appendChild(style);
  }, []);
  return null;
};

function MenuCard({ item, onOrder }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  return (
    <div className="kurax-card group relative bg-white dark:bg-[#111111] rounded-3xl overflow-hidden flex flex-col shadow-sm border border-zinc-100/50 dark:border-zinc-900/50">
      <div className="relative h-56 overflow-hidden bg-zinc-100 dark:bg-[#1a1a1a]">
        <img
          src={getImageSrc(item.image_url)}
          alt={item.name}
          onLoad={() => setImgLoaded(true)}
          className="kurax-img w-full h-full object-cover"
          style={{ opacity: imgLoaded ? 1 : 0 }}
        />
        <div className="absolute top-4 left-4">
          <span className="category-font text-[10px] px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-white/90 border border-white/10">
            {item.category}
          </span>
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h4 className="kurax-title-font text-2xl font-semibold text-zinc-900 dark:text-white leading-tight italic">{item.name}</h4>
          <div className="text-right">
            <span className="kurax-title-font text-2xl text-amber-500 italic font-medium">{Number(item.price).toLocaleString()}</span>
            <div className="category-font text-zinc-400 text-[9px] -mt-1">UGX</div>
          </div>
        </div>
        <p className="text-sm text-zinc-400 font-light line-clamp-2 italic leading-relaxed">{item.description}</p>
        <button onClick={() => onOrder(item)} className="mt-auto w-full py-4 rounded-2xl bg-yellow-400 text-black category-font text-[11px] flex items-center justify-center gap-2 active:scale-95 transition-transform">
          <Plus size={16} strokeWidth={3} /> Add to Order
        </button>
      </div>
    </div>
  );
}

export default function Menu() {
  const [dbMenus, setDbMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Starters");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    cart, isCartOpen, setIsCartOpen, activeDish, setActiveDish,
    totalAmount, checkoutStep, setCheckoutStep, customerDetails, setCustomerDetails,
  } = useCart();

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/menus");
        setDbMenus(response.data);
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchMenus();
  }, []);

  const categories = ["Starters", "Local Foods", "Drinks & Cocktails"];
  const categoryTitles = {
    "Starters": "Crafted Starters",
    "Local Foods": "Local Cuisine",
    "Drinks & Cocktails": "Signature Drinks"
  };

  const filteredMenus = useMemo(() => {
    return dbMenus.filter(item => 
      item.category === selectedCategory && 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [dbMenus, selectedCategory, searchQuery]);

  return (
    <>
      <StyleInjector />
      <div className="bg-[#FAFAF8] dark:bg-[#0C0C0C] min-h-screen transition-colors duration-500">
        
        {/* ── HEADER ── */}
        <div className="sticky top-0 z-50 bg-[#FAFAF8]/95 dark:bg-[#0C0C0C]/95 backdrop-blur-2xl border-b border-zinc-100 dark:border-zinc-900 px-6 md:px-12 lg:px-20">
          <div className="grid grid-cols-1 md:grid-cols-3 items-center py-6">
            
            {/* 1. BRANDING (Left) */}
            <div className="flex items-center gap-4">
              <img src={logo} alt="Logo" className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-yellow-500/30 shadow-xl" />
              <div className="hidden xl:block font-[Outfit]">
                <h1 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white uppercase leading-none">KURAX FOOD LOUNGE</h1>
                <h1 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white uppercase leading-none">& BISTRO</h1>
               <p className="text-[10px] md:text-[11px] font-[Outfit] text-yellow-900 tracking-[0.15em] opacity-90">
  Luxury dining, signature drinks & rooftop vibes
</p>
              </div>
            </div>

            {/* 2. CATEGORIES (Center - OUTFIT FONT) */}
            <div className="flex items-center justify-center gap-10 overflow-x-auto no-scrollbar py-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`category-font text-[15px] pb-1.5 transition-all whitespace-nowrap ${
                    selectedCategory === cat 
                      ? "text-zinc-900 dark:text-white border-b-[3px] border-yellow-500" 
                      : "text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 3. ACTIONS (Right) */}
            <div className="flex items-center justify-end gap-4">
              <div className="relative hidden sm:block md:w-48 lg:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search flavors..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-3 pl-11 pr-4 text-[10px] category-font outline-none focus:ring-2 focus:ring-yellow-500/20"
                />
              </div>
              <ThemeToggle />
              <button onClick={() => setIsCartOpen(true)} className="relative h-[50px] aspect-square bg-yellow-500 rounded-2xl flex items-center justify-center text-black shadow-xl shadow-yellow-500/20">
                <ShoppingBag size={20} strokeWidth={2.5} />
                {cart.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-black text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-yellow-500">
                    {cart.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

       
        {/* ── CONTENT ── */}
        <main className="px-6 md:px-16 lg:px-24 py-12">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[1,2,3,4].map(n => <div key={n} className="h-80 bg-zinc-100 dark:bg-zinc-900 rounded-3xl animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
              {filteredMenus.map((item) => (
                <MenuCard key={item.id} item={item} onOrder={(it) => { setActiveDish({...it, quantity:1}); setIsCartOpen(true); }} />
              ))}
            </div>
          )}
        </main>

        {(activeDish || isCartOpen) && (
          <CartModal
            isCartOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            activeDish={activeDish}
            setActiveDish={setActiveDish}
            cart={cart}
            totalAmount={totalAmount}
            checkoutStep={checkoutStep}
            setCheckoutStep={setCheckoutStep}
            customerDetails={customerDetails}
            setCustomerDetails={setCustomerDetails}
          />
        )}
      </div>
    </>
  );
}