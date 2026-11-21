import { Calendar, Clock, MapPin, Plus } from "lucide-react";
import { useState } from "react";
import BookingModal from "./BookingModal.jsx";
import API_URL from "../../../config/api";   // <-- add this import
import { formatMenuName } from "../../../utils/menuName.js";
import MenuImageViewer from "../menu/MenuImageViewer.jsx";

export default function EventCard({ event = {}, onBook }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  if (!event || Object.keys(event).length === 0) {
    return <div className="h-64 bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-[2.5rem]" />;
  }

  const title = event.title || event.name || "Special Event";
  const displayTitle = formatMenuName(title);
  
  // FIX: use image_url with absolute URL
  let imageUrl = event.image_url || event.image || event.displayImage;
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = `${API_URL}${imageUrl}`;
  }
  if (!imageUrl) imageUrl = 'https://via.placeholder.com/600x400?text=Kurax+Bistro';

  const formattedDate = event.date 
    ? new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : "Date TBD";

  const handleModalOpen = () => {
    setIsModalOpen(true);
    if (onBook) onBook();
  };

  return (
    <>
      <div className="group relative flex h-full min-h-[340px] flex-col overflow-hidden rounded-[1rem] border border-zinc-200 bg-white font-['Outfit'] shadow-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl dark:border-white/5 dark:bg-[#111111] md:flex-row">
        <div className="relative h-[280px] w-full shrink-0 overflow-hidden bg-zinc-100 dark:bg-[#1a1a1a] sm:h-[320px] md:h-auto md:min-h-[340px] md:w-[42%]">
          {!imgLoaded && (
            <div className="pointer-events-none absolute inset-0 z-10 animate-pulse bg-zinc-200 dark:bg-zinc-800" />
          )}
          <button
            type="button"
            onClick={() => setSelectedImage({ src: imageUrl, alt: displayTitle })}
            aria-label={`View full-size image of ${displayTitle}`}
            className="absolute inset-0 block min-h-0 min-w-0 cursor-zoom-in border-0 bg-transparent p-0 text-left"
          >
            <img
              src={imageUrl}
              alt={displayTitle}
              onLoad={() => setImgLoaded(true)}
              onError={(e) => {
                setImgLoaded(true);
                e.target.src = 'https://via.placeholder.com/600x400?text=Image+Unavailable';
              }}
              className={`h-full w-full object-cover ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-6 sm:p-8">
          <div className="flex flex-1 flex-col justify-center">
            <div className="space-y-2">
              <h3 className="font-[Outfit] text-2xl font-semibold text-yellow-700 transition-colors group-hover:text-yellow-700 dark:text-yellow-300 dark:group-hover:text-yellow-200">
                {displayTitle}
              </h3>
              <p className="text-[13px] font-light leading-relaxed text-zinc-900 line-clamp-3 dark:text-zinc-400">
                {event.description || "Join us for an exclusive experience at Kurax Food Lounge & Bistro."}
              </p>
            </div>

            <div className="my-4 grid grid-cols-1 gap-2.5 border-y border-zinc-100 py-4 dark:border-white/5">
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
          </div>

          <div className="mt-auto pt-4">
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
          eventTitle={displayTitle}
        />
      )}
      {selectedImage && (
        <MenuImageViewer
          src={selectedImage.src}
          alt={selectedImage.alt}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </>
  );
}