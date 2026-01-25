import { useState } from "react";
import TopSection from "../common/topSection.jsx";
import terrace from "../../assets/images/terrace.jpg";
import EventCard from "../events/EventCard.jsx";
import BookingModal from "../events/BookingModal.jsx";
import { events } from "../../data/events.jsx";
import gallery5 from "../../assets/images/occasion.jpeg"; 
import gallery1 from "../../assets/images/hero1.jpg";
import gallery2 from "../../assets/images/hero2.jpg";
import gallery3 from "../../assets/images/hero3.jpg";
import gallery4 from "../../assets/images/hero4.jpg";
import gallery6 from "../../assets/images/wine.jpg";
export default function Events() {
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const handleBook = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  const galleryImages = [gallery1, gallery2, gallery3, gallery4, gallery5, gallery6]; // Add all gallery images here

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

     

{/* ================= KURAX GALLERY ================= */}
<section className="py-16 px-6 relative overflow-hidden bg-gray-100 dark:bg-black">
  {/* Centered text */}
  <div className="text-center mb-12 max-w-5xl mx-auto">
    <p className="text-yellow-800 uppercase text-bg mb-2 tracking-wide">
      LIVE MOMENTS
    </p>
    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2">
      KURAX GALLERY
    </h2>
    <p className="text-base sm:text-lg max-w-2xl mx-auto mb-12">
      Dive into the essence of Kurax! Our gallery captures moments of joy, elegance, and unforgettable experiences, scroll through to feel the vibe.
    </p>
  </div>

  {/* Container for images */}
  <div className="relative flex justify-start items-start gap-8 px-6 md:px-12">

    {/* Left Column */}
    <div className="flex flex-col gap-6 z-10">
      <div className="w-96 h-80 md:w-[400px] md:h-[320px] rounded-none overflow-hidden shadow-lg">
        <img
          src={galleryImages[0]}
          alt="Gallery 1"
          className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
        />
      </div>
      <div className="w-96 h-80 md:w-[400px] md:h-[320px] rounded-none overflow-hidden shadow-lg">
        <img
          src={galleryImages[1]}
          alt="Gallery 2"
          className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
        />
      </div>
      <div className="w-96 h-80 md:w-[400px] md:h-[320px] rounded-none overflow-hidden shadow-lg">
        <img
          src={galleryImages[3]}
          alt="Gallery 2"
          className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
        />
      </div>
       <div className="w-96 h-80 md:w-[400px] md:h-[320px] rounded-none overflow-hidden shadow-lg">
        <img
          src={galleryImages[5]}
          alt="Gallery 4"
          className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
        />
      </div>
    </div>

    {/* Right Column (flexible width) */}
    <div className="flex-grow h-[150%] rounded-none overflow-hidden shadow-lg z-10">
      <img
        src={galleryImages[4]}
        alt="Gallery 5"
        className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
      />
    </div>
    

  </div>
</section>


<div className="w-full h-[2px] bg-yellow-900  dark:bg-yellow-900"></div>

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
