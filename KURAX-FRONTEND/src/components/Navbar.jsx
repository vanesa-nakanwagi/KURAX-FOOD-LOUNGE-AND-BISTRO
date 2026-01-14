import React from "react";
import logo from "../assets/images/logo.jpeg";

function NavButton({ children, href }) {
  return (
    <a
      href={href}
      className="font-body bg-[#C9A24D] text-black px-4 py-2 rounded-full hover:bg-[#a8853a] transition-colors whitespace-nowrap text-sm sm:text-base"
    >
      {children}
    </a>
  );
}

export default function Navbar() {
  return (
    <nav className="relative z-20 w-full bg-black/70 backdrop-blur border-b border-white/10 font-body">
      <div className="max-w-full sm:max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex-shrink-0">
          <img
            src={logo}
            alt="Kurax Logo"
            className="w-14 sm:w-16 md:w-20 h-14 sm:h-16 md:h-20 object-cover"
          />
        </div>

        {/* Sign In button */}
        <div className="flex-shrink-0">
          <NavButton href="#signin">Sign In</NavButton>
        </div>
      </div>
    </nav>
  );
}
