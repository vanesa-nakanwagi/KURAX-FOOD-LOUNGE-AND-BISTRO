import { useState } from "react";
import TopSection from "../common/topSection.jsx";
import terrace from "../../assets/images/terrace.jpg";
import EventCard from "../events/EventCard.jsx";
import BookingModal from "../events/BookingModal.jsx";
import { events } from "../../data/events.jsx";

export default function Events() {
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const handleBook = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  return (
    <div className="bg-white dark:bg-black text-black dark:text-white font-[Outfit] transition-colors duration-300">
      {/* ================= HEADER ================= */}
      <TopSection searchPlaceholder="Search events..." />

      {/* ================= HERO ================= */}
      <section className="relative h-[60vh] min-h-[500px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={terrace} alt="Kurax Events" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50 dark:bg-black/60" />
        </div>
        <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
          <h1 className="font-serif text-5xl md:text-7xl font-bold mb-6 text-white dark:text-yellow-400 text-balance">
            Unforgettable
            <br />
            <span className="text-yellow-400 dark:text-yellow-400">Experiences</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/90 dark:text-white/80 mb-8 text-pretty">
            Live music, themed dinners, and exclusive events on our rooftop terrace
          </p>
        </div>
      </section>

      {/* ================= EVENTS GRID ================= */}
      <section className="py-16 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-serif font-bold mb-4 text-black dark:text-white">
            Upcoming Events
          </h2>
          <p className="text-gray-700 dark:text-gray-400 text-lg max-w-2xl mx-auto">
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
