import {
  Utensils,
  Sofa,
  Music,
  PackageCheck,
} from "lucide-react";

export default function Services() {
  const services = [
    {
      title: "Food & Beverages",
      description:
        "Premium dine-in meals, drinks, takeaways, and fast delivery prepared by expert chefs.",
      icon: Utensils,
    },
    {
      title: "Lounge Experience",
      description:
        "Relaxed rooftop dining with comfort, ambience, and free Wi-Fi for chilling or meetings.",
      icon: Sofa,
    },
    {
      title: "Events & Entertainment",
      description:
        "Live music, social events, private celebrations, and unforgettable nightlife vibes.",
      icon: Music,
    },
    {
      title: "Catering & Reservations",
      description:
        "Professional catering, corporate bookings, group reservations, and customer support.",
      icon: PackageCheck,
    },
  ];

  return (
    <section className="w-full bg-white px-6 py-20">
      {/* Title */}
      <div className="max-w-6xl mx-auto text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-yellow-900 tracking-wide">
          PREMIUM SERVICES
        </h2>
        <p className="mt-4 text-black/70 max-w-2xl mx-auto">
          Experience exceptional dining, entertainment, and hospitality crafted
          to give you comfort, quality, and unforgettable moments.
        </p>
      </div>

      {/* Cards */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {services.map((service, index) => {
          const Icon = service.icon;

          return (
            <div
              key={index}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center hover:border-black-400/50 hover:-translate-y-2 transition-all duration-300"
            >
              <div className="flex items-center justify-center mb-4">
                <Icon className="w-12 h-12 text-yellow-700" />
              </div>

              <h3 className="text-lg font-semibold text-black mb-2">
                {service.title}
              </h3>

              <p className="text-sm text-black/60">
                {service.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
