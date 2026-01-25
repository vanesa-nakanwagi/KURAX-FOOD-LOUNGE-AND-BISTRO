import React, { useState, useEffect } from "react";
import logo from "../../assets/images/logo.jpeg";
import { Link } from "react-router-dom";
// 1. Import the User icon
import { UserCircle } from "lucide-react";

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
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
        
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Kurax Logo"
            className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border border-yellow-500/20"
          />
          <h1 className="text-sm md:text-xl font-bold text-white tracking-tight">
              KURAX FOOD LOUNGE & BISTRO
          </h1>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              className="text-sm font-medium text-white/80 hover:text-yellow-400 transition"
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Action Icons (Profile for Testing) */}
        <div className="flex items-center gap-4">
          {/* 2. Content Creator Profile Link */}
          <Link 
            to="/content-creator" 
            className="flex items-center gap-2 group p-1"
            title="Staff Dashboard (Test)"
          >
            <UserCircle className="w-6 h-6 md:w-7 md:h-7 text-white group-hover:text-yellow-500 transition-colors" />
            
          </Link>

          {/* Mobile Toggle */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden text-white p-1"
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
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden bg-black/95 border-t border-yellow-500/20 animate-in slide-in-from-top duration-300">
          <div className="flex flex-col px-6 py-6 gap-5">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setOpen(false)}
                className="text-lg font-medium text-white hover:text-yellow-400 border-b border-white/5 pb-2"
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