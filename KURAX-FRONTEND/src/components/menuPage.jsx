
import { useState, useRef, useEffect } from "react";
import TopSection from "../components/topSection.jsx";
import SocialButton from "../components/socialButton.jsx";
import { useNavigate } from "react-router-dom";
// Sample menu items
const menuItems = [
  { id: 1, category: "Starters", name: "Bruschetta", description: "Grilled bread with tomato and basil", price: "UGX 15,000", image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=800&q=80" },
  { id: 2, category: "Main Courses", name: "Grilled Salmon", description: "Salmon fillet with lemon butter sauce", price: "UGX 65,000", image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 3, category: "Starters", name: "Caesar Salad", description: "Crispy romaine with creamy dressing", price: "UGX 30,000", image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092", },
  { id: 4, category: "Drinks & Cocktails", name: "Mojito", description: "Fresh mint and lime cocktail", price: "UGX 25,000", image: "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03" },
  { id: 5, category: "Main Courses", name: "Beef Steak", description: "Grilled to perfection with herbs", price: "UGX 70,000", image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 6, category: "Drinks & Cocktails", name: "Espresso Martini", description: "Coffee flavored cocktail", price: "UGX 28,000", image: "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03" },
];

const categories = ["Starters", "Main Courses", "Drinks & Cocktails"];

export default function MenuPage() {
  const [selectedCategory, setSelectedCategory] = useState("Starters");
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const filteredItems = menuItems.filter(
    (item) => item.category === selectedCategory
  );

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

    el.scrollBy({
      left: direction === "left" ? -cardWidth : cardWidth,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    updateScrollButtons();
  }, [selectedCategory]);

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
              selectedCategory === cat
                ? "text-yellow-500"
                : "text-white"
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
        {/* Fade edges */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-12 bg-gradient-to-r from-black to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-black to-transparent z-10" />

        {/* Left Arrow */}
           <button
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              className={`absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20
              text-5xl md:text-4xl font-bold
               transition
           ${
            canScrollLeft
            ? "text-white hover:text-yellow-500"
            : "text-zinc-600 cursor-not-allowed"
          }`}
      >
     ‹
      </button>


        {/* Cards */}
        <div
          ref={scrollRef}
          onScroll={updateScrollButtons}
          className="flex gap-6 overflow-hidden scroll-smooth"
        >
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="min-w-[260px] bg-zinc-900 border border-zinc-800 hover:border-yellow-500 transition"
            >
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-1">
                  {item.name}
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  {item.description}
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-yellow-500 font-bold">
                    {item.price}
                  </span>
                   <button
                   onClick={() => navigate(`/order/${item.id}`)}
                   className="px-3 py-1 bg-yellow-500 text-black rounded hover:bg-yellow-400 transition text-sm"
                   >
                Order Now
             </button>


                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right Arrow */}
        <button
  onClick={() => scroll("right")}
  disabled={!canScrollRight}
  className={`absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20
    text-5xl md:text-4xl font-bold
    transition
    ${
      canScrollRight
        ? "text-white hover:text-yellow-500"
        : "text-zinc-600 cursor-not-allowed"
    }`}
>
  ›
</button>

      </section>

      {/* Footer */}
      <section className="border-t border-white/10 px-4 md:px-16 py-12 text-center mt-16">
        <h2 className="text-2xl md:text-3xl font-serif mb-6 text-yellow-500">
          Connect With Us
        </h2>
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
