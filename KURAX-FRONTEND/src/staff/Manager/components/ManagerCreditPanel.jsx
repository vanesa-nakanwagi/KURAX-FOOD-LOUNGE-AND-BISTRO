// ─── ManagerCreditPanel.jsx ───────────────────────────────────────────────────
// Drop this into your Manager dashboard. Shows all credits pending approval
// and lets the manager approve or reject each one.
//
// Props:
//   managerName – logged-in manager's name
//   theme       – "dark" (default) | "light"
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen, CheckCircle, XCircle, User, Phone,
  Calendar, RefreshCw, Clock, AlertTriangle,
  ChevronDown, Loader2, ShieldCheck, Building2
} from "lucide-react";
import API_URL from "../../../config/api";

// ─── Individual approval card ─────────────────────────────────────────────────
function CreditApprovalCard({ credit, managerName, onAction }) {
  const [expanded,   setExpanded]   = useState(false);
  const [rejecting,  setRejecting]  = useState(false);
  const [reason,     setReason]     = useState("");
  const [loading,    setLoading]    = useState(false);

  const amount = Number(credit.amount || 0);

  const timeAgo = (ts) => {
    const m = Math.floor((Date.now() - new Date(ts)) / 60000);
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ${m % 60}m ago`;
  };

  const approve = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/credits/${credit.id}/approve`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ approved_by: managerName }),
      });
      if (res.ok) onAction();
      else {
        const e = await res.json();
        alert(e.error || "Failed to approve");
      }
    } catch { alert("Network error"); }
    setLoading(false);
  };

  const reject = async () => {
    if (!reason.trim()) { alert("Please enter a rejection reason"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/credits/${credit.id}/reject`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rejected_by: managerName, reason: reason.trim() }),
      });
      if (res.ok) onAction();
      else {
        const e = await res.json();
        alert(e.error || "Failed to reject");
      }
    } catch { alert("Network error"); }
    setLoading(false);
  };

  return (
    <div className={`border rounded-[2.5rem] overflow-hidden transition-all duration-300
      ${expanded
        ? "bg-purple-500/5 border-purple-500/30"
        : "bg-zinc-900/30 border-white/5 hover:border-purple-500/20"}`}
    >
      {/* ── Summary row ── */}
      <button
        className="w-full p-6 flex items-center gap-4 text-left"
        onClick={() => { setExpanded(e => !e); setRejecting(false); }}
      >
        <div className="p-4 rounded-2xl bg-black border border-purple-500/20 text-purple-400 shrink-0">
          <BookOpen size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-black text-white italic uppercase tracking-tighter text-sm">
              {credit.table_name}
            </span>
            <span className="text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded-lg font-black uppercase tracking-widest animate-pulse">
              Awaiting Approval
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase truncate">
            {credit.client_name}
            {credit.client_phone && ` · ${credit.client_phone}`}
            {` · Forwarded by ${credit.forwarded_by || credit.waiter_name} · ${timeAgo(credit.forwarded_at || credit.created_at)}`}
          </p>
        </div>

        <div className="text-right shrink-0 mr-2">
          <p className="text-xl font-black text-purple-400 italic tracking-tighter">
            UGX {amount.toLocaleString()}
          </p>
        </div>

        <ChevronDown
          size={16}
          className={`text-zinc-500 transition-transform duration-200 shrink-0 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="px-6 pb-6 space-y-5 border-t border-purple-500/10">
          <div className="pt-5 grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Client Details</p>
              <div className="flex items-center gap-2">
                <User size={12} className="text-purple-400" />
                <span className="text-sm font-black text-white">{credit.client_name}</span>
              </div>
              {credit.client_phone && (
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-purple-400" />
                  <span className="text-sm text-zinc-300">{credit.client_phone}</span>
                </div>
              )}
              {credit.pay_by && (
                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-purple-400" />
                  <span className="text-sm text-zinc-300">Pay by: {credit.pay_by}</span>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Order Details</p>
              <div className="bg-black border border-white/5 rounded-2xl p-4 text-center">
                <p className="text-[9px] text-zinc-600 uppercase font-black tracking-widest mb-1">Credit Amount</p>
                <p className="text-2xl font-black text-purple-400 italic tracking-tighter">
                  UGX {amount.toLocaleString()}
                </p>
              </div>
              {credit.label && (
                <p className="text-[10px] text-zinc-500">{credit.label}</p>
              )}
            </div>
          </div>

          {/* Rejection reason input */}
          {rejecting && (
            <div>
              <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </p>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Explain why this credit is being rejected…"
                className="w-full bg-black border border-red-500/30 rounded-2xl p-4 text-white text-sm outline-none focus:border-red-500/50 resize-none h-20"
              />
            </div>
          )}

          {/* Action buttons */}
          {loading ? (
            <div className="flex items-center justify-center py-4 gap-2">
              <Loader2 size={16} className="animate-spin text-purple-400" />
              <span className="text-purple-400 text-[10px] font-black uppercase tracking-widest">Processing…</span>
            </div>
          ) : rejecting ? (
            <div className="flex gap-3">
              <button
                onClick={() => { setRejecting(false); setReason(""); }}
                className="flex-1 py-4 border border-white/10 text-zinc-400 rounded-2xl font-black uppercase text-[10px] hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={reject}
                disabled={!reason.trim()}
                className={`flex-[2] py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all
                  ${reason.trim()
                    ? "bg-red-500 text-white hover:bg-red-400 active:scale-[0.98]"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}
              >
                <XCircle size={14} /> Confirm Reject
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setRejecting(true)}
                className="flex-1 py-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all"
              >
                <XCircle size={14} /> Reject
              </button>
              <button
                onClick={approve}
                className="flex-[2] py-5 bg-emerald-500 text-black rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-emerald-400 active:scale-[0.98] transition-all shadow-xl shadow-emerald-500/20"
              >
                <CheckCircle size={14} /> Approve Credit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function ManagerCreditPanel({ managerName }) {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/credits/pending-manager`);
      if (res.ok) setCredits(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-4">
      {/* Sub-header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">
            Credits Awaiting Approval
          </h3>
          {credits.length > 0 && (
            <span className="px-2 py-0.5 bg-purple-500 text-white text-[9px] rounded-full font-black animate-pulse">
              {credits.length}
            </span>
          )}
        </div>
        <button
          onClick={load}
          className="p-2 bg-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-24 rounded-[2.5rem] bg-zinc-900/30 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : credits.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-zinc-900/10">
          <ShieldCheck size={28} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-600 font-black uppercase text-[10px] tracking-widest">No pending credits</p>
        </div>
      ) : (
        <div className="space-y-3">
          {credits.map(c => (
            <CreditApprovalCard
              key={c.id}
              credit={c}
              managerName={managerName}
              onAction={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}