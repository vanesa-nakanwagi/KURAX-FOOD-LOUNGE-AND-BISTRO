// src/staff/auth/StaffGuard.jsx
import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function StaffGuard({ children, allowedRoles }) {
  const authContext = useContext(AuthContext);

  if (!authContext) {
    console.error(
      "AuthContext is undefined! Did you wrap your app with <AuthProvider>?"
    );
    return <Navigate to="/login" replace />;
  }

  const { user, loading: authLoading } = authContext;
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkStaffRole = async () => {
      if (!user) {
        console.log("No logged-in user. Redirecting to login.");
        setLoading(false);
        setAuthorized(false);
        return;
      }

      console.log("Checking staff role for user ID:", user.id);

      try {
        // 1️⃣ Fetch staff row by auth_user_id
        const { data: staff, error } = await supabase
          .from("kurax-staff")
          .select("id,role,auth_user_id")
          .eq("auth_user_id", user.id)
          .single();

        if (error) {
          console.warn(
            "Staff not found by auth_user_id. Maybe first login or RLS blocked the query.",
            error
          );

          // 2️⃣ Optional: Try fallback by email
          const emailFallback = await supabase
            .from("kurax-staff")
            .select("id,role,auth_user_id")
            .eq("email", user.email.toLowerCase())
            .single();

          if (emailFallback.error || !emailFallback.data) {
            console.error("Staff row not found by email either:", emailFallback.error);
            setAuthorized(false);
            setLoading(false);
            return;
          }

          console.log("Found staff by email. Linking auth_user_id...");
          // Auto-link auth_user_id
          if (!emailFallback.data.auth_user_id) {
            const { error: updateError } = await supabase
              .from("kurax-staff")
              .update({ auth_user_id: user.id })
              .eq("email", user.email.toLowerCase());

            if (updateError) {
              console.error("Failed to link auth_user_id:", updateError);
              setAuthorized(false);
              setLoading(false);
              return;
            }

            console.log("Linked auth_user_id successfully.");
          }

          staff = emailFallback.data; // use fallback data
        }

        // 3️⃣ Role check
        if (staff && allowedRoles.includes(staff.role)) {
          setAuthorized(true);
          console.log("Authorized staff:", staff.role);
        } else {
          console.warn("Staff role not allowed:", staff?.role);
          setAuthorized(false);
        }

        setLoading(false);
      } catch (err) {
        console.error("Unexpected error checking staff role:", err);
        setAuthorized(false);
        setLoading(false);
      }
    };

    if (!authLoading) checkStaffRole();
  }, [authLoading, user, allowedRoles]);

  // Loading state
  if (loading || authLoading) {
    return <div className="text-white p-4">Checking authentication...</div>;
  }

  // Not authorized → redirect
  if (!authorized) {
    return <Navigate to="/login" replace />;
  }

  // Authorized → render children
  return children;
}
