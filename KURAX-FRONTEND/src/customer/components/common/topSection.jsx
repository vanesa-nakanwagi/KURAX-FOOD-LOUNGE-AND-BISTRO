import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Search, ShoppingCart, Menu, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import ThemeToggle from "../context/ThemeToggle";
import logo from "../../assets/images/logo.jpeg";

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default function TopSection({ searchPlaceholder }) {
  const { cart, setIsCartOpen } = useCart();
  const { scrollY } = useScroll();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  // Scroll animations for glassmorphism effect
  const headerBlur = useTransform(scrollY, [0, 100], ["blur(0px)", "blur(12px)"]);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((query) => {
      if (query.trim()) {
        // Navigate to menus page if not already there and search is for menus
        if (location.pathname !== '/menus' && location.pathname !== '/events') {
          navigate('/menus');
        } else {
          // Dispatch custom event for the current page component
          window.dispatchEvent(new CustomEvent('search', { detail: query }));
        }
      } else {
        // Clear search when query is empty
        window.dispatchEvent(new CustomEvent('search', { detail: '' }));
      }
    }, 300),
    [location.pathname, navigate]
  );

  // Handle search input change
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  // Handle search submission (Enter key or button click)
  const handleSearch = () => {
    if (searchQuery.trim()) {
      // Store search query in localStorage for persistence
      localStorage.setItem('searchQuery', searchQuery);
      
      // Navigate to menus page if not already there
      if (location.pathname !== '/menus' && location.pathname !== '/events') {
        navigate('/menus');
      } else {
        // Dispatch custom event for the current page component
        window.dispatchEvent(new CustomEvent('search', { detail: searchQuery }));
      }
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      style={{ 
        backdropFilter: headerBlur,
      }}
      className="sticky top-0 z-50 transition-colors duration-300 font-['Outfit'] bg-white/80 dark:bg-black/80 backdrop-blur-md"
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
          onClick={() => navigate('/')}
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
            <h1 className="text-xl md:text-2xl font-outfit font-medium tracking-tight text-black dark:text-white leading-tight">
              KURAX FOOD LOUNGE & BISTRO
            </h1>
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-yellow-700">
              Luxury Dining & Rooftop Vibes
            </p>
          </div>
        </motion.div>

        {/* --- SEARCH + CART + THEME --- */}
        <div className="w-full md:w-auto flex flex-wrap items-center gap-4">
          <div className="relative group flex-1 min-w-0 md:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyPress={handleKeyPress}
              placeholder={searchPlaceholder || "Search menus, events..."}
              className="w-full min-w-0 rounded-full bg-zinc-100 dark:bg-zinc-800/50 border border-transparent focus:border-yellow-500/50 text-sm px-5 py-2.5 pr-12 focus:outline-none focus:ring-4 focus:ring-yellow-500/10 transition-all duration-300"
            />
            <motion.button
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleSearch}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/20 cursor-pointer z-10"
            >
              <Search size={14} className="text-black stroke-[3px]" />
            </motion.button>
          </div>

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
      <nav className="flex flex-wrap justify-center items-center gap-4 py-4 overflow-x-auto no-scrollbar">
        {[
          { name: "Home", path: "/" },
          { name: "Menus", path: "/menus" },
          { name: "Events", path: "/events" },
          { name: "Reservations", path: "/reservations" }
        ].map((link) => (
          <Link
            key={link.name}
            to={link.path}
            className="relative group text-[16px] text-zinc-700 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors whitespace-nowrap"
          >
            {link.name}
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