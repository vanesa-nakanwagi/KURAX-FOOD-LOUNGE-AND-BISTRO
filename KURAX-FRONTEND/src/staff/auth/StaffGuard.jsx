import { useContext } from 'react'
import { AuthContext } from '../../context/AuthContext'
import { Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function StaffGuard({ children, allowedRoles }) {
  const { user, loading: authLoading } = useContext(AuthContext)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    if (authLoading) return

    const checkStaffRole = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      const { data: staff, error } = await supabase
        .from('kurax-staff')
        .select('role')
        .eq('auth_user_id', user.id)
        .single()

      if (staff && allowedRoles.includes(staff.role)) {
        setAuthorized(true)
      }

      setLoading(false)
    }

    checkStaffRole()
  }, [authLoading, user])

  if (loading || authLoading) {
    return <div className="text-white p-4">Checking authentication...</div>
  }

  if (!authorized) {
    return <Navigate to="/login" replace />
  }

  return children
}
