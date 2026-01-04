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
    guests: 1
  });

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`Reservation submitted!\n${JSON.stringify(formData, null, 2)}`);
    // TODO: connect to backend or API
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
          className="max-w-lg mx-auto bg-gray-900 rounded-none p-6 shadow-lg"
          onSubmit={handleSubmit}
        >
          <label className="block mb-4">
            <span className="text-gray-300">Full Name</span>
            <input 
              type="text" 
              name="name" 
              value={formData.name} 
              onChange={handleChange} 
              required
              className="w-full mt-1 p-2 rounded bg-gray-800 text-white focus:outline-none"
            />
          </label>

          <label className="block mb-4">
            <span className="text-gray-300">Email</span>
            <input 
              type="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
              required
              className="w-full mt-1 p-2 rounded bg-gray-800 text-white focus:outline-none"
            />
          </label>

          <label className="block mb-4">
            <span className="text-gray-300">Phone</span>
            <input 
              type="tel" 
              name="phone" 
              value={formData.phone} 
              onChange={handleChange} 
              required
              className="w-full mt-1 p-2 rounded bg-gray-800 text-white focus:outline-none"
            />
          </label>

          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <label className="flex-1">
              <span className="text-gray-300">Date</span>
              <input 
                type="date" 
                name="date" 
                value={formData.date} 
                onChange={handleChange} 
                required
                className="w-full mt-1 p-2 rounded bg-gray-800 text-white focus:outline-none"
              />
            </label>
            <label className="flex-1">
              <span className="text-gray-300">Time</span>
              <input 
                type="time" 
                name="time" 
                value={formData.time} 
                onChange={handleChange} 
                required
                className="w-full mt-1 p-2 rounded bg-gray-800 text-white focus:outline-none"
              />
            </label>
          </div>

          <label className="block mb-6">
            <span className="text-gray-300">Number of Guests</span>
            <input 
              type="number" 
              name="guests" 
              min="1" 
              max="20" 
              value={formData.guests} 
              onChange={handleChange} 
              required
              className="w-full mt-1 p-2 rounded bg-gray-800 text-white focus:outline-none"
            />
          </label>

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
