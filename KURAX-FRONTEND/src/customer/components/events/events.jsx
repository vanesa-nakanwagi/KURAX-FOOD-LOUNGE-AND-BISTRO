import { useState, useEffect } from "react";
import axios from "axios";
import { ArrowRight } from "lucide-react";

// Components
import TopSection from "../common/topSection.jsx";
import EventCard from "../events/EventCard.jsx";
import BookingModal from "../events/BookingModal.jsx";

// Utils & Assets
import { getImageSrc } from "../../../utils/imageHelper.js";
import terrace from "../../assets/images/terrace.jpg";

// Static Gallery Assets
import gallery1 from "../../assets/images/hero1.jpg";
import gallery2 from "../../assets/images/hero2.jpg";
import gallery3 from "../../assets/images/hero3.jpg";
import gallery4 from "../../assets/images/hero4.jpg";
import gallery5 from "../../assets/images/occasion.jpeg"; 
import gallery6 from "../../assets/images/wine.jpg";
import API_URL from "../../../config/api";

export default function Events() {
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [dbEvents, setDbEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Carousel Logic State
  const [activeIndex, setActiveIndex] = useState(0);
  const galleryImages = [gallery1, gallery2, gallery3, gallery4, gallery5, gallery6];

  // Auto-playing Gallery Logic
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % galleryImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [galleryImages.length]);

  // Data Fetching Logic
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/events/`);
        
        // 1. FILTER: Logic handles missing 'status' column by checking 'published'
        // 2. SORT: ID descending ensures newest events appear first
        // 3. MAP: Standardizes the data so the EventCard doesn't have to "guess"
        const processedEvents = response.data
          .filter(event => {
            if (event.status) return event.status === 'live';
            return event.published === true; 
          })
          .sort((a, b) => b.id - a.id)
          .map(event => ({
            ...event,
            title: event.name || event.title, // Maps DB 'name' to UI 'title'
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

  const handleBook = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  return (
    <div className="bg-[#FAFAF9] dark:bg-[#050505] text-zinc-900 dark:text-white font-['Outfit'] transition-colors duration-500 overflow-x-hidden">
      
      <TopSection searchPlaceholder="Search upcoming experiences..." />

      {/* ── HERO SECTION ── */}
      <section className="relative h-[65vh] min-h-[500px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 bg-zinc-900">
          <img 
            src={terrace} 
            alt="Kurax Terrace" 
            className="w-full h-full object-cover scale-105 opacity-60 dark:opacity-40 animate-pulse-slow" 
          />
          <div className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-[1px]" />
        </div>
        <div className="relative z-10 text-center max-w-5xl mx-auto px-6 space-y-6">
          <h1 className="font-serif text-5xl md:text-8xl font-light text-white leading-none tracking-tighter">
            Unforgettable <br />
            <span className="text-yellow-400 opacity-90 text-4xl md:text-7xl">Experiences</span>
          </h1>
        </div>
      </section>

      {/* ── UPCOMING EVENTS GRID ── */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <header className="mb-16 flex flex-col items-center text-center">
          <h2 className="text-4xl md:text-5xl font-serif font-medium tracking-tight mb-4 text-zinc-900 dark:text-white">
            Kurax Events
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl text-base md:text-lg font-light leading-relaxed">
            From soul-stirring live bands and high-stakes quiz nights to exclusive rooftop gatherings, discover your next unforgettable moment at Kurax.
          </p>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-[450px] bg-zinc-100 dark:bg-zinc-900 rounded-[2.5rem] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {dbEvents.length > 0 ? (
              dbEvents.map((event) => (
                <div key={event.id} className="relative group">
                  {/* Tag Overlays */}
                  <div className="absolute top-6 left-6 z-10 flex flex-col items-start gap-2 pointer-events-none">
                    {event.tags && Array.isArray(event.tags) && event.tags.map((tag, idx) => (
                      <div 
                        key={idx} 
                        className="bg-black/80 dark:bg-black/90 backdrop-blur-md px-4 py-1.5 rounded-r-full rounded-l-[4px] shadow-xl border-l-4 border-yellow-500 transition-all duration-300 group-hover:translate-x-1"
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white">
                          {tag}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  {/* The actual Card component */}
                  <EventCard 
                    event={event} 
                    onBook={() => handleBook(event)} 
                  />
                </div>
              ))
            ) : (
              <div className="col-span-full py-20 text-center">
                <p className="text-xs font-black uppercase tracking-[0.3em] opacity-40">
                  No Live Events Scheduled
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── THE AMBIANCE SECTION (Gallery) ── */}
      <section className="relative w-full min-h-[600px] flex flex-col md:flex-row border-y border-zinc-200 dark:border-zinc-800 bg-black overflow-hidden">
        <div className="w-full md:w-1/2 relative h-[450px] md:h-auto overflow-hidden bg-black">
          {galleryImages.map((img, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-all duration-[1500ms] ease-in-out ${
                index === activeIndex ? "opacity-100 scale-100" : "opacity-0 scale-110"
              }`}
            >
              <img src={img} className="w-full h-full object-cover" alt="Kurax Vibe" />
              <div className="absolute inset-0 bg-black/40" />
            </div>
          ))}
          
          <div className="absolute bottom-10 left-10 z-20 flex gap-2">
            {galleryImages.map((_, i) => (
              <div key={i} className="h-1 w-8 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-yellow-500 transition-all duration-[4000ms] ease-linear ${i === activeIndex ? 'w-full' : 'w-0'}`} 
                />
              </div>
            ))}
          </div>
        </div>

        <div className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-20 bg-[#FAFAF9] dark:bg-[#0A0A0A]">
          <div className="relative z-10 space-y-8 max-w-lg">
            <div className="flex items-center gap-4">
               <div className="w-10 h-[2px] bg-yellow-600" />
               <span className="text-yellow-600 text-xs font-black uppercase tracking-[0.4em]">CURATED CULTURE</span>
               <ArrowRight className="w-4 h-4 text-yellow-600" />
            </div>
            <h2 className="text-4xl md:text-6xl font-serif text-zinc-900 dark:text-white leading-tight">
              The <span className="italic text-yellow-600 dark:text-yellow-500">Kurax Gallery</span>
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-base md:text-lg font-light leading-relaxed">
              Kurax is the heartbeat of the community. From the electric energy of live bands to intimate rooftop gatherings, we don’t just host events—we curate moments.
            </p>
          </div>
        </div>
      </section>

      {/* Booking Modal */}
      {showModal && (
        <BookingModal 
          show={showModal} 
          onClose={() => setShowModal(false)} 
          eventTitle={selectedEvent?.title} 
        />
      )}
      
      <div className="h-24 bg-[#FAFAF9] dark:bg-black" />
    </div>
  );
}