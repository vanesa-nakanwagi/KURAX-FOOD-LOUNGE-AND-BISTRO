import React from "react";
import { Routes, Route } from "react-router-dom";

// Public pages (UNCHANGED)
import HomePage from "./pages/HomePage.jsx";
import MenusPage from "./pages/menuPage.jsx";
import EventsPage from "./pages/eventsPage.jsx";
import ReservationsPage from "./components/reservations/Reservations.jsx";
import WaiterRoutes from "./staff/routes/WaiterRoutes";

// Staff routes
import StaffRoutes from "./staff/routes/StaffRoutes.jsx";
import KitchenRoutes from "./staff/routes/KitchenRoutes";

export default function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<HomePage />} />
      <Route path="/menus" element={<MenusPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/reservations" element={<ReservationsPage />} />

      {/* Staff UI (no login, no auth) */}
      <Route path="/content-creator/*" element={<StaffRoutes />} />
      {/* Waiter Routes - Simplified to one line */}
        <Route path="/staff/waiter/*" element={<WaiterRoutes />} />

      {/* KITCHEN ROUTES */}
          <Route path="/kitchen/*" element={<KitchenRoutes />} />

      {/* Fallback */}
      <Route
        path="*"
        element={<div className="text-center p-10"> Not Found</div>}
      />
    </Routes>
  );
}
