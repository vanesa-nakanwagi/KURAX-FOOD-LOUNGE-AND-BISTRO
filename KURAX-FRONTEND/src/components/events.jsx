import { useState } from "react";
import TopSection from "./topSection.jsx";
import SocialButton from "./common/socialButton.jsx";
import terrace from "../assets/images/terrace.jpg";

// Components
import EventCard from "../components/events/EventCard.jsx";
import BookingModal from "../components/events/BookingModal.jsx";

// Import your events data
import { events } from "../data/events.jsx";

export default function EventsPage() {
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const handleBook = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  return (
    <div className="bg-black text-white font-[Outfit]">
      {/* ================= HEADER ================= */}
      <TopSection searchPlaceholder="Search events..." />

      {/* ================= HERO ================= */}
      <section className="relative h-[60vh] min-h-[500px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={terrace} alt="Kurax Events" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
          <h1 className="font-serif text-5xl md:text-7xl font-bold text-white mb-6 text-balance">
            Unforgettable
            <br />
            <span className="text-yellow-400">Experiences</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 text-pretty">
            Live music, themed dinners, and exclusive events on our rooftop terrace
          </p>
        </div>
      </section>

      {/* ================= EVENTS GRID ================= */}
      <section className="py-16 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-serif font-bold mb-4">Upcoming Events</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            From live entertainment to exclusive dining experiences, there's always something special happening at Kurax
          </p>
        </div>

        {/* Event Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <EventCard key={event.id} event={event} onBook={() => handleBook(event)} />
          ))}
        </div>
      </section>

      {/* ================= CONNECT ================= */}
      <section className="border-t border-white/10 px-10 py-16 text-center">
        <h2 className="text-3xl font-serif mb-3">Connect With Us</h2>
        <p className="text-gray-400 max-w-2xl mx-auto mb-8">
          Follow us on social media for the latest updates, exclusive offers,
          and behind-the-scenes content from Kurax Food Lounge & Bistro
        </p>

        <div className="flex justify-center gap-2">
          <SocialButton
            color="from-purple-500 to-pink-500"
            label="Instagram"
            link="https://www.instagram.com/kuraxfoodloungebistro?igsh=djl0bzltY3lnbmI1"
          />
        
          <SocialButton
            color="from-blue-500 to-cyan-500"
            label="Twitter"
            link="https://x.com/kuraxfoodlounge?t=zSh1NNW0EPSeRwzyoOqinQ&s=09"
          />
        
          <SocialButton
            color="from-blue-600 to-blue-800"
            label="Facebook"
            link="https://www.facebook.com/kuraxfoodlounge"
          />
        
          <SocialButton
            color="from-gray-800 to-black"
            label="TikTok"
            link="https://www.tiktok.com/@kuraxfoodkyanja?_r=1&_t=ZM-92uWpBkTEMe"
          />
        </div>
      </section>

      {/* ================= BOOKING MODAL ================= */}
      {showModal && (
        <BookingModal
          show={showModal}
          onClose={() => setShowModal(false)}
          eventTitle={selectedEvent.title}
        />
      )}
    </div>
  );
}
