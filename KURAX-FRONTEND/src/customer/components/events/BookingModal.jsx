import { useState } from "react";
import { CheckCircle, X } from "lucide-react";

export default function BookingModal({ show, onClose, eventTitle }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    guests: 1,
    date: "",
    time: "",
    instructions: "",
  });

  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  if (!show) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = "Invalid email address";
    }
    if (!formData.guests || formData.guests < 1 || formData.guests > 20)
      newErrors.guests = "Guests must be between 1 and 20";
    if (!formData.date) newErrors.date = "Date is required";
    if (!formData.time) newErrors.time = "Time is required";
    return newErrors;
  };

  const buildWhatsAppMessage = () => {
    const lines = [
      `*New Event Booking* 🎟`,
      ``,
      `*Event:* ${eventTitle}`,
      `*Name:* ${formData.name}`,
      `*Email:* ${formData.email}`,
      `*Guests:* ${formData.guests}`,
      `*Date:* ${formData.date}`,
      `*Time:* ${formData.time}`,
    ];
    if (formData.instructions.trim()) {
      lines.push(`*Notes:* ${formData.instructions}`);
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

    const message = buildWhatsAppMessage();
    setSubmitted(true);

    setTimeout(() => {
      window.open(`https://wa.me/256709913676?text=${message}`, "_blank");
    }, 600);
  };

  const handleClose = () => {
    onClose();
    setSubmitted(false);
    setFormData({ name: "", email: "", guests: 1, date: "", time: "", instructions: "" });
    setErrors({});
  };

  const handleBookAnother = () => {
    setSubmitted(false);
    setFormData({ name: "", email: "", guests: 1, date: "", time: "", instructions: "" });
    setErrors({});
  };

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl p-6 relative shadow-2xl transition-colors duration-300 mx-auto">

        {/* Close Button - Now properly visible */}
        <button
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:bg-yellow-400 hover:text-black transition-colors duration-200 z-10"
          onClick={handleClose}
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {/* ── SUCCESS VIEW ── */}
        {submitted ? (
          <div className="flex flex-col items-center text-center py-4 gap-4">
            {/* Animated checkmark circle with Lucide icon */}
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center animate-bounce">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Booking sent!
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-xs">
              Your details have been sent to us on WhatsApp. We'll confirm your
              spot shortly.
            </p>

            <button
              onClick={() =>
                window.open(
                  `https://wa.me/256709913676?text=${buildWhatsAppMessage()}`,
                  "_blank"
                )
              }
              className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white py-3 rounded-xl font-semibold transition"
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
              onClick={handleBookAnother}
              className="w-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 transition"
            >
              Book another spot
            </button>
          </div>
        ) : (
          /* ── FORM VIEW ── */
          <>
            <h2 className="text-2xl mb-5 text-yellow-500 dark:text-yellow-400 text-center font-semibold">
              {eventTitle}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <input
                  type="text"
                  name="name"
                  placeholder="Full name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-black dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <input
                  type="email"
                  name="email"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-black dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              {/* Guests */}
              <div>
                <input
                  type="number"
                  name="guests"
                  placeholder="Number of guests"
                  value={formData.guests}
                  onChange={handleChange}
                  min={1}
                  max={20}
                  className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-black dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
                />
                {errors.guests && (
                  <p className="text-red-500 text-xs mt-1">{errors.guests}</p>
                )}
              </div>

              {/* Date & Time */}
              <div className="flex gap-2">
                <div className="w-1/2">
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-black dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
                  />
                  {errors.date && (
                    <p className="text-red-500 text-xs mt-1">{errors.date}</p>
                  )}
                </div>
                <div className="w-1/2">
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-black dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
                  />
                  {errors.time && (
                    <p className="text-red-500 text-xs mt-1">{errors.time}</p>
                  )}
                </div>
              </div>

              {/* Special Instructions */}
              <div>
                <textarea
                  name="instructions"
                  placeholder="Special instructions (optional)"
                  value={formData.instructions}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-black dark:text-white border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition resize-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full bg-yellow-400 dark:bg-yellow-500 text-black py-3 rounded-xl font-semibold hover:bg-yellow-300 dark:hover:bg-yellow-400 active:scale-95 transition"
              >
                Submit booking
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}