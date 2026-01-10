import { Search, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "../assets/images/logo.jpeg";

export default function TopSection({ searchPlaceholder }) {
  return (
    <header className="border-b border-yellow-500/20 sticky top-0 z-50 bg-black">
      <div className="flex flex-col md:flex-row items-center md:justify-between px-4 md:px-8 py-4 gap-4 md:gap-0">
        {/* Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <img src={logo} alt="Kurax Logo" className="w-12 h-12 rounded-full object-cover" />
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-white">KURAX FOOD LOUNGE & BISTRO</h1>
            <p className="text-sm md:text-base text-yellow-400">
              Luxury dining, signature drinks & rooftop vibes
            </p>
          </div>
        </div>

        <div className="w-full sm:w-3/4 md:w-1/3 flex items-center gap-2 relative">
  {/* Search Input */}
  <div className="flex-1 relative">
    <input
      type="text"
      placeholder={searchPlaceholder}
      className="w-full rounded-full bg-white text-black px-5 py-2 pr-12 focus:outline-none"
    />
    {/* Search Button */}
    <button className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center">
      <Search size={15} className="text-black" />
    </button>
  </div>

  {/* Cart Icon outside the search */}
  <button className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center">
    <ShoppingCart size={18} className="text-black" />
  </button>
</div>

      </div>

      {/* Nav */}
      <nav className="flex justify-center gap-6 py-4 text-sm md:text-base text-white">
        <Link to="/" className="hover:text-yellow-400">Home</Link>
        <Link to="/menus" className="hover:text-yellow-400">Menus</Link>
        <Link to="/events" className="hover:text-yellow-400">Events</Link>
        <Link to="/reservations" className="hover:text-yellow-400">Reservations</Link>
      </nav>
    </header>
  );z
}
