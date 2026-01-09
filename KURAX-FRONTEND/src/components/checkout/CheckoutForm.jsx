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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCustomerDetails({ ...customerDetails, [name]: value });
  };

  const handlePayment = async () => {
    setLoading(true);
    setStatus("");

    try {
      const result = await simulateMobileMoneyPayment(
        customerDetails.paymentProvider,
        customerDetails.mobileMoneyNumber,
        totalAmount
      );
      setStatus(result); // Payment successful
      // Optionally, you can clear the cart here or reset customer details
    } catch (err) {
      setStatus(err); // Payment failed
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-serif text-yellow-500 mb-2">Checkout Details</h2>

      <input
        name="firstName"
        value={customerDetails.firstName}
        onChange={handleChange}
        className="bg-zinc-800 p-3 rounded-none border border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
        placeholder="First Name"
      />
      <input
        name="lastName"
        value={customerDetails.lastName}
        onChange={handleChange}
        className="bg-zinc-800 p-3 rounded"
        placeholder="Last Name"
      />
      <input
        name="email"
        value={customerDetails.email}
        onChange={handleChange}
        className="bg-zinc-800 p-3 rounded"
        placeholder="Email"
      />

      <select
        name="deliveryType"
        value={customerDetails.deliveryType}
        onChange={handleChange}
        className="bg-zinc-800 p-3 rounded"
      >
        <option value="Home">Home Delivery</option>
        <option value="Store">Store Pickup</option>
      </select>

      <input
        name="city"
        value={customerDetails.city}
        onChange={handleChange}
        className="bg-zinc-800 p-3 rounded"
        placeholder="City / Town"
      />

      <textarea
        name="locationDesc"
        value={customerDetails.locationDesc}
        onChange={handleChange}
        className="bg-zinc-800 p-3 rounded resize-none"
        rows={3}
        placeholder="Exact location"
      />

      <select
        name="paymentProvider"
        value={customerDetails.paymentProvider}
        onChange={handleChange}
        className="bg-zinc-800 p-3 rounded"
      >
        <option value="AIRTEL">AIRTEL</option>
        <option value="MTN">MTN</option>
        <option value="LYCAMOBILE">LYCAMOBILE</option>
      </select>

      <input
        name="mobileMoneyNumber"
        value={customerDetails.mobileMoneyNumber || ""}
        onChange={handleChange}
        className="bg-zinc-800 p-3 rounded"
        placeholder="Mobile Money Number"
      />

      <p className="text-sm text-gray-400">
        You will receive a payment prompt on your phone. Please enter your Mobile Money PIN to complete the transaction.
      </p>

      {/* Pay Button */}
      <button
        onClick={handlePayment}
        disabled={loading || !customerDetails.mobileMoneyNumber}
        className={`py-3 rounded font-semibold ${
          loading ? "bg-yellow-500 cursor-not-allowed" : "bg-yellow-500 hover:bg-yellow-600"
        }`}
      >
        {loading ? "Processing..." : `Pay UGX ${totalAmount.toLocaleString()}`}
      </button>

      {/* Status Message */}
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
