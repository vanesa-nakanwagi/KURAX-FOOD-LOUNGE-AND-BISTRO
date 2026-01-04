// src/components/OrderNowPage.jsx
import { useState } from "react";
import { useParams } from "react-router-dom";
import TopSection from "../components/topSection.jsx";
import SocialButton from "../components/socialButton.jsx";
import { menuItems } from "../data/menuItems"; 

export default function OrderNowPage() {
  const { dishId } = useParams(); // get dishId from URL
  const dish = menuItems.find(d => d.id === parseInt(dishId)); // find the dish

  // If dish not found, show message
  if (!dish) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center text-xl">
        Dish not found
      </div>
    );
  }

  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState("");

  const increment = () => setQuantity(q => q + 1);
  const decrement = () => setQuantity(q => (q > 1 ? q - 1 : 1));

  return (
    <div className="bg-black text-white font-[Outfit] min-h-screen">

      {/* TopSection / Nav */}
      <div className="px-4 md:px-16 pt-6 md:pt-12">
        <TopSection searchPlaceholder="Search menu items..." />
      </div>

      {/* Dish Preview */}
      <div className="px-4 md:px-16 py-8 flex flex-col md:flex-row gap-6 md:gap-12">
        <img
          src={dish.image}
          alt={dish.name}
          className="w-full md:w-1/2 h-64 md:h-96 object-cover rounded-none shadow-2xl"
        />

        <div className="flex-1 flex flex-col justify-between">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif text-yellow-500 mb-3">
              {dish.name}
            </h2>
            <p className="text-gray-400 mb-4">{dish.description}</p>
            <span className="text-yellow-500 font-bold text-xl">
              {dish.price}
            </span>
          </div>

          {/* Quantity + Special Instructions */}
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span>Quantity:</span>
              <button
                onClick={decrement}
                className="px-3 py-1 bg-zinc-800 text-white rounded-none hover:bg-zinc-700 transition"
              >-</button>
              <span className="px-3">{quantity}</span>
              <button
                onClick={increment}
                className="px-3 py-1 bg-zinc-800 text-white rounded-none hover:bg-zinc-700 transition"
              >+</button>
            </div>

            <textarea
              placeholder="Special instructions..."
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              className="w-full bg-zinc-900 text-white p-3 rounded-none resize-none focus:outline-none"
              rows={3}
            />
          </div>

          {/* Add to Cart */}
          <button className="mt-6 w-full md:w-1/2 bg-yellow-500 text-black font-semibold py-3 rounded-none hover:bg-yellow-400 transition text-lg">
            Add to Cart
          </button>
        </div>
      </div>

      {/* Recommended / You may also like */}
      <section className="px-4 md:px-16 py-8">
        <h3 className="text-2xl md:text-3xl font-serif text-yellow-500 mb-6 text-center">
          You May Also Like
        </h3>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {menuItems
            .filter(m => m.id !== dish.id) // exclude current dish
            .slice(0, 3) // show 3 recommendations
            .map((rec, i) => (
              <div key={i} className="min-w-[200px] bg-zinc-900 rounded-none overflow-hidden shadow-lg">
                <img
                  src={rec.image}
                  alt={rec.name}
                  className="w-full h-32 object-cover"
                />
                <div className="p-3">
                  <h4 className="text-white font-semibold">{rec.name}</h4>
                  <span className="text-yellow-500 font-bold">{rec.price}</span>
                </div>
              </div>
          ))}
        </div>
      </section>

      {/* Footer */}
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
