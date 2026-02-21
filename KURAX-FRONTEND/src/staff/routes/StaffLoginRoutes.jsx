import React from 'react';
import { Routes, Route } from 'react-router-dom';
// IMPORTANT: Make sure this points to your UI file (StaffLogin.jsx)
// If StaffLogin.jsx is in the folder above, use '../StaffLogin'
import StaffLogin from '../StaffLogin'; 

const StaffRoutes = () => {
  return (
    <Routes>
      {/* This renders the login UI when the URL is /staff/login */}
      <Route path="/" element={<StaffLogin />} />
    </Routes>
  );
};

export default StaffRoutes;