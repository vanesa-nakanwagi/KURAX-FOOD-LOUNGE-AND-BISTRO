import { useEffect, useState } from "react";
import { Link } from "react-router-dom"; // import Link
import Navbar from "./Navbar"; 
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
    <section className="relative w-full h-[300px] md:h-[700px]">
      {/* Navbar */}
      <Navbar />

      {/* Background images */}
      {images.map((img, index) => (
        <div
          key={index}
          className={`absolute inset-0 bg-center bg-cover transition-opacity duration-1000 transform scale-100 hover:scale-105 ${
            index === current ? "opacity-100" : "opacity-0"
          }`}
          style={{ backgroundImage: `url(${img})` }}
        />
      ))}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />

      {/* Animated shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <span className="absolute w-24 h-24 bg-yellow-400 rounded-full opacity-30 -top-12 -left-12 animate-bounce-slow"></span>
        <span className="absolute w-16 h-16 bg-white rounded-full opacity-20 top-1/4 right-10 animate-bounce-slow"></span>
      </div>

      {/* Hero content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-start sm:justify-center text-center px-4 sm:px-6 md:px-8 pt-16 sm:pt-24 md:pt-0">
        <h1 className="font-body font-bold text-3xl sm:text-4xl md:text-6xl lg:text-7xl text-white leading-snug sm:leading-tight animate-fadeUp">
          Elevated Local Dishes
          <span className="block mt-2 sm:mt-3 text-yellow-400 font-body font-bold">
            & Flavors
          </span>
        </h1>

        <p className="font-body font-medium mt-3 sm:mt-4 md:mt-6 text-base sm:text-lg md:text-2xl text-white leading-relaxed max-w-xs sm:max-w-md md:max-w-lg animate-fadeUp delay-200">
          Let's Dine together and Savor the Moments
        </p>

        {/* Sign In Button navigates to Home page */}
        <Link
          to="/home"
          className="mt-6 sm:mt-8 px-6 py-3 border-2 border-yellow-400 text-white rounded-none hover:bg-yellow-400 hover:text-black transition-all duration-300 flex items-center gap-2 animate-fadeUp delay-400 group"
        >
          Sign In
         
        </Link>
      </div>
    </section>
  );
}
