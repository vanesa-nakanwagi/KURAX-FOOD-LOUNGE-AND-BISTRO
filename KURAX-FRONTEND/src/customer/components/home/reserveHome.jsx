import React from 'react';
import { motion } from "framer-motion";
import diningImage from '../../assets/images/dining.jpg'; 
import { Users, DoorClosed, Briefcase, ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Reserve = () => {
  const navigate = useNavigate();
  
  const goToReserve = () => {
    navigate("/reservations"); 
  };

  const features = [
    {
      icon: DoorClosed,
      title: "Private Dining Rooms",
      description: "Exclusive spaces for confidential business meetings and intimate corporate gatherings",
    },
    {
      icon: Users,
      title: "Group Reservations",
      description: "Accommodate teams from 8 to 40 guests with customized seating and curated menus",
    },
    {
      icon: Briefcase,
      title: "Corporate Catering",
      description: "Professional catering solutions for conferences, launches, and special corporate events",
    },
  ];

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  return (
    <section className="relative w-full py-20 md:py-20 overflow-hidden bg-white dark:bg-[#030303] transition-colors duration-500 font-['Outfit']">
      
      {/* --- 💡 LUXURY BACKGROUND GLOW --- */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-yellow-500/5 dark:bg-yellow-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[20%] left-[-10%] w-96 h-96 bg-yellow-600/5 dark:bg-yellow-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12">
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-center">
          
          {/* --- 🖼️ LEFT IMAGE PANEL (SHARP EDGES) --- */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="relative flex-1 group"
          >
            {/* Sharp Decorative Gold Frame */}
            <div className="absolute -inset-3 border border-yellow-600/20 rounded-none -z-10 group-hover:border-yellow-600/40 transition-colors duration-700" />
            
            {/* Sharp Container */}
            <div className="relative aspect-[4/5] rounded-none overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)]">
              <motion.img
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 1.5 }}
                src={diningImage}
                alt="Elegant corporate dining room"
                className="w-full h-full object-cover rounded-none"
              />
              
              {/* Cinematic Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />

              {/* Glassmorphism Caption (Sharp) */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[85%]">
                <div className=" p-6 rounded-none text-center shadow-2xl">
                  <p className="text-white text-lg md:text-xl font-serif italic tracking-wide">
                    "Where Business Meets Elegance"
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* --- 📝 RIGHT TEXT PANEL --- */}
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="flex-1 space-y-10"
          >
            <motion.div variants={fadeInUp} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-[1px] w-8 bg-yellow-600" />
                <span className="text-sm font-bold tracking-[0.4em] text-yellow-600 uppercase flex items-center gap-2">
                   Dining & Reservations
                </span>
              </div>
              <h2 className="text-4xl md:text-6xl font-serif font-bold leading-[1.1] text-slate-900 dark:text-white">
                Executive <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-800">
                  Private Dining
                </span>
              </h2>
              <p className="text-zinc-500 dark:text-zinc-900 max-w-2xl mx-auto text-lg font-light leading-relaxed">
                Kurax provides the ideal setting for business professionals seeking a 
                refined atmosphere for high-stakes meetings and elite celebrations.
              </p>
            </motion.div>

            {/* --- FEATURES LIST --- */}
            <motion.div variants={fadeInUp} className="space-y-8">
              {features.map((feature, index) => (
                <motion.div 
                  key={index}
                  whileHover={{ x: 10 }}
                  className="flex items-start gap-6 group cursor-default"
                >
                  {/* Sharp Icon Container */}
                  <div className="flex-shrink-0 w-14 h-14 bg-yellow-50 dark:bg-white/5 border border-yellow-200 dark:border-white/10 rounded-none flex items-center justify-center transition-all duration-500 group-hover:bg-yellow-600 group-hover:border-yellow-600">
                    <feature.icon className="w-6 h-6 text-yellow-700 dark:text-yellow-500 group-hover:text-white transition-colors duration-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-yellow-700 dark:text-white group-hover:text-yellow-600 dark:group-hover:text-yellow-500 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-zinc-500 dark:text-zinc-900 max-w-2xl mx-auto text-md font-light leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* --- LUXURY CTA BUTTON --- */}
            <motion.div variants={fadeInUp} className="pt-6">
              <button 
                onClick={goToReserve} 
                className="relative overflow-hidden group inline-flex items-center gap-4 px-12 py-5 bg-yellow-400 text-black font-black uppercase tracking-[0.2em] text-xs rounded-none shadow-lg hover:bg-yellow-500 transition-all duration-500"
              >
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                RESERVE A TABLE
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-2" />
              </button>
            </motion.div>
          </motion.div>
          
        </div>
      </div>
    </section>
  );
};

export default Reserve;