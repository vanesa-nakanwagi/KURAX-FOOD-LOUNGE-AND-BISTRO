import React from 'react'
import { NavLink } from 'react-router-dom'

export default function Sidebar() {
  return (
    <div className="w-64 bg-gray-900 text-white h-screen p-4">
      <nav className="flex flex-col space-y-4">
        <NavLink to="/staff/content-creator/dashboard" className="hover:text-purple-400">
          Dashboard
        </NavLink>
        <NavLink to="/staff/content-creator/menus" className="hover:text-purple-400">
          Menus
        </NavLink>
        <NavLink to="/staff/content-creator/events" className="hover:text-purple-400">
          Events
        </NavLink>
      </nav>
    </div>
  )
}
