import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import axios from "axios";
import { 
  Plus, Sparkles, ArrowRight, Star, ChefHat, Calendar 
} from "lucide-react";

// Existing Utils & Components
import { getImageSrc } from "../../../utils/imageHelper.js";
import Navbar from "./Navbar.jsx";
import API_URL from "../../../config/api";
import { useCart } from "../context/CartContext.jsx";
import CartModal from "../menu/cart/CartModal.jsx";
import BookingModal from "../events/BookingModal.jsx";
import EventCard from "../events/EventCard.jsx"; // Ensure this is imported
import FooterGlobal from "../common/footer.jsx";
import VisitUs from "./visitUs.jsx";
import About from "./about.jsx";
import Reserve from "./reserveHome.jsx";
import Services from "./services.jsx";

// Local Hero Assets
import hero1 from "../../assets/images/hero4.png";
import hero12 from "../../assets/images/hero1.jpg";
import hero3 from "../../assets/images/hero135.jpg";
import rice from "../../assets/images/rice.jpg";

const heroImages = [hero1, hero12, hero3, rice];

// Animation Variants
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
};

export default function Home() {
  const [current, setCurrent] = useState(0);
  const [dbMenus, setDbMenus] = useState([]);
  const [dbEvents, setDbEvents] = useState([]); // New State
  const [loadingMenus, setLoadingMenus] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true); // New State
  const [isModalOpen, setIsModalOpen] = useState(false); // Modal Logic
  const [selectedEventTitle, setSelectedEventTitle] = useState("");
  
  const navigate = useNavigate();
  const {
    cart, isCartOpen, setIsCartOpen, activeDish, setActiveDish,
    handleAddToCart, handleRemoveFromCart, handleQuantityChange,
    totalAmount, checkoutStep, setCheckoutStep, customerDetails, setCustomerDetails,
  } = useCart();

  const { scrollY } = useScroll();
  const yContent = useTransform(scrollY, [0, 500], [0, -50]);

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
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleOrder = (item) => {
    setActiveDish({ ...item, image: getImageSrc(item.image_url), quantity: 1 });
    setIsCartOpen(true);
  };

  return (
    <main className="bg-white text-black font-['Outfit'] overflow-x-hidden">
      <Navbar />

      {/* --- 🎯 HERO SECTION --- */}
      <section className="relative h-screen w-full flex items-center bg-black overflow-hidden">
        <div className="absolute inset-0 z-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
              className="absolute inset-0 bg-center bg-cover"
              style={{ backgroundImage: `url(${heroImages[current]})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 w-full pt-24 md:pt-32">
          <motion.div style={{ y: yContent }} className="max-w-2xl space-y-6 md:space-y-8">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
              <h1 className="text-5xl md:text-7xl font-serif font-bold leading-[1.05] text-white">
                Experience <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-800 italic">
                  Luxury
                </span> <br />
                Redefined
              </h1>
            </motion.div>
            
            <p className="text-zinc-300 text-lg md:text-xl font-light max-w-lg leading-relaxed">
              Indulge in a world where fine dining meets the art of relaxation. 
              Kurax is your ultimate sanctuary for gourmet cuisine.
            </p>
            
            <div className="flex flex-wrap gap-5 pt-4">
              <button onClick={() => navigate("/reservations")} className="px-10 py-5 bg-yellow-600 text-black font-black uppercase tracking-widest rounded-sm hover:bg-yellow-500 transition-colors shadow-lg">
                Book a Table
              </button>
              <button onClick={() => navigate("/menus")} className="px-10 py-5 border border-white/40 text-white font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all rounded-sm">
                Explore Menu
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- 🥗 SIGNATURE DISHES SECTION --- */}
      <section id="menus" className="py-24 px-6 bg-white border-b border-zinc-100">
        <motion.div 
          className="max-w-7xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.header variants={fadeInUp} className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div className="space-y-2">
              <span className="text-yellow-600 font-bold uppercase tracking-[0.3em] text-xs">Our Selection</span>
              <h2 className="text-4xl md:text-6xl font-serif font-bold text-zinc-900">Signature Dishes</h2>
            </div>
            <Link to="/menus" className="text-yellow-600 font-bold uppercase tracking-widest text-sm flex items-center gap-2 group">
              View Menu <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
            </Link>
          </motion.header>
          
          <motion.div variants={staggerContainer} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {loadingMenus ? (
              [...Array(4)].map((_, i) => <div key={i} className="h-[400px] bg-zinc-100 rounded-3xl animate-pulse" />)
            ) : (
              dbMenus.map((item) => (
                <HomeMenuCard key={item.id} item={item} onOrder={handleOrder} />
              ))
            )}
          </motion.div>
        </motion.div>
      </section>

      {/* --- 📅 UPCOMING SCHEDULE / EVENTS SECTION --- */}
<section className="py-24 px-6 bg-[#FCFCFB] relative overflow-hidden">
  <motion.div 
    className="max-w-7xl mx-auto relative z-10"
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.2 }}
  >
    
    {/* REFINED HEADER AREA (MIRRORS SIGNATURE DISHES) */}
    <motion.header 
      variants={fadeInUp} 
      className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6"
    >
      <div className="space-y-2">
        <span className="text-yellow-600 font-bold uppercase tracking-[0.3em] text-xs">
          Exclusive Experiences
        </span>
        <h2 className="text-4xl md:text-6xl font-serif font-bold text-zinc-900">
          Upcoming Schedule
        </h2>
      </div>
      
      <Link 
        to="/events" 
        className="text-yellow-600 font-bold uppercase tracking-widest text-sm flex items-center gap-2 group"
      >
        VIew Events 
        <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
      </Link>
    </motion.header>
    
    {/* EVENTS GRID */}
    <motion.div variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
      {loadingEvents ? (
        [1, 2, 3].map(n => (
          <div key={n} className="h-96 bg-zinc-200/50 rounded-[2.5rem] animate-pulse" />
        ))
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
    </motion.div>
  </motion.div>
</section>

      <About />
      <Services />
      <Reserve />
      <VisitUs />
      <FooterGlobal />

      {/* MODALS */}
      <CartModal 
        isCartOpen={isCartOpen} onClose={() => setIsCartOpen(false)} 
        activeDish={activeDish} setActiveDish={setActiveDish} 
        cart={cart} handleAddToCart={handleAddToCart} 
        handleRemoveFromCart={handleRemoveFromCart} handleQuantityChange={handleQuantityChange} 
        totalAmount={totalAmount} checkoutStep={checkoutStep} 
        setCheckoutStep={setCheckoutStep} customerDetails={customerDetails} setCustomerDetails={setCustomerDetails} 
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

function HomeMenuCard({ item, onOrder }) {
  const imageUrl = item.image_url?.startsWith('http') 
    ? item.image_url 
    : `${API_URL}${item.image_url}`;

  return (
    <motion.div 
      variants={fadeInUp}
      whileHover={{ y: -8 }}
      className="group relative bg-white rounded-[2.5rem] overflow-hidden shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] hover:shadow-2xl border border-zinc-100 transition-all duration-500"
    >
      <div className="relative h-56 overflow-hidden">
        <motion.img
          src={imageUrl}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-30" />
        <div className="absolute top-4 left-4">
           <div className="bg-yellow-500 text-black text-[8px] font-black px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 uppercase tracking-widest">
             <Sparkles size={8} /> New
           </div>
        </div>
      </div>
      
      <div className="p-6 space-y-4">
        <div className="space-y-1">
          <h4 className="text-lg font-serif  font-[Outfit] text-zinc-900 uppercase tracking-tight group-hover:text-yellow-600 transition-colors line-clamp-1">
            {item.name}
          </h4>
          <p className="text-zinc-500 text-[11px] font-light leading-relaxed line-clamp-2 italic">
            {item.description || "Indulge in our masterfully crafted signature dish."}
          </p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-50">
          <motion.button 
  whileTap={{ scale: 0.95 }}
  onClick={() => onOrder(item)} 
  className="group/btn flex items-center gap-1 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all duration-300 shadow-md"
>
  <Plus 
    size={14} 
    strokeWidth={3} 
    className="transition-transform duration-500 group-hover/btn:rotate-90" 
  />
  <span>Order Now</span>
</motion.button>

          <div className="text-right">
            <span className="block text-xl text-zinc-900 tracking-tighter leading-none">
              {Number(item.price).toLocaleString()}
            </span>
            <span className="text-[9px] text-yellow-600 font-bold uppercase tracking-widest">
              UGX
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}