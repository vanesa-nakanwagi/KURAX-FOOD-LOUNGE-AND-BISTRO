import { useState, useRef, useEffect } from "react";
import TopSection from "../components/topSection.jsx";
import SocialButton from "../components/socialButton.jsx";

// Sample menu items
const menuItems = [
  { id: 1, category: "Starters", name: "Bruschetta", description: "Grilled bread with tomato and basil", price: 15000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=800&q=80" },
  { id: 2, category: "Main Courses", name: "Grilled Salmon", description: "Salmon fillet with lemon butter sauce", price: 65000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 3, category: "Starters", name: "Caesar Salad", description: "Crispy romaine with creamy dressing", price: 30000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 4, category: "Drinks & Cocktails", name: "Mojito", description: "Fresh mint and lime cocktail", price: 25000, image: "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03" },
  { id: 5, category: "Main Courses", name: "Beef Steak", description: "Grilled to perfection with herbs", price: 70000, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 6, category: "Drinks & Cocktails", name: "Espresso Martini", description: "Coffee flavored cocktail", price: 28000, image: "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03" },
];

const categories = ["Starters", "Main Courses", "Drinks & Cocktails"];

export default function MenuPage() {
  const [selectedCategory, setSelectedCategory] = useState("Starters");
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem("cart");
    return saved ? JSON.parse(saved) : [];
  });

  const [activeDish, setActiveDish] = useState(null); // Dish being added or edited
  const [isCartOpen, setIsCartOpen] = useState(false);

  const filteredItems = menuItems.filter(
    (item) => item.category === selectedCategory
  );

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

  // Cart actions
  const handleAddToCart = (dish) => {
    const existing = cart.find((item) => item.id === dish.id);
    if (existing) {
      setCart(cart.map(item =>
        item.id === dish.id
          ? { ...item, quantity: dish.quantity, instructions: dish.instructions }
          : item
      ));
    } else {
      setCart([...cart, { ...dish }]);
    }
    setActiveDish(null); // Close dish input section
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
      {/* Top Hero */}
      <div className="px-4 md:px-16 pt-6 md:pt-12">
        <TopSection searchPlaceholder="Search menu items..." />
      </div>

      {/* Title */}
      <h2 className="text-2xl md:text-3xl font-serif text-yellow-500 text-center mt-10 mb-8">
        Explore Our Menu
      </h2>

      {/* Categories */}
      <div className="flex justify-center gap-6 mb-10 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`relative font-semibold px-4 py-2 transition ${
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

      {/* MENU SLIDER */}
      <section className="relative px-4 md:px-16">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-12 bg-gradient-to-r from-black to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-black to-transparent z-10" />

        <button
          onClick={() => scroll("left")}
          disabled={!canScrollLeft}
          className={`absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 text-5xl md:text-4xl font-bold transition ${
            canScrollLeft ? "text-white hover:text-yellow-500" : "text-zinc-600 cursor-not-allowed"
          }`}
        >
          ‹
        </button>

        <div ref={scrollRef} onScroll={updateScrollButtons} className="flex gap-6 overflow-hidden scroll-smooth">
          {filteredItems.map((item) => (
            <div key={item.id} className="min-w-[260px] bg-zinc-900 border border-zinc-800 hover:border-yellow-500 transition">
              <img src={item.image} alt={item.name} className="w-full h-48 object-cover" />
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-1">{item.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{item.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-yellow-500 font-bold">UGX {item.price.toLocaleString()}</span>
                  <button
                    onClick={() => setActiveDish({ ...item, quantity: 1, instructions: "" })}
                    className="px-3 py-1 bg-yellow-500 text-black rounded hover:bg-yellow-400 transition text-sm"
                  >
                    Order Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => scroll("right")}
          disabled={!canScrollRight}
          className={`absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 text-5xl md:text-4xl font-bold transition ${
            canScrollRight ? "text-white hover:text-yellow-500" : "text-zinc-600 cursor-not-allowed"
          }`}
        >
          ›
        </button>
      </section>

      {/* CART + DISH MODAL */}
{(activeDish || isCartOpen) && (
  <div className="fixed inset-0 bg-black/70 flex justify-center items-start pt-12 z-50 overflow-y-auto">
    <div className="bg-zinc-900 w-full max-w-3xl rounded-lg p-6 relative">
      <button
        onClick={() => { setActiveDish(null); setIsCartOpen(false); }}
        className="absolute top-4 right-4 text-white text-xl font-bold hover:text-yellow-500"
      >
        ✕
      </button>

      {/* Active Dish Section */}
      {activeDish && (
        <div className="mb-6">
          <h2 className="text-2xl font-serif text-yellow-500 mb-2">Add to Cart</h2>
          <div className="flex flex-col md:flex-row gap-4">
            <img src={activeDish.image} alt={activeDish.name} className="w-full md:w-1/3 h-48 object-cover rounded" />
            <div className="flex-1 flex flex-col gap-2">
              <h3 className="font-semibold text-lg">{activeDish.name}</h3>
              <span className="text-yellow-500 font-bold mb-2">UGX {activeDish.price.toLocaleString()}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveDish({ ...activeDish, quantity: Math.max(activeDish.quantity - 1, 1) })}
                  className="px-2 py-1 bg-zinc-700 rounded hover:bg-zinc-600"
                >
                  -
                </button>
                <span>{activeDish.quantity}</span>
                <button
                  onClick={() => setActiveDish({ ...activeDish, quantity: activeDish.quantity + 1 })}
                  className="px-2 py-1 bg-zinc-700 rounded hover:bg-zinc-600"
                >
                  +
                </button>
              </div>
              <textarea
                rows={3}
                className="w-full bg-zinc-800 text-white p-3 rounded-md resize-none focus:outline-none"
                placeholder="Special instructions..."
                value={activeDish.instructions}
                onChange={(e) => setActiveDish({ ...activeDish, instructions: e.target.value })}
              />
              <button
                onClick={() => handleAddToCart(activeDish)}
                className="bg-yellow-500 text-black px-4 py-2 rounded hover:bg-yellow-400 font-semibold mt-2"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Preview Section */}
      <h2 className="text-2xl font-serif text-yellow-500 mb-4">Your Cart</h2>
      {cart.length === 0 ? (
        <p className="text-gray-400 mb-4">Your cart is empty.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {cart.map(item => (
            <div key={item.id} className="flex items-center gap-3 bg-zinc-800 p-3 rounded">
              <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded" />
              <div className="flex-1 flex flex-col">
                <h3 className="font-semibold">{item.name}</h3>
                {item.instructions && <p className="text-gray-400 text-sm">Note: {item.instructions}</p>}
                <p className="text-gray-400 text-sm">UGX {(item.price * item.quantity).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleQuantityChange(item.id, -1)} className="px-2 py-1 bg-zinc-700 rounded hover:bg-zinc-600">-</button>
                <span>{item.quantity}</span>
                <button onClick={() => handleQuantityChange(item.id, 1)} className="px-2 py-1 bg-zinc-700 rounded hover:bg-zinc-600">+</button>
                <button onClick={() => handleRemoveFromCart(item.id)} className="px-2 py-1 bg-red-600 rounded hover:bg-red-500">🗑</button>
              </div>
            </div>
          ))}
          <div className="flex justify-between mt-4 text-lg font-bold text-yellow-500">
            <span>Total:</span>
            <span>UGX {totalAmount.toLocaleString()}</span>
          </div>
          <button className="mt-4 w-full bg-yellow-500 text-black py-3 rounded hover:bg-yellow-400 font-semibold">
            Checkout
          </button>
        </div>
      )}
    </div>
  </div>
)}


      {/* Footer */}
      <section className="border-t border-white/10 px-4 md:px-16 py-12 text-center mt-16">
        <h2 className="text-2xl md:text-3xl font-serif mb-6 text-yellow-500">Connect With Us</h2>
        <p className="text-gray-400 max-w-2xl mx-auto mb-8">
          Follow us on social media for the latest updates, exclusive offers, and behind-the-scenes content from Kurax Food Lounge & Bistro.
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          <SocialButton color="from-purple-500 to-pink-500" label="Instagram" />
          <SocialButton color="from-blue-500 to-cyan-500" label="X (Twitter)" />
          <SocialButton color="from-blue-600 to-blue-800" label="Facebook" />
          <SocialButton color="from-gray-800 to-black" label="TikTok" />
        </div>
      </section>
    </div>
  );
}
