import React from "react";
import { Routes, Route } from "react-router-dom";

// Public pages
import HomePage from "./pages/HomePage.jsx";
import MenusPage from "./pages/menuPage.jsx";
import EventsPage from "./pages/eventsPage.jsx";
import ReservationsPage from "./components/reservations/Reservations.jsx";


// Staff routes
import StaffRoutes from "./staff/routes/StaffRoutes.jsx";

// Context
import CartProvider from "./components/context/CartContext.jsx";

export default function App() {
  return (
    <CartProvider>
      <Routes>
        {/* Public pages */}
        <Route path="/" element={<HomePage />} />
        <Route path="/menus" element={<MenusPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/reservations" element={<ReservationsPage />} />
      

        {/* Staff routes */}
        <Route path="/login/*" element={<StaffRoutes />} />

        {/* Optional: fallback route */}
        <Route path="*" element={<div className="text-center p-10">Page Not Found</div>} />
      </Routes>
    </CartProvider>
  );
}
