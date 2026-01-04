export default function EventsSection() {
  const events = [
    {
      title: "Live Jazz Night",
      date: "Friday, 8 PM - 11 PM",
      image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80"
    },
    {
      title: "Cocktail Masterclass",
      date: "Saturday, 5 PM - 7 PM",
      image: "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03",
    },
    {
      title: "Chef's Tasting Menu",
      date: "Sunday, 6 PM - 9 PM",
      image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=800&q=80"
    },
  ];

  return (
    <section className="px-4 md:px-16 py-8">
      <h3 className="text-2xl md:text-3xl font-serif mb-6 text-yellow-500 text-center">
        Upcoming Events
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event, index) => (
          <div
            key={index}
            className="bg-zinc-900 rounded-none overflow-hidden shadow-lg hover:shadow-2xl transition duration-300"
          >
            <img
              src={event.image}
              alt={event.title}
              className="w-full h-48 object-cover"
            />
            <div className="p-4 text-white">
              <h4 className="font-semibold text-lg mb-1">{event.title}</h4>
              <p className="text-gray-400 text-sm">{event.date}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
