import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import API_URL from "../../../config/api";

function authHeaders(json = false) {
  try {
    const user = JSON.parse(localStorage.getItem("kurax_user") || "null");
    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
    };
  } catch {
    return json ? { "Content-Type": "application/json" } : {};
  }
}

export default function SpecialDiscountSettings() {
  const [type, setType] = useState("percentage");
  const [value, setValue] = useState("0");
  const [updatedBy, setUpdatedBy] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/api/discounts/config`, { headers: authHeaders(), cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Unable to load discount settings.");
        if (active) {
          setType(result.max_discount_type || "percentage");
          setValue(String(result.max_discount_value ?? result.max_discount_percent ?? 0));
          setUpdatedBy(result.updated_by_name || "");
          setUpdatedAt(result.updated_at || "");
        }
      })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/api/discounts/config`, {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({ max_discount_type: type, max_discount_value: Number(value) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to save discount settings.");
      setType(result.max_discount_type);
      setValue(String(result.max_discount_value));
      setUpdatedBy(result.updated_by_name || "");
      setUpdatedAt(result.updated_at || "");
      setNotice("Cashier discount limit saved.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="max-w-3xl space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-black uppercase text-gray-900">Special bill discount limit</h2>
        <p className="mt-1 text-xs text-gray-500">Set the maximum amount a cashier may discount from one unpaid bill.</p>
      </div>
      {error && <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{error}</p>}
      {notice && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 size={16} />{notice}</p>}
      {loading ? <p className="text-sm text-gray-500">Loading settings…</p> : (
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Limit type
              <select value={type} onChange={(event) => setType(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900">
                <option value="percentage">Percentage of unpaid bill</option>
                <option value="fixed">Fixed UGX amount</option>
              </select>
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Maximum {type === "percentage" ? "percentage" : "amount (UGX)"}
              <input
                type="number"
                min="0"
                max={type === "percentage" ? "100" : undefined}
                step="0.01"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900"
              />
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Cashiers may choose a percentage or fixed discount, but cannot exceed this limit or the bill’s unpaid balance.
          </p>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-xs font-black uppercase text-black disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? "Saving…" : "Save limit"}
          </button>
        </form>
      )}
      {updatedBy && <p className="text-[10px] text-gray-500">Last updated by {updatedBy}{updatedAt ? ` · ${new Date(updatedAt).toLocaleString()}` : ""}</p>}
    </section>
  );
}
