import React from "react";
import logo from "../assets/images/logo.jpeg";

function NavButton({ children, href }) {
  return (
    <li>
      <a
        href={href}
        className="bg-[#C9A24D] text-black px-4 py-2 rounded-full hover:bg-[#a8853a] transition-colors whitespace-nowrap"
      >
        {children}
      </a>
    </li>
  );
}

export default function Navbar() {
  return (
    <nav className="relative z-20 w-full bg-black/70 backdrop-blur border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center">
        {/* Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <img
            src={logo}
            alt="Kurax Logo"
            className="w-12 h-12 rounded-full object-cover"
          />
          <div className="leading-tight">
            <h1 className="text-lg md:text-xl font-semibold text-white">
              KURAX FOOD LOUNGE & BISTRO
            </h1>
            <p className="text-sm md:text-base text-yellow-400">
              Luxury dining, signature drinks & rooftop vibes
            </p>
          </div>
        </div>

        {/* Right actions */}
        <ul className="ml-auto flex items-center gap-4 text-sm">
          <NavButton href="#signin">Sign In</NavButton>
        </ul>
      </div>
    </nav>
  );
}
