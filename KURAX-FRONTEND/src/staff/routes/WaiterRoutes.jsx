import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import WaiterLayout from "../waiter/components/WaiterLayout";
import NewOrder from "../waiter/components/NewOrder";
import OrderHistory from "../waiter/components/OrderHistory";

const WaiterRoutes = () => {
  return (
    <Routes>
      {/* All waiter routes are wrapped in the Layout for the Bottom Nav */}
      <Route element={<WaiterLayout />}>
        {/* Default page when landing on /staff/waiter */}
        <Route index element={<Navigate to="new-order" replace />} />
        
        <Route path="new-order" element={<NewOrder />} />
        <Route path="history" element={<OrderHistory />} />
        
        {/* You can add more waiter specific pages here later */}
        {/* <Route path="profile" element={<WaiterProfile />} /> */}
      </Route>
    </Routes>
  );
};

export default WaiterRoutes;