import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import hero1 from "../assets/images/hero1.jpg";
import hero2 from "../assets/images/hero2.jpg";
import hero3 from "../assets/images/hero13.jpg";
import luwombo from "../assets/images/luwombo.jpeg";
import grilledGoat from "../assets/images/grilled_goat.jpeg";
import matooke from "../assets/images/matooke.jpeg";
import { useNavigate } from "react-router-dom";
import terrace from "../assets/images/terrace.jpg";
import ContactIconButton from "../components/common/socialButton.jsx";
import ContactInfoItem from "../components/visitUs.jsx";
import { Calendar, Clock, MapPin, Music, Users, Sparkles } from "lucide-react";


const heroImages = [hero1, hero2, hero3, terrace];

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
    date: "First Wednesday",
    time: "8:00 PM - 10:30 PM",
    location: "Main Lounge",
    description: "Stand-up comedy with local and international comedians",
    image: "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=800&q=80",
    category: "Entertainment",
  },
];

export default function Hero() {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();

  const goToMenu = () => {
    navigate("/menus");
  };

  // Navigate to Reservation page
  const goToReserve = () => {
    navigate("/reservations"); // <-- make sure this route exists
  };
  // Hero slideshow
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % heroImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative bg-white font-[Outfit]">

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
            Experience Uganda’s soul through elevated cuisine where tradition meets innovation.
          </p>

          <div className="mt-8 flex flex-row gap-4">
  <button
    onClick={goToMenu}
    className="px-6 py-2 rounded-none bg-transparent border border-yellow-500 text-yellow-500 font-semibold hover:bg-yellow-500 hover:text-black transition"
  >
    View Menu
  </button>
  <button
    onClick={goToReserve}
    className="px-6 py-2 rounded-none bg-transparent border border-yellow-500 text-yellow-500 font-semibold hover:bg-yellow-500 hover:text-black transition"
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
    <p className="text-black/70 max-w-2xl mx-auto mb-12 text-base sm:text-lg">
      Carefully curated selections that celebrate Uganda&apos;s culinary heritage, crafted with passion and modern finesse.
    </p>

    {/* Menu Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {[
        {
          img: luwombo,
          title: "Luwombo",
          desc: "A royal Ugandan delicacy slow-cooked to perfection.",
          price: "UGX 45,000",
        },
        
        {
          img: grilledGoat,
          title: "Grilled Goat",
          desc: "Smoky, tender, and seasoned with local spices.",
          price: "UGX 60,000",
        },
        {
          img: matooke,
          title: "Matooke",
          desc: "A Ugandan staple elevated with Kurax finesse.",
          price: "UGX 25,000",
        },
        {
          img: luwombo,
          title: "Luwombo",
          desc: "A royal Ugandan delicacy slow-cooked to perfection.",
          price: "UGX 45,000",
        },
      ].map((c, idx) => (
        <div
          key={idx}
          className="rounded-none overflow-hidden shadow-lg hover:shadow-2xl transition duration-300
                     border-2 border-transparent
                     bg-white dark:bg-white-900
                     hover:bg-gray-200"
        >
          <img src={c.img} alt={c.title} className="w-full h-48 object-cover" />
          <div className="p-4 text-left">
            <h4 className="font-semibold text-lg text-black-900 dark:text-black">{c.title}</h4>
            <p className="text-gray-600 dark:text-gray-600 text-sm my-2">{c.desc}</p>
            <div className="flex justify-start items-center">
              <span className="font-bold text-yellow-500">{c.price}</span>
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Explore Menu Button */}
    <div className="mb-10">
      <Link
        to="/menus"
        className="inline-block px-8 py-3 border-2 border-yellow-400 text-black-900 font-medium text-sm hover:bg-yellow-400  transition-all duration-300"
      >
        Explore Menu
      </Link>
    </div>

    {/* Faint divider line at bottom */}
    <div className="w-full h-px bg-yellow-500/20"></div>
  </div>
</section>


    {/* ================== Featured Events Section ================== */}
<section className="bg-white text-black font-outfit py-20 px-4 sm:px-8">
  <div className="max-w-7xl mx-auto text-center">

    {/* Section Header */}
    <p className="text-yellow-800 uppercase text-bg mb-2 tracking-wide">
      Upcoming Experiences
    </p>
    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2">
      Featured Events
    </h2>
    <div className="w-16 h-1 bg-yellow-500 mx-auto mb-4"></div>
    <p className="text-black/70 max-w-2xl mx-auto mb-12 text-base sm:text-lg">
      Join us for exclusive dining experiences, live entertainment, and special culinary celebrations.
    </p>

    {/* Event Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {events.map((event) => (
        <div
          key={event.id}
          className="bg-white dark:bg-white-900 rounded-none overflow-hidden shadow-lg hover:shadow-2xl transition duration-300
                     border-2 border-transparent hover:border-yellow-400/50 group"
        >
          {/* Image */}
          <div className="relative h-56 overflow-hidden">
            <img
              src={event.image}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
            {/* Category Badge */}
            <div className="absolute top-4 left-4 z-10">
              <div className="bg-yellow-400 text-black px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                {event.icon && <event.icon className="w-4 h-4" />}
                {event.category}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 text-left">
            <h3 className="font-serif text-2xl font-bold mb-2 text-black dark:text-black">
              {event.title}
            </h3>
            <p className="text-gray-700 dark:text-gray-600 mb-4 text-sm sm:text-base">
              {event.description}
            </p>

            {/* Event Info */}
            <div className="space-y-2 mb-4 text-sm text-gray-700 dark:text-gray-600">
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
          </div>
        </div>
      ))}
    </div>

    {/* Explore Events Button */}
    <div className="mt-12">
      <Link
        to="/events"
        className="inline-block px-8 py-3 text-bg border-2 border-yellow-400 text-black-900 font-medium text-sm hover:bg-yellow-400 hover:text-black transition-all duration-300"
      >
        Explore Events
      </Link>
    </div>

    {/* Faint divider line at bottom */}
    <div className="w-full h-px bg-yellow-500/20 mt-16"></div>
  </div>
</section>
<ContactInfoItem />

<ContactIconButton />

    </section>
  );
}
