import React, { useState } from "react";
import logo from "../assets/images/logo.jpeg";
import { Link } from "react-router-dom";

const navLinks = [
  { name: "Home", path: "/home" },
  { name: "Menu", path: "/menus" },
  { name: "Events", path: "/events" },
  { name: "Reservations", path: "/reservations" },
  { name: "Booking Services", path: "/services" },
  { name: "About", path: "/about" },
  { name: "Location", path: "/location" },
  { name: "Contact", path: "/contact" },
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
          <div className="leading-tight">
            <h1 className="text-white font-semibold tracking-wide text-base sm:text-lg md:text-xl">
              <span className="block sm:inline">KURAX FOOD LOUNGE</span>
              <span className="block sm:inline sm:ml-1">&amp; BISTRO</span>
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-yellow-400 mt-1">
              Luxury dining, signature drinks &amp; rooftop vibes
            </p>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              className="text-sm text-white/80 hover:text-yellow-400 transition"
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Staff Login Button (Desktop) */}
        <div className="hidden md:block">
          <Link
            to="/staff-login"
            className="border border-yellow-400 text-yellow-400 px-5 py-2 text-sm font-medium hover:bg-yellow-400 hover:text-black transition"
          >
            Staff Login
          </Link>
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden bg-black border-t border-yellow-500/20">
          <div className="flex flex-col px-6 py-4 gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setOpen(false)}
                className="text-white/80 hover:text-yellow-400 transition"
              >
                {link.name}
              </Link>
            ))}

            {/* Staff Login Button (Mobile) */}
            <Link
              to="/staff-login"
              onClick={() => setOpen(false)}
              className="mt-8 px-6 py-3 border-2 border-yellow-400 text-white text-center hover:bg-yellow-400 hover:text-black transition-all duration-300"
            >
              Staff Login
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
