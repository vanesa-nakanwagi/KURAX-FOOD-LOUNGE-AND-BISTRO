import HomePage from "./pages/Home.jsx";
import MenusPage from "./pages/menuPage.jsx";
import Hero from "./components/Hero.jsx";
import EventsPage from "./components/events";
import ReservationsPage from "./components/Reservations";
import { Routes, Route } from "react-router-dom";
import CartProvider  from "./components/context/CartContext.jsx"; // Global cart context


export default function App() {
  return (
    <CartProvider>
      {/* All pages wrapped in CartProvider so cart is global */}
      <Routes>
        <Route path="/" element={<Hero />} />   
        <Route path="/home" element={<HomePage />} />       {/* Home */}
        <Route path="/menus" element={<MenusPage />} />    {/* Menu */}
        <Route path="/events" element={<EventsPage />} /> {/* Events */}
        <Route path="/reservations" element={<ReservationsPage />} /> {/* Reservations */}
      </Routes>
    </CartProvider>
  );
}
