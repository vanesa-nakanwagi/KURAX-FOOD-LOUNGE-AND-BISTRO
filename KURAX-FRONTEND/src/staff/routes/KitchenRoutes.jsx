
import { Routes, Route, Navigate } from "react-router-dom";
import KitchenDisplay from "../Kitchen/KitchenDisplay"; 
import DepartmentHod from "../DepartmentHod";

export default function KitchenRoutes() {
  return (
    <Routes>
      <Route path="hod" element={<DepartmentHod department="kitchen" />} />
      <Route path="/" element={<KitchenDisplay />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}