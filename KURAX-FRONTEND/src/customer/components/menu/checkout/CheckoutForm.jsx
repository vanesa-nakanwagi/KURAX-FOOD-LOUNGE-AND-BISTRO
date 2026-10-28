import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { AlertCircle, CheckCircle, Clock3, Smartphone, XCircle } from "lucide-react";
import API_URL from "../../../../config/api";

const MERCHANT_CODES = {
  MTN: "678851",
  AIRTEL: "4320340",
};

const providerNames = {
  MTN: "MTN Mobile Money",
  AIRTEL: "Airtel Money",
};
const PAYMENT_REQUEST_STORAGE_KEY = "kurax_public_payment_request";

function getCartKey(items) {
  return JSON.stringify(items.map(item => {
    const isCombo = item.type === "combo" || Boolean(item.combo_id);
    return {
      type: isCombo ? "combo" : "menu",
      id: isCombo
        ? item.combo_id || String(item.id).replace(/^combo-/, "")
        : item.id,
      quantity: item.quantity,
    };
  }).sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`)));
}

function readSavedPaymentRequest(cartKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(PAYMENT_REQUEST_STORAGE_KEY) || "null");
    return saved?.cartKey === cartKey ? saved : null;
  } catch (error) {
    console.error("Unable to restore public payment status:", error);
    return null;
  }
}

function formatMoney(amount) {
  return `UGX ${Number(amount || 0).toLocaleString()}`;
}

function PaymentInstructionsModal({ paymentRequest, customer, items, status, statusError, onClose, onDone }) {
  const provider = paymentRequest.paymentProvider;
  const ussdCode = provider === "MTN" ? "*165*3#" : "*185*9#";
  const sendOrderToKurax = () => {
    const itemLines = items.map(item => `${item.name} × ${item.quantity}`).join("\n");
    const message = encodeURIComponent(
      `*Kurax Website Order Request*\n\n` +
      `*Order reference:* ${paymentRequest.orderReference}\n` +
      `*Customer:* ${customer.firstName} ${customer.lastName}\n` +
      `*Email:* ${customer.email}\n` +
      `*Delivery:* ${customer.deliveryType === "Home" ? "Home Delivery" : "Store Pickup"} · ${customer.city}${customer.locationDesc ? ` · ${customer.locationDesc}` : ""}\n` +
      `*Payment phone:* ${customer.mobileMoneyNumber}\n` +
      `*Status:* ${status === "Confirmed" ? "Payment confirmed" : status === "Rejected" ? "Rejected by cashier" : "Awaiting payment confirmation"}\n\n` +
      `*Items:*\n${itemLines}\n\n` +
      `*Amount:* ${formatMoney(paymentRequest.amount)}`
    );
    window.open(`https://wa.me/256709913676?text=${message}`, "_blank", "noopener,noreferrer");
    onDone();
  };
  const stateContent = {
    Pending: {
      icon: <Clock3 className="h-6 w-6 text-amber-600" />,
      title: "Payment pending",
      detail: "After paying, click Done to open WhatsApp with your order details. Tap Send to deliver them to Kurax.",
      color: "border-amber-200 bg-amber-50 text-amber-900",
    },
    Confirmed: {
      icon: <CheckCircle className="h-6 w-6 text-green-600" />,
      title: `Payment confirmed${paymentRequest.orderId ? ` · Order #${paymentRequest.orderId}` : ""}`,
      detail: "A Kurax cashier has verified the transaction. Your order has been sent to the restaurant.",
      color: "border-green-200 bg-green-50 text-green-900",
    },
    Rejected: {
      icon: <XCircle className="h-6 w-6 text-red-600" />,
      title: "Payment request rejected",
      detail: paymentRequest.rejectionReason || "Please contact Kurax before submitting another payment.",
      color: "border-red-200 bg-red-50 text-red-900",
    },
  }[status] || {
    icon: <AlertCircle className="h-6 w-6 text-zinc-600" />,
    title: "Payment status unavailable",
    detail: "Your request remains saved. Please try checking again shortly.",
    color: "border-zinc-200 bg-zinc-50 text-zinc-900",
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/70 p-4">
      <div className="my-auto max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-yellow-600">Mobile Money</p>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Payment instructions</h3>
          </div>
          <button onClick={onClose} aria-label="Close payment instructions" className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800">×</button>
        </div>

        <div className="mb-4 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-yellow-600" />
            <span className="font-semibold text-gray-900 dark:text-white">{providerNames[provider]}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Order reference</p>
              <p className="font-mono font-bold text-gray-900 dark:text-white">{paymentRequest.orderReference}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 dark:text-gray-400">Amount due</p>
              <p className="font-bold text-gray-900 dark:text-white">{formatMoney(paymentRequest.amount)}</p>
            </div>
          </div>
          {status === "Pending" && (
            <p className="mt-3 border-t pt-3 text-sm text-amber-800">
              Complete your payment, then click Done to send your order details to Kurax on WhatsApp.
            </p>
          )}
        </div>

        <div className="mb-4 rounded-lg bg-gray-100 p-4 text-sm dark:bg-zinc-800">
          <p className="mb-2 font-bold text-gray-900 dark:text-white">Official Kurax merchant codes</p>
          <p className="flex justify-between gap-3 text-gray-700 dark:text-gray-300"><span>MTN Mobile Money</span><strong className="font-mono">678851</strong></p>
          <p className="mt-1 flex justify-between gap-3 text-gray-700 dark:text-gray-300"><span>Airtel Money</span><strong className="font-mono">4320340</strong></p>
        </div>

        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-bold">How to pay</p>
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>Dial {ussdCode} on the {providerNames[provider]} number shown below.</li>
            <li>Select the merchant/till payment option and enter code {MERCHANT_CODES[provider]}.</li>
            <li>Pay {formatMoney(paymentRequest.amount)} and keep the transaction ID from your receipt.</li>
            <li>Kurax will confirm your payment after a cashier checks it.</li>
          </ol>
          <p className="mt-3 break-words"><strong>Payment phone:</strong> {customer.mobileMoneyNumber}</p>
          <p><strong>Order reference:</strong> {paymentRequest.orderReference}</p>
        </div>

        <div className="mb-4 rounded-lg border border-gray-200 p-4 dark:border-zinc-700">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Order</p>
          {items.map((item, index) => (
            <p key={`${item.id}-${index}`} className="flex justify-between gap-3 py-0.5 text-sm text-gray-800 dark:text-gray-200">
              <span>{item.name} × {item.quantity}</span>
              <span className="shrink-0">{formatMoney(item.price * item.quantity)}</span>
            </p>
          ))}
        </div>

        <div className={`mb-4 flex gap-3 rounded-lg border p-4 ${stateContent.color}`}>
          <div className="shrink-0">{stateContent.icon}</div>
          <div>
            <p className="font-bold">{stateContent.title}</p>
            <p className="mt-1 text-sm">{stateContent.detail}</p>
            {statusError && <p className="mt-2 text-xs">Status refresh failed: {statusError}</p>}
          </div>
        </div>

        <button onClick={sendOrderToKurax} className="w-full rounded-lg bg-yellow-500 py-3 font-semibold text-black transition hover:bg-yellow-400">
          Done
        </button>
      </div>
    </div>
  );
}

export default function CheckoutForm({
  customerDetails: externalDetails,
  setCustomerDetails: setExternalDetails,
  totalAmount,
  cartItems = [],
  onBack,
  onDone,
}) {
  const cartKey = getCartKey(cartItems);
  const [localDetails, setLocalDetails] = useState(externalDetails || {});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [paymentRequest, setPaymentRequest] = useState(() => readSavedPaymentRequest(cartKey));
  const [paymentStatus, setPaymentStatus] = useState(() => readSavedPaymentRequest(cartKey)?.status || "Pending");
  const [statusError, setStatusError] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const submitting = useRef(false);
  const requestKey = useRef(window.crypto.randomUUID());

  useEffect(() => {
    if (paymentRequest && paymentRequest.cartKey !== cartKey) {
      setPaymentRequest(null);
      setPaymentStatus("Pending");
      setShowInstructions(false);
    }
  }, [cartKey, paymentRequest]);

  useEffect(() => {
    if (!paymentRequest) {
      try {
        localStorage.removeItem(PAYMENT_REQUEST_STORAGE_KEY);
      } catch (error) {
        console.error("Unable to clear stale public payment status:", error);
      }
      return;
    }
    try {
      localStorage.setItem(
        PAYMENT_REQUEST_STORAGE_KEY,
        JSON.stringify({ ...paymentRequest, status: paymentStatus })
      );
    } catch (error) {
      console.error("Unable to save public payment status:", error);
    }
  }, [paymentRequest, paymentStatus]);

  useEffect(() => {
    if (!paymentRequest?.orderReference) return undefined;
    let active = true;
    const refreshStatus = async () => {
      try {
        const { data } = await axios.get(
          `${API_URL}/api/public-orders/payment-requests/${encodeURIComponent(paymentRequest.orderReference)}`
        );
        if (!active) return;
        setPaymentStatus(data.status);
        setPaymentRequest(current => ({ ...current, ...data }));
        setStatusError("");
      } catch (error) {
        console.error("Payment status refresh failed:", error);
        if (active) setStatusError(error.response?.data?.error || "Please try again.");
      }
    };
    refreshStatus();
    const interval = window.setInterval(refreshStatus, 8000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [paymentRequest?.orderReference]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    const updated = {
      ...localDetails,
      [name]: value,
      ...(name === "paymentProvider" ? { mobileMoneyNumber: "" } : {}),
    };
    setLocalDetails(updated);
    setExternalDetails(updated);
  };

  const validate = () => {
    const validationErrors = {};
    if (!localDetails.firstName?.trim()) validationErrors.firstName = "First name is required";
    if (!localDetails.lastName?.trim()) validationErrors.lastName = "Last name is required";
    if (!localDetails.email?.trim()) validationErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(localDetails.email)) validationErrors.email = "Invalid email address";
    if (!localDetails.city?.trim()) validationErrors.city = "City / Town is required";
    if (!localDetails.locationDesc?.trim()) validationErrors.locationDesc = "Exact location is required";
    if (!localDetails.paymentProvider) validationErrors.paymentProvider = "Select a payment provider";
    if (!localDetails.mobileMoneyNumber?.trim()) validationErrors.mobileMoneyNumber = "Mobile Money number is required";
    else if (!/^\+?[0-9][0-9\s()-]{6,18}$/.test(localDetails.mobileMoneyNumber.trim())) validationErrors.mobileMoneyNumber = "Enter a valid mobile money number";
    if (!cartItems.length) validationErrors.cart = "Your cart is empty";
    return validationErrors;
  };

  const handlePayClick = async () => {
    if (submitting.current) return;
    if (paymentRequest && paymentStatus !== "Rejected") {
      setShowInstructions(true);
      return;
    }
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setSubmitError("");
    submitting.current = true;
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/public-orders/payment-requests`, {
        customer: localDetails,
        requestKey: requestKey.current,
        items: cartItems.map(item => ({
          id: item.type === "combo" || item.combo_id
            ? item.combo_id || String(item.id).replace(/^combo-/, "")
            : item.id,
          combo_id: item.type === "combo" || item.combo_id
            ? item.combo_id || String(item.id).replace(/^combo-/, "")
            : undefined,
          type: item.type === "combo" || item.combo_id ? "combo" : "menu",
          quantity: item.quantity,
          instructions: item.instructions || "",
        })),
      });
      setPaymentRequest({ ...data, cartKey });
      setPaymentStatus(data.status);
      requestKey.current = window.crypto.randomUUID();
      setShowInstructions(true);
    } catch (error) {
      console.error("Could not create public order payment request:", error);
      setSubmitError(error.response?.data?.error || "Unable to submit your order. Please try again.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-none border border-gray-300 bg-gray-100 px-4 py-2 text-gray-900 transition focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:border-gray-700 dark:bg-zinc-800 dark:text-white";

  return (
    <div className="flex flex-col gap-4 text-gray-900 dark:text-white">
      <h2 className="mb-2 text-2xl font-serif text-yellow-500">Checkout Details</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <input name="firstName" value={localDetails.firstName || ""} onChange={handleChange} className={inputClass} placeholder="First Name" />
          {errors.firstName && <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>}
        </div>
        <div>
          <input name="lastName" value={localDetails.lastName || ""} onChange={handleChange} className={inputClass} placeholder="Last Name" />
          {errors.lastName && <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>}
        </div>
      </div>

      <div>
        <input type="email" name="email" value={localDetails.email || ""} onChange={handleChange} className={inputClass} placeholder="Email" />
        {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
      </div>

      <div>
        <select name="deliveryType" value={localDetails.deliveryType || "Home"} onChange={handleChange} className={inputClass}>
          <option value="Home">Home Delivery</option>
          <option value="Store">Store Pickup</option>
        </select>
      </div>

      <div>
        <input name="city" value={localDetails.city || ""} onChange={handleChange} className={inputClass} placeholder="City / Town" />
        {errors.city && <p className="mt-1 text-sm text-red-500">{errors.city}</p>}
      </div>

      <div>
        <textarea
          name="locationDesc"
          value={localDetails.locationDesc || ""}
          onChange={handleChange}
          rows={3}
          maxLength={500}
          required
          placeholder="Exact location (street, building, or nearby landmark)"
          className={`${inputClass} resize-none`}
        />
        {errors.locationDesc && <p className="mt-1 text-sm text-red-500">{errors.locationDesc}</p>}
      </div>

      <div>
        <select name="paymentProvider" value={localDetails.paymentProvider || ""} onChange={handleChange} className={inputClass}>
          <option value="">Select Payment Provider</option>
          <option value="AIRTEL">Airtel Mobile Money</option>
          <option value="MTN">MTN Mobile Money</option>
        </select>
        {errors.paymentProvider && <p className="mt-1 text-sm text-red-500">{errors.paymentProvider}</p>}
      </div>

      {localDetails.paymentProvider && (
        <div>
          <input
            name="mobileMoneyNumber"
            inputMode="tel"
            autoComplete="tel"
            value={localDetails.mobileMoneyNumber || ""}
            onChange={handleChange}
            placeholder={`${localDetails.paymentProvider} number e.g. 0771234567`}
            className={inputClass}
          />
          {errors.mobileMoneyNumber && <p className="mt-1 text-sm text-red-500">{errors.mobileMoneyNumber}</p>}
        </div>
      )}

      {errors.cart && <p className="text-sm text-red-500">{errors.cart}</p>}
      {submitError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {submitError}
        </p>
      )}

      {paymentRequest && (
        <div className={`rounded-lg border p-3 text-sm ${
          paymentStatus === "Confirmed" ? "border-green-200 bg-green-50 text-green-800"
            : paymentStatus === "Rejected" ? "border-red-200 bg-red-50 text-red-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
        }`}>
          <p className="font-bold">
            {paymentStatus === "Confirmed" ? "Payment confirmed"
              : paymentStatus === "Rejected" ? "Payment request rejected"
                : "Payment pending"}
          </p>
          <p>Order reference: {paymentRequest.orderReference}</p>
          <button type="button" onClick={() => setShowInstructions(true)} className="mt-2 font-semibold underline">
            View order and payment status
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={handlePayClick}
        disabled={loading}
        className={`w-full rounded-none bg-yellow-500 py-3 font-semibold text-black transition hover:bg-yellow-400 active:scale-95 ${loading ? "cursor-not-allowed opacity-70" : ""}`}
      >
        {loading ? "Submitting order…" : paymentRequest && paymentStatus !== "Rejected"
          ? "View payment status"
          : paymentRequest ? "Submit a new payment request" : `Pay ${formatMoney(totalAmount)}`}
      </button>

      <button type="button" onClick={onBack} className="mt-1 text-sm text-gray-500 transition hover:underline dark:text-gray-400">
        ← Back to Cart
      </button>

      {showInstructions && paymentRequest && (
        <PaymentInstructionsModal
          paymentRequest={paymentRequest}
          customer={{
            ...localDetails,
            mobileMoneyNumber: paymentRequest.mobileMoneyNumber || localDetails.mobileMoneyNumber,
          }}
          items={paymentRequest.items || cartItems}
          status={paymentStatus}
          statusError={statusError}
          onClose={() => setShowInstructions(false)}
          onDone={onDone}
        />
      )}
    </div>
  );
}
