import { Routes, Route, Navigate } from "react-router-dom";
import SupervisorLayout from "../Supervisor/components/SupervisorLayout";
import NewOrder from "../Manager/components/NewOrder";
import  PerformanceDashboard from "../Manager/components/PerformanceDashboard";

const SupervisorRoutes = () => {
  return (
    <Routes>
     
      <Route element={<SupervisorLayout />}>
       
        <Route index element={<Navigate to="new-order" replace />} />
        <Route path="new-order" element={<NewOrder />} />
        <Route path="history" element={<PerformanceDashboard />} />

      </Route>
    </Routes>
  );
};

export default SupervisorRoutes;