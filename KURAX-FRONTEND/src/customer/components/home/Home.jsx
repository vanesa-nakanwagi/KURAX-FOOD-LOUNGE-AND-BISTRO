import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import hero1 from "../../assets/images/hero1.jpg";
import hero12 from "../../assets/images/hero12.jpg";
import hero3 from "../../assets/images/hero13.jpg";
import luwombo from "../../assets/images/luwombo.jpeg";
import grilledGoat from "../../assets/images/grilled_goat.jpeg";
import cocktails from "../../assets/images/hero13.jpg";
import burger from "../../assets/images/hero4.jpg";
import { useNavigate } from "react-router-dom";
import terrace from "../../assets/images/terrace.jpg";
import { Calendar, Clock, MapPin } from "lucide-react";
import FooterGlobal from "../common/footer.jsx";
import VisitUs from "./visitUs.jsx";
import About from "./about.jsx";
import Reserve from "./reserveHome.jsx";
import Services from "./services.jsx"; 
import { useCart } from "../context/CartContext.jsx";
import CartModal from "../menu/cart/CartModal.jsx";
import BookingModal from "../events/BookingModal.jsx"; 
import { Plus, SearchX } from "lucide-react";


const heroImages = [hero1, hero12, hero3, terrace];



// Hardcoded events data
const events = [
  {
    id: 2,
    title: "Sunday Brunch Experience",
    date: "Every Sunday",
    time: "11:00 AM - 3:00 PM",
    location: "Main Dining Area",
    description: "All-you-can-eat brunch buffet with bottomless mimosas",
    image: "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=800&q=80",
    category: "Dining",
  },
  {
    id: 3,
    title: "Afrobeats Night",
    date: "Every Saturday",
    time: "9:00 PM - 2:00 AM",
    location: "Rooftop Terrace",
    description: "Dance the night away with the best Afrobeats DJs",
    image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=80",
    category: "Nightlife",
  },
  {
    id: 6,
    title: "Open Mic Comedy Night",
    date: "Every Wednesday",
    time: "8:00 PM - 10:30 PM",
    location: "Main Lounge",
    description: "Stand-up comedy with local and international comedians",
    image: "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=800&q=80",
    category: "Entertainment",
  },
];

export default function Home () {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();
   const {
    cart,
    isCartOpen,
    setIsCartOpen,
    checkoutStep,
    setCheckoutStep,
    activeDish,
    setActiveDish,
    handleAddToCart,
    handleRemoveFromCart,
    handleQuantityChange,
    totalAmount,
    customerDetails,
    setCustomerDetails,
  } = useCart();
  
 const [isModalOpen, setIsModalOpen] = useState(false);
  const goToMenu = () => {
    navigate("/menus");
  };

  

  // Navigate to Reservation page
  const goToReserve = () => {
    navigate("/reservations"); 
  };
    useEffect(() => {
    if (location.state?.preselectedItem) {
      const dishWithQuantity = {
        ...location.state.preselectedItem,
        quantity: 1,
        instructions: "",
      };
      setActiveDish(dishWithQuantity);
      setIsCartOpen(true);
    }
  }, [location.state]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % heroImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);
 
   const handleOrder = (item) => {
    const dishWithQuantity = {
      ...item,
      quantity: 1,
      instructions: "",
    };

    setActiveDish(dishWithQuantity);
    setIsCartOpen(true);
  };

  return (
    <section className=" relative h-screen bg-white font-[Outfit]">

      {/* Navbar */}
      <Navbar />

      {/* Hero Container */}
      <div className="relative w-full h-screen overflow-hidden">

        {heroImages.map((img, index) => (
  <div
    key={index}
    className={`absolute inset-0 bg-center bg-cover transition-opacity duration-1000 ${
      index === current
        ? "opacity-100 animate-zoomOut"
        : "opacity-0"
    }`}
    style={{ backgroundImage: `url(${img})` }}
  />
))}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />

        {/* Hero Text */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
          <h1 className="font-bold text-3xl sm:text-4xl md:text-6xl lg:text-7xl leading-tight animate-fadeUp">
            Elevated Local
            <span className="block mt-2 text-yellow-600">
              & Cuisine Reimagined
            </span>
          </h1>
          <p className="mt-2 text-sm sm:text-base md:text-lg text-white/90 max-w-xs sm:max-w-sm md:max-w-md animate-fadeUp delay-200">
            Luxury dining, signature drinks & rooftop vibes
          </p>

          <div className="mt-8 flex flex-row gap-4">
  <button
    onClick={goToMenu}
    className="px-6 py-2 rounded-none bg-transparent border-2 border-yellow-600 text-yellow-600 font-semibold hover:bg-yellow-600 hover:text-black transition"
  >
    View Menu
  </button>
  <button
    onClick={goToReserve}
    className="px-6 py-2 rounded-none bg-transparent border border-yellow-600 text-yellow-600 font-semibold hover:bg-yellow-600 hover:text-black transition"
  >
    Reserve Table
  </button>
  
</div>

          
        </div>
        
      </div>
      

      {/* ================== Signature Dishes Section ================== */}
<section className="bg-white text-black font-outfit py-20 px-4 sm:px-8">
  <div className="max-w-7xl mx-auto text-center">

    {/* Section header */}
    <p className="text-yellow-800 uppercase text-bg mb-2 tracking-wide">
      Our Specialities
    </p>
    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2">
      Signature Dishes
    </h2>
    <div className="w-16 h-1 bg-yellow-500 mx-auto mb-4"></div>
    <p className="text- max-w-2xl mx-auto mb-12 text-base sm:text-lg">
      Carefully curated selections that celebrate Uganda&apos;s culinary heritage, crafted with passion and modern finesse.
    </p>

    {/* Menu Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {[
  { 
    id : 1,
    image: burger,
    name: "Burger",
    description: "A royal Ugandan delicacy slow-cooked to perfection.",
    price: 45000,
  },
  {
    id: 2,
    image: grilledGoat,
    name: "Grilled Goat",
    description: "Smoky, tender, and seasoned with local spices.",
    price: 60000,
  },
  {
    id: 3,
    image: cocktails,
    name: "Cocktails",
    description: "A luxurious staple elevated with Kurax finesse.",
    price: 25000,
  },
  {
    id: 4,
    image: luwombo,
    name: "Luwombo",
    description: "A royal Ugandan delicacy slow-cooked to perfection.",
    price: 45000,
  },
].map((item, idx) => (
  <div 
          key={item.id} 
          className="group bg-white-900/40 border border-white/5 rounded-2xl overflow-hidden hover:border-yellow-500/50 transition-all flex flex-col shadow-2xl"
        >
          {/* Large Image Section */}
          <div className="h-56 bg-zinc-800 relative overflow-hidden">
            {item.image ? (
              <img 
                src={item.image} 
                alt={item.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-700 font-black text-xs uppercase tracking-tighter bg-gradient-to-br from-zinc-800 to-zinc-900">
                Kurax Kitchen
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="p-6 flex-1 flex flex-col">
            {/* Title and Price on the same row */}
            <div className="flex justify-between items-start gap-4 mb-3">
              <h4 className="text-lg font-black text-black uppercase tracking-tight leading-tight">
                {item.name}
              </h4>
              <div className="text-right flex-shrink-0">
                <span className="text-yellow-500 text-base font-black tracking-tighter">
                  UGX {Number(item.price).toLocaleString()}
                </span>
              </div>
            </div>
            
            <p className="text-xs text-zinc-500 line-clamp-2 mb-8 italic leading-relaxed">
              {item.description || "Freshly prepared Kurax special available for order now."}
            </p>

            <button 
              onClick={() => handleOrder(item)}
              className="mt-auto w-full py-4 text-color-black bg-yellow-400 text-black rounded-xl text-xs font-black flex items-center justify-center gap-3 transition-all uppercase italic shadow-lg active:scale-95"
            >
              <Plus size={18} /> Add to Order
            </button>
          </div>
        </div>
))}

    </div>

    {/* Explore Menu Button */}
    <div className="mt-12">
      <Link
        to="/menus"
        className="mt-8 px-8 py-3 border-2 border-yellow-600 italic text-black font-bold uppercase tracking-wider transition duration-300 hover:bg-yellow-600 self-start"
      >
        Explore Menu
      </Link>
    </div>
  </div>
</section>

 {/* ================= CART MODAL ================= */}
      {isCartOpen && (
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
      )}


   {/* ================== Featured Events Section ================== */}
<section className="bg-gray-100 text-black font-outfit py-20 px-4 sm:px-8">
  <div className="max-w-7xl mx-auto text-center">

    {/* Section Header */}
    <p className="text-yellow-800 uppercase mb-2 tracking-wide">Upcoming Experiences</p>
    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2">Featured Events</h2>
    <div className="w-16 h-1 bg-yellow-500 mx-auto mb-4"></div>
    <p className="text-black/70 max-w-2xl mx-auto mb-12 text-base sm:text-lg">
      Join us for exclusive dining experiences, live entertainment, and special culinary celebrations.
    </p>

    {/* Event Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {events.map((event) => (
        <div
          key={event.id}
          className="bg-white  rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-shadow duration-300 border-2 border-transparent group flex flex-col"
        >
          {/* Image */}
          <div className="relative h-56 overflow-hidden">
            <img
              src={event.image}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute top-4 left-4">
              <div className="bg-yellow-400 text-black px-3 py-1 rounded-xl text-sm font-semibold flex items-center gap-1">
                {event.icon && <event.icon className="w-4 h-4" />}
                {event.category}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 flex flex-col flex-1 text-left">
            <h3 className="font-serif text-2xl font-bold mb-2 text-black">
              {event.title}
            </h3>
            <p className="text-gray-700 mb-4 flex-1 text-sm sm:text-base">
              {event.description}
            </p>

            {/* Event Info */}
            <div className="space-y-2 mb-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-yellow-400" />
                {event.date}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-400" />
                {event.time}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-yellow-400" />
                {event.location}
              </div>
            </div>

            {/* Button at the bottom */}
            <div className="mt-auto">
              <button
                className="mt-auto w-full py-4 text-color-black bg-yellow-400 text-black rounded-xl text-xs font-black flex items-center justify-center gap-3 transition-all uppercase italic shadow-lg active:scale-95"
                onClick={() => setIsModalOpen(true)}
              >
                Book Now
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>


    {/* Booking Modal */}
          {isModalOpen && (
            <BookingModal
              show={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              eventTitle={event.title}
            />
          )}

    {/* Explore Events Button */}
    <div className="mt-12">
      <Link
        to="/events"
        className="mt-8 px-8 py-3 border-2 border-yellow-600 italic text-black font-bold uppercase tracking-wider transition duration-300 hover:bg-amber-600 self-start"
      >
        Explore Events
      </Link>
    </div>

  </div>
</section>

<Services />
<Reserve />
<About />
<VisitUs />
<FooterGlobal />
</section>
  );
}

