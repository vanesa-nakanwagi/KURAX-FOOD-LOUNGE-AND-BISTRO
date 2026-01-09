import { useState, useRef, useEffect } from "react";
import SocialButton from "../components/common/socialButton.jsx";
import CartModal from "../components/cart/CartModal.jsx";
import TopSection from "../components/topSection.jsx";
import FeaturedCards from "../components/FeaturedCards.jsx"; // adjust path as needed



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
  { id: 9, category: "Starters", name: "Caesar Salad", description: "Crispy romaine with creamy dressing", price: 30000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 10, category: "Drinks & Cocktails", name: "Mojito", description: "Fresh mint and lime cocktail", price: 25000, image: "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03" },
  { id: 11, category: "Main Courses", name: "Beef Steak", description: "Grilled to perfection with herbs", price: 70000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 12, category: "Drinks & Cocktails", name: "Espresso Martini", description: "Coffee flavored cocktail", price: 28000, image: "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03" },

];

const categories = ["Starters", "Main Courses", "Drinks & Cocktails"];

export default function MenuPage() {
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [customerDetails, setCustomerDetails] = useState({
    firstName: "",
    lastName: "",
    email: "",
    deliveryType: "Home",
    city: "",
    locationDesc: "",
    paymentProvider: "AIRTEL",
    mobileMoneyNumber: ""
  });
  const [selectedCategory, setSelectedCategory] = useState("Starters");
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem("cart");
    return saved ? JSON.parse(saved) : [];
  });

  const [activeDish, setActiveDish] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const filteredItems = menuItems.filter(item => item.category === selectedCategory);

  // Persist cart
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  const updateScrollButtons = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 5);
  };

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.firstChild?.offsetWidth || 260;
    el.scrollBy({ left: direction === "left" ? -cardWidth : cardWidth, behavior: "smooth" });
  };

  const handleAddToCart = (dish) => {
    const existing = cart.find(item => item.id === dish.id);
    if (existing) {
      setCart(cart.map(item =>
        item.id === dish.id
          ? { ...item, quantity: dish.quantity, instructions: dish.instructions }
          : item
      ));
    } else {
      setCart([...cart, { ...dish }]);
    }
    setActiveDish(null);
    setIsCartOpen(true);
  };

  const handleRemoveFromCart = (id) => setCart(cart.filter(item => item.id !== id));

  const handleQuantityChange = (id, delta) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return { ...item, quantity: newQty > 0 ? newQty : 1 };
      }
      return item;
    }));
  };

  const totalAmount = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
      

  <div className="bg-black text-white font-[Outfit] min-h-screen">
  
  <div className="sticky top-0 z-50 bg-black">
  {/* TopSection */}
  <TopSection searchPlaceholder="Search menu items..." />

  {/* Categories */}
  <div className="flex justify-center gap-4 py-6 border-b border-white/10">
    {categories.map(cat => (
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

      {/* Menu Slider */}
      <section className="relative px-4 md:px-16">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-12 bg-gradient-to-r from-black to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-black to-transparent z-10" />


        {/* Menu Grid — responsive 2-column layout */}
<section className="px-4 md:px-16 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 md:gap-6">

  {filteredItems.map(item => (
    <div
      key={item.id}
      className="bg-zinc-900 border border-zinc-800 hover:border-yellow-500 transition rounded overflow-hidden"
    >
      <img
        src={item.image}
        alt={item.name}
        className="w-full h-40 sm:h-44 md:h-48 object-cover"
      />
      <div className="p-2 sm:p-3">
        <h3 className="text-sm sm:text-base font-semibold mb-1">{item.name}</h3>
        <p className="text-gray-400 text-xs sm:text-sm mb-2">{item.description}</p>
        <div className="flex justify-between items-center">
          <span className="text-yellow-500 font-bold text-sm sm:text-base">
            UGX {item.price.toLocaleString()}
          </span>
          <button
            onClick={() => setActiveDish({ ...item, quantity: 1, instructions: "" })}
            className="px-3 py-1 bg-yellow-500 text-black rounded-none hover:bg-yellow-400 transition text-sm"
          >
            Order
          </button>
        </div>
      </div>
    </div>
  ))}
</section>

        
      </section>

      {/* Cart & Checkout Modal */}
      { (activeDish || isCartOpen) && (
        <CartModal
          cart={cart}
          setCart={setCart}
          activeDish={activeDish}
          setActiveDish={setActiveDish}
          isCartOpen={isCartOpen}
          setIsCartOpen={setIsCartOpen}
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

      {/* ================= CONNECT ================= */}
            <section className="border-t border-white/10 px-10 py-16 text-center">
              <h2 className="text-3xl font-serif mb-3">Connect With Us</h2>
              <p className="text-gray-400 max-w-2xl mx-auto mb-8">
                Follow us on social media for the latest updates, exclusive offers,
                and behind-the-scenes content from Kurax Food Lounge & Bistro
              </p>
      
              <div className="flex justify-center gap-2">
                <SocialButton color="from-purple-500 to-pink-500" label="Instagram" />
                <SocialButton color="from-blue-500 to-cyan-500" label="X (Twitter)" />
                <SocialButton color="from-blue-600 to-blue-800" label="Facebook" />
                <SocialButton color="from-gray-800 to-black" label="TikTok" />
                
              </div>
            </section>
    </div>
  );
}