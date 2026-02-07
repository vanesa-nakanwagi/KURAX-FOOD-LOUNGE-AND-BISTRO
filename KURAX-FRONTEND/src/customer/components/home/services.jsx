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
    <section className="w-full bg-slate-50 px-6 py-24">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-20">
          <p className="text-yellow-800 uppercase text-bg mb-2 tracking-wide">

PREMIUM SERVICES

</p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-6">
            Come. Live. Enjoy.
          </h2>
          <div className="w-20 h-1.5 bg-yellow-500 mx-auto rounded-full mb-8"></div>
          <p className="text-slate-600 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
            Experience exceptional dining, entertainment, and hospitality crafted
            to give you comfort, quality, and unforgettable moments.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service, index) => {
            const Icon = service.icon;

            return (
              <div
                key={index}
                className="group bg-white border border-slate-200 rounded-3xl p-8 text-center hover:bg-white hover:shadow-2xl hover:shadow-yellow-500/10 hover:-translate-y-3 transition-all duration-500"
              >
                {/* Icon Container with Glow */}
                <div className="relative w-20 h-20 bg-yellow-50 rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:bg-yellow-900 transition-colors duration-500">
                  <Icon className="w-10 h-10 text-yellow-700 group-hover:text-white transition-colors duration-500" />
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-4 group-hover:text-yellow-600 transition-colors">
                  {service.title}
                </h3>

                <p className="text-sm text-slate-500 leading-relaxed font-medium">
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