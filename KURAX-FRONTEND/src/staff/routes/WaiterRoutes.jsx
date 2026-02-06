import { Routes, Route, Navigate } from "react-router-dom";
import WaiterLayout from "../waiter/components/WaiterLayout";
import NewOrder from "../waiter/components/NewOrder";
import OrderHistory from "../waiter/components/OrderHistory";

const WaiterRoutes = () => {
  return (
    <Routes>
     
      <Route element={<WaiterLayout />}>
       
        <Route index element={<Navigate to="new-order" replace />} />
        <Route path="new-order" element={<NewOrder />} />
        <Route path="history" element={<OrderHistory />} />

      </Route>
    </Routes>
  );
};

export default WaiterRoutes;