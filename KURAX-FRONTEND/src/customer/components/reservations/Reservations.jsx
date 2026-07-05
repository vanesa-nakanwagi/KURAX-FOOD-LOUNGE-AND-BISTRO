import { useState } from "react";
import TopSection from "../common/topSection";
import FooterGlobal from "../common/footer.jsx";
import { FaCheckCircle } from "react-icons/fa";

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
    else if (!/^\d{9,15}$/.test(formData.phone)) newErrors.phone = "Enter a valid phone number (9–15 digits)";

    if (!formData.date) newErrors.date = "Date is required";
    if (!formData.time) newErrors.time = "Time is required";

    if (!formData.guests || formData.guests < 1 || formData.guests > 20)
      newErrors.guests = "Guests must be between 1 and 20";

    return newErrors;
  };

  const buildWhatsAppMessage = (data) => {
    const lines = [
      `*New Table Reservation* 🍽️`,
      ``,
      `*Name:* ${data.name}`,
      `*Email:* ${data.email}`,
      `*Phone:* ${data.phone}`,
      `*Date:* ${data.date}`,
      `*Time:* ${data.time}`,
      `*Guests:* ${data.guests}`,
    ];
    if (data.instructions.trim()) {
      lines.push(`*Notes:* ${data.instructions}`);
    }
    return encodeURIComponent(lines.join("\n"));
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

    // Open WhatsApp after a short delay so the modal renders first
    setTimeout(() => {
      window.open(
        `https://wa.me/256709913676?text=${buildWhatsAppMessage(formData)}`,
        "_blank"
      );
    }, 700);
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
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif leading-[0.85] tracking-tighter text-center">
          Reserve{" "}
          <span className="bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 bg-clip-text text-transparent whitespace-nowrap">
            Your Table
          </span>
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
          Book your luxury dining experience at Kurax Food Lounge &amp; Bistro
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
              placeholder="WhatsApp Number"
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
            className="w-full py-3 bg-yellow-400 text-black font-semibold rounded-none hover:bg-yellow-300 active:scale-95 transition"
          >
            Reserve Now
          </button>
        </form>
      </section>

      <div className="w-full h-[2px] bg-yellow-900 dark:bg-yellow-900"></div>
      <FooterGlobal />

      {/* Success Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-100 dark:bg-zinc-900 p-6 rounded-md max-w-md w-full relative shadow-2xl">

            {/* Icon */}
            <div className="flex justify-center mb-3">
              <FaCheckCircle className="text-yellow-500 text-6xl" />
            </div>

            {/* Heading */}
            <h3 className="text-xl md:text-2xl font-bold text-center text-yellow-500 mb-1">
              Reservation submitted!
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-5">
              We'll confirm your table on WhatsApp shortly.
            </p>

            {/* Summary */}
            <div className="bg-white dark:bg-zinc-800 rounded-md px-4 py-3 mb-5 space-y-1.5 text-sm text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-zinc-700">
              <p><span className="font-semibold">Name:</span> {formData.name}</p>
              <p><span className="font-semibold">Email:</span> {formData.email}</p>
              <p><span className="font-semibold">Phone:</span> {formData.phone}</p>
              <p><span className="font-semibold">Date:</span> {formData.date}</p>
              <p><span className="font-semibold">Time:</span> {formData.time}</p>
              <p><span className="font-semibold">Guests:</span> {formData.guests}</p>
              {formData.instructions && (
                <p><span className="font-semibold">Notes:</span> {formData.instructions}</p>
              )}
            </div>

            {/* Open WhatsApp manually (in case popup was blocked) */}
            <button
              onClick={() =>
                window.open(
                  `https://wa.me/256709913676?text=${buildWhatsAppMessage(formData)}`,
                  "_blank"
                )
              }
              className="w-full flex items-center justify-center gap-2 py-2.5 mb-3 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-none transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.118 1.528 5.849L.057 23.571a.75.75 0 0 0 .921.921l5.704-1.47A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.718 9.718 0 0 1-4.998-1.38l-.358-.214-3.724.96.99-3.614-.234-.373A9.72 9.72 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
              </svg>
              Open WhatsApp
            </button>

            <button
              onClick={closeModal}
              className="w-full py-2.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 font-semibold rounded-none hover:bg-gray-200 dark:hover:bg-zinc-800 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}