import { Search, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "../components/context/CartContext";
import ThemeToggle from "../components/ThemeToggle"; // Theme toggle
import logo from "../assets/images/logo.jpeg";

export default function TopSection({ searchPlaceholder }) {
  const { cart, setIsCartOpen } = useCart();

  return (
    <header className="border-b border-yellow-500/20 sticky top-0 z-50 bg-white dark:bg-black transition-colors duration-300">
      <div className="flex flex-col md:flex-row items-center md:justify-between px-4 md:px-8 py-4 gap-4 md:gap-0">

        {/* Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <img
            src={logo}
            alt="Kurax Logo"
            className="w-12 h-12 rounded-full object-cover"
          />
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-black dark:text-white" style={{ fontFamily: "Inter, sans-serif" }}>
              KURAX FOOD LOUNGE & BISTRO
            </h1>
            <p className="text-sm md:text-base text-yellow-400">
              Luxury dining, signature drinks & rooftop vibes
            </p>
          </div>
        </div>

        {/* Search + Cart + Theme Toggle */}
        <div className="w-full sm:w-3/4 md:w-1/3 flex items-center gap-2">

          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="w-full rounded-full bg-gray-100 dark:bg-white-800 text-black dark:text-white px-5 py-2 pr-12 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-colors duration-300"
            />
            <button
              className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center transition"
            >
              <Search size={15} className="text-black" />
            </button>
          </div>

          {/* Cart */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center transition"
            aria-label="Open cart"
          >
            <ShoppingCart size={18} className="text-black" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                {cart.length}
              </span>
            )}
          </button>

          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex justify-center gap-6 py-4 text-sm md:text-base transition-colors duration-300">
        <Link
          to="/"
          className="text-black dark:text-white hover:text-yellow-500 transition"
        >
          Home
        </Link>
        <Link
          to="/menus"
          className="text-black dark:text-white hover:text-yellow-500 transition"
        >
          Menus
        </Link>
        <Link
          to="/events"
          className="text-black dark:text-white hover:text-yellow-500 transition"
        >
          Events
        </Link>
        <Link
          to="/reservations"
          className="text-black dark:text-white hover:text-yellow-500 transition"
        >
          Reservations
        </Link>
      </nav>
    </header>
  );
}