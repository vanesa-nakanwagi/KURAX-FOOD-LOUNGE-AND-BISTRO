import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import StaffLogin from '../auth/StaffLogin'
import Dashboard from '../content-creator/pages/Dashboard'
import Menus from '../content-creator/pages/Menus'
import Events from '../content-creator/pages/Events'

export default function StaffRoutes() {
  return (
    <Routes>
      {/* Staff login */}
      <Route path="" element={<StaffLogin />} />

      {/* Content Creator pages */}
      <Route path="content-creator/dashboard" element={<Dashboard />} />
      <Route path="content-creator/menus" element={<Menus />} />
      <Route path="content-creator/events" element={<Events />} />

      {/* Redirect unknown staff routes */}
      <Route path="*" element={<Navigate to="" />} />
    </Routes>
  )
}
