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

// Static Gallery Assets – using kurax1.jpg through kurax6.jpg
import gallery1 from "../../assets/images/kurax1.jpg";
import gallery2 from "../../assets/images/kurax2.jpg";
import gallery3 from "../../assets/images/kurax3.jpg";
import gallery4 from "../../assets/images/kurax4.jpg";
import gallery5 from "../../assets/images/kurax5.jpg";
import gallery6 from "../../assets/images/kurax6.jpg";

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

  const clearSearch = () => {
    setIsSearching(false);
    setSearchQuery("");
  };

  return (
    <div className="bg-[#FCFCFB] dark:bg-[#050505] text-zinc-900 dark:text-white font-['Outfit'] transition-colors duration-700 selection:bg-yellow-500/30 overflow-x-hidden">
      
      <TopSection searchPlaceholder="Search upcoming experiences..." />

      {/* ── CONSISTENT HEADER WITH MENU PAGE STYLE ── */}
      <header className="max-w-7xl mx-auto px-5 md:px-12 pt-8 pb-4">
        <div className="flex flex-row items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-900 pb-8 min-w-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <div className="w-1.5 h-6 md:h-8 bg-yellow-500 rounded-full flex-shrink-0" />
            <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-5xl font-serif leading-[0.95] tracking-tighter truncate">
              {isSearching ? "Search" : "Upcoming"}{" "}
              <span className="bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 bg-clip-text text-transparent whitespace-nowrap">
                {isSearching ? "Results" : "Events"}
              </span>
            </h2>
          </div>
          <div className="text-right shrink-0">
            <p className="hidden sm:block text-[8px] md:text-[9px] uppercase tracking-widest text-zinc-700 leading-tight">
              {isSearching 
                ? `Matching "${searchQuery}"` 
                : "Live & Upcoming"}
            </p>
            <p className="text-base sm:text-lg md:text-2xl font-semibold leading-none">
              {filteredEvents.length}{" "}
              <span className="text-[8px] sm:text-[10px] font-normal opacity-60">
                {filteredEvents.length === 1 ? "Event" : "Events"}
              </span>
            </p>
          </div>
        </div>
      </header>

      {/* ── EVENTS GRID ── */}
      <section className="relative pt-0 pb-0 px-5 md:px-12 max-w-7xl mx-auto z-10">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-[500px] bg-zinc-100 dark:bg-zinc-900/50 rounded-[2rem] animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {filteredEvents.length === 0 ? (
              <div className="py-40 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-[2.5rem]">
                <p className="italic text-zinc-400 text-[11px] font-black uppercase tracking-[0.5em]">
                  {isSearching 
                    ? `No events found matching "${searchQuery}"`
                    : "The stage is being set. Check back soon."}
                </p>
                {isSearching && (
                  <button
                    onClick={clearSearch}
                    className="mt-6 text-sm text-yellow-600 hover:text-yellow-700 underline font-medium"
                  >
                    Browse all events
                  </button>
                )}
              </div>
            ) : (
              <motion.div 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
              >
                {filteredEvents.map((event) => (
                  <motion.div 
                    key={event.id}
                    variants={{
                      hidden: { opacity: 0, y: 40 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
                    }}
                  >
                    <EventCard event={event} onBook={() => handleBook(event)} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </>
        )}
      </section>

      {/* ── AMBIANCE SECTION (gallery carousel – NO indicator buttons) ── */}
      <section className="relative pt-20 pb-32 px-5 md:px-12 max-w-7xl mx-auto overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
          <div className="w-full lg:w-3/5 relative h-[320px] md:h-[500px] lg:h-[650px] group shadow-[0_0_50px_rgba(0,0,0,0.3)] overflow-hidden rounded-none">
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

            {/* Only the label "The Kurax Vibe" remains – no dot indicators */}
            <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-end px-6 sm:px-10 pointer-events-none">
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