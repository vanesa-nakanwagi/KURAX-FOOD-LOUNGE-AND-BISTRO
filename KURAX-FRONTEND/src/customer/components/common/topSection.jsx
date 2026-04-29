import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Search, ShoppingCart } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import logo from "../../assets/images/logo.jpeg";

// Debounce utility
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

  // Measure header height for spacer
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

  // Simple shadow intensity
  const headerShadow = useTransform(
    scrollY,
    [0, 80],
    ["0 1px 0 rgba(0,0,0,0.05)", "0 4px 20px rgba(0,0,0,0.1)"]
  );

  // Debounced search
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
      if (location.pathname !== "/menus" && location.pathname !== "/events") {
        navigate("/menus");
      } else {
        window.dispatchEvent(new CustomEvent("search", { detail: searchQuery }));
      }
    }
  };

  return (
    <>
      {/* Spacer */}
      <div style={{ height: headerHeight }} aria-hidden="true" />

      {/* Fixed Header – solid white, no transparency */}
      <motion.header
        ref={headerRef}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ boxShadow: headerShadow }}
        className="fixed top-0 left-0 right-0 w-full z-50 bg-white border-b border-gray-100 font-['Outfit']"
      >
        {/* Scroll progress bar */}
        <motion.div
          className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-yellow-500 to-yellow-600"
          style={{
            scaleX: useTransform(scrollY, [0, 1000], [0, 1]),
            originX: 0,
          }}
        />

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:justify-between px-6 py-4 gap-4 md:gap-0">
          {/* Logo */}
          <div
            className="flex items-center gap-4 flex-shrink-0 group cursor-pointer"
            onClick={() => navigate("/")}
          >
            <div className="relative">
              <img
                src={logo}
                alt="Kurax Logo"
                className="w-14 h-14 rounded-full object-cover border-2 border-yellow-500/30 group-hover:border-yellow-500 transition-colors duration-300"
              />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-outfit font-medium tracking-tight text-gray-900">
                KURAX FOOD LOUNGE & BISTRO
              </h1>
              <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-yellow-600">
                Luxury Dining & Rooftop Vibes
              </p>
            </div>
          </div>

          {/* Search + Cart */}
          <div className="w-full md:w-auto flex flex-wrap items-center gap-4">
            {/* Search bar */}
            <div className="relative group flex-1 min-w-0 md:w-80">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-500">
                <Search size={18} strokeWidth={2} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyPress={handleKeyPress}
                placeholder={searchPlaceholder || "Search menus, events..."}
                className="w-full min-w-0 rounded-full border border-gray-200 bg-white text-sm pl-10 pr-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/30 focus:border-yellow-500 transition-all"
              />
            </div>

            {/* Cart button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCartOpen(true)}
              className="relative w-11 h-11 rounded-full bg-yellow-500 flex items-center justify-center shadow-md hover:bg-yellow-600 transition-all"
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

        {/* Navigation links – border line removed */}
        <nav className="flex flex-wrap justify-center items-center gap-6 py-4 overflow-x-auto no-scrollbar">
          {[
            { name: "Home", path: "/" },
            { name: "Menus", path: "/menus" },
            { name: "Events", path: "/events" },
            { name: "Reservations", path: "/reservations" },
          ].map((link) => (
            <Link
              key={link.name}
              to={link.path}
              className="relative group text-[15px] transition-colors whitespace-nowrap font-medium text-gray-700 hover:text-yellow-600"
            >
              {link.name}
              <span
                className="absolute -bottom-1 left-0 h-[2px] bg-yellow-500 transition-all duration-200"
                style={{ width: location.pathname === link.path ? "100%" : "0%" }}
              />
            </Link>
          ))}
        </nav>
      </motion.header>
    </>
  );
}