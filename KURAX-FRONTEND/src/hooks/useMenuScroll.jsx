import React from "react";
import logo from "../assets/images/logo.jpeg";

// Reusable NavButton component
function NavButton({ children, href }) {
  return (
    <li>
      <a
        href={href}
        className="font-body bg-[#C9A24D] text-black px-4 py-2 rounded-full hover:bg-[#a8853a] transition-colors whitespace-nowrap"
      >
        {children}
      </a>
    </li>
  );
}

export default function Navbar() {
  return (
    <nav className="relative z-20 w-full bg-black/70 backdrop-blur border-b border-white/10 font-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 flex flex-col sm:flex-row items-center sm:justify-between gap-4">
        {/* Logo */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <img
                    src={logo}
                    alt="Kurax Logo"
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <h1 className="text-lg md:text-xl font-semibold text-white">
                      KURAX FOOD LOUNGE & BISTRO
                    </h1>
                    <p className="text-sm md:text-base text-yellow-400">
                      Luxury dining, signature drinks & rooftop vibes
                    </p>
                  </div>
                </div>
        {/* Right actions */}
        <ul className="flex items-center gap-4 text-sm font-body flex-wrap justify-center sm:justify-end">
          <NavButton href="#signin">Sign In</NavButton>
        </ul>
      </div>
    </nav>
  );
}
