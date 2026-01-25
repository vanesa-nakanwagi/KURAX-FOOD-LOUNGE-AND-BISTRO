import { useState } from "react";
import TopSection from "../common/topSection";
import FooterGlobal from "../common/footer.jsx";
import { FaCheckCircle } from "react-icons/fa";
import WhatsApp from "../home/WhatsApp.jsx";

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

  const [whatsAppMessage, setWhatsAppMessage] = useState("");

  


  const [errors, setErrors] = useState({});
  const [showModal, setShowModal] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";

    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = "Invalid email address";

    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    else if (!/^\d{9,15}$/.test(formData.phone)) newErrors.phone = "Enter a valid phone number (9-15 digits)";

    if (!formData.date) newErrors.date = "Date is required";
    if (!formData.time) newErrors.time = "Time is required";

    if (!formData.guests || formData.guests < 1 || formData.guests > 20) newErrors.guests = "Guests must be between 1 and 20";

    return newErrors;
  };

  const handleSubmit = (e) => {
  e.preventDefault();
  const validationErrors = validate();
  if (Object.keys(validationErrors).length > 0) {
    setErrors(validationErrors);
    return;
  }

  setErrors({});
  setShowModal(true);

  // Create message
  const message = `Reserve Confirmed ✅
Name: ${formData.name}
Email: ${formData.email}
Phone: ${formData.phone}
Date: ${formData.date}
Time: ${formData.time}
Guests: ${formData.guests}
Instructions: ${formData.instructions}`;

  // WhatsApp URL
  const phoneNumber = "256709913676"; // your WhatsApp number
  const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  // Open WhatsApp in a new tab/window
  window.open(url, "_blank");
};



  const closeModal = () => {
    setShowModal(false);
    setFormData({
      name: "",
      email: "",
      phone: "",
      date: "",
      time: "",
      guests: 1,
      instructions: ""
    });
  };

  return (
    <div className="min-h-screen font-[Outfit] flex flex-col bg-white text-black dark:bg-black dark:text-white transition-colors duration-300">
      <TopSection searchPlaceholder="Search menu items..." />

      <section className="flex-grow px-4 md:px-16 py-12">
        <h2 className="text-3xl md:text-4xl font-serif mb-6 text-yellow-500 text-center">
          Reserve Your Table
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
          Book your luxury dining experience at Kurax Food Lounge & Bistro
        </p>

        <form 
          className="max-w-lg mx-auto bg-gray-100 dark:bg-zinc-900 p-6 rounded-none shadow-lg transition-colors duration-300"
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
              className="w-full px-4 py-3 rounded-none bg-gray-200 dark:bg-zinc-800 text-black dark:text-white border border-gray-400 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
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
              className="w-full px-4 py-3 rounded-none bg-gray-200 dark:bg-zinc-800 text-black dark:text-white border border-gray-400 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
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
              placeholder="Whatsapp Number"
              className="w-full px-4 py-3 rounded-none bg-gray-200 dark:bg-zinc-800 text-black dark:text-white border border-gray-400 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
            />
            {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
          </div>

          {/* Date & Time */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-none bg-gray-200 dark:bg-zinc-800 text-black dark:text-white border border-gray-400 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
              />
              {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
            </div>
            <div className="flex-1">
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-none bg-gray-200 dark:bg-zinc-800 text-black dark:text-white border border-gray-400 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
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
              className="w-full px-4 py-3 rounded-none bg-gray-200 dark:bg-zinc-800 text-black dark:text-white border border-gray-400 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
            />
            {errors.guests && <p className="text-red-500 text-sm mt-1">{errors.guests}</p>}
          </div>

          {/* Special Instructions */}
          <div className="mb-6">
            <textarea
              name="instructions"
              placeholder="Any special requests or notes..."
              value={formData.instructions}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-3 rounded-none bg-gray-200 dark:bg-zinc-800 text-black dark:text-white border border-gray-400 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition resize-none"
            />
          </div>

          

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3 bg-yellow-500 text-black font-semibold rounded-none hover:bg-yellow-400 transition"
          >
            Reserve Now
          </button>
          {whatsAppMessage && <WhatsApp message={whatsAppMessage} />}

        </form>
      </section>

      <FooterGlobal />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-100 dark:bg-zinc-900 p-6 rounded-md max-w-md w-full relative">
            {/* Tick Icon */}
            <div className="flex justify-center mb-4">
              <FaCheckCircle className="text-yellow-900 text-6xl" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-center text-yellow-600 mb-4">
              RESERVE CONFIRMED
            </h3>

            {/* Reservation Summary */}
            <div className="text-gray-900 dark:text-white mb-4 space-y-2">
              <p><strong>Name:</strong> {formData.name}</p>
              <p><strong>Email:</strong> {formData.email}</p>
              <p><strong>Phone:</strong> {formData.phone}</p>
              <p><strong>Date:</strong> {formData.date}</p>
              <p><strong>Time:</strong> {formData.time}</p>
              <p><strong>Guests:</strong> {formData.guests}</p>
              {formData.instructions && <p><strong>Notes:</strong> {formData.instructions}</p>}
            </div>

            <p className="text-sm text-gray-500 text-center dark:text-gray-400 mb-4">
              You will receive confirmation on your WhatsApp number.
            </p>

            <button
              onClick={closeModal}
              className="w-full py-2 bg-yellow-600 text-black font-semibold rounded-none hover:bg-yellow-400 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
