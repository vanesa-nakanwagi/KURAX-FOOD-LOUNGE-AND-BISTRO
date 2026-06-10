import { Calendar, Clock, MapPin, Tag, Plus } from "lucide-react";
import { useState } from "react";
import BookingModal from "./BookingModal.jsx";
import API_URL from "../../../config/api";   // <-- add this import

const getParsedTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try { return JSON.parse(tags); } catch (e) { return []; }
};

export default function EventCard({ event = {}, onBook }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  if (!event || Object.keys(event).length === 0) {
    return <div className="h-64 bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-[2.5rem]" />;
  }

  const title = event.title || event.name || "Special Event";
  
  // FIX: use image_url with absolute URL
  let imageUrl = event.image_url || event.image || event.displayImage;
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = `${API_URL}${imageUrl}`;
  }
  if (!imageUrl) imageUrl = 'https://via.placeholder.com/600x400?text=Kurax+Bistro';

  const formattedDate = event.date 
    ? new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : "Date TBD";

  const tags = getParsedTags(event.tags);

  const handleModalOpen = () => {
    setIsModalOpen(true);
    if (onBook) onBook();
  };

  return (
    <>
      <div className="group font-['Outfit'] relative bg-white dark:bg-[#111111] rounded-[1rem] overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-2 border border-zinc-200 dark:border-white/5 shadow-sm hover:shadow-2xl h-full">
        
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

          {/* Tags on top-left */}
          {tags.length > 0 && (
            <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2 max-w-[80%]">
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/90 backdrop-blur-sm text-black text-[10px] font-black uppercase tracking-wider rounded-full shadow-md border border-white/20"
                >
                  <Tag size={10} className="text-black" strokeWidth={2} />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="p-8 flex flex-col flex-1 gap-4">
          <div className="space-y-2">
            <h3 className="font-[Outfit] text-2xl font-small text-yellow-600 dark:text-white">
              {title}
            </h3>
            <p className="text-[13px] text-zinc-900 dark:text-zinc-400 leading-relaxed font-light line-clamp-3">
              {event.description || "Join us for an exclusive experience at Kurax Food Lounge & Bistro."}
            </p>
          </div>

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
              className="w-full py-4 bg-yellow-400 text-black rounded-2xl text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95"
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