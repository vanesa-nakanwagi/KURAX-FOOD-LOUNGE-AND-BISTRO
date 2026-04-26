// ─── CreditLedgerPanel.jsx ────────────────────────────────────────────────────
// Full credit ledger for the cashier.
// Shows:
//   • Credits pending cashier action (needs forwarding to manager)
//   • Credits pending manager (read-only, waiting)
//   • Approved credits – settle here (partial or full)
//   • Fully settled credits (history)
//   • Running totals of all credit settlements today
//
// Props:
//   cashierName – logged-in cashier's name
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BookOpen, CheckCircle, XCircle, User, Phone,
  Calendar, RefreshCw, Clock, AlertTriangle,
  ChevronDown, ChevronRight, Send, Banknote,
  Smartphone, CreditCard, Wallet, TrendingUp,
  ShieldCheck, Loader2, X, CheckCircle2, History,
  CircleDollarSign, Filter
} from "lucide-react";
import API_URL from "../../config/api";

// ─── helpers ─────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return "—";
  const m = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });
}

const METHOD_STYLES_LIGHT = {
  "Cash":        { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: <Banknote size={12} /> },
  "Card":        { color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",       icon: <CreditCard size={12} /> },
  "Momo-MTN":    { color: "text-yellow-700",  bg: "bg-yellow-50 border-yellow-200",   icon: <Smartphone size={12} /> },
  "Momo-Airtel": { color: "text-red-700",     bg: "bg-red-50 border-red-200",         icon: <Smartphone size={12} /> },
};

const STATUS_META_LIGHT = {
  PendingCashier:    { label: "Needs Forwarding",    color: "text-orange-700",  bg: "bg-orange-50 border-orange-200",   pulse: true  },
  PendingManagerApproval: { label: "Awaiting Manager",    color: "text-purple-700",  bg: "bg-purple-50 border-purple-200",   pulse: true  },
  Approved:          { label: "Approved – Unsettled", color: "text-cyan-700",   bg: "bg-cyan-50 border-cyan-200",       pulse: false },
  PartiallySettled:  { label: "Partial Payment",     color: "text-yellow-700",  bg: "bg-yellow-50 border-yellow-200",   pulse: false },
  FullySettled:      { label: "Fully Settled",       color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", pulse: false },
  Rejected:          { label: "Rejected",            color: "text-red-700",     bg: "bg-red-50 border-red-200",         pulse: false },
};

// ─── Settle Modal ─────────────────────────────────────────────────────────────
function SettleModal({ credit, cashierName, onClose, onSettled }) {
  const [method,  setMethod]  = useState("Cash");
  const [amount,  setAmount]  = useState("");
  const [txn,     setTxn]     = useState("");
  const [notes,   setNotes]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const balance   = Number(credit.amount) - Number(credit.amount_paid || 0);
  const isMomo    = method === "Momo-MTN" || method === "Momo-Airtel";
  const amtNum    = Number(amount);
  const canSubmit = amtNum > 0 && amtNum <= balance && (!isMomo || txn.trim());

  const PAY_METHODS = [
    { key: "Cash",        label: "Cash",        color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    { key: "Card",        label: "Card",        color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
    { key: "Momo-MTN",    label: "MTN Momo",    color: "text-yellow-700",  bg: "bg-yellow-50 border-yellow-200" },
    { key: "Momo-Airtel", label: "Airtel Momo", color: "text-red-700",     bg: "bg-red-50 border-red-200" },
  ];

  const handleSubmit = async () => {
    setError("");
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/credits/${credit.id}/settle`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          amount_paid:    amtNum,
          method,
          transaction_id: txn.trim() || null,
          notes:          notes.trim() || null,
          settled_by:     cashierName,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        setError(e.error || "Settlement failed");
        setLoading(false);
        return;
      }
      const result = await res.json();
      onSettled(result);
      onClose();
    } catch {
      setError("Network error – try again");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[500] bg-white/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-blue-200 rounded-[3rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between mb-7 pb-5 border-b border-blue-100">
          <div>
            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Record Settlement</p>
            <h2 className="text-base font-black text-zinc-900 uppercase italic tracking-tighter">
              {credit.client_name}
            </h2>
            <p className="text-zinc-500 text-[10px] mt-0.5">
              {credit.table_name} · Original: UGX {Number(credit.amount).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-zinc-100 rounded-full text-zinc-500 hover:text-zinc-700">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Balance overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3 text-center">
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total</p>
              <p className="text-sm font-black text-zinc-900">UGX {Number(credit.amount).toLocaleString()}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
              <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Paid</p>
              <p className="text-sm font-black text-emerald-700">UGX {Number(credit.amount_paid || 0).toLocaleString()}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 text-center">
              <p className="text-[8px] font-black text-yellow-600 uppercase tracking-widest mb-1">Balance</p>
              <p className="text-sm font-black text-yellow-700">UGX {balance.toLocaleString()}</p>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">Payment Method</p>
            <div className="grid grid-cols-2 gap-2">
              {PAY_METHODS.map(({ key, label, color, bg }) => (
                <button
                  key={key}
                  onClick={() => { setMethod(key); setTxn(""); }}
                  className={`py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all
                    ${method === key
                      ? `${bg} ${color} scale-[1.02] shadow-md`
                      : "border-zinc-200 bg-white text-zinc-500 hover:border-blue-300"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount input */}
          <div>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">
              Amount Paying Now <span className="text-zinc-400">(UGX · partial allowed)</span>
            </p>
            <input
              type="number"
              value={amount}
              max={balance}
              onChange={e => setAmount(e.target.value)}
              placeholder={`Max: ${balance.toLocaleString()}`}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-zinc-900 font-black text-xl text-center outline-none focus:border-blue-500 placeholder:text-zinc-300"
            />
            {amtNum > balance && (
              <p className="text-red-600 text-[9px] font-black mt-1 text-center uppercase tracking-widest">
                Cannot exceed balance of UGX {balance.toLocaleString()}
              </p>
            )}
          </div>

          {/* Momo TXN */}
          {isMomo && (
            <div>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                Transaction ID <span className="text-red-500">*</span>
              </p>
              <input
                type="text"
                value={txn}
                onChange={e => setTxn(e.target.value)}
                placeholder="Enter transaction reference"
                className="w-full bg-zinc-50 border border-yellow-300 rounded-2xl p-4 text-zinc-900 font-black text-sm text-center uppercase tracking-widest outline-none focus:border-yellow-500"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Notes (optional)</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes about this settlement…"
              className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-zinc-700 text-sm outline-none focus:border-blue-300 resize-none h-16"
            />
          </div>

          {error && (
            <p className="text-red-600 text-[10px] font-black text-center uppercase tracking-widest">⚠ {error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-4 text-zinc-500 font-black uppercase text-[10px]">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !canSubmit}
              className={`flex-[2] py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 transition-all
                ${canSubmit && !loading
                  ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-xl shadow-blue-500/30"
                  : "bg-zinc-100 text-zinc-400 cursor-not-allowed"}`}
            >
              {loading
                ? <><Loader2 size={13} className="animate-spin" /> Processing…</>
                : <><CheckCircle2 size={13} /> Record Payment</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Forward confirmation ─────────────────────────────────────────────────────
async function forwardCreditToManager(creditId, cashierName) {
  const res = await fetch(`${API_URL}/api/credits/${creditId}/forward`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ forwarded_by: cashierName }),
  });
  if (!res.ok) {
    const e = await res.json();
    throw new Error(e.error || "Forward failed");
  }
  return res.json();
}

// ─── Individual credit row ────────────────────────────────────────────────────
function CreditRow({ credit, cashierName, onSettle, onForward, onRefresh }) {
  const [expanded,  setExpanded]  = useState(false);
  const [forwarding, setForwarding] = useState(false);

  // Fix: Map status correctly - handle both 'PendingManagerApproval' and 'PendingManager'
  const status = credit.status === "PendingManagerApproval" ? "PendingManagerApproval" : 
                 (credit.status === "PendingManager" ? "PendingManagerApproval" : credit.status);
  
  const meta = STATUS_META_LIGHT[status] || STATUS_META_LIGHT["Rejected"];
  const amount = Number(credit.amount || 0);
  const paid = Number(credit.amount_paid || 0);
  const balance = amount - paid;
  const pct = amount > 0 ? Math.round((paid / amount) * 100) : 0;

  const settlements = Array.isArray(credit.settlements) ? credit.settlements : [];

  const handleForward = async () => {
    setForwarding(true);
    try {
      await forwardCreditToManager(credit.id, cashierName);
      onRefresh();
    } catch (e) {
      alert(e.message);
    }
    setForwarding(false);
  };

  return (
    <div className={`border rounded-[2.5rem] overflow-hidden transition-all duration-300 bg-white shadow-sm
      ${status === "PendingCashier" ? "border-orange-200 bg-orange-50/30" :
        status === "PendingManagerApproval" ? "border-purple-200 bg-purple-50/30" :
        status === "Approved" ? "border-cyan-200 bg-cyan-50/30" :
        status === "PartiallySettled" ? "border-yellow-200 bg-yellow-50/30" :
        status === "FullySettled" ? "border-zinc-200 bg-zinc-50/50" :
        "border-red-200 bg-red-50/30"}`}
    >
      {/* ── Summary row ── */}
      <button
        className="w-full p-5 flex items-center gap-4 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`p-3.5 rounded-2xl bg-white border shrink-0 ${meta.bg.split(" ")[1]} ${meta.color}`}>
          <BookOpen size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-black text-zinc-900 italic uppercase tracking-tighter text-sm">
              {credit.client_name}
            </span>
            <span className={`text-[8px] border font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${meta.bg} ${meta.color} ${meta.pulse ? "animate-pulse" : ""}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase truncate">
            {credit.table_name}
            {credit.client_phone && ` · ${credit.client_phone}`}
            {credit.pay_by && ` · Pay by ${fmtDate(credit.pay_by)}`}
            {` · ${timeAgo(credit.created_at)}`}
          </p>

          {/* Progress bar for partial payments */}
          {(status === "PartiallySettled" || status === "FullySettled") && paid > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${status === "FullySettled" ? "bg-emerald-500" : "bg-yellow-500"}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className="text-[8px] font-black text-zinc-400">{pct}%</span>
            </div>
          )}
        </div>

        <div className="text-right shrink-0 mr-2">
          {status === "FullySettled" ? (
            <p className="text-base font-black text-emerald-600 italic">Settled</p>
          ) : (
            <>
              <p className="text-base font-black text-zinc-900 italic tracking-tighter">
                UGX {balance.toLocaleString()}
              </p>
              {paid > 0 && (
                <p className="text-[9px] text-zinc-400 font-bold">of {amount.toLocaleString()}</p>
              )}
            </>
          )}
        </div>

        <ChevronDown
          size={15}
          className={`text-zinc-400 transition-transform duration-200 shrink-0 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* ── Expanded ── */}
      {expanded && (
        <div className="px-5 pb-6 border-t border-zinc-100 space-y-4 pt-4">

          {/* Client + Amounts detail */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 md:col-span-1 space-y-2">
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Client</p>
              <div className="flex items-center gap-1.5">
                <User size={11} className="text-zinc-400" />
                <span className="text-xs font-black text-zinc-900">{credit.client_name}</span>
              </div>
              {credit.client_phone && (
                <div className="flex items-center gap-1.5">
                  <Phone size={11} className="text-zinc-400" />
                  <span className="text-xs text-zinc-700">{credit.client_phone}</span>
                </div>
              )}
              {credit.pay_by && (
                <div className="flex items-center gap-1.5">
                  <Calendar size={11} className="text-zinc-400" />
                  <span className="text-xs text-zinc-700">{fmtDate(credit.pay_by)}</span>
                </div>
              )}
            </div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3 text-center">
              <p className="text-[8px] font-black text-zinc-500 uppercase mb-1">Total</p>
              <p className="text-sm font-black text-zinc-900">UGX {amount.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
              <p className="text-[8px] font-black text-emerald-600 uppercase mb-1">Paid</p>
              <p className="text-sm font-black text-emerald-700">UGX {paid.toLocaleString()}</p>
            </div>
          </div>

          {/* Settlement history */}
          {settlements.length > 0 && (
            <div>
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-2">Payment History</p>
              <div className="space-y-2">
                {settlements.map((s, i) => {
                  const sm = METHOD_STYLES_LIGHT[s.method] || METHOD_STYLES_LIGHT["Cash"];
                  return (
                    <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-2xl border ${sm.bg}`}>
                      <div className="flex items-center gap-2">
                        <span className={sm.color}>{sm.icon}</span>
                        <div>
                          <p className={`text-[10px] font-black uppercase ${sm.color}`}>{s.method}</p>
                          {s.transaction_id && (
                            <p className="text-[8px] text-zinc-500 font-mono">TXN: {s.transaction_id}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-zinc-900">UGX {Number(s.amount_paid).toLocaleString()}</p>
                        <p className="text-[8px] text-zinc-500">{timeAgo(s.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rejection info */}
          {status === "Rejected" && credit.reject_reason && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-[8px] font-black text-red-600 uppercase tracking-widest mb-1">Rejection Reason</p>
              <p className="text-xs text-zinc-700">{credit.reject_reason}</p>
              <p className="text-[8px] text-zinc-500 mt-1">By {credit.rejected_by} · {timeAgo(credit.rejected_at)}</p>
            </div>
          )}

          {/* Action buttons */}
          {status === "PendingCashier" && (
            <button
              onClick={handleForward}
              disabled={forwarding}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-60 shadow-md shadow-blue-500/20"
            >
              {forwarding
                ? <><Loader2 size={13} className="animate-spin" /> Forwarding…</>
                : <><Send size={13} /> Forward to Manager for Approval</>
              }
            </button>
          )}

          {status === "PendingManagerApproval" && (
            <div className="flex items-center justify-center gap-2 py-3 bg-purple-50 border border-purple-200 rounded-2xl">
              <Clock size={13} className="text-purple-600 animate-pulse" />
              <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest">
                Waiting for manager approval · {timeAgo(credit.forwarded_at || credit.created_at)}
              </p>
            </div>
          )}

          {(status === "Approved" || status === "PartiallySettled") && (
            <button
              onClick={() => onSettle(credit)}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-md shadow-blue-500/20"
            >
              <CircleDollarSign size={14} /> Record Settlement Payment
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN LEDGER PANEL ────────────────────────────────────────────────────────
export default function CreditLedgerPanel({ cashierName }) {
  const [credits,      setCredits]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [settlingCredit, setSettlingCredit] = useState(null);
  const [filter,       setFilter]       = useState("ALL");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/credits`);
      if (res.ok) {
        const data = await res.json();
        console.log("📋 Credits loaded:", data.map(c => ({ id: c.id, status: c.status, client: c.client_name })));
        setCredits(data);
      }
    } catch (err) {
      console.error("Failed to load credits:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  // ── Today's settlement totals ──────────────────────────────────────────────
  const todayKey = new Date().toISOString().split("T")[0];

  const todaySettlementTotals = useMemo(() => {
    const base = { cash: 0, card: 0, momo_mtn: 0, momo_airtel: 0, total: 0 };
    credits.forEach(c => {
      const sArr = Array.isArray(c.settlements) ? c.settlements : [];
      sArr.forEach(s => {
        const d = new Date(s.created_at).toISOString().split("T")[0];
        if (d !== todayKey) return;
        const amt = Number(s.amount_paid || 0);
        base.total += amt;
        switch (s.method) {
          case "Cash":        base.cash        += amt; break;
          case "Card":        base.card        += amt; break;
          case "Momo-MTN":    base.momo_mtn    += amt; break;
          case "Momo-Airtel": base.momo_airtel += amt; break;
        }
      });
    });
    return base;
  }, [credits, todayKey]);

  // ── Filtered list - FIXED: Proper status mapping ───────────────────────────
  const getFilteredCredits = (statusFilter) => {
    if (statusFilter === "ALL") return credits;
    
    return credits.filter(c => {
      // Map both 'PendingManager' and 'PendingManagerApproval' to the same filter
      if (statusFilter === "PendingManagerApproval") {
        return c.status === "PendingManagerApproval" || c.status === "PendingManager";
      }
      return c.status === statusFilter;
    });
  };

  const filtered = getFilteredCredits(filter);

  // ── Counts for badges - FIXED: Include both status variations ──────────────
  const needsAction = credits.filter(c => c.status === "PendingCashier").length;
  const pendingMgr = credits.filter(c => c.status === "PendingManagerApproval" || c.status === "PendingManager").length;
  const readyToSettle = credits.filter(c => ["Approved", "PartiallySettled"].includes(c.status)).length;

  const FILTERS = [
    { key: "ALL",                    label: "All" },
    { key: "PendingCashier",         label: "Need Action" },
    { key: "PendingManagerApproval", label: "Awaiting Manager" },
    { key: "Approved",               label: "Approved" },
    { key: "PartiallySettled",       label: "Partial" },
    { key: "FullySettled",           label: "Settled" },
    { key: "Rejected",               label: "Rejected" },
  ];

  return (
    <div className="space-y-6">

      {/* ── Today settlement totals ── */}
      {todaySettlementTotals.total > 0 && (
        <div className="bg-white border border-blue-100 rounded-[2.5rem] p-6 shadow-sm">
          <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-4">
            Today's Credit Settlements
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Cash",        value: todaySettlementTotals.cash,        color: "text-emerald-700", bg: "bg-emerald-50" },
              { label: "Card",        value: todaySettlementTotals.card,        color: "text-blue-700",    bg: "bg-blue-50" },
              { label: "MTN Momo",    value: todaySettlementTotals.momo_mtn,    color: "text-yellow-700",  bg: "bg-yellow-50" },
              { label: "Airtel Momo", value: todaySettlementTotals.momo_airtel, color: "text-red-700",     bg: "bg-red-50" },
            ].map(({ label, value, color, bg }) => value > 0 ? (
              <div key={label} className={`${bg} border border-zinc-200 rounded-2xl p-3 text-center`}>
                <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${color}`}>{label}</p>
                <p className="text-sm font-black text-zinc-900">UGX {value.toLocaleString()}</p>
              </div>
            ) : null)}
            <div className="bg-blue-600 rounded-2xl p-3 text-center col-span-2 md:col-span-1 shadow-md">
              <p className="text-[8px] font-black text-blue-100 uppercase tracking-widest mb-1">Total Collected</p>
              <p className="text-base font-black text-white italic">UGX {todaySettlementTotals.total.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Action alerts ── */}
      {(needsAction > 0 || pendingMgr > 0 || readyToSettle > 0) && (
        <div className="flex gap-3 flex-wrap">
          {needsAction > 0 && (
            <button
              onClick={() => setFilter("PendingCashier")}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-2xl hover:bg-orange-100 transition-all"
            >
              <AlertTriangle size={12} className="text-orange-600" />
              <span className="text-[10px] font-black text-orange-700 uppercase tracking-widest">
                {needsAction} Need Forwarding
              </span>
            </button>
          )}
          {pendingMgr > 0 && (
            <button
              onClick={() => setFilter("PendingManagerApproval")}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 border border-purple-200 rounded-2xl hover:bg-purple-100 transition-all"
            >
              <Clock size={12} className="text-purple-600 animate-pulse" />
              <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest">
                {pendingMgr} Awaiting Manager
              </span>
            </button>
          )}
          {readyToSettle > 0 && (
            <button
              onClick={() => setFilter("Approved")}
              className="flex items-center gap-2 px-4 py-2.5 bg-cyan-50 border border-cyan-200 rounded-2xl hover:bg-cyan-100 transition-all"
            >
              <CircleDollarSign size={12} className="text-cyan-600" />
              <span className="text-[10px] font-black text-cyan-700 uppercase tracking-widest">
                {readyToSettle} Ready to Settle
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── Filter tabs ── */}
      <div className="flex gap-1 flex-wrap border-b border-zinc-100 pb-1">
        {FILTERS.map(f => {
          let count = 0;
          if (f.key === "ALL") {
            count = credits.length;
          } else if (f.key === "PendingManagerApproval") {
            count = credits.filter(c => c.status === "PendingManagerApproval" || c.status === "PendingManager").length;
          } else {
            count = credits.filter(c => c.status === f.key).length;
          }
          
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5
                ${filter === f.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-500 hover:text-blue-600 hover:bg-blue-50"}`}
            >
              {f.label}
              {count > 0 && (
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black
                  ${filter === f.key ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={load}
          className="ml-auto p-2 bg-zinc-100 rounded-xl text-zinc-500 hover:text-blue-600 transition-colors"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Credit list ── */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-[2.5rem] bg-zinc-100 animate-pulse border border-zinc-200" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-zinc-200 rounded-[3rem] bg-zinc-50">
          <ShieldCheck size={28} className="mx-auto text-zinc-400 mb-3" />
          <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">No credits in this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <CreditRow
              key={c.id}
              credit={c}
              cashierName={cashierName}
              onSettle={setSettlingCredit}
              onRefresh={load}
            />
          ))}
        </div>
      )}

      {/* ── Settle modal ── */}
      {settlingCredit && (
        <SettleModal
          credit={settlingCredit}
          cashierName={cashierName}
          onClose={() => setSettlingCredit(null)}
          onSettled={() => { setSettlingCredit(null); load(); }}
        />
      )}
    </div>
  );
}