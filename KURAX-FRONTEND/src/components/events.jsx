import { Calendar, Clock, MapPin, Music, Users, Sparkles } from "lucide-react"
import TopSection from "../components/topSection.jsx"
import SocialButton from "../components/socialButton.jsx"
import { events } from "../data/events.jsx"
import terrace from "../assets/images/terrace.jpg"


export default function EventsPage() {
  return (
    <div className="bg-black text-white font-[Outfit]">
      {/* ================= HEADER ================= */}
    <TopSection searchPlaceholder="Search events..." />

      {/* ================= HERO ================= */}
      <section className="relative h-[60vh] min-h-[500px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={terrace}
            alt="Kurax Events"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
          <h1 className="font-serif text-5xl md:text-7xl font-bold text-white mb-6 text-balance">
            Unforgettable
            <br />
            <span className=" text-yellow-400">Experiences</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 text-pretty">
            Live music, themed dinners, and exclusive events on our rooftop terrace
          </p>
        </div>
      </section>

      {/* ================= EVENTS GRID ================= */}
      <section className="py-16 px-6 max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-serif font-bold mb-4">Upcoming Events</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            From live entertainment to exclusive dining experiences, there's always something special happening at Kurax
          </p>
        </div>

        {/* Events Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-zinc-900 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 border-2 border-transparent hover:border-primary/20 group"
            >
              {/* Event Image */}
              <div className="relative h-56 overflow-hidden">
                <img
                  src={event.image || "/placeholder.svg"}
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

              {/* Event Details */}
              <div className="p-6">
               <h3 className="font-serif text-2xl font-bold mb-3 group-hover:text-white-400 transition-colors">
                  {event.title}
               </h3>
                <p className="text-gray-400 mb-4 leading-relaxed">{event.description}</p>

                {/* Event Meta */}
                <div className="space-y-2 mb-4 text-sm text-gray-300">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-yellow-400" />
                    <span>{event.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    <span>{event.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-yellow-400" />
                    <span>{event.location}</span>
                  </div>
                </div>

                {/* CTA Button */}
                <button className="w-full bg-yellow-400 text-black hover:bg-yellow-300 border-2 border-yellow-400 px-4 py-2 rounded-full text-sm font-semibold transition-all">
                  Book Now
                </button>

              </div>
            </div>
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

        <div className="flex justify-center gap-4">
          <SocialButton color="from-purple-500 to-pink-500" label="Instagram" />
          <SocialButton color="from-blue-500 to-cyan-500" label="X (Twitter)" />
          <SocialButton color="from-blue-600 to-blue-800" label="Facebook" />
          <SocialButton color="from-gray-800 to-black" label="TikTok" />
        </div>
      </section>
    </div>
  )
}
