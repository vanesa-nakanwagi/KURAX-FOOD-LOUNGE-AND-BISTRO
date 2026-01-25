import { useEffect, useState } from "react";
import hero1 from "../../assets/images/hero1.jpg";
import hero2 from "../../assets/images/hero2.jpg";
import hero3 from "../../assets/images/hero13.jpg";
import hero4 from "../../assets/images/hero4.jpg";
import hero5 from "../../assets/images/hero5.jpg";
import hero12 from "../../assets/images/hero12.jpg";

const heroImages = [hero1, hero2, hero3, hero4, hero5, hero12];

export default function About() {

 const [current, setCurrent] = useState(0);

  useEffect(() => {
      const interval = setInterval(() => {
        setCurrent((prev) => (prev + 1) % heroImages.length);
      }, 6000);
      return () => clearInterval(interval);
    }, []);

  return (
    // Main Container: Black background, full width, with internal padding
    <div className="bg-black text-white min-h-screen font-[Outfit] pt-16 md:pt-24 pb-16">
      
      {/* Centered Content Wrapper */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-20">

        {/* Header/Sub-Title */}
        <p className="text-lg font-semibold tracking-widest text-yellow-600 uppercase mb-4">
          ABOUT KURAX
        </p>

        {/* Main Content Grid: Text on Left, Image on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20">
          
          {/* LEFT COLUMN: Text, Description, and Stats */}
          <div className="flex flex-col justify-between">
            <div>
              {/* Title */}
              <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-8">
                Where Tradition Meets Modern Luxury
              </h1>

              {/* Description Paragraph 1 */}
              <p className="text-lg text-white/80 mb-6 max-w-lg">
                Kurax Food Lounge & Bistro is a celebration of culture, flavor, and elevated
                dining. Located in the heart of Kyanja, we blend Uganda’s rich culinary
                traditions with sophisticated presentation and ambiance.
              </p>

              {/* Description Paragraph 2 */}
              <p className="text-lg text-white/80 mb-12 max-w-lg">
                From signature dishes to rooftop vibes, Kurax is where food, community,
                and unforgettable moments come together. Every dish tells a story of
                passion, heritage, and culinary excellence.
              </p>
            </div>

            {/* Statistics Section (Bottom Left) */}
            <div className="flex gap-12 mt-12">
              <div className="space-y-1">
                <p className="text-5xl font-extrabold text-yellow-600">
                  500+
                </p>
                <p className="text-sm text-white/70">
                  Happy Clients
                </p>
              </div>
              
              <div className="space-y-1">
                <p className="text-5xl font-extrabold text-yellow-600">
                  15+
                </p>
                <p className="text-sm text-white/70">
                  Signature Dishes
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Image and Caption */}
          <div className="relative rounded-none overflow-hidden shadow-2xl h-[450px] md:h-[600px] mt-8 lg:mt-0">
            {/* Image (using the provided image URL) */}
              {heroImages.map((img, index) => (
          <div
            key={index}
            className={`absolute inset-0 bg-center bg-cover transition-opacity duration-1000 ${
            index === current
             ? "opacity-100 animate-zoomOut"
             : "opacity-0"
            }`}
         style={{ backgroundImage: `url(${img})` }}
         />
))}
            
            {/* Caption/Overlay Text */}
            <div className="absolute inset-0 bg-black/10 flex items-end justify-center p-6">
              <p className="text-xl font-semibold text-white/90 px-4 py-2 rounded">
                "Experience the essence of Uganda"
              </p>
            </div>
          </div>
        </div>
      </div>
      
      
      
    </div>
  );
}