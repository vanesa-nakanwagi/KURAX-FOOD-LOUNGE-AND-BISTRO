import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import BaristaDisplay from "../Barista/BaristaDisplay"; // Adjust path as needed

export default function BaristaRoutes() {
  return (
    <Routes>
      {/* This renders at the base /barista path */}
      <Route path="/" element={<BaristaDisplay />} />
      
      {/* Redirects any mistyped /barista/* sub-routes back to the main bar feed */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}