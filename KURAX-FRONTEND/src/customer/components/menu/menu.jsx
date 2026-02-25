import { useState, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react"; // Added Loader for better UX
import CartModal from "./cart/CartModal.jsx";
import TopSection from "../common/topSection.jsx";
import { useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import axios from "axios"; // Ensure axios is installed
import { getImageSrc } from "../../../utils/imageHelper.js";

export default function Menu() {
  const location = useLocation();
  const [dbMenus, setDbMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Starters");


  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    checkoutStep,
    setCheckoutStep,
    activeDish,
    setActiveDish,
    handleAddToCart,
    handleRemoveFromCart,
    handleQuantityChange,
    totalAmount,
    customerDetails,
    setCustomerDetails,
  } = useCart();

  // Fetching real data from the backend
  useEffect(() => {
    const fetchMenus = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/menus");
        setDbMenus(response.data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching menu items:", error);
        setLoading(false);
      }
    };
    fetchMenus();
  }, []);

  const categories = ["Starters", "Local Foods", "Drinks & Cocktails"];

  // Filtering the dynamic data
  const filteredMenus = dbMenus.filter(
    (item) => item.category === selectedCategory
  );

  useEffect(() => {
    if (location.state?.preselectedItem) {
      const dishWithQuantity = {
        ...location.state.preselectedItem,
        quantity: 1,
        instructions: "",
      };
      setActiveDish(dishWithQuantity);
      setIsCartOpen(true);
    }
  }, [location.state]);

  const handleOrder = (item) => {
    const dishWithQuantity = {
      ...item,
      quantity: 1,
      instructions: "",
    };
    setActiveDish(dishWithQuantity);
    setIsCartOpen(true);
  };

  return (
    <div className="bg-white dark:bg-black text-gray-900 dark:text-white font-[Outfit] min-h-screen transition-colors duration-300">
      
      {/* HEADER & CATEGORIES */}
      <div className="sticky top-0 z-50 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-gray-700">
        <TopSection searchPlaceholder="Search menu items..." />
        <div className="flex justify-center gap-4 py-6">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`relative font-semibold px-3 py-1 text-sm sm:text-base ${
                selectedCategory === cat ? "text-yellow-500" : "text-gray-900 dark:text-white"
              }`}
            >
              {cat}
              {selectedCategory === cat && (
                <span className="absolute left-0 -bottom-1 w-full h-[2px] bg-yellow-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* MENU GRID */}
      <section className="px-4 md:px-16 py-8">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-yellow-500" size={40} /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredMenus.map((item) => (
              <div key={item.id} className="group bg-white dark:bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden hover:border-yellow-500/50 transition-all shadow-2xl flex flex-col">
                <div className="h-56 bg-zinc-800 relative overflow-hidden">
                  <img 
                    src={getImageSrc(item.image_url)}
                    alt={item.name}
                    crossOrigin="anonymous" 
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/300?text=Image+Not+Found'; }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                  />
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <h4 className="text-lg font-black text-black dark:text-white uppercase leading-tight">{item.name}</h4>
                    <span className="text-yellow-500 text-base font-black">UGX {Number(item.price).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-zinc-500 line-clamp-2 mb-8 italic">{item.description}</p>
                  
                  {/* Note: Tags are ignored here as they are only for waiters [cite: 2026-02-09] */}
                  
                  <button onClick={() => handleOrder(item)} className="mt-auto w-full py-4 bg-yellow-400 text-black rounded-xl text-xs font-black uppercase shadow-lg active:scale-95">
                    <Plus size={18} className="inline mr-2" /> Add to Order
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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