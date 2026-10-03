import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp, Banknote, Smartphone, CreditCard, BookOpen,
  CheckCircle2, Clock, User, Phone, ChevronDown, ChevronUp,
  Hourglass, XCircle,
  Target, Calendar,
} from "lucide-react";
import { useData } from "../../../customer/components/context/DataContext";
import { ShiftMiniCard, fmtK } from "./shared/UIHelpers";
import LiveLogs from "./liveLogs";
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

// ─── Stat Card (white background) ────────────────────────────────────────────
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
        <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1 truncate">{label}</p>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-2xl font-black ${color} break-words`} title={typeof value === "number" ? fmtUGX(value) : undefined}>
            {displayValue}
          </span>
        </div>
        {sub && <p className="text-[11px] text-zinc-700 mt-1 leading-tight">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Component – now uses DataContext ──────────────────────────────────
export default function OverviewSection({ onViewRegistry }) {
  // Use context for today's summary and day closure
  const { todaySummary, dayClosed, dayClosureInfo } = useData();
  const [shifts, setShifts] = useState([]);
  const [shiftsLoading, setShiftsLoad] = useState(true);
  const [allCredits, setAllCredits] = useState([]);
  const [creditsLedger, setCreditsLedger] = useState([]);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [creditsExpanded, setCreditsExpanded] = useState(false);
  const [creditFilter, setCreditFilter] = useState("all");
  const [selectedShift, setSelectedShift] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const sseRef = useRef(null);
  const today = getKampalaDate();

  // For credit stats – keep using direct API for credits (they are not affected by day closure)
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

  // Fetch credits (still direct, because credits persist across day closure)
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

  const fetchShifts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/overview/shifts?date=${today}`);
      if (res.ok) setShifts(await res.json());
    } catch (e) { console.error("Shifts fetch failed:", e); }
    finally { setShiftsLoad(false); }
  }, [today]);

  // Initial and periodic fetch of credits and shifts
  useEffect(() => {
    fetchCredits();
    fetchShifts();
    const intervals = [
      setInterval(fetchCredits, 30000),
      setInterval(fetchShifts, 60000),
    ];
    return () => intervals.forEach(clearInterval);
  }, [fetchCredits, fetchShifts]);

  // Refresh shifts when the accountant closes the day.
  useEffect(() => {
    if (dayClosed) fetchShifts();
  }, [dayClosed, fetchShifts]);

  // SSE for day closure (already handled by context, but we can still keep the feed)
  useEffect(() => {
    try {
      const es = new EventSource(`${API_URL}/api/overview/stream`);
      sseRef.current = es;
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "DAY_CLOSED") {
            fetchShifts();
            fetchCredits(); // credits remain unchanged but we reload anyway
          }
          if (["ORDER_CONFIRMED","PAYMENT_CONFIRMED","SUMMARY_UPDATE","CASHIER_CONFIRMED","CREDIT_SETTLED"].includes(data.type)) {
            fetchShifts();
          }
          if (["CREDIT_CREATED","CREDIT_APPROVED","CREDIT_SETTLED","CREDIT_REJECTED"].includes(data.type)) {
            fetchCredits();
          }
        } catch {}
      };
      es.onerror = () => es.close();
    } catch {}
    return () => sseRef.current?.close();
  }, [fetchCredits, fetchShifts]);

  // Credit stats (computed from creditsLedger)
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

  // All data now comes from context for sales and direct fetches for credits/shifts.
  const rawCash    = Number(todaySummary?.total_cash    ?? 0);
  const rawCard    = Number(todaySummary?.total_card    ?? 0);
  const rawMTN     = Number(todaySummary?.total_mtn     ?? 0);
  const rawAirtel  = Number(todaySummary?.total_airtel  ?? 0);
  const rawGross   = Number(todaySummary?.total_gross   ?? 0);
  const pendingCredits = Number(todaySummary?.pending_credit_requests_amount ?? 0);
  const settleTotal  = Number(todaySummary?.credit_settlements_today ?? 0);
  const settleCash   = Number(todaySummary?.credit_settlements_breakdown?.cash ?? 0);
  const settleCard   = Number(todaySummary?.credit_settlements_breakdown?.card ?? 0);
  const settleMTN    = Number(todaySummary?.credit_settlements_breakdown?.mtn ?? 0);
  const settleAirtel = Number(todaySummary?.credit_settlements_breakdown?.airtel ?? 0);

  const displayCash    = rawCash;
  const displayCard    = rawCard;
  const displayMTN     = rawMTN;
  const displayAirtel  = rawAirtel;
  const displayGross   = rawGross;
  const totalMobileMoney = displayMTN + displayAirtel;

  const orderCount = Number(todaySummary?.order_count ?? 0);

  // Loading indicator for summary
  const summaryLoading = false; // We assume context already loaded; if needed, use isLoading from context
  // We'll add isLoading from context later if desired.

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
                Credit settlements are tracked separately and do not change Gross Sales.
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
              Day Closed - Daily sales have been reset. Credits persist for the month.
            </p>
          </div>
          {dayClosureInfo && (
            <p className="text-[8px] text-emerald-500/70 mt-1">
              Closed by {dayClosureInfo.closed_by} at {dayClosureInfo.closed_at ? new Date(dayClosureInfo.closed_at).toLocaleTimeString() : new Date().toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {/* ── LIVE ACTIVITY FEED ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6" style={{ minHeight: 480 }}>
        <LiveLogs dark={false} t={{}} />
      </div>

      {/* ── SHIFT DETAIL MODAL (unchanged) ── */}
      {selectedShift && (
        <ShiftDetailModal shift={selectedShift} dark={false} onClose={() => setSelectedShift(null)} />
      )}
    </div>
  );
}

// ─── Shift Detail Modal (unchanged) ──────────────────────────────────────────
function ShiftDetailModal({ shift, dark, onClose }) {
  const gross     = Number(shift.gross_total        || 0);
  const cash      = Number(shift.total_cash         || 0);
  const mtn       = Number(shift.total_mtn          || 0);
  const airtel    = Number(shift.total_airtel       || 0);
  const card      = Number(shift.total_card         || 0);
  const credit    = Number(shift.credit_approved_amt|| 0);
  const staffName = (shift.staff_name || "Staff").toUpperCase();
  const role      = (shift.role       || "STAFF").toUpperCase();
  const clockOut  = shift.clock_out
    ? new Date(shift.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--:--";
  const shiftDate = shift.shift_date || shift.clock_out?.split("T")[0] || "—";

  return (
    <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden shadow-2xl border bg-white border-gray-200">
        <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
        <div className="flex items-center justify-between px-6 pt-4 pb-4 sm:pt-6 border-b border-gray-100">
          <div><p className="text-[10px] font-black tracking-[0.2em] uppercase mb-1 text-gray-400">{role} · {shiftDate}</p><h2 className="text-lg font-black uppercase italic text-yellow-500 tracking-tight leading-none">{staffName}</h2></div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-600">Shift ended {clockOut}</span>
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center transition-all bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-800"><span style={{ fontSize: 18, lineHeight: 1 }}>×</span></button>
          </div>
        </div>
        <div className="overflow-y-auto max-h-[70vh] sm:max-h-none px-5 pb-6 pt-4 space-y-3">
          <div className="border rounded-2xl p-4 space-y-3 bg-gray-50 border-gray-100">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Cash</p>
            <div className="flex justify-between items-center"><span className="text-xs font-bold text-gray-500">Cash Collected</span><span className="text-sm font-black italic text-gray-800">UGX {cash.toLocaleString()}</span></div>
          </div>
          <div className="border rounded-2xl p-4 bg-gray-50 border-gray-100">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-3 text-gray-400">Digital Settlements</p>
            <div className="grid grid-cols-2 gap-2">
              {[{ label: "MTN Momo", value: mtn, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
                { label: "Airtel",   value: airtel, color: "text-red-600", bg: "bg-red-50 border-red-200" },
                { label: "POS Card", value: card, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
                { label: "Credits",  value: credit, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" }].map(({ label, value, color, bg }) => (
                <div key={label} className={`${bg} border rounded-xl p-3`}>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-gray-500">{label}</p>
                  <p className={`text-sm font-black italic ${value > 0 ? color : "text-gray-400"}`}>UGX {value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
          {shift.total_orders > 0 && (
            <div className="border rounded-2xl px-4 py-3 flex items-center justify-between bg-gray-50 border-gray-100">
              <span className="text-xs font-bold text-gray-500">Orders Handled</span><span className="text-sm font-black italic text-gray-800">{shift.total_orders}</span>
            </div>
          )}
          <div className="rounded-2xl p-4 flex items-center justify-between border bg-yellow-50 border-yellow-200">
            <div><p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1 text-yellow-700">Total Shift Revenue</p><p className="text-2xl font-black italic text-yellow-600 tracking-tight">UGX {gross.toLocaleString()}</p></div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border bg-yellow-100 border-yellow-300">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
          </div>
          <button onClick={onClose} className="w-full py-4 rounded-xl font-black uppercase italic text-sm tracking-widest transition-all active:scale-[0.98] bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-800">Close</button>
        </div>
      </div>
    </div>
  );
}