import { useState } from "react";
import TopSection from "../components/topSection.jsx";
import SocialButton from "../components/socialButton.jsx";

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

  const filteredItems = menuItems.filter(item => item.category === selectedCategory);

  return (
    <div className="bg-black text-white font-[Outfit] min-h-screen">

      {/* Top Hero / Search */}
      <div className="px-4 md:px-16 pt-6 md:pt-12">
        <TopSection searchPlaceholder="Search menu items..." />
      </div>

      {/* Title */}
      <h2 className="text-2xl md:text-3xl font-serif text-yellow-500 text-center mt-8 mb-6">
        Explore Our Menu
      </h2>

      {/* Category Buttons */}
      <div className="flex justify-center gap-4 mb-8 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-5 py-2 rounded-none font-semibold transition ${
              selectedCategory === cat ? "bg-yellow-500 text-black" : "bg-zinc-900 text-white"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Cards */}
      <section className="px-4 md:px-16">
        <div className="flex gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="min-w-[250px] md:min-w-0 bg-zinc-900 rounded-none overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 border-2 border-transparent hover:border-yellow-500"
            >
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="text-lg md:text-xl font-semibold mb-2 text-white">{item.name}</h3>
                <p className="text-gray-400 text-sm md:text-base mb-4">{item.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-yellow-500 font-bold">{item.price}</span>
                  <button className="px-3 py-1 bg-yellow-500 text-black rounded-none hover:bg-yellow-400 transition text-sm">
                    Order Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer / Social Buttons */}
      <section className="border-t border-white/10 px-4 md:px-16 py-12 md:py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-serif mb-4 md:mb-6 text-yellow-500">
          Connect With Us
        </h2>
        <p className="text-gray-400 max-w-lg md:max-w-2xl mx-auto mb-6 md:mb-8 text-sm md:text-base leading-relaxed">
          Follow us on social media for the latest updates, exclusive offers, and behind-the-scenes content from Kurax Food Lounge & Bistro.
        </p>
        <div className="flex flex-wrap justify-start md:justify-center gap-3 md:gap-4">
          <SocialButton color="from-purple-500 to-pink-500" label="Instagram" />
          <SocialButton color="from-blue-500 to-cyan-500" label="X (Twitter)" />
          <SocialButton color="from-blue-600 to-blue-800" label="Facebook" />
          <SocialButton color="from-gray-800 to-black" label="TikTok" />
        </div>
      </section>

    </div>
  );
}
