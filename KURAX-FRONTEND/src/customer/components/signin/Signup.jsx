import React, { useState, useEffect } from "react";
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
     className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled 
          ? "bg-black/90 backdrop-blur-md border-b border-yellow-500/10 py-3" 
          : "bg-transparent py-5"
      }`}
    >
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
            <p className="text-xs sm:text-sm text-yellow-400">
              Luxury dining, signature drinks & rooftop vibes
            </p>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              className="text-sm text-white hover:text-yellow-400 transition"
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Staff Login */}
        <div className="hidden md:block">
          <Link
            to="/staff-login"
            className="border border-yellow-400 text-yellow-400 px-5 py-2 text-sm font-medium hover:bg-yellow-400 hover:text-black transition"
          >
            Staff Login
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden text-white"
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
        <div className="md:hidden bg-black/95 border-t border-yellow-500/20">
          <div className="flex flex-col px-6 py-4 gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setOpen(false)}
                className="text-white hover:text-yellow-400"
              >
                {link.name}
              </Link>
            ))}

            <Link
              to="/staff-login"
              onClick={() => setOpen(false)}
              className="mt-6 px-6 py-3 border-2 border-yellow-400 text-white text-center hover:bg-yellow-400 hover:text-black transition"
            >
              Staff Login
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
