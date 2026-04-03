import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import axios from "axios";
import { 
  Plus, Sparkles, ArrowRight, Calendar, 
  UtensilsCrossed, MousePointer2, ChevronDown 
} from "lucide-react";

// Existing Utils & Components
import { getImageSrc } from "../../../utils/imageHelper.js";
import Navbar from "./Navbar.jsx";
import API_URL from "../../../config/api";
import { useCart } from "../context/CartContext.jsx";
import CartModal from "../menu/cart/CartModal.jsx";
import BookingModal from "../events/BookingModal.jsx";
import EventCard from "../events/EventCard.jsx";
import FooterGlobal from "../common/footer.jsx";
import VisitUs from "./visitUs.jsx";
import About from "./about.jsx";
import Reserve from "./reserveHome.jsx";
import Services from "./services.jsx";

// Local Hero Assets
import hero1 from "../../assets/images/hero1.jpg";
import hero12 from "../../assets/images/hero12.jpg";
import hero3 from "../../assets/images/hero13.jpg";
import terrace from "../../assets/images/terrace.jpg";

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
    cart, isCartOpen, setIsCartOpen, activeDish, setActiveDish,
    handleAddToCart, handleRemoveFromCart, handleQuantityChange,
    totalAmount, checkoutStep, setCheckoutStep, customerDetails, setCustomerDetails,
  } = useCart();

  // Scroll Parallax & Opacity Logic
  const { scrollY } = useScroll();
  const yBg = useTransform(scrollY, [0, 800], [0, 250]);
  const opacityHero = useTransform(scrollY, [0, 300], [1, 0]);
  const scaleHero = useTransform(scrollY, [0, 500], [1, 1.1]);

  useEffect(() => {
    const fetchRecentData = async () => {
      try {
        const [menuRes, eventRes] = await Promise.all([
          axios.get(`${API_URL}/api/menus`),
          axios.get(`${API_URL}/api/events`)
        ]);

        setDbMenus(menuRes.data.filter(i => i.status === 'live').slice(0, 4));
        setDbEvents(eventRes.data.filter(e => e.status === 'live').slice(0, 3));
      } catch (err) {
        console.error("❌ FETCH ERROR:", err);
      } finally {
        setLoadingMenus(false);
        setLoadingEvents(false);
      }
    };
    fetchRecentData();

    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % heroImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleOrder = (item) => {
    setActiveDish({ ...item, image: getImageSrc(item.image_url), quantity: 1 });
    setIsCartOpen(true);
  };

  return (
    <main className="bg-black text-white font-['Outfit'] overflow-x-hidden">
      <Navbar />

      {/* --- LUXURY HERO SECTION --- */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        
        {/* Parallax Background Slider */}
        <motion.div style={{ y: yBg, scale: scaleHero }} className="absolute inset-0 z-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
              className="absolute inset-0 bg-center bg-cover"
              style={{ backgroundImage: `url(${heroImages[current]})` }}
            />
          </AnimatePresence>
          
          {/* Deep Cinematic Overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black" />
        </motion.div>

        {/* Dynamic Light Accents (Glows) */}
        <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-yellow-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[5%] right-[0%] w-[400px] h-[400px] bg-yellow-900/15 rounded-full blur-[100px] pointer-events-none" />

        {/* Hero Content Grid */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center w-full">
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-3 mb-6"
            >
              <div className="h-[1px] w-12 bg-yellow-600" />
              
            </motion.div>

            <h1 className="text-6xl md:text-8xl font-serif font-bold leading-[1.1] mb-8">
              Experience <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-700">
                Luxury
              </span> <br />
              Redefined
            </h1>
            
            <p className="text-zinc-400 text-lg md:text-xl max-w-md mb-12 font-light leading-relaxed">
              Indulge in a world where fine dining meets the art of relaxation. Kurax is your ultimate sanctuary for gourmet cuisine.
            </p>
            
            <div className="flex flex-wrap gap-5">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/reservations")}
                className="group relative px-10 py-5 bg-yellow-600 text-black font-bold uppercase tracking-widest overflow-hidden transition-all shadow-[0_0_20px_rgba(202,138,4,0.3)]"
              >
                <span className="relative z-10 flex items-center gap-3">
                  Book A Table <Calendar size={20}/>
                </span>
                <div className="absolute inset-0 bg-white/30 -skew-x-12 -translate-x-full group-hover:translate-x-[200%] transition-transform duration-1000" />
              </motion.button>

              <motion.button 
                whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                onClick={() => navigate("/menus")}
                className="px-10 py-5 border border-zinc-700 backdrop-blur-md text-white font-bold uppercase tracking-widest transition-all"
              >
                Explore Menu
              </motion.button>
            </div>
          </motion.div>

          {/* Right Column: Glassmorphism Showcase */}
          <motion.div 
            initial={{ opacity: 0, x: 50 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ delay: 0.6, duration: 1 }}
            className="hidden lg:block relative"
          >
            <div className="relative z-10 p-8 rounded-[2.5rem] border border-white/10 bg-white/5 backdrop-blur-3xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] group overflow-hidden">
               <div className="flex justify-between items-center mb-6">
                 <div className="p-3 bg-yellow-600/20 rounded-xl">
                    <UtensilsCrossed className="text-yellow-500" size={24} />
                 </div>
                 <span className="text-[10px] text-yellow-500/70 tracking-[0.3em] uppercase font-bold border border-yellow-500/20 px-4 py-1.5 rounded-full">
                   Chef's Recommendation
                 </span>
               </div>

               <div className="overflow-hidden rounded-2xl mb-6">
                 <img 
                    src={hero1} 
                    className="w-full h-72 object-cover grayscale group-hover:grayscale-0 scale-105 group-hover:scale-100 transition-all duration-1000" 
                    alt="Featured Culinary Art" 
                 />
               </div>

               <div className="space-y-2">
                 <h3 className="text-2xl font-serif font-medium">The Signature Platter</h3>
                 <p className="text-zinc-400 text-sm font-light">A curated selection of our finest seasonal flavors, designed for the discerning palate.</p>
               </div>
               
               {/* Internal Card Glow */}
               <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-yellow-600/10 blur-[50px] rounded-full" />
            </div>

            {/* Orbiting Decor */}
            <div className="absolute -top-6 -right-6 w-32 h-32 border-2 border-yellow-600/20 rounded-full animate-[pulse_4s_infinite]" />
            <div className="absolute -bottom-10 -left-10 w-24 h-24 border border-zinc-800 rounded-full" />
          </motion.div>
        </div>

        {/* Animated Scroll Indicator */}
        <motion.div 
          style={{ opacity: opacityHero }} 
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
        >
          <span className="text-[9px] uppercase tracking-[0.5em] text-zinc-500 font-bold">Scroll</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-yellow-600 to-transparent relative overflow-hidden">
            <motion.div 
              animate={{ y: [0, 48, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute top-0 left-0 w-full h-1/3 bg-white"
            />
          </div>
        </motion.div>
      </section>

      {/* --- SIGNATURE DISHES SECTION --- */}
      <section id="menus" className="py-32 px-6 bg-[#030303] relative">
        <div className="max-w-7xl mx-auto">
          <header className="text-center mb-20">
            <span className="text-yellow-600 font-bold tracking-[0.3em] uppercase text-xs mb-4 block">Our Culinary Masterpieces</span>
            <h2 className="text-4xl md:text-6xl font-serif font-bold">Signature Dishes</h2>
          </header>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {loadingMenus ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-[450px] bg-zinc-900/50 rounded-[2.5rem] animate-pulse" />
              ))
            ) : (
              dbMenus.map((item) => (
                <HomeMenuCard key={item.id} item={item} onOrder={handleOrder} />
              ))
            )}
          </div>
        </div>
      </section>

      {/* --- SCHEDULE / EVENTS --- */}
      <section className="py-32 px-6 max-w-7xl mx-auto relative">
        <div className="flex flex-col items-center text-center mb-20">
          <h2 className="text-4xl md:text-6xl font-serif font-bold mb-6">Upcoming Schedule</h2>
          <div className="h-1 w-20 bg-yellow-600 mb-6" />
          <p className="text-zinc-500 max-w-2xl font-light text-lg italic">
            "Where every night tells a different story."
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {loadingEvents ? (
            [1,2,3].map(n => <div key={n} className="h-96 bg-zinc-900/30 rounded-[2.5rem] animate-pulse" />)
          ) : (
            dbEvents.map(event => (
              <EventCard 
                key={event.id}
                event={{...event, image: getImageSrc(event.image_url)}} 
                onBook={() => {
                  setSelectedEventTitle(event.title);
                  setIsModalOpen(true);
                }} 
              />
            ))
          )}
        </div>
      </section>

      {/* --- ADDITIONAL HOME SECTIONS --- */}
      <Reserve />
      <Services />
      <About />
      <VisitUs />
      <FooterGlobal />

      {/* --- MODALS --- */}
      <CartModal 
        isCartOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        activeDish={activeDish} 
        setActiveDish={setActiveDish} 
        cart={cart} 
        handleAddToCart={handleAddToCart} 
        handleRemoveFromCart={handleRemoveFromCart} 
        handleQuantityChange={handleQuantityChange} 
        totalAmount={totalAmount} 
        checkoutStep={checkoutStep} 
        setCheckoutStep={setCheckoutStep} 
        customerDetails={customerDetails} 
        setCustomerDetails={setCustomerDetails} 
      />
      {isModalOpen && (
        <BookingModal 
          show={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          eventTitle={selectedEventTitle} 
        />
      )}
    </main>
  );
}

/**
 * Enhanced Menu Card Component
 */
function HomeMenuCard({ item, onOrder }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -15 }}
      className="group relative bg-[#0a0a0a] rounded-[2.5rem] overflow-hidden border border-white/5 hover:border-yellow-600/40 transition-all duration-500 shadow-2xl"
    >
      <div className="relative h-64 overflow-hidden">
        <img
          src={item.image_url?.startsWith('http') ? item.image_url : `${API_URL}${item.image_url}`}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent opacity-80" />
        
        {/* NEW TAG */}
        <div className="absolute top-5 right-5">
           <div className="bg-yellow-600 text-black text-[9px] font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
             <Sparkles size={10} /> NEW
           </div>
        </div>
      </div>

      <div className="p-8 text-left">
        <div className="flex justify-between items-start gap-4 mb-3">
          <h4 className="text-xl font-medium uppercase tracking-tight leading-tight group-hover:text-yellow-500 transition-colors">
            {item.name}
          </h4>
          <div className="text-right">
            <span className="text-yellow-500 font-bold text-lg">{Number(item.price).toLocaleString()}</span>
            <p className="text-[8px] text-zinc-500 font-bold tracking-widest uppercase">UGX</p>
          </div>
        </div>
        
        <p className="text-xs text-zinc-500 line-clamp-2 mb-8 h-8 font-light leading-relaxed">
          {item.description || "Exquisite flavors prepared with the finest ingredients by our master chefs."}
        </p>

        <button
          onClick={() => onOrder(item)}
          className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 text-black text-[11px] font-bold uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg"
        >
          <Plus size={16} strokeWidth={3} /> Add to Order
        </button>
      </div>
    </motion.div>
  );
}