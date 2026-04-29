import { Bell, Search, ChevronDown } from "lucide-react";

export default function TopBar({ staffName = "Content Manager" }) {
  return (
    <div className="h-20 bg-white font-[Outfit] border-b border-gray-200 px-4 lg:px-10 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Left section - could add welcome or branding */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-6 bg-yellow-500 rounded-full" />
        <span className="text-sm font-black uppercase tracking-wider text-gray-700">
          Dashboard
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center justify-end gap-4 lg:gap-6">
        {/* Search Bar */}
        <div className="hidden lg:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 hover:border-yellow-300 transition-colors focus-within:border-yellow-400 focus-within:ring-1 focus-within:ring-yellow-400/30">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search menus, events..."
            className="bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400 w-64"
          />
        </div>

        {/* Notification bell (optional) */}
        <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-yellow-600 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-500 rounded-full"></span>
        </button>

        {/* Staff profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center text-white text-sm font-black shadow-sm">
            {staffName.charAt(0).toUpperCase()}
          </div>
          <span className="hidden md:inline-block text-sm font-semibold text-gray-700">
            {staffName}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </div>
      </div>
    </div>
  );
}