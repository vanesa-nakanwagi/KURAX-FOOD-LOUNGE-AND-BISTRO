import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../Director/components/shared/ThemeContext";
import { RevenueChart } from "../components/charts";
import {
  TrendingUp, BookOpen, CheckCircle2, XCircle, Clock, User, Phone,
  Calendar, ChevronDown, ChevronUp, RefreshCw, ShieldCheck,
  AlertCircle, Sparkles, ArrowUpRight, CircleDollarSign, Zap, Hourglass, BarChart3
} from "lucide-react";
import API_URL from "../../../config/api";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
function fmtK(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `UGX ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `UGX ${(v / 1_000).toFixed(0)}K`;
  return `UGX ${v.toLocaleString()}`;
}

function isSettledCredit(c) {
  return (
    c.status === "FullySettled" ||
    c.paid === true ||
    c.settled === true
  );
}

function isApprovedButNotSettled(c) {
  return c.status === "Approved" && !isSettledCredit(c);
}

// ─── CREDIT APPROVAL CARD (improved fonts) ───────────────────────────────────
function CreditApprovalCard({ row, isDark, approvingId, onApprove, onReject }) {
  const ageMin = Math.floor((Date.now() - new Date(row.created_at)) / 60000);
  const ageStr = ageMin < 60 ? `${ageMin}m ago` : `${Math.floor(ageMin / 60)}h ago`;
  const missingClientInfo = !row.credit_name || !row.credit_phone;
  const missingTableInfo = !row.table_name || row.table_name === "Unknown";

  return (
    <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl hover:scale-[1.01]
      ${missingClientInfo || missingTableInfo
        ? isDark ? "bg-gradient-to-br from-red-500/5 to-transparent border-red-500/30" : "bg-gradient-to-br from-red-50 to-transparent border-red-200"
        : isDark ? "bg-gradient-to-br from-yellow-500/5 to-transparent border-yellow-500/30" : "bg-gradient-to-br from-yellow-50 to-transparent border-yellow-200"}`}>
      
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-yellow-500/5 to-transparent rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-700" />
      
      <div className={`flex items-center justify-between px-5 py-3 border-b
        ${missingClientInfo || missingTableInfo
          ? isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-100 border-red-200"
          : isDark ? "bg-yellow-500/10 border-yellow-500/20" : "bg-yellow-100 border-yellow-200"}`}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"/>
          <span className={`text-[9px] font-black uppercase tracking-widest ${missingClientInfo || missingTableInfo ? "text-red-400" : "text-yellow-500"}`}>
            Awaiting Approval
          </span>
          <span className={`text-[9px] font-bold ${isDark ? "text-zinc-600" : "text-yellow-700/60"}`}>· {ageStr}</span>
        </div>
        <span className={`text-[9px] font-bold ${isDark ? "text-zinc-500" : "text-yellow-700/60"}`}>
          via {row.confirmed_by || row.requested_by || "Cashier"}
        </span>
      </div>

      <div className="p-5 flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-black text-base uppercase tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {missingTableInfo ? "⚠️ Missing Table" : row.table_name}
            </span>
            <span className="font-black italic text-yellow-500 text-sm">
              {row.label || `#${String(row.id).slice(-5)}`}
            </span>
            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg tracking-widest
              ${isDark ? "bg-white/5 text-zinc-400" : "bg-yellow-200 text-yellow-700"}`}>
              {row.requested_by}
            </span>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            <div className={`flex items-center gap-2 p-2 rounded-xl ${!row.credit_name ? "bg-red-500/10 border border-red-500/20" : "bg-white/5"}`}>
              <User size={12} className="text-purple-400 shrink-0"/>
              <span className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"} ${!row.credit_name ? "text-red-400" : ""}`}>
                {row.credit_name || "⚠️ Missing - Required!"}
              </span>
            </div>
            <div className={`flex items-center gap-2 p-2 rounded-xl ${!row.credit_phone ? "bg-red-500/10 border border-red-500/20" : "bg-white/5"}`}>
              <Phone size={12} className="text-purple-400 shrink-0"/>
              <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-600"} ${!row.credit_phone ? "text-red-400" : ""}`}>
                {row.credit_phone || "⚠️ Missing - Required!"}
              </span>
            </div>
            {row.credit_pay_by && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5">
                <Calendar size={12} className="text-purple-400 shrink-0"/>
                <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                  Pay by: {row.credit_pay_by}
                </span>
              </div>
            )}
          </div>
          
          {(missingClientInfo || missingTableInfo) && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle size={12} className="text-red-400 shrink-0"/>
              <span className="text-[9px] font-black text-red-400">
                ⚠️ Missing required information. Ask waiter to resend with complete details.
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-3 shrink-0 w-full sm:w-auto">
          <div className="text-right">
            <p className="text-[8px] font-black uppercase text-purple-400 tracking-widest mb-1">Amount</p>
            <p className="text-2xl font-black italic text-purple-400">{fmtK(row.amount)}</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={onReject}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-[10px] uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center justify-center gap-1.5 hover:scale-105">
              <XCircle size={12}/> Reject
            </button>
            <button 
              onClick={onApprove} 
              disabled={approvingId === row.id || missingClientInfo || missingTableInfo}
              className={`flex-[2] sm:flex-initial px-6 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 hover:scale-105 disabled:opacity-50
                ${(missingClientInfo || missingTableInfo)
                  ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                  : "bg-emerald-500 text-black hover:bg-emerald-400 active:scale-[0.98]"}`}
              title={missingClientInfo || missingTableInfo ? "Missing client or table info - cannot approve" : ""}>
              {approvingId === row.id
                ? <><RefreshCw size={12} className="animate-spin"/> Approving…</>
                : <><CheckCircle2 size={12}/> Approve</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CREDIT LEDGER ROW ────────────────────────────────────────────────────────
function CreditLedgerRow({ credit, isDark, onSettle }) {
  const settled = isSettledCredit(credit);
  const approvedButNotSettled = credit.status === "Approved" && !settled;
  
  return (
    <div className={`group relative overflow-hidden rounded-xl p-4 border transition-all duration-300 hover:shadow-lg hover:scale-[1.01]
      ${settled
        ? isDark ? "bg-zinc-900/20 border-white/5 opacity-75" : "bg-zinc-50 border-zinc-100"
        : approvedButNotSettled
        ? isDark ? "bg-gradient-to-r from-emerald-500/10 to-transparent border-emerald-500/30" : "bg-gradient-to-r from-emerald-50 to-transparent border-emerald-200"
        : isDark ? "bg-gradient-to-r from-purple-500/10 to-transparent border-purple-500/30" : "bg-gradient-to-r from-purple-50 to-transparent border-purple-200"}`}>
      
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/5 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
      
      <div className="relative z-10 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`font-black text-base uppercase tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {credit.table_name || "Table"}
            </span>
            {settled ? (
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase flex items-center gap-1">
                <CheckCircle2 size={10}/> Settled
              </span>
            ) : approvedButNotSettled ? (
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase animate-pulse flex items-center gap-1">
                <AlertCircle size={10}/> Approved - Awaiting Payment
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[8px] font-black uppercase animate-pulse flex items-center gap-1">
                <AlertCircle size={10}/> Outstanding
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px]">
            {credit.client_name && (
              <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                <User size={10} className="text-zinc-500"/>
                <span className={isDark ? "text-zinc-300" : "text-zinc-700"}>{credit.client_name}</span>
              </div>
            )}
            {credit.client_phone && (
              <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                <Phone size={10} className="text-zinc-500"/>
                <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>{credit.client_phone}</span>
              </div>
            )}
            {credit.pay_by && !settled && (
              <div className="flex items-center gap-1.5 bg-amber-500/10 px-2 py-1 rounded-lg">
                <Calendar size={10} className="text-amber-400"/>
                <span className="text-amber-400 font-black text-[9px]">Pay by: {credit.pay_by}</span>
              </div>
            )}
          </div>
          
          {settled && credit.settle_method && (
            <p className={`text-[8px] mt-2 font-mono ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              Settled via {credit.settle_method}
              {credit.settle_txn  ? ` · ${credit.settle_txn}` : ""}
              {credit.paid_at     ? ` · ${toLocalDateStr(new Date(credit.paid_at))}` : ""}
            </p>
          )}
          
          <p className={`text-[8px] mt-1 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>
            {credit.approved_by ? `Approved by ${credit.approved_by} · ` : ""}
            {toLocalDateStr(new Date(credit.created_at))}
          </p>
          
          {approvedButNotSettled && (
            <p className="text-[8px] text-emerald-500/70 mt-1 flex items-center gap-1">
              <CheckCircle2 size={8} />
              Credit approved. Waiting for customer payment to settle.
            </p>
          )}
        </div>
        
        <div className="text-right shrink-0">
          <p className="text-lg font-black italic text-purple-400">{fmtK(credit.amount)}</p>
          {settled && credit.amount_paid && Number(credit.amount_paid) !== Number(credit.amount) && (
            <p className="text-[9px] text-emerald-400 font-bold mt-0.5">Paid: {fmtK(credit.amount_paid)}</p>
          )}
          
          {approvedButNotSettled && (
            <div className="flex gap-2 mt-3 justify-end">
              <button
                onClick={() => onSettle(credit)}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-[8px] uppercase tracking-widest hover:bg-emerald-500/20 transition-all flex items-center gap-1 hover:scale-105"
              >
                <CircleDollarSign size={10}/> Record Settlement
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function PerformanceReports() {
  const { theme } = useTheme();
  const { currentUser } = useData();
  const isDark = theme === "dark";
  const currentStaffName = currentUser?.name || (() => {
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}").name || "Manager"; }
    catch { return "Manager"; }
  })();

  const [creditApprovals, setCreditApprovals] = useState([]);
  const [creditsLedger, setCreditsLedger] = useState([]);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingRow, setRejectingRow] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [ledgerExpanded, setLedgerExpanded] = useState(true);
  const [creditFilter, setCreditFilter] = useState("all");

  // ─── Fetch credits ─────────────────────────────────────────────────────────
  const fetchCredits = useCallback(async () => {
    setCreditsLoading(true);
    try {
      const approvalsRes = await fetch(`${API_URL}/api/cashier-ops/credit-approvals`);
      if (approvalsRes.ok) setCreditApprovals(await approvalsRes.json());
      
      const creditsRes = await fetch(`${API_URL}/api/cashier-ops/credits`);
      if (creditsRes.ok) {
        const rows = await creditsRes.json();
        setCreditsLedger(rows.map(r => ({ ...r, paid: isSettledCredit(r) })));
      }
    } catch (e) { console.error("Credits fetch error:", e); }
    finally { setCreditsLoading(false); }
  }, []);

  useEffect(() => {
    fetchCredits();
    const id = setInterval(fetchCredits, 10000);
    return () => clearInterval(id);
  }, [fetchCredits]);

  // ─── Derived stats ─────────────────────────────────────────────────────────
  const outstanding = creditsLedger.filter(c => !isSettledCredit(c) && c.status !== "Approved");
  const approvedButNotSettled = creditsLedger.filter(c => c.status === "Approved" && !isSettledCredit(c));
  const settled = creditsLedger.filter(c => isSettledCredit(c));
  
  const totalOutstanding = outstanding.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalApprovedButNotSettled = approvedButNotSettled.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalSettled = settled.reduce((s, c) => s + Number(c.amount_paid || c.amount || 0), 0);
  
  const filteredCredits =
    creditFilter === "outstanding" ? outstanding :
    creditFilter === "approved" ? approvedButNotSettled :
    creditFilter === "settled" ? settled : creditsLedger;

  // ─── Credit actions ───────────────────────────────────────────────────────
  const handleApprove = async (queueId) => {
    setApprovingId(queueId);
    try {
      const res = await fetch(`${API_URL}/api/cashier-ops/credit-approvals/${queueId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_by: currentStaffName }),
      });
      if (res.ok) {
        setCreditApprovals(prev => prev.filter(r => r.id !== queueId));
        await fetchCredits();
        alert("✅ Credit approved successfully!");
      } else alert("Approval failed");
    } catch (e) { alert("Network error"); }
    setApprovingId(null);
  };

  const handleSettleCredit = async (credit) => {
    setApprovingId(credit.id);
    const method = prompt("Enter payment method (Cash, Card, Momo-MTN, Momo-Airtel):", "Cash");
    if (!method) { setApprovingId(null); return; }
    const transactionId = (method === "Momo-MTN" || method === "Momo-Airtel") ? prompt("Enter transaction ID:") : null;
    if ((method === "Momo-MTN" || method === "Momo-Airtel") && !transactionId) {
      alert("Transaction ID required");
      setApprovingId(null);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/credits/${credit.id}/settle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_paid: credit.amount,
          method: method,
          transaction_id: transactionId,
          settled_by: currentStaffName,
        }),
      });
      if (res.ok) {
        await fetchCredits();
        alert("✅ Credit settled successfully!");
      } else alert("Settlement failed");
    } catch (e) { alert("Network error"); }
    setApprovingId(null);
  };

  const handleReject = async () => {
    if (!rejectingRow) return;
    setApprovingId(rejectingRow);
    try {
      const res = await fetch(`${API_URL}/api/cashier-ops/cashier-queue/${rejectingRow}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason || "Rejected by manager" }),
      });
      if (res.ok) {
        setCreditApprovals(prev => prev.filter(r => r.id !== rejectingRow));
        await fetchCredits();
        alert("❌ Credit rejected");
      } else alert("Rejection failed");
    } catch (e) { alert("Network error"); }
    setRejectingRow(null);
    setRejectReason("");
    setApprovingId(null);
  };

  // ─── Theme styles ─────────────────────────────────────────────────────────
  const card  = isDark ? "bg-zinc-900/40 border-white/5" : "bg-white border-black/5 shadow-sm";
  const muted = isDark ? "text-zinc-500" : "text-zinc-400";

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-700 pb-32 font-sans antialiased">
    

       {/* HEADER with Live Indicator */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-yellow-500 rounded-full" />
            <p className="text-[20px] font-semibold uppercase tracking-[0.15em] text-yellow-900">Manage Credits</p>
          </div>
          
          <p className={`text-[13px] font-medium mt-1 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
             Monitor credit approvals, track settled amounts, and oversee outstanding balances. 
              Keep your revenue flow transparent and agile.
          </p>
        </div>
       
      </div>

      {/* ── CREDITS LEDGER SECTION (enhanced) ── */}
      <div className={`rounded-2xl border overflow-hidden transition-all duration-300 ${card}`}>
        <div className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-500/5 to-transparent rounded-full -mr-32 -mt-32" />
          
          <div className="flex items-center justify-between px-6 py-5 relative z-10">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${isDark ? "bg-purple-500/10" : "bg-purple-100"} transition-transform`}>
                <BookOpen size={15} className="text-purple-400"/>
              </div>
              <div>
                <h3 className={`text-sm font-bold uppercase tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
                  Credits Ledger
                </h3>
                <p className={`text-[9px] mt-0.5 flex items-center gap-2 ${muted}`}>
                  {creditApprovals.length > 0 && (
                    <span className="text-yellow-400 font-bold animate-pulse flex items-center gap-1">
                      <AlertCircle size={10}/> {creditApprovals.length} pending approval
                    </span>
                  )}
                  {approvedButNotSettled.length > 0 && (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 size={10}/> {approvedButNotSettled.length} approved - ready to settle
                    </span>
                  )}
                  {outstanding.length > 0 && (
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-400" />{outstanding.length} outstanding</span>
                  )}
                  {settled.length > 0 && (
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{settled.length} settled</span>
                  )}
                </p>
              </div>
            </div>
            <button onClick={fetchCredits}
              className={`p-2.5 rounded-xl transition-all hover:scale-110 ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-zinc-100 hover:bg-zinc-200"}`}>
              <RefreshCw size={13} className={creditsLoading ? "animate-spin text-yellow-400" : muted}/>
            </button>
          </div>
        </div>

        {/* Summary tiles */}
        <div className={`grid grid-cols-4 gap-4 px-6 pb-5 border-t pt-5 ${isDark ? "border-white/5" : "border-black/5"}`}>
          <div className={`rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] ${isDark ? "bg-black/40 border border-purple-500/10" : "bg-purple-50 border border-purple-100"}`}>
            <p className={`text-[8px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-zinc-500" : "text-purple-400"}`}>Outstanding</p>
            <p className="text-purple-400 font-black text-xl leading-none">{fmtK(totalOutstanding)}</p>
            <p className={`text-[9px] mt-1.5 ${isDark ? "text-zinc-600" : "text-purple-400/60"}`}>{outstanding.length} client{outstanding.length !== 1 ? "s" : ""}</p>
          </div>
          <div className={`rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] ${isDark ? "bg-black/40 border border-emerald-500/10" : "bg-emerald-50 border border-emerald-100"}`}>
            <p className={`text-[8px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-zinc-500" : "text-emerald-500"}`}>Approved</p>
            <p className="text-emerald-400 font-black text-xl leading-none">{fmtK(totalApprovedButNotSettled)}</p>
            <p className={`text-[9px] mt-1.5 ${isDark ? "text-zinc-600" : "text-emerald-500/60"}`}>Awaiting settlement</p>
          </div>
          <div className={`rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] ${isDark ? "bg-black/40 border border-emerald-500/10" : "bg-emerald-50 border border-emerald-100"}`}>
            <p className={`text-[8px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-zinc-500" : "text-emerald-500"}`}>Settled</p>
            <p className="text-emerald-400 font-black text-xl leading-none">{fmtK(totalSettled)}</p>
            <p className={`text-[9px] mt-1.5 ${isDark ? "text-zinc-600" : "text-emerald-500/60"}`}>{settled.length} record{settled.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="rounded-2xl p-4 bg-gradient-to-br from-yellow-500 to-yellow-600 transition-all duration-300 hover:scale-[1.02]">
            <p className="text-[8px] font-bold uppercase tracking-widest mb-2 text-black/50">All Time</p>
            <p className="text-black font-black text-xl leading-none">{fmtK(totalOutstanding + totalApprovedButNotSettled + totalSettled)}</p>
            <p className="text-[9px] mt-1.5 text-black/50">{creditsLedger.length} entries</p>
          </div>
        </div>

        {/* Pending Approvals */}
        {creditApprovals.length > 0 ? (
          <div className={`px-6 pb-6 border-t pt-5 space-y-3 ${isDark ? "border-white/5" : "border-black/5"}`}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0"/>
              <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Awaiting Your Approval</p>
              <span className="ml-auto px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[9px] font-bold">{creditApprovals.length}</span>
            </div>
            {creditApprovals.map(row => (
              <CreditApprovalCard
                key={row.id}
                row={row}
                isDark={isDark}
                approvingId={approvingId}
                onApprove={() => handleApprove(row.id)}
                onReject={() => { setRejectingRow(row.id); setRejectReason(""); }}
              />
            ))}
          </div>
        ) : (
          <div className={`px-6 pb-6 border-t pt-5 ${isDark ? "border-white/5" : "border-black/5"}`}>
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">No pending credit approvals</p>
              </div>
            </div>
          </div>
        )}

        {/* Ledger Expandable */}
        <div className={`border-t ${isDark ? "border-white/5" : "border-black/5"}`}>
          <button onClick={() => setLedgerExpanded(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4 transition-all hover:bg-white/5">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${ledgerExpanded ? "bg-yellow-500/20" : ""}`}>
                <BookOpen size={12} className={ledgerExpanded ? "text-yellow-400" : muted}/>
              </div>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${muted}`}>Credit History</p>
              {creditsLedger.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500"}`}>
                  {creditsLedger.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {totalOutstanding > 0 && <span className="sm:hidden text-[9px] font-bold text-rose-400">{fmtK(totalOutstanding)} unpaid</span>}
              {ledgerExpanded ? <ChevronUp size={14} className={`${muted}`}/> : <ChevronDown size={14} className={`${muted}`}/>}
            </div>
          </button>

          {ledgerExpanded && (
            <div className={`px-6 pb-6 space-y-4 border-t ${isDark ? "border-white/5" : "border-black/5"}`}>
              <div className={`flex gap-1 p-1 rounded-xl w-fit mt-4 ${isDark ? "bg-zinc-900" : "bg-zinc-100"}`}>
                {[
                  { k: "all", l: "All", icon: <BookOpen size={10}/> },
                  { k: "outstanding", l: "Outstanding", icon: <AlertCircle size={10}/> },
                  { k: "approved", l: "Approved", icon: <CheckCircle2 size={10}/> },
                  { k: "settled", l: "Settled", icon: <CheckCircle2 size={10}/> },
                ].map(({ k, l, icon }) => (
                  <button key={k} onClick={() => setCreditFilter(k)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5
                      ${creditFilter === k
                        ? "bg-yellow-500 text-black shadow-lg scale-105"
                        : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-700"}`}>
                    {icon} {l}
                  </button>
                ))}
              </div>

              {creditsLoading ? (
                <div className="space-y-2">{[...Array(3)].map((_,i)=> <div key={i} className={`h-24 rounded-xl animate-pulse ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}/>)}</div>
              ) : filteredCredits.length === 0 ? (
                <div className={`py-14 text-center border-2 border-dashed rounded-2xl ${isDark ? "border-white/5" : "border-zinc-200"}`}>
                  <ShieldCheck size={26} className={`mx-auto mb-3 ${isDark ? "text-zinc-700" : "text-zinc-300"}`}/>
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${muted}`}>No {creditFilter === "all" ? "" : creditFilter} credits</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {filteredCredits.map(c => <CreditLedgerRow key={c.id} credit={c} isDark={isDark} onSettle={handleSettleCredit} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 7-DAY REVENUE CHART ── */}
      <div className={`rounded-2xl border p-6 md:p-8 transition-all duration-300 hover:shadow-xl ${card}`}>
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 bg-yellow-500 rounded-full" />
            <p className={`text-[10px] font-bold uppercase tracking-widest ${muted}`}>7-Day Revenue Flow</p>
          </div>
          <p className={`text-[8px] font-medium uppercase mt-0.5 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            Cash · Card · MTN · Airtel · Gross
          </p>
        </div>
        <div className="w-full overflow-hidden"><RevenueChart/></div>
      </div>

      {/* ─── REJECT MODAL (unchanged) ── */}
      {rejectingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-300">
          <div className={`w-full max-w-sm rounded-2xl p-8 shadow-2xl border transition-all ${isDark ? "bg-zinc-950 border-white/10" : "bg-white border-black/10"}`}>
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
              <XCircle size={24} className="text-red-400"/>
            </div>
            <h3 className="text-base font-bold uppercase text-red-400 mb-1 text-center tracking-widest">Reject Credit</h3>
            <p className={`text-[10px] text-center mb-6 uppercase tracking-widest ${muted}`}>Order will return to Served status</p>
            <textarea value={rejectReason} onChange={e=>setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)…"
              className={`w-full border rounded-2xl p-4 text-sm outline-none resize-none h-24 mb-6 ${isDark ? "bg-black border-white/5 text-white placeholder-zinc-600 focus:border-red-500/30" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-red-300"}`}/>
            <div className="flex gap-3">
              <button onClick={()=>setRejectingRow(null)} className="flex-1 py-4 font-bold text-[10px] uppercase rounded-2xl transition-all hover:scale-105 text-zinc-500 hover:text-zinc-300">Cancel</button>
              <button onClick={handleReject} disabled={approvingId === rejectingRow}
                className="flex-[2] py-4 bg-red-500 hover:bg-red-400 text-white rounded-2xl font-bold uppercase text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] hover:scale-105 disabled:opacity-50">
                {approvingId === rejectingRow ? <><RefreshCw size={14} className="animate-spin"/> Processing...</> : <><XCircle size={14}/> Confirm Reject</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}