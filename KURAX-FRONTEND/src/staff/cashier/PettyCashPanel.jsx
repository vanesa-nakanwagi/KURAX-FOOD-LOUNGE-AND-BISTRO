/**
 * PettyCashPanel.jsx - expense-only petty cash ledger
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowDownCircle, Wallet, Trash2, Edit2,
  Plus, Loader, RefreshCcw, Receipt, AlertTriangle, Calendar, Filter, X, CheckCircle2,
} from "lucide-react";
import API_URL from "../../config/api";

// ── Helpers ──────────────────────────────────────────────────────────────────
function kampalaToday() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" })
  ).toISOString().split("T")[0];
}

const CATEGORIES = [
  "General", "Charcoal / Fuel", "Groceries / Ingredients", "Cleaning Supplies",
  "Utilities", "Maintenance", "Transport", "Staff Welfare", "Packaging", "Miscellaneous",
];

const CATEGORY_COLORS_LIGHT = {
  "Charcoal / Fuel": "text-orange-700 bg-orange-100 border-orange-200",
  "Groceries / Ingredients": "text-green-700 bg-green-100 border-green-200",
  "Cleaning Supplies": "text-blue-700 bg-blue-100 border-blue-200",
  "Utilities": "text-purple-700 bg-purple-100 border-purple-200",
  "Maintenance": "text-yellow-700 bg-yellow-100 border-yellow-200",
  "Transport": "text-cyan-700 bg-cyan-100 border-cyan-200",
  "Staff Welfare": "text-pink-700 bg-pink-100 border-pink-200",
  "Packaging": "text-indigo-700 bg-indigo-100 border-indigo-200",
  "General": "text-zinc-700 bg-zinc-100 border-zinc-200",
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function PettyCashPanel({ 
  role = "CASHIER", 
  staffName = "", 
  grossCash = 0, 
  theme = "light",
  onTotalChange
}) {
  const isDark = theme === "dark";
  const isCashier = role === "CASHIER";
  const today = kampalaToday();

  // ── State ─────────────────────────────────────────────────────────────────
  const [entries, setEntries] = useState([]);
  const [totalOut, setTotalOut] = useState(0); // Total expenses (money spent from petty cash)
  const [counterCash, setCounterCash] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [showForm, setShowForm] = useState(false);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [filterCat, setFilterCat] = useState("All");

  useEffect(() => {
    if (!toast.show) return;
    const timer = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    return () => clearTimeout(timer);
  }, [toast.show]);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // ── Fetch Logic ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = isCashier
        ? `${API_URL}/api/summaries/petty-cash?date=${today}`
        : `${API_URL}/api/summaries/petty-cash/range?from=${fromDate}&to=${toDate}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      
      const logs = data.entries || [];
      const outSum = Number(data.total_out) || 0;
      setEntries(logs);
      setTotalOut(outSum);
      setCounterCash(Number.isFinite(Number(data.cash_on_counter)) ? Number(data.cash_on_counter) : null);

      if (onTotalChange) onTotalChange(outSum, data.cash_on_counter);
      
    } catch (e) {
      setError("Could not load petty cash data.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [isCashier, today, fromDate, toDate, onTotalChange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Edit Handler ──────────────────────────────────────────────────────────
  const handleEdit = (entry) => {
    setEditing(entry);
    setAmount(String(entry.amount));
    setCategory(entry.category);
    setDescription(entry.description);
    setShowForm(true);
  };

  // ── Update Handler ─────────────────────────────────────────────────────────
  const handleUpdate = async () => {
    if (!amount || !description.trim() || !editing) return;
    setSubmitting(true);
    try {
      const newAmount = Number(amount);
      
      const res = await fetch(`${API_URL}/api/summaries/petty-cash/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: newAmount,
          category,
          description: description.trim(),
          logged_by: staffName || "Cashier",
        }),
      });
      if (!res.ok) throw new Error("Update failed");

      setEditing(null);
      setAmount("");
      setDescription("");
      setShowForm(false);
      fetchData();
      showToast("Entry updated successfully", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to update entry", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Create Handler ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!amount || !description.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/summaries/petty-cash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          category,
          description: description.trim(),
          logged_by: staffName || "Cashier",
        }),
      });
      if (!res.ok) throw new Error("Save failed");

      const saved = await res.json();
      
      setAmount("");
      setDescription("");
      setShowForm(false);
      fetchData();
      showToast(`Expense recorded. Counter cash: UGX ${Number(saved.cash_after ?? 0).toLocaleString()}`, "success");
    } catch (e) {
      setError("Failed to save entry.");
      showToast(e.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete Handler ─────────────────────────────────────────────────────────
  const handleDelete = async (entry) => {
    if (!window.confirm("Delete this entry?")) return;
    try {
      const res = await fetch(`${API_URL}/api/summaries/petty-cash/${entry.id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(error.error || 'Delete failed');
      }

      showToast("Entry deleted successfully.", "success");
      fetchData();
    } catch (e) {
      console.error(e);
      setError('Unable to delete expense. Please try again.');
      showToast(e.message, "error");
    }
  };

  // ── Cancel Edit ────────────────────────────────────────────────────────────
  const handleCancelEdit = () => {
    setEditing(null);
    setAmount("");
    setCategory("General");
    setDescription("");
    setShowForm(false);
  };

  const displayEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return filterCat === "All" ? sorted : sorted.filter(entry => entry.category === filterCat);
  }, [entries, filterCat]);

  const cashOnCounter = counterCash ?? ((Number(grossCash) || 0) - totalOut);

  const cardBg = "bg-white border-black/10 shadow-sm";
  const inputBg = "bg-zinc-50 border-zinc-200 focus:border-yellow-400";

  return (
    <div className="min-h-screen font-[Outfit] pb-20 bg-zinc-50 text-zinc-900">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b px-5 py-4 flex items-center justify-between gap-4 bg-white/95 backdrop-blur-xl border-black/10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-500 flex items-center justify-center text-black">
            <Wallet size={20} />
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tighter leading-none text-zinc-900">Petty Cash</h1>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{isCashier ? `Today · ${today}` : "Management View"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="w-9 h-9 rounded-xl border border-black/10 flex items-center justify-center hover:bg-zinc-100 transition-all">
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          {isCashier && !editing && (
            <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-yellow-500 text-black rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-yellow-600 transition-all">
              {showForm ? "Cancel" : "Log Entry"}
            </button>
          )}
          {editing && (
            <button onClick={handleCancelEdit} className="px-4 py-2 bg-red-100 text-red-700 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-red-200 transition-all">
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-6 space-y-5">
        {/* Totals Section - CORRECTED DISPLAY */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {isCashier && (
            <div className="col-span-2 sm:col-span-3 p-5 rounded-2xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-black border border-yellow-400 shadow-lg">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Cash on Counter</p>
              <p className="text-3xl font-black">UGX {cashOnCounter.toLocaleString()}</p>
              <div className="grid grid-cols-2 gap-2 mt-2 text-[9px] font-bold">
                <div>
                  <p className="opacity-50">Gross Cash</p>
                  <p>+ UGX {Number(grossCash).toLocaleString()}</p>
                </div>
                <div>
                  <p className="opacity-50">Petty Expenses</p>
                  <p className="text-red-800">- UGX {totalOut.toLocaleString()}</p>
                </div>
              </div>
              <p className="text-[7px] font-bold opacity-60 mt-2">
                Cash on Counter = Gross Cash - Petty Expenses
              </p>
            </div>
          )}
          
          <div className="p-4 rounded-2xl border bg-red-50 border-red-200">
            <ArrowDownCircle size={18} className="text-red-600 mb-1" />
            <p className="text-[8px] font-black uppercase text-red-700">Petty Expenses</p>
            <p className="text-lg font-black text-red-700">UGX {totalOut.toLocaleString()}</p>
            <p className="text-[7px] text-red-600 mt-1">Deducted from counter cash</p>
          </div>
        </div>

        {/* Log Form (Create or Edit) */}
        {isCashier && showForm && (
          <div className={`p-5 rounded-2xl border ${cardBg} space-y-4 shadow-2xl animate-in slide-in-from-top duration-300`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900">
                {editing ? "Edit Entry" : "New Entry"}
              </h3>
              {editing && (
                <span className="text-[8px] text-yellow-600 font-black uppercase">Editing ID: #{editing.id}</span>
              )}
            </div>
            
            <p className="text-xs text-zinc-600">Available counter cash: <strong>UGX {cashOnCounter.toLocaleString()}</strong>. This expense is deducted when recorded.</p>
            
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-black">UGX</span>
              <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                placeholder="0" 
                className={`w-full bg-${inputBg} border border-zinc-200 rounded-xl pl-12 pr-4 py-4 text-zinc-900 font-black text-lg outline-none focus:border-yellow-500 transition-all`} 
              />
            </div>
            <select 
              value={category} 
              onChange={e => setCategory(e.target.value)} 
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-900 font-bold outline-none focus:border-yellow-500 transition-all"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Description..." 
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-900 font-bold outline-none focus:border-yellow-500 transition-all h-24 resize-none" 
            />
            <div className="text-[10px] text-zinc-600 p-3 rounded-xl bg-zinc-100 border border-zinc-200">
              <p className="font-black uppercase tracking-widest">Accounting Impact:</p>
              <p className="mt-1">UGX {Number(amount || 0).toLocaleString()} is deducted from counter cash.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={editing ? handleUpdate : handleSubmit} 
                disabled={submitting || !amount || !description.trim()} 
                className="flex-1 py-4 bg-yellow-500 text-black rounded-xl font-black uppercase text-sm tracking-widest hover:bg-yellow-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader size={16} className="animate-spin mx-auto" /> : (editing ? "Update Entry" : "Save Entry")}
              </button>
              {editing && (
                <button 
                  onClick={handleCancelEdit}
                  className="px-6 py-4 bg-red-100 text-red-700 rounded-xl font-black uppercase text-sm tracking-widest hover:bg-red-200 transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Entries List */}
        <div className={`rounded-3xl border overflow-hidden ${cardBg}`}>
          {toast.show && (
            <div className={`fixed top-20 right-6 z-[50] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-right duration-300
              ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
              <span className="text-sm font-bold tracking-wide">{toast.message}</span>
            </div>
          )}
          <div className="p-4 border-b border-black/10 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Transaction History</p>
              <p className="text-[8px] text-zinc-400 mt-0.5">{displayEntries.length} entries</p>
            </div>
            <Filter size={14} className="text-zinc-400" />
          </div>
          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {displayEntries.length === 0 ? (
              <div className="text-center py-12">
                <Wallet size={32} className="mx-auto text-zinc-400 mb-3" />
                <p className="text-zinc-500 font-black uppercase text-[10px]">No entries for today</p>
                <p className="text-[8px] text-zinc-400 mt-1">Add your first petty cash transaction</p>
              </div>
            ) : (
              displayEntries.map(entry => {
                const categoryColor = CATEGORY_COLORS_LIGHT[entry.category] || CATEGORY_COLORS_LIGHT["General"];
                return (
                  <div key={entry.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all hover:shadow-md bg-white border-zinc-200`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-red-100 text-red-600">
                        <ArrowDownCircle size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-zinc-900 leading-tight truncate">{entry.description}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${categoryColor}`}>
                            {entry.category}
                          </span>
                          <span className="text-[8px] text-zinc-500">by {entry.logged_by}</span>
                          <span className="text-[8px] text-zinc-400">{new Date(entry.created_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="font-black text-base text-red-600">
                        - UGX {Number(entry.amount).toLocaleString()}
                      </p>
                      {isCashier && (
                        <div className="flex items-center justify-end gap-2 mt-1">
                          <button 
                            onClick={() => handleEdit(entry)} 
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Edit entry"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button 
                            onClick={() => handleDelete(entry)} 
                            className="text-zinc-500 hover:text-red-600 transition-colors"
                            title="Delete entry"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}