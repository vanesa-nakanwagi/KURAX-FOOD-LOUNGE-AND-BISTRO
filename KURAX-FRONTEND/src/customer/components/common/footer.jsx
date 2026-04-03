import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom'; // Added for navigation
import { 
  Instagram, 
  Twitter, 
  Facebook, 
  MessageCircle, 
  ArrowUpRight, 
  Mail, 
  ChevronRight,
  Sparkles
} from 'lucide-react';

// Import your assets
import logo from "../../assets/images/logo.jpeg";
import airtelLogo from "../../assets/images/airtell.jpeg";
import mtnLogo from "../../assets/images/mtn.jpeg";
import visaLogo from "../../assets/images/visa.jpeg";

const SocialIcon = ({ icon: Icon, link }) => (
  <motion.a
    href={link}
    target="_blank"
    rel="noopener noreferrer"
    whileHover={{ y: -4, backgroundColor: 'rgba(202, 138, 4, 0.1)' }}
    className="w-11 h-11 flex items-center justify-center border border-white/10 text-white/50 hover:text-yellow-500 hover:border-yellow-600/50 transition-all duration-500 rounded-none bg-white/5 backdrop-blur-sm"
  >
    <Icon size={20} strokeWidth={1.5} />
  </motion.a>
);

export default function FooterGlobal() {
  const navigate = useNavigate(); // Hook for hidden portal navigation

  const quickLinks = [
    { label: 'Home', href: '/#hero' },
    { label: 'Menu', href: '/#menus' },
    { label: 'About', href: '/#about' },
    { label: 'Location', href: '/#visit' },
    { label: 'Bookings', href: '/#events' },
  ];

  const paymentMethods = [
    { label: 'Airtel', img: airtelLogo },
    { label: 'MTN', img: mtnLogo },
    { label: 'VISA', img: visaLogo },
  ];

  return (
    <footer className="relative bg-[#030303] text-white pt-24 pb-12 px-6 sm:px-12 lg:px-24 overflow-hidden font-['Outfit']">
      
      {/* Background Glow Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-yellow-600/5 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-yellow-900/10 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 lg:gap-12 pb-20">
          
          {/* 1. BRAND IDENTITY */}
          <div className="lg:col-span-1 space-y-8">
            <motion.div whileHover={{ scale: 1.02 }} className="flex items-center gap-4 group">
              <div className="relative">
                <img src={logo} alt="Kurax" className="w-16 h-16 object-cover border border-white/10" />
                <div className="absolute -inset-1 border border-yellow-600/20 scale-110 group-hover:scale-100 transition-transform duration-700" />
              </div>
              <div className="leading-tight">
                <h2 className="text-xl font-serif font-black tracking-tighter uppercase">Kurax Food Lounge</h2>
                <p className="text-[9px] tracking-[0.5em] text-yellow-600 font-bold">& BISTRO</p>
              </div>
            </motion.div>
            <p className="text-zinc-400 font-light leading-relaxed text-sm max-w-xs">
              A sanctuary of refined taste. From our rooftop ambiance to our signature mixology, we redefine the Kyanja dining experience.
            </p>
          </div>

          {/* 2. NAVIGATION */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-yellow-600 mb-8 flex items-center gap-2">
              <span className="w-4 h-[1px] bg-yellow-600" /> Navigation
            </h3>
            <ul className="space-y-4">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="group relative inline-block text-sm text-zinc-500 hover:text-white transition-colors duration-500">
                    <span className="relative z-10 flex items-center gap-2">
                      {link.label} 
                      <ChevronRight size={12} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-yellow-600" />
                    </span>
                    <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-yellow-600/50 transition-all duration-500 group-hover:w-full" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. CONNECT */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-yellow-600 mb-8 flex items-center gap-2">
              <span className="w-4 h-[1px] bg-yellow-600" /> Connect
            </h3>
            <div className="space-y-6">
              <div className="flex gap-2">
                <SocialIcon icon={Instagram} link="https://instagram.com/kurax" />
                <SocialIcon icon={Twitter} link="https://x.com/kurax" />
                <SocialIcon icon={Facebook} link="https://facebook.com/kurax" />
                <SocialIcon icon={MessageCircle} link="#" />
              </div>
              <div className="space-y-4 pt-4">
                <a href="mailto:hello@kurax.ug" className="flex items-center gap-4 text-sm text-zinc-400 hover:text-yellow-500 transition-all group">
                  <div className="w-8 h-8 bg-white/5 flex items-center justify-center group-hover:bg-yellow-600 group-hover:text-black transition-all">
                    <Mail size={14} />
                  </div>
                  hello@kurax.ug
                </a>
              </div>
            </div>
          </div>

          {/* 4. VIBRANT PAYMENT METHODS */}
          <div className="space-y-10">
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-yellow-600 mb-6 italic">Secure Payment</h3>
              <div className="flex gap-4">
                {paymentMethods.map((method) => (
                  <motion.div 
                    key={method.label}
                    whileHover={{ scale: 1.05, borderColor: 'rgba(255, 255, 255, 0.2)' }}
                    className="w-14 h-10 bg-white shadow-lg border border-white/5 flex items-center justify-center p-1.5 rounded-none overflow-hidden"
                  >
                    <img 
                      src={method.img} 
                      alt={method.label} 
                      className="w-full h-full object-contain" 
                    />
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <p className="text-[10px] tracking-[0.2em] text-zinc-500 uppercase mb-4">Newsletter</p>
              <div className="flex border-b border-white/20 pb-2 focus-within:border-yellow-600 transition-all">
                <input 
                  type="email" 
                  placeholder="Your Email" 
                  className="bg-transparent border-none outline-none text-xs w-full font-light tracking-widest placeholder:text-zinc-700"
                />
                <button className="text-yellow-600 hover:text-white transition-colors">
                  <ArrowUpRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM BAR - CENTERED & HIDDEN PORTAL LINK */}
        <div className="pt-12 border-t border-white/5 flex justify-center items-center text-center">
          <button 
            onClick={() => navigate('/staff/login')}
            className="text-[10px] tracking-[0.3em] text-zinc-600 uppercase hover:text-yellow-600/50 transition-all duration-700 cursor-default"
          >
            © 2026 Kurax Food Lounge & Bistro.
          </button>
        </div>
      </div>
    </footer>
  );
}