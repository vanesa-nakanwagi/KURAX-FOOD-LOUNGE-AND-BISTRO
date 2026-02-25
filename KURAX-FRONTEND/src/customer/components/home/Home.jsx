import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { getImageSrc } from "../../../utils/imageHelper.js";
import Navbar from "./Navbar.jsx";
import { Calendar, Clock, MapPin, Plus, Sparkles, Tag } from "lucide-react";

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
        // Fetch Menus
        const menuRes = await axios.get("http://localhost:5000/api/menus");
        const recentMenus = menuRes.data
          .filter(item => item.status === 'live')
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 4);
        setDbMenus(recentMenus);
        setLoadingMenus(false);

        // Fetch Events
        const eventRes = await axios.get("http://localhost:5000/api/events");
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
            <button onClick={() => navigate("/menus")} className="px-8 py-3 border-2 border-yellow-600 text-yellow-500 font-bold hover:bg-yellow-600 hover:text-black transition uppercase tracking-widest">Our Menu</button>
            <button onClick={() => navigate("/reservations")} className="px-8 py-3 bg-yellow-600 text-black font-bold hover:bg-yellow-500 transition uppercase tracking-widest">Reserve Table</button>
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
          <div key={i} className="h-80 bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-[2rem]" />
        ))
      ) : (
        dbMenus.map((item) => (
          <HomeMenuCard 
            key={item.id} 
            item={item} 
            onOrder={handleOrder} 
          />
        ))
      )}
    </div>

    <div className="mt-16">
      <Link 
        to="/menus" 
        className="inline-block px-10 py-4 border-2 border-yellow-400 text-zinc-900 dark:text-white font-bold uppercase tracking-widest hover:bg-yellow-400 hover:text-black transition-all rounded-none"
      >
        Explore Menu
      </Link>
    </div>
  </div>
</section>

     {/* FEATURED EVENTS (RECENT 3) */}
<section id="events" className="py-24 px-4 sm:px-8 bg-zinc-50 dark:bg-[#0c0c0c]">
  <div className="max-w-7xl mx-auto text-center">
    <p className="text-yellow-700 uppercase tracking-[0.3em] font-bold text-xs mb-3">
      Upcoming Experiences
    </p>
    
    <h2 className="text-4xl md:text-5xl font-medium mb-4 text-zinc-900 dark:text-white">
      Featured Events
    </h2>

    <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-12 text-sm md:text-base leading-relaxed">
      From vibrant rooftop afrobeats to cozy live acoustic sessions, discover the pulse of Kurax nightlife and culture.
    </p>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {loadingEvents ? (
        [...Array(3)].map((_, i) => (
          <div key={i} className="h-96 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-[2rem]" />
        ))
      ) : (
        dbEvents.map((event) => (
          <div 
            key={event.id} 
            className="group font-['Outfit'] relative bg-white dark:bg-[#111111] rounded-[2.5rem] overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-2 border border-zinc-200 dark:border-zinc-800 hover:border-yellow-500/50 shadow-sm hover:shadow-2xl"
          >
            {/* Image Container */}
            <div className="h-64 relative overflow-hidden bg-zinc-100 dark:bg-zinc-800">
              <img 
                src={getImageSrc(event.image_url)} 
                alt={event.name} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>

            {/* Content Section */}
            <div className="p-8 text-left flex-1 flex flex-col">
              <h3 className="text-2xl font-semibold mb-3 text-zinc-900 dark:text-white">
                {event.name || event.title}
              </h3>
              
              {/* FIXED DESCRIPTION LOGIC */}
              <p className="text-zinc-600 dark:text-zinc-400 text-[13px] mb-6 line-clamp-3 leading-relaxed font-light">
                {event.description || event.event_description || "Join us for an exclusive experience at Kurax Food Lounge & Bistro."}
              </p>

              {/* Event Details */}
              <div className="space-y-3 mb-8 py-4 border-y border-zinc-200 dark:border-zinc-800/50 text-sm text-zinc-700 dark:text-zinc-300">
                <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-yellow-600 dark:text-yellow-400" strokeWidth={2}/> 
                  <span className="font-medium">{event.date}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-yellow-600 dark:text-yellow-400" strokeWidth={2}/> 
                  <span className="font-medium">{event.time}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin size={16} className="text-yellow-600 dark:text-yellow-400" strokeWidth={2}/> 
                  <span className="font-medium">{event.location}</span>
                </div>
              </div>

              {/* CTA BUTTON */}
              <div className="mt-auto">
                <button
                  onClick={() => openBooking(event.name || event.title)}
                  className="w-full py-4 bg-yellow-400 text-black rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95  hover:text-yellow-400"
                >
                  <Plus size={14} strokeWidth={3} />
                  Book Now
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>

    {/* View All Button */}
    <div className="mt-16">
      <Link 
        to="/events" 
        className="inline-block px-10 py-4 border-2 border-yellow-400 text-zinc-900 dark:text-white font-bold uppercase tracking-widest hover:bg-yellow-400 hover:text-black transition-all rounded-none"
      >
        Explore Events
      </Link>
    </div>
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