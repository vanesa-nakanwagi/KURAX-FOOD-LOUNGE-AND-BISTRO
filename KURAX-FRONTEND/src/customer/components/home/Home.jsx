import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { getImageSrc } from "../../../utils/imageHelper.js";
import Navbar from "./Navbar.jsx";
import { Calendar, Clock, MapPin, Plus, Sparkles, ArrowRight } from "lucide-react";
import EventCard from "../events/EventCard.jsx"

// Local Hero Assets
import hero1 from "../../assets/images/hero1.jpg";
import hero12 from "../../assets/images/hero12.jpg";
import hero3 from "../../assets/images/hero13.jpg";
import terrace from "../../assets/images/terrace.jpg";

// Global Components
import FooterGlobal from "../common/footer.jsx";
import VisitUs from "./visitUs.jsx";
import About from "./about.jsx";
import Reserve from "./reserveHome.jsx";
import Services from "./services.jsx"; 
import { useCart } from "../context/CartContext.jsx";
import CartModal from "../menu/cart/CartModal.jsx";
import BookingModal from "../events/BookingModal.jsx"; 
import API_URL from "../../../config/api";

const heroImages = [hero1, hero12, hero3, terrace];

export default function Home() {
  const [current, setCurrent] = useState(0);
  const [dbMenus, setDbMenus] = useState([]);
  const [dbEvents, setDbEvents] = useState([]);
  const [loadingMenus, setLoadingMenus] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEventTitle, setSelectedEventTitle] = useState("");

  const {
    cart, isCartOpen, setIsCartOpen, checkoutStep, setCheckoutStep,
    activeDish, setActiveDish, handleAddToCart, handleRemoveFromCart,
    handleQuantityChange, totalAmount, customerDetails, setCustomerDetails,
  } = useCart();

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchRecentData = async () => {
      try {
        // Fetch Menus
        const menuRes = await axios.get(`${API_URL}/api/menus`);
        const recentMenus = menuRes.data
          .filter(item => item.status === 'live')
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 4);
        setDbMenus(recentMenus);
        setLoadingMenus(false);

        // Fetch Events
        const eventRes = await axios.get(`${API_URL}/api/events`);
        const recentEvents = eventRes.data
          .filter(event => event.status === 'live')
          .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by upcoming date
          .slice(0, 3);
        setDbEvents(recentEvents);
        setLoadingEvents(false);
      } catch (err) {
        console.error("❌ HOME FETCH ERROR:", err);
      }
    };
    fetchRecentData();
  }, []);

  // --- NAVIGATION & HANDLERS ---
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % heroImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleOrder = (item) => {
    setActiveDish({
      ...item,
      image: getImageSrc(item.image_url),
      quantity: 1,
      instructions: "",
    });
    setIsCartOpen(true);
  };

  const openBooking = (title) => {
    setSelectedEventTitle(title);
    setIsModalOpen(true);
  };

  const isNewItem = (createdAt) => {
  if (!createdAt) return false;
  const createdDate = new Date(createdAt);
  const now = new Date();
  const diffInHours = (now - createdDate) / (1000 * 60 * 60);
  return diffInHours <= 48; // Returns true if uploaded in the last 48 hours
};
  return (
    <section id="hero" className="scroll-mt-32 relative min-h-screen bg-white font-['Outfit']">
      <Navbar />

      {/* HERO SECTION */}
      <div className="relative w-full h-screen overflow-hidden">
        {heroImages.map((img, index) => (
          <div
            key={index}
            className={`absolute inset-0 bg-center bg-cover transition-opacity duration-1000 ${
              index === current ? "opacity-100 animate-zoomOut" : "opacity-0"
            }`}
            style={{ backgroundImage: `url(${img})` }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
          <h1 className="font-bold text-4xl md:text-7xl text-white leading-tight animate-fadeUp">
            Elevated Local
            <span className="block mt-2 text-yellow-600">& Cuisine Reimagined</span>
          </h1>
          <p className="mt-4 text-lg text-white/90 max-w-md animate-fadeUp delay-200">
            Luxury dining, signature drinks & rooftop vibes
          </p>
          <div className="mt-8 flex gap-4">
            <button onClick={() => navigate("/menus")} className="px-8 py-3 border-2 border-yellow-600 text-yellow-500 font-bold hover:bg-yellow-600 hover:text-black transition uppercase tracking-widest">Menu</button>
            <button onClick={() => navigate("/reservations")} className="px-8 py-3 bg-yellow-600 text-black font-bold hover:bg-yellow-500 transition uppercase tracking-widest">Reserve</button>
          </div>
        </div>
      </div>

 {/* SIGNATURE DISHES (RECENT 4) */}
<section id="menus" className="py-24 px-4 sm:px-8 bg-white dark:bg-[#080808]">
  <div className="max-w-7xl mx-auto text-center">
    <p className="text-yellow-700 uppercase tracking-[0.3em] font-bold text-xs mb-3">
      Our Specialties
    </p>
    
    <h2 className="text-4xl md:text-5xl font-medium mb-4 text-zinc-900 dark:text-white">
      Signature Dishes
    </h2>

    <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-12 text-sm md:text-base leading-relaxed">
      A curated selection of our most celebrated flavors...
    </p>

    {/* FIX 1: Added 'pb-8' and 'p-2' to the grid to prevent shadow clipping */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-8 p-2">
      {loadingMenus ? (
        [...Array(4)].map((_, i) => (
          <div key={i} className="h-80 bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-[2.5rem]" />
        ))
      ) : (
        dbMenus.slice(0, 4).map((item) => {
          const createdDate = new Date(item.created_at);
          const now = new Date();
          const isNew = (now - createdDate) / (1000 * 60 * 60) <= 48;

          return (
            /* FIX 2: Removed 'overflow-hidden' from this wrapper to allow shadows to show 
               The rounding should be handled INSIDE HomeMenuCard */
            <div key={item.id} className="relative group h-full">
              
              {isNew && (
                <div className="absolute top-4 right-4 z-30 bg-yellow-500/90 backdrop-blur-md text-black text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 uppercase tracking-tighter border border-white/20">
                  <Sparkles size={12} className="animate-pulse" />
                  NEW
                </div>
              )}

              <HomeMenuCard 
                item={item} 
                onOrder={handleOrder} 
              />
            </div>
          );
        })
      )}
    </div>

  <div className="mt-16 text-center">
    <Link 
      to="/menus" 
      className="inline-flex items-center gap-3 px-8 md:px-10 py-4 border-2 border-yellow-400 text-zinc-900 dark:text-white font-medium uppercase tracking-[0.2em] text-[13px] md:text-[15px] hover:bg-yellow-400  hover:text-white transition-all rounded-none group"
    
    >
      Explore Menu
      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
    </Link>
  </div>
  </div>
</section>
     

   {/* ── UPCOMING EVENTS GRID ── */}
<section className="py-12 md:py-24 px-6 max-w-7xl mx-auto">
  {/* Header: Tightened margins for mobile so the title is visible immediately */}
  <header className="mb-10 md:mb-16 flex flex-col items-center text-center">
    <h2 className="text-3xl md:text-5xl font-serif font-medium tracking-tight mb-4 text-zinc-900 dark:text-white block">
      Upcoming Schedule
    </h2>
    <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl text-sm md:text-lg font-light leading-relaxed">
      From soul-stirring live bands and high-stakes quiz nights to exclusive rooftop gatherings, discover your next unforgettable moment at Kurax.
    </p>
  </header>

  {/* Skeleton Loading State */}
  {loadingEvents ? (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
      {[1, 2, 3].map((n) => (
        <div key={n} className="h-[400px] md:h-[450px] bg-zinc-100 dark:bg-zinc-900 rounded-[2.5rem] animate-pulse" />
      ))}
    </div>
  ) : dbEvents && dbEvents.length > 0 ? (
    /* Actual Content State */
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
      {dbEvents.map((event) => (
        <div key={event.id} className="relative group">
          
          {/* --- PERMANENT DYNAMIC TAGS (STACKED ON IMAGE) --- */}
          <div className="absolute top-6 left-6 z-20 flex flex-col items-start gap-2 pointer-events-none">
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
          
          <EventCard 
  event={{
    ...event,
    image: getImageSrc(event.image_url), // Make sure getImageSrc uses API_URL
    date: event.date 
      ? new Date(event.date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        })
      : "Date TBD"
  }} 
  onBook={() => handleBook(event)} 
/>
        </div>
      ))}
    </div>
  ) : (
    /* Empty State: Shows if the database fetch returns nothing */
    <div className="text-center py-20 border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-[2.5rem]">
      <p className="text-zinc-400 uppercase tracking-[0.2em] text-xs font-medium">
        No events currently scheduled
      </p>
    </div>
  )}

  {/* ── EXPLORE BUTTON ── */}
  <div className="mt-12 md:mt-16 text-center">
    <Link 
      to="/events" 
      className="inline-flex items-center gap-3 px-8 md:px-10 py-4 border-2 border-yellow-400 text-zinc-900 dark:text-black font-medium uppercase tracking-[0.2em] text-[13px] md:text-[15px] hover:bg-yellow-400 hover:text-black transition-all rounded-none group"
    >
      Explore Events
      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
    </Link>
  </div>
</section>

      {/* MODALS & REMAINING SECTIONS */}
      <CartModal isCartOpen={isCartOpen} onClose={() => setIsCartOpen(false)} activeDish={activeDish} setActiveDish={setActiveDish} cart={cart} handleAddToCart={handleAddToCart} handleRemoveFromCart={handleRemoveFromCart} handleQuantityChange={handleQuantityChange} totalAmount={totalAmount} checkoutStep={checkoutStep} setCheckoutStep={setCheckoutStep} customerDetails={customerDetails} setCustomerDetails={setCustomerDetails} />
      {isModalOpen && <BookingModal show={isModalOpen} onClose={() => setIsModalOpen(false)} eventTitle={selectedEventTitle} />}

      <Reserve />
      <Services />
      <About />
      <VisitUs />
      <FooterGlobal />
    </section>
  );
}
function HomeMenuCard({ item, onOrder }) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className="group relative bg-white dark:bg-[#111111] rounded-[2rem] overflow-hidden flex flex-col h-full transition-all duration-500 hover:-translate-y-1 border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-xl">
      
      {/* IMAGE CONTAINER */}
      <div className="relative h-44 md:h-48 overflow-hidden bg-zinc-50 dark:bg-[#1a1a1a] shrink-0">
        {!imgLoaded && (
          <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        )}
        <img
          src={item.image_url?.startsWith('http') ? item.image_url : `${API_URL}${item.image_url}`}
          alt={item.name}
          onLoad={() => setImgLoaded(true)}
          className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${
            imgLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
        {item.is_new && (
           <div className="absolute top-3 right-3 bg-yellow-400 text-[8px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
             ✨ NEW
           </div>
        )}
      </div>

      {/* CONTENT SECTION */}
      <div className="p-4 md:p-5 flex-1 flex flex-col items-start text-left">
        
        {/* TITLE & PRICE ROW - Removed 'font-black' from Name */}
        <div className="w-full flex justify-between items-start gap-2 mb-2 min-h-[2.5rem]">
          <h4 className="text-sm md:text-base font-medium text-zinc-900 dark:text-white leading-tight uppercase tracking-tight flex-1">
            {item.name}
          </h4>
          <div className="text-right shrink-0">
            <span className="text-sm md:text-base text-yellow-500 font-black tracking-tighter">
              {Number(item.price).toLocaleString()}
            </span>
            <div className="text-[7px] font-bold text-zinc-400 uppercase -mt-1">UGX</div>
          </div>
        </div>

        {/* DESCRIPTION - Fixed height for alignment */}
        <p className="text-[11px] md:text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-snug mb-4 font-normal h-8 overflow-hidden">
          {item.description || "Freshly prepared at Kurax Lounge."}
        </p>

        {/* BUTTON - Stays at bottom */}
        <button
          onClick={() => onOrder(item)}
          className="mt-auto w-full py-2.5 rounded-xl bg-[#FFD700] hover:bg-[#FFC800] text-black text-[9px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
        >
          <Plus size={12} strokeWidth={4} />
          Add to Order
        </button>
      </div>
    </div>
  );
}