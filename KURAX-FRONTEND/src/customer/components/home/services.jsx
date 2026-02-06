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
        "Exclusive professional catering services, group reservations, and customer support.",
      icon: PackageCheck,
    },
  ];

  return (
    <section className="w-full bg-white px-6 py-20">
       <div className="max-w-7xl mx-auto text-center">
      {/* Section Header */}
    <p className="text-yellow-800 uppercase text-bg mb-2 tracking-wide">
      PREMIUM SERVICES
    </p>
    <h2 className="text-2xl text-black sm:text-4xl md:text-5xl font-bold mb-2">
      Come Live Enjoy
    </h2>
    <div className="w-16 h-1 bg-yellow-500 mx-auto mb-4"></div>
    <p className="text-black/70 max-w-2xl mx-auto mb-12 text-base sm:text-lg">
     Experience exceptional dining, entertainment, and hospitality crafted
          to give you comfort, quality, and unforgettable moments.
    </p>

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

              <p className="text-sm text-black/80">
                {service.description}
              </p>
            </div>
          );
        })}
      </div>
      </div>
    </section>
  );
}
