import { useState } from "react";

export default function BookingModal({ show, onClose, eventTitle }) {
  if (!show) return null;

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    guests: 1,
    date: "",
    time: "",
    instructions: "",
  });

  const [errors, setErrors] = useState({});

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

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    console.log("Booking submitted:", formData);
    alert(`Booking for "${eventTitle}" submitted successfully!`);
    onClose();
    setFormData({ name: "", email: "", guests: 1, date: "", time: "", instructions: "" });
    setErrors({});
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
      <div className="bg-zinc-900 w-full max-w-md rounded-none p-6 relative">
        <button
          className="absolute top-3 right-3 text-white text-lg font-bold"
          onClick={onClose}
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-4 text-yellow-400">{eventTitle}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-none bg-zinc-800 text-white border border-gray-600"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-none bg-zinc-800 text-white border border-gray-600"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          <div>
            <input
              type="number"
              name="guests"
              placeholder="Number of Guests"
              value={formData.guests}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-none bg-zinc-800 text-white border border-gray-600"
              min={1}
              max={20}
            />
            {errors.guests && <p className="text-red-500 text-sm mt-1">{errors.guests}</p>}
          </div>

          <div className="flex gap-2">
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-1/2 px-3 py-2 rounded-none bg-zinc-800 text-white border border-gray-600"
            />
            <input
              type="time"
              name="time"
              value={formData.time}
              onChange={handleChange}
              className="w-1/2 px-3 py-2 rounded-none bg-zinc-800 text-white border border-gray-600"
            />
          </div>
          {(errors.date || errors.time) && (
            <p className="text-red-500 text-sm mt-1">
              {errors.date || errors.time}
            </p>
          )}

          <div>
            <textarea
              name="instructions"
              placeholder="Special Instructions (optional)"
              value={formData.instructions}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-none bg-zinc-800 text-white border border-gray-600"
              rows={3}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-yellow-400 text-black py-2 rounded-none font-semibold hover:bg-yellow-300 transition"
          >
            Submit Booking
          </button>
        </form>
      </div>
    </div>
  );
}
