import { Search, MapPin, Heart, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "../assets/images/logo.jpeg";

export default function TopSection({ searchPlaceholder }) {
  return (
    <header className="border-b border-yellow-500/20">

      {/* ================= TOP BAR ================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 md:px-8 py-4 gap-4">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Kurax Logo"
            className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover"
          />
          <div>
            <h1 className="text-sm md:text-lg font-semibold leading-tight">
              KURAX FOOD LOUNGE & BISTRO
            </h1>
            <p className="text-xs md:text-sm text-yellow-400">
              Luxury dining, signature drinks & rooftop vibes
            </p>
          </div>
        </div>

        {/* Search — hide on mobile */}
        <div className="hidden md:flex flex-1 mx-10">
          <div className="relative w-full">
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="w-full rounded-full bg-white text-black px-5 py-2 pr-12 focus:outline-none"
            />
            <button className="absolute right-1 top-1 bottom-1 w-10 rounded-full bg-yellow-500 flex items-center justify-center">
              <Search size={18} className="text-black" />
            </button>
          </div>
        </div>

        {/* Icons */}
        <div className="flex items-center gap-5 justify-end">
          <MapPin size={20} />
          <Heart size={20} />
          <div className="relative">
            <ShoppingCart size={20} />
            <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs w-4 h-4 flex items-center justify-center rounded-full">
              0
            </span>
          </div>
        </div>
      </div>

      {/* ================= NAV ================= */}
      <nav className="flex justify-center gap-6 md:gap-10 py-3 md:py-4 text-xs md:text-sm">
        <Link to="/" className="hover:text-yellow-400">Home</Link>
        <Link to="/menus" className="hover:text-yellow-400">Menus</Link>
        <Link to="/events" className="hover:text-yellow-400">Events</Link>
        <Link to="/reservations" className="hover:text-yellow-400">Reservations</Link>
      </nav>

    </header>
  );
}
