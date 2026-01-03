import logo from "../assets/images/logo.jpeg";

export default function About() {
  return (
    <section className="relative py-16 px-4 sm:px-6 md:px-8 max-w-5xl mx-auto text-center overflow-hidden">
      
      {/* Background watermark/logo */}
      <div
        className="absolute inset-0 bg-center bg-no-repeat opacity-10 pointer-events-none"
        style={{
          backgroundImage: `url(${logo})`,
          backgroundSize: "20%", // smaller on mobile
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        <h2 className="font-heading text-2xl sm:text-3xl md:text-3xl font-bold mb-4">
          About Us
        </h2>

        <p className="text-gray-400 text-sm sm:text-base md:text-base max-w-3xl mx-auto leading-relaxed">
          A modern rooftop lounge on Kisaasi–Kyanja Road offering great food,
          drinks, music and unforgettable vibes.
        </p>
      </div>
    </section>
  );
}
