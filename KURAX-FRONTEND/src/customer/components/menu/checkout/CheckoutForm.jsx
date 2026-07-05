import { useState } from "react";
import { CheckCircle, XCircle, Banknote, AlertCircle, Smartphone } from "lucide-react";
import { simulateMobileMoneyPayment } from "../../utils/payment";

// ─── MERCHANT CODE MODAL (replaces PIN modal) ────────────────────────────────
function MerchantCodeModal({ provider, amount, onConfirm, onCancel }) {
  const providerLabel = provider === "MTN" ? "MTN Mobile Money" : "Airtel Money";
  const ussdCode = provider === "MTN" ? "*165*3#" : "*185*9#";
  const merchantCode = provider === "MTN" ? "KURAX-MTN-001" : "KURAX-AIR-002";
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = () => {
    setIsConfirming(true);
    // Simulate a short delay to mimic checking payment
    setTimeout(() => {
      onConfirm(); // proceed to success simulation
    }, 1500);
  };

  const providerColor = provider === "MTN" ? "text-yellow-500" : "text-red-500";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-sm shadow-2xl border border-gray-200 dark:border-zinc-700">
        <div className="flex justify-center mb-3">
          <div className={`p-3 rounded-full ${provider === "MTN" ? "bg-yellow-100" : "bg-red-100"}`}>
            <Smartphone className={`w-6 h-6 ${providerColor}`} />
          </div>
        </div>
        <p className={`text-xs font-semibold text-center uppercase tracking-widest mb-1 ${providerColor}`}>
          {providerLabel} Payment
        </p>
        <h3 className="text-lg font-semibold text-center text-gray-900 dark:text-white mb-1">
          Pay with Merchant Code
        </h3>
        <p className="text-center text-2xl font-bold text-yellow-500 mb-5">
          UGX {Number(amount).toLocaleString()}
        </p>

        <div className="bg-gray-100 dark:bg-zinc-800 rounded-lg p-4 mb-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">USSD Code</span>
            <span className="font-mono font-bold text-gray-900 dark:text-white">{ussdCode}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Merchant/Till Number</span>
            <span className="font-mono font-bold text-yellow-600">{merchantCode}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-300 dark:border-zinc-700">
            <span className="text-sm text-gray-600 dark:text-gray-400">Amount</span>
            <span className="font-bold text-gray-900 dark:text-white">UGX {Number(amount).toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-5">
          <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
            📱 Dial {ussdCode}, enter {merchantCode}, amount, and your PIN on your phone.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming}
            className={`flex-1 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm active:scale-95 transition flex items-center justify-center gap-2 ${isConfirming ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            {isConfirming ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Verifying...
              </>
            ) : (
              "I have paid"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Success Modal (no emojis) ────────────────────────────────────────────────
function SuccessModal({ customerDetails, totalAmount, cartItems, onClose }) {
  const openWhatsApp = () => {
    const itemLines = cartItems?.length
      ? cartItems.map((i) => `  • ${i.name} x${i.quantity} — UGX ${(i.price * i.quantity).toLocaleString()}`).join("\n")
      : "  • (no item details)";

    const message = encodeURIComponent(
      `*New Order Received* 🛒\n\n` +
      `*Customer:* ${customerDetails.firstName} ${customerDetails.lastName}\n` +
      `*Email:* ${customerDetails.email}\n` +
      `*City:* ${customerDetails.city}\n` +
      `*Delivery:* ${customerDetails.deliveryType === "Home" ? "Home Delivery" : "Store Pickup"}\n` +
      (customerDetails.locationDesc ? `*Location:* ${customerDetails.locationDesc}\n` : "") +
      `*Payment:* ${customerDetails.paymentProvider} — ${customerDetails.mobileMoneyNumber}\n\n` +
      `*Order Items:*\n${itemLines}\n\n` +
      `*Total Paid:* UGX ${Number(totalAmount).toLocaleString()}`
    );

    window.open(`https://wa.me/256709913676?text=${message}`, "_blank");
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-sm shadow-2xl border border-gray-200 dark:border-zinc-700 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto mb-4 animate-bounce">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>

        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
          Payment successful!
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          UGX {Number(totalAmount).toLocaleString()} via {customerDetails.paymentProvider}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Your order has been received. We'll be in touch shortly.
        </p>

        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg px-4 py-3 mb-5 text-left space-y-1 text-sm text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-zinc-700">
          <p><span className="font-semibold">Name:</span> {customerDetails.firstName} {customerDetails.lastName}</p>
          <p><span className="font-semibold">Email:</span> {customerDetails.email}</p>
          <p><span className="font-semibold">Delivery:</span> {customerDetails.deliveryType === "Home" ? "Home Delivery" : "Store Pickup"}</p>
          <p><span className="font-semibold">City:</span> {customerDetails.city}</p>
          {customerDetails.locationDesc && (
            <p><span className="font-semibold">Location:</span> {customerDetails.locationDesc}</p>
          )}
          <p><span className="font-semibold">Paid via:</span> {customerDetails.paymentProvider} · {customerDetails.mobileMoneyNumber}</p>
        </div>

        <button
          onClick={openWhatsApp}
          className="w-full flex items-center justify-center gap-2 py-2.5 mb-3 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-lg transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.118 1.528 5.849L.057 23.571a.75.75 0 0 0 .921.921l5.704-1.47A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.718 9.718 0 0 1-4.998-1.38l-.358-.214-3.724.96.99-3.614-.234-.373A9.72 9.72 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
          </svg>
          Send on WhatsApp
        </button>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Failure Modal (no emojis) ────────────────────────────────────────────────
function FailureModal({ onRetry, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-sm shadow-2xl border border-gray-200 dark:border-zinc-700 text-center">
        <div className="flex justify-center mb-4">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Payment not confirmed</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          We couldn't verify your payment. Please ensure you've completed the transaction on your phone and try again.
        </p>
        <button
          onClick={onRetry}
          className="w-full py-2.5 mb-3 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg transition"
        >
          Try again
        </button>
        <button
          onClick={onCancel}
          className="w-full py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main CheckoutForm (with local state for instant typing) ─────────────────
export default function CheckoutForm({
  customerDetails: externalDetails,
  setCustomerDetails: setExternalDetails,
  totalAmount,
  cartItems,
  onBack,
}) {
  const [localDetails, setLocalDetails] = useState(externalDetails || {});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [modal, setModal] = useState(null); // "merchant" | "success" | "failed"

  const updateField = (name, value) => {
    const updated = { ...localDetails, [name]: value };
    setLocalDetails(updated);
    setExternalDetails(updated);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "paymentProvider") {
      updateField(name, value);
      updateField("mobileMoneyNumber", "");
    } else {
      updateField(name, value);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!localDetails.firstName?.trim()) newErrors.firstName = "First name is required";
    if (!localDetails.lastName?.trim()) newErrors.lastName = "Last name is required";
    if (!localDetails.email?.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(localDetails.email)) {
      newErrors.email = "Invalid email address";
    }
    if (!localDetails.city?.trim()) newErrors.city = "City / Town is required";
    if (!localDetails.paymentProvider) newErrors.paymentProvider = "Select a payment provider";
    if (localDetails.paymentProvider && !localDetails.mobileMoneyNumber?.trim()) {
      newErrors.mobileMoneyNumber = "Mobile Money number is required";
    }
    return newErrors;
  };

  const handlePayClick = () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setModal("merchant");
  };

  const handleMerchantConfirm = async () => {
    // Here you could call a real API to check payment status, but for now we simulate success
    setModal(null);
    setLoading(true);
    // Simulate a short "verification" process (2 seconds)
    setTimeout(() => {
      // For demonstration, we assume the payment was successful.
      // In a real implementation, you would call a backend endpoint that checks with the mobile money provider.
      setModal("success");
      setLoading(false);
    }, 2000);
  };

  const handleRetry = () => {
    setModal("merchant");
  };

  const inputClass =
    "w-full px-4 py-2 rounded-none bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 transition";

  return (
    <div className="flex flex-col gap-4 text-gray-900 dark:text-white">
      <h2 className="text-2xl font-serif text-yellow-500 mb-2">Checkout Details</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <input name="firstName" value={localDetails.firstName || ""} onChange={handleChange} className={inputClass} placeholder="First Name" />
          {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
        </div>
        <div>
          <input name="lastName" value={localDetails.lastName || ""} onChange={handleChange} className={inputClass} placeholder="Last Name" />
          {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
        </div>
      </div>

      <div>
        <input name="email" value={localDetails.email || ""} onChange={handleChange} className={inputClass} placeholder="Email" />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
      </div>

      <div>
        <select name="deliveryType" value={localDetails.deliveryType || "Home"} onChange={handleChange} className={inputClass}>
          <option value="Home">Home Delivery</option>
          <option value="Store">Store Pickup</option>
        </select>
      </div>

      <div>
        <input name="city" value={localDetails.city || ""} onChange={handleChange} className={inputClass} placeholder="City / Town" />
        {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
      </div>

      <div>
        <textarea name="locationDesc" value={localDetails.locationDesc || ""} onChange={handleChange} rows={3} placeholder="Exact location" className={`${inputClass} resize-none`} />
      </div>

      <div>
        <select name="paymentProvider" value={localDetails.paymentProvider || ""} onChange={handleChange} className={inputClass}>
          <option value="">Select Payment Provider</option>
          <option value="AIRTEL">Airtel Mobile Money</option>
          <option value="MTN">MTN Mobile Money</option>
        </select>
        {errors.paymentProvider && <p className="text-red-500 text-sm mt-1">{errors.paymentProvider}</p>}
      </div>

      {localDetails.paymentProvider && (
        <div>
          <input
            name="mobileMoneyNumber"
            value={localDetails.mobileMoneyNumber || ""}
            onChange={handleChange}
            placeholder={`${localDetails.paymentProvider} number e.g. 0771234567`}
            className={inputClass}
          />
          {errors.mobileMoneyNumber && <p className="text-red-500 text-sm mt-1">{errors.mobileMoneyNumber}</p>}
        </div>
      )}

      <button
        onClick={handlePayClick}
        disabled={loading}
        className={`w-full py-3 rounded-none font-semibold text-black bg-yellow-500 hover:bg-yellow-400 active:scale-95 transition ${loading ? "cursor-not-allowed opacity-70" : ""}`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Verifying...
          </span>
        ) : (
          `Pay UGX ${Number(totalAmount).toLocaleString()}`
        )}
      </button>

      <button onClick={onBack} className="text-sm text-gray-500 dark:text-gray-400 mt-1 hover:underline transition">
        ← Back to Cart
      </button>

      {modal === "merchant" && (
        <MerchantCodeModal
          provider={localDetails.paymentProvider}
          amount={totalAmount}
          onConfirm={handleMerchantConfirm}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === "success" && (
        <SuccessModal
          customerDetails={localDetails}
          totalAmount={totalAmount}
          cartItems={cartItems}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "failed" && (
        <FailureModal
          onRetry={handleRetry}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}