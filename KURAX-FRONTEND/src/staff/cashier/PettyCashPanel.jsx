/**
 * PettyCashPanel.jsx - FULL CORRECTED VERSION
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowDownCircle, ArrowUpCircle, Wallet, Trash2,
  Plus, Loader, RefreshCcw, Receipt, AlertTriangle, Calendar, Filter, X,
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

const CATEGORY_COLORS = {
  "Charcoal / Fuel": "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "Groceries / Ingredients": "text-green-400 bg-green-500/10 border-green-500/20",
  "Cleaning Supplies": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "Utilities": "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "Maintenance": "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  "Transport": "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  "Staff Welfare": "text-pink-400 bg-pink-500/10 border-pink-500/20",
  "Packaging": "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  "General": "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function PettyCashPanel({ 
  role = "CASHIER", 
  staffName = "", 
  grossCash = 0, 
  theme = "dark",
  onTotalChange // CRITICAL: Updates the Dashboard's "Cash on Counter"
}) {
  const isDark = theme === "dark";
  const isCashier = role === "CASHIER";
  const today = kampalaToday();

  // ── State ─────────────────────────────────────────────────────────────────
  const [entries, setEntries] = useState([]);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [direction, setDirection] = useState("OUT");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [filterCat, setFilterCat] = useState("All");

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
      setTotalIn(Number(data.total_in) || 0);
      setTotalOut(outSum);

      // Notify the Dashboard of the new total so "Cash on Counter" updates
      if (onTotalChange) onTotalChange(outSum);
      
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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!amount || !description.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/summaries/petty-cash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          direction,
          category,
          description: description.trim(),
          logged_by: staffName || "Cashier",
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      
      setAmount("");
      setDescription("");
      setShowForm(false);
      fetchData(); // Refresh list
    } catch (e) {
      setError("Failed to save entry.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await fetch(`${API_URL}/api/summaries/petty-cash/${id}`, { method: "DELETE" });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // ── Calculations ──────────────────────────────────────────────────────────
  const cashOnCounter = Math.max(0, (Number(grossCash) || 0) - totalOut);
  
  const displayEntries = useMemo(() => {
    let bal = 0;
    const sorted = [...entries].reverse().map(e => {
      const amt = Number(e.amount);
      bal += e.direction === "IN" ? amt : -amt;
      return { ...e, _balance: bal };
    });
    const reversed = sorted.reverse();
    return filterCat === "All" ? reversed : reversed.filter(e => e.category === filterCat);
  }, [entries, filterCat]);

  const cardBg = isDark ? "bg-zinc-900 border-white/5" : "bg-white border-black/5 shadow-sm";

  return (
    <div className={`min-h-screen font-[Outfit] pb-20 ${isDark ? "bg-black text-white" : "bg-zinc-50 text-zinc-900"}`}>
      {/* Header */}
      <div className={`sticky top-0 z-20 border-b px-5 py-4 flex items-center justify-between gap-4 ${isDark ? "bg-zinc-950/95 backdrop-blur-xl border-white/5" : "bg-white/95 backdrop-blur-xl border-black/5 shadow-sm"}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-500 flex items-center justify-center text-black">
            <Wallet size={20} />
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tighter leading-none">Petty Cash</h1>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{isCashier ? `Today · ${today}` : "Management View"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center">
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          {isCashier && (
            <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-yellow-500 text-black rounded-xl font-black text-[11px] uppercase tracking-widest">
              {showForm ? "Cancel" : "Log Entry"}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-6 space-y-5">
        {/* Totals Section */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {isCashier && (
            <div className="col-span-2 sm:col-span-4 p-5 rounded-2xl bg-yellow-500 text-black border border-yellow-400">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Cash on Counter</p>
              <p className="text-3xl font-black">UGX {cashOnCounter.toLocaleString()}</p>
              <p className="text-[9px] font-bold opacity-40 mt-1">Gross: {Number(grossCash).toLocaleString()} | Out: {totalOut.toLocaleString()}</p>
            </div>
          )}
          <div className={`p-4 rounded-2xl border ${isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50"}`}>
            <ArrowDownCircle size={18} className="text-red-400 mb-1" />
            <p className="text-[8px] font-black uppercase opacity-60">Total Spent</p>
            <p className="text-lg font-black text-red-400">UGX {totalOut.toLocaleString()}</p>
          </div>
          <div className={`p-4 rounded-2xl border ${isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50"}`}>
            <ArrowUpCircle size={18} className="text-emerald-400 mb-1" />
            <p className="text-[8px] font-black uppercase opacity-60">Total In</p>
            <p className="text-lg font-black text-emerald-400">UGX {totalIn.toLocaleString()}</p>
          </div>
        </div>

        {/* Log Form */}
        {isCashier && showForm && (
          <div className={`p-5 rounded-2xl border ${cardBg} space-y-4 shadow-2xl`}>
            <div className="flex gap-2">
              <button onClick={() => setDirection("OUT")} className={`flex-1 py-3 rounded-xl border-2 font-black text-[10px] uppercase ${direction === "OUT" ? "bg-red-500 border-red-500 text-white" : "border-white/5 text-zinc-500"}`}>Expense (OUT)</button>
              <button onClick={() => setDirection("IN")} className={`flex-1 py-3 rounded-xl border-2 font-black text-[10px] uppercase ${direction === "IN" ? "bg-emerald-500 border-emerald-500 text-white" : "border-white/5 text-zinc-500"}`}>Income (IN)</button>
            </div>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (UGX)" className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white font-black outline-none focus:border-yellow-500" />
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white font-bold outline-none">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description..." className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white font-bold outline-none h-20" />
            <button onClick={handleSubmit} disabled={submitting} className="w-full py-4 bg-yellow-500 text-black rounded-xl font-black uppercase text-xs">
              {submitting ? "Saving..." : "Save Entry"}
            </button>
          </div>
        )}

        {/* Entries List */}
        <div className={`rounded-3xl border overflow-hidden ${cardBg}`}>
          <div className="p-4 border-b border-white/5 flex justify-between items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">History</p>
            <Filter size={14} className="text-zinc-500" />
          </div>
          <div className="p-4 space-y-3">
            {displayEntries.length === 0 ? (
              <p className="text-center py-10 text-zinc-600 font-bold uppercase text-[10px]">No entries for today</p>
            ) : (
              displayEntries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${entry.direction === "OUT" ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                      {entry.direction === "OUT" ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-black text-white leading-tight">{entry.description}</p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase mt-0.5">{entry.category} • {entry.logged_by}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-sm ${entry.direction === "OUT" ? "text-red-400" : "text-emerald-400"}`}>
                      {entry.direction === "OUT" ? "-" : "+"} {Number(entry.amount).toLocaleString()}
                    </p>
                    {isCashier && (
                      <button onClick={() => handleDelete(entry.id)} className="text-zinc-600 hover:text-red-500 transition-colors mt-1">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}