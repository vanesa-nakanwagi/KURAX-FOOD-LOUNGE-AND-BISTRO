import React, { useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import logo from "../../assets/images/logo.jpeg";

export default function StaffLogin() {
  const signInWithGoogle = async () => {
    try {
      const redirectUrl = window.location.origin + "/login/content-creator/dashboard";

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUrl },
      });

      if (error) throw error;
    } catch (err) {
      console.error("Login error:", err.message);
      alert("Login failed: " + err.message);
    }
  };

  // Run once to get your Supabase user ID
  useEffect(() => {
    const getUserId = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error(error);
      } else if (user) {
        console.log("Your Supabase user ID is:", user.id);
      }
    };

    getUserId();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black font-[Outfit] text-white px-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <img
            src={logo}
            alt="Kurax Logo"
            className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full mb-4"
          />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-wide">
            KURAX FOOD LOUNGE & BISTRO
          </h1>
          <p className="text-yellow-600 mt-2 text-sm sm:text-base">
            Luxury dining, signature dishes & rooftop vibes
          </p>
        </div>

        {/* Sign in Button */}
        <button
          onClick={signInWithGoogle}
          className="w-full py-3 bg-yellow-600 text-black font-semibold rounded-none hover:bg-yellow-400 transition"
        >
          Sign In with Google
        </button>
      </div>
    </div>
  );
}
