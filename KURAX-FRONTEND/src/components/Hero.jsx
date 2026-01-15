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
    <section className="relative w-full h-screen sm:h-[80vh] md:h-screen overflow-hidden font-body">
        {/* Navbar at the top */}
        <Navbar />
  {images.map((img, index) => (
    <div
      key={index}
      className={`absolute inset-0 bg-center bg-cover transition-opacity duration-1000 ${
        index === current ? "opacity-100" : "opacity-0"
      }`}
      style={{ backgroundImage: `url(${img})` }}
    />
  ))}

  <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/80" />

  <div className="relative z-10 h-full flex flex-col items-center justify-start sm:justify-center text-center px-4 sm:px-6 md:px-8 pt-20 sm:pt-28 md:pt-0">
  <h1 className="font-body font-semibold text-3xl sm:text-4xl md:text-6xl lg:text-7xl text-white leading-snug sm:leading-tight">
    Kurax Food Lounge
    <span className="block mt-2 sm:mt-3 text-yellow-400 font-body font-semibold">
      & Bistro
    </span>
  </h1>

  <p className="font-body font-medium mt-3 sm:mt-4 md:mt-6 text-base sm:text-lg md:text-2xl text-white leading-relaxed max-w-xs sm:max-w-md md:max-w-lg">
    Luxury dining, signature drinks & rooftop vibes
  </p>

  {/* Sign In Button */}
  <a
    href="#signin"
    className="mt-6 sm:mt-8 px-6 py-3 border-2 border-yellow-400 text-white rounded-none hover:bg-yellow-400 hover:text-black transition-colors flex items-center gap-2"
  >
    Sign In
  </a>
</div>


</section>

  );
}
