import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import KitchenDisplay from "../Kitchen/KitchenDisplay"; // Adjust path as needed

export default function KitchenRoutes() {
  return (
    <Routes>
      {/* This is the main entry point for the kitchen staff.
        When they go to /kitchen, they see the Live Feed.
      */}
      <Route path="/" element={<KitchenDisplay />} />

      {/* Optional: If you add a 'Past Orders' or 'Inventory' 
        view for the kitchen later, you can add those routes here.
      */}
      {/* <Route path="/history" element={<KitchenHistory />} /> */}

      {/* Redirect any unknown kitchen sub-routes back to the live feed */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}