import { Search, ShoppingCart } from "lucide-react";
import { useCart } from "../context/CartContext";
import ThemeToggle from "../context/ThemeToggle";
import logo from "../../assets/images/logo.jpeg";

export default function TopSection({ searchPlaceholder }) {
  const { cart, setIsCartOpen } = useCart();

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-black border-b border-yellow-500/20 transition-colors duration-300">
      
      <div className="px-4 md:px-8 py-3 space-y-3 md:space-y-0 md:flex md:items-center md:justify-between">
        
        {/* ===== LOGO ===== */}
        <div className="flex items-center gap-3 justify-center md:justify-start">
          <img
            src={logo}
            alt="Kurax Logo"
            className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover"
          />
          <div className="text-center md:text-left">
            <h1 className="text-sm md:text-lg font-semibold text-black dark:text-white leading-tight">
              KURAX FOOD LOUNGE & BISTRO
            </h1>
            <p className="text-[11px] md:text-sm text-yellow-500 leading-tight">
              Luxury dining & rooftop vibes
            </p>
          </div>
        </div>

        {/* ===== SEARCH + ACTIONS ===== */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          
          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="w-full rounded-full bg-gray-100 dark:bg-zinc-800 text-black dark:text-white px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <button className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-yellow-500 flex items-center justify-center">
              <Search size={14} className="text-black" />
            </button>
          </div>

          {/* Cart */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative w-9 h-9 md:w-10 md:h-10 rounded-full bg-yellow-500 flex items-center justify-center"
            aria-label="Open cart"
          >
            <ShoppingCart size={16} className="text-black" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-1">
                {cart.length}
              </span>
            )}
          </button>

          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}