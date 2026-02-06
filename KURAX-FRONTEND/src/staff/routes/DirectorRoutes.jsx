import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DirectorDashboard from '../Director/directorDashboard';

// You can create separate page components if the sections get too large
// For now, we will use the combined Dashboard we built
const DirectorRoutes = () => {
  return (
    <Routes>
      {/* Default path for /director goes to the main dashboard */}
      <Route path="/" element={<DirectorDashboard />} />
      
      {/* You can add more specific sub-routes here if needed in the future */}
      {/* Example: <Route path="reports" element={<DetailedReports />} /> */}
      
      {/* Catch-all: Redirect any unknown /director/* paths back to the dashboard */}
      <Route path="*" element={<Navigate to="/director" replace />} />
    </Routes>
  );
};

export default DirectorRoutes;