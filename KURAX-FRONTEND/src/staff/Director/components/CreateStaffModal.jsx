import React, { useState, useEffect } from "react";
import { X, Mail, Eye, EyeOff, RefreshCcw } from "lucide-react";

const ROLES = [
  "WAITER", "CASHIER", "CHEF", "MANAGER", "DIRECTOR",
  "CONTENT-MANAGER", "ACCOUNTANT", "BARISTA", "BARMAN", "SUPERVISOR",
];

export default function CreateStaffModal({ onClose, onSave, initialData, staffList }) {
  const [showPin,      setShowPin]      = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ id: null, name: "", email: "", role: "SELECT ROLE", pin: "" });

  useEffect(() => {
    if (initialData) {
      setForm({
        id:    initialData.id,
        name:  initialData.name,
        email: initialData.email || "",
        role:  initialData.role,
        pin:   initialData.pin,
      });
    } else {
      setForm({ id: null, name: "", email: "", role: "SELECT ROLE", pin: "" });
    }
  }, [initialData]);

  const genPin = () => {
    setForm(p => ({ ...p, pin: Math.floor(1000 + Math.random() * 9000).toString() }));
    setShowPin(true);
  };

  const submit = async () => {
    setIsSubmitting(true);
    if (!form.name || !form.email || form.role === "SELECT ROLE" || !form.pin) {
      alert("Fill in all fields!"); setIsSubmitting(false); return;
    }
    if (form.pin.length !== 4) {
      alert("PIN must be 4 digits."); setIsSubmitting(false); return;
    }
    const taken = (staffList || []).find(s => String(s.pin) === String(form.pin) && s.id !== form.id);
    if (taken) {
      alert(`PIN ${form.pin} is already taken by ${taken.name}.`); setIsSubmitting(false); return;
    }
    try { await onSave({ ...form }); }
    catch { alert("Something went wrong."); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-md sm:mx-4 rounded-t-[2rem] sm:rounded-[2rem] p-5 sm:p-10 shadow-2xl border
        max-h-[95dvh] overflow-y-auto bg-white border-gray-200">

        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-black italic uppercase text-yellow-600">
            {initialData ? "Edit Account" : "Create Account"}
          </h2>
          <button onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="FULL NAME"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className="w-full bg-white border border-gray-300 p-3.5 rounded-xl text-sm font-bold focus:border-yellow-500 outline-none"
          />

          <div className="relative">
            <input
              type="email"
              placeholder="EMAIL ADDRESS"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full bg-white border border-gray-300 p-3.5 pl-10 rounded-xl text-sm font-bold focus:border-yellow-500 outline-none"
            />
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          <select
            value={form.role}
            onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
            className="w-full bg-white border border-gray-300 p-3.5 rounded-xl text-sm font-bold focus:border-yellow-500 outline-none"
          >
            <option disabled value="SELECT ROLE">SELECT ROLE</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <div className="relative">
            <input
              type={showPin ? "text" : "password"}
              placeholder="ACCESS PIN (4 digits)"
              value={form.pin}
              maxLength={4}
              onChange={e => setForm(p => ({ ...p, pin: e.target.value }))}
              className="w-full bg-white border border-gray-300 p-3.5 pr-20 rounded-xl text-sm font-bold focus:border-yellow-500 outline-none"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <button
                type="button"
                onClick={genPin}
                className="p-2 text-gray-500 hover:text-yellow-600 transition-colors"
              >
                <RefreshCcw size={14} />
              </button>
              <button
                type="button"
                onClick={() => setShowPin(p => !p)}
                className="p-2 text-gray-500 hover:text-yellow-600 transition-colors"
              >
                {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {!initialData && (
            <p className="text-[9px] italic px-1 text-gray-500">
              * Login details emailed on activation.
            </p>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 font-black uppercase italic text-xs text-gray-500"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={submit}
              className={`flex-[2] py-3.5 rounded-2xl font-black uppercase italic text-sm transition-all active:scale-95
                ${isSubmitting ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-yellow-500 text-black hover:bg-yellow-400"}`}
            >
              {isSubmitting ? "Processing…" : (initialData ? "Update Profile" : "Activate Account")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}