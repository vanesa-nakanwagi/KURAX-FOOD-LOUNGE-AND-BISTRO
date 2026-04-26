import React from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="relative w-12 h-6 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 p-0.5 transition-all duration-300 hover:scale-105 focus:outline-none"
    >
      <div className={`absolute inset-0 rounded-full bg-black/20 transition-opacity duration-300 ${isDark ? 'opacity-0' : 'opacity-100'}`} />
      <div className={`relative w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 flex items-center justify-center ${isDark ? 'translate-x-6' : 'translate-x-0'}`}>
        {isDark ? <Moon size={10} className="text-zinc-800" /> : <Sun size={10} className="text-yellow-500" />}
      </div>
    </button>
  );
}