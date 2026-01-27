import { Calendar, Clock, MapPin } from "lucide-react";
import { useState } from "react";
import BookingModal from "./BookingModal.jsx"; 

export default function EventCard({ event }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
  <>
    <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-shadow duration-300 border-2 border-transparent group flex flex-col">
      
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
      <div className="p-6 flex flex-col flex-1">
        <h3 className="font-serif text-2xl font-bold mb-3 text-black dark:text-white">
          {event.title}
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

    {/* Booking Modal */}
    {isModalOpen && (
      <BookingModal
        show={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        eventTitle={event.title}
      />
    )}
  </>
);

}
