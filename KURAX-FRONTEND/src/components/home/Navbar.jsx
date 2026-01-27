import React, { useState, useEffect } from "react";
import logo from "../../assets/images/logo.jpeg";
import { Link } from "react-router-dom";

const navLinks = [
  { name: "Menu", path: "/menus" },
  { name: "Events", path: "/events" },
  { name: "Reservations", path: "/reservations" },
  { name: "Services", path: "/services" },
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
     className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 font-[Outfit] ${
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
            className="w-14 h-14 rounded-full object-cover"
          />
          <h1 className="text-lg md:text-xl font-semibold text-white dark:text-white">
              KURAX FOOD LOUNGE & BISTRO
            </h1>

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

          </div>
        </div>
      )}
    </header>
  );
}
