export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#7A3EF0",
        yellowPrimary: "#FACC15",
        surface: "#121212",
      },

      fontFamily: {
        heading: ["Poppins", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },

      keyframes: {
        zoomOut: {
          "0%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)" },
        },
        fadeUp: {
          "0%": { opacity: 0, transform: "translateY(20px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },

      animation: {
        zoomOut: "zoomOut 6s ease-out forwards",
        fadeUp: "fadeUp .8s ease forwards",
      },
    },
  },
  plugins: [],
};
