import { Calendar, Clock, MapPin, Tag } from "lucide-react"; // Added Tag icon
import { useState } from "react";
import BookingModal from "./BookingModal.jsx"; 

export default function EventCard({ event }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
  <>
    <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-shadow duration-300 border-2 border-transparent group flex flex-col">
      
      {/* Image Container */}
      <div className="relative h-56 overflow-hidden">
        <img
          src={event.image || (event.image_file ? URL.createObjectURL(event.image_file) : '/placeholder.jpg')}
          alt={event.name} // Changed from title to name to match your Event admin data
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />

        {/* TAG FUNCTIONALITY ADDED HERE */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {/* Main Category Badge (Keep if you still use categories) */}
          <div className="bg-yellow-400 text-black px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg">
            {event.category || "Event"}
          </div>

          {/* Mapping through multiple tags */}
          {event.tags && event.tags.map((tag, index) => (
            <div 
              key={index} 
              className="bg-black/60 backdrop-blur-md text-white px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border border-white/10 flex items-center gap-1 w-fit"
            >
              <Tag className="w-2.5 h-2.5 text-yellow-400" />
              {tag}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1">
        <h3 className="font-serif text-2xl font-bold mb-3 text-black dark:text-white">
          {event.name || event.title}
        </h3>

        <p className="text-gray-700 dark:text-gray-400 mb-4 flex-1">
          {event.description}
        </p>

        {/* Info */}
        <div className="space-y-2 mb-4 text-sm text-gray-600 dark:text-gray-300">
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

        {/* Button */}
        <div className="mt-auto">
          <button
            className="w-full py-4 bg-yellow-400 text-black rounded-2xl text-xs font-black flex items-center justify-center gap-3 transition-all uppercase italic shadow-lg active:scale-95"
            onClick={() => setIsModalOpen(true)}
          >
            Book Now
          </button>
        </div>
      </div>
    </div>

    {/* Booking Modal */}
    {isModalOpen && (
      <BookingModal
        show={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        eventTitle={event.name || event.title}
      />
    )}
  </>
);
}