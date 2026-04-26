import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Clock, Phone, Mail, Sparkles, ArrowUpRight } from 'lucide-react';

// --- Sharp Info Card Component ---
const InfoCard = ({ icon: Icon, title, content, delay }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ y: -5 }}
      className="group relative p-6 bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-none shadow-sm hover:shadow-xl transition-all duration-500"
    >
      <div className="flex items-start gap-5">
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-none bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 group-hover:bg-yellow-600 group-hover:text-white transition-all duration-500">
          <Icon size={24} strokeWidth={1.5} />
        </div>
        
        <div className="flex flex-col">
          <h3 className="text-md font-medium  uppercase text-yellow-700 dark:text-yellow-500 mb-2">
            {title}
          </h3>
          <div className="text-zinc-500 dark:text-zinc-900 max-w-2xl mx-auto text-[16px] font-light">
            {content}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function ContactPage() {
  const kuraxLocation = {
    address: 'Kyanja-Kisasi Rd, Opposite Pentagon',
    city: 'Kampala, Uganda',
    hours: 'Monday - Sunday: 8:00 AM - 1:00 AM',
    contact: {
      phone: '+256 700 123 456',
      email: 'hello@kurax.ug',
    },
    proximity: [
      '5 mins from Kyanja Market',
      '2 mins from Pentagon',
      '10 mins from Ntinda Town',
    ],
  };

  // --- UPDATED MAP URL ---
  const mapEmbedUrl = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3989.7245659521773!2d32.58999677379755!3d0.3927875639068974!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x177db1ab7be5202b%3A0x55dcbff7cac98cf9!2sKurax%20Foods!5e0!3m2!1sen!2sug!4v1768804364287!5m2!1sen!2sug";

  return (
    <section className="relative bg-stone-50 dark:bg-[#030303] min-h-screen py-24 px-6 transition-colors duration-500 font-['Outfit'] overflow-hidden">
      
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[10%] left-[-5%] w-[40%] h-[40%] bg-yellow-500/5 dark:bg-yellow-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-yellow-600/5 dark:bg-yellow-600/10 blur-[100px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-[1px] w-8 bg-yellow-600" />
            <p className="text-yellow-600 dark:text-yellow-500 font-bold tracking-[0.4em] text-xs uppercase flex items-center gap-2">
             Plan a Visit
            </p>
            <div className="h-[1px] w-8 bg-yellow-600" />
          </div>
          
          <h1 className="text-3xl md:text-5xl font-serif font-bold text-slate-900 dark:text-white mb-6">
            Find Us in <span className="bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 bg-clip-text text-transparent">
      Kyanja</span>
          </h1>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          
          {/* --- 🗺️ LEFT: SHARP MAP CONTAINER --- */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative group"
          >
            <div className="absolute -inset-4  rounded-none -z-10 group-hover:border-yellow-600/40 transition-colors duration-700" />
            
            <div className="relative h-[320px] md:h-[500px] lg:h-[650px] rounded-none overflow-hidden shadow-2xl bg-zinc-900">
              <iframe
                src={mapEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0, filter: 'grayscale(0.3) contrast(1.1)' }}
                allowFullScreen=""
                loading="lazy"
                title="Kurax Location Map"
                className="transition-transform duration-[2s] group-hover:scale-105"
              ></iframe>
              
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
              
              <a 
                href={mapEmbedUrl} 
                target="_blank" 
                rel="noreferrer"
                className="absolute bottom-8 right-8 flex items-center gap-3 px-4 py-3 sm:px-6 sm:py-4 bg-yellow-400 text-black font-medium text-[10px] sm:text-xs uppercase tracking-widest rounded-none shadow-xl hover:bg-yellow-500 transition-all"
              >
                Get Directions <ArrowUpRight size={18} />
              </a>
            </div>
          </motion.div>
          
          {/* --- 🧱 RIGHT: INFO CARDS --- */}
          <div className="grid grid-cols-1 gap-6">
            <InfoCard 
              icon={MapPin} 
              title="Location" 
              delay={0.2}
              content={<p className="text-md">{kuraxLocation.address}, <br /> {kuraxLocation.city}</p>}
            />

            <InfoCard 
              icon={Navigation} 
              title="Proximity" 
              delay={0.3}
              content={
                <ul className="space-y-2">
                  {kuraxLocation.proximity.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-none bg-yellow-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              }
            />

            <InfoCard 
              icon={Clock} 
              title="Opening Hours" 
              delay={0.4}
              content={<p className="text-md">{kuraxLocation.hours}</p>}
            />

          
          </div>
        </div>
      </div>
    </section>
  );
}