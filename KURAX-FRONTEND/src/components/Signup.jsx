import { useEffect, useState } from "react";
import Navbar from "./Navbar"; // adjust path if needed
import hero1 from "../assets/images/hero1.jpg";
import hero2 from "../assets/images/hero2.jpg";
import hero3 from "../assets/images/hero3.jpg";

const images = [hero1, hero2, hero3];

export default function Hero() {
  const [current, setCurrent] = useState(0);

  // Image slider
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative h-screen w-full overflow-hidden font-body">
      {/* Navbar at the top */}
      <Navbar />

      {/* Background images */}
      {images.map((img, index) => (
        <div
          key={index}
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
            index === current ? "opacity-100" : "opacity-0"
          }`}
          style={{ backgroundImage: `url(${img})` }}
        />
      ))}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/80" />

      {/* Hero content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4 sm:px-6 md:px-8">
        {/* Main heading */}
        <h1 className="font-body font-semibold text-3xl sm:text-4xl md:text-6xl lg:text-7xl text-white leading-tight sm:leading-snug md:leading-tight">
          Kurax Food Lounge
          <span className="block mt-2 sm:mt-3 text-yellow-400 font-body font-semibold">
            & Bistro
          </span>
        </h1>

        {/* Subtitle */}
        <p className="font-body font-medium mt-4 sm:mt-5 md:mt-6 text-base sm:text-lg md:text-2xl text-white leading-relaxed max-w-xl">
          Luxury dining, signature drinks & rooftop vibes
        </p>

      </div>
    </section>
  );
}
