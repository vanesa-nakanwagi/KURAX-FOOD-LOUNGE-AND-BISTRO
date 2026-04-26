import React, { useState, useEffect } from "react";
import logo from "../../assets/images/logo.jpeg";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

const navLinks = [
  { name: "Home",         path: "/#hero"         },
  { name: "Menu",         path: "/#menus"        },
  { name: "Events",       path: "/#events"       },
  { name: "Reservations", path: "/#reservations" },
  { name: "Services",     path: "/#services"     },
  { name: "About",        path: "/#about"        },
  { name: "Location",     path: "/#visit"        },
  { name: "Contact",      path: "/#contact"      },
];

export default function Navbar() {
  const [open,     setOpen]     = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 font-[Outfit]
        ${scrolled
          ? "bg-white/95 backdrop-blur-md border-b border-black/10 py-3 shadow-sm"
          : "bg-transparent py-5"}`}
    >
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Kurax Logo"
            className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border border-yellow-500/20"
          />
          <h1 className={`text-sm md:text-xl font-medium tracking-tight transition-colors duration-300
            ${scrolled ? "text-zinc-900" : "text-white"}`}>
            KURAX FOOD LOUNGE &amp; BISTRO
          </h1>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex max-w-full flex-wrap items-center gap-6 overflow-x-auto no-scrollbar">
          {navLinks.map(link => (
            <Link
              key={link.name}
              to={link.path}
              className={`text-md whitespace-nowrap transition-colors duration-300
                ${scrolled
                  ? "text-zinc-700 hover:text-yellow-500"
                  : "text-white/80 hover:text-yellow-400"}`}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(o => !o)}
          className={`md:hidden p-2 rounded-xl transition-colors duration-300
            ${scrolled ? "text-zinc-800 hover:bg-black/5" : "text-white hover:bg-white/10"}`}
          aria-label="Toggle menu"
        >
          {open ? <X size={22}/> : <Menu size={22}/>}
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className={`md:hidden border-t animate-in slide-in-from-top duration-300
          ${scrolled ? "bg-white border-black/10" : "bg-black/95 border-yellow-500/20"}`}>
          <div className="flex flex-col px-6 py-6 gap-5">
            {navLinks.map(link => (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setOpen(false)}
                className={`text-lg font-medium border-b pb-2 transition-colors
                  ${scrolled
                    ? "text-zinc-800 hover:text-yellow-500 border-black/5"
                    : "text-white hover:text-yellow-400 border-white/5"}`}
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