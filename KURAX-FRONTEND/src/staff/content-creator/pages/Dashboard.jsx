import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import TopBar from '../components/TopBar'
import Sidebar from '../components/Sidebar'
import StatsCard from '../components/StatsCard'
import { useNavigate } from 'react-router-dom'
import StaffGuard from '../../auth/StaffGuard'

function DashboardContent() {
  const [staff, setStaff] = useState(null)
  const [menusCount, setMenusCount] = useState(0)
  const [eventsCount, setEventsCount] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchStaff = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/login')

      // Fetch staff record
      const { data, error } = await supabase
        .from('kurax-staff')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()
      if (error) return navigate('/login')
      if (data.role !== 'content_creator') return navigate('/login')

      setStaff(data)

      // Fetch counts
      const { count: menuCount } = await supabase
        .from('menus')
        .select('*', { count: 'exact' })
      const { count: eventCount } = await supabase
        .from('events')
        .select('*', { count: 'exact' })
      setMenusCount(menuCount)
      setEventsCount(eventCount)
    }

    fetchStaff()
  }, [])

  if (!staff) return <div className="text-white p-4">Loading...</div>

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar staffName={staff.full_name} />
        <div className="p-6 grid grid-cols-3 gap-6">
          <StatsCard title="Total Menus" value={menusCount} />
          <StatsCard title="Total Events" value={eventsCount} />
        </div>
      </div>
    </div>
  )
}

// Wrap with StaffGuard for role protection
export default function Dashboard() {
  return (
    <StaffGuard allowedRoles={['content_creator']}>
      <DashboardContent />
    </StaffGuard>
  )
}
