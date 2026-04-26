import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ArrowRight, Sparkles, MapPin, Music, Martini } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Components
import TopSection from "../common/topSection.jsx";
import EventCard from "../events/EventCard.jsx";
import BookingModal from "../events/BookingModal.jsx";

// Utils & Assets
import { getImageSrc } from "../../../utils/imageHelper.js";
import API_URL from "../../../config/api";

// Static Gallery Assets
import gallery1 from "../../assets/images/hero1.jpg";
import gallery2 from "../../assets/images/hero2.jpg";
import gallery3 from "../../assets/images/hero3.jpg";
import gallery4 from "../../assets/images/hero4.png";
import gallery5 from "../../assets/images/occasion.jpeg"; 
import gallery6 from "../../assets/images/wine.jpg";

export default function Events() {
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [dbEvents, setDbEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const galleryImages = [gallery1, gallery2, gallery3, gallery4, gallery5, gallery6];
  
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % galleryImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [galleryImages.length]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/events/`);
        const processedEvents = response.data
          .filter(event => event.status === 'live' || event.published === true)
          .sort((a, b) => b.id - a.id)
          .map(event => ({
            ...event,
            title: event.name || event.title,
            displayImage: getImageSrc(event.image_url),
            displayDate: event.date ? event.date.split('T')[0] : "Date TBD"
          }));
        setDbEvents(processedEvents);
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // Listen for custom search event
  useEffect(() => {
    const handleGlobalSearch = (event) => {
      const query = event.detail;
      if (query && query.trim()) {
        setSearchQuery(query);
        setIsSearching(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // Clear search when query is empty
        setSearchQuery("");
        setIsSearching(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };

    window.addEventListener('search', handleGlobalSearch);
    return () => window.removeEventListener('search', handleGlobalSearch);
  }, []);

  // Filter events based on search
  useEffect(() => {
    if (dbEvents.length === 0) return;

    let results = [];
    
    if (isSearching && searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      results = dbEvents.filter(event => 
        event.title.toLowerCase().includes(query) ||
        (event.description && event.description.toLowerCase().includes(query)) ||
        (event.location && event.location.toLowerCase().includes(query)) ||
        (event.category && event.category.toLowerCase().includes(query))
      );
    } else {
      results = dbEvents;
    }
    
    setFilteredEvents(results);
  }, [dbEvents, searchQuery, isSearching]);

  const handleBook = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  return (
    <div className="bg-[#FCFCFB] dark:bg-[#050505] text-zinc-900 dark:text-white font-['Outfit'] transition-colors duration-700 selection:bg-yellow-500/30 overflow-x-hidden">
      
      <TopSection searchPlaceholder="Search upcoming experiences..." />

      {/* ── HEADER AREA ── */}
      <section className="relative pt-20 pb-10 px-6 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 lg:gap-8 min-w-0">
          <div className="space-y-8 w-full lg:w-auto min-w-0">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-4"
            >
              <span className="h-[1px] w-12 bg-yellow-500/50" />
              <span className="text-yellow-600 dark:text-yellow-500 text-xs font-black uppercase tracking-[0.3em]">
                Exclusive Experiences
              </span> 
            </motion.div>
            <div className="flex items-start sm:items-center gap-2 md:gap-3 min-w-0">
              <div className="w-1.5 h-6 md:h-8 bg-yellow-500 rounded-full" />
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-5xl font-serif leading-[0.95] tracking-tighter min-w-0">
                Upcoming{" "}
                <span className="bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 bg-clip-text text-transparent">
                  At Kurax
                </span>
              </h1>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full lg:w-auto flex flex-wrap justify-between items-center gap-4 sm:gap-8 border-t lg:border-t-0 lg:border-l border-white/10 pt-6 lg:pt-4 lg:pl-16"
          >
            {[
              { icon: <Music size={20}/>, label: "Live Music" },
              { icon: <Martini size={20}/>, label: "Curated Mixology" },
              { icon: <MapPin size={20}/>, label: "Rooftop Views" }
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center lg:items-start gap-2 group cursor-default min-w-[120px]">
                <div className="text-yellow-500/80 group-hover:text-yellow-400 transition-colors duration-300">
                  {item.icon}
                </div>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500 text-center">
                  {item.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── EVENTS GRID ── */}
      <section className="relative pt-0 pb-0 px-6 max-w-7xl mx-auto z-10">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-[500px] bg-zinc-100 dark:bg-zinc-900/50 rounded-[2rem] animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Search Results Banner - REMOVED */}

            <motion.div 
              initial="hidden"
              whileInView="visible"
            viewport={{ once: true }}
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-12 gap-x-10"
          >
            {filteredEvents.length > 0 ? (
              filteredEvents.map((event) => (
                <motion.div 
                  key={event.id}
                  variants={{
                    hidden: { opacity: 0, y: 40 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
                  }}
                  className="" 
                >
                  <EventCard event={event} onBook={() => handleBook(event)} />
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-40 text-center border border-dashed border-zinc-200 dark:border-white/10 rounded-[3rem] bg-zinc-50 dark:bg-zinc-900/20">
                <p className="text-[11px] font-black uppercase tracking-[0.5em] text-zinc-400">The stage is being set. Check back soon.</p>
              </div>
            )}
          </motion.div>
          </>
        )}
      </section>

      {/* ── AMBIANCE SECTION ── */}
      <section className="relative pt-10 pb-32 px-6 max-w-7xl mx-auto overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
          <div className="w-full lg:w-3/5 relative h-[320px] md:h-[500px] lg:h-[650px] group shadow-[0_0_50px_rgba(0,0,0,0.3)] overflow-hidden rounded-none">
            <div className="absolute top-8 left-8 z-30 mix-blend-difference overflow-hidden" />

            <AnimatePresence mode="wait">
              <motion.img
                key={activeIndex}
                src={galleryImages[activeIndex]}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 1.2, ease: "circOut" }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </AnimatePresence>

            <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black/80 to-transparent flex items-center px-6 sm:px-10 justify-between pointer-events-none">
              <div className="flex gap-3 pointer-events-auto">
                {galleryImages.map((_, i) => (
                  <button 
                    key={i} 
                    onClick={() => setActiveIndex(i)}
                    className={`h-[2px] transition-all duration-700 ${i === activeIndex ? 'w-16 bg-yellow-500' : 'w-6 bg-white/20 hover:bg-white/40'}`} 
                  />
                ))}
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">The Kurax Vibe</span>
            </div>
          </div>

          <div className="w-full lg:w-2/5 relative min-w-0">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-yellow-500/5 blur-[100px] rounded-full" />
            <div className="relative space-y-10">
              <div className="space-y-4">
                <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="flex items-center gap-3">
                  <div className="h-[1px] w-8 bg-yellow-600/40" />
                  <span className="text-yellow-600 text-[13px] font-black uppercase tracking-[0.6em]">Atmosphere</span>
                </motion.div>
                <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif leading-[0.95] tracking-tight">
                  Where <br/>
                   <span
                  style={{
                    background: "linear-gradient(135deg, #f59e0b 0%, #fde68a 45%, #d97706 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                Style
                </span> <br/>
                  Meets the Sky.
                </h2>
              </div>
              <div className="space-y-6">
                <p className="text-zinc-700 dark:text-zinc-400 text-base sm:text-lg font-light leading-relaxed border-l-2 border-yellow-500/10 pl-6">
                  Step into a world where high-energy nightlife effortlessly merges with the art of fine dining. At Kurax, every detail is a curated experience designed for the elite.
                </p>
    
              </div>
            </div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {showModal && (
            <BookingModal 
                show={showModal} 
                onClose={() => setShowModal(false)} 
                eventTitle={selectedEvent?.title} 
            />
        )}
      </AnimatePresence>
    </div>
  );
}