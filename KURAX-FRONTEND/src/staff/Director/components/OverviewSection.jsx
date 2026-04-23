import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp, Banknote, Smartphone, CreditCard, BookOpen,
  CheckCircle2, Clock, User, Phone, ChevronDown, ChevronUp,
  Wallet, Trash2, PlusCircle, RefreshCw, Hourglass, XCircle,
  Target,
} from "lucide-react";
import { useTheme } from "./shared/ThemeContext";
import { ShiftMiniCard, fmtK } from "./shared/UIHelpers";
import LiveLogs from "./liveLogs";
import { RevenueChart } from "../charts";
import API_URL from "../../../config/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtLargeNumber(n) {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `UGX ${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)     return `UGX ${(num / 1_000).toFixed(0)}K`;
  return `UGX ${num.toLocaleString()}`;
}

function fmtUGX(n) {
  return `UGX ${Number(n || 0).toLocaleString()}`;
}

// Get Kampala date (UTC+3) without timezone issues
function getKampalaDate(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── Petty categories ─────────────────────────────────────────────────────────
const PETTY_CATEGORIES = [
  "General","Charcoal/Fuel","Groceries/Ingredients","Cleaning Supplies",
  "Utilities","Maintenance","Transport","Staff Welfare","Packaging","Miscellaneous",
];

// ─── Credit Status Badge ──────────────────────────────────────────────────────
function CreditStatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  const map = {
    pendingcashier:         { label: "Wait for Cashier", icon: <Hourglass size={10} />,    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    pendingmanager:         { label: "Wait for Manager", icon: <Clock size={10} />,        color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    approved:               { label: "Approved",         icon: <CheckCircle2 size={10} />, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    fullysettled:           { label: "Settled ✓",        icon: <CheckCircle2 size={10} />, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    partiallysettled:       { label: "Partial",          icon: <Clock size={10} />,        color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    rejected:               { label: "Rejected ✗",      icon: <XCircle size={10} />,      color: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const cfg = map[s] || { label: status || "Unknown", icon: <BookOpen size={10} />, color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function DashboardStatCard({ label, value, sub, icon, color, isDark, largeValue = false, isLive = false }) {
  const displayValue = largeValue
    ? (typeof value === "string" ? value : fmtLargeNumber(value))
    : (typeof value === "string" ? value : fmtUGX(value));

  return (
    <div className={`group relative overflow-hidden rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 border
      ${isDark ? "bg-zinc-900 border-white/5" : "bg-white border-zinc-100"}`}>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${
            color === "text-emerald-500" ? "bg-emerald-500/10" :
            color === "text-yellow-500"  ? "bg-yellow-500/10"  :
            color === "text-purple-500"  ? "bg-purple-500/10"  :
            color === "text-orange-500"  ? "bg-orange-500/10"  :
            color === "text-blue-500"    ? "bg-blue-500/10"    :
            color === "text-red-500"     ? "bg-red-500/10"     :
            "bg-zinc-500/10"
          }`}>
            {icon}
          </div>
          <div className="flex items-center gap-1.5">
            {isLive && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[7px] font-black uppercase text-emerald-400 tracking-wider">Live</span>
              </span>
            )}
            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-wider">Today</span>
          </div>
        </div>
        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider mb-1 truncate">{label}</p>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-2xl font-black ${color} break-words`} title={typeof value === "number" ? fmtUGX(value) : undefined}>
            {displayValue}
          </span>
        </div>
        {sub && <p className="text-[9px] text-zinc-500 mt-1 leading-tight">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Credit Summary Card ──────────────────────────────────────────────────────
function CreditSummaryCard({
  isDark,
  creditsLoading,
  totalSettledCredits,
  totalOutstandingCredits,
  totalExpectedCredits,
  totalRejectedAmount,
  creditStats,
  creditsLedger,
  onRefresh,
}) {
  const now = new Date();
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className={`rounded-2xl border overflow-hidden
      ${isDark
        ? "bg-gradient-to-br from-purple-900/30 to-purple-800/10 border-purple-500/20"
        : "bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200"}`}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10">
              <BookOpen size={18} className="text-purple-500" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tighter text-purple-600 dark:text-purple-400">
                Credit Summary — All Staff
              </h3>
              <p className="text-[9px] text-zinc-500 mt-0.5">Persists for {monthLabel}</p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
            title="Refresh credits"
          >
            <RefreshCw size={12} className={creditsLoading ? "animate-spin text-purple-400" : "text-zinc-500"} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`rounded-2xl p-4 ${isDark ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Total Settled</p>
            </div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {creditsLoading ? "..." : fmtLargeNumber(totalSettledCredits)}
            </p>
            <p className="text-[8px] text-zinc-500 mt-1">
              {creditStats.settled} fully settled · {creditStats.partiallySettled} partially settled
            </p>
          </div>

          <div className={`rounded-2xl p-4 ${isDark ? "bg-orange-500/10 border border-orange-500/20" : "bg-orange-50 border border-orange-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              <Hourglass size={14} className="text-orange-500" />
              <p className="text-[9px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider">Total Outstanding</p>
            </div>
            <p className="text-2xl font-black text-orange-600 dark:text-orange-400">
              {creditsLoading ? "..." : fmtLargeNumber(totalOutstandingCredits)}
            </p>
            <p className="text-[8px] text-zinc-500 mt-1">
              {creditStats.approved} approved · {creditStats.pendingCashier} wait cashier · {creditStats.pendingManager} wait manager
            </p>
          </div>

          <div className={`rounded-2xl p-4 ${isDark ? "bg-purple-500/10 border border-purple-500/20" : "bg-purple-50 border border-purple-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              <Target size={14} className="text-purple-500" />
              <p className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider">Expected Total</p>
            </div>
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {creditsLoading ? "..." : fmtLargeNumber(totalExpectedCredits)}
            </p>
            <p className="text-[8px] text-zinc-500 mt-1">
              Settled + Outstanding · {creditsLedger.length} total records
            </p>
          </div>
        </div>

        {totalRejectedAmount > 0 && (
          <div className="mt-4 pt-3 border-t border-purple-500/20 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <XCircle size={12} className="text-red-500" />
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-wider">Rejected Credits</span>
            </div>
            <span className="text-sm font-black text-red-500">{fmtLargeNumber(totalRejectedAmount)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OverviewSection({ onViewRegistry }) {
  const { dark, t } = useTheme();
  const isDark = dark;

  // Summary
  const [summary,        setSummary]    = useState(null);
  const [summaryLoading, setSumLoad]    = useState(true);

  // Shifts
  const [shifts,         setShifts]     = useState([]);
  const [shiftsLoading,  setShiftsLoad] = useState(true);

  // Credits ledger
  const [creditsLedger,   setCreditsLedger]   = useState([]);
  const [creditsLoading,  setCreditsLoading]  = useState(true);
  const [creditsExpanded, setCreditsExpanded] = useState(false);
  const [creditFilter,    setCreditFilter]    = useState("all");

  // Petty cash
  const [pettyData,       setPettyData]       = useState({ total_out: 0, total_in: 0, net: 0, entries: [] });
  const [pettyLoading,    setPettyLoading]    = useState(true);
  const [pettyExpanded,   setPettyExpanded]   = useState(false);
  const [pettyFilter,     setPettyFilter]     = useState("all");
  const [showPettyModal,  setShowPettyModal]  = useState(false);
  const [savingPetty,     setSavingPetty]     = useState(false);
  const [deletingPettyId, setDeletingPettyId] = useState(null);

  // Shift detail modal
  const [selectedShift, setSelectedShift] = useState(null);

  // Petty form
  const [pettyDirection,   setPettyDirection]   = useState("OUT");
  const [pettyAmount,      setPettyAmount]      = useState("");
  const [pettyCategory,    setPettyCategory]    = useState("General");
  const [pettyDescription, setPettyDescription] = useState("");

  // Day closure state
  const [dayClosed, setDayClosed] = useState(false);
  const [dayClosureInfo, setDayClosureInfo] = useState(null);

  // SSE ref
  const sseRef = useRef(null);

  // Get today's date using local timezone
  const today = getKampalaDate();

  // ─── Status normaliser ───────────────────────────────────────────────────────
  const getNorm = (status) => {
    const s = String(status || "").trim();
    
    if (s === "PendingCashier") return "PendingCashier";
    if (s === "PendingManager") return "PendingManager";
    if (s === "Approved") return "Approved";
    if (s === "FullySettled") return "FullySettled";
    if (s === "PartiallySettled") return "PartiallySettled";
    if (s === "Rejected") return "Rejected";
    
    const lower = s.toLowerCase();
    if (lower === "pendingcashier") return "PendingCashier";
    if (lower === "pendingmanager") return "PendingManager";
    if (lower === "approved") return "Approved";
    if (lower === "fullysettled" || lower === "fully_settled") return "FullySettled";
    if (lower === "partiallysettled" || lower === "partially_settled") return "PartiallySettled";
    if (lower === "rejected") return "Rejected";
    
    console.warn(`Unknown status: ${status}`);
    return s;
  };

  // ─── Fetchers ───────────────────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/summaries/today?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        console.log("Summary fetched:", {
          total_cash: data.total_cash,
          total_card: data.total_card,
          total_mtn: data.total_mtn,
          total_airtel: data.total_airtel,
          total_gross: data.total_gross,
        });
        setSummary(data);
      }
    } catch (e) { console.error("Summary fetch failed:", e); }
    finally { setSumLoad(false); }
  }, []);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/credits`);
      if (res.ok) {
        const data = await res.json();
        console.log("Credits fetched:", data.length, "records");
        setCreditsLedger(data);
      }
    } catch (e) { console.error("Credits fetch failed:", e); }
    finally { setCreditsLoading(false); }
  }, []);

  const fetchPetty = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/summaries/petty-cash?date=${today}`);
      if (res.ok) setPettyData(await res.json());
    } catch (e) { console.error("Petty fetch failed:", e); }
    finally { setPettyLoading(false); }
  }, [today]);

  const fetchShifts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/overview/shifts?date=${today}`);
      if (res.ok) setShifts(await res.json());
    } catch (e) { console.error("Shifts fetch failed:", e); }
    finally { setShiftsLoad(false); }
  }, [today]);

  // ─── Day Closure Handlers ───────────────────────────────────────────────────
  const resetAllDataOnDayClosure = useCallback(async () => {
    console.log("Day closed - resetting director dashboard...");
    
    // Clear all local states
    setSummary(null);
    setShifts([]);
    setCreditsLedger([]);
    setPettyData({ total_out: 0, total_in: 0, net: 0, entries: [] });
    setCreditsExpanded(false);
    setCreditFilter("all");
    setPettyExpanded(false);
    setPettyFilter("all");
    setShowPettyModal(false);
    setSelectedShift(null);
    
    // Force refresh all data
    await Promise.all([
      fetchSummary(),
      fetchCredits(),
      fetchPetty(),
      fetchShifts()
    ]);
    
    // Show notification
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="position: fixed; bottom: 20px; right: 20px; z-index: 9999; background: #10B981; color: white; padding: 16px 24px; border-radius: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); animation: slideIn 0.3s ease-out; font-family: system-ui;">
        ✅ Day has been closed! All totals have been reset for the new day.
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }, [fetchSummary, fetchCredits, fetchPetty, fetchShifts]);

  const checkDayClosure = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/day-closure/day-status`);
      if (res.ok) {
        const data = await res.json();
        if (data.is_closed && !dayClosed) {
          console.log("Day is closed, resetting director dashboard...");
          setDayClosed(true);
          setDayClosureInfo(data);
          await resetAllDataOnDayClosure();
        } else if (!data.is_closed && dayClosed) {
          setDayClosed(false);
          setDayClosureInfo(null);
        }
      }
    } catch (err) {
      console.error("Check day closure error:", err);
    }
  }, [dayClosed, resetAllDataOnDayClosure]);

  // ─── Mount: initial fetch + polling + SSE ──────────────────────────────────
  useEffect(() => {
    fetchSummary();
    fetchCredits();
    fetchPetty();
    fetchShifts();

    const intervals = [
      setInterval(fetchSummary, 5_000),
      setInterval(fetchCredits, 30_000),
      setInterval(fetchPetty,   30_000),
      setInterval(fetchShifts,  60_000),
    ];

    try {
      const es = new EventSource(`${API_URL}/api/overview/stream`);
      sseRef.current = es;

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if ([
            "ORDER_CONFIRMED",
            "PAYMENT_CONFIRMED",
            "SUMMARY_UPDATE",
            "CASHIER_CONFIRMED",
            "CREDIT_SETTLED",
            "DAY_CLOSED",
          ].includes(data.type)) {
            fetchSummary();
            if (data.type === "DAY_CLOSED") {
              resetAllDataOnDayClosure();
            }
          }
          if ([
            "CREDIT_CREATED",
            "CREDIT_APPROVED",
            "CREDIT_SETTLED",
            "CREDIT_REJECTED",
          ].includes(data.type)) {
            fetchCredits();
          }
        } catch (_) {}
      };

      es.onerror = () => {
        es.close();
      };
    } catch (_) {}

    return () => {
      intervals.forEach(clearInterval);
      sseRef.current?.close();
    };
  }, [fetchSummary, fetchCredits, fetchPetty, fetchShifts, resetAllDataOnDayClosure]);

  // ─── Day Closure Event Listeners ───────────────────────────────────────────
  useEffect(() => {
    const handleDayClosed = () => {
      console.log("Day closed event received - resetting director dashboard");
      resetAllDataOnDayClosure();
    };

    const handleRefresh = () => {
      console.log("Refresh event received");
      fetchSummary();
      fetchCredits();
      fetchPetty();
      fetchShifts();
    };

    window.addEventListener('dayClosed', handleDayClosed);
    window.addEventListener('refresh', handleRefresh);
    
    return () => {
      window.removeEventListener('dayClosed', handleDayClosed);
      window.removeEventListener('refresh', handleRefresh);
    };
  }, [resetAllDataOnDayClosure, fetchSummary, fetchCredits, fetchPetty, fetchShifts]);

  // ─── Day Closure Interval ───────────────────────────────────────────────────
  useEffect(() => {
    const closureInterval = setInterval(checkDayClosure, 30000);
    return () => clearInterval(closureInterval);
  }, [checkDayClosure]);

  // ─── Petty handlers ─────────────────────────────────────────────────────────
  const handlePettyAdd = async () => {
    const amt = Number(pettyAmount);
    if (!amt || amt <= 0 || !pettyDescription.trim()) return;
    setSavingPetty(true);
    try {
      const loggedInUser = JSON.parse(localStorage.getItem("kurax_user") || "{}");
      const res = await fetch(`${API_URL}/api/summaries/petty-cash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount:      amt,
          direction:   pettyDirection,
          category:    pettyCategory,
          description: pettyDescription.trim(),
          logged_by:   loggedInUser?.name || "Director",
        }),
      });
      if (res.ok) {
        setPettyAmount(""); setPettyDescription(""); setPettyCategory("General"); setPettyDirection("OUT");
        setShowPettyModal(false);
        await fetchPetty();
        await fetchSummary();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save");
      }
    } catch (e) { console.error("Petty save failed:", e); }
    setSavingPetty(false);
  };

  const handlePettyDelete = async (id) => {
    setDeletingPettyId(id);
    try {
      await fetch(`${API_URL}/api/summaries/petty-cash/${id}`, { method: "DELETE" });
      await fetchPetty();
      await fetchSummary();
    } catch (e) { console.error("Petty delete failed:", e); }
    setDeletingPettyId(null);
  };

  // ─── Derived credit stats ───────────────────────────────────────────────────
  const creditStats = {
    pendingCashier:   creditsLedger.filter(c => getNorm(c.status) === "PendingCashier").length,
    pendingManager:   creditsLedger.filter(c => getNorm(c.status) === "PendingManager").length,
    approved:         creditsLedger.filter(c => getNorm(c.status) === "Approved").length,
    settled:          creditsLedger.filter(c => getNorm(c.status) === "FullySettled").length,
    partiallySettled: creditsLedger.filter(c => getNorm(c.status) === "PartiallySettled").length,
    rejected:         creditsLedger.filter(c => getNorm(c.status) === "Rejected").length,
  };

  const totalFullySettledPaid = creditsLedger
    .filter(c => getNorm(c.status) === "FullySettled")
    .reduce((s, c) => s + (Number(c.amount_paid) || Number(c.amount) || 0), 0);

  const totalPartiallySettledPaid = creditsLedger
    .filter(c => getNorm(c.status) === "PartiallySettled")
    .reduce((s, c) => s + (Number(c.amount_paid) || 0), 0);

  const totalPartiallySettledOutstanding = creditsLedger
    .filter(c => getNorm(c.status) === "PartiallySettled")
    .reduce((s, c) => s + (Number(c.balance) || (Number(c.amount) - Number(c.amount_paid)) || 0), 0);

  const totalApprovedAmount = creditsLedger
    .filter(c => getNorm(c.status) === "Approved")
    .reduce((s, c) => s + Number(c.amount || 0), 0);

  const totalPendingCashierAmount = creditsLedger
    .filter(c => getNorm(c.status) === "PendingCashier")
    .reduce((s, c) => s + Number(c.amount || 0), 0);

  const totalPendingManagerAmount = creditsLedger
    .filter(c => getNorm(c.status) === "PendingManager")
    .reduce((s, c) => s + Number(c.amount || 0), 0);

  const totalRejectedAmount = creditsLedger
    .filter(c => getNorm(c.status) === "Rejected")
    .reduce((s, c) => s + Number(c.amount || 0), 0);

  const totalSettledCredits = totalFullySettledPaid + totalPartiallySettledPaid;
  const totalOutstandingCredits = totalApprovedAmount + totalPendingCashierAmount + totalPendingManagerAmount + totalPartiallySettledOutstanding;
  const totalExpectedCredits = totalSettledCredits + totalOutstandingCredits;

  // ─── Revenue figures ─────────────────────────────────────────────────────────
  const rawCash    = Number(summary?.total_cash    ?? 0);
  const rawCard    = Number(summary?.total_card    ?? 0);
  const rawMTN     = Number(summary?.total_mtn     ?? 0);
  const rawAirtel  = Number(summary?.total_airtel  ?? 0);
  const rawGross   = Number(summary?.total_gross   ?? 0);

  const bk           = summary?.credit_settlements_breakdown ?? {};
  const settleCash   = Number(bk.cash   ?? 0);
  const settleCard   = Number(bk.card   ?? 0);
  const settleMTN    = Number(bk.mtn    ?? 0);
  const settleAirtel = Number(bk.airtel ?? 0);
  const settleTotal  = Number(summary?.credit_settlements_today ?? 0);

  const displayCash    = rawCash   - settleCash;
  const displayCard    = rawCard   - settleCard;
  const displayMTN     = rawMTN    - settleMTN;
  const displayAirtel  = rawAirtel - settleAirtel;
  const displayGross   = rawGross;

  // ─── Petty derived ──────────────────────────────────────────────────────────
  const pettyOut      = Number(pettyData.total_out ?? 0);
  const pettyIn       = Number(pettyData.total_in  ?? 0);
  const pettyNet      = pettyIn - pettyOut;
  const pettyEntries  = pettyData.entries || [];
  const filteredPetty = pettyFilter === "OUT" ? pettyEntries.filter(e => e.direction === "OUT")
                      : pettyFilter === "IN"  ? pettyEntries.filter(e => e.direction === "IN")
                      : pettyEntries;

  // ─── Credit tabs + filter ───────────────────────────────────────────────────
  const creditTabs = [
    { key: "all",              label: "All",              count: creditsLedger.length,          color: "zinc"   },
    { key: "PendingCashier",   label: "Wait for Cashier", count: creditStats.pendingCashier,    color: "yellow" },
    { key: "PendingManager",   label: "Wait for Manager", count: creditStats.pendingManager,    color: "orange" },
    { key: "Approved",         label: "Approved",         count: creditStats.approved,          color: "purple" },
    { key: "PartiallySettled", label: "Partially Settled",count: creditStats.partiallySettled,  color: "yellow" },
    { key: "FullySettled",     label: "Settled",          count: creditStats.settled,           color: "green"  },
    { key: "Rejected",         label: "Rejected",         count: creditStats.rejected,          color: "red"    },
  ];

  const getFilteredCredits = () => {
    switch (creditFilter) {
      case "PendingCashier":   return creditsLedger.filter(c => getNorm(c.status) === "PendingCashier");
      case "PendingManager":   return creditsLedger.filter(c => getNorm(c.status) === "PendingManager");
      case "Approved":         return creditsLedger.filter(c => getNorm(c.status) === "Approved");
      case "FullySettled":     return creditsLedger.filter(c => getNorm(c.status) === "FullySettled");
      case "PartiallySettled": return creditsLedger.filter(c => getNorm(c.status) === "PartiallySettled");
      case "Rejected":         return creditsLedger.filter(c => getNorm(c.status) === "Rejected");
      default:                 return creditsLedger;
    }
  };
  const filteredCredits = getFilteredCredits();

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Day Closed Banner */}
      {dayClosed && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center animate-in fade-in duration-500">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">
              ✅ New Day Started - All totals have been reset
            </p>
          </div>
          {dayClosureInfo && (
            <p className="text-[8px] text-emerald-500/70 mt-1">
              Closed by {dayClosureInfo.closed_by} at {dayClosureInfo.closed_at ? new Date(dayClosureInfo.closed_at).toLocaleTimeString() : new Date().toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {/* ── STAT CARDS — 5 cards, real-time via SSE + 5s polling ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

        <DashboardStatCard
          label="Cash on Hand"
          value={summaryLoading ? "..." : displayCash}
          sub={settleCash > 0
            ? `${fmtLargeNumber(settleCash)} credit settlements deducted`
            : "Cash payments only"}
          icon={<Banknote size={18} className="text-emerald-500" />}
          color="text-emerald-500"
          isDark={isDark}
          largeValue={true}
          isLive={true}
        />

        <DashboardStatCard
          label="Card"
          value={summaryLoading ? "..." : displayCard}
          sub={settleCard > 0
            ? `${fmtLargeNumber(settleCard)} credit settlements deducted`
            : "POS card payments only"}
          icon={<CreditCard size={18} className="text-blue-500" />}
          color="text-blue-500"
          isDark={isDark}
          largeValue={true}
          isLive={true}
        />

        <DashboardStatCard
          label="MTN Momo"
          value={summaryLoading ? "..." : displayMTN}
          sub={settleMTN > 0
            ? `${fmtLargeNumber(settleMTN)} credit settlements deducted`
            : "MTN mobile money only"}
          icon={<Smartphone size={18} className="text-yellow-500" />}
          color="text-yellow-500"
          isDark={isDark}
          largeValue={true}
          isLive={true}
        />

        <DashboardStatCard
          label="Airtel Money"
          value={summaryLoading ? "..." : displayAirtel}
          sub={settleAirtel > 0
            ? `${fmtLargeNumber(settleAirtel)} credit settlements deducted`
            : "Airtel mobile money only"}
          icon={<Smartphone size={18} className="text-red-500" />}
          color="text-red-500"
          isDark={isDark}
          largeValue={true}
          isLive={true}
        />

        <DashboardStatCard
          label="Gross Revenue"
          value={summaryLoading ? "..." : displayGross}
          sub={settleTotal > 0
            ? `${fmtLargeNumber(settleTotal)} credit settlements collected today`
            : "Cash + Card + MTN + Airtel"}
          icon={<TrendingUp size={18} className="text-emerald-500" />}
          color="text-emerald-500"
          isDark={isDark}
          largeValue={true}
          isLive={true}
        />
      </div>

      {/* ── CREDIT SUMMARY CARD ── */}
      <CreditSummaryCard
        isDark={isDark}
        creditsLoading={creditsLoading}
        totalSettledCredits={totalSettledCredits}
        totalOutstandingCredits={totalOutstandingCredits}
        totalExpectedCredits={totalExpectedCredits}
        totalRejectedAmount={totalRejectedAmount}
        creditStats={creditStats}
        creditsLedger={creditsLedger}
        onRefresh={fetchCredits}
      />

      {/* ── PETTY CASH LEDGER PANEL ── */}
      <div className={`${t.card} border rounded-2xl overflow-hidden`}>
        <button
          onClick={() => setPettyExpanded(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <Wallet size={14} />
            </div>
            <div className="text-left">
              <p className={`text-[10px] font-black uppercase tracking-widest ${t.subtext}`}>Petty Cash Ledger</p>
              <p className="text-[9px] text-zinc-600 mt-0.5">
                {pettyEntries.length} entries today ·{" "}
                <span className="text-rose-400 font-bold">OUT {fmtLargeNumber(pettyOut)}</span>
                {pettyIn > 0 && <span className="text-emerald-400 font-bold"> · IN {fmtLargeNumber(pettyIn)}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {pettyOut > 0 && (
              <span className="px-3 py-1 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase">
                −{fmtLargeNumber(pettyOut)}
              </span>
            )}
            {pettyExpanded ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
          </div>
        </button>

        {pettyExpanded && (
          <div className={`border-t px-5 pb-5 pt-4 space-y-4 ${isDark ? "border-white/5" : "border-black/5"}`}>
            <div className="grid grid-cols-3 gap-3">
              <div className={`${isDark ? "bg-black/40" : "bg-zinc-50"} rounded-2xl p-4`}>
                <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Total OUT</p>
                <p className="text-rose-400 font-black text-base">{fmtLargeNumber(pettyOut)}</p>
                <p className="text-[9px] text-zinc-600">{pettyEntries.filter(e => e.direction === "OUT").length} entries</p>
              </div>
              <div className={`${isDark ? "bg-black/40" : "bg-zinc-50"} rounded-2xl p-4`}>
                <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Total IN</p>
                <p className="text-emerald-400 font-black text-base">{fmtLargeNumber(pettyIn)}</p>
                <p className="text-[9px] text-zinc-600">{pettyEntries.filter(e => e.direction === "IN").length} entries</p>
              </div>
              <div className={`rounded-2xl p-4 ${pettyNet >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
                <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Net</p>
                <p className={`font-black text-base ${pettyNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {pettyNet >= 0 ? "+" : ""}UGX {Math.abs(pettyNet).toLocaleString()}
                </p>
                <p className="text-[9px] text-zinc-600">IN − OUT</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: isDark ? "#18181b" : "#f4f4f5" }}>
                {[{ k: "all", l: "All" }, { k: "OUT", l: "Expenses" }, { k: "IN", l: "Cash In" }].map(({ k, l }) => (
                  <button key={k} onClick={() => setPettyFilter(k)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                      ${pettyFilter === k ? "bg-yellow-500 text-black shadow" : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-700"}`}>
                    {l}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPettyModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-black rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-yellow-400 transition-all">
                <PlusCircle size={12} /> Log Entry
              </button>
            </div>

            {pettyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className={`h-14 rounded-2xl animate-pulse ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} />)}
              </div>
            ) : filteredPetty.length === 0 ? (
              <div className={`py-10 text-center border-2 border-dashed rounded-2xl ${isDark ? "border-white/5" : "border-zinc-200"}`}>
                <Wallet size={22} className="mx-auto mb-2 text-zinc-600" />
                <p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>No entries today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPetty.map(entry => (
                  <div key={entry.id}
                    className={`rounded-2xl p-4 border flex items-center justify-between gap-3 group transition-all
                      ${entry.direction === "OUT"
                        ? isDark ? "bg-zinc-900/40 border-white/5" : "bg-zinc-50 border-zinc-200"
                        : isDark ? "bg-emerald-500/5 border-emerald-500/15" : "bg-emerald-50 border-emerald-200"}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-xl shrink-0 ${entry.direction === "OUT"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}>
                        <Wallet size={13} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-xs font-black uppercase italic truncate ${isDark ? "text-white" : "text-zinc-900"}`}>
                            {entry.description}
                          </p>
                          <span className={`text-[8px] px-2 py-0.5 rounded-lg font-black uppercase shrink-0
                            ${isDark ? "bg-white/5 border border-white/5 text-zinc-500" : "bg-zinc-100 border border-zinc-200 text-zinc-500"}`}>
                            {entry.category}
                          </span>
                        </div>
                        <p className={`text-[9px] mt-0.5 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                          {entry.logged_by} · {new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className={`text-sm font-black italic ${entry.direction === "OUT" ? "text-rose-400" : "text-emerald-400"}`}>
                        {entry.direction === "OUT" ? "−" : "+"}UGX {Number(entry.amount).toLocaleString()}
                      </p>
                      <button
                        onClick={() => handlePettyDelete(entry.id)}
                        disabled={deletingPettyId === entry.id}
                        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all disabled:opacity-30">
                        {deletingPettyId === entry.id
                          ? <RefreshCw size={13} className="animate-spin" />
                          : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CREDITS LEDGER PANEL ── */}
      <div className={`${t.card} border rounded-2xl overflow-hidden`}>
        <button
          onClick={() => setCreditsExpanded(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <BookOpen size={14} />
            </div>
            <div className="text-left">
              <p className={`text-[10px] font-black uppercase tracking-widest ${t.subtext}`}>Credits Ledger</p>
              <p className="text-[9px] text-zinc-600 mt-0.5">
                {creditsLedger.length} total ·{" "}
                <span className="text-yellow-400 font-bold">{creditStats.pendingCashier} wait cashier</span>
                {creditStats.pendingManager > 0 && <span className="text-orange-400 font-bold"> · {creditStats.pendingManager} wait manager</span>}
                {creditStats.approved       > 0 && <span className="text-purple-400 font-bold"> · {creditStats.approved} approved</span>}
                {creditStats.settled        > 0 && <span className="text-emerald-400 font-bold"> · {creditStats.settled} settled</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {totalOutstandingCredits > 0 && (
              <span className="px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase">
                {fmtLargeNumber(totalOutstandingCredits)} pending
              </span>
            )}
            {creditsExpanded ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
          </div>
        </button>

        {creditsExpanded && (
          <div className={`border-t px-5 pb-5 pt-4 space-y-4 ${isDark ? "border-white/5" : "border-black/5"}`}>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                { key: "PendingCashier",   label: "Wait Cashier",    count: creditStats.pendingCashier,   amount: totalPendingCashierAmount,    color: "yellow"  },
                { key: "PendingManager",   label: "Wait Manager",    count: creditStats.pendingManager,   amount: totalPendingManagerAmount,    color: "orange"  },
                { key: "Approved",         label: "Approved",        count: creditStats.approved,         amount: totalApprovedAmount,          color: "purple"  },
                { key: "PartiallySettled", label: "Partial",         count: creditStats.partiallySettled, amount: totalPartiallySettledOutstanding, color: "yellow"  },
                { key: "FullySettled",     label: "Settled",         count: creditStats.settled,          amount: totalFullySettledPaid,           color: "emerald" },
                { key: "Rejected",         label: "Rejected",        count: creditStats.rejected,         amount: totalRejectedAmount,          color: "red"     },
              ].map(({ key, label, count, amount, color }) => {
                const cls = {
                  yellow:  { bg: isDark ? "bg-yellow-500/10 border-yellow-500/20"  : "bg-yellow-50 border-yellow-200",  text: "text-yellow-400"  },
                  orange:  { bg: isDark ? "bg-orange-500/10 border-orange-500/20"  : "bg-orange-50 border-orange-200",  text: "text-orange-400"  },
                  purple:  { bg: isDark ? "bg-purple-500/10 border-purple-500/20"  : "bg-purple-50 border-purple-200",  text: "text-purple-400"  },
                  emerald: { bg: isDark ? "bg-emerald-500/10 border-emerald-500/20": "bg-emerald-50 border-emerald-200", text: "text-emerald-400" },
                  red:     { bg: isDark ? "bg-red-500/10 border-red-500/20"        : "bg-red-50 border-red-200",        text: "text-red-400"     },
                }[color];
                return (
                  <div key={key} className={`${cls.bg} rounded-2xl p-3 border`}>
                    <p className={`text-[7px] font-black uppercase ${cls.text}`}>{label}</p>
                    <p className={`text-xl font-black ${cls.text}`}>{count}</p>
                    <p className="text-[8px] text-zinc-500">{fmtLargeNumber(amount)}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-1 p-1 rounded-xl w-fit" style={{ background: isDark ? "#18181b" : "#f4f4f5" }}>
              {creditTabs.map(({ key, label, count, color }) => {
                const activeColors = {
                  yellow: "bg-yellow-500 text-black",
                  orange: "bg-orange-500 text-white",
                  purple: "bg-purple-500 text-white",
                  green:  "bg-emerald-500 text-white",
                  red:    "bg-red-500 text-white",
                  zinc:   "bg-yellow-500 text-black",
                };
                return (
                  <button key={key} onClick={() => setCreditFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                      ${creditFilter === key
                        ? activeColors[color] || "bg-yellow-500 text-black"
                        : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-700"}`}>
                    {label}
                    {count > 0 && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[8px] font-black ${creditFilter === key ? "bg-white/20" : isDark ? "bg-white/10" : "bg-black/5"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {creditsLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className={`h-16 rounded-2xl animate-pulse ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} />)}
              </div>
            ) : filteredCredits.length === 0 ? (
              <div className={`py-10 text-center border-2 border-dashed rounded-2xl ${isDark ? "border-white/5" : "border-zinc-200"}`}>
                <BookOpen size={24} className="mx-auto mb-2 text-zinc-600" />
                <p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                  No {creditFilter} credits
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCredits.map(credit => (
                  <DirectorCreditRow key={credit.id} credit={credit} dark={isDark} t={t} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── REVENUE CHART ── */}
      <div className={`${t.card} border rounded-2xl p-4 md:p-8`}>
        <h3 className={`text-xs font-black uppercase italic mb-3 tracking-widest ${t.subtext}`}>Revenue Flow</h3>
        <div className="w-full overflow-hidden"><RevenueChart /></div>
      </div>

      {/* ── LIVE ACTIVITY FEED ── */}
      <div className={`${t.card} border rounded-2xl p-4 md:p-6`} style={{ minHeight: 480 }}>
        <LiveLogs dark={isDark} t={t} />
      </div>

      {/* ── SHIFT LIQUIDATIONS ── */}
      <div className={`${t.card} border rounded-2xl p-4 md:p-8`}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className={`text-xs font-black uppercase italic tracking-widest ${t.subtext}`}>Shift Liquidations</h3>
            <p className={`text-[8px] font-bold uppercase ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>Final tallies</p>
          </div>
          <button onClick={onViewRegistry}
            className="text-[9px] font-black text-yellow-500 border border-yellow-500/20 px-3 py-1.5 rounded-xl hover:bg-yellow-500 hover:text-black transition-all shrink-0">
            REGISTRY
          </button>
        </div>
        {shiftsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <div key={i} className={`h-16 rounded-xl animate-pulse ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} />)}
          </div>
        ) : shifts.length === 0 ? (
          <div className={`py-10 text-center border border-dashed rounded-2xl ${isDark ? "border-white/5" : "border-zinc-200"}`}>
            <p className={`text-[9px] font-black uppercase italic tracking-widest ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>No shifts ended today</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {shifts.map((shift, i) => {
              const isServiceRole = ["CHEF", "BARISTA", "BARMAN"].includes(shift.role?.toUpperCase());
              return (
                <div key={shift.id ?? i} onClick={() => setSelectedShift(shift)} className="cursor-pointer group">
                  <ShiftMiniCard
                    staff={`${shift.staff_name} (${shift.role})`}
                    time={shift.clock_out
                      ? new Date(shift.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "--:--"}
                    type={isServiceRole ? "service" : "cashier"}
                    status={isServiceRole ? shift.status ?? "" : undefined}
                    cash={isServiceRole ? undefined : fmtLargeNumber(shift.total_cash)}
                    momo={isServiceRole ? undefined : fmtLargeNumber(Number(shift.total_mtn || 0) + Number(shift.total_airtel || 0))}
                    card={isServiceRole ? undefined : fmtLargeNumber(shift.total_card)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PETTY CASH ADD MODAL ── */}
      {showPettyModal && (
        <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl space-y-5 border
            ${isDark ? "bg-[#111] border-white/10" : "bg-white border-zinc-200"}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black italic uppercase text-yellow-500 tracking-widest">New Petty Entry</h3>
              <button onClick={() => setShowPettyModal(false)}
                className={`p-1.5 rounded-full text-zinc-500 hover:text-white ${isDark ? "bg-zinc-900" : "bg-zinc-100"}`}>
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "OUT", label: "Expense (OUT)", color: "bg-rose-500/20 border-rose-500/40 text-rose-300" },
                { key: "IN",  label: "Cash IN",       color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" },
              ].map(({ key, label, color }) => (
                <button key={key} onClick={() => setPettyDirection(key)}
                  className={`py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all
                    ${pettyDirection === key ? color : "border-white/5 text-zinc-500 hover:border-white/20"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Category</p>
              <select value={pettyCategory} onChange={e => setPettyCategory(e.target.value)}
                className={`w-full rounded-2xl p-3 text-xs font-bold outline-none border
                  ${isDark ? "bg-black border-white/10 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-800"}`}>
                {PETTY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Description</p>
              <input value={pettyDescription} onChange={e => setPettyDescription(e.target.value)}
                placeholder="e.g. Bought charcoal for grill"
                className={`w-full rounded-xl p-4 text-xs outline-none border
                  ${isDark ? "bg-black border-white/5 text-white focus:border-yellow-500/50" : "bg-zinc-50 border-zinc-200 text-zinc-800"}`} />
            </div>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Amount (UGX)</p>
              <input type="number" value={pettyAmount} onChange={e => setPettyAmount(e.target.value)}
                placeholder="0"
                className={`w-full rounded-xl p-4 text-white font-black text-lg text-center outline-none border
                  ${isDark ? "bg-black border-white/5 focus:border-yellow-500/50" : "bg-zinc-50 border-zinc-200 text-zinc-800"}`} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPettyModal(false)}
                className="flex-1 py-4 text-zinc-500 font-black text-[10px] uppercase">Discard</button>
              <button onClick={handlePettyAdd}
                disabled={savingPetty || !pettyAmount || !pettyDescription.trim()}
                className={`flex-[2] py-4 rounded-2xl font-black text-xs uppercase transition-all
                  ${!savingPetty && pettyAmount && pettyDescription.trim()
                    ? "bg-yellow-500 text-black hover:bg-yellow-400 active:scale-[0.98]"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}>
                {savingPetty ? "Saving…" : "Post Entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SHIFT DETAIL MODAL ── */}
      {selectedShift && (
        <ShiftDetailModal shift={selectedShift} dark={isDark} onClose={() => setSelectedShift(null)} />
      )}
    </div>
  );
}

// ─── Director Credit Row ──────────────────────────────────────────────────────
function DirectorCreditRow({ credit, dark, t }) {
  const toLocalDateStr = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  };

  const norm = String(credit.status || "").toLowerCase();
  const isSettled   = norm === "fullysettled";
  const isPartial   = norm === "partiallysettled";
  const isRejected  = norm === "rejected";
  const displayAmt  = isSettled  ? (credit.amount_paid || credit.amount)
                    : isPartial  ? (credit.amount_paid || 0)
                    : credit.amount;

  return (
    <div className={`rounded-2xl p-4 border flex items-start justify-between gap-3 flex-wrap transition-all
      ${isSettled  ? dark ? "bg-emerald-500/5 border-emerald-500/15 opacity-70" : "bg-emerald-50 border-emerald-200 opacity-80"
      : isPartial  ? dark ? "bg-yellow-500/5 border-yellow-500/15"              : "bg-yellow-50 border-yellow-200"
      : isRejected ? dark ? "bg-red-500/5 border-red-500/15"                    : "bg-red-50 border-red-200"
      :              dark ? "bg-purple-500/5 border-purple-500/20"              : "bg-purple-50 border-purple-200"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`font-black text-sm uppercase italic tracking-tighter ${dark ? "text-white" : "text-zinc-900"}`}>
            {credit.table_name || "Table"}
          </span>
          <CreditStatusBadge status={credit.status} />
        </div>
        <div className="flex items-center gap-3 flex-wrap text-[9px]">
          {credit.client_name  && <span className="flex items-center gap-1"><User  size={9} className="text-zinc-500" /><span className={dark ? "text-zinc-300" : "text-zinc-700"}>{credit.client_name}</span></span>}
          {credit.client_phone && <span className="flex items-center gap-1"><Phone size={9} className="text-zinc-500" /><span className={dark ? "text-zinc-400" : "text-zinc-500"}>{credit.client_phone}</span></span>}
          {!isSettled && !isPartial && !isRejected && credit.pay_by && (
            <span className="flex items-center gap-1">
              <Clock size={9} className="text-amber-400" />
              <span className="text-amber-400 font-black">Pay by: {credit.pay_by}</span>
            </span>
          )}
        </div>
        {(isSettled || isPartial) && credit.settle_method && (
          <p className={`text-[8px] mt-1 font-mono ${dark ? "text-zinc-600" : "text-zinc-400"}`}>
            {isSettled ? "Settled" : "Partially settled"} via {credit.settle_method}
            {credit.settle_txn ? ` · ${credit.settle_txn}` : ""}
            {credit.paid_at ? ` · ${toLocalDateStr(new Date(credit.paid_at))}` : ""}
          </p>
        )}
        <p className={`text-[8px] mt-0.5 ${dark ? "text-zinc-700" : "text-zinc-400"}`}>
          {credit.approved_by ? `Approved by ${credit.approved_by} · ` : ""}
          {toLocalDateStr(new Date(credit.created_at))}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-base font-black italic ${isSettled ? "text-emerald-400" : isPartial ? "text-yellow-400" : isRejected ? "text-red-400" : "text-purple-400"}`}>
          UGX {Number(displayAmt).toLocaleString()}
        </p>
        {isPartial && credit.balance > 0 && (
          <p className="text-[8px] text-yellow-500 font-bold mt-0.5">Remaining: UGX {Number(credit.balance).toLocaleString()}</p>
        )}
        {isSettled && credit.amount_paid && Number(credit.amount_paid) !== Number(credit.amount) && (
          <p className="text-[8px] text-emerald-400 font-bold mt-0.5">Paid: UGX {Number(credit.amount_paid).toLocaleString()}</p>
        )}
      </div>
    </div>
  );
}

// ─── Shift Detail Modal ───────────────────────────────────────────────────────
function ShiftDetailModal({ shift, dark, onClose }) {
  const gross     = Number(shift.gross_total        || 0);
  const cash      = Number(shift.total_cash         || 0);
  const mtn       = Number(shift.total_mtn          || 0);
  const airtel    = Number(shift.total_airtel       || 0);
  const card      = Number(shift.total_card         || 0);
  const credit    = Number(shift.credit_approved_amt|| 0);
  const petty     = Number(shift.petty_out          || 0);
  const staffName = (shift.staff_name || "Staff").toUpperCase();
  const role      = (shift.role       || "STAFF").toUpperCase();
  const clockOut  = shift.clock_out
    ? new Date(shift.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--:--";
  const shiftDate = shift.shift_date || shift.clock_out?.split("T")[0] || "—";

  return (
    <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className={`w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden shadow-2xl border
        ${dark ? "bg-[#0f0f0f] border-white/10" : "bg-white border-zinc-200"}`}>

        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className={`w-10 h-1 rounded-full ${dark ? "bg-white/20" : "bg-zinc-200"}`} />
        </div>

        <div className={`flex items-center justify-between px-6 pt-4 pb-4 sm:pt-6 border-b ${dark ? "border-white/8" : "border-zinc-100"}`}>
          <div>
            <p className={`text-[10px] font-black tracking-[0.2em] uppercase mb-1 ${dark ? "text-zinc-600" : "text-zinc-400"}`}>
              {role} · {shiftDate}
            </p>
            <h2 className="text-lg font-black uppercase italic text-yellow-500 tracking-tight leading-none">{staffName}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border
              ${dark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-600"}`}>
              Shift ended {clockOut}
            </span>
            <button onClick={onClose}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all
                ${dark ? "bg-white/5 border border-white/10 text-zinc-500 hover:text-white" : "bg-zinc-100 border border-zinc-200 text-zinc-400 hover:text-zinc-700"}`}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>×</span>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[70vh] sm:max-h-none px-5 pb-6 pt-4 space-y-3">
          <div className={`border rounded-2xl p-4 space-y-3 ${dark ? "bg-white/3 border-white/7" : "bg-zinc-50 border-zinc-100"}`}>
            <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${dark ? "text-zinc-600" : "text-zinc-400"}`}>Cash</p>
            <div className="flex justify-between items-center">
              <span className={`text-xs font-bold ${dark ? "text-zinc-400" : "text-zinc-500"}`}>Cash Collected</span>
              <span className={`text-sm font-black italic ${dark ? "text-white" : "text-zinc-800"}`}>UGX {cash.toLocaleString()}</span>
            </div>
            {petty > 0 && (
              <div className="flex justify-between items-center">
                <span className={`text-xs font-bold ${dark ? "text-zinc-400" : "text-zinc-500"}`}>Petty Outflow</span>
                <span className="text-sm font-black italic text-rose-400">− UGX {petty.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className={`border rounded-2xl p-4 ${dark ? "bg-white/3 border-white/7" : "bg-zinc-50 border-zinc-100"}`}>
            <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-3 ${dark ? "text-zinc-600" : "text-zinc-400"}`}>Digital Settlements</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "MTN Momo", value: mtn,    color: "text-yellow-400", bg: dark ? "bg-yellow-500/8  border-yellow-500/15" : "bg-yellow-50  border-yellow-200" },
                { label: "Airtel",   value: airtel,  color: "text-red-400",   bg: dark ? "bg-red-500/8     border-red-500/15"    : "bg-red-50     border-red-200"    },
                { label: "POS Card", value: card,    color: "text-blue-400",  bg: dark ? "bg-blue-500/8    border-blue-500/15"   : "bg-blue-50    border-blue-200"   },
                { label: "Credits",  value: credit,  color: "text-purple-400",bg: dark ? "bg-purple-500/8  border-purple-500/15" : "bg-purple-50  border-purple-200" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`${bg} border rounded-xl p-3`}>
                  <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${dark ? "text-zinc-500" : "text-zinc-400"}`}>{label}</p>
                  <p className={`text-sm font-black italic ${value > 0 ? color : dark ? "text-zinc-600" : "text-zinc-300"}`}>
                    UGX {value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {shift.total_orders > 0 && (
            <div className={`border rounded-2xl px-4 py-3 flex items-center justify-between ${dark ? "bg-white/3 border-white/7" : "bg-zinc-50 border-zinc-100"}`}>
              <span className={`text-xs font-bold ${dark ? "text-zinc-400" : "text-zinc-500"}`}>Orders Handled</span>
              <span className={`text-sm font-black italic ${dark ? "text-white" : "text-zinc-800"}`}>{shift.total_orders}</span>
            </div>
          )}

          <div className={`rounded-2xl p-4 flex items-center justify-between border
            ${dark ? "bg-yellow-500/6 border-yellow-500/20" : "bg-yellow-50 border-yellow-200"}`}>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${dark ? "text-yellow-700" : "text-yellow-600"}`}>
                Total Shift Revenue
              </p>
              <p className="text-2xl font-black italic text-yellow-500 tracking-tight">UGX {gross.toLocaleString()}</p>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border
              ${dark ? "bg-yellow-500/10 border-yellow-500/25" : "bg-yellow-100 border-yellow-300"}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          <button onClick={onClose}
            className={`w-full py-4 rounded-xl font-black uppercase italic text-sm tracking-widest transition-all active:scale-[0.98]
              ${dark ? "bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white" : "bg-zinc-100 border border-zinc-200 text-zinc-500 hover:text-zinc-800"}`}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}