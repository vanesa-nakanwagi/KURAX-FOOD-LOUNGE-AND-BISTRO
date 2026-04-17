// ─── CreditRequestModal.jsx ───────────────────────────────────────────────────
// Shown to waiter when they select "Credit" as payment method on an order.
// Collects client details and submits a credit request.
// Props:
//   order       – the order object { id, table_name, total, label }
//   waiterName  – logged-in waiter's name
//   onClose     – close modal
//   onCreated   – callback after successful credit creation

// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import {
  X, User, Phone, Calendar, BookOpen,
  CheckCircle, AlertTriangle, Loader2
} from "lucide-react";
import API_URL from "../../../config/api";

export default function CreditRequestModal({ order, waiterName, onClose, onCreated }) {
  const [clientName,  setClientName]  = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [payBy,       setPayBy]       = useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [done,        setDone]        = useState(false);

  const amount = Number(order?.total || order?.amount || 0);

  const validate = () => {
    if (!clientName.trim()) return "Client name is required";
    if (!payBy)             return "Expected payment date is required";
    return "";
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/credits`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          order_id:     order?.id     || null,
          table_name:   order?.table_name || "WALK-IN",
          label:        order?.label  || `Order #${order?.id}`,
          amount,
          client_name:  clientName.trim(),
          client_phone: clientPhone.trim() || null,
          pay_by:       payBy || null,
          waiter_name:  waiterName,
        }),
      });

      if (!res.ok) {
        const e = await res.json();
        setError(e.error || "Failed to create credit request");
        setLoading(false);
        return;
      }

      const credit = await res.json();
      setDone(true);
      setTimeout(() => {
        onCreated?.(credit);
        onClose();
      }, 1800);
    } catch (e) {
      setError("Network error – please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0f0f0f] border border-purple-500/20 rounded-[3rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-5 border-b border-white/5">
          <div>
            <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1">
              Credit / On-Account Request
            </p>
            <h2 className="text-lg font-black text-white uppercase italic tracking-tighter">
              {order?.table_name || "Table"}
            </h2>
            <p className="text-zinc-500 text-xs mt-0.5">
              UGX {amount.toLocaleString()} will be placed on account
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-zinc-900 rounded-full text-zinc-500 hover:text-white transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success state */}
        {done ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-16 h-16 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center animate-in zoom-in-75 duration-300">
              <CheckCircle size={28} className="text-purple-400" />
            </div>
            <p className="text-white font-black uppercase text-sm tracking-tight">Credit Request Sent!</p>
            <p className="text-zinc-500 text-[11px] text-center">
              Cashier will forward this to manager for approval.
            </p>
          </div>
        ) : (
          <div className="space-y-5">

            {/* Amount display */}
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-3xl p-5 text-center">
              <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-2">Amount on Credit</p>
              <p className="text-3xl font-black text-white italic tracking-tighter">
                <span className="text-sm mr-2 opacity-50 not-italic font-bold">UGX</span>
                {amount.toLocaleString()}
              </p>
            </div>

            {/* Client Name */}
            <div>
              <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                Client Full Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type="text"
                  value={clientName}
                  onChange={e => { setClientName(e.target.value); setError(""); }}
                  placeholder="Enter client's full name"
                  className="w-full bg-black border border-white/10 rounded-2xl p-4 pl-10 text-white font-bold text-sm outline-none focus:border-purple-500/50 placeholder:text-zinc-700"
                />
              </div>
            </div>

            {/* Client Phone */}
            <div>
              <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                Phone Number <span className="text-zinc-700">(optional but recommended)</span>
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  placeholder="+256 7XX XXX XXX"
                  className="w-full bg-black border border-white/10 rounded-2xl p-4 pl-10 text-white font-bold text-sm outline-none focus:border-purple-500/50 placeholder:text-zinc-700"
                />
              </div>
            </div>

            {/* Expected pay-by date */}
            <div>
              <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                Expected Payment Date <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type="date"
                  value={payBy}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={e => { setPayBy(e.target.value); setError(""); }}
                  className="w-full bg-black border border-white/10 rounded-2xl p-4 pl-10 text-white font-bold text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Warning */}
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4 flex gap-3">
              <AlertTriangle size={14} className="text-yellow-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-yellow-400 font-bold leading-relaxed">
                This credit must be approved by a manager before it is recorded.
                The cashier will forward your request immediately.
              </p>
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-400 text-[10px] font-black text-center uppercase tracking-widest">
                ⚠ {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-4 text-zinc-600 font-black uppercase text-[10px] tracking-widest hover:text-zinc-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !clientName.trim() || !payBy}
                className={`flex-[2] py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all
                  ${!loading && clientName.trim() && payBy
                    ? "bg-purple-500 text-white hover:bg-purple-400 active:scale-[0.98] shadow-xl shadow-purple-500/20"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}
              >
                {loading
                  ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
                  : <><BookOpen size={14} /> Submit Credit Request</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}