import React from "react";
import { Routes, Route } from "react-router-dom";

import Dashboard from "../content-creator/pages/Dashboard";
import Menus from "../content-creator/pages/Menus";
import Events from "../content-creator/pages/Events";


export default function StaffRoutes() {
  return (
    <Routes>
      {/* Default page → /content-creator */}
      <Route index element={<Dashboard />} />

      {/* Sub pages */}
      <Route path="menus" element={<Menus />} />
      <Route path="events" element={<Events />} />
    
      {/* Fallback inside staff */}
      <Route path="*" element={<div className="p-10 text-white">Not found</div>} />
    </Routes>
  );
}
