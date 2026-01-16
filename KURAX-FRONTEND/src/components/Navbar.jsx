import React, { useState } from "react";
import logo from "../assets/images/logo.jpeg";

const navLinks = [
  { name: "Home", href: "#home" },
  { name: "Menu", href: "#menu" },
  { name: "About", href: "#about" },
  { name: "Events", href: "#events" },
  { name: "Location", href: "#location" },
  { name: "Contact", href: "#contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-black border-b border-yellow-500/20">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Kurax Logo"
            className="w-10 h-10 rounded-full object-cover"
          />
          <span className="text-white font-semibold tracking-wide">
            KURAX FOOD LOUNGE & BISTRO
          </span>
        
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm text-white/80 hover:text-yellow-400 transition"
            >
              {link.name}
            </a>
          ))}
        </nav>

        {/* Sign In Button (Desktop) */}
        <div className="hidden md:block">
          <a
            href="#signin"
            className="border border-yellow-400 text-yellow-400 px-5 py-2 text-sm font-medium hover:bg-yellow-400 hover:text-black transition"
          >
            Sign In
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden text-white focus:outline-none"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden bg-black border-t border-yellow-500/20">
          <div className="flex flex-col px-6 py-4 gap-4">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-white/80 hover:text-yellow-400 transition"
                onClick={() => setOpen(false)}
              >
                {link.name}
              </a>
            ))}

            <a
              href="#signin"
              className="mt-2 border border-yellow-400 text-yellow-400 text-center py-2 hover:bg-yellow-400 hover:text-black transition"
            >
              Sign In
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
