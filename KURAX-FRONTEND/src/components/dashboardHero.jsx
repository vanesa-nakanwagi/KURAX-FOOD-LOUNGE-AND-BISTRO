import { ChevronLeft, ChevronRight } from "lucide-react";
import { menuItems } from "../data/menuItems";

export default function DashboardHero() {
  return (
    // SECTION: reduce padding on mobile
    <section className="px-4 md:px-10 py-10 md:py-14">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <h2 className="text-2xl md:text-3xl font-serif">
          Explore Our Menu
        </h2>

        <button className="self-start md:self-auto bg-yellow-500 hover:bg-yellow-400 text-black px-5 py-2 rounded-none text-sm font-medium">
          VIEW ALL MENUS
        </button>
      </div>

      <div className="relative">

        {/* LEFT ARROW — hide on mobile */}
        <button className="hidden md:flex absolute -left-6 top-1/2 -translate-y-1/2 bg-white/10 p-3 rounded-full">
          <ChevronLeft />
        </button>

        {/* MENU GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {menuItems.map((item, i) => (
            <div
              key={i}
              className="bg-zinc-900 rounded-none overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300"
            >
              {/* IMAGE HEIGHT FIX */}
              <img
                src={item.image}
                alt={item.title}
                className="h-56 md:h-48 w-full object-cover"
              />

              <div className="p-5 space-y-2">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.desc}</p>

                <div className="flex items-center justify-between pt-4">
                  <span className="text-yellow-400 font-semibold">
                    {item.price}
                  </span>

                  <button className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-1.5 rounded-none text-sm font-medium">
                    Order Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT ARROW — hide on mobile */}
        <button className="hidden md:flex absolute -right-6 top-1/2 -translate-y-1/2 bg-white/10 p-3 rounded-full">
          <ChevronRight />
        </button>
      </div>
    </section>
  );
}
