import HomePage from "./pages/Home.jsx";
import MenuPage from "./components/menuPage";
import EventsPage from "./components/events";
import ReservationsPage from "./components/Reservations";
import { Routes, Route } from "react-router-dom"; // no BrowserRouter here

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />          {/* Home */}
      <Route path="/menus" element={<MenuPage />} />    {/* Menu */}
      <Route path="/events" element={<EventsPage />} /> {/* Events */}
      <Route path="/reservations" element={<ReservationsPage />} /> {/* Reservations */}
    </Routes>
  );
}
