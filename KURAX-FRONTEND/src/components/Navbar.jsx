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
    <nav className="relative z-20 w-full bg-black/70 backdrop-blur border-b border-white/10 font-body">
      <div className="max-w-full sm:max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Logo + text */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 w-full sm:w-auto text-center sm:text-left">
          <img
            src={logo}
            alt="Kurax Logo"
            className="w-10 sm:w-12 h-10 sm:h-12 rounded-full object-cover flex-shrink-0"
          />
          <div className="leading-tight">
            <h1 className="font-body text-base sm:text-lg md:text-xl font-semibold text-white">
              KURAX FOOD LOUNGE & BISTRO
            </h1>
            <p className="font-body text-xs sm:text-sm md:text-base text-yellow-400">
              Luxury dining, signature drinks & rooftop vibes
            </p>
          </div>
        </div>

        {/* Right actions */}
        <ul className="flex items-center gap-2 sm:gap-4 text-sm sm:text-base flex-wrap justify-center sm:justify-end w-full sm:w-auto">
          <NavButton href="#signin">Sign In</NavButton>
        </ul>
      </div>
    </nav>
  );
}
