import React from "react";
import logo from "../assets/images/logo.jpeg";

function NavButton({ children, href }) {
  return (
    <li>
      <a
        href={href}
        className="font-body bg-[#C9A24D] text-black px-4 py-2 rounded-full hover:bg-[#a8853a] transition-colors whitespace-nowrap text-sm sm:text-base"
      >
        {children}
      </a>
    </li>
  );
}

export default function Navbar() {
  return (
    <header className="border-b border-yellow-500/20 sticky top-0 z-50 bg-black">
          <div className="flex flex-col md:flex-row items-center md:justify-between px-4 md:px-8 py-4 gap-4 md:gap-0">
    
            {/* Logo */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <img
                src={logo}
                alt="Kurax Logo"
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
               <h1 className="font-body font-semibold text-white text-sm sm:text-base md:text-xl whitespace-nowrap">
                     KURAX FOOD LOUNGE & BISTRO </h1>
                <p className="text-sm md:text-base text-yellow-400">
                  Luxury dining, signature drinks & rooftop vibes
                </p>
              </div>
            </div>
            </div>
         </header>
  );
}
