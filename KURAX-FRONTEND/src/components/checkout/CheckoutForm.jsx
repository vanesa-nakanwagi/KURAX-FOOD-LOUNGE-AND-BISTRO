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
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-serif text-yellow-500 mb-2">Checkout Details</h2>

      <div>
        <input
          name="firstName"
          value={customerDetails.firstName}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-none bg-zinc-800 text-white border border-gray-600"
          placeholder="Full Name"
        />
        {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
      </div>

      <div>
        <input
          name="email"
          value={customerDetails.email}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-none bg-zinc-800 text-white border border-gray-600"
          placeholder="Email"
        />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
      </div>

      <div>
        <select
          name="deliveryType"
          value={customerDetails.deliveryType}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-none bg-zinc-800 text-white border border-gray-600"
        >
          <option value="Home">Home Delivery</option>
          <option value="Store">Store Pickup</option>
        </select>
      </div>

      <div>
        <input
          name="city"
          value={customerDetails.city}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-none bg-zinc-800 text-white border border-gray-600"
          placeholder="City / Town"
        />
        {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
      </div>

      <div>
        <textarea
          name="locationDesc"
          value={customerDetails.locationDesc}
          onChange={handleChange}
           className="w-full px-3 py-2 rounded-none bg-zinc-800 text-white border border-gray-600"
          rows={3}
          placeholder="Exact location"
        />
      </div>

      <div>
        <select
          name="paymentProvider"
          value={customerDetails.paymentProvider}
          onChange={handleChange}
           className="w-full px-3 py-2 rounded-none bg-zinc-800 text-white border border-gray-600"
        >
          <option value="">Select Payment Provider</option>
          <option value="AIRTEL">AIRTEL</option>
          <option value="MTN">MTN</option>
        </select>
        {errors.paymentProvider && (
          <p className="text-red-500 text-sm mt-1">{errors.paymentProvider}</p>
        )}
      </div>

      <div>
        <input
          name="mobileMoneyNumber"
          value={customerDetails.mobileMoneyNumber || ""}
          onChange={handleChange}
           className="w-full px-3 py-2 rounded-none bg-zinc-800 text-white border border-gray-600"
          placeholder="Mobile Money Number"
        />
        {errors.mobileMoneyNumber && (
          <p className="text-red-500 text-sm mt-1">{errors.mobileMoneyNumber}</p>
        )}
      </div>

      <p className="text-sm text-gray-400">
        You will receive a payment prompt on your phone. Please enter your Mobile Money PIN to complete the transaction.
      </p>

      <button
        onClick={handlePayment}
        disabled={loading}
        className={`py-3 rounded font-semibold ${
          loading ? "bg-yellow-500 cursor-not-allowed" : "bg-yellow-500 hover:bg-yellow-600"
        }`}
      >
        {loading ? "Processing..." : `Pay UGX ${totalAmount.toLocaleString()}`}
      </button>

      {status && (
        <p className={`mt-2 text-sm ${status.includes("successful") ? "text-yellow-400" : "text-red-400"}`}>
          {status}
        </p>
      )}

      <button
        onClick={onBack}
        className="text-sm text-gray-400 mt-2"
      >
        ← Back to Cart
      </button>
    </div>
  );
}
