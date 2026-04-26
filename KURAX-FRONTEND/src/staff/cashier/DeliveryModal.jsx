import React, { useState, useEffect } from "react";
import { X, Bike, User, Phone, MapPin, Send, CheckCircle2 } from "lucide-react";
import API_URL from "../../config/api";

// ─── DELIVERY MODAL ───────────────────────────────────────────────────────────
// Cashier opens this from any pending order to convert it to a delivery.
// Pulls active riders from DB, captures client info, fires SMS on submit.
//
// Props:
//   order        — the cashier_queue or orders row being dispatched
//   cashierName  — logged-in cashier's name (for SMS attribution)
//   onClose()    — close without saving
//   onCreated()  — called after delivery is created (triggers parent re-fetch)

export default function DeliveryModal({ order, cashierName, onClose, onCreated }) {
  const [riders,    setRiders]    = useState([]);
  const [riderId,   setRiderId]   = useState("");
  const [clientName,    setClientName]    = useState("");
  const [clientPhone,   setClientPhone]   = useState("");
  const [address,       setAddress]       = useState("");
  const [note,          setNote]          = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [ridersLoading, setRidersLoading] = useState(true);
  const [error,         setError]         = useState("");

  // Pre-fill client info — cashier_queue rows use credit_name/credit_phone
  // orders rows use client_name/client_phone
  useEffect(() => {
    if (!order) return;
    const name  = order.client_name  || order.credit_name  || "";
    const phone = order.client_phone || order.credit_phone || "";
    if (name)  setClientName(name);
    if (phone) setClientPhone(phone);
  }, [order]);

  // Fetch active riders
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${API_URL}/api/delivery/riders`);
        const data = await res.json();
        setRiders(data);
      } catch { /* silent */ }
      finally { setRidersLoading(false); }
    })();
  }, []);

  const canSubmit = riderId && clientPhone.trim().length >= 9;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");

    // order_ids is the array of actual orders.id values on the cashier_queue row.
    // order.id is the cashier_queue row id — NOT the orders table id.
    // We need the first entry from order_ids to update the orders table.
    const actualOrderId = order?.order_ids?.[0] ?? order?.id;

    try {
      const res = await fetch(`${API_URL}/api/delivery/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id:         actualOrderId,
          cashier_queue_id: order.id,
          rider_id:         Number(riderId),
          client_name:      clientName.trim() || "Client",
          client_phone:     clientPhone.trim(),
          delivery_address: address.trim(),
          delivery_note:    note.trim(),
          cashier_name:     cashierName,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create delivery"); setSubmitting(false); return; }
      onCreated(data);
      onClose();
    } catch (e) {
      setError("Network error — please try again");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-white/95 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white border border-zinc-200 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-zinc-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-4 sm:pt-6 border-b border-zinc-100">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-yellow-600 uppercase mb-0.5">New Delivery</p>
            <h2 className="text-lg font-black uppercase italic text-zinc-900 tracking-tight leading-none">
              {order?.table_name || `Order #${order?.id}`} · UGX {Number(order?.total || order?.amount || 0).toLocaleString()}
            </h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-500 hover:text-zinc-700 flex items-center justify-center transition-all">
            <X size={16}/>
          </button>
        </div>

        <div className="overflow-y-auto max-h-[80vh] sm:max-h-none px-5 pb-6 pt-4 space-y-4">

          {/* Rider picker */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2 flex items-center gap-1.5">
              <Bike size={11}/> Assign Rider <span className="text-red-500">*</span>
            </p>
            {ridersLoading ? (
              <div className="h-12 rounded-xl bg-zinc-100 animate-pulse" />
            ) : riders.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No active riders. Ask the director to add riders.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {riders.map(r => (
                  <button key={r.id} onClick={() => setRiderId(String(r.id))}
                    className={`py-3 px-4 rounded-xl border-2 font-black text-xs uppercase tracking-wide transition-all text-left
                      ${riderId === String(r.id)
                        ? "bg-yellow-50 border-yellow-400 text-yellow-700 shadow-sm"
                        : "border-zinc-200 bg-white text-zinc-500 hover:border-yellow-300"}`}>
                    <div className="font-black text-sm text-zinc-800">{r.name}</div>
                    {r.phone && <div className="text-[10px] opacity-70 font-bold mt-0.5 text-zinc-500">{r.phone}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Client info */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Client Details</p>
            <div className="relative">
              <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
              <input
                type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                placeholder="Client name (optional)"
                className="w-full bg-white border border-zinc-200 rounded-xl py-3 pl-9 pr-4 text-sm text-zinc-800 font-bold outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 placeholder:text-zinc-400"
              />
            </div>
            <div className="relative">
              <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
              <input
                type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                placeholder="Phone number * (for SMS)"
                className={`w-full bg-white border rounded-xl py-3 pl-9 pr-4 text-sm text-zinc-800 font-bold outline-none focus:ring-1 placeholder:text-zinc-400
                  ${clientPhone.trim().length > 0 && clientPhone.trim().length < 9
                    ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                    : "border-zinc-200 focus:border-yellow-400 focus:ring-yellow-400"}`}
              />
            </div>
            <div className="relative">
              <MapPin size={13} className="absolute left-3 top-3.5 text-zinc-400"/>
              <input
                type="text" value={address} onChange={e => setAddress(e.target.value)}
                placeholder="Delivery address (optional)"
                className="w-full bg-white border border-zinc-200 rounded-xl py-3 pl-9 pr-4 text-sm text-zinc-800 font-bold outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 placeholder:text-zinc-400"
              />
            </div>
            <textarea
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="Delivery note (optional)…"
              className="w-full bg-white border border-zinc-200 rounded-xl py-3 px-4 text-sm text-zinc-800 font-bold outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 resize-none h-16 placeholder:text-zinc-400"
            />
          </div>

          {/* SMS notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <Send size={12} className="text-yellow-600 shrink-0 mt-0.5"/>
            <p className="text-[10px] text-yellow-700 font-bold leading-relaxed">
              An SMS confirmation will be sent to the client when you submit, and again when the rider is dispatched and when payment is received.
            </p>
          </div>

          {error && (
            <p className="text-[11px] text-red-600 font-bold text-center">{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className={`w-full py-4 rounded-xl font-black uppercase italic text-sm tracking-widest transition-all active:scale-[0.98]
              ${canSubmit && !submitting
                ? "bg-yellow-500 text-black hover:bg-yellow-600 shadow-lg shadow-yellow-500/30"
                : "bg-zinc-100 text-zinc-400 cursor-not-allowed"}`}>
            {submitting ? "Creating & Sending SMS…" : "Assign Rider & Notify Client"}
          </button>
        </div>
      </div>
    </div>
  );
}