import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import diningImage from '../../assets/images/amb.jpg';
import kurax1 from '../../assets/images/kurax1.jpeg';
import kurax2 from '../../assets/images/kurax2.jpeg';
import kurax3 from '../../assets/images/kurax3.jpeg';
import kurax4 from '../../assets/images/kurax4.jpeg';
import { Users, DoorClosed, Briefcase, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const images = [diningImage, kurax1, kurax2, kurax3, kurax4];

const SLIDE_INTERVAL = 4000; // ms per slide

const Reserve = () => {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % images.length);
    }, SLIDE_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const goToReserve = () => navigate("/reservations");

  const features = [
    {
      icon: DoorClosed,
      title: "Private Dining Rooms",
      description: "Exclusive spaces for confidential meetings and intimate gatherings.",
    },
    {
      icon: Users,
      title: "Group Reservations",
      description: "Tailored seating for teams of 8 to 40 guests.",
    },
    {
      icon: Briefcase,
      title: "Corporate Catering",
      description: "Professional catering for conferences and special events.",
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

      {/* Luxury Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-yellow-500/5 dark:bg-yellow-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[20%] left-[-10%] w-96 h-96 bg-yellow-600/5 dark:bg-yellow-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12">
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-center">

          {/* Left Image Carousel Panel */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="relative flex-1 group"
          >
            {/* Sharp Container */}
            <div className="relative aspect-[4/5] rounded-none overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)]">

              {/* Crossfade Image Slider */}
              <AnimatePresence mode="sync">
                <motion.img
                  key={current}
                  src={images[current]}
                  alt={`Dining atmosphere ${current + 1}`}
                  className="absolute inset-0 w-full h-full object-cover rounded-none"
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 1.1, ease: "easeInOut" }}
                />
              </AnimatePresence>

              {/* Cinematic Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80 z-10" />

              {/* Caption */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[85%] z-20">
                <div className="p-6 rounded-none text-center">
                  <p className="text-white text-lg md:text-xl font-serif italic tracking-wide">
                    "Where Business Meets Elegance"
                  </p>
                </div>
              </div>


            </div>
          </motion.div>

          {/* Right Text Panel */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="flex-1 space-y-10"
          >
            <motion.div variants={fadeInUp} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold tracking-[0.4em] text-yellow-600 uppercase flex items-center gap-2">
                  Dining & Reservations
                </span>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-1.5 h-6 md:h-8 bg-yellow-500 rounded-full" />
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif leading-[0.85] tracking-tighter">
                  Executive{" "}
                  <span className="bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 bg-clip-text text-transparent">
                    Private Dining
                  </span>
                </h2>
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto text-md font-light leading-relaxed">
                The ideal setting for professionals seeking a refined atmosphere for high-stakes meetings.
              </p>
            </motion.div>

            {/* Features List */}
            <motion.div variants={fadeInUp} className="space-y-8">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  whileHover={{ x: 10 }}
                  className="flex items-start gap-6 group cursor-default"
                >
                  <div className="flex-shrink-0 w-14 h-14 bg-yellow-50 dark:bg-white/5 border border-yellow-200 dark:border-white/10 rounded-none flex items-center justify-center transition-all duration-500 group-hover:bg-yellow-600 group-hover:border-yellow-600">
                    <feature.icon className="w-6 h-6 text-yellow-700 dark:text-yellow-500 group-hover:text-white transition-colors duration-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-md text-yellow-700 dark:text-white group-hover:text-yellow-600 dark:group-hover:text-yellow-500 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-md font-light leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA Button */}
            <motion.div variants={fadeInUp} className="pt-6">
              <button
                onClick={goToReserve}
                className="relative overflow-hidden group inline-flex items-center gap-3 px-6 md:px-12 py-4 bg-yellow-400 text-black uppercase tracking-[0.2em] text-xs sm:text-sm rounded-none shadow-lg hover:bg-yellow-500 transition-all duration-500"
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