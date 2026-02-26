import { Calendar, Clock, MapPin, Tag, Plus } from "lucide-react";
import { useState } from "react";
import BookingModal from "./BookingModal.jsx";

// 1. We set a default empty object to prevent "Cannot read properties of undefined"
export default function EventCard({ event = {}, onBook }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // 2. Safety check: If event is empty, show a skeleton instead of crashing
  if (!event || Object.keys(event).length === 0) {
    return <div className="h-64 bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-[2.5rem]" />;
  }

  // 3. Data Normalization
  const title = event.title || event.name || "Special Event";
  const imageUrl = event.displayImage || event.image || 'https://via.placeholder.com/600x400?text=Kurax+Bistro';
  
  // 4. Your requested Date Formatting Logic
  const formattedDate = event.date 
    ? new Date(event.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })
    : "Date TBD";

  const handleModalOpen = () => {
    setIsModalOpen(true);
    if (onBook) onBook(); // Sync with parent if needed
  };

  return (
    <>
      <div className="group font-['Outfit'] relative bg-white dark:bg-[#111111] rounded-[2.5rem] overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-2 border border-zinc-200 dark:border-white/5 shadow-sm hover:shadow-2xl h-full">
        
        {/* IMAGE SECTION */}
        <div className="relative h-64 overflow-hidden bg-zinc-100 dark:bg-[#1a1a1a]">
          {!imgLoaded && (
            <div className="absolute inset-0 bg-zinc-200 dark:bg-zinc-800 animate-pulse z-10" />
          )}
          <img
            src={imageUrl}
            alt={title}
            onLoad={() => setImgLoaded(true)}
            onError={(e) => {
              setImgLoaded(true);
              e.target.src = 'https://via.placeholder.com/600x400?text=Image+Unavailable';
            }}
            className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-60 z-10" />
        </div>

        {/* CONTENT SECTION */}
        <div className="p-8 flex flex-col flex-1 gap-4">
          <div className="space-y-2">
            <h3 className="font-serif text-3xl font-medium text-zinc-900 dark:text-white leading-tight">
              {title}
            </h3>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-light line-clamp-3">
              {event.description || "Join us for an exclusive experience at Kurax Food Lounge & Bistro."}
            </p>
          </div>

          {/* METADATA */}
          <div className="grid grid-cols-1 gap-2.5 py-4 border-y border-zinc-100 dark:border-white/5">
            <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
              <Calendar className="w-4 h-4 text-yellow-500" strokeWidth={1.5} />
              <span className="font-medium">{formattedDate}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
              <Clock className="w-4 h-4 text-yellow-500" strokeWidth={1.5} />
              <span className="font-medium">{event.time || "19:00 Onwards"}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
              <MapPin className="w-4 h-4 text-yellow-500" strokeWidth={1.5} />
              <span className="font-medium">{event.location || "Kurax Rooftop"}</span>
            </div>
          </div>

          <div className="mt-auto pt-2">
            <button
              onClick={handleModalOpen}
              className="w-full py-4 bg-yellow-400 text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
            >
              <Plus size={14} strokeWidth={3} />
              Book Now
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <BookingModal
          show={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          eventTitle={title}
        />
      )}
    </>
  );
}