import { useState } from "react";
import { simulateMobileMoneyPayment } from "../utils/payment";

export default function CheckoutForm({
  customerDetails,
  setCustomerDetails,
  totalAmount,
  onBack,
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCustomerDetails({ ...customerDetails, [name]: value });
  };

  // Validation function
  const validate = () => {
    const newErrors = {};
    if (!customerDetails.firstName?.trim()) newErrors.firstName = "First name is required";
    if (!customerDetails.lastName?.trim()) newErrors.lastName = "Last name is required";
    if (!customerDetails.email?.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(customerDetails.email)) {
      newErrors.email = "Invalid email address";
    }
    if (!customerDetails.city?.trim()) newErrors.city = "City / Town is required";
    if (!customerDetails.paymentProvider) newErrors.paymentProvider = "Select a payment provider";
    if (!customerDetails.mobileMoneyNumber?.trim()) newErrors.mobileMoneyNumber = "Mobile Money Number is required";
    return newErrors;
  };

  const handlePayment = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    setStatus("");

    try {
      const result = await simulateMobileMoneyPayment(
        customerDetails.paymentProvider,
        customerDetails.mobileMoneyNumber,
        totalAmount
      );
      setStatus(result); // Payment successful
    } catch (err) {
      setStatus(err); // Payment failed
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-gray-900 dark:text-white">
      <h2 className="text-2xl font-serif text-yellow-500 mb-2">Checkout Details</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* First Name */}
        <div>
          <input
            name="firstName"
            value={customerDetails.firstName || ""}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-none bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
            placeholder="First Name"
          />
          {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
        </div>

        {/* Last Name */}
        <div>
          <input
            name="lastName"
            value={customerDetails.lastName || ""}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-none bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
            placeholder="Last Name"
          />
          {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
        </div>
      </div>

      {/* Email */}
      <div>
        <input
          name="email"
          value={customerDetails.email || ""}
          onChange={handleChange}
          className="w-full px-4 py-2 rounded-none bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
          placeholder="Email"
        />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
      </div>

      {/* Delivery Type */}
      <div>
        <select
          name="deliveryType"
          value={customerDetails.deliveryType || "Home"}
          onChange={handleChange}
          className="w-full px-4 py-2 rounded-none bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
        >
          <option value="Home">Home Delivery</option>
          <option value="Store">Store Pickup</option>
        </select>
      </div>

      {/* City / Town */}
      <div>
        <input
          name="city"
          value={customerDetails.city || ""}
          onChange={handleChange}
          className="w-full px-4 py-2 rounded-none bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
          placeholder="City / Town"
        />
        {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
      </div>

      {/* Exact Location */}
      <div>
        <textarea
          name="locationDesc"
          value={customerDetails.locationDesc || ""}
          onChange={handleChange}
          rows={3}
          placeholder="Exact location"
          className="w-full px-4 py-2 rounded-none bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 transition resize-none"
        />
      </div>

      {/* Payment Provider */}
      <div>
        <select
          name="paymentProvider"
          value={customerDetails.paymentProvider || ""}
          onChange={handleChange}
          className="w-full px-4 py-2 rounded-none bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
        >
          <option value="">Select Payment Provider</option>
          <option value="AIRTEL">AIRTEL</option>
          <option value="MTN">MTN</option>
        </select>
        {errors.paymentProvider && (
          <p className="text-red-500 text-sm mt-1">{errors.paymentProvider}</p>
        )}
      </div>

      {/* Mobile Money Number */}
      <div>
        <input
          name="mobileMoneyNumber"
          value={customerDetails.mobileMoneyNumber || ""}
          onChange={handleChange}
          className="w-full px-4 py-2 rounded-none bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
          placeholder="Mobile Money Number"
        />
        {errors.mobileMoneyNumber && (
          <p className="text-red-500 text-sm mt-1">{errors.mobileMoneyNumber}</p>
        )}
      </div>

      {/* Payment Instructions */}
      <p className="text-sm text-gray-500 text-center dark:text-gray-400">
        You will receive a payment prompt on your phone. Enter your Mobile Money PIN to complete the transaction.
      </p>

      {/* Pay Button */}
      <button
        onClick={handlePayment}
        disabled={loading}
        className={`w-full py-3 rounded-none font-semibold text-black bg-yellow-500 hover:bg-yellow-600 transition ${
          loading ? "cursor-not-allowed opacity-70" : ""
        }`}
      >
        {loading ? "Processing..." : `Pay UGX ${totalAmount.toLocaleString()}`}
      </button>

      {/* Payment Status */}
      {status && (
        <p className={`mt-2 text-sm ${status.includes("successful") ? "text-yellow-400" : "text-red-400"}`}>
          {status}
        </p>
      )}

      {/* Back Button */}
      <button
        onClick={onBack}
        className="text-sm text-gray-500 dark:text-gray-400 mt-2 hover:underline transition"
      >
        Back to Cart
      </button>
    </div>
  );
}
