import { useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Search, ShoppingCart, Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext";
import ThemeToggle from "../context/ThemeToggle";
import logo from "../../assets/images/logo.jpeg";

export default function TopSection({ searchPlaceholder }) {
  const { cart, setIsCartOpen } = useCart();
  const { scrollY } = useScroll();
  const location = useLocation();

  // Scroll animations for glassmorphism effect
  const headerBg = useTransform(
    scrollY,
    [0, 100],
    ["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.8)"]
  );
  const headerBlur = useTransform(scrollY, [0, 100], ["blur(0px)", "blur(12px)"]);
  const borderOpacity = useTransform(scrollY, [0, 100], [0, 1]);

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      style={{ 
        backgroundColor: headerBg, 
        backdropFilter: headerBlur,
        borderBottom: `1px solid rgba(202, 138, 4, 0.2)` 
      }}
      className="sticky top-0 z-50 transition-colors duration-300 font-['Outfit']"
    >
      {/* Scroll Progress Indicator */}
      <motion.div 
        className="absolute bottom-0 left-0 h-[2px] bg-yellow-500 z-50"
        style={{ scaleX: useTransform(scrollY, [0, 1000], [0, 1]), originX: 0 }}
      />

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:justify-between px-6 py-4 gap-4 md:gap-0">

        {/* --- LOGO SECTION --- */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-4 flex-shrink-0 group cursor-pointer"
        >
          <div className="relative">
            <img
              src={logo}
              alt="Kurax Logo"
              className="w-14 h-14 rounded-full object-cover border-2 border-yellow-500/30 group-hover:border-yellow-500 transition-colors duration-500"
            />
            <div className="absolute inset-0 rounded-full bg-yellow-500/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-bold tracking-tight text-black dark:text-white leading-tight">
              KURAX FOOD LOUNGE<span className="text-yellow-600"> & BISTRO </span>
            </h1>
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-yellow-600/80">
              Luxury Dining & Rooftop Vibes
            </p>
          </div>
        </motion.div>

        {/* --- SEARCH + CART + THEME --- */}
        <div className="w-full md:w-auto flex items-center gap-4">
          
          {/* Premium Search Bar */}
          <div className="relative group flex-1 md:w-64">
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="w-full rounded-full bg-zinc-100 dark:bg-zinc-800/50 border border-transparent focus:border-yellow-500/50 text-sm px-5 py-2.5 pr-12 focus:outline-none focus:ring-4 focus:ring-yellow-500/10 transition-all duration-300"
            />
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/20"
            >
              <Search size={14} className="text-black stroke-[3px]" />
            </motion.button>
          </div>

          {/* Interactive Cart */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsCartOpen(true)}
            className="relative w-11 h-11 rounded-full bg-yellow-500 flex items-center justify-center shadow-xl shadow-yellow-500/20 group"
          >
            <ShoppingCart size={20} className="text-black" />
            <AnimatePresence>
              {cart.length > 0 && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 bg-black text-yellow-500 text-[10px] font-black min-w-[20px] h-[20px] rounded-full flex items-center justify-center border-2 border-yellow-500"
                >
                  {cart.length}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <ThemeToggle />
        </div>
      </div>

      {/* --- NAVIGATION LINKS --- */}
      <nav className="flex justify-center items-center gap-10 py-4 border-t border-yellow-500/5">
        {[
          { name: "Home", path: "/" },
          { name: "Menus", path: "/menus" },
          { name: "Events", path: "/events" },
          { name: "Reservations", path: "/reservations" }
        ].map((link) => (
          <Link
            key={link.name}
            to={link.path}
            className="relative group text-xs uppercase tracking-[0.2em] font-bold text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
          >
            {link.name}
            {/* Gold Underline Animation */}
            <motion.span 
              className="absolute -bottom-1 left-0 w-0 h-[2px] bg-yellow-500 transition-all duration-300 group-hover:w-full" 
              initial={false}
              animate={location.pathname === link.path ? { width: "100%" } : {}}
            />
          </Link>
        ))}
      </nav>
    </motion.header>
  );
}