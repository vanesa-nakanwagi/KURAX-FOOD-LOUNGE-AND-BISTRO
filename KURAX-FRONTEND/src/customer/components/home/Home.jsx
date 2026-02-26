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
      // ✅ FIX: Use environment variable
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
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
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3);
      setDbEvents(recentEvents);
      setLoadingEvents(false);
    } catch (err) {
      console.error("❌ HOME FETCH ERROR:", err);
      setLoadingMenus(false);
      setLoadingEvents(false);
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
}, [heroImages.length]); // ✅ FIX: Add dependency

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
  try {
    const createdDate = new Date(createdAt);
    const now = new Date();
    // ✅ FIX: Check if date is valid
    if (isNaN(createdDate.getTime())) return false;
    const diffInHours = (now - createdDate) / (1000 * 60 * 60);
    return diffInHours <= 48; // Returns true if uploaded in the last 48 hours
  } catch (err) {
    console.error("Date parsing error:", err);
    return false;
  }
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
      A curated selection of our most celebrated flavors, where traditional Ugandan heritage meets modern culinary artistry.
    </p>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
      {loadingMenus ? (
        [...Array(4)].map((_, i) => (
          <div key={i} className="h-80 bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-[2.5rem]" />
        ))
      ) : (
        dbMenus.slice(0, 4).map((item) => {
          // Time-based check (48 hours)
          const createdDate = new Date(item.created_at);
          const now = new Date();
          const isNew = (now - createdDate) / (1000 * 60 * 60) <= 48;

          return (
            /* The parent container with rounded corners and overflow hidden */
            <div key={item.id} className="relative group overflow-hidden rounded-[2.5rem]">
              
              {/* INSIDE BADGE: Sparkling Glass Style */}
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
      className="inline-flex items-center gap-3 px-10 py-4 border-2 border-yellow-400 text-zinc-900 dark:text-white font-medium uppercase tracking-[0.2em] text-[15px] hover:bg-yellow-400 hover:text-black transition-all rounded-none group"
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
              image: getImageSrc(event.image_url),
              description: event.description, 
              date: event.date ? event.date.split('T')[0] : "Date TBD" 
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
      className="inline-flex items-center gap-3 px-8 md:px-10 py-4 border-2 border-yellow-400 text-zinc-900 dark:text-white font-medium uppercase tracking-[0.2em] text-[13px] md:text-[15px] hover:bg-yellow-400 hover:text-black transition-all rounded-none group"
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
    <div className="group font-['Outfit'] relative bg-white dark:bg-[#111111] rounded-[2rem] overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-2 border border-zinc-300 dark:border-zinc-800 hover:border-yellow-500/50 shadow-sm hover:shadow-xl">
      {/* IMAGE CONTAINER */}
      <div className="relative h-48 md:h-56 overflow-hidden bg-zinc-100 dark:bg-[#1a1a1a]">
        {!imgLoaded && (
          <div className="absolute inset-0 bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        )}
        <img
          src={getImageSrc(item.image_url)}
          alt={item.name}
          onLoad={() => setImgLoaded(true)}
          className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${
            imgLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      </div>

      {/* CONTENT SECTION */}
      <div className="p-5 md:p-6 flex-1 flex flex-col gap-3 md:gap-4 text-left">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xl md:text-2xl font-medium text-zinc-900 dark:text-white leading-tight">
            {item.name}
          </h4>
          <div className="text-right shrink-0">
            <span className="text-base md:text-lg text-yellow-600 dark:text-yellow-400 font-bold">
              {Number(item.price).toLocaleString()}
            </span>
            <div className="text-[8px] md:text-[9px] tracking-widest text-zinc-500 uppercase">UGX</div>
          </div>
        </div>

        <p className="text-xs md:text-[13px] text-zinc-800 dark:text-zinc-400 line-clamp-2 leading-relaxed font-light">
          {item.description || "A signature dish prepared fresh at Kurax Food Lounge."}
        </p>

        <button
          onClick={() => onOrder(item)}
          className="mt-2 md:mt-auto w-full py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-yellow-400 text-black text-[10px] md:text-xs font-bold uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all active:scale-95  "
        >
          <Plus size={14} strokeWidth={3} />
          Add to Order
        </button>
      </div>
    </div>
  );
}