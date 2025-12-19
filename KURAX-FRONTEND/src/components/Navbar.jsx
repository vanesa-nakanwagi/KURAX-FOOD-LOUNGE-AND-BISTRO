import React from "react";
import LogoImage from "../assets/images/logo.jpeg"; // adjust path if needed

// Reusable NavButton component
function NavButton({ children, onClick, href }) {
  return (
    <li>
      {href ? (
        <a
          href={href}
          className="bg-[#C9A24D] text-black px-4 py-2 rounded-full hover:bg-[#a8853a] transition-colors"
        >
          {children}
        </a>
      ) : (
        <button
          onClick={onClick}
          className="bg-[#C9A24D] text-black px-4 py-2 rounded-full hover:bg-[#a8853a] transition-colors"
        >
          {children}
        </button>
      )}
    </li>
  );
}

// Navbar component
export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur border-b border-white/5">
      <div className="max-w-6xl mx-auto flex items-center p-4">
        {/* Logo + text */}
        <div className="flex items-center gap-2">
          <img src={LogoImage} alt="Kurax Logo" className="w-12 h-12 object-cover" />
          <h1 className="font-heading font-bold text-white text-lg">Kurax</h1>
        </div>

        {/* Navigation buttons pushed to the right */}
        <ul className="flex ml-auto space-x-4 text-sm items-center">
          <NavButton href="#SignIn">Sign In</NavButton>
          <NavButton href="#SignUp">Sign Up</NavButton>
          <NavButton href="#contact">Contact Us</NavButton>
        </ul>
      </div>
    </nav>
  );
}
