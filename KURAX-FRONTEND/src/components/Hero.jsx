import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import hero1 from "../assets/images/hero1.jpg";
import hero2 from "../assets/images/hero2.jpg";
import hero3 from "../assets/images/hero3.jpg";
import luwombo from "../assets/images/luwombo.jpeg";
import grilledGoat from "../assets/images/grilled_goat.jpeg";
import matooke from "../assets/images/matooke.jpeg";
import about from "../assets/images/about.jpg";



const images = [hero1, hero2, hero3];

export default function Hero() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="bg-black font-[Outfit]">
        
      {/* Navbar */}
      <Navbar />

      {/* Background images */}
      {images.map((img, index) => (
        <div
          key={index}
          className={`absolute inset-0 bg-center bg-cover transition-opacity duration-1000 ${
            index === current ? "opacity-100" : "opacity-0"
          }`}
          style={{ backgroundImage: `url(${img})` }}
        />
      ))}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />

      {/* Hero content */}
      <div className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center text-center px-4">
        <h1 className="font-bold text-3xl sm:text-4xl md:text-6xl lg:text-7xl leading-tight animate-fadeUp">
          Elevated Local Dishes
          <span className="block mt-2 text-yellow-600">
            & Flavors
          </span>
        </h1>

        <p className="mt-4 text-base sm:text-lg md:text-2xl text-white/80 max-w-md animate-fadeUp delay-200">
          Let’s dine together and savor the moments
        </p>

        <Link
          to="/home"
          className="mt-8 px-6 py-3 border-2 border-yellow-400 text-white hover:bg-yellow-400 hover:text-black transition-all duration-300 animate-fadeUp delay-400"
        >
          Sign In
        </Link>
      </div>

    {/* Signature Menu Section */}
<section className="bg-black text-white font-outfit py-20 px-4 sm:px-8">
  <div className="max-w-7xl mx-auto text-center">
    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
      Signature Menu
    </h2>

    <p className="text-white/70 max-w-2xl mx-auto mb-12 text-base sm:text-lg">
      Carefully curated dishes that celebrate Uganda&apos;s culinary heritage,
      crafted with passion, flavor, and a modern twist.
    </p>

    {/* Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {/* Card 1 */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-yellow-400/40 transition">
        <img
        src={luwombo}
          alt="Luwombo"
          className="w-full h-48 object-cover"
        />

        <div className="p-5 text-left">
          <h3 className="text-lg font-semibold mb-1">Luwombo</h3>
          <p className="text-sm text-white/60">
            A royal Ugandan delicacy slow-cooked to perfection.
          </p>
        </div>
      </div>

      {/* Card 2 */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-yellow-400/40 transition">
        <img
         src={grilledGoat}
        alt="Grilled Goat"
         className="w-full h-48 object-cover"
        />

        <div className="p-5 text-left">
          <h3 className="text-lg font-semibold mb-1">Grilled Goat</h3>
          <p className="text-sm text-white/60">
            Smoky, tender, and seasoned with local spices.
          </p>
        </div>
      </div>

      {/* Card 3 */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-yellow-400/40 transition">
      <img
             src={matooke}
             alt="Matooke"
              className="w-full h-48 object-cover"
    />

        <div className="p-5 text-left">
          <h3 className="text-lg font-semibold mb-1">Matooke</h3>
          <p className="text-sm text-white/60">
            A Ugandan staple elevated with Kurax finesse.
          </p>
        </div>
      </div>
    </div>
  </div>
</section>
{/* About Kurax Section */}
<section className="bg-black text-white font-outfit py-20 px-4 sm:px-8 border-t border-white/10">
  <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
    
    {/* Text */}
    <div>
      <h2 className="text-3xl sm:text-4xl font-bold mb-4">
        About Kurax
      </h2>

      <p className="text-white/70 leading-relaxed mb-4">
        Kurax Food Lounge & Bistro is a celebration of culture, flavor, and
        elevated dining. Rooted in Uganda’s rich culinary traditions, we blend
        authentic recipes with modern presentation and ambiance.
      </p>

      <p className="text-white/70 leading-relaxed">
        From signature dishes to rooftop vibes, Kurax is where food, community,
        and unforgettable moments come together.
      </p>
    </div>

    {/* Image */}
    <div className="relative">
      <img
        src={about}
        alt="Kurax Interior"
        className="rounded-xl w-full h-80 object-cover"
      />
      <div className="absolute inset-0 bg-black/20 rounded-xl" />
    </div>
  </div>
</section>
</section>
  );
}
