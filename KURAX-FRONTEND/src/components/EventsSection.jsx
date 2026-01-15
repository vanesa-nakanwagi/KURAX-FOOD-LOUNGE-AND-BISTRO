import EventCard from "../components/events/EventCard";
import { events } from "../data/events.jsx";

export default function EventsSection() {
  return (
    <section className="py-16 px-6">
      <h2 className="text-3xl font-serif text-yellow-900 text-center mb-10">
        Upcoming Events
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {events.slice(0, 3).map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}
