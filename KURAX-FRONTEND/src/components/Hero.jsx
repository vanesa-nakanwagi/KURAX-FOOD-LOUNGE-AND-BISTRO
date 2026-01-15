import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import hero1 from "../assets/images/hero1.jpg";
import hero2 from "../assets/images/hero2.jpg";
import hero3 from "../assets/images/hero3.jpg";

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
          <span className="block mt-2 text-yellow-400">
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
    </section>
  );
}
