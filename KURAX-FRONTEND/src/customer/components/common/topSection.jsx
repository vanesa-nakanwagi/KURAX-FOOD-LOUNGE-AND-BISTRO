import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Search, ShoppingCart } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
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
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerRef = useRef(null);

  // Measure header height for the spacer
  useEffect(() => {
    const updateHeight = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight);
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Scroll-driven shadow intensity
  const headerShadow = useTransform(
    scrollY,
    [0, 80],
    ["0 0px 0px rgba(0,0,0,0)", "0 4px 24px rgba(0,0,0,0.12)"]
  );

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((query) => {
      if (query.trim()) {
        if (location.pathname !== "/menus" && location.pathname !== "/events") {
          navigate("/menus");
        } else {
          window.dispatchEvent(new CustomEvent("search", { detail: query }));
        }
      } else {
        window.dispatchEvent(new CustomEvent("search", { detail: "" }));
      }
    }, 300),
    [location.pathname, navigate]
  );

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      localStorage.setItem("searchQuery", searchQuery);
      if (location.pathname !== "/menus" && location.pathname !== "/events") {
        navigate("/menus");
      } else {
        window.dispatchEvent(new CustomEvent("search", { detail: searchQuery }));
      }
    }
  };

  return (
    <>
      {/*
        ─── SPACER ───────────────────────────────────────────────────────────────
        Pushes page content down by exactly the header's rendered height so
        nothing is hidden behind the fixed bar. Height is measured dynamically
        so it stays correct no matter how the header wraps on small screens.
      */}
      <div style={{ height: headerHeight }} aria-hidden="true" />

      {/*
        ─── FIXED HEADER ─────────────────────────────────────────────────────────
        `fixed` + `top-0` guarantees it stays on screen regardless of any parent
        `overflow` rule that would break `sticky`.  `w-full` is required because
        fixed elements are taken out of normal flow and default to shrink-wrap.
      */}
      <motion.header
        ref={headerRef}
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ boxShadow: headerShadow }}
        className="fixed top-0 left-0 right-0 w-full z-50 transition-colors duration-300 font-['Outfit'] bg-white/90 dark:bg-black/90 backdrop-blur-md"
      >
        {/* Scroll Progress Indicator */}
        <motion.div
          className="absolute bottom-0 left-0 h-[2px] bg-yellow-500 z-50"
          style={{
            scaleX: useTransform(scrollY, [0, 1000], [0, 1]),
            originX: 0,
          }}
        />

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:justify-between px-6 py-4 gap-4 md:gap-0">

          {/* --- LOGO SECTION --- */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-4 flex-shrink-0 group cursor-pointer"
            onClick={() => navigate("/")}
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

          {/* --- SEARCH + CART --- */}
          <div className="w-full md:w-auto flex flex-wrap items-center gap-4">
            {/* SEARCH BAR */}
            <div className="relative group flex-1 min-w-0 md:w-80">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500">
                <Search size={18} strokeWidth={2} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyPress={handleKeyPress}
                placeholder={searchPlaceholder || "Search menus, events..."}
                className="w-full min-w-0 rounded-full bg-zinc-100 dark:bg-zinc-800/50 border border-transparent focus:border-yellow-500/50 text-sm pl-10 pr-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-yellow-500/10 transition-all duration-300"
              />
            </div>

            {/* CART BUTTON */}
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
          </div>
        </div>

        {/* --- NAVIGATION LINKS --- */}
        <nav className="flex flex-wrap justify-center items-center gap-6 py-6 overflow-x-auto no-scrollbar">
          {[
            { name: "Home", path: "/" },
            { name: "Menus", path: "/menus" },
            { name: "Events", path: "/events" },
            { name: "Reservations", path: "/reservations" },
          ].map((link) => (
            <Link
              key={link.name}
              to={link.path}
              className="relative group text-[16px] text-zinc-700 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors whitespace-nowrap"
            >
              {link.name}
              <motion.span
                className="absolute -bottom-1 left-0 h-[2px] bg-yellow-500"
                initial={false}
                animate={{ width: location.pathname === link.path ? "100%" : "0%" }}
                transition={{ duration: 0.3 }}
              />
            </Link>
          ))}
        </nav>
      </motion.header>
    </>
  );
}