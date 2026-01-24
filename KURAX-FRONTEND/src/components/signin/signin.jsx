import { useState } from "react";
import logo from "../../assets/images/logo.jpeg";
export default function Signin () {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = "Invalid email address";
    

    if (!formData.password.trim()) newErrors.password = "Password is required";
    else if (!/^\S+@\S+\.\S+$/.test(formData.password)) newErrors.password = "Wrong password";

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    
    setFormData({
      email: "",
      password: "",
    });
    setErrors({});
  };

  return (
    <div className="min-h-screen font-[Outfit] flex flex-col bg-white text-black dark:bg-black dark:text-white transition-colors duration-300">
  

      <section className="flex-grow px-4 md:px-16 py-12">
      {/* Logo */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <img
                  src={logo}
                  alt="Kurax Logo"
                  className="w-12 h-12 rounded-full object-cover"
                />
      </div>
        <h2 className="text-3xl md:text-4xl font-serif mb-6 text-yellow-500 text-center">
          KURAX FOOD LOUNGE & BISTRO
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
         Luxury dining, Signiture dishes & rooftop vibes.
        </p>

        <form 
          className="max-w-lg mx-auto bg-gray-100 dark:bg-zinc-900 p-6 rounded-none shadow-lg transition-colors duration-300"
          onSubmit={handleSubmit}
        >

          {/* Email */}
          <div className="mb-4">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email"
              className="w-full px-4 py-3 rounded-none bg-gray-200 dark:bg-zinc-800 text-black dark:text-white border border-gray-400 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          {/* Password */}
          <div className="mb-4">
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Password"
              className="w-full px-4 py-3 rounded-none bg-gray-200 dark:bg-zinc-800 text-black dark:text-white border border-gray-400 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
          </div>


          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3 bg-yellow-500 text-black font-semibold rounded-none hover:bg-yellow-400 transition"
          >
            Sign In
          </button>

          
        </form>
      </section>

    </div>
  );
}
