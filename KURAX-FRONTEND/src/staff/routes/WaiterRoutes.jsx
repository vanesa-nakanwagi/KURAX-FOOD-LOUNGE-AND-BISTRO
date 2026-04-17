import { Routes, Route, Navigate } from "react-router-dom";
import WaiterLayout from "../waiter/components/WaiterLayout";
import NewOrder from "../waiter/components/NewOrder";
import PerformanceDashboard from "../waiter/components/PerformanceDashboard";

const WaiterRoutes = () => {
  return (
    <Routes>
     
      <Route element={<WaiterLayout />}>
       
        <Route index element={<Navigate to="new-order" replace />} />
        <Route path="new-order" element={<NewOrder />} />
        <Route path="history" element={<PerformanceDashboard />} />

      </Route>
    </Routes>
  );
};

export default WaiterRoutes;