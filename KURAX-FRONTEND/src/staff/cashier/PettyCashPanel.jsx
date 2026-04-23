/**
 * PettyCashPanel.jsx - WITH EDIT FUNCTIONALITY - FIXED
 * Correct Accounting Logic:
 * - Replenishment (IN): Money moved from main cash drawer to petty cash wallet
 *   → Decreases Cash on Counter
 *   → Increases Petty Cash Balance
 * - Expense (OUT): Money spent from petty cash wallet
 *   → Does NOT affect Cash on Counter
 *   → Decreases Petty Cash Balance
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowDownCircle, ArrowUpCircle, Wallet, Trash2, Edit2,
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
  "Cash Replenishment", "Surplus Handover", "Loan Return"
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
  "Cash Replenishment": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "Surplus Handover": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "Loan Return": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "General": "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function PettyCashPanel({ 
  role = "CASHIER", 
  staffName = "", 
  grossCash = 0, 
  theme = "dark",
  onTotalChange
}) {
  const isDark = theme === "dark";
  const isCashier = role === "CASHIER";
  const today = kampalaToday();

  // ── State ─────────────────────────────────────────────────────────────────
  const [entries, setEntries] = useState([]);
  const [totalIn, setTotalIn] = useState(0);  // Total replenishment (money added to petty cash)
  const [totalOut, setTotalOut] = useState(0); // Total expenses (money spent from petty cash)
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [showForm, setShowForm] = useState(false);

  const [direction, setDirection] = useState("OUT");
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
      const inSum = Number(data.total_in) || 0;
      
      setEntries(logs);
      setTotalOut(outSum);
      setTotalIn(inSum);

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

  // ── Edit Handler ──────────────────────────────────────────────────────────
  const handleEdit = (entry) => {
    setEditing(entry);
    setDirection(entry.direction);
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
      const oldAmount = Number(editing.amount);
      const newAmount = Number(amount);
      const oldDirection = editing.direction;
      const newDirection = direction;
      
      const res = await fetch(`${API_URL}/api/summaries/petty-cash/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: newAmount,
          direction: newDirection,
          category,
          description: description.trim(),
          logged_by: staffName || "Cashier",
        }),
      });
      if (!res.ok) throw new Error("Update failed");

      // Adjust totals based on changes
      if (oldDirection === "OUT") {
        setTotalOut(prev => Math.max(0, prev - oldAmount));
      } else {
        setTotalIn(prev => Math.max(0, prev - oldAmount));
      }
      
      if (newDirection === "OUT") {
        setTotalOut(prev => prev + newAmount);
      } else {
        setTotalIn(prev => prev + newAmount);
      }

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
          direction,
          category,
          description: description.trim(),
          logged_by: staffName || "Cashier",
        }),
      });
      if (!res.ok) throw new Error("Save failed");

      const saved = await res.json();
      
      if (direction === "OUT") {
        setTotalOut(prev => prev + Number(saved.amount || 0));
      } else {
        setTotalIn(prev => prev + Number(saved.amount || 0));
      }

      setAmount("");
      setDescription("");
      setShowForm(false);
      fetchData();
      showToast(`Entry added successfully`, "success");
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

      if (entry.direction === "OUT") {
        setTotalOut(prev => Math.max(0, prev - Number(entry.amount || 0)));
      } else {
        setTotalIn(prev => Math.max(0, prev - Number(entry.amount || 0)));
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
    setDirection("OUT");
    setAmount("");
    setCategory("General");
    setDescription("");
    setShowForm(false);
  };

  // ── Calculations - CORRECTED ACCOUNTING LOGIC ──────────────────────────────
  // Gross Cash: Total cash collected from customers (from daily summary)
  // Replenishment (IN): Money moved from main drawer to petty cash wallet
  //   → DECREASES cash on counter
  //   → INCREASES petty cash balance
  // Expense (OUT): Money spent from petty cash wallet
  //   → DOES NOT affect cash on counter (money already moved)
  //   → DECREASES petty cash balance
  
  const cashOnCounter = Math.max(0, (Number(grossCash) || 0) - totalIn);
  const pettyCashBalance = totalIn - totalOut;
  
  console.log("Petty Cash Calculation (Corrected):", {
    grossCash: Number(grossCash),
    replenishmentTotal: totalIn,
    expensesTotal: totalOut,
    cashOnCounter: cashOnCounter,
    pettyCashBalance: pettyCashBalance
  });

  const displayEntries = useMemo(() => {
    let bal = 0;
    // Sort by date (oldest first) to calculate running balance correctly
    const sortedByDate = [...entries].sort((a, b) => 
      new Date(a.created_at) - new Date(b.created_at)
    );
    
    const withBalance = sortedByDate.map(e => {
      const amt = Number(e.amount);
      if (e.direction === "IN") {
        bal += amt;
      } else {
        bal -= amt;
      }
      return { ...e, _balance: bal };
    });
    
    // Reverse for display (newest first)
    const reversed = withBalance.reverse();
    
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
          <button onClick={fetchData} className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all">
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          {isCashier && !editing && (
            <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-yellow-500 text-black rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-yellow-400 transition-all">
              {showForm ? "Cancel" : "Log Entry"}
            </button>
          )}
          {editing && (
            <button onClick={handleCancelEdit} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-red-500/30 transition-all">
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
                  <p className="opacity-50">Replenishment</p>
                  <p className="text-red-800">- UGX {totalIn.toLocaleString()}</p>
                </div>
              </div>
              <p className="text-[7px] font-bold opacity-60 mt-2">
                Cash on Counter = Gross Cash - Replenishment
              </p>
            </div>
          )}
          
          {/* Total Replenishment (IN) - Money moved to petty cash */}
          <div className={`p-4 rounded-2xl border ${isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50"}`}>
            <ArrowUpCircle size={18} className="text-emerald-400 mb-1" />
            <p className="text-[8px] font-black uppercase opacity-60">Total Replenishment (IN)</p>
            <p className="text-lg font-black text-emerald-400">UGX {totalIn.toLocaleString()}</p>
            <p className="text-[7px] text-zinc-500 mt-1">Money moved TO petty cash wallet</p>
          </div>
          
          {/* Total Expenses (OUT) - Money spent from petty cash */}
          <div className={`p-4 rounded-2xl border ${isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50"}`}>
            <ArrowDownCircle size={18} className="text-red-400 mb-1" />
            <p className="text-[8px] font-black uppercase opacity-60">Total Expenses (OUT)</p>
            <p className="text-lg font-black text-red-400">UGX {totalOut.toLocaleString()}</p>
            <p className="text-[7px] text-zinc-500 mt-1">Money spent FROM petty cash</p>
          </div>
          
          {/* Petty Cash Balance */}
          <div className={`p-4 rounded-2xl border ${pettyCashBalance >= 0 ? (isDark ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-50") : (isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50")}`}>
            <Wallet size={18} className={pettyCashBalance >= 0 ? "text-blue-400" : "text-red-400"} />
            <p className="text-[8px] font-black uppercase opacity-60">Petty Cash Balance</p>
            <p className={`text-lg font-black ${pettyCashBalance >= 0 ? "text-blue-400" : "text-red-400"}`}>
              UGX {pettyCashBalance.toLocaleString()}
            </p>
            <p className="text-[7px] text-zinc-500 mt-1">
              {pettyCashBalance >= 0 ? "IN - OUT" : "Negative balance - needs replenishment"}
            </p>
          </div>
        </div>

        {/* Log Form (Create or Edit) */}
        {isCashier && showForm && (
          <div className={`p-5 rounded-2xl border ${cardBg} space-y-4 shadow-2xl animate-in slide-in-from-top duration-300`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black uppercase tracking-wider">
                {editing ? "Edit Entry" : "New Entry"}
              </h3>
              {editing && (
                <span className="text-[8px] text-yellow-500 font-black uppercase">Editing ID: #{editing.id}</span>
              )}
            </div>
            
            {/* Direction Buttons with clear explanations */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <button 
                  onClick={() => setDirection("OUT")} 
                  className={`flex-1 py-3 rounded-xl border-2 font-black text-[10px] uppercase transition-all
                    ${direction === "OUT" ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20" : "border-white/5 text-zinc-500 hover:border-red-500/50"}`}>
                  Expense (OUT)
                </button>
                <button 
                  onClick={() => setDirection("IN")} 
                  className={`flex-1 py-3 rounded-xl border-2 font-black text-[10px] uppercase transition-all
                    ${direction === "IN" ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "border-white/5 text-zinc-500 hover:border-emerald-500/50"}`}>
                  Replenishment (IN)
                </button>
              </div>
              <div className="text-[9px] text-zinc-500 px-2">
                {direction === "OUT" ? (
                  <p>🔽 Expense: Money spent FROM petty cash wallet</p>
                ) : (
                  <p>🔼 Replenishment: Money moved FROM main drawer TO petty cash wallet</p>
                )}
              </div>
            </div>
            
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-black">UGX</span>
              <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                placeholder="0" 
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white font-black text-lg outline-none focus:border-yellow-500 transition-all" 
              />
            </div>
            <select 
              value={category} 
              onChange={e => setCategory(e.target.value)} 
              className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white font-bold outline-none focus:border-yellow-500 transition-all"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Description..." 
              className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white font-bold outline-none focus:border-yellow-500 transition-all h-24 resize-none" 
            />
            <div className="text-[10px] text-zinc-500 p-3 rounded-xl bg-white/5">
              <p className="font-black uppercase tracking-widest">Accounting Impact:</p>
              <div className="grid grid-cols-2 gap-2 mt-2 text-[8px]">
                <div>
                  <p className="font-bold">Expense (OUT):</p>
                  <p>• Cash on Counter: No change</p>
                  <p>• Petty Cash: -{Number(amount || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="font-bold">Replenishment (IN):</p>
                  <p>• Cash on Counter: -{Number(amount || 0).toLocaleString()}</p>
                  <p>• Petty Cash: +{Number(amount || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={editing ? handleUpdate : handleSubmit} 
                disabled={submitting || !amount || !description.trim()} 
                className="flex-1 py-4 bg-yellow-500 text-black rounded-xl font-black uppercase text-sm tracking-widest hover:bg-yellow-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader size={16} className="animate-spin mx-auto" /> : (editing ? "Update Entry" : "Save Entry")}
              </button>
              {editing && (
                <button 
                  onClick={handleCancelEdit}
                  className="px-6 py-4 bg-red-500/20 text-red-400 rounded-xl font-black uppercase text-sm tracking-widest hover:bg-red-500/30 transition-all"
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
          <div className="p-4 border-b border-white/5 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Transaction History</p>
              <p className="text-[8px] text-zinc-600 mt-0.5">{displayEntries.length} entries</p>
            </div>
            <Filter size={14} className="text-zinc-500" />
          </div>
          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {displayEntries.length === 0 ? (
              <div className="text-center py-12">
                <Wallet size={32} className="mx-auto text-zinc-700 mb-3" />
                <p className="text-zinc-500 font-black uppercase text-[10px]">No entries for today</p>
                <p className="text-[8px] text-zinc-600 mt-1">Add your first petty cash transaction</p>
              </div>
            ) : (
              displayEntries.map(entry => {
                const categoryColor = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS["General"];
                return (
                  <div key={entry.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all hover:shadow-md ${isDark ? "bg-white/5 border-white/10" : "bg-zinc-50 border-zinc-200"}`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${entry.direction === "OUT" ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                        {entry.direction === "OUT" ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-white leading-tight truncate">{entry.description}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${categoryColor}`}>
                            {entry.category}
                          </span>
                          <span className="text-[8px] text-zinc-500">by {entry.logged_by}</span>
                          <span className="text-[8px] text-zinc-600">{new Date(entry.created_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className={`font-black text-base ${entry.direction === "OUT" ? "text-red-400" : "text-emerald-400"}`}>
                        {entry.direction === "OUT" ? "-" : "+"} UGX {Number(entry.amount).toLocaleString()}
                      </p>
                      <p className="text-[8px] text-zinc-500 mt-0.5">
                        Balance: UGX {Math.abs(entry._balance).toLocaleString()}
                      </p>
                      {isCashier && (
                        <div className="flex items-center justify-end gap-2 mt-1">
                          <button 
                            onClick={() => handleEdit(entry)} 
                            className="text-blue-500 hover:text-blue-400 transition-colors"
                            title="Edit entry"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button 
                            onClick={() => handleDelete(entry)} 
                            className="text-zinc-500 hover:text-red-500 transition-colors"
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