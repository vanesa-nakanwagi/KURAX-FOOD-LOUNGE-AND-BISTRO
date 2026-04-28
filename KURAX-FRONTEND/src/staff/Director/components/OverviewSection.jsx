import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp, Banknote, Smartphone, CreditCard, BookOpen,
  CheckCircle2, Clock, User, Phone, ChevronDown, ChevronUp,
  Wallet, Trash2, PlusCircle, RefreshCw, Hourglass, XCircle,
  Target, Calendar,
} from "lucide-react";
import { ShiftMiniCard, fmtK } from "./shared/UIHelpers";
import LiveLogs from "./liveLogs";
import { RevenueChart } from "../charts";
import API_URL from "../../../config/api";

// ─── Helpers (unchanged) ─────────────────────────────────────────────────────
function fmtLargeNumber(n) {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `UGX ${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)     return `UGX ${(num / 1_000).toFixed(0)}K`;
  return `UGX ${num.toLocaleString()}`;
}

function fmtUGX(n) {
  return `UGX ${Number(n || 0).toLocaleString()}`;
}

function getKampalaDate(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isCurrentMonthCredit(creditDate) {
  const now = new Date();
  const creditDateObj = new Date(creditDate);
  return creditDateObj.getMonth() === now.getMonth() && 
         creditDateObj.getFullYear() === now.getFullYear();
}

const PETTY_CATEGORIES = [
  "General","Charcoal/Fuel","Groceries/Ingredients","Cleaning Supplies",
  "Utilities","Maintenance","Transport","Staff Welfare","Packaging","Miscellaneous",
];

// ─── Credit Status Badge (unchanged) ─────────────────────────────────────────
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

// ─── Stat Card (now fixed white background) ───────────────────────────────────
function DashboardStatCard({ label, value, sub, icon, color, largeValue = false, isLive = false }) {
  const displayValue = largeValue
    ? (typeof value === "string" ? value : fmtLargeNumber(value))
    : (typeof value === "string" ? value : fmtUGX(value));

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 hover:border-yellow-500/30">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${
            color === "text-emerald-500" ? "bg-emerald-50" :
            color === "text-yellow-500"  ? "bg-yellow-50"  :
            color === "text-purple-500"  ? "bg-purple-50"  :
            color === "text-orange-500"  ? "bg-orange-50"  :
            color === "text-blue-500"    ? "bg-blue-50"    :
            color === "text-red-500"     ? "bg-red-50"     :
            "bg-zinc-100"
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
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Today</span>
          </div>
        </div>
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1 truncate">{label}</p>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-2xl font-black ${color} break-words`} title={typeof value === "number" ? fmtUGX(value) : undefined}>
            {displayValue}
          </span>
        </div>
        {sub && <p className="text-[9px] text-gray-500 mt-1 leading-tight">{sub}</p>}
      </div>
    </div>
  );
}

// ─── CREDIT SUMMARY CARD (removed from dashboard) ─────────────────────────────
// (This component is kept for reference but not used in the main render)

// ─── Main Component (no theme, fixed white/black/yellow) ─────────────────────
export default function OverviewSection({ onViewRegistry }) {
  // All state, hooks, fetching logic – exactly the same as before
  const [summary,        setSummary]    = useState(null);
  const [summaryLoading, setSumLoad]    = useState(true);
  const [shifts,         setShifts]     = useState([]);
  const [shiftsLoading,  setShiftsLoad] = useState(true);
  const [allCredits,     setAllCredits] = useState([]);
  const [creditsLedger,  setCreditsLedger] = useState([]);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [creditsExpanded,setCreditsExpanded] = useState(false);
  const [creditFilter,   setCreditFilter] = useState("all");
  const [pettyData,      setPettyData]  = useState({ total_out: 0, total_in: 0, net: 0, entries: [] });
  const [pettyLoading,   setPettyLoading] = useState(true);
  const [pettyExpanded,  setPettyExpanded] = useState(false);
  const [pettyFilter,    setPettyFilter] = useState("all");
  const [showPettyModal, setShowPettyModal] = useState(false);
  const [savingPetty,    setSavingPetty] = useState(false);
  const [deletingPettyId, setDeletingPettyId] = useState(null);
  const [selectedShift,  setSelectedShift] = useState(null);
  const [pettyDirection, setPettyDirection] = useState("OUT");
  const [pettyAmount,    setPettyAmount] = useState("");
  const [pettyCategory,  setPettyCategory] = useState("General");
  const [pettyDescription, setPettyDescription] = useState("");
  const [dayClosed,      setDayClosed]   = useState(false);
  const [dayClosureInfo, setDayClosureInfo] = useState(null);
  const [currentMonth,   setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear,    setCurrentYear]  = useState(new Date().getFullYear());
  const sseRef = useRef(null);
  const today = getKampalaDate();

  // --- All the same fetch functions (fetchSummary, fetchCredits, fetchPetty, fetchShifts, etc.)
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
    return s;
  };

  const filterCreditsByCurrentMonth = useCallback((credits) => {
    const now = new Date();
    const currentMonthNum = now.getMonth();
    const currentYearNum = now.getFullYear();
    return credits.filter(credit => {
      const creditDate = new Date(credit.created_at);
      return creditDate.getMonth() === currentMonthNum && creditDate.getFullYear() === currentYearNum;
    });
  }, []);

  useEffect(() => {
    const now = new Date();
    const currentMonthNum = now.getMonth();
    const currentYearNum = now.getFullYear();
    if (currentMonthNum !== currentMonth || currentYearNum !== currentYear) {
      setCurrentMonth(currentMonthNum);
      setCurrentYear(currentYearNum);
      fetchCredits();
    }
  }, [currentMonth, currentYear]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/accountant/today?t=${Date.now()}`);
      if (res.ok) setSummary(await res.json());
      else {
        const fallbackRes = await fetch(`${API_URL}/api/summaries/today?t=${Date.now()}`);
        if (fallbackRes.ok) setSummary(await fallbackRes.json());
      }
    } catch (e) { console.error("Summary fetch failed:", e); }
    finally { setSumLoad(false); }
  }, []);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/credits`);
      if (res.ok) {
        const data = await res.json();
        setAllCredits(data);
        const currentMonthCredits = filterCreditsByCurrentMonth(data);
        setCreditsLedger(currentMonthCredits);
      }
    } catch (e) { console.error("Credits fetch failed:", e); }
    finally { setCreditsLoading(false); }
  }, [filterCreditsByCurrentMonth]);

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

  const resetAllDataOnDayClosure = useCallback(async () => {
    setSummary(null);
    setShifts([]);
    setPettyData({ total_out: 0, total_in: 0, net: 0, entries: [] });
    setCreditsExpanded(false);
    setCreditFilter("all");
    setPettyExpanded(false);
    setPettyFilter("all");
    setShowPettyModal(false);
    setSelectedShift(null);
    await Promise.all([fetchSummary(), fetchCredits(), fetchPetty(), fetchShifts()]);
    const notification = document.createElement('div');
    notification.innerHTML = `<div style="position: fixed; bottom: 20px; right: 20px; z-index: 9999; background: #10B981; color: white; padding: 16px 24px; border-radius: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); animation: slideIn 0.3s ease-out;">✅ Day has been closed! Revenue and petty cash totals have been reset. Credits persist for the month.</div>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }, [fetchSummary, fetchCredits, fetchPetty, fetchShifts]);

  const checkDayClosure = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/day-closure/day-status`);
      if (res.ok) {
        const data = await res.json();
        if (data.is_closed && !dayClosed) {
          setDayClosed(true);
          setDayClosureInfo(data);
          await resetAllDataOnDayClosure();
        } else if (!data.is_closed && dayClosed) {
          setDayClosed(false);
          setDayClosureInfo(null);
        }
      }
    } catch (err) { console.error("Check day closure error:", err); }
  }, [dayClosed, resetAllDataOnDayClosure]);

  useEffect(() => {
    fetchSummary();
    fetchCredits();
    fetchPetty();
    fetchShifts();
    const intervals = [
      setInterval(fetchSummary, 5000),
      setInterval(fetchCredits, 30000),
      setInterval(fetchPetty,   30000),
      setInterval(fetchShifts,  60000),
    ];
    try {
      const es = new EventSource(`${API_URL}/api/overview/stream`);
      sseRef.current = es;
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (["ORDER_CONFIRMED","PAYMENT_CONFIRMED","SUMMARY_UPDATE","CASHIER_CONFIRMED","CREDIT_SETTLED","DAY_CLOSED"].includes(data.type)) {
            fetchSummary();
            if (data.type === "DAY_CLOSED") resetAllDataOnDayClosure();
          }
          if (["CREDIT_CREATED","CREDIT_APPROVED","CREDIT_SETTLED","CREDIT_REJECTED"].includes(data.type)) fetchCredits();
        } catch {}
      };
      es.onerror = () => es.close();
    } catch {}
    return () => {
      intervals.forEach(clearInterval);
      sseRef.current?.close();
    };
  }, [fetchSummary, fetchCredits, fetchPetty, fetchShifts, resetAllDataOnDayClosure]);

  useEffect(() => {
    const handleDayClosed = () => resetAllDataOnDayClosure();
    const handleRefresh = () => {
      fetchSummary(); fetchCredits(); fetchPetty(); fetchShifts();
    };
    window.addEventListener('dayClosed', handleDayClosed);
    window.addEventListener('refresh', handleRefresh);
    return () => {
      window.removeEventListener('dayClosed', handleDayClosed);
      window.removeEventListener('refresh', handleRefresh);
    };
  }, [resetAllDataOnDayClosure, fetchSummary, fetchCredits, fetchPetty, fetchShifts]);

  useEffect(() => {
    const closureInterval = setInterval(checkDayClosure, 30000);
    return () => clearInterval(closureInterval);
  }, [checkDayClosure]);

  const handlePettyAdd = async () => {
    if (dayClosed) { alert("Day is closed. Cannot add petty cash entries for a closed day."); return; }
    const amt = Number(pettyAmount);
    if (!amt || amt <= 0 || !pettyDescription.trim()) return;
    setSavingPetty(true);
    try {
      const loggedInUser = JSON.parse(localStorage.getItem("kurax_user") || "{}");
      const res = await fetch(`${API_URL}/api/summaries/petty-cash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt, direction: pettyDirection, category: pettyCategory,
          description: pettyDescription.trim(), logged_by: loggedInUser?.name || "Director",
        }),
      });
      if (res.ok) {
        setPettyAmount(""); setPettyDescription(""); setPettyCategory("General"); setPettyDirection("OUT");
        setShowPettyModal(false);
        await fetchPetty();
        await fetchSummary();
      } else { const err = await res.json(); alert(err.error || "Failed to save"); }
    } catch (e) { console.error("Petty save failed:", e); }
    setSavingPetty(false);
  };

  const handlePettyDelete = async (id) => {
    if (dayClosed) { alert("Day is closed. Cannot delete entries from a closed day."); return; }
    setDeletingPettyId(id);
    try {
      await fetch(`${API_URL}/api/summaries/petty-cash/${id}`, { method: "DELETE" });
      await fetchPetty();
      await fetchSummary();
    } catch (e) { console.error("Petty delete failed:", e); }
    setDeletingPettyId(null);
  };

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

  const rawCash    = Number(summary?.total_cash    ?? 0);
  const rawCard    = Number(summary?.total_card    ?? 0);
  const rawMTN     = Number(summary?.total_mtn     ?? 0);
  const rawAirtel  = Number(summary?.total_airtel  ?? 0);
  const rawGross   = Number(summary?.total_gross   ?? 0);
  const pendingCredits = Number(summary?.pending_credit_requests_amount ?? 0);
  const settleTotal  = Number(summary?.credit_settlements_today ?? 0);
  const settleCash   = Number(summary?.credit_settlements_breakdown?.cash ?? 0);
  const settleCard   = Number(summary?.credit_settlements_breakdown?.card ?? 0);
  const settleMTN    = Number(summary?.credit_settlements_breakdown?.mtn ?? 0);
  const settleAirtel = Number(summary?.credit_settlements_breakdown?.airtel ?? 0);

  const displayCash    = rawCash;
  const displayCard    = rawCard;
  const displayMTN     = rawMTN;
  const displayAirtel  = rawAirtel;
  const displayGross   = rawGross;
  const totalMobileMoney = displayMTN + displayAirtel;

  const pettyOut      = Number(pettyData.total_out ?? 0);
  const pettyIn       = Number(pettyData.total_in  ?? 0);
  const pettyNet      = pettyIn - pettyOut;
  const pettyEntries  = pettyData.entries || [];
  const filteredPetty = pettyFilter === "OUT" ? pettyEntries.filter(e => e.direction === "OUT")
                      : pettyFilter === "IN"  ? pettyEntries.filter(e => e.direction === "IN")
                      : pettyEntries;

  const orderCount = Number(summary?.order_count ?? 0);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Pending Credits Warning Banner */}
      {!dayClosed && pendingCredits > 0 && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 animate-in fade-in duration-500">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20">
              <Hourglass size={16} className="text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-wider">
                Pending Credit Requests
              </p>
              <p className="text-[9px] text-gray-500">
                UGX {pendingCredits.toLocaleString()} in credit requests waiting for approval.
                These will be added to gross revenue when approved AND settled.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Day Closed Banner */}
      {dayClosed && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">
              Day Closed - Revenue and petty cash have been reset. Credits persist for the month.
            </p>
          </div>
          {dayClosureInfo && (
            <p className="text-[8px] text-emerald-500/70 mt-1">
              Closed by {dayClosureInfo.closed_by} at {dayClosureInfo.closed_at ? new Date(dayClosureInfo.closed_at).toLocaleTimeString() : new Date().toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {/* ── DAILY SUMMARY HEADER ── */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-yellow-100">
          <Calendar size={18} className="text-yellow-600" />
        </div>
        <div>
          <h3 className="text-medium font-medium uppercase tracking-tighter text-yellow-900">
            Daily Summary
          </h3>
          <p className="text-[9px] text-gray-500 mt-0.5">Revenue breakdown for {getKampalaDate()}</p>
        </div>
      </div>

      {/* ── STAT CARDS (2 per row on mobile) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <DashboardStatCard
          label="Cash Revenue"
          value={summaryLoading ? "..." : (dayClosed ? 0 : displayCash)}
          sub={dayClosed ? "Day closed - totals reset" : "Cash payments only"}
          icon={<Banknote size={18} className="text-emerald-600" />}
          color="text-emerald-600"
          largeValue={true}
          isLive={!dayClosed}
        />

        <DashboardStatCard
          label="Card Revenue"
          value={summaryLoading ? "..." : (dayClosed ? 0 : displayCard)}
          sub={dayClosed ? "Day closed - totals reset" : "POS card payments only"}
          icon={<CreditCard size={18} className="text-blue-600" />}
          color="text-blue-600"
          largeValue={true}
          isLive={!dayClosed}
        />

        <DashboardStatCard
          label="MTN Momo Revenue"
          value={summaryLoading ? "..." : (dayClosed ? 0 : displayMTN)}
          sub={dayClosed ? "Day closed - totals reset" : "MTN mobile money only"}
          icon={<Smartphone size={18} className="text-yellow-600" />}
          color="text-yellow-600"
          largeValue={true}
          isLive={!dayClosed}
        />

        <DashboardStatCard
          label="Airtel Money Revenue"
          value={summaryLoading ? "..." : (dayClosed ? 0 : displayAirtel)}
          sub={dayClosed ? "Day closed - totals reset" : "Airtel mobile money only"}
          icon={<Smartphone size={18} className="text-red-600" />}
          color="text-red-600"
          largeValue={true}
          isLive={!dayClosed}
        />

        <DashboardStatCard
          label="Gross Revenue"
          value={summaryLoading ? "..." : (dayClosed ? 0 : displayGross)}
          sub={settleTotal > 0 && !dayClosed
            ? `${fmtLargeNumber(settleTotal)} credit settlements collected today`
            : dayClosed ? "Day closed - totals reset" : "Cash + Card + MTN + Airtel (Paid orders only)"}
          icon={<TrendingUp size={18} className="text-emerald-600" />}
          color="text-emerald-600"
          largeValue={true}
          isLive={!dayClosed}
        />
      </div>

      {/* Credit Settlements Today Banner */}
      {!dayClosed && settleTotal > 0 && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Credits Settled Today:</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {settleCash > 0 && <span className="text-[9px] font-black text-emerald-500">Cash: {fmtLargeNumber(settleCash)}</span>}
              {settleCard > 0 && <span className="text-[9px] font-black text-emerald-500">Card: {fmtLargeNumber(settleCard)}</span>}
              {settleMTN > 0 && <span className="text-[9px] font-black text-emerald-500">MTN: {fmtLargeNumber(settleMTN)}</span>}
              {settleAirtel > 0 && <span className="text-[9px] font-black text-emerald-500">Airtel: {fmtLargeNumber(settleAirtel)}</span>}
              <span className="text-[10px] font-black text-emerald-700">Total: {fmtLargeNumber(settleTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── PETTY CASH LEDGER PANEL (exposed with consistent header) ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-100">
              <Wallet size={18} className="text-rose-600" />
            </div>
            <div>
              <h3 className="text-medium font-medium uppercase tracking-tighter text-yellow-900">
                Petty Cash Ledger
              </h3>
              <p className="text-[9px] text-gray-500 mt-0.5">
                {dayClosed ? "Day closed - totals reset" : `${pettyEntries.length} entries today`}
                {!dayClosed && (
                  <>
                    · <span className="text-rose-500 font-bold">OUT {fmtLargeNumber(pettyOut)}</span>
                    {pettyIn > 0 && <span className="text-emerald-600 font-bold"> · IN {fmtLargeNumber(pettyIn)}</span>}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 px-5 pb-5 pt-4 space-y-4">
          {dayClosed ? (
            <div className="py-10 text-center">
              <CheckCircle2 size={28} className="mx-auto text-emerald-500 mb-3" />
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Day Closed - Petty cash has been archived</p>
              <p className="text-[8px] text-gray-500 mt-1">All petty cash entries have been reset for the new day</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-[8px] font-black uppercase text-gray-500 tracking-widest mb-1">Total OUT</p>
                  <p className="text-rose-500 font-black text-base">{fmtLargeNumber(pettyOut)}</p>
                  <p className="text-[9px] text-gray-500">{pettyEntries.filter(e => e.direction === "OUT").length} entries</p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-[8px] font-black uppercase text-gray-500 tracking-widest mb-1">Total IN</p>
                  <p className="text-emerald-600 font-black text-base">{fmtLargeNumber(pettyIn)}</p>
                  <p className="text-[9px] text-gray-500">{pettyEntries.filter(e => e.direction === "IN").length} entries</p>
                </div>
                <div className={`rounded-2xl p-4 ${pettyNet >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
                  <p className="text-[8px] font-black uppercase text-gray-500 tracking-widest mb-1">Net</p>
                  <p className={`font-black text-base ${pettyNet >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    {pettyNet >= 0 ? "+" : ""}UGX {Math.abs(pettyNet).toLocaleString()}
                  </p>
                  <p className="text-[9px] text-gray-500">IN − OUT</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-1 p-1 rounded-xl w-full max-w-xs bg-gray-100">
                  {[{ k: "all", l: "All" }, { k: "OUT", l: "Expenses" }, { k: "IN", l: "Cash In" }].map(({ k, l }) => (
                    <button key={k} onClick={() => setPettyFilter(k)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                        ${pettyFilter === k ? "bg-yellow-500 text-black shadow" : "text-gray-500 hover:text-gray-700"}`}>
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
                  {[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl animate-pulse bg-gray-100" />)}
                </div>
              ) : filteredPetty.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed rounded-2xl border-gray-200">
                  <Wallet size={22} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">No entries today</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPetty.map(entry => (
                    <div key={entry.id}
                      className={`rounded-2xl p-4 border flex items-center justify-between gap-3 group transition-all
                        ${entry.direction === "OUT"
                          ? "bg-gray-50 border-gray-200"
                          : "bg-emerald-50 border-emerald-200"}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-xl shrink-0 ${entry.direction === "OUT"
                          ? "bg-rose-100 text-rose-500 border border-rose-200"
                          : "bg-emerald-100 text-emerald-600 border border-emerald-200"}`}>
                          <Wallet size={13} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-black uppercase italic truncate text-gray-900">
                              {entry.description}
                            </p>
                            <span className="text-[8px] px-2 py-0.5 rounded-lg font-black uppercase shrink-0 bg-gray-100 border border-gray-200 text-gray-500">
                              {entry.category}
                            </span>
                          </div>
                          <p className="text-[9px] mt-0.5 text-gray-500">
                            {entry.logged_by} · {new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className={`text-sm font-black italic ${entry.direction === "OUT" ? "text-rose-500" : "text-emerald-600"}`}>
                          {entry.direction === "OUT" ? "−" : "+"}UGX {Number(entry.amount).toLocaleString()}
                        </p>
                        <button
                          onClick={() => handlePettyDelete(entry.id)}
                          disabled={deletingPettyId === entry.id}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-rose-500 transition-all disabled:opacity-30">
                          {deletingPettyId === entry.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── REVENUE CHART ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-8">
        <h3 className="text-xs font-black uppercase italic mb-3 tracking-widest text-gray-500">Revenue Flow</h3>
        <div className="w-full overflow-hidden"><RevenueChart /></div>
      </div>

      {/* ── LIVE ACTIVITY FEED ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6" style={{ minHeight: 480 }}>
        <LiveLogs dark={false} t={{}} />
      </div>

      {/* ── PETTY CASH ADD MODAL ── */}
      {showPettyModal && !dayClosed && (
        <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl space-y-5 border bg-white border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black italic uppercase text-yellow-500 tracking-widest">New Petty Entry</h3>
              <button onClick={() => setShowPettyModal(false)} className="p-1.5 rounded-full bg-gray-100 text-gray-500 hover:text-gray-800">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "OUT", label: "Expense (OUT)", color: "bg-rose-500/20 border-rose-500/40 text-rose-600" },
                { key: "IN",  label: "Cash IN",       color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-700" },
              ].map(({ key, label, color }) => (
                <button key={key} onClick={() => setPettyDirection(key)}
                  className={`py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all
                    ${pettyDirection === key ? color : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest mb-2 text-gray-500">Category</p>
              <select value={pettyCategory} onChange={e => setPettyCategory(e.target.value)}
                className="w-full rounded-2xl p-3 text-xs font-bold outline-none border bg-white border-gray-200 text-gray-800">
                {PETTY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest mb-2 text-gray-500">Description</p>
              <input value={pettyDescription} onChange={e => setPettyDescription(e.target.value)}
                placeholder="e.g. Bought charcoal for grill"
                className="w-full rounded-xl p-4 text-xs outline-none border bg-white border-gray-200 text-gray-800 focus:border-yellow-500/50" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest mb-2 text-gray-500">Amount (UGX)</p>
              <input type="number" value={pettyAmount} onChange={e => setPettyAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl p-4 font-black text-lg text-center outline-none border bg-white border-gray-200 text-gray-800 focus:border-yellow-500/50" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPettyModal(false)} className="flex-1 py-4 text-gray-500 font-black text-[10px] uppercase">Discard</button>
              <button onClick={handlePettyAdd}
                disabled={savingPetty || !pettyAmount || !pettyDescription.trim() || dayClosed}
                className={`flex-[2] py-4 rounded-2xl font-black text-xs uppercase transition-all
                  ${!savingPetty && pettyAmount && pettyDescription.trim() && !dayClosed
                    ? "bg-yellow-500 text-black hover:bg-yellow-400 active:scale-[0.98]"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}>
                {savingPetty ? "Saving…" : dayClosed ? "Day Closed" : "Post Entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SHIFT DETAIL MODAL ── */}
      {selectedShift && (
        <ShiftDetailModal shift={selectedShift} dark={false} onClose={() => setSelectedShift(null)} />
      )}
    </div>
  );
}

// ─── Shift Detail Modal (light version) ──────────────────────────────────────
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
      <div className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden shadow-2xl border bg-white border-gray-200">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-center justify-between px-6 pt-4 pb-4 sm:pt-6 border-b border-gray-100">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] uppercase mb-1 text-gray-400">
              {role} · {shiftDate}
            </p>
            <h2 className="text-lg font-black uppercase italic text-yellow-500 tracking-tight leading-none">{staffName}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-600">
              Shift ended {clockOut}
            </span>
            <button onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-800">
              <span style={{ fontSize: 18, lineHeight: 1 }}>×</span>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[70vh] sm:max-h-none px-5 pb-6 pt-4 space-y-3">
          <div className="border rounded-2xl p-4 space-y-3 bg-gray-50 border-gray-100">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Cash</p>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-gray-500">Cash Collected</span>
              <span className="text-sm font-black italic text-gray-800">UGX {cash.toLocaleString()}</span>
            </div>
            {petty > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500">Petty Outflow</span>
                <span className="text-sm font-black italic text-rose-500">− UGX {petty.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="border rounded-2xl p-4 bg-gray-50 border-gray-100">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-3 text-gray-400">Digital Settlements</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "MTN Momo", value: mtn,    color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
                { label: "Airtel",   value: airtel,  color: "text-red-600",   bg: "bg-red-50 border-red-200"    },
                { label: "POS Card", value: card,    color: "text-blue-600",  bg: "bg-blue-50 border-blue-200"   },
                { label: "Credits",  value: credit,  color: "text-purple-600",bg: "bg-purple-50 border-purple-200" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`${bg} border rounded-xl p-3`}>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-gray-500">{label}</p>
                  <p className={`text-sm font-black italic ${value > 0 ? color : "text-gray-400"}`}>
                    UGX {value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {shift.total_orders > 0 && (
            <div className="border rounded-2xl px-4 py-3 flex items-center justify-between bg-gray-50 border-gray-100">
              <span className="text-xs font-bold text-gray-500">Orders Handled</span>
              <span className="text-sm font-black italic text-gray-800">{shift.total_orders}</span>
            </div>
          )}

          <div className="rounded-2xl p-4 flex items-center justify-between border bg-yellow-50 border-yellow-200">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1 text-yellow-700">
                Total Shift Revenue
              </p>
              <p className="text-2xl font-black italic text-yellow-600 tracking-tight">UGX {gross.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border bg-yellow-100 border-yellow-300">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          <button onClick={onClose}
            className="w-full py-4 rounded-xl font-black uppercase italic text-sm tracking-widest transition-all active:scale-[0.98] bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-800">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}