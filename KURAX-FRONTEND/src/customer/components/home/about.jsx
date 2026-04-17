import { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";

// ─── Mock hero images ────────────────────────────────────────────────────────
const heroImages = [
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=80",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=80",
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=900&q=80",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&q=80",
  "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=900&q=80",
  "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=900&q=80",
];

// ─── Stat item ────────────────────────────────────────────────────────────────
function StatItem({ value, label, delay }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative flex flex-col items-center justify-center gap-1 cursor-default flex-1 py-1"
    >
      <motion.p
        className="text-5xl md:text-6xl font-black tracking-tight"
        style={{
          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 40%, #fde68a 70%, #b45309 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
        whileHover={{ scale: 1.06 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        {value}
      </motion.p>
      <p className="text-sm uppercase tracking-[0.2em] text-white/50 font-medium text-center">
        {label}
      </p>
    </motion.div>
  );
}

// ─── Main About component ─────────────────────────────────────────────────────
export default function About() {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const sectionRef = useRef(null);

  // Parallax
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  // Auto-advance slider
  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % heroImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isHovered]);

  const headingRef = useRef(null);
  const headingInView = useInView(headingRef, { once: true, margin: "-80px" });
  const textRef = useRef(null);
  const textInView = useInView(textRef, { once: true, margin: "-60px" });

  return (
    <div
      ref={sectionRef}
      className="relative text-white min-h-screen font-[Outfit] pt-20 md:pt-28 pb-24 overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #0a0a0a 0%, #111111 50%, #0f0d0a 100%)",
      }}
    >
      {/* Ambient background orbs */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full opacity-[0.07]"
        style={{
          background: "radial-gradient(circle, #d97706, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full opacity-[0.06]"
        style={{
          background: "radial-gradient(circle, #b45309, transparent 70%)",
          filter: "blur(100px)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 lg:px-20">
        {/* Section eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="flex items-center gap-4 mb-6"
        >
          <span className="block w-10 h-px bg-gradient-to-r from-yellow-500 to-transparent" />
          <p
            className="text-xs font-bold tracking-[0.35em] uppercase"
            style={{
              background: "linear-gradient(90deg, #f59e0b, #fde68a)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            About Kurax
          </p>
        </motion.div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* LEFT: Text column */}
          <div className="flex flex-col">
            <div ref={headingRef}>
              <motion.h1
                initial={{ opacity: 0, y: 40 }}
                animate={headingInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="text-5xl md:text-6xl lg:text-[3.75rem] font-extrabold leading-[1.1] tracking-tight mb-10"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                Where Tradition Meets{" "}
                <span
                  style={{
                    background: "linear-gradient(135deg, #f59e0b 0%, #fde68a 45%, #d97706 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Modern Luxury
                </span>
              </motion.h1>
            </div>

            <div ref={textRef}>
              <motion.p
                initial={{ opacity: 0, y: 28 }}
                animate={textInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
                className="text-base md:text-md leading-relaxed text-white/65 mb-6 max-w-md"
              >
                Kurax Food Lounge &amp; Bistro is a celebration of culture, flavor, and
                elevated dining. Located in the heart of Kyanja, we blend Uganda's rich
                culinary traditions with sophisticated presentation and ambiance.
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 28 }}
                animate={textInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.8, delay: 0.28, ease: "easeOut" }}
                className="text-base md:text-lg leading-relaxed text-white/65 mb-12 max-w-md"
              >
                From signature dishes to rooftop vibes, Kurax is where food, community,
                and unforgettable moments converge.
              </motion.p>

              {/* Thin gold divider */}
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={textInView ? { scaleX: 1, opacity: 1 } : {}}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="origin-left mb-12 w-24 h-px"
                style={{
                  background: "linear-gradient(90deg, #d97706, transparent)",
                }}
              />

              {/* Stats - Naked Layout */}
              <div className="flex flex-row flex-nowrap items-center gap-8 py-4">
                <StatItem value="500+" label="Happy Clients" delay={0.5} />
                <div className="w-px h-10 bg-white/10" />
                <StatItem value="15+" label="Signature Dishes" delay={0.65} />
                <div className="w-px h-10 bg-white/10" />
                <StatItem value="4+" label="Years of Excellence" delay={0.8} />
              </div>
            </div>
          </div>

          {/* RIGHT: Image slider */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative mt-8 lg:mt-0"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div
              className="absolute -inset-[2px] opacity-40 pointer-events-none"
              style={{
                background: "linear-gradient(135deg, rgba(202,138,4,0.6), transparent 60%, rgba(180,83,9,0.4))",
                filter: "blur(1px)",
              }}
            />

            <div className="relative overflow-hidden shadow-2xl h-[480px]">
              <motion.div
                style={{ y: imageY }}
                className="absolute inset-0 w-full h-[110%] -top-[5%]"
              >
                {heroImages.map((img, index) => (
                  <motion.div
                    key={index}
                    className="absolute inset-0 bg-center bg-cover"
                    style={{ backgroundImage: `url(${img})` }}
                    animate={{
                      opacity: index === current ? 1 : 0,
                      scale: index === current ? 1.04 : 1,
                    }}
                    transition={{
                      opacity: { duration: 1.4, ease: "easeInOut" },
                      scale: { duration: 7, ease: "linear" },
                    }}
                  />
                ))}
              </motion.div>

              {/* Overlays */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/10 to-black/60" />

              {/* Caption */}
              <div className="absolute bottom-0 left-0 right-0 p-8 text-center">
                <p className="text-white text-lg md:text-xl font-serif italic tracking-wide opacity-90">
                  "Experience the essence of Uganda"
                </p>
              </div>

              {/* Indicators */}
              <div className="absolute top-6 right-6 flex gap-2">
                {heroImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className="transition-all duration-500 rounded-full h-1.5"
                    style={{
                      width: i === current ? "24px" : "6px",
                      background: i === current ? "#f59e0b" : "rgba(255,255,255,0.3)",
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}