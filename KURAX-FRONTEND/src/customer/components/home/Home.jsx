import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import axios from "axios";
import { 
  Plus, Sparkles, ArrowRight, Star, ChefHat, Calendar, 
  Truck, Clock, CreditCard, UtensilsCrossed
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
import hero1 from "../../assets/images/kurax8.jpg";
import hero12 from "../../assets/images/hero4.png";
import hero3 from "../../assets/images/kurax9.png";
import rice from "../../assets/images/rice.jpg";
import hero from "../../assets/images/hero.png";

// Delivery image (replace with your actual file)
import deliveryImg from "../../assets/images/delivery.jpg";

// Chef carousel images – REPLACE WITH YOUR THREE ACTUAL FILES
import chefImg1 from "../../assets/images/chef.jpg";
import chefImg2 from "../../assets/images/waiter1.jpg";
import chefImg3 from "../../assets/images/hero17.jpg";

const heroImages = [hero1, hero12, hero3, hero];

// Animation Variants
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
};
// ========== DELIVERY SECTION (yellow bar next to main heading) ==========
function DeliverySection() {
  const navigate = useNavigate();

  const fadeInUpLocal = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } }
  };
  const staggerChildrenLocal = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };

  return (
    <section className="py-16 px-6 bg-white border-b border-zinc-100">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerChildrenLocal}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center"
        >
          {/* Image side - smaller width, sharp edges */}
          <motion.div
            variants={fadeInUpLocal}
            className="relative flex justify-center"
          >
            <img
              src={deliveryImg}
              alt="Kurax food delivery"
              className="w-full max-w-md object-cover transition-transform duration-700 group-hover:scale-105"
              style={{ borderRadius: 0 }}
            />
          </motion.div>

          {/* Text side */}
          <motion.div variants={staggerChildrenLocal} className="space-y-4">
            {/* Badge only - no bar */}
            <motion.div variants={fadeInUpLocal}>
              <span className="text-yellow-600 font-bold uppercase tracking-[0.3em] text-xs">
                Fast & Fresh
              </span>
            </motion.div>

            {/* Heading with yellow bar */}
            <motion.div
              variants={fadeInUpLocal}
              className="flex items-center gap-3"
            >
              <div className="w-1 h-10 md:h-12 bg-yellow-500 rounded-full" />
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif leading-[1.1] tracking-tight">
                Delivery from{' '}
                <span className="bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent">
                  Kurax
                </span>
              </h2>
            </motion.div>

            <motion.p
              variants={fadeInUpLocal}
              className="text-zinc-600 text-base md:text-lg leading-relaxed"
            >
              Savor your favorite gourmet dishes wherever you are. Our delivery service
              brings the same luxury, quality, and attention to detail straight to your door.
              Fast, reliable, and available daily.
            </motion.p>

            {/* Features */}
            <motion.div
              variants={staggerChildrenLocal}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2"
            >
              {[
                { icon: Truck, label: 'Quick delivery' },
                { icon: Clock, label: '30‑45 min' },
                { icon: CreditCard, label: 'Secure payment' }
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  variants={fadeInUpLocal}
                  className="flex items-center gap-2 text-zinc-700"
                >
                  <item.icon size={18} className="text-yellow-600" />
                  <span className="text-sm font-medium">{item.label}</span>
                </motion.div>
              ))}
            </motion.div>

          

            {/* --- LUXURY CTA BUTTON --- */}
                        <motion.div variants={fadeInUp} className="pt-6">
                          <button 
                          variants={fadeInUpLocal}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/menus")}
                             
                            className="relative overflow-hidden group inline-flex items-center gap-3 px-6 md:px-12 py-4 bg-yellow-400 text-black uppercase tracking-[0.2em] text-xs sm:text-sm rounded-none shadow-lg hover:bg-yellow-500 transition-all duration-500"
                          >
                            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                            Order for Delivery
                            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-2" />
                          </button>
                        </motion.div>

          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
// ========== CHEF SECTION (yellow bar on heading, vertically centered like Delivery) ==========
function ChefSection() {
  const [chefIndex, setChefIndex] = useState(0);
  const chefImages = [chefImg1, chefImg2, chefImg3];

  useEffect(() => {
    const interval = setInterval(() => {
      setChefIndex((prev) => (prev + 1) % chefImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fadeInUpLocal = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } }
  };
  const staggerChildrenLocal = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };

  return (
    <section className="py-16 px-6 bg-[#FCFCFB] border-b border-zinc-100">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerChildrenLocal}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center"
        >
          {/* Text side (left on desktop) */}
          <motion.div variants={staggerChildrenLocal} className="order-2 lg:order-1 space-y-5">
            {/* Badge only - no bar */}
            <motion.div variants={fadeInUpLocal}>
              <span className="text-yellow-600 font-bold uppercase tracking-[0.3em] text-xs">
                Our Philosophy
              </span>
            </motion.div>

            {/* Heading with yellow bar */}
            <motion.div
              variants={fadeInUpLocal}
              className="flex items-center gap-3"
            >
              <div className="w-1 h-10 md:h-12 bg-yellow-500 rounded-full" />
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif leading-[1.1] tracking-tight">
                Crafted by{' '}
                <span className="bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent">
                  Masters
                </span>
              </h2>
            </motion.div>

            <motion.p
              variants={fadeInUpLocal}
              className="text-zinc-600 text-base md:text-lg leading-relaxed"
            >
              Behind every dish is a story of passion, precision, and artistry. Our
              executive chef and team bring years of culinary excellence, using only the
              finest ingredients to create an unforgettable fine‑dining experience.
            </motion.p>

            {/* Signature style badges */}
            <motion.div
              variants={staggerChildrenLocal}
              className="flex flex-wrap gap-3 pt-2"
            >
              {[
                { icon: ChefHat, label: 'Master Chef' },
                { icon: Star, label: 'Premium Ingredients' },
                { icon: UtensilsCrossed, label: 'Fusion Techniques' }
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  variants={fadeInUpLocal}
                  className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-zinc-200"
                >
                  <item.icon size={16} className="text-yellow-600" />
                  <span className="text-sm font-medium text-zinc-800">{item.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Image side (right) - carousel with smaller width & sharp edges */}
          <motion.div
            variants={fadeInUpLocal}
            className="order-1 lg:order-2 relative flex justify-center"
          >
            <div className="relative w-full max-w-md">
              <AnimatePresence mode="wait">
                <motion.img
                  key={chefIndex}
                  src={chefImages[chefIndex]}
                  alt="Kurax chef"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8 }}
                  className="w-full object-cover"
                  style={{ borderRadius: 0 }}
                />
              </AnimatePresence>
              {/* Dot navigation */}
              <div className="absolute -bottom-8 left-0 right-0 flex justify-center gap-2">
                {chefImages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setChefIndex(idx)}
                    className={`h-2 w-2 rounded-full transition-all ${
                      idx === chefIndex ? 'bg-yellow-600 w-4' : 'bg-gray-400'
                    }`}
                    aria-label={`View chef image ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ========== MAIN HOME COMPONENT ==========
export default function Home() {
  const [current, setCurrent] = useState(0);
  const [dbMenus, setDbMenus] = useState([]);
  const [dbEvents, setDbEvents] = useState([]);
  const [loadingMenus, setLoadingMenus] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
              <h1 className="text-4xl md:text-7xl font-serif font-medium leading-[1.05] text-white">
                Experience <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-800 ">
                  Luxury
                </span> <br />
                Redefined
              </h1>
            </motion.div>
            
            <p className="text-zinc-300 text-sm md:text-xl font-light max-w-lg leading-relaxed">
              Indulge in a world where fine dining meets the art of relaxation. 
              Kurax is your ultimate sanctuary for gourmet cuisine.
            </p>
            
            <div className="flex flex-wrap gap-5 pt-4">
              <button onClick={() => navigate("/reservations")} className="px-6 md:px-10 py-4 bg-yellow-600 text-black uppercase tracking-widest rounded-sm hover:bg-yellow-500 transition-colors shadow-lg min-w-[140px] text-xs sm:text-sm">
                Book a Table
              </button>
              <button onClick={() => navigate("/menus")} className="px-6 md:px-10 py-4 border border-white/40 text-white uppercase tracking-widest hover:bg-white hover:text-black transition-all rounded-sm min-w-[140px] text-xs sm:text-sm">
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
          <motion.header variants={fadeInUp} className="flex flex-row items-center justify-between mb-16 gap-4">
            <div className="space-y-2 flex-1">
              <span className="text-yellow-600 font-bold uppercase tracking-[0.3em] text-xs">Our Selection</span>
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-1.5 h-6 md:h-8 bg-yellow-500 rounded-full" />
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif leading-[0.85] tracking-tighter">
                  Signature{" "}
                  <span className="bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 bg-clip-text text-transparent whitespace-nowrap">
                    Dishes
                  </span>
                </h2>
              </div>
            </div>
            <Link to="/menus" className="text-yellow-600 uppercase tracking-widest text-[10px] sm:text-sm flex items-center gap-2 group shrink-0">
              View Menu <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
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

      {/* ---  UPCOMING SCHEDULE / EVENTS SECTION --- */}
      <section className="py-24 px-6 bg-[#FCFCFB] relative overflow-hidden">
        <motion.div 
          className="max-w-7xl mx-auto relative z-10"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.header 
            variants={fadeInUp} 
            className="flex flex-row items-center justify-between mb-16 gap-4"
          >
            <div className="space-y-2 flex-1">
              <span className="text-yellow-600 font-bold uppercase tracking-[0.3em] text-xs">
                Kurax Experiences
              </span>
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-1.5 h-6 md:h-8 bg-yellow-500 rounded-full" />
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif leading-[0.85] tracking-tighter">
                  Upcoming{" "}
                  <span className="bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 bg-clip-text text-transparent whitespace-nowrap">
                    Schedule
                  </span>
                </h2>
              </div>
            </div>
            
            <Link 
              to="/events" 
              className="text-yellow-600 uppercase tracking-widest text-[10px] sm:text-sm flex items-center gap-2 group shrink-0"
            >
              View Events 
              <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
            </Link>
          </motion.header>
          
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

      {/* ========== NEW SECTIONS ========== */}
      <DeliverySection />
      <ChefSection />
      {/* ================================= */}
        <Services />
      <About />
     
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

// --- Helper Component for Menu Cards ---
function HomeMenuCard({ item, onOrder }) {
  const imageUrl = item.image_url?.startsWith('http') 
    ? item.image_url 
    : `${API_URL}${item.image_url}`;

  return (
    <motion.div 
      variants={fadeInUp}
      whileHover={{ y: -8 }}
      className="group relative bg-white rounded-[1rem] font-outfit overflow-hidden shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] hover:shadow-2xl border border-zinc-100 transition-all duration-500"
    >
      <div className="relative h-56 overflow-hidden">
        <motion.img
          src={imageUrl}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-30" />
        <div className="absolute top-4 left-4">
           <div className="bg-yellow-500 text-black text-[8px] px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 uppercase tracking-widest">
             <Sparkles size={8} /> New
           </div>
        </div>
      </div>
      
      <div className="p-6 space-y-4">
        <div className="space-y-1">
          <h4 className="text-lg font-[Outfit] text-yellow-700 tracking-tight group-hover:text-yellow-600 transition-colors line-clamp-1">
            {item.name}
          </h4>
          <p className="text-zinc-900 text-[14px] font-light leading-relaxed line-clamp-2">
            {item.description || "Indulge in our masterfully crafted signature dish."}
          </p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => onOrder(item)} 
            className="group/btn flex items-center gap-1 px-4 py-3 bg-yellow-400 hover:bg-yellow-400 text-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all duration-300 shadow-md"
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