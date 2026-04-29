import { motion } from "framer-motion";
import {
  Utensils,
  Sofa,
  Music,
  PackageCheck,
  Sparkles
} from "lucide-react";

export default function Services() {
  const services = [
    {
      title: "Food & Beverages",
      description:
        "Premium dine-in meals, curated drinks, and gourmet takeaways prepared by our expert culinary team.",
      icon: Utensils,
    },
    {
      title: "Lounge Experience",
      description:
        "Relaxed rooftop dining with sophisticated ambience and high-speed Wi-Fi for leisure or business.",
      icon: Sofa,
    },
    {
      title: "Events & Entertainment",
      description:
        "Curated live music, exclusive social events, and private celebrations with unforgettable nightlife vibes.",
      icon: Music,
    },
    {
      title: "Catering & Reservations",
      description:
        "Professional catering for elite functions, group reservations, and dedicated concierge support.",
      icon: PackageCheck,
    },
  ];

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.8, ease: "easeOut" } 
    }
  };

  return (
    <section className="relative w-full py-20 md:py-20 overflow-hidden bg-white dark:bg-[#030303] transition-colors duration-500">
      
      {/* --- 💡 LUXURY BACKGROUND ELEMENTS --- */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-yellow-500/5 dark:bg-yellow-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-yellow-600/5 dark:bg-yellow-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12">
        
        {/* --- SECTION HEADER --- */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-[1px] w-8 bg-yellow-600" />
            <p className="text-yellow-600 dark:text-yellow-500 font-bold tracking-[0.4em] text-xs uppercase flex items-center gap-2">
              <Sparkles size={14} /> Premium Services
            </p>
            <div className="h-[1px] w-8 bg-yellow-600" />
          </div>
          
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
            Savor Every <span className="bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 bg-clip-text text-transparent">
      Moment</span>
          </h2>
          
          <p className="text-zinc-600 dark:text-zinc-900 max-w-2xl mx-auto text-base md:text-lg font-light leading-relaxed">

            Experience exceptional dining, entertainment, and hospitality crafted 
            with precision to provide comfort and culinary excellence.
          </p>
        </motion.div>

        {/* --- SERVICES GRID --- */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {services.map((service, index) => {
            const Icon = service.icon;

            return (
              <motion.div
                key={index}
                variants={cardVariants}
                whileHover={{ y: -12, scale: 1.02 }}
                className="group relative"
              >
                {/* Card Body */}
                <div className="h-full bg-slate-50/50 dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-10 text-center transition-all duration-500 hover:shadow-2xl hover:shadow-yellow-500/10 hover:border-yellow-500/30">
                  
                  {/* Icon Container */}
                  <div className="relative w-20 h-20 mx-auto mb-8">
                    {/* Soft Halo Effect */}
                    <div className="absolute inset-0 bg-yellow-500/20 blur-2xl rounded-full scale-0 group-hover:scale-150 transition-transform duration-700" />
                    
                    <div className="relative w-full h-full bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-zinc-800 dark:to-zinc-900 rounded-2xl flex items-center justify-center shadow-inner group-hover:from-yellow-500 group-hover:to-yellow-700 transition-all duration-500">
                      <Icon className="w-10 h-10 text-yellow-700 dark:text-yellow-500 group-hover:text-white transition-colors duration-500" />
                    </div>
                  </div>

                  <h3 className="text-sm  text-yellow-700 dark:text-white mb-4 uppercase tracking-[0.2em] group-hover:text-yellow-600 dark:group-hover:text-yellow-500 transition-colors">
                    {service.title}
                  </h3>

                  <p className="text-zinc-600 dark:text-zinc-900 max-w-2xl text-base mx-auto md:text-md font-light leading-relaxed">
                    {service.description}
                  </p>

                  {/* Decorative Shimmer Line */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-yellow-600 group-hover:w-1/3 transition-all duration-700" />
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}