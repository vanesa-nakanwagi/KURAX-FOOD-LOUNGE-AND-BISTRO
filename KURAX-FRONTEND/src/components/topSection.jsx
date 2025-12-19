import { Search, MapPin, Heart, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "../assets/images/logo.jpeg";

export default function TopSection({ searchPlaceholder }) {
  return (
    <div>
      {/* ================= HEADER ================= */}
      <header className="border-b border-yellow-500/20">
        <div className="flex items-center justify-between px-8 py-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src={logo} alt="Kurax Logo" className="w-12 h-12 rounded-full object-cover" />
            <div>
              <h1 className="text-lg font-semibold">KURAX FOOD LOUNGE & BISTRO</h1>
              <p className="text-sm text-yellow-400">
                Luxury dining, signature drinks & rooftop vibes
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 mx-10">
            <div className="relative">
              <input
                type="text"
                placeholder={searchPlaceholder} // <-- dynamic placeholder
                className="w-full rounded-full bg-white text-black px-5 py-2 pr-12 focus:outline-none"
              />
              <button className="absolute right-1 top-1 bottom-1 w-10 rounded-full bg-yellow-500 flex items-center justify-center">
                <Search size={18} className="text-black" />
              </button>
            </div>
          </div>

          {/* Icons */}
          <div className="flex items-center gap-6">
            <MapPin />
            <Heart />
            <div className="relative">
              <ShoppingCart />
              <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs w-5 h-5 flex items-center justify-center rounded-full">
                0
              </span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex justify-center gap-10 py-4 text-sm">
          <Link to="/" className="hover:text-yellow-400">Home</Link>
          <Link to="/menus" className="hover:text-yellow-400">Menus</Link>
          <Link to="/events" className="hover:text-yellow-400">Events</Link>
          <Link to="/reservations" className="hover:text-yellow-400">Reservations</Link>
        </nav>
      </header>
    </div>
  );
}
