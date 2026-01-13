import { useState, useEffect } from "react";
import SocialButton from "../components/common/socialButton.jsx";
import CartModal from "../components/cart/CartModal.jsx";
import TopSection from "../components/topSection.jsx";
import { useLocation } from "react-router-dom";
import { useCart } from "../components/context/CartContext.jsx"; // use context, not hook from separate file

// Sample menu items
const menuItems = [
  { id: 1, category: "Starters", name: "Bruschetta", description: "Grilled bread with tomato and basil", price: 15000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=800&q=80" },
  { id: 2, category: "Main Courses", name: "Grilled Salmon", description: "Salmon fillet with lemon butter sauce", price: 65000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 3, category: "Starters", name: "Caesar Salad", description: "Crispy romaine with creamy dressing", price: 30000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 4, category: "Drinks & Cocktails", name: "Mojito", description: "Fresh mint and lime cocktail", price: 25000, image: "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03" },
  { id: 5, category: "Main Courses", name: "Beef Steak", description: "Grilled to perfection with herbs", price: 70000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 6, category: "Drinks & Cocktails", name: "Espresso Martini", description: "Coffee flavored cocktail", price: 28000, image: "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03" },
  { id: 7, category: "Starters", name: "Bruschetta", description: "Grilled bread with tomato and basil", price: 15000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=800&q=80" },
  { id: 8, category: "Main Courses", name: "Grilled Salmon", description: "Salmon fillet with lemon butter sauce", price: 65000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 9, category: "Starters", name: "Caesar Salad", description: "Crispy romaine with creamy dressing", price: 30000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 10, category: "Drinks & Cocktails", name: "Mojito", description: "Fresh mint and lime cocktail", price: 25000, image: "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03" },
  { id: 11, category: "Main Courses", name: "Beef Steak", description: "Grilled to perfection with herbs", price: 70000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 12, category: "Drinks & Cocktails", name: "Espresso Martini", description: "Coffee flavored cocktail", price: 28000, image: "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03" },
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

export default function MenuPage() {
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

  // Preselect item if navigated from another page
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

  // Handle order from menu
  const handleOrder = (item) => {
    const dishWithQuantity = {
      ...item,
      quantity: 1, // ensure quantity is always 1 initially
      instructions: "",
    };

    handleAddToCart(dishWithQuantity); // update global cart
    setActiveDish(dishWithQuantity);   // show in modal
    setIsCartOpen(true);
  };

  return (
    <div className="bg-black text-white font-[Outfit] min-h-screen">
      <div className="sticky top-0 z-50 bg-black">
        {/* TopSection */}
        <TopSection searchPlaceholder="Search menu items..." />

        {/* Categories */}
        <div className="flex justify-center gap-4 py-6 border-b border-white/10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`relative font-semibold px-3 py-1 text-sm sm:text-base transition ${
                selectedCategory === cat ? "text-yellow-500" : "text-white"
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

      {/* Menu Grid */}
      <section className="px-4 md:px-16 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-zinc-900 rounded-none overflow-hidden shadow-lg hover:shadow-2xl transition duration-300"
            >
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-48 object-cover"
              />

              <div className="p-4">
                <h4 className="font-semibold text-lg">{item.name}</h4>
                <p className="text-gray-400 text-sm my-2">{item.description}</p>

                <div className="flex justify-between items-center">
                  <span className="font-bold text-yellow-500">
                    UGX {item.price.toLocaleString()}
                  </span>

                  <button
                    onClick={() => handleOrder(item)}
                    className="px-3 py-1 bg-yellow-500 text-black text-sm hover:bg-yellow-400"
                  >
                    Order Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Cart & Checkout Modal */}
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

      {/* Connect Section */}
      <section className="border-t border-white/10 px-10 py-16 text-center">
        <h2 className="text-3xl font-serif mb-3">Connect With Us</h2>
        <p className="text-gray-400 max-w-2xl mx-auto mb-8">
          Follow us on social media for the latest updates, exclusive offers,
          and behind-the-scenes content from Kurax Food Lounge & Bistro
        </p>

        <div className="flex justify-center gap-2">
          <SocialButton
            color="from-purple-500 to-pink-500"
            label="Instagram"
            link="https://www.instagram.com/kuraxfoodloungebistro?igsh=djl0bzltY3lnbmI1"
          />
        
          <SocialButton
            color="from-blue-500 to-cyan-500"
            label="X (Twitter)"
            link="https://x.com/kuraxfoodlounge?t=zSh1NNW0EPSeRwzyoOqinQ&s=09"
          />
        
          <SocialButton
            color="from-blue-600 to-blue-800"
            label="Facebook"
            link="https://www.facebook.com/kuraxfoodlounge"
          />
        
          <SocialButton
            color="from-gray-800 to-black"
            label="TikTok"
            link="https://www.tiktok.com/@kuraxfoodkyanja?_r=1&_t=ZM-92uWpBkTEMe"
          />
        </div>
      </section>
    </div>
  );
}
