import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../Director/components/shared/ThemeContext";
import { RevenueChart } from "../components/charts";
import {
  TrendingUp, Smartphone, Wallet, CreditCard, Download,
  BookOpen, CheckCircle2, XCircle, Clock, User, Phone,
  Calendar, ChevronDown, ChevronUp, RefreshCw, ShieldCheck,
  AlertCircle, Banknote, Users, Sparkles
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

// isSettled — covers all DB representations (postgres bool, string, status field)
function isSettledCredit(c) {
  return (
    c.paid    === true || c.paid    === "t" || c.paid    === "true"  ||
    c.settled === true || c.settled === "t" || c.settled === "true"  ||
    c.status  === "settled" || c.status  === "Settled" ||
    c.status  === "FullySettled"
  );
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color, isDark }) {
  return (
    <div className={`p-5 rounded-[2rem] border transition-all duration-200 hover:scale-[1.02] hover:shadow-lg
      ${isDark ? "bg-zinc-900 border-white/5" : "bg-white border-black/5 shadow-sm"}`}>
      <div className={`p-2.5 rounded-xl w-fit mb-3 ${isDark ? "bg-white/5" : "bg-zinc-100"}`}>
        {icon}
      </div>
      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-lg font-[900] italic tracking-tighter truncate ${color}`}>{value}</p>
      {sub && <p className="text-[8px] font-bold text-zinc-500 uppercase mt-1">{sub}</p>}
    </div>
  );
}

// ─── CREDIT APPROVAL CARD ────────────────────────────────────────────────
function CreditApprovalCard({ row, isDark, approvingId, onApprove, onReject }) {
  const ageMin = Math.floor((Date.now() - new Date(row.created_at)) / 60000);
  const ageStr = ageMin < 60 ? `${ageMin}m ago` : `${Math.floor(ageMin / 60)}h ago`;

  return (
    <div className={`rounded-[2rem] overflow-hidden border transition-all
      ${isDark ? "bg-zinc-900/60 border-yellow-500/30" : "bg-yellow-50 border-yellow-200 shadow-sm"}`}>

      {/* Strip */}
      <div className={`flex items-center justify-between px-5 py-2.5 border-b
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
        <div className="flex-1 min-w-0 space-y-2.5">
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
          <div className="grid grid-cols-1 gap-1.5">
            <div className="flex items-center gap-2">
              <User size={11} className="text-zinc-500 shrink-0"/>
              <span className={`text-sm font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
                {row.credit_name || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={11} className="text-zinc-500 shrink-0"/>
              <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                {row.credit_phone || "—"}
              </span>
            </div>
            {row.credit_pay_by && (
              <div className="flex items-center gap-2">
                <Calendar size={11} className="text-zinc-500 shrink-0"/>
                <span className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                  Pay by: {row.credit_pay_by}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right — amount + actions */}
        <div className="flex flex-col items-end gap-3 shrink-0 w-full sm:w-auto">
          <p className="text-2xl font-[900] italic text-purple-400">
            UGX {Number(row.amount).toLocaleString()}
          </p>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={onReject}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-black text-[10px] uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center justify-center gap-1.5">
              <XCircle size={12}/> Reject
            </button>
            <button onClick={onApprove} disabled={approvingId === row.id}
              className="flex-[2] sm:flex-initial px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
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

// ─── CREDIT LEDGER ROW ───────────────────────────────────────────────────────
function CreditLedgerRow({ credit, isDark }) {
  const settled = isSettledCredit(credit);
  return (
    <div className={`rounded-2xl p-4 border flex items-start justify-between gap-3 flex-wrap transition-all
      ${settled
        ? isDark ? "bg-zinc-900/20 border-white/5 opacity-65" : "bg-zinc-50 border-zinc-100"
        : isDark ? "bg-purple-500/5 border-purple-500/20"     : "bg-purple-50 border-purple-200"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className={`font-black text-sm uppercase italic tracking-tighter ${isDark ? "text-white" : "text-zinc-900"}`}>
            {credit.table_name || "Table"}
          </span>
          {settled ? (
            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase">
              Settled ✓
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[8px] font-black uppercase animate-pulse">
              Outstanding
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px]">
          {credit.client_name && (
            <span className="flex items-center gap-1">
              <User size={9} className="text-zinc-500"/>
              <span className={isDark ? "text-zinc-300" : "text-zinc-700"}>{credit.client_name}</span>
            </span>
          )}
          {credit.client_phone && (
            <span className="flex items-center gap-1">
              <Phone size={9} className="text-zinc-500"/>
              <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>{credit.client_phone}</span>
            </span>
          )}
          {credit.pay_by && !settled && (
            <span className="flex items-center gap-1">
              <Clock size={9} className="text-zinc-500"/>
              <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>Pays: {credit.pay_by}</span>
            </span>
          )}
        </div>
        {settled && credit.settle_method && (
          <p className={`text-[8px] mt-1 font-mono ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            Settled via {credit.settle_method}
            {credit.settle_txn  ? ` · ${credit.settle_txn}` : ""}
            {credit.paid_at     ? ` · ${toLocalDateStr(new Date(credit.paid_at))}` : ""}
          </p>
        )}
        <p className={`text-[8px] mt-1 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>
          Approved by {credit.approved_by} · {toLocalDateStr(new Date(credit.created_at))}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-base font-[900] italic text-purple-400">
          UGX {Number(credit.amount).toLocaleString()}
        </p>
        {settled && credit.amount_paid && Number(credit.amount_paid) !== Number(credit.amount) && (
          <p className="text-[9px] text-emerald-400 font-bold mt-0.5">
            Paid: UGX {Number(credit.amount_paid).toLocaleString()}
          </p>
        )}
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
  const [ledgerExpanded,  setLedgerExpanded]  = useState(false);
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

  // FIXED: Fetch credits and pending approvals
  const fetchCredits = useCallback(async () => {
    try {
      // Get pending credit approvals from cashier_queue
      const approvalsRes = await fetch(`${API_URL}/api/cashier-ops/credit-approvals`);
      if (approvalsRes.ok) {
        const approvals = await approvalsRes.json();
        console.log("📋 Pending approvals:", approvals.length);
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

  // ── Credits derived values ────────────────────────────────────────────────
  const outstanding      = creditsLedger.filter(c => !c.paid);
  const settled          = creditsLedger.filter(c =>  c.paid);
  const totalOutstanding = outstanding.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalSettled     = settled.reduce((s, c) => s + Number(c.amount_paid || c.amount || 0), 0);
  const filteredCredits  =
    creditFilter === "outstanding" ? outstanding :
    creditFilter === "settled"     ? settled     : creditsLedger;

  // ── Credit settlement additions ───────────────────────────────────────────
  const settledTodayCredits = useMemo(() =>
    creditsLedger.filter(c => {
      if (!c.paid) return false;
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

  const totalGross   = Number(daySummary?.total_gross  ?? 0) + creditSettledByMethod.total;
  const totalCash    = Number(daySummary?.total_cash   ?? 0) + creditSettledByMethod.cash;
  const totalCard    = Number(daySummary?.total_card   ?? 0) + creditSettledByMethod.card;
  const totalMTN     = Number(daySummary?.total_mtn    ?? 0) + creditSettledByMethod.mtn;
  const totalAirtel  = Number(daySummary?.total_airtel ?? 0) + creditSettledByMethod.airtel;
  const orderCount   = Number(daySummary?.order_count  ?? 0);

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

  // ─── FIXED: Credit approve - stays visible until action completes ─────────
  const handleApprove = async (queueId) => {
    setApprovingId(queueId);
    try {
      const res = await fetch(`${API_URL}/api/cashier-ops/credit-approvals/${queueId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_by: currentStaffName }),
      });
      
      if (res.ok) {
        // Remove from approvals list
        setCreditApprovals(prev => prev.filter(r => r.id !== queueId));
        await fetchCredits();
        alert("✅ Credit approved successfully!");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to approve credit");
        // Refresh to show any changes
        await fetchCredits();
      }
    } catch (e) { 
      console.error("Approve error:", e);
      alert("Network error while approving");
    }
    setApprovingId(null);
  };

  // ─── FIXED: Credit reject - stays visible until action completes ──────────
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

  // ── Shared Tailwind shorthands ────────────────────────────────────────────
  const card  = isDark ? "bg-zinc-900/40 border-white/5" : "bg-white border-black/5 shadow-sm";
  const muted = isDark ? "text-zinc-500" : "text-zinc-400";

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-700 pb-32">

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-4xl font-[900] italic uppercase tracking-tighter leading-none">Performance</h1>
          <p className="text-yellow-500 text-[10px] font-black tracking-widest uppercase mt-2 italic">
            Audit Date: {selectedDate}
          </p>
        </div>
        <input
          type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className={`px-4 py-2 rounded-xl font-black text-[10px] border uppercase
            ${isDark ? "bg-zinc-900 border-white/10 text-white" : "bg-white border-black/10 text-zinc-900"}`}
        />
      </div>

      {/* ── REVENUE STAT CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <StatCard
          label="Gross Revenue" isDark={isDark} color="text-emerald-500"
          value={dayLoading ? "…" : fmt(totalGross)}
          sub={`${orderCount} orders${settledTodayCredits.length > 0 ? ` · incl. ${settledTodayCredits.length} credit settlement${settledTodayCredits.length > 1 ? "s" : ""}` : ""}`}
          icon={<TrendingUp size={18}/>}
        />
        <StatCard
          label="MTN Momo" isDark={isDark} color="text-yellow-400"
          value={dayLoading ? "…" : fmt(totalMTN)}
          icon={<Smartphone size={18} className="text-yellow-400"/>}
        />
        <StatCard
          label="Airtel Money" isDark={isDark} color="text-rose-500"
          value={dayLoading ? "…" : fmt(totalAirtel)}
          icon={<Smartphone size={18} className="text-rose-500"/>}
        />
        <StatCard
          label="Card / POS" isDark={isDark} color="text-blue-500"
          value={dayLoading ? "…" : fmt(totalCard)}
          icon={<CreditCard size={18} className="text-blue-500"/>}
        />
        <StatCard
          label="Physical Cash" isDark={isDark} color="text-emerald-500"
          value={dayLoading ? "…" : fmt(totalCash)}
          icon={<Wallet size={18} className="text-emerald-500"/>}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CREDITS SECTION WITH PERSISTENT APPROVAL BUTTONS
      ══════════════════════════════════════════════════════════════════════ */}
      <div className={`rounded-[2.5rem] border overflow-hidden ${card}`}>

        {/* Section title */}
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isDark ? "bg-purple-500/10" : "bg-purple-100"}`}>
              <BookOpen size={15} className="text-purple-400"/>
            </div>
            <div>
              <h3 className={`text-sm font-black uppercase tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
                Credits
              </h3>
              <p className={`text-[9px] mt-0.5 ${muted}`}>
                {creditApprovals.length > 0 && (
                  <span className="text-yellow-400 font-bold animate-pulse">
                    {creditApprovals.length} pending approval ·{" "}
                  </span>
                )}
                {outstanding.length} outstanding · {settled.length} settled
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {totalOutstanding > 0 && (
              <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-black uppercase animate-pulse">
                <AlertCircle size={10}/> {fmtK(totalOutstanding)} unpaid
              </span>
            )}
            {totalOutstanding === 0 && creditsLedger.length > 0 && (
              <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase">
                <CheckCircle2 size={10}/> All Settled
              </span>
            )}
            <button onClick={fetchCredits}
              className={`p-2.5 rounded-xl transition-all ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-zinc-100 hover:bg-zinc-200"}`}>
              <RefreshCw size={13} className={creditsLoading ? "animate-spin text-yellow-400" : muted}/>
            </button>
          </div>
        </div>

        {/* Summary tiles */}
        <div className={`grid grid-cols-3 gap-3 px-6 pb-5 border-t pt-5 ${isDark ? "border-white/5" : "border-black/5"}`}>
          <div className={`rounded-2xl p-4 ${isDark ? "bg-black/40 border border-purple-500/10" : "bg-purple-50 border border-purple-100"}`}>
            <p className={`text-[8px] font-black uppercase tracking-widest mb-2 ${isDark ? "text-zinc-500" : "text-purple-400"}`}>Outstanding</p>
            <p className="text-purple-400 font-[900] italic text-xl leading-none">{fmtK(totalOutstanding)}</p>
            <p className={`text-[9px] mt-1.5 ${isDark ? "text-zinc-600" : "text-purple-400/60"}`}>
              {outstanding.length} client{outstanding.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className={`rounded-2xl p-4 ${isDark ? "bg-black/40 border border-emerald-500/10" : "bg-emerald-50 border border-emerald-100"}`}>
            <p className={`text-[8px] font-black uppercase tracking-widest mb-2 ${isDark ? "text-zinc-500" : "text-emerald-500"}`}>Settled</p>
            <p className="text-emerald-400 font-[900] italic text-xl leading-none">{fmtK(totalSettled)}</p>
            <p className={`text-[9px] mt-1.5 ${isDark ? "text-zinc-600" : "text-emerald-500/60"}`}>
              {settled.length} record{settled.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="rounded-2xl p-4 bg-yellow-500">
            <p className="text-[8px] font-black uppercase tracking-widest mb-2 text-black/50">All Time</p>
            <p className="text-black font-[900] italic text-xl leading-none">{fmtK(totalOutstanding + totalSettled)}</p>
            <p className="text-[9px] mt-1.5 text-black/50">{creditsLedger.length} entries</p>
          </div>
        </div>

        {/* PENDING APPROVALS SECTION - APPROVAL BUTTONS PERSIST HERE */}
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
          // Show message when no pending approvals
          <div className={`px-6 pb-6 border-t pt-5 ${isDark ? "border-white/5" : "border-black/5"}`}>
            <div className="flex items-center justify-center py-8 opacity-50">
              <div className="text-center">
                <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500" />
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  No pending credit approvals
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Ledger — collapsible */}
        <div className={`border-t ${isDark ? "border-white/5" : "border-black/5"}`}>
          <button
            onClick={() => setLedgerExpanded(v => !v)}
            className={`w-full flex items-center justify-between px-6 py-4 transition-colors
              ${isDark ? "hover:bg-white/3" : "hover:bg-zinc-50"}`}>
            <div className="flex items-center gap-2">
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
                ? <ChevronUp size={14} className={muted}/>
                : <ChevronDown size={14} className={muted}/>}
            </div>
          </button>

          {ledgerExpanded && (
            <div className={`px-6 pb-6 space-y-4 border-t ${isDark ? "border-white/5" : "border-black/5"}`}>
              {/* Filter tabs */}
              <div className={`flex gap-1 p-1 rounded-xl w-fit mt-4 ${isDark ? "bg-zinc-900" : "bg-zinc-100"}`}>
                {[
                  { k: "all",         l: "All" },
                  { k: "outstanding", l: "Outstanding" },
                  { k: "settled",     l: "Settled" },
                ].map(({ k, l }) => (
                  <button key={k} onClick={() => setCreditFilter(k)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                      ${creditFilter === k
                        ? "bg-yellow-500 text-black shadow"
                        : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-700"}`}>
                    {l}
                  </button>
                ))}
              </div>

              {/* List */}
              {creditsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`h-16 rounded-2xl animate-pulse ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}/>
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
                <div className="space-y-2">
                  {filteredCredits.map(c => (
                    <CreditLedgerRow key={c.id} credit={c} isDark={isDark}/>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* ══ END CREDITS ══════════════════════════════════════════════════════ */}

      {/* ── 7-DAY REVENUE CHART ── */}
      <div className={`rounded-[2.5rem] border p-6 md:p-8 ${card}`}>
        <div className="mb-5">
          <p className={`text-[10px] font-black uppercase tracking-widest italic ${muted}`}>7-Day Revenue Flow</p>
          <p className={`text-[8px] font-bold uppercase mt-0.5 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            Cash · Card · MTN · Airtel · Gross
          </p>
        </div>
        <div className="w-full overflow-hidden">
          <RevenueChart/>
        </div>
      </div>

     

     

      {/* ── REJECT MODAL ── */}
      {rejectingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border
            ${isDark ? "bg-zinc-950 border-white/10" : "bg-white border-black/10"}`}>
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <XCircle size={22} className="text-red-400"/>
            </div>
            <h3 className="text-sm font-black uppercase text-red-400 mb-1 text-center tracking-widest">Reject Credit</h3>
            <p className={`text-[10px] text-center mb-6 uppercase tracking-widest ${muted}`}>
              Order will return to Served status
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)…"
              className={`w-full border rounded-2xl p-4 text-sm outline-none resize-none h-24 mb-6
                ${isDark
                  ? "bg-black border-white/5 text-white placeholder-zinc-600 focus:border-red-500/30"
                  : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-red-300"}`}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRejectingRow(null)}
                className={`flex-1 py-4 font-black text-[10px] uppercase rounded-2xl transition-all
                  ${isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"}`}>
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={approvingId === rejectingRow}
                className="flex-[2] py-4 bg-red-500 hover:bg-red-400 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50">
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