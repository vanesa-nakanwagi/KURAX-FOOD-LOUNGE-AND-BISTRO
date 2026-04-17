import { Routes, Route, Navigate } from "react-router-dom";
import ManagerLayout from "../Manager/components/ManagerLayout";
import NewOrder from "../Manager/components/NewOrder";
import PerformanceDashboard from "../Manager/components/PerformanceDashboard";

const ManagerRoutes = () => {
  return (
    <Routes>
     
      <Route element={<ManagerLayout />}>
       
        <Route index element={<Navigate to="new-order" replace />} />
        <Route path="new-order" element={<NewOrder />} />
        <Route path="history" element={<PerformanceDashboard />} />

      </Route>
    </Routes>
  );
};

export default ManagerRoutes;