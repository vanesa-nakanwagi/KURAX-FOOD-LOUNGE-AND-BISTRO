
import { Routes, Route } from "react-router-dom";
import HomePage from "./customer/pages/HomePage.jsx";
import MenusPage from "./customer/pages/menuPage.jsx";
import EventsPage from "./customer/pages/eventsPage.jsx";
import ReservationsPage from "./customer/components/reservations/Reservations.jsx";

import WaiterRoutes from "./staff/routes/WaiterRoutes";
import ContentCreatorRoutes from "./staff/routes/ContentCreatorRoutes.jsx";
import KitchenRoutes from "./staff/routes/KitchenRoutes";
import CashierRoutes from "./staff/routes/CashierRoutes.jsx";
export default function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<HomePage />} />
      <Route path="/menus" element={<MenusPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/reservations" element={<ReservationsPage />} />

     
        <Route path="/content-creator/*" element={<ContentCreatorRoutes />} />
      {/* Waiter Routes - Simplified to one line */}
        <Route path="/staff/waiter/*" element={<WaiterRoutes />} />

      {/* KITCHEN ROUTES */}
          <Route path="/kitchen/*" element={<KitchenRoutes />} />
      {/* In your main App.jsx Routes block */}
          <Route path="/cashier/*" element={<CashierRoutes />} />

      {/* Fallback */}
      <Route
        path="*"
        element={<div className="text-center p-10"> Not Found</div>}
      />
    </Routes>
  );
}
