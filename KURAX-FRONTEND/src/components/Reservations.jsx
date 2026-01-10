import { useState } from "react";
import TopSection from "./topSection";
import Footer from "./footerHome";

export default function ReservationsPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    date: "",
    time: "",
    guests: 1,
    instructions: ""
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const newErrors = {};

    // Name
    if (!formData.name.trim()) newErrors.name = "Name is required";

    // Email
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = "Invalid email address";
    }

    // Phone
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^\d{9,15}$/.test(formData.phone)) {
      newErrors.phone = "Enter a valid phone number (9-15 digits)";
    }

    // Date & Time
    if (!formData.date) newErrors.date = "Date is required";
    if (!formData.time) newErrors.time = "Time is required";

    // Guests
    if (!formData.guests || formData.guests < 1 || formData.guests > 20) {
      newErrors.guests = "Guests must be between 1 and 20";
    }

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    alert(`Reservation submitted!\n${JSON.stringify(formData, null, 2)}`);
    setFormData({
      name: "",
      email: "",
      phone: "",
      date: "",
      time: "",
      guests: 1,
      instructions: ""
    });
    setErrors({});
  };

  return (
    <div className="bg-black font-[Outfit] text-white min-h-screen flex flex-col">
      <TopSection searchPlaceholder="Search menu items..." />

      <section className="flex-grow px-4 md:px-16 py-12">
        <h2 className="text-3xl md:text-4xl font-serif mb-6 text-yellow-500 text-center">
          Reserve Your Table
        </h2>
        <p className="text-gray-400 text-center mb-8">
          Book your luxury dining experience at Kurax Food Lounge & Bistro
        </p>

        <form 
          className="max-w-lg mx-auto bg-zinc-900 p-6 rounded-none shadow-lg"
          onSubmit={handleSubmit}
        >
          {/* Full Name */}
          <div className="mb-4">
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Full Name"
              className="w-full px-4 py-3 rounded-none bg-zinc-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Email */}
          <div className="mb-4">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email"
              className="w-full px-4 py-3 rounded-none bg-zinc-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div className="mb-4">
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Phone Number"
              className="w-full px-4 py-3 rounded-none bg-zinc-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
          </div>

          {/* Date & Time */}
<div className="flex flex-col sm:flex-row gap-2 mb-4">
  <div className="flex-1">
    <input
      type="date"
      name="date"
      value={formData.date}
      onChange={handleChange}
      className="w-full px-4 py-3 rounded-none bg-zinc-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-auto"
    />
    {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
  </div>
  <div className="flex-1 mt-2 sm:mt-0">
    <input
      type="time"
      name="time"
      value={formData.time}
      onChange={handleChange}
      className="w-full px-4 py-3 rounded-none bg-zinc-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-auto"
    />
    {errors.time && <p className="text-red-500 text-sm mt-1">{errors.time}</p>}
  </div>
</div>

{/* Number of Guests */}
<div className="mb-4">
  <input
    type="number"
    name="guests"
    min="1"
    max="20"
    value={formData.guests}
    onChange={handleChange}
    placeholder="Number of Guests"
    className="w-full px-4 py-3 rounded-none bg-zinc-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-auto"
  />
  {errors.guests && <p className="text-red-500 text-sm mt-1">{errors.guests}</p>}
</div>

          {/* Special Instructions */}
          <div className="mb-4">
            <textarea
              name="instructions"
              placeholder="Any special requests or notes..."
              value={formData.instructions}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-3 rounded-none bg-zinc-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-yellow-500 text-black font-semibold rounded-none hover:bg-yellow-400 transition"
          >
            Reserve Now
          </button>
        </form>
      </section>

      <Footer />
    </div>
  );
}
