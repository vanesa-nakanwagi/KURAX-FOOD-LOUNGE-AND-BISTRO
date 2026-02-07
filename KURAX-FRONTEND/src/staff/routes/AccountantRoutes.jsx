import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AccountantDashboard from '../Accountant/accountantDashboard'; // Adjust path if needed

// You can add more sub-pages here later (e.g., Inventory, PettyCashLogs)
export default function AccountantRoutes() {
  return (
    <Routes>
      {/* Default view for accountant */}
      <Route path="/" element={<AccountantDashboard />} />
      
      {/* Example of a sub-route if you want to separate reconciliation */}
      {/* <Route path="/reconcile" element={<DailyReconciliation />} /> */}

      {/* Catch-all for accountant: Redirect back to their dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}