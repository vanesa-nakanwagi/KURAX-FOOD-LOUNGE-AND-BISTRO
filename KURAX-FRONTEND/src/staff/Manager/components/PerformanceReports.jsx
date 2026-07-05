import React, { useState, useEffect, useCallback } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../Director/components/shared/ThemeContext";
import { RevenueChart } from "../components/charts";
import {
  BookOpen, CheckCircle2, XCircle, User, Phone,
  Calendar, RefreshCw, ShieldCheck,
  AlertCircle, Clock, ChevronLeft, ChevronRight
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

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthDisplay(monthStr) {
  if (!monthStr) return "";
  const [year, month] = monthStr.split("-");
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

// ✅ FULL NUMBER FORMATTER (no abbreviation)
function formatFullAmount(n) {
  const v = Number(n || 0);
  return `UGX ${v.toLocaleString()}`;
}

// ─── STATUS PREDICATES (CASE-INSENSITIVE) ────────────────────────────────────
function isPending(c) {
  const s = (c.status || "").toLowerCase();
  return s === "pending" || s === "pendingcashier" || s === "pendingmanagerapproval";
}

function isOutstanding(c) {
  const status = (c.status || "").toLowerCase();
  const paid = Number(c.amount_paid ?? 0);
  return status === "approved" && paid === 0;
}

function isPartiallySettled(c) {
  const status = (c.status || "").toLowerCase();
  const paid = Number(c.amount_paid ?? 0);
  const total = Number(c.amount ?? 0);
  return status === "partiallysettled" || (status === "approved" && paid > 0 && paid < total);
}

function isFullySettled(c) {
  const status = (c.status || "").toLowerCase();
  const paid = Number(c.amount_paid ?? 0);
  const total = Number(c.amount ?? 0);
  return status === "fullysettled" || (total > 0 && paid >= total);
}

function isRejected(c) {
  const s = (c.status || "").toLowerCase();
  return s === "rejected";
}

// ─── CREDIT APPROVAL CARD (full amounts) ─────────────────────────────────────
function CreditApprovalCard({ row, isDark, approvingId, onApprove, onReject }) {
  const ageMin = Math.floor((Date.now() - new Date(row.created_at)) / 60000);
  const ageStr = ageMin < 60 ? `${ageMin}m ago` : `${Math.floor(ageMin / 60)}h ago`;
  const amount = Number(row.amount || 0);
  const isPendingCashier = row.status === "PendingCashier";

  return (
    <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl hover:scale-[1.01]
      ${isDark
        ? "bg-gradient-to-br from-yellow-500/5 to-transparent border-yellow-500/30"
        : "bg-gradient-to-br from-yellow-50 to-transparent border-yellow-200"}`}>

      <div className={`flex items-center justify-between px-5 py-3 border-b
        ${isDark ? "bg-yellow-500/10 border-yellow-500/20" : "bg-yellow-100 border-yellow-200"}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"/>
          <span className="text-[9px] font-black uppercase tracking-widest text-yellow-500">
            {isPendingCashier ? "With Cashier" : "Awaiting Approval"}
          </span>
          <span className={`text-[9px] font-bold ${isDark ? "text-zinc-600" : "text-yellow-700/60"}`}>
            · {ageStr}
          </span>
        </div>
        <span className={`text-[9px] font-bold ${isDark ? "text-zinc-500" : "text-yellow-700/60"}`}>
          via {row.requested_by || row.forwarded_by || "Cashier"}
        </span>
      </div>

      <div className="p-5 flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-black text-base uppercase tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {row.table_name || "Table"}
            </span>
            <span className="font-black italic text-yellow-500 text-sm">
              {row.label || `#${String(row.id).slice(-5)}`}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5">
              <User size={12} className="text-purple-400 shrink-0"/>
              <span className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
                {row.credit_name || row.client_name || "Client name"}
              </span>
            </div>
            {(row.credit_phone || row.client_phone) && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5">
                <Phone size={12} className="text-purple-400 shrink-0"/>
                <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                  {row.credit_phone || row.client_phone}
                </span>
              </div>
            )}
            {(row.credit_pay_by || row.pay_by) && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5">
                <Calendar size={12} className="text-purple-400 shrink-0"/>
                <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                  Pay by: {row.credit_pay_by || row.pay_by}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 shrink-0 w-full sm:w-auto">
          <div className="text-right">
            <p className="text-[8px] font-black uppercase text-purple-400 tracking-widest mb-1">Amount</p>
            <p className="text-2xl font-black italic text-purple-400 break-words whitespace-normal">
              {formatFullAmount(amount)}
            </p>
          </div>

          {isPendingCashier ? (
            <div className={`px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest flex items-center gap-2
              ${isDark ? "bg-zinc-800 text-zinc-500 border border-zinc-700" : "bg-zinc-100 text-zinc-400 border border-zinc-200"}`}>
              <Clock size={11}/> Waiting for cashier
            </div>
          ) : (
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={onReject}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-[10px] uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center justify-center gap-1.5 hover:scale-105">
                <XCircle size={12}/> Reject
              </button>
              <button onClick={onApprove} disabled={approvingId === row.id}
                className="flex-[2] sm:flex-initial px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 hover:scale-105 disabled:opacity-50">
                {approvingId === row.id
                  ? <><RefreshCw size={12} className="animate-spin"/> Approving…</>
                  : <><CheckCircle2 size={12}/> Approve</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CREDIT LEDGER ROW (full amounts, break-words) ───────────────────────────
function CreditLedgerRow({ credit, isDark }) {
  const amount      = Number(credit.amount      ?? 0);
  const paid        = Number(credit.amount_paid ?? 0);
  const balance     = Number(credit.balance     ?? (amount - paid));
  const partial     = isPartiallySettled(credit);
  const fully       = isFullySettled(credit);
  const rej         = isRejected(credit);
  const outstanding = isOutstanding(credit);
  const percentPaid = amount > 0 ? (paid / amount) * 100 : 0;

  return (
    <div className={`group relative overflow-hidden rounded-xl p-4 border transition-all duration-300 hover:shadow-lg hover:scale-[1.01]
      ${fully      ? (isDark ? "bg-zinc-900/20 border-white/5" : "bg-zinc-50 border-zinc-100")
      : rej        ? (isDark ? "bg-red-500/5 border-red-500/20" : "bg-red-50 border-red-200")
      : partial    ? (isDark ? "bg-gradient-to-r from-orange-500/10 to-transparent border-orange-500/30" : "bg-gradient-to-r from-orange-50 to-transparent border-orange-200")
      :               (isDark ? "bg-gradient-to-r from-purple-500/10 to-transparent border-purple-500/30" : "bg-gradient-to-r from-purple-50 to-transparent border-purple-200")}`}>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`font-black text-base uppercase tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {credit.table_name || "Table"}
            </span>
            {fully       && <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase">Fully Settled</span>}
            {rej         && <span className="px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-black uppercase">Rejected</span>}
            {partial     && <span className="px-2 py-0.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[8px] font-black uppercase">Partially Settled</span>}
            {outstanding && <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[8px] font-black uppercase">Outstanding</span>}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px]">
            {(credit.client_name || credit.credit_name) && (
              <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                <User size={10} className="text-zinc-500"/>
                <span className={isDark ? "text-zinc-300" : "text-zinc-700"}>
                  {credit.client_name || credit.credit_name}
                </span>
              </div>
            )}
            {credit.created_at && (
              <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                <Calendar size={10} className="text-zinc-500"/>
                <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>
                  {toLocalDateStr(new Date(credit.created_at))}
                </span>
              </div>
            )}
          </div>

          {partial && (
            <div className="mt-3">
              <div className="flex justify-between text-[8px] mb-1">
                <span className="text-zinc-500">Paid: {formatFullAmount(paid)}</span>
                <span className="text-orange-500 font-bold break-words">Remaining: {formatFullAmount(balance)}</span>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${percentPaid}%` }}/>
              </div>
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          {partial     && <><p className="text-lg font-black italic text-orange-400 break-words whitespace-normal">{formatFullAmount(balance)}</p><p className="text-[8px] text-zinc-500">of {formatFullAmount(amount)}</p></>}
          {fully       && <p className="text-lg font-black italic text-emerald-400 break-words whitespace-normal">{formatFullAmount(amount)}</p>}
          {rej         && <p className="text-lg font-black italic text-red-400 line-through break-words whitespace-normal">{formatFullAmount(amount)}</p>}
          {outstanding && <p className="text-lg font-black italic text-purple-400 break-words whitespace-normal">{formatFullAmount(amount)}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PerformanceReports() {
  const { theme } = useTheme();
  const { currentUser } = useData();
  const isDark = theme === "dark";
  const currentStaffName = currentUser?.name || (() => {
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}").name || "Manager"; }
    catch { return "Manager"; }
  })();

  const [allCredits,     setAllCredits]     = useState([]);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [approvingId,    setApprovingId]    = useState(null);
  const [rejectingRow,   setRejectingRow]   = useState(null);
  const [rejectReason,   setRejectReason]   = useState("");
  const [creditFilter,   setCreditFilter]   = useState("all");
  const [selectedMonth,  setSelectedMonth]  = useState(getCurrentMonth());

  const fetchCredits = useCallback(async () => {
    setCreditsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/cashier-ops/credits`);
      if (res.ok) {
        const data = await res.json();
        setAllCredits(data);
      } else {
        console.error("Failed to fetch credits:", res.status);
      }
    } catch (e) {
      console.error("Credits fetch error:", e);
    } finally {
      setCreditsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
    const interval = setInterval(fetchCredits, 30000);
    return () => clearInterval(interval);
  }, [fetchCredits]);

  // ─── Bucketing (with date filter for ledger) ───────────────────────────────
  const pendingCredits = allCredits.filter(isPending);

  const ledgerCredits = allCredits
    .filter(c => !isPending(c))
    .filter(c => {
      const date = c.created_at || c.confirmed_at;
      if (!date) return false;
      return toLocalDateStr(new Date(date)).substring(0, 7) === selectedMonth;
    });

  const outstandingCredits  = ledgerCredits.filter(isOutstanding);
  const partialCredits      = ledgerCredits.filter(isPartiallySettled);
  const fullySettledCredits = ledgerCredits.filter(isFullySettled);
  const rejectedCredits     = ledgerCredits.filter(isRejected);

  // Totals
  const totalOutstanding      = outstandingCredits.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const totalPartialRemaining = partialCredits.reduce((s, c) =>
    s + Number(c.balance ?? (Number(c.amount ?? 0) - Number(c.amount_paid ?? 0))), 0);
  const totalOutstandingBalance = totalOutstanding + totalPartialRemaining;

  const totalFullySettledAmt = fullySettledCredits.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const totalPartialPaid     = partialCredits.reduce((s, c) => s + Number(c.amount_paid ?? 0), 0);
  const totalSettledPaid     = totalFullySettledAmt + totalPartialPaid;
  const totalRejected        = rejectedCredits.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const allTimeTotal         = ledgerCredits.reduce((s, c) => s + Number(c.amount ?? 0), 0);

  const filteredCredits =
    creditFilter === "outstanding" ? [...outstandingCredits, ...partialCredits] :
    creditFilter === "settled"     ? [...fullySettledCredits, ...partialCredits] :
    creditFilter === "rejected"    ? rejectedCredits :
    ledgerCredits;

  // ─── Actions ───────────────────────────────────────────────────────────────
  const handleApprove = async (creditId) => {
    setApprovingId(creditId);
    try {
      const res = await fetch(`${API_URL}/api/manager/credits/${creditId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_by: currentStaffName }),
      });
      if (res.ok) {
        await fetchCredits();
      } else {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "Approval failed");
      }
    } catch { alert("Network error"); }
    setApprovingId(null);
  };

  const handleReject = async () => {
    if (!rejectingRow) return;
    setApprovingId(rejectingRow);
    try {
      const res = await fetch(`${API_URL}/api/manager/credits/${rejectingRow}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejected_by: currentStaffName,
          reason: rejectReason.trim() || "Rejected by manager",
        }),
      });
      if (res.ok) {
        await fetchCredits();
      } else {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "Rejection failed");
      }
    } catch { alert("Network error"); }
    setRejectingRow(null);
    setRejectReason("");
    setApprovingId(null);
  };

  const handlePreviousMonth = () => {
    const [y, m] = selectedMonth.split("-");
    const d = new Date(parseInt(y), parseInt(m) - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split("-");
    const d = new Date(parseInt(y), parseInt(m), 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (next <= getCurrentMonth()) setSelectedMonth(next);
  };

  const card  = isDark ? "bg-zinc-900/40 border-white/5" : "bg-white border-black/5 shadow-sm";
  const muted = isDark ? "text-zinc-500" : "text-zinc-400";

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-700 pb-32">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-yellow-500 rounded-full"/>
            <p className="text-[20px] font-semibold uppercase tracking-[0.15em] text-yellow-900">Manage Credits</p>
          </div>
          <p className={`text-[13px] font-medium mt-1 ${muted}`}>
            Review credit approvals and track payment status
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handlePreviousMonth}
            className={`p-2 rounded-xl transition-all ${isDark ? "bg-zinc-800 hover:bg-zinc-700" : "bg-gray-100 hover:bg-gray-200"}`}>
            <ChevronLeft size={16}/>
          </button>
          <div className={`px-4 py-2 rounded-xl font-bold text-sm ${isDark ? "bg-zinc-800" : "bg-gray-100"}`}>
            {formatMonthDisplay(selectedMonth)}
          </div>
          <button onClick={handleNextMonth} disabled={selectedMonth === getCurrentMonth()}
            className={`p-2 rounded-xl transition-all
              ${selectedMonth === getCurrentMonth()
                ? "opacity-50 cursor-not-allowed"
                : isDark ? "bg-zinc-800 hover:bg-zinc-700" : "bg-gray-100 hover:bg-gray-200"}`}>
            <ChevronRight size={16}/>
          </button>
        </div>
      </div>

      {/* ── STATS CARDS (full amounts) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Pending */}
        <div className={`rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02]
          ${isDark
            ? "bg-gradient-to-br from-yellow-500/10 to-transparent border border-yellow-500/20"
            : "bg-gradient-to-br from-yellow-50 to-transparent border border-yellow-200"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2.5 rounded-xl ${isDark ? "bg-yellow-500/20" : "bg-yellow-100"}`}>
              <Clock size={18} className="text-yellow-400"/>
            </div>
            <span className={`text-[8px] font-black uppercase tracking-widest ${isDark ? "text-yellow-400/60" : "text-yellow-600"}`}>
              Pending
            </span>
          </div>
          <p className="text-2xl font-black text-yellow-400">{pendingCredits.length}</p>
          <p className={`text-[9px] mt-2 ${muted}`}>awaiting review</p>
          <div className="mt-3 pt-2 border-t border-yellow-500/10 space-y-1">
            <div className="flex justify-between text-[8px]">
              <span className={isDark ? "text-yellow-400/60" : "text-yellow-600/70"}>With cashier:</span>
              <span className="text-yellow-400 font-bold">
                {pendingCredits.filter(c => c.status === "PendingCashier").length}
              </span>
            </div>
            <div className="flex justify-between text-[8px]">
              <span className={isDark ? "text-yellow-400/60" : "text-yellow-600/70"}>Needs approval:</span>
              <span className="text-yellow-400 font-bold">
                {pendingCredits.filter(c => c.status === "PendingManagerApproval" || c.status === "Pending").length}
              </span>
            </div>
          </div>
        </div>

        {/* Outstanding */}
        <div className={`rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02]
          ${isDark
            ? "bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20"
            : "bg-gradient-to-br from-purple-50 to-transparent border border-purple-200"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2.5 rounded-xl ${isDark ? "bg-purple-500/20" : "bg-purple-100"}`}>
              <AlertCircle size={18} className="text-purple-400"/>
            </div>
            <span className={`text-[8px] font-black uppercase tracking-widest ${isDark ? "text-purple-400/60" : "text-purple-400"}`}>
              Outstanding
            </span>
          </div>
          <p className="text-2xl font-black text-purple-400 break-words whitespace-normal">
            {formatFullAmount(totalOutstandingBalance)}
          </p>
          <p className={`text-[9px] mt-2 ${muted}`}>
            {outstandingCredits.length + partialCredits.length} credit{(outstandingCredits.length + partialCredits.length) !== 1 ? "s" : ""} with balance
          </p>
          <div className="mt-3 pt-2 border-t border-purple-500/10 space-y-1">
            {outstandingCredits.length > 0 && (
              <div className="flex justify-between text-[8px]">
                <span className="text-purple-400/70">Unpaid:</span>
                <span className="text-purple-400 font-bold break-words">{formatFullAmount(totalOutstanding)}</span>
              </div>
            )}
            {partialCredits.length > 0 && (
              <div className="flex justify-between text-[8px]">
                <span className="text-orange-400/70">Partial remaining:</span>
                <span className="text-orange-400 font-bold break-words">{formatFullAmount(totalPartialRemaining)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Settled */}
        <div className={`rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02]
          ${isDark
            ? "bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20"
            : "bg-gradient-to-br from-emerald-50 to-transparent border border-emerald-200"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2.5 rounded-xl ${isDark ? "bg-emerald-500/20" : "bg-emerald-100"}`}>
              <CheckCircle2 size={18} className="text-emerald-400"/>
            </div>
            <span className={`text-[8px] font-black uppercase tracking-widest ${isDark ? "text-emerald-400/60" : "text-emerald-400"}`}>
              Settled
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-400 break-words whitespace-normal">
            {formatFullAmount(totalSettledPaid)}
          </p>
          <p className={`text-[9px] mt-2 ${muted}`}>
            {fullySettledCredits.length} credit{fullySettledCredits.length !== 1 ? "s" : ""} paid
          </p>
          <div className="mt-3 pt-2 border-t border-emerald-500/10 space-y-1">
            {fullySettledCredits.length > 0 && (
              <div className="flex justify-between text-[8px]">
                <span className="text-emerald-400/70">Fully settled:</span>
                <span className="text-emerald-400 font-bold break-words">{formatFullAmount(totalFullySettledAmt)}</span>
              </div>
            )}
            {partialCredits.length > 0 && (
              <div className="flex justify-between text-[8px]">
                <span className="text-orange-400/70">Partially paid:</span>
                <span className="text-orange-400 font-bold break-words">{formatFullAmount(totalPartialPaid)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Monthly summary card */}
        <div className="rounded-2xl p-5 bg-gradient-to-br from-yellow-500 to-yellow-600 transition-all duration-300 hover:scale-[1.02] shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-black/20">
              <BookOpen size={18} className="text-black"/>
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-black/50">
              {formatMonthDisplay(selectedMonth)}
            </span>
          </div>
          <p className="text-2xl font-black text-black break-words whitespace-normal">
            {formatFullAmount(allTimeTotal)}
          </p>
          <p className="text-[9px] mt-2 text-black/60">{ledgerCredits.length} entries</p>
          <div className="mt-3 pt-2 border-t border-black/10 space-y-0.5">
            <div className="flex justify-between text-[8px] text-black/60">
              <span>Outstanding:</span>
              <span className="font-bold break-words">{formatFullAmount(totalOutstandingBalance)}</span>
            </div>
            <div className="flex justify-between text-[8px] text-black/60">
              <span>Settled:</span>
              <span className="font-bold break-words">{formatFullAmount(totalSettledPaid)}</span>
            </div>
            <div className="flex justify-between text-[8px] text-black/60">
              <span>Rejected:</span>
              <span className="font-bold break-words">{formatFullAmount(totalRejected)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── PENDING APPROVAL SECTION ── */}
      {pendingCredits.length > 0 && (
        <div className={`rounded-2xl border p-6 ${card}`}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0"/>
            <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">
              Pending Credit Requests
            </p>
            <span className="ml-auto px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[9px] font-bold">
              {pendingCredits.length}
            </span>
          </div>
          <div className="space-y-3">
            {pendingCredits.map(row => (
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
        </div>
      )}

      {/* ── CREDITS LEDGER ── */}
      <div className={`rounded-2xl border overflow-hidden transition-all duration-300 ${card}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isDark ? "bg-purple-500/10" : "bg-purple-100"}`}>
              <BookOpen size={15} className="text-purple-400"/>
            </div>
            <h3 className={`text-sm font-bold uppercase tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              Credits Ledger — {formatMonthDisplay(selectedMonth)}
            </h3>
          </div>
          <button onClick={fetchCredits}
            className={`p-2.5 rounded-xl transition-all hover:scale-110
              ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-zinc-100 hover:bg-zinc-200"}`}>
            <RefreshCw size={13} className={creditsLoading ? "animate-spin text-yellow-400" : muted}/>
          </button>
        </div>

        <div className={`px-6 pt-4 pb-2 border-b ${isDark ? "border-white/5" : "border-black/5"}`}>
          <div className={`flex gap-1 p-1 rounded-xl w-fit flex-wrap ${isDark ? "bg-zinc-900" : "bg-zinc-100"}`}>
            {[
              { k: "all",         l: "All",         icon: <BookOpen size={10}/> },
              { k: "outstanding", l: "Outstanding",  icon: <AlertCircle size={10}/> },
              { k: "settled",     l: "Settled",      icon: <CheckCircle2 size={10}/> },
              { k: "rejected",    l: "Rejected",     icon: <XCircle size={10}/> },
            ].map(({ k, l, icon }) => (
              <button key={k} onClick={() => setCreditFilter(k)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 whitespace-nowrap
                  ${creditFilter === k
                    ? k === "outstanding" ? "bg-purple-500 text-black shadow-lg scale-105"
                      : k === "settled"   ? "bg-emerald-500 text-black shadow-lg scale-105"
                      : k === "rejected"  ? "bg-red-500 text-black shadow-lg scale-105"
                      :                     "bg-yellow-500 text-black shadow-lg scale-105"
                    : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-700"}`}>
                {icon} {l}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6 pt-4">
          {creditsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`h-24 rounded-xl animate-pulse ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}/>
              ))}
            </div>
          ) : filteredCredits.length === 0 ? (
            <div className={`py-14 text-center border-2 border-dashed rounded-2xl ${isDark ? "border-white/5" : "border-zinc-200"}`}>
              <ShieldCheck size={26} className={`mx-auto mb-3 ${isDark ? "text-zinc-700" : "text-zinc-300"}`}/>
              <p className={`text-[9px] font-bold uppercase tracking-widest ${muted}`}>
                No {creditFilter === "all" ? "" : creditFilter} credits for {formatMonthDisplay(selectedMonth)}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {filteredCredits.map(c => <CreditLedgerRow key={c.id} credit={c} isDark={isDark}/>)}
            </div>
          )}
        </div>
      </div>

      {/* ── REVENUE CHART (unchanged) ── */}
      <div className={`rounded-2xl border p-6 md:p-8 transition-all duration-300 hover:shadow-xl ${card}`}>
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 bg-yellow-500 rounded-full"/>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${muted}`}>7-Day Revenue Flow</p>
          </div>
        </div>
        <div className="w-full overflow-hidden"><RevenueChart/></div>
      </div>

      {/* ── REJECT MODAL (unchanged) ── */}
      {rejectingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm rounded-2xl p-8 shadow-2xl border
            ${isDark ? "bg-zinc-950 border-white/10" : "bg-white border-black/10"}`}>
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
              <XCircle size={24} className="text-red-400"/>
            </div>
            <h3 className="text-base font-bold uppercase text-red-400 mb-1 text-center">Reject Credit</h3>
            <p className={`text-[10px] text-center mb-5 ${muted}`}>
              This will permanently reject the credit request.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection…"
              className={`w-full border rounded-2xl p-4 text-sm outline-none resize-none h-24 mb-6
                ${isDark ? "bg-black border-white/5 text-white" : "bg-zinc-50 border-zinc-200"}`}/>
            <div className="flex gap-3">
              <button onClick={() => setRejectingRow(null)}
                className={`flex-1 py-4 font-bold text-[10px] uppercase rounded-2xl border transition-all
                  ${isDark ? "border-white/10 text-zinc-400 hover:bg-white/5" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                Cancel
              </button>
              <button onClick={handleReject} disabled={approvingId === rejectingRow}
                className="flex-[2] py-4 bg-red-500 hover:bg-red-400 text-white rounded-2xl font-bold uppercase text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                {approvingId === rejectingRow
                  ? <><RefreshCw size={14} className="animate-spin"/> Processing…</>
                  : <><XCircle size={14}/> Confirm Reject</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}