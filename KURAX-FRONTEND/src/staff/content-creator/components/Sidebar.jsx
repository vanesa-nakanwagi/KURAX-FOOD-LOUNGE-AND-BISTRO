
import logo from "../../../assets/images/logo.jpeg";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Calendar,
  Settings,
  LogOut,
} from "lucide-react";

export default function Sidebar() {
  const location = useLocation();

  const navItems = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      path: "/content-creator",
    },
    {
      icon: UtensilsCrossed,
      label: "Menus",
      path: "/content-creator/menus",
    },
    {
      icon: Calendar,
      label: "Events",
      path: "/content-creator/events",
    },
    
  ];

  return (
    <div className="w-64 bg-gradient-to-b bg-zinc-900 text-white h-screen p-6 flex flex-col border-r border-slate-800">
      {/* Logo Section */}
      <div className="mb-5 pb-6 border-b border-slate-800">
         {/* Logo */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <img
                    src={logo}
                    alt="Kurax Logo"
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <h1 className="text-lg md:text-xl font-semibold text-white dark:text-white">
                      KURAX FOOD LOUNGE
                    </h1>
                    <h1 className="text-lg md:text-xl font-semibold text-white dark:text-white">
                       & BISTRO
                    </h1>
                    
                  </div>
                </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                isActive
                  ? "bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/20"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="pt-6 border-t border-slate-800">
        <button
          onClick={() => alert("Logout coming soon")}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-colors duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Logout</span>
        </button>
      </div>
    </div>
  );
}
