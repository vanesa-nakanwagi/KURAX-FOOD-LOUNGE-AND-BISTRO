import { useEffect, useState } from "react";
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
    <section className="relative h-screen w-full overflow-hidden">
      {images.map((img, index) => (
        <div
          key={index}
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
            index === current ? "opacity-100" : "opacity-0"
          }`}
          style={{ backgroundImage: `url(${img})` }}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/80" />

      <div className="relative z-10 h-full flex items-center justify-center text-center px-6">
        <div>
          <h1 className="font-serif text-6xl md:text-7xl lg:text-8xl font-bold text-white">
            Kurax Food Lounge
            <span className="block mt-3 text-[#C9A24D]">& Bistro</span>
          </h1>

          <p className="mt-6 text-xl md:text-2xl text-gray-200">
            Luxury dining, signature drinks & rooftop vibes
          </p>
        </div>
      </div>
    </section>
  );
}
