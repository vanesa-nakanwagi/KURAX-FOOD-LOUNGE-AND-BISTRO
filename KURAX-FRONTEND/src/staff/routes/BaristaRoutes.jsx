import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import BaristaDisplay from "../Barista/BaristaDisplay"; // Adjust path as needed
import DepartmentHod from "../DepartmentHod";
import DepartmentInventory from "../DepartmentInventory";

export default function BaristaRoutes() {
  return (
    <Routes>
      <Route path="hod" element={<DepartmentHod department="barista" />} />
        <Route path="inventory" element={<DepartmentInventory department="barista" />} />
      {/* This renders at the base /barista path */}
      <Route path="/" element={<BaristaDisplay />} />
      
      {/* Redirects any mistyped /barista/* sub-routes back to the main bar feed */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}