import { Routes, Route, Navigate } from "react-router-dom";
import CashierDashboard from "../cashier/cashierDashboard"; 

export default function CashierRoutes() {
  return (
    <Routes>
      <Route path="/" element={<CashierDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}