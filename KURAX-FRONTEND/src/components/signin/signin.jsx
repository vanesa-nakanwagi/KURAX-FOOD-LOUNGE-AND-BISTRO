import { useState } from "react";
import logo from "../../assets/images/logo.jpeg";

export default function Signin() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showReset, setShowReset] = useState(false); 
  const [resetEmail, setResetEmail] = useState("");
  const [resetErrors, setResetErrors] = useState({});
  const [resetSuccess, setResetSuccess] = useState(false);

  // --- Sign In Handlers ---
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const validateSignIn = () => {
    const newErrors = {};
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = "Invalid email address";
    if (!formData.password.trim()) newErrors.password = "Password is required";
    return newErrors;
  };

  const handleSignInSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validateSignIn();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    console.log("Signing in:", formData, "Remember me:", rememberMe);
    setFormData({ email: "", password: "" });
    setErrors({});
  };

  // --- Reset Password Handlers ---
  const handleResetChange = (e) => setResetEmail(e.target.value);

  const validateReset = () => {
    const newErrors = {};
    if (!resetEmail.trim()) newErrors.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(resetEmail)) newErrors.email = "Invalid email address";
    return newErrors;
  };

  const handleResetSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validateReset();
    if (Object.keys(validationErrors).length > 0) {
      setResetErrors(validationErrors);
      return;
    }
    console.log("Reset link sent to:", resetEmail);
    setResetSuccess(true);
    setResetErrors({});
  };

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

       

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 bg-yellow-600 text-black font-semibold rounded-none hover:bg-yellow-400 transition"
            >
              Sign In with Google
            </button>

      </div>
    </div>
  );
}
