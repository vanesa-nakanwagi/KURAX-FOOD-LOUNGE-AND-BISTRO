
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#7A3EF0",
        yellowPrimary: "#FACC15",
        surface: "#121212"
      },
      fontFamily: {
      serif: ['"Playfair Display"', 'serif'],
    },
    fontFamily: {
      heading: ["Poppins","sans-serif"],
      body: ["Inter","sans-serif"]
    },
    animation:{
      fadeUp:'fadeUp .8s ease forwards'
      },
      keyframes:{
        fadeUp:{
          from:{opacity:0, transform:'translateY(20px)'},
          to:{opacity:1, transform:'translateY(0)'}
        }
      }
    }
  },
  plugins: []
};
