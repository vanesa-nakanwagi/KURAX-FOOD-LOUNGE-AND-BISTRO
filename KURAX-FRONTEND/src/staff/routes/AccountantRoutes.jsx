import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AccountantLayout from '../Accountant/AccountantLayout';

export default function AccountantRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AccountantLayout />} />
      <Route path="inventory/*" element={<AccountantLayout />} />
      <Route path="*" element={<Navigate to="/accountant" replace />} />
    </Routes>
  );
}