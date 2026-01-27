import React from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function TopBar({ staffName }) {
  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/staff/login'
  }

  return (
    <div className="flex justify-between items-center p-4 bg-gray-800 text-white">
      <h2 className="text-xl font-semibold">Hello, {staffName}</h2>
      <button onClick={logout} className="bg-red-600 px-4 py-2 rounded hover:bg-red-700">
        Logout
      </button>
    </div>
  )
}
