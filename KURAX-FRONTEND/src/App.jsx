import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import CustomerDashboard from "./pages/CustomerDashboard.jsx";
import EventsPage from "./components/events"; 
import MenuPage from "./components/menuPage.jsx";
import Home from "./pages/Home.jsx";

function App() {
  return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/menus" element={<MenuPage />} />
        <Route path="/home" element={<CustomerDashboard/>} />
        {/* Add more routes like /menus, /reservations */}
      </Routes>
    
  );
}

export default App;
