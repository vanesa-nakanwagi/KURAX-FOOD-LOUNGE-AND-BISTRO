import { useState, useEffect } from "react";

import CartModal from "./cart/CartModal.jsx";
import TopSection from "../common/topSection.jsx";
import { useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import hero3 from "../../assets/images/hero3.jpg"
import burger from "../../assets/images/hero4.jpg";
import grilledGoat from "../../assets/images/grilled_goat.jpeg";
import luwombo from "../../assets/images/luwombo.jpeg";
import hero5 from "../../assets/images/hero5.jpg";
import hero13 from "../../assets/images/hero13.jpg";
import wine from "../../assets/images/wine.jpg";
const menuItems = [
  { id: 1, category: "Starters", name: "Bruschetta", description: "Grilled bread with tomato and basil", price: 15000, image: hero3 },
  { id: 2, category: "Main Courses", name: "Grilled Salmon", description: "Salmon fillet with lemon butter sauce", price: 65000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 3, category: "Starters", name: "Luwombo", description: "Crispy romaine with creamy dressing", price: 30000, image: luwombo },
  { id: 4, category: "Drinks & Cocktails", name: "Mojito", description: "Fresh mint and lime cocktail", price: 25000, image: hero13 },
  { id: 5, category: "Main Courses", name: "Beef Steak", description: "Grilled to perfection with herbs", price: 70000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 6, category: "Drinks & Cocktails", name: "Espresso Martini", description: "Coffee flavored cocktail", price: 28000, image: hero5 },
  { id: 7, category: "Starters", name: "Burger", description: "Grilled bread with tomato and basil", price: 15000, image: burger },
  { id: 8, category: "Main Courses", name: "Grilled Salmon", description: "Salmon fillet with lemon butter sauce", price: 65000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 9, category: "Starters", name: "Grilled Goat", description: "Crispy romaine with creamy dressing", price: 30000, image: grilledGoat },
  { id: 10, category: "Drinks & Cocktails", name: "Wine", description: "Fresh mint and lime cocktail", price: 25000, image: wine},
  { id: 11, category: "Main Courses", name: "Beef Steak", description: "Grilled to perfection with herbs", price: 70000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 13, category: "Starters", name: "Bruschetta", description: "Grilled bread with tomato and basil", price: 15000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=800&q=80" },
  { id: 14, category: "Main Courses", name: "Grilled Salmon", description: "Salmon fillet with lemon butter sauce", price: 65000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 15, category: "Starters", name: "Caesar Salad", description: "Crispy romaine with creamy dressing", price: 30000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 16, category: "Drinks & Cocktails", name: "Mojito", description: "Fresh mint and lime cocktail", price: 25000, image: "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03" },
  { id: 17, category: "Main Courses", name: "Beef Steak", description: "Grilled to perfection with herbs", price: 70000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 18, category: "Drinks & Cocktails", name: "Espresso Martini", description: "Coffee flavored cocktail", price: 28000, image: "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03" },
  { id: 19, category: "Starters", name: "Bruschetta", description: "Grilled bread with tomato and basil", price: 15000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=800&q=80" },
  { id: 20, category: "Main Courses", name: "Grilled Salmon", description: "Salmon fillet with lemon butter sauce", price: 65000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 21, category: "Starters", name: "Caesar Salad", description: "Crispy romaine with creamy dressing", price: 30000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 22, category: "Drinks & Cocktails", name: "Mojito", description: "Fresh mint and lime cocktail", price: 25000, image: "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03" },
  { id: 23, category: "Main Courses", name: "Beef Steak", description: "Grilled to perfection with herbs", price: 70000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 24, category: "Drinks & Cocktails", name: "Espresso Martini", description: "Coffee flavored cocktail", price: 28000, image: "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03" },

];

const categories = ["Starters", "Main Courses", "Drinks & Cocktails"];

export default function Menu() {
  const location = useLocation();

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

  const [selectedCategory, setSelectedCategory] = useState("Starters");

  const filteredItems = menuItems.filter(
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

    // ----------------------------------------------------
    // REMOVE THIS LINE:
    // handleAddToCart(dishWithQuantity); 
    // ----------------------------------------------------

    // 1. Set the dish as the active one to be customized in the modal.
    setActiveDish(dishWithQuantity);
    
    // 2. Open the modal (to show the customization view).
    setIsCartOpen(true);
  };

  return (
    <div className="bg-white dark:bg-black text-gray-900 dark:text-white font-[Outfit] min-h-screen transition-colors duration-300">

      {/* ================= HEADER ================= */}
      <div className="sticky top-0 z-50 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <TopSection searchPlaceholder="Search menu items..." />

        {/* Categories */}
        <div className="flex justify-center gap-4 py-6 border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`relative font-semibold px-3 py-1 text-sm sm:text-base transition-colors duration-300 ${
                selectedCategory === cat
                  ? "text-yellow-500"
                  : "text-gray-900 dark:text-white"
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

      {/* ================= MENU GRID ================= */}
      <section className="px-4 md:px-16 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
               className="rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition duration-300
                     border-2 border-transparent
                     bg-white-100 dark:bg-zinc-900
                      "
            >
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-48 object-cover "
              />
              <div className="p-4">
                <h4 className="font-semibold text-lg text-gray-900 dark:text-white">
                  {item.name}
                </h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm my-2">
                  {item.description}
                </p>

                <div className="flex justify-between items-center">
                  <span className="font-bold text-yellow-600">
                    UGX {item.price.toLocaleString()}
                  </span>
                  <button
                    onClick={() => handleOrder(item)}
                    className="px-3 py-1 bg-yellow-500 rounded-s-none text-black text-sm hover:bg-yellow-500 transition"
                  >
                    Order Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= CART MODAL ================= */}
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
