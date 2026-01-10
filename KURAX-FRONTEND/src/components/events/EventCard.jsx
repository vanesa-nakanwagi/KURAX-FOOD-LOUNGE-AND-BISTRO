import { Calendar, Clock, MapPin } from "lucide-react";

export default function EventCard({ event }) {
  return (
    <div className="bg-zinc-900 rounded-none overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 border-2 border-transparent group hover:border-yellow-400/50">
      
      {/* Image */}
      <div className="relative h-56 overflow-hidden">
        <img
          src={event.image}
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute top-4 left-4">
          <div className="bg-yellow-400 text-black px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
            <event.icon className="w-4 h-4" />
            {event.category}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="font-serif text-2xl font-bold mb-3">
          {event.title}
        </h3>

        <p className="text-gray-400 mb-4">{event.description}</p>

        <div className="space-y-2 mb-4 text-sm text-gray-300">
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

        <button className="w-full bg-yellow-400 text-black hover:bg-yellow-300 border-2 border-yellow-400 px-4 py-2 rounded-none text-sm font-semibold">
          Book Now
        </button>
      </div>
    </div>
  );
}
