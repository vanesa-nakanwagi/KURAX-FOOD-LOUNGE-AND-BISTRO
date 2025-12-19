import { ChevronLeft, ChevronRight } from "lucide-react";
import { menuItems } from "../data/menuItems";

export default function DashboardHero({ menuItems }) {
  return (
    <section className="px-10 py-14">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-serif">Explore Our Menu</h2>
        <button className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-2 rounded-full text-sm font-medium">
          VIEW ALL MENUS
        </button>
      </div>

      <div className="relative">
        <button className="absolute -left-6 top-1/2 -translate-y-1/2 bg-white/10 p-3 rounded-full">
          <ChevronLeft />
        </button>

        <div className="grid grid-cols-4 gap-6">
          {menuItems.map((item, i) => (
            <div key={i} className="bg-zinc-900 rounded-xl overflow-hidden shadow-lg">
              <img src={item.image} alt={item.title} className="h-48 w-full object-cover" />
              <div className="p-5 space-y-2">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.desc}</p>
                <div className="flex items-center justify-between pt-4">
                  <span className="text-yellow-400 font-semibold">{item.price}</span>
                  <button className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-1.5 rounded-full text-sm font-medium">
                    0rder Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="absolute -right-6 top-1/2 -translate-y-1/2 bg-white/10 p-3 rounded-full">
          <ChevronRight />
        </button>
      </div>
    </section>
  );
}
