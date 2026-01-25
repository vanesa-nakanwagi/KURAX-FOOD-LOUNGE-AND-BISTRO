import { useState } from "react";
import { simulateMobileMoneyPayment } from "../../utils/payment";

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
  const { name, value } = e.target; // <-- get it from e.target

  if (name === "cardNumber") {
    setCustomerDetails({
      ...customerDetails,
      cardNumber: formatCardNumber(value),
      cardType: getCardType(value),
    });
    return;
  }

  if (name === "cardExpiry") {
    setCustomerDetails({
      ...customerDetails,
      cardExpiry: formatExpiry(value),
    });
    return;
  }

  if (name === "cardCVC") {
    setCustomerDetails({
      ...customerDetails,
      cardCVC: cleanNumber(value),
    });
    return;
  }

  if (name === "paymentProvider") {
    setCustomerDetails({
      ...customerDetails,
      paymentProvider: value,
      mobileMoneyNumber: "",
      cardNumber: "",
      cardExpiry: "",
      cardCVC: "",
      cardType: "",
    });
    return;
  }

  setCustomerDetails({ ...customerDetails, [name]: value });
};


  // Remove non-digits
const cleanNumber = (v) => v.replace(/\D/g, "");

// Format card number
const formatCardNumber = (value) => {
  const cleaned = cleanNumber(value);
  return cleaned.replace(/(.{4})/g, "$1 ").trim();
};

// Detect card type
const getCardType = (number) => {
  const n = cleanNumber(number);

  if (/^4/.test(n)) return "VISA";
  if (/^5[1-5]/.test(n)) return "MASTERCARD";
  if (/^3[47]/.test(n)) return "AMEX";
  return "UNKNOWN";
};

// Luhn algorithm
const isValidCardNumber = (number) => {
  const digits = number.split("").reverse().map(Number);
  let sum = 0;

  for (let i = 0; i < digits.length; i++) {
    let digit = digits[i];
    if (i % 2 !== 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  return sum % 10 === 0;
};

// Format expiry MM/YY
const formatExpiry = (value) => {
  const cleaned = cleanNumber(value).slice(0, 4);
  if (cleaned.length < 3) return cleaned;
  return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
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

  // Mobile Money validation
  if (customerDetails.paymentProvider !== "CARD") {
    if (!customerDetails.mobileMoneyNumber?.trim()) {
      newErrors.mobileMoneyNumber = "Mobile Money Number is required";
    }
  }

  // Card validation
  // Card validation
if (customerDetails.paymentProvider === "CARD") {
  const rawCard = cleanNumber(customerDetails.cardNumber || "");
  const cardType = getCardType(rawCard);

  if (!rawCard) {
    newErrors.cardNumber = "Card number is required";
  } else if (rawCard.length < 13 || rawCard.length > 19) {
    newErrors.cardNumber = "Invalid card length";
  } else if (!isValidCardNumber(rawCard)) {
    newErrors.cardNumber = "Invalid card number";
  }

  if (!customerDetails.cardExpiry) {
    newErrors.cardExpiry = "Expiry date is required";
  } else {
    const [mm, yy] = customerDetails.cardExpiry.split("/");
    if (+mm < 1 || +mm > 12) {
      newErrors.cardExpiry = "Invalid expiry month";
    }
  }

  const requiredCVC = cardType === "AMEX" ? 4 : 3;
  if (!customerDetails.cardCVC) {
    newErrors.cardCVC = "CVC is required";
  } else if (customerDetails.cardCVC.length !== requiredCVC) {
    newErrors.cardCVC = `CVC must be ${requiredCVC} digits`;
  }
}


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
  <option value="AIRTEL">AIRTEL Mobile Money</option>
  <option value="MTN">MTN Mobile Money</option>
  <option value="CARD">Debit / Credit Card</option>
</select>
{/* Mobile Money Number Input */}
{customerDetails.paymentProvider && customerDetails.paymentProvider !== "CARD" && (
  <div>
    <input
      name="mobileMoneyNumber"
      value={customerDetails.mobileMoneyNumber || ""}
      onChange={handleChange}
      placeholder="Mobile Money Number"
      className="w-full px-4 mt-4 py-2 rounded-none bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 transition"
    />
    {errors.mobileMoneyNumber && (
      <p className="text-red-500 text-sm mt-12">{errors.mobileMoneyNumber}</p>
    )}
  </div>
)}


        {errors.paymentProvider && (
          <p className="text-red-500 text-sm mt-1">{errors.paymentProvider}</p>
        )}
      </div>

 {customerDetails.paymentProvider === "CARD" && (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    {/* Card Number */}
    <div className="md:col-span-3">
     <input
  name="cardNumber"
  value={customerDetails.cardNumber || ""}
  onChange={handleChange}
  inputMode="numeric"
  maxLength={19}
  placeholder="1234 5678 9012 3456"
  className="w-full px-4 py-2 rounded-none bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-yellow-500"
/>

{customerDetails.cardType && customerDetails.cardType !== "UNKNOWN" && (
  <p className="text-xs text-yellow-500 mt-1">
    {customerDetails.cardType} detected
  </p>
)}

      {errors.cardNumber && <p className="text-red-500 text-sm mt-1">{errors.cardNumber}</p>}
    </div>

    {/* Expiry */}
    <div>
      <input
  name="cardExpiry"
  value={customerDetails.cardExpiry || ""}
  onChange={handleChange}
  inputMode="numeric"
  maxLength={5}
  placeholder="MM/YY"
  className="w-full px-4 py-2 rounded-none bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-yellow-500"
/>

      {errors.cardExpiry && <p className="text-red-500 text-sm mt-1">{errors.cardExpiry}</p>}
    </div>

    {/* CVC */}
    <div>
     <input
  name="cardCVC"
  value={customerDetails.cardCVC || ""}
  onChange={handleChange}
  inputMode="numeric"
  maxLength={customerDetails.cardType === "AMEX" ? 4 : 3}
  placeholder={customerDetails.cardType === "AMEX" ? "4-digit CVC" : "3-digit CVC"}
  className="w-full px-4 py-2 rounded-none bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-yellow-500"
/>

      {errors.cardCVC && <p className="text-red-500 text-sm mt-1">{errors.cardCVC}</p>}
    </div>
  </div>
)}

<p className="text-sm text-gray-500 text-center dark:text-gray-400">
  {customerDetails.paymentProvider === "CARD"
    ? "Your card will be charged securely. Do not refresh the page during payment."
    : "You will receive a payment prompt on your phone. Enter your Mobile Money PIN to complete the transaction."
  }
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
