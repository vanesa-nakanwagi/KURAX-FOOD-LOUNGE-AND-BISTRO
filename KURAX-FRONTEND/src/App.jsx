import { Routes, Route, Navigate } from "react-router-dom";
import ScrollToHash from "./customer/components/home/ScrollToHash";
// Public Pages
import HomePage from "./customer/pages/HomePage.jsx";
import MenusPage from "./customer/pages/menuPage.jsx";
import EventsPage from "./customer/pages/eventsPage.jsx";
import ReservationsPage from "./customer/components/reservations/Reservations.jsx";

// Staff & Admin Routes
import WaiterRoutes from "./staff/routes/WaiterRoutes";
import ContentCreatorRoutes from "./staff/routes/ContentCreatorRoutes.jsx";
import KitchenRoutes from "./staff/routes/KitchenRoutes";
import CashierRoutes from "./staff/routes/CashierRoutes.jsx";
import DirectorRoutes from "./staff/routes/DirectorRoutes.jsx"; 
import AccountantRoutes from "./staff/routes/AccountantRoutes.jsx";
import ManagerRoutes from "./staff/routes/ManagerRoutes.jsx";
import BarmanRoutes from "./staff/routes/BarmanRoutes";
import BaristaRoutes from "./staff/routes/BaristaRoutes"; 
import SupervisorRoutes from "./staff/routes/SupervisorRoutes";
import StaffRoutes from './staff/routes/StaffLoginRoutes';
import NewOrder  from './staff/waiter/components/NewOrder.jsx';

export default function App() {
  return (
    <>
    <ScrollToHash />
    <Routes>
      {/* --- PUBLIC CUSTOMER PAGES --- */}
      <Route path="/" element={<HomePage />} />
      <Route path="/menus" element={<MenusPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/reservations" element={<ReservationsPage />} />
      // Look for this in App.jsx
<Route path="/staff/waiter/menu" element={<NewOrder />} /> 

      {/* --- STAFF DIRECT URL ACCESS --- */}

      {/* Staff Section - This matches /staff/login */}
        <Route path="/staff/login/*" element={<StaffRoutes />} />
      

      {/* --- ROLE-BASED STAFF ROUTES --- */}
      {/* DIRECTOR (Overall Overseer) */}
      <Route path="/director/*" element={<DirectorRoutes />} />

      {/* CASHIER (Payments & Revenue) */}
      <Route path="/cashier/*" element={<CashierRoutes />} />

      {/* WAITER (Table Management) */}
      <Route path="/staff/waiter/*" element={<WaiterRoutes />} />


      {/* MANAGER (Table Management) */}
      <Route path="/staff/manager/*" element={<ManagerRoutes />} />

      <Route path="/supervisor/*" element={<SupervisorRoutes />} />

      <Route path="/accountant/*" element={<AccountantRoutes />} />

      {/* KITCHEN (Chef & Food Prep) */}
      <Route path="/kitchen/*" element={<KitchenRoutes />} />
       
      {/* BARMAN */}
      <Route path="/barman/*" element={<BarmanRoutes />} />

        {/* BARISTA */}
      <Route path="/barista/*" element={<BaristaRoutes />} />

      {/* CONTENT CREATOR (Socials & Menus) */}
      <Route path="/content-creator/*" element={<ContentCreatorRoutes />} />

      {/* --- FALLBACKS --- */}
      <Route
        path="*"
        element={
          <div className="h-screen bg-black flex flex-col items-center justify-center text-white font-[Outfit]">
            <h1 className="text-4xl font-black italic text-yellow-500">404</h1>
            <p className="opacity-50 uppercase tracking-widest text-xs mt-2">Page Not Found</p>
            <button 
              onClick={() => window.location.href = '/'}
              className="mt-6 px-6 py-2 border border-white/10 rounded-full text-[10px] font-black uppercase hover:bg-white/5"
            >
              Back to Kurax
            </button>
          </div>
        }
      />
    </Routes>
    </>
  );
}