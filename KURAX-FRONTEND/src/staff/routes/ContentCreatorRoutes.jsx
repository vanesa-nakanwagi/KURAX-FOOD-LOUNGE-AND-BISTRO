import { Routes, Route } from "react-router-dom";
import Dashboard from "../content-creator/pages/Dashboard";
import Menus from "../content-creator/pages/Menus";
import Combos from "../content-creator/pages/Combos";
import Events from "../content-creator/pages/Events";


export default function ContentCreatorRoutes() {
  return (
    <Routes>
     
      <Route index element={<Dashboard />} />
      <Route path="menus" element={<Menus />} />
      <Route path="combos" element={<Combos />} />
      <Route path="events" element={<Events />} />
      <Route path="*" element={<div className="p-10 text-white">Not found</div>} />

    </Routes>
  );
}
