import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../Director/components/shared/ThemeContext";
import { RevenueChart } from "../components/charts";
import {
  TrendingUp, Smartphone, Wallet, TrendingDown, CreditCard, Download,
  BookOpen, CheckCircle2, XCircle, Clock, User, Phone,
  Calendar, ChevronDown, ChevronUp, RefreshCw, ShieldCheck,
  AlertCircle, Banknote, Users, Sparkles, Zap, ArrowUpRight,
  CircleDollarSign, Award, Target, Activity, Gem
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
function fmt(n)  { return `UGX ${Number(n || 0).toLocaleString()}`; }
function fmtK(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `UGX ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `UGX ${(v / 1_000).toFixed(0)}K`;
  return `UGX ${v.toLocaleString()}`;
}

// isSettled — only count as settled if FullySettled or paid is true
function isSettledCredit(c) {
  return (
    c.status === "FullySettled" ||
    c.paid === true || c.paid === "t" || c.paid === "true" ||
    c.settled === true || c.settled === "t" || c.settled === "true"
  );
}

// isApprovedButNotSettled — credits that are approved but not yet paid
function isApprovedButNotSettled(c) {
  return c.status === "Approved" && !isSettledCredit(c);
}

// ─── ENHANCED STAT CARD (Matches Accountant Dashboard) ────────────────────────
function StatCard({ label, value, sub, icon, color, gradient, isDark, trend }) {
  const formattedValue = typeof value === 'string' ? value : fmtK(value);
  const numericValue = typeof value === 'number' ? value : 0;
  
  const trendIcon = trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : null;
  const trendColor = trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-zinc-500";
  const trendValue = trend ? `${Math.abs(trend)}%` : "";
  
  return (
    <div className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient || 'from-zinc-900/50 to-zinc-900/30'} p-5 border border-white/5 hover:border-yellow-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/10 hover:scale-[1.02]`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-500/10 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-white/5 to-transparent rounded-full -ml-12 -mb-12 group-hover:scale-150 transition-transform duration-700" />
      
      <div className="relative z-10">
        <div className={`p-3 w-fit rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 ${color} group-hover:scale-110 transition-all duration-300 group-hover:shadow-lg`}>
          {icon}
        </div>
        
        <div className="mt-4 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-yellow-500/50 rounded-full group-hover:h-5 transition-all duration-300" />
            <p className="text-[9px] font-black uppercase text-zinc-400 tracking-[0.2em] group-hover:text-yellow-400/80 transition-colors">
              {label}
            </p>
          </div>
        </div>
        
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tighter group-hover:tracking-tight transition-all">
            {formattedValue}
          </h3>
          {sub && (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-white/10 text-zinc-400 uppercase tracking-wider">
              {sub}
            </span>
          )}
        </div>
        
        {trend && (
          <div className={`flex items-center gap-1 mt-2 ${trendColor}`}>
            {trendIcon}
            <span className="text-[9px] font-black">{trendValue}</span>
            <span className="text-[8px] text-zinc-600 ml-1">vs yesterday</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GROSS REVENUE CARD (Matches Accountant Dashboard) ────────────────────────
function GrossRevenueCard({ grossSales, settledCredits, orderCount, isDark }) {
  const combinedTotal = grossSales + settledCredits;
  const hasSettledCredits = settledCredits > 0;
  const formattedGross = fmtK(grossSales);
  const formattedSettled = fmtK(settledCredits);
  const formattedCombined = fmtK(combinedTotal);
  
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-500 via-yellow-600 to-amber-600 p-5 shadow-lg shadow-yellow-500/20 hover:shadow-2xl hover:shadow-yellow-500/30 transition-all duration-300 hover:scale-[1.02]">
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-white/20 to-transparent rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-700" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-black/20 to-transparent rounded-full -ml-16 -mb-16 group-hover:scale-150 transition-transform duration-700" />
      
      <div className="absolute top-4 right-4 flex gap-1 opacity-30">
        <div className="w-1 h-1 rounded-full bg-white" />
        <div className="w-1 h-1 rounded-full bg-white" />
        <div className="w-1 h-1 rounded-full bg-white" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2.5 w-fit rounded-xl bg-black/30 backdrop-blur-sm text-black group-hover:scale-110 transition-transform duration-300">
            <CircleDollarSign size={18} />
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles size={10} className="text-black/60 animate-pulse" />
            <span className="text-[7px] font-black uppercase tracking-widest bg-black/30 text-black/80 px-2 py-1 rounded-lg whitespace-nowrap backdrop-blur-sm">
              {orderCount} Orders
            </span>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1 h-3 bg-black/30 rounded-full" />
            <p className="text-[8px] font-black uppercase text-black/60 tracking-[0.2em]">Gross Revenue</p>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-black italic tracking-tighter leading-tight">
            {formattedGross}
          </h3>
          <p className="text-[7px] font-bold text-black/40 uppercase tracking-wider mt-1">
            Cash + Card + Mobile Money (Paid Orders Only)
          </p>
        </div>

        {hasSettledCredits && (
          <div className="mt-2 pt-2 border-t border-black/20 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap group/settled">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 animate-pulse" />
                <p className="text-[7px] font-black uppercase text-black/60 tracking-wider">
                  Credits Settled Today
                </p>
              </div>
              <div className="flex items-center gap-1">
                <ArrowUpRight size={10} className="text-emerald-800" />
                <p className="text-[10px] font-black text-emerald-900 italic">
                  + {formattedSettled}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 bg-black/20 backdrop-blur-sm rounded-xl px-3 py-2 group-hover:bg-black/30 transition-all">
              <div className="flex items-center gap-1.5">
                <Zap size={10} className="text-black/60" />
                <p className="text-[7px] font-black uppercase text-black/70 tracking-wider">
                  Combined Total
                </p>
              </div>
              <p className="text-[11px] font-black text-black italic tracking-tighter">
                {formattedCombined}
              </p>
            </div>
          </div>
        )}
        
        <div className="absolute -top-10 -right-10 w-20 h-20 bg-gradient-to-br from-white/30 to-transparent rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
    </div>
  );
}

// ─── CREDIT APPROVAL CARD (Enhanced) ────────────────────────────────────────
function CreditApprovalCard({ row, isDark, approvingId, onApprove, onReject }) {
  const ageMin = Math.floor((Date.now() - new Date(row.created_at)) / 60000);
  const ageStr = ageMin < 60 ? `${ageMin}m ago` : `${Math.floor(ageMin / 60)}h ago`;

  return (
    <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl hover:scale-[1.01]
      ${isDark ? "bg-gradient-to-br from-yellow-500/5 to-transparent border-yellow-500/30" : "bg-gradient-to-br from-yellow-50 to-transparent border-yellow-200"}`}>
      
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-yellow-500/5 to-transparent rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-700" />
      
      {/* Strip */}
      <div className={`flex items-center justify-between px-5 py-3 border-b
        ${isDark ? "bg-yellow-500/10 border-yellow-500/20" : "bg-yellow-100 border-yellow-200"}`}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"/>
          <span className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">Awaiting Approval</span>
          <span className={`text-[9px] font-bold ${isDark ? "text-zinc-600" : "text-yellow-700/60"}`}>· {ageStr}</span>
        </div>
        <span className={`text-[9px] font-bold ${isDark ? "text-zinc-500" : "text-yellow-700/60"}`}>
          via {row.confirmed_by || row.requested_by || "Cashier"}
        </span>
      </div>

      <div className="p-5 flex flex-col sm:flex-row items-start justify-between gap-4">
        {/* Left — client info */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-black italic uppercase tracking-tight text-base ${isDark ? "text-white" : "text-zinc-900"}`}>
              {row.table_name}
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
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5">
              <User size={12} className="text-purple-400 shrink-0"/>
              <span className={`text-sm font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
                {row.credit_name || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5">
              <Phone size={12} className="text-purple-400 shrink-0"/>
              <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                {row.credit_phone || "—"}
              </span>
            </div>
            {row.credit_pay_by && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5">
                <Calendar size={12} className="text-purple-400 shrink-0"/>
                <span className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                  Pay by: {row.credit_pay_by}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right — amount + actions */}
        <div className="flex flex-col items-end gap-3 shrink-0 w-full sm:w-auto">
          <div className="text-right">
            <p className="text-[8px] font-black uppercase text-purple-400 tracking-widest mb-1">Amount</p>
            <p className="text-2xl font-[900] italic text-purple-400">
              {fmtK(row.amount)}
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={onReject}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-black text-[10px] uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center justify-center gap-1.5 hover:scale-105">
              <XCircle size={12}/> Reject
            </button>
            <button onClick={onApprove} disabled={approvingId === row.id}
              className="flex-[2] sm:flex-initial px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 hover:scale-105">
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

// ─── CREDIT LEDGER ROW (Enhanced and Fixed) ───────────────────────────
function CreditLedgerRow({ credit, isDark, onApprove, onReject, approvingId }) {
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
            <span className={`font-black text-sm uppercase italic tracking-tighter ${isDark ? "text-white" : "text-zinc-900"}`}>
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
          
          {/* Show approval note */}
          {approvedButNotSettled && (
            <p className="text-[8px] text-emerald-500/70 mt-1 flex items-center gap-1">
              <CheckCircle2 size={8} />
              Credit approved. Waiting for customer payment to settle.
            </p>
          )}
        </div>
        
        <div className="text-right shrink-0">
          <p className="text-xl font-[900] italic text-purple-400">
            {fmtK(credit.amount)}
          </p>
          {settled && credit.amount_paid && Number(credit.amount_paid) !== Number(credit.amount) && (
            <p className="text-[9px] text-emerald-400 font-bold mt-0.5">
              Paid: {fmtK(credit.amount_paid)}
            </p>
          )}
          
          {/* Approve button only for approved credits that need settlement */}
          {approvedButNotSettled && (
            <div className="flex gap-2 mt-3 justify-end">
              <button
                onClick={() => onApprove(credit)}
                disabled={approvingId === credit.id}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-[8px] uppercase tracking-widest hover:bg-emerald-500/20 transition-all flex items-center gap-1 hover:scale-105"
              >
                {approvingId === credit.id ? (
                  <><RefreshCw size={10} className="animate-spin"/> Processing…</>
                ) : (
                  <><CircleDollarSign size={10}/> Record Settlement</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function PerformanceReports() {
  const { theme }   = useTheme();
  const { orders = [], monthlyTargets = {}, currentUser } = useData();
  const isDark = theme === "dark";

  const currentStaffName = currentUser?.name || (() => {
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}").name || "Manager"; }
    catch { return "Manager"; }
  })();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  // ── Data state ───────────────────────────────────────────────────────────
  const [daySummary,      setDaySummary]      = useState(null);
  const [dayLoading,      setDayLoading]      = useState(true);
  const [monthSummary,    setMonthSummary]    = useState(null);
  const [monthLoading,    setMonthLoading]    = useState(true);
  const [creditApprovals, setCreditApprovals] = useState([]);
  const [creditsLedger,   setCreditsLedger]   = useState([]);
  const [creditsLoading,  setCreditsLoading]  = useState(true);
  const [approvingId,     setApprovingId]     = useState(null);
  const [rejectingRow,    setRejectingRow]    = useState(null);
  const [rejectReason,    setRejectReason]    = useState("");
  const [ledgerExpanded,  setLedgerExpanded]  = useState(true);
  const [creditFilter,    setCreditFilter]    = useState("all");

  const currentMonth = selectedDate.substring(0, 7);

  // ── Fetchers ─────────────────────────────────────────────────────────────
  const fetchDaySummary = useCallback(async () => {
    setDayLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const url   = selectedDate === today
        ? `${API_URL}/api/summaries/today`
        : `${API_URL}/api/summaries/range?from=${selectedDate}&to=${selectedDate}`;
      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setDaySummary(Array.isArray(d) ? (d[0] || null) : d);
      }
    } catch (e) { console.error("Day summary:", e); }
    finally { setDayLoading(false); }
  }, [selectedDate]);

  const fetchMonthSummary = useCallback(async () => {
    setMonthLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/summaries/monthly?month=${currentMonth}`);
      if (res.ok) setMonthSummary(await res.json());
    } catch (e) { console.error("Month summary:", e); }
    finally { setMonthLoading(false); }
  }, [currentMonth]);

  const fetchCredits = useCallback(async () => {
    setCreditsLoading(true);
    try {
      // Get pending credit approvals from cashier_queue
      const approvalsRes = await fetch(`${API_URL}/api/cashier-ops/credit-approvals`);
      if (approvalsRes.ok) {
        const approvals = await approvalsRes.json();
        setCreditApprovals(approvals);
      } else {
        console.error("Failed to fetch approvals:", approvalsRes.status);
      }
      
      // Get all credits from credits table
      const creditsRes = await fetch(`${API_URL}/api/cashier-ops/credits`);
      if (creditsRes.ok) {
        const rows = await creditsRes.json();
        setCreditsLedger(rows.map(r => ({ ...r, paid: isSettledCredit(r) })));
      }
    } catch (e) { 
      console.error("Credits fetch error:", e); 
    }
    finally { setCreditsLoading(false); }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchDaySummary();
    fetchMonthSummary();
    fetchCredits();
    
    // Poll for new approvals every 10 seconds
    const credId = setInterval(fetchCredits, 10000);
    const today  = new Date().toISOString().split("T")[0];
    
    if (selectedDate === today) {
      const sumId = setInterval(fetchDaySummary, 10000);
      return () => { clearInterval(sumId); clearInterval(credId); };
    }
    return () => clearInterval(credId);
  }, [fetchDaySummary, fetchMonthSummary, fetchCredits, selectedDate]);

  // ── Credits derived values - FIXED: Only count FULLY SETTLED credits ────
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

  // ── Credit settlement additions - ONLY SETTLED credits ───────────────────
  const settledTodayCredits = useMemo(() =>
    creditsLedger.filter(c => {
      if (!isSettledCredit(c)) return false;
      const d = c.paid_at || c.updated_at || c.created_at;
      return d && toLocalDateStr(new Date(d)) === selectedDate;
    }),
  [creditsLedger, selectedDate]);

  const creditSettledByMethod = useMemo(() => {
    const acc = { cash: 0, card: 0, mtn: 0, airtel: 0, total: 0 };
    settledTodayCredits.forEach(c => {
      const amt = Number(c.amount_paid || c.amount || 0);
      switch (c.settle_method) {
        case "Cash":        acc.cash   += amt; acc.total += amt; break;
        case "Card":        acc.card   += amt; acc.total += amt; break;
        case "Momo-MTN":    acc.mtn    += amt; acc.total += amt; break;
        case "Momo-Airtel": acc.airtel += amt; acc.total += amt; break;
        default:            acc.total  += amt; break;
      }
    });
    return acc;
  }, [settledTodayCredits]);

  // ─── TOTALS - FIXED: Only add SETTLED credits, NOT approved ones ────────
  const totalGross   = Number(daySummary?.total_gross ?? 0) + creditSettledByMethod.total;
  const totalCash    = Number(daySummary?.total_cash   ?? 0) + creditSettledByMethod.cash;
  const totalCard    = Number(daySummary?.total_card   ?? 0) + creditSettledByMethod.card;
  const totalMTN     = Number(daySummary?.total_mtn    ?? 0) + creditSettledByMethod.mtn;
  const totalAirtel  = Number(daySummary?.total_airtel ?? 0) + creditSettledByMethod.airtel;
  const orderCount   = Number(daySummary?.order_count  ?? 0);
  const totalMobileMoney = totalMTN + totalAirtel;

  // ── Monthly target progress ───────────────────────────────────────────────
  const monthlyRevenue = Number(monthSummary?.totals?.total_gross ?? 0);
  const monthTarget    = monthlyTargets[currentMonth]?.revenue ?? 6_000_000;
  const progressPct    = Math.min((monthlyRevenue / monthTarget) * 100, 100).toFixed(1);

  // ── Staff leaderboard ─────────────────────────────────────────────────────
  const waiterStats = useMemo(() =>
    orders
      .filter(o => {
        const ts = o.timestamp || o.date;
        return ts && new Date(ts).toISOString().split("T")[0] === selectedDate;
      })
      .reduce((acc, o) => {
        const n = (o.waiter_name || o.waiterName || o.waiter || "Staff").trim();
        acc[n] = (acc[n] || 0) + Number(o.total || 0);
        return acc;
      }, {}),
  [orders, selectedDate]);

  // ─── Credit approve for pending approvals ─────────────────────────────────
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
      } else {
        const error = await res.json();
        alert(error.error || "Failed to approve credit");
        await fetchCredits();
      }
    } catch (e) { 
      console.error("Approve error:", e);
      alert("Network error while approving");
    }
    setApprovingId(null);
  };

  // ─── Settle approved credit from ledger ────────────────────────────────
  const handleSettleCredit = async (credit) => {
    setApprovingId(credit.id);
    const amount = credit.amount;
    const method = prompt("Enter payment method (Cash, Card, Momo-MTN, Momo-Airtel):", "Cash");
    if (!method) {
      setApprovingId(null);
      return;
    }
    
    const transactionId = (method === "Momo-MTN" || method === "Momo-Airtel") 
      ? prompt("Enter transaction ID:") 
      : null;
    
    if ((method === "Momo-MTN" || method === "Momo-Airtel") && !transactionId) {
      alert("Transaction ID is required for mobile money payments");
      setApprovingId(null);
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/credits/${credit.id}/settle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_paid: amount,
          method: method,
          transaction_id: transactionId,
          settled_by: currentStaffName,
        }),
      });
      
      if (res.ok) {
        await fetchCredits();
        alert("✅ Credit settled successfully!");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to settle credit");
      }
    } catch (e) { 
      console.error("Settle error:", e);
      alert("Network error while settling");
    }
    setApprovingId(null);
  };

  // ─── Credit reject ────────────────────────────────────────────────────────
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
        alert("❌ Credit rejected successfully!");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to reject credit");
        await fetchCredits();
      }
    } catch (e) { 
      console.error("Reject error:", e);
      alert("Network error while rejecting");
    }
    setRejectingRow(null);
    setRejectReason("");
    setApprovingId(null);
  };

  // ─── Shared Tailwind shorthands ────────────────────────────────────────────
  const card  = isDark ? "bg-zinc-900/40 border-white/5" : "bg-white border-black/5 shadow-sm";
  const muted = isDark ? "text-zinc-500" : "text-zinc-400";

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-700 pb-32">

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-yellow-500 rounded-full" />
            <h1 className="text-4xl font-[900] italic uppercase tracking-tighter leading-none">Performance</h1>
          </div>
          <p className="text-yellow-500 text-[10px] font-black tracking-widest uppercase italic">
            Audit Date: {selectedDate}
          </p>
        </div>
        <input
          type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className={`px-4 py-2 rounded-xl font-black text-[10px] border uppercase transition-all
            ${isDark ? "bg-zinc-900 border-white/10 text-white hover:border-yellow-500/50" : "bg-white border-black/10 text-zinc-900"}`}
        />
      </div>

      {/* ── ENHANCED REVENUE STAT CARDS (5 cards in one row) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        <StatCard
          label="Gross Revenue" isDark={isDark} color="text-emerald-500"
          gradient="from-emerald-900/30 to-emerald-800/10"
          value={dayLoading ? "…" : totalGross}
          sub={`${orderCount} orders`}
          icon={<TrendingUp size={20} className="text-emerald-400"/>}
          trend={5.2}
        />
        <StatCard
          label="Mobile Money" isDark={isDark} color="text-purple-400"
          gradient="from-purple-900/30 to-purple-800/10"
          value={dayLoading ? "…" : totalMobileMoney}
          sub="MTN + Airtel"
          icon={<Smartphone size={20} className="text-purple-400"/>}
          trend={8.3}
        />
        <StatCard
          label="Card / POS" isDark={isDark} color="text-blue-400"
          gradient="from-blue-900/30 to-blue-800/10"
          value={dayLoading ? "…" : totalCard}
          icon={<CreditCard size={20} className="text-blue-400"/>}
          trend={-2.1}
        />
        <StatCard
          label="Physical Cash" isDark={isDark} color="text-emerald-500"
          gradient="from-emerald-900/30 to-emerald-800/10"
          value={dayLoading ? "…" : totalCash}
          icon={<Wallet size={20} className="text-emerald-400"/>}
          trend={3.5}
        />
        <GrossRevenueCard 
          grossSales={totalGross}
          settledCredits={creditSettledByMethod.total}
          orderCount={orderCount}
          isDark={isDark}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CREDITS SECTION WITH ENHANCED UI
      ══════════════════════════════════════════════════════════════════════ */}
      <div className={`rounded-[2rem] border overflow-hidden transition-all duration-300 ${card}`}>

        {/* Section header with gradient accent */}
        <div className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full -mr-32 -mt-32" />
          
          <div className="flex items-center justify-between px-6 py-5 relative z-10">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${isDark ? "bg-purple-500/10" : "bg-purple-100"} group-hover:scale-110 transition-transform`}>
                <BookOpen size={15} className="text-purple-400"/>
              </div>
              <div>
                <h3 className={`text-sm font-black uppercase tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
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
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      {outstanding.length} outstanding
                    </span>
                  )}
                  {settled.length > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {settled.length} settled
                    </span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {totalOutstanding > 0 && (
                <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-black uppercase animate-pulse">
                  <AlertCircle size={10}/> {fmtK(totalOutstanding)} unpaid
                </span>
              )}
              <button onClick={fetchCredits}
                className={`p-2.5 rounded-xl transition-all hover:scale-110 ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-zinc-100 hover:bg-zinc-200"}`}>
                <RefreshCw size={13} className={creditsLoading ? "animate-spin text-yellow-400" : muted}/>
              </button>
            </div>
          </div>
        </div>

        {/* Summary tiles - Enhanced */}
        <div className={`grid grid-cols-4 gap-4 px-6 pb-5 border-t pt-5 ${isDark ? "border-white/5" : "border-black/5"}`}>
          <div className={`group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] ${isDark ? "bg-black/40 border border-purple-500/10" : "bg-purple-50 border border-purple-100"}`}>
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10">
              <p className={`text-[8px] font-black uppercase tracking-widest mb-2 ${isDark ? "text-zinc-500" : "text-purple-400"}`}>Outstanding</p>
              <p className="text-purple-400 font-[900] italic text-xl leading-none">{fmtK(totalOutstanding)}</p>
              <p className={`text-[9px] mt-1.5 ${isDark ? "text-zinc-600" : "text-purple-400/60"}`}>
                {outstanding.length} client{outstanding.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className={`group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] ${isDark ? "bg-black/40 border border-emerald-500/10" : "bg-emerald-50 border border-emerald-100"}`}>
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10">
              <p className={`text-[8px] font-black uppercase tracking-widest mb-2 ${isDark ? "text-zinc-500" : "text-emerald-500"}`}>Approved</p>
              <p className="text-emerald-400 font-[900] italic text-xl leading-none">{fmtK(totalApprovedButNotSettled)}</p>
              <p className={`text-[9px] mt-1.5 ${isDark ? "text-zinc-600" : "text-emerald-500/60"}`}>
                Awaiting settlement
              </p>
            </div>
          </div>
          <div className={`group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] ${isDark ? "bg-black/40 border border-emerald-500/10" : "bg-emerald-50 border border-emerald-100"}`}>
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10">
              <p className={`text-[8px] font-black uppercase tracking-widest mb-2 ${isDark ? "text-zinc-500" : "text-emerald-500"}`}>Settled</p>
              <p className="text-emerald-400 font-[900] italic text-xl leading-none">{fmtK(totalSettled)}</p>
              <p className={`text-[9px] mt-1.5 ${isDark ? "text-zinc-600" : "text-emerald-500/60"}`}>
                {settled.length} record{settled.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-yellow-500 to-yellow-600 transition-all duration-300 hover:scale-[1.02]">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/20 to-transparent rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10">
              <p className="text-[8px] font-black uppercase tracking-widest mb-2 text-black/50">All Time</p>
              <p className="text-black font-[900] italic text-xl leading-none">{fmtK(totalOutstanding + totalApprovedButNotSettled + totalSettled)}</p>
              <p className="text-[9px] mt-1.5 text-black/50">{creditsLedger.length} entries</p>
            </div>
          </div>
        </div>

        {/* PENDING APPROVALS SECTION - Enhanced */}
        {creditApprovals.length > 0 ? (
          <div className={`px-6 pb-6 border-t pt-5 space-y-3 ${isDark ? "border-white/5" : "border-black/5"}`}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0"/>
              <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">
                Awaiting Your Approval
              </p>
              <span className="ml-auto px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[9px] font-black">
                {creditApprovals.length}
              </span>
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
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  No pending credit approvals
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Ledger — collapsible with enhanced UI */}
        <div className={`border-t ${isDark ? "border-white/5" : "border-black/5"}`}>
          <button
            onClick={() => setLedgerExpanded(v => !v)}
            className={`w-full flex items-center justify-between px-6 py-4 transition-all hover:bg-white/5`}>
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${ledgerExpanded ? "bg-yellow-500/20" : ""}`}>
                <BookOpen size={12} className={ledgerExpanded ? "text-yellow-400" : muted}/>
              </div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Credit History</p>
              {creditsLedger.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black
                  ${isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500"}`}>
                  {creditsLedger.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {totalOutstanding > 0 && (
                <span className="sm:hidden text-[9px] font-black text-rose-400">{fmtK(totalOutstanding)} unpaid</span>
              )}
              {ledgerExpanded
                ? <ChevronUp size={14} className={`${muted} transition-transform`}/>
                : <ChevronDown size={14} className={`${muted} transition-transform`}/>}
            </div>
          </button>

          {ledgerExpanded && (
            <div className={`px-6 pb-6 space-y-4 border-t ${isDark ? "border-white/5" : "border-black/5"}`}>
              {/* Filter tabs - Enhanced */}
              <div className={`flex gap-1 p-1 rounded-xl w-fit mt-4 ${isDark ? "bg-zinc-900" : "bg-zinc-100"}`}>
                {[
                  { k: "all",         l: "All", icon: <BookOpen size={10}/> },
                  { k: "outstanding", l: "Outstanding", icon: <AlertCircle size={10}/> },
                  { k: "approved",    l: "Approved", icon: <CheckCircle2 size={10}/> },
                  { k: "settled",     l: "Settled", icon: <CheckCircle2 size={10}/> },
                ].map(({ k, l, icon }) => (
                  <button key={k} onClick={() => setCreditFilter(k)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5
                      ${creditFilter === k
                        ? "bg-yellow-500 text-black shadow-lg scale-105"
                        : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-700"}`}>
                    {icon}
                    {l}
                  </button>
                ))}
              </div>

              {/* List with Settle buttons for approved credits */}
              {creditsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`h-24 rounded-xl animate-pulse ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}/>
                  ))}
                </div>
              ) : filteredCredits.length === 0 ? (
                <div className={`py-14 text-center border-2 border-dashed rounded-[2rem] ${isDark ? "border-white/5" : "border-zinc-200"}`}>
                  <ShieldCheck size={26} className={`mx-auto mb-3 ${isDark ? "text-zinc-700" : "text-zinc-300"}`}/>
                  <p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>
                    No {creditFilter === "all" ? "" : creditFilter} credits
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                  {filteredCredits.map(c => (
                    <CreditLedgerRow 
                      key={c.id} 
                      credit={c} 
                      isDark={isDark}
                      onApprove={handleSettleCredit}
                      onReject={() => {}}
                      approvingId={approvingId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 7-DAY REVENUE CHART (Enhanced) ── */}
      <div className={`rounded-[2rem] border p-6 md:p-8 transition-all duration-300 hover:shadow-xl ${card}`}>
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 bg-yellow-500 rounded-full" />
            <p className={`text-[10px] font-black uppercase tracking-widest italic ${muted}`}>7-Day Revenue Flow</p>
          </div>
          <p className={`text-[8px] font-bold uppercase mt-0.5 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            Cash · Card · MTN · Airtel · Gross
          </p>
        </div>
        <div className="w-full overflow-hidden">
          <RevenueChart/>
        </div>
      </div>

      {/* ─── REJECT MODAL (Enhanced) ── */}
      {rejectingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-300">
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border transition-all
            ${isDark ? "bg-zinc-950 border-white/10" : "bg-white border-black/10"}`}>
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
              <XCircle size={24} className="text-red-400"/>
            </div>
            <h3 className="text-base font-black uppercase text-red-400 mb-1 text-center tracking-widest">Reject Credit</h3>
            <p className={`text-[10px] text-center mb-6 uppercase tracking-widest ${muted}`}>
              Order will return to Served status
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)…"
              className={`w-full border rounded-2xl p-4 text-sm outline-none resize-none h-24 mb-6 transition-all
                ${isDark
                  ? "bg-black border-white/5 text-white placeholder-zinc-600 focus:border-red-500/30"
                  : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-red-300"}`}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRejectingRow(null)}
                className={`flex-1 py-4 font-black text-[10px] uppercase rounded-2xl transition-all hover:scale-105
                  ${isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"}`}>
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={approvingId === rejectingRow}
                className="flex-[2] py-4 bg-red-500 hover:bg-red-400 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] hover:scale-105 disabled:opacity-50">
                {approvingId === rejectingRow ? (
                  <><RefreshCw size={14} className="animate-spin"/> Processing...</>
                ) : (
                  <><XCircle size={14}/> Confirm Reject</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}