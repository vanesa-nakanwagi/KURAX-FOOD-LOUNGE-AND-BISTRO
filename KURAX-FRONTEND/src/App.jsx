
import MenusPage from "./pages/menuPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import EventsPage from "./pages/eventsPage";
import ReservationsPage from "./components/reservations/Reservations" ;
import Signin from  "./components/signin/signin"
import { Routes, Route } from "react-router-dom";
import CartProvider  from "./components/context/CartContext.jsx"; 


export default function App() {
  return (
    <CartProvider>
      {/* All pages wrapped in CartProvider so cart is global */}
      <Routes>
         <Route path="/" element={<HomePage />} />
        <Route path="/signin" element={<Signin />} />   
        <Route path="/menus" element={<MenusPage />} />    {/* Menu */}
        <Route path="/events" element={<EventsPage />} /> {/* Events */}
        <Route path="/reservations" element={<ReservationsPage />} /> {/* Reservations */}
      
      </Routes>
    </CartProvider>
  );
}
