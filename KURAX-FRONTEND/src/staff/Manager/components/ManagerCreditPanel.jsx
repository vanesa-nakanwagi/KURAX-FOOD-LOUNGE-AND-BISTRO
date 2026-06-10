import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen, CheckCircle, XCircle, User, Phone,
  Calendar, RefreshCw, ShieldCheck, ChevronDown, Loader2,
  TrendingDown, Wallet, Clock, AlertCircle, Eye, Search
} from "lucide-react";
import API_URL from "../../../config/api";

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Credit Approval Card (for pending credits) ──────────────────────────────
function CreditApprovalCard({ credit, managerName, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const amount = Number(credit.amount || 0);
  const timeAgo = (ts) => {
    if (!ts) return "recently";
    const m = Math.floor((Date.now() - new Date(ts)) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ${m % 60}m ago`;
  };

  const approve = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/manager/credits/${credit.id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_by: managerName }),
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
      const res = await fetch(`${API_URL}/api/manager/credits/${credit.id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejected_by: managerName, reason: reason.trim() }),
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
    <div className={`border rounded-2xl overflow-hidden transition-all duration-300
      ${expanded ? "bg-purple-500/5 border-purple-500/30" : "bg-zinc-900/30 border-white/5 hover:border-purple-500/20"}`}>
      <button
        className="w-full p-4 sm:p-6 flex items-center gap-3 sm:gap-4 text-left"
        onClick={() => { setExpanded(e => !e); setRejecting(false); }}
      >
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-black border border-purple-500/20 text-purple-400 shrink-0">
          <BookOpen size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-black text-white italic uppercase tracking-tighter text-sm sm:text-base">
              {credit.table_name || "Table"}
            </span>
            <span className="text-[8px] sm:text-[9px] px-2 py-0.5 rounded-lg font-black uppercase bg-purple-500/10 border-purple-500/20 text-purple-400 flex items-center gap-1">
              <Clock size={9} className="animate-pulse" /> Pending Approval
            </span>
          </div>
          <p className="text-[9px] sm:text-[10px] text-zinc-500 font-bold uppercase truncate">
            {credit.client_name || "Client"} · by {credit.forwarded_by || credit.waiter_name || credit.requested_by || "Staff"} · {timeAgo(credit.forwarded_at || credit.created_at)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base sm:text-xl font-black text-purple-400 italic tracking-tighter">
            UGX {amount.toLocaleString()}
          </p>
        </div>
        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4 border-t border-purple-500/10">
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-[9px] font-black text-zinc-600 uppercase">Client Details</p>
              <div className="flex items-center gap-2"><User size={12} className="text-purple-400"/><span className="text-sm text-white">{credit.client_name || "N/A"}</span></div>
              {credit.client_phone && <div className="flex items-center gap-2"><Phone size={12} className="text-purple-400"/><span className="text-sm text-zinc-300">{credit.client_phone}</span></div>}
              {credit.pay_by && <div className="flex items-center gap-2"><Calendar size={12} className="text-purple-400"/><span className="text-sm text-zinc-300">Pay by: {credit.pay_by}</span></div>}
            </div>
            <div className="space-y-2">
              <p className="text-[9px] font-black text-zinc-600 uppercase">Order Details</p>
              <div className="border rounded-xl p-3 bg-black border-white/5 text-center">
                <p className="text-[8px] text-zinc-600 uppercase font-black">Credit Amount</p>
                <p className="text-xl font-black text-purple-400">UGX {amount.toLocaleString()}</p>
              </div>
              {credit.item_name && <p className="text-[9px] text-zinc-500">Item: <span className="text-zinc-300 font-bold">{credit.item_name}</span></p>}
            </div>
          </div>

          {rejecting && (
            <div>
              <p className="text-[9px] font-black text-red-400 uppercase">Rejection Reason</p>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why this credit is rejected…" className="w-full bg-black border border-red-500/30 rounded-xl p-3 text-white text-sm" rows={2} />
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-4 gap-2"><Loader2 size={16} className="animate-spin text-purple-400" /><span className="text-purple-400 text-[10px]">Processing…</span></div>
          ) : rejecting ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => { setRejecting(false); setReason(""); }} className="flex-1 py-3 border border-white/10 text-zinc-400 rounded-xl text-[10px] font-black">Back</button>
              <button onClick={reject} disabled={!reason.trim()} className={`flex-[2] py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 ${reason.trim() ? "bg-red-500 text-white hover:bg-red-400" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}><XCircle size={14} /> Confirm Reject</button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setRejecting(true)} className="flex-1 py-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-black text-[10px] flex items-center justify-center gap-2"><XCircle size={14} /> Reject</button>
              <button onClick={approve} className="flex-[2] py-5 bg-emerald-500 text-black rounded-xl font-black text-xs flex items-center justify-center gap-2"><CheckCircle size={14} /> Approve Credit</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ManagerCreditPanel ─────────────────────────────────────────────────
export default function ManagerCreditPanel({ managerName }) {
  const [pendingCredits, setPendingCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/cashier-ops/credits`);
      if (res.ok) {
        const all = await res.json();
        // ✅ Pending = status is 'PendingCashier' or 'PendingManagerApproval'
        const pending = all.filter(c =>
          c.status === "PendingCashier" ||
          c.status === "PendingManagerApproval" ||
          c.status === "Pending"
        );
        setPendingCredits(pending);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load, refreshKey]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Credit Management</h3>
        <button onClick={load} className="p-2 bg-zinc-900 rounded-xl text-zinc-500 hover:text-white"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
      </div>

      <div className="space-y-3">
        {loading ? (
          [...Array(2)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-zinc-900/30 animate-pulse" />)
        ) : pendingCredits.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-3xl bg-zinc-900/10">
            <ShieldCheck size={28} className="mx-auto text-zinc-700 mb-3" />
            <p className="text-zinc-600 font-black uppercase text-[10px]">No pending credit approvals</p>
          </div>
        ) : (
          pendingCredits.map(c => <CreditApprovalCard key={c.id} credit={c} managerName={managerName} onAction={() => { load(); setRefreshKey(prev => prev + 1); }} />)
        )}
      </div>
    </div>
  );
}