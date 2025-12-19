import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import CustomerDashboard from "./pages/CustomerDashboard.jsx";
import EventsPage from "./components/events"; 
import MenuPage from "./components/menuPage.jsx";

function App() {
  return (
      <Routes>
        <Route path="/" element={<CustomerDashboard />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/menus" element={<MenuPage />} />
        {/* Add more routes like /menus, /reservations */}
      </Routes>
    
  );
}

export default App;
