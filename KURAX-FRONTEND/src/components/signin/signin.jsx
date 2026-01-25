import { useState } from "react";
import logo from "../../assets/images/logo.jpeg";

export default function Signin() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showReset, setShowReset] = useState(false); // Reset modal toggle
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
          <img src={logo} alt="Kurax Logo" className="w-16 h-16 mx-auto rounded-full mb-4" />
          <h1 className="text-3xl font-bold text-white-500">KURAX FOOD LOUNGE & BISTRO</h1>
          <p className="text-yellow-600 mt-2">Luxury dining, signature dishes & rooftop vibes</p>
        </div>

        {/* Sign In Form */}
        {!showReset && (
          <form className="space-y-6" onSubmit={handleSignInSubmit}>

            {/* Email */}
            <div className="relative z-0 w-full">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder=" "
                autoComplete="off"
                className="block w-full px-0 pt-5 pb-2 text-white bg-transparent border-b-2 border-gray-600 focus:outline-none focus:border-yellow-500 peer appearance-none"
              />
              <label className="absolute text-gray-500 duration-300 transform -translate-y-3 scale-75 top-2 left-0
                peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-5
                peer-placeholder-shown:text-gray-400 peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-yellow-500 text-sm">
                Email
              </label>
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>

            {/* Password with eye toggle */}
            <div className="relative z-0 w-full">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder=" "
                autoComplete="off"
                className="block w-full px-0 pt-5 pb-2 text-white bg-transparent border-b-2 border-gray-600 focus:outline-none focus:border-yellow-500 peer appearance-none"
              />
              <label className="absolute text-gray-500 duration-300 transform -translate-y-3 scale-75 top-2 left-0
                peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-5
                peer-placeholder-shown:text-gray-400 peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-yellow-500 text-sm">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 bottom-1 text-gray-400 hover:text-yellow-500 transition px-2"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7c1.657 0 3.183.504 4.475 1.357m1.685 1.685A9.969 9.969 0 0121 12c0 1.657-.504 3.183-1.357 4.475M3 3l18 18"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                )}
              </button>
              {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
            </div>

            {/* Remember Me */}
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                className="h-4 w-4 text-yellow-500 focus:ring-yellow-400 border-gray-600 rounded"
              />
              <label htmlFor="rememberMe" className="ml-2 text-gray-400 text-sm select-none">
                Remember me
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 bg-yellow-600 text-black font-semibold rounded-none hover:bg-yellow-400 transition"
            >
              Continue
            </button>

            {/* Forgot Password */}
            <p className="text-gray-400 text-sm text-center mt-2 cursor-pointer hover:text-yellow-500"
              onClick={() => setShowReset(true)}>
              Forgot your password?
            </p>
          </form>
        )}

        {/* Reset Password Modal */}
        {showReset && (
          <form className="space-y-6 bg-black p-4 rounded-none" onSubmit={handleResetSubmit}>
            <h2 className="text-xl text-yellow-600 font-semibold text-center mb-4">Reset Password</h2>

            <div className="relative z-0 w-full">
              <input
                type="email"
                name="resetEmail"
                value={resetEmail}
                onChange={handleResetChange}
                placeholder=" "
                autoComplete="off"
                className="block w-full px-0 pt-5 pb-2 text-white bg-transparent border-b-2 border-gray-600 focus:outline-none focus:border-yellow-500 peer appearance-none"
              />
              <label className="absolute text-gray-500 duration-300 transform -translate-y-3 scale-75 top-2 left-0
                peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-5
                peer-placeholder-shown:text-gray-400 peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-yellow-500 text-sm">
                Email
              </label>
              {resetErrors.email && <p className="text-red-500 text-sm mt-1">{resetErrors.email}</p>}
            </div>

            <button type="submit" className="w-full py-3 bg-yellow-600 text-black font-semibold rounded-none hover:bg-yellow-400 transition">
              Send Reset Link
            </button>

            {resetSuccess && <p className="text-white-500 text-sm text-center mt-2">Reset link sent! Check your email.</p>}

            <p className="text-gray-400 text-sm text-center mt-2 cursor-pointer hover:text-yellow-500"
              onClick={() => setShowReset(false)}>
              Back to Sign In
            </p>
          </form>
        )}

      </div>
    </div>
  );
}
