import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import BarmanDisplay from "../Barman/BarmanDisplay"; // Adjust path as needed
import DepartmentHod from "../DepartmentHod";
import DepartmentInventory from "../DepartmentInventory";

export default function BarmanRoutes() {
  return (
    <Routes>
      <Route path="hod" element={<DepartmentHod department="bar" />} />
        <Route path="inventory" element={<DepartmentInventory department="bar" />} />
      {/* This renders at the base /barman path */}
      <Route path="/" element={<BarmanDisplay />} />
      
      {/* Redirects any mistyped /barman/* sub-routes back to the main bar feed */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}