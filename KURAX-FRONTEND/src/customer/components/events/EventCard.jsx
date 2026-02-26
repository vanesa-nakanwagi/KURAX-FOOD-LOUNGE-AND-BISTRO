import { Calendar, Clock, MapPin, Plus } from "lucide-react"; // Removed Tag icon
import { useState } from "react";
import BookingModal from "./BookingModal.jsx";

export default function EventCard({ event }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="group font-['Outfit'] relative bg-white dark:bg-[#111111] rounded-[2.5rem] overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-2 border border-zinc-200 hover:border-yellow-500/20 shadow-sm hover:shadow-2xl h-full">
        
        {/* IMAGE SECTION */}
        <div className="relative h-64 overflow-hidden bg-zinc-100 dark:bg-[#1a1a1a]">
          <img
            src={event.image || '/placeholder.jpg'}
            alt={event.name || event.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          
          {/* CLEANUP: 
              We removed the internal tags and overlay from here 
              because they are now handled by the parent 'Events.jsx' 
          */}
        </div>

        {/* CONTENT SECTION */}
        <div className="p-8 flex flex-col flex-1 gap-4">
          <div className="space-y-2">
            <h3 className="font-serif text-3xl font-medium text-zinc-900 dark:text-white leading-tight">
              {event.name || event.title}
            </h3>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-light line-clamp-3">
              {event.description || "Join us for an exclusive experience at Kurax Food Lounge & Bistro."}
            </p>
          </div>

          {/* EVENT METADATA */}
          <div className="grid grid-cols-1 gap-2.5 py-4 border-y border-zinc-300 dark:border-zinc-800/50">
            <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
              <Calendar className="w-4 h-4 text-yellow-500" strokeWidth={1.5} />
              <span className="font-medium">{event.date}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
              <Clock className="w-4 h-4 text-yellow-500" strokeWidth={1.5} />
              <span className="font-medium">{event.time || "TBD"}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
              <MapPin className="w-4 h-4 text-yellow-500" strokeWidth={1.5} />
              <span className="font-medium">{event.location || "Kurax Rooftop"}</span>
            </div>
          </div>

          {/* CTA BUTTON */}
          <div className="mt-auto pt-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full py-4 bg-yellow-400 text-black dark:text-zinc-900 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
            >
              <Plus size={14} strokeWidth={3} />
              Book Now
            </button>
          </div>
        </div>
      </div>

      {/* MODAL */}
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