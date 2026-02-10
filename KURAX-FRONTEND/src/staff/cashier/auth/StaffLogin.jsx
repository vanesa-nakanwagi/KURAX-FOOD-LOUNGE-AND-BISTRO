// src/staff/auth/StaffLogin.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import logo from "../../assets/images/logo.jpeg";

export default function StaffLogin() {
  const navigate = useNavigate();

  const signInWithGoogle = async () => {
    const redirectUrl = window.location.origin + "/login/content-creator/dashboard";

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl },
    });

    if (error) {
      console.error("Login error:", error.message);
      alert("Login failed: " + error.message);
    }
  };

 
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      const user = session.user;
      const email = user.email.toLowerCase();

      // 1. Check staff table
      const { data: staff, error: staffError } = await supabase
        .from("kurax-staff")
        .select("*")
        .eq("email", email)
        .single();

      if (staffError || !staff) {
        console.error("Staff record not found for:", email);
        await supabase.auth.signOut();
        alert("You are not registered in the staff system.");
        return;
      }

      // 2. Link if necessary
      if (!staff.auth_user_id) {
        const { error: updateError } = await supabase
          .from("kurax-staff")
          .update({ auth_user_id: user.id })
          .eq("email", email);

        if (updateError) {
          console.error("Update error:", updateError);
          return;
        }
      }

      // 3. Final Role Check & Redirect
      const allowedRoles = ["content_creator", "staff"];
      if (allowedRoles.includes(staff.role)) {
        navigate("/login/content-creator/dashboard");
      } else {
        alert("Unauthorized role: " + staff.role);
        await supabase.auth.signOut();
      }
    }
  });

  return () => subscription.unsubscribe();
}, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black font-[Outfit] text-white px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={logo}
            alt="Kurax Logo"
            className="w-14 h-14 mx-auto rounded-full mb-4"
          />
          <h1 className="text-2xl font-bold">KURAX FOOD LOUNGE & BISTRO</h1>
          <p className="text-yellow-600 mt-2 text-sm">
            Luxury dining, signature dishes & rooftop vibes
          </p>
        </div>

        <button
          onClick={signInWithGoogle}
          className="w-full py-3 bg-yellow-600 text-black font-semibold hover:bg-yellow-400 transition"
        >
          Sign In with Google
        </button>
      </div>
    </div>
  );
}
