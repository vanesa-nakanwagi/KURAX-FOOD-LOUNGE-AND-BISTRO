export default function HeroSection() {
  const heroImg = "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1600&q=80"; // luxury lounge

  return (
    <section className="relative w-full h-[300px] md:h-[500px]">
      <img
        src={heroImg}
        alt="Kurax Lounge Hero"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/50 flex flex-col justify-center items-center text-center px-4">
        <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
          Luxury dining, signature drinks & rooftop vibes
        </h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <button className="px-6 py-2 rounded-none bg-transparent border border-yellow-500 text-yellow-500 font-semibold hover:bg-yellow-500 hover:text-black transition">
            View Menu
          </button>
          <button className="px-6 py-2 rounded-none bg-transparent border border-yellow-500 text-yellow-500 font-semibold hover:bg-yellow-500 hover:text-black transition">
            Reserve Table
          </button>
        </div>
      </div>
    </section>
  );
}
