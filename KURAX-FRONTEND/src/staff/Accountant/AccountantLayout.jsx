import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Menu, RefreshCw, AlertTriangle, RotateCcw, Sparkles } from "lucide-react";
import { useData } from "../../customer/components/context/DataContext";
import SideBar from "./SideBar";
import Footer from "../../customer/components/common/Foooter";
import API_URL from "../../config/api";

// Import all section components
import PhysicalCount from "./sections/PhysicalCount";
import EndOfShift from "./sections/EndOfShift";
import LiveAudit from "./sections/LiveAudit";
import Credits from "./sections/Credits";
import MonthlyCosts from "./MonthlyCosts";
import AccountingCenter from "./AccountingCenter";
import ReconciliationOverview from "./sections/ReconciliationOverview";
import DepartmentHod from "../DepartmentHod";
import StaffSalesPerformance from "../components/StaffSalesPerformance";
import SystemConfiguration from "./SystemConfiguration";
import HistoricalBusinessOverview from "./HistoricalBusinessOverview";
import InventoryManagement from "./InventoryManagement";

// Import modal components
import ReopenDayModal from "./modals/ReopenDayModal";
import StartNewDayModal from "./modals/StartNewDayModal";

import { kampalaDate, fmt, toLocalDateStr, formatCurrencyCompact, getCreditStatus, forceHardRefresh } from "./utils/helpers";

function getBusinessSettingsKey() {
  try {
    const user = JSON.parse(localStorage.getItem("kurax_user") || "{}");
    return `kurax_accounting_business_context_${user.id || user.name || "accountant"}`;
  } catch {
    return "kurax_accounting_business_context_accountant";
  }
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function AccountantLayout() {
  const location = useLocation();
  const isInventoryRoute = location.pathname.startsWith("/accountant/inventory");
  const { todaySummary, orders = [], refreshData } = useData() || {};
  const businessSettingsKey = getBusinessSettingsKey();

  const [activeSection, setActiveSection] = useState(() => location.state?.activeSection || "DASHBOARD");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [error, setError] = useState(null);
  const [dayClosed, setDayClosed] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [clockNow, setClockNow] = useState(() => new Date());
  const [businessSettings, setBusinessSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(businessSettingsKey) || "{}");
      const today = kampalaDate();
      return {
        mode: saved.mode || "LIVE",
        businessDate: saved.businessDate || today,
        businessTime: saved.businessTime || "",
        dateRange: saved.dateRange || { start: `${today.slice(0, 7)}-01`, end: today },
        timeRange: saved.timeRange || { start: "", end: "" },
      };
    } catch {
      const today = kampalaDate();
      return { mode: "LIVE", businessDate: today, businessTime: "", dateRange: { start: `${today.slice(0, 7)}-01`, end: today }, timeRange: { start: "", end: "" } };
    }
  });

  // ── Get logged in user ─────────────────────────────────────────────────────
  const loggedInUser = useMemo(() => {
    try {
      const saved = localStorage.getItem("kurax_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  const userName = loggedInUser?.name || "Accountant";
  const firstName = userName.split(" ")[0];
  const userRole = loggedInUser?.role || "Accountant";
  const liveDate = kampalaDate(clockNow);
  const liveTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kampala", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(clockNow);
  const businessDate = businessSettings.mode === "LIVE" ? liveDate : businessSettings.businessDate;

  useEffect(() => {
    const timer = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(businessSettingsKey, JSON.stringify(businessSettings));
  }, [businessSettingsKey, businessSettings]);

  const setHistoricalBusinessDate = (date) => {
    if (!date) return;
    setBusinessSettings((current) => ({ ...current, mode: date < liveDate ? "HISTORICAL" : "LIVE", businessDate: date, dateRange: { start: date, end: date } }));
  };

  const setReportingRange = (dateRange) => {
    setBusinessSettings((current) => ({ ...current, dateRange, businessDate: dateRange.end || current.businessDate, mode: dateRange.end && dateRange.end < liveDate ? "HISTORICAL" : "LIVE" }));
  };

  const returnToLive = () => {
    setBusinessSettings((current) => ({ ...current, mode: "LIVE", businessDate: liveDate, businessTime: "", dateRange: { start: `${liveDate.slice(0, 7)}-01`, end: liveDate }, timeRange: { start: "", end: "" } }));
  };

  // ── Reopen Day State ────────────────────────────────────────────────────────
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [closedDaysList, setClosedDaysList] = useState([]);
  const [reopeningDay, setReopeningDay] = useState(false);
  const [loadingClosedDays, setLoadingClosedDays] = useState(false);

  // ── Start New Day State ─────────────────────────────────────────────────────
  const [showStartNewDayModal, setShowStartNewDayModal] = useState(false);
  const [startingNewDay, setStartingNewDay] = useState(false);

  // ── Live summary ──────────────────────────────────────────────────────────
  const [liveSummary, setLiveSummary] = useState(null);

  // ── Physical count ────────────────────────────────────────────────────────
  const [physCash, setPhysCash] = useState(0);
  const [physMomoMTN, setPhysMomoMTN] = useState(0);
  const [physMomoAirtel, setPhysMomoAirtel] = useState(0);
  const [physCard, setPhysCard] = useState(0);
  const [physNotes, setPhysNotes] = useState("");
  const [physSaving, setPhysSaving] = useState(false);
  const [physSaved, setPhysSaved] = useState(false);
  const [physLoading, setPhysLoading] = useState(false);
  const [hasPhysicalCount, setHasPhysicalCount] = useState(false);

  // ── Credit summary state (for PhysicalCount) ───────────────────────────────
  const [creditSettledToday, setCreditSettledToday] = useState(0);
  const [creditOutstandingToday, setCreditOutstandingToday] = useState(0);

  // ── Today's petty cash ─────────────────────────────────────────────────────
  const [pettyCashToday, setPettyCashToday] = useState({ total_out: 0 });

  // ── Credits ───────────────────────────────────────────────────────────────
  const [creditsLedger, setCreditsLedger] = useState([]);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditFilter, setCreditFilter] = useState("all");

  // ── Void requests ─────────────────────────────────────────────────────────
  const [voidRequests, setVoidRequests] = useState([]);
  const [voidRequestsLoading, setVoidRequestsLoading] = useState(false);
  const [voidHistory, setVoidHistory] = useState([]);
  const [voidHistoryLoading, setVoidHistoryLoading] = useState(false);

  // ── Station sales ─────────────────────────────────────────────────────────

  // ── Monthly profit / expenses ─────────────────────────────────────────────
  const [profitData, setProfitData] = useState(null);
  const [profitLoad, setProfitLoad] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));

  // ── Day closure state ─────────────────────────────────────────────────────
  const [isFinalizing, setIsFinalizing] = useState(false);

  // ── FETCH LIVE SUMMARY ──────────────────────────────────────────────────────
  const fetchLiveSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/accountant/today?date=${encodeURIComponent(businessDate)}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setLiveSummary(data);
      }
    } catch (e) { console.error("live summary error:", e); }
  }, [businessDate]);

  useEffect(() => {
    fetchLiveSummary();
    const id = setInterval(fetchLiveSummary, 15000);
    return () => clearInterval(id);
  }, [fetchLiveSummary]);

  const fetchPettyCashToday = useCallback(async () => {
    if (dayClosed && businessSettings.mode !== "HISTORICAL") {
      setPettyCashToday({ total_out: 0 });
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/accountant/petty-cash?date=${encodeURIComponent(businessDate)}`);
      if (res.ok) setPettyCashToday(await res.json());
    } catch (e) { console.error("petty cash today:", e); }
  }, [businessDate, businessSettings.mode, dayClosed]);

  useEffect(() => {
    fetchPettyCashToday();
    const id = setInterval(fetchPettyCashToday, 30000);
    return () => clearInterval(id);
  }, [fetchPettyCashToday]);

  const fetchClosedDays = useCallback(async () => {
    setLoadingClosedDays(true);
    try {
      const res = await fetch(`${API_URL}/api/day-closure/closed-days?limit=30`);
      if (res.ok) {
        const data = await res.json();
        setClosedDaysList(data.closed_days || []);
      }
    } catch (e) {
      console.error("Fetch closed days error:", e);
    } finally {
      setLoadingClosedDays(false);
    }
  }, []);

  const handleReopenDay = async (date, reason) => {
    if (!date) {
      alert("Please select a date to reopen");
      return;
    }
    
    const confirmed = window.confirm(
      `⚠️ REOPEN DAY - ${date} ⚠️\n\n` +
      `This will:\n` +
      `• Restore all revenue totals for ${date}\n` +
      `• Make all orders from that date visible again\n` +
      `• Reactivate kitchen tickets\n` +
      `• Allow staff to continue working on that day\n\n` +
      `Are you sure you want to reopen ${date}?`
    );
    if (!confirmed) return;
    
    setReopeningDay(true);
    setError(null);
    
    try {
      const actor = (() => {
        try { return JSON.parse(localStorage.getItem("kurax_user") || "{}").name; }
        catch { return "Accountant"; }
      })();
      
      const res = await fetch(`${API_URL}/api/day-closure/reopen-day`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: date,
          reopened_by: actor,
          reason: reason || "Day reopened for continued operations"
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reopen day");
        return;
      }
      
      alert(`✅ Day ${date} has been reopened successfully!\n\nStaff can now resume work.`);
      
      setShowReopenModal(false);
      setDayClosed(false);
      
      await Promise.all([
        fetchLiveSummary(),
        fetchPettyCashToday(),
        loadPhysicalCount(),
        refreshData()
      ]);
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (e) {
      console.error("Reopen day error:", e);
      setError("Network error — could not reopen the day. Please try again.");
    } finally {
      setReopeningDay(false);
    }
  };

  const handleStartNewDay = async (date, notes) => {
    const confirmed = window.confirm(
      `⚠️ START BRAND NEW DAY - ${date} ⚠️\n\n` +
      `This will:\n` +
      `• Initialize a brand new day with ZERO totals\n` +
      `• Clear all current revenue data for ${date}\n` +
      `• Allow staff to start fresh with zero balances\n\n` +
      `${date === new Date().toISOString().split('T')[0] 
        ? "⚠️ WARNING: You are starting today as a new day. This will reset all current data!\n\n" 
        : ""}` +
      `Are you sure you want to start a new day on ${date}?`
    );
    if (!confirmed) return;
    
    setStartingNewDay(true);
    setError(null);
    
    try {
      const actor = (() => {
        try { return JSON.parse(localStorage.getItem("kurax_user") || "{}").name; }
        catch { return "Accountant"; }
      })();
      
      const res = await fetch(`${API_URL}/api/day-closure/start-new-day`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: date,
          started_by: actor,
          notes: notes
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start new day");
        return;
      }
      
      alert(`✅ Brand new day ${date} has been started!\n\nAll totals are set to zero. Staff can now begin working.`);
      
      setShowStartNewDayModal(false);
      setDayClosed(false);
      
      await Promise.all([
        fetchLiveSummary(),
        fetchPettyCashToday(),
        loadPhysicalCount(),
        refreshData()
      ]);
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (e) {
      console.error("Start new day error:", e);
      setError("Network error — could not start new day. Please try again.");
    } finally {
      setStartingNewDay(false);
    }
  };

  // Effect to handle when Reopen Day is selected from sidebar
  useEffect(() => {
    if (activeSection === "REOPEN_DAY") {
      fetchClosedDays();
      setShowReopenModal(true);
      setTimeout(() => {
        if (activeSection === "REOPEN_DAY") {
          setActiveSection("DASHBOARD");
        }
      }, 100);
    }
  }, [activeSection, fetchClosedDays]);

  // REMOVED START_NEW_DAY effect because it's no longer in the sidebar

  const checkPhysicalCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/accountant/physical-count`);
      if (res.ok) {
        const data = await res.json();
        const hasData = data.cash > 0 || data.mtn > 0 || data.airtel > 0 || data.card > 0;
        setHasPhysicalCount(hasData);
      }
    } catch (e) {
      console.error("Check physical count error:", e);
    }
  }, []);

  useEffect(() => {
    checkPhysicalCount();
    const id = setInterval(checkPhysicalCount, 10000);
    return () => clearInterval(id);
  }, [checkPhysicalCount]);

  const fetchMonthlyData = useCallback(async () => {
    setProfitLoad(true);
    try {
      const res = await fetch(`${API_URL}/api/summaries/monthly-profit?month=${selectedMonth}`);
      if (res.ok) setProfitData(await res.json());
    } catch (e) { console.error("monthly profit:", e); }
    finally { setProfitLoad(false); }
  }, [selectedMonth]);

  useEffect(() => { fetchMonthlyData(); }, [fetchMonthlyData]);

  useEffect(() => {
    const events = new EventSource(`${API_URL}/api/accountant/stream`);
    events.onmessage = (event) => {
      try {
        if (JSON.parse(event.data).type === "PETTY") {
          fetchPettyCashToday();
          fetchLiveSummary();
          fetchMonthlyData();
        }
      } catch {}
    };
    return () => events.close();
  }, [fetchLiveSummary, fetchMonthlyData, fetchPettyCashToday]);

  const loadVoidHistory = useCallback(async () => {
    setVoidHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/void-requests/history`);
      if (res.ok) setVoidHistory(await res.json());
    } catch (e) { console.error("void history:", e); }
    setVoidHistoryLoading(false);
  }, []);

  const loadVoidRequests = useCallback(async () => {
    setVoidRequestsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/void-requests`);
      if (res.ok) setVoidRequests(await res.json());
    } catch (e) { console.error("void requests:", e); }
    setVoidRequestsLoading(false);
    loadVoidHistory();
  }, [loadVoidHistory]);

  useEffect(() => {
    loadVoidRequests();
    loadVoidHistory();
    const id = setInterval(loadVoidRequests, 15000);
    return () => clearInterval(id);
  }, [loadVoidRequests, loadVoidHistory]);

  const loadPhysicalCount = useCallback(async () => {
    setPhysLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/accountant/physical-count`);
      if (res.ok) {
        const d = await res.json();
        setPhysCash(Number(d.cash) || 0);
        setPhysMomoMTN(Number(d.mtn) || 0);
        setPhysMomoAirtel(Number(d.airtel) || 0);
        setPhysCard(Number(d.card) || 0);
        setPhysNotes(d.notes || "");
        setCreditSettledToday(Number(d.creditSettledToday) || 0);
        setCreditOutstandingToday(Number(d.creditOutstandingToday) || 0);
      }
    } catch (e) { console.error("physical count load:", e); }
    setPhysLoading(false);
  }, []);

  useEffect(() => { loadPhysicalCount(); }, [loadPhysicalCount]);

  // ─── SAVE PHYSICAL COUNT + CREDIT SUMMARY ─────────────────────────────────
  const savePhysicalCount = async () => {
    if (businessSettings.mode === "HISTORICAL") return;
    setPhysSaving(true);
    try {
      const u = JSON.parse(localStorage.getItem("kurax_user") || "{}");
      const res = await fetch(`${API_URL}/api/accountant/physical-count`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cash: physCash,
          mtn: physMomoMTN,
          airtel: physMomoAirtel,
          card: physCard,
          notes: physNotes,
          creditSettledToday: creditSettledToday,
          creditOutstandingToday: creditOutstandingToday,
          submitted_by: u?.name || "Accountant",
        }),
      });
      if (res.ok) {
        setPhysSaved(true);
        setHasPhysicalCount(true);
        setTimeout(() => setPhysSaved(false), 3000);
      } else {
        console.error("Save failed:", await res.text());
      }
    } catch (e) { console.error("save physical count:", e); }
    setPhysSaving(false);
  };

  // ── Credits - Load only current month's credits ───────────────────────────
  useEffect(() => {
    const load = async () => {
      setCreditsLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/credits`);
        if (res.ok) {
          const rows = await res.json();
          const now = new Date();
          const currentMonthNum = now.getMonth();
          const currentYearNum = now.getFullYear();
          
          const currentMonthCredits = rows.filter(credit => {
            const creditDate = new Date(credit.created_at);
            return creditDate.getMonth() === currentMonthNum && creditDate.getFullYear() === currentYearNum;
          });
          setCreditsLedger(currentMonthCredits);
        } else {
          console.error("Failed to fetch credits:", res.status);
        }
      } catch (e) {
        console.error("Credits fetch error:", e);
      }
      setCreditsLoading(false);
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────
  const src = liveSummary || todaySummary || {};
  const sys = {
    cash: Number(src.total_cash) || 0,
    card: Number(src.total_card) || 0,
    mtn: Number(src.total_mtn) || 0,
    airtel: Number(src.total_airtel) || 0,
    gross: Number(src.total_gross) || 0,
    orders: Number(src.order_count) || 0,
    pending_credits: Number(src.total_credit) || 0,
    credit_settlements: Number(src.total_settled_credits) || 0,
  };

  const totalMobileMoney = sys.mtn + sys.airtel;
  const pettyExpenses = Number(pettyCashToday.total_out) || 0;
  const counterSys = { ...sys, cash: Number(src.cash_on_counter ?? (sys.cash - pettyExpenses)) };

  const varCash = physCash - counterSys.cash;
  const varMTN = physMomoMTN - sys.mtn;
  const varAirtel = physMomoAirtel - sys.airtel;
  const varCard = physCard - sys.card;
  const varTotal = varCash + varMTN + varAirtel + varCard;

  // ── Credit totals ─────────────────────────────────────────────────────────
  const settled = creditsLedger.filter(c => getCreditStatus(c) === "settled");
  
  const totalSettledToday = settled
    .filter(c => {
      const settledDate = toLocalDateStr(new Date(c.paid_at || c.created_at));
      return settledDate === kampalaDate();
    })
    .reduce((s, c) => s + Number(c.amount_paid || c.amount || 0), 0);

  const approvedAndPending = creditsLedger.filter(c => {
    const status = getCreditStatus(c);
    return status === "approved" || status === "pendingCashier" || status === "pendingManager";
  });

  const partiallySettled = creditsLedger.filter(c => c.status === "PartiallySettled");

  const totalOutstanding = approvedAndPending.reduce((s, c) => s + Number(c.amount || 0), 0)
    + partiallySettled.reduce((s, c) => s + (Number(c.amount || 0) - Number(c.amount_paid || 0)), 0);

  const totalSettled = settled.reduce((s, c) => s + Number(c.amount_paid || c.amount || 0), 0);
  const totalRejected = creditsLedger.filter(c => getCreditStatus(c) === "rejected").reduce((s, c) => s + Number(c.amount || 0), 0);

  const filteredCredits = creditFilter === "outstanding" ? approvedAndPending.concat(partiallySettled)
    : creditFilter === "settled" ? settled
    : creditFilter === "rejected" ? creditsLedger.filter(c => getCreditStatus(c) === "rejected")
    : creditsLedger;

  const loggedInUserObj = JSON.parse(localStorage.getItem("kurax_user") || "{}");

  const approveVoid = async (id) => {
    try {
      await fetch(`${API_URL}/api/orders/void-requests/${id}/approve`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_by: loggedInUserObj?.name || "Accountant" }),
      });
      loadVoidRequests();
    } catch (e) { console.error("void approve:", e); }
  };

  const rejectVoid = async (id) => {
    try {
      await fetch(`${API_URL}/api/orders/void-requests/${id}/reject`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejected_by: loggedInUserObj?.name || "Accountant" }),
      });
      loadVoidRequests();
    } catch (e) { console.error("void reject:", e); }
  };

  const handleDayClosure = async () => {
    if (businessSettings.mode === "HISTORICAL") {
      setError("Return to live mode before closing the current business day.");
      return;
    }
    if (!hasPhysicalCount) {
      alert("⚠️ Please enter the physical count first before closing the day!\n\nGo to PHYSICAL COUNT section and enter all cash, mobile money, and card totals.");
      setActiveSection("PHYSICAL_COUNT");
      return;
    }

    const confirmed = window.confirm(
      "⚠️ CLOSE DAY - THIS ACTION CANNOT BE UNDONE! ⚠️\n\n" +
      "This will:\n" +
      "• Archive all today's orders\n" +
      "• Clear kitchen, barista & bar ticket boards\n" +
      "• Reset all revenue totals to zero\n" +
      "• Reset all physical count entries to zero\n" +
      "• Reset variance analysis to zero\n" +
      "• Expire any pending void requests\n" +
      "• Save a permanent audit record of today's close\n\n" +
      "Credit ledger will persist for the entire month.\n\n" +
      "The page will automatically refresh to show zero totals.\n\n" +
      "Are you absolutely sure you want to close the day?"
    );
    if (!confirmed) return;

    setIsFinalizing(true);
    setError(null);
    
    try {
      const actor = (() => {
        try { return JSON.parse(localStorage.getItem("kurax_user") || "{}").name; }
        catch { return "Accountant"; }
      })();

      const res = await fetch(`${API_URL}/api/day-closure/close-day`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closed_by: actor,
          final_cash: physCash,
          final_card: physCard,
          final_mtn: physMomoMTN,
          final_airtel: physMomoAirtel,
          final_gross: sys.gross,
          notes: `Day closed by ${actor}. Physical count: Cash=${physCash}, Card=${physCard}, MTN=${physMomoMTN}, Airtel=${physMomoAirtel}`
        }),
      });

      const data = await res.json();
      if (!res.ok) { 
        setError(data.error || "Server error — please try again."); 
        setIsFinalizing(false);
        return; 
      }

      alert(`✅ Day closed successfully!\n\nOrders Archived: ${data.cleared_orders}\nTickets Cleared: ${data.cleared_tickets}\n\nThe page will now refresh to show zero totals.`);
      
      setDayClosed(true);
      
      setLiveSummary({ total_cash: 0, total_card: 0, total_mtn: 0, total_airtel: 0, total_gross: 0, order_count: 0, pending_credit_requests_amount: 0, credit_settlements_today: 0 });
      setVoidRequests([]);
      setVoidHistory([]);
      setProfitData(null);
      
      setPhysCash(0);
      setPhysMomoMTN(0);
      setPhysMomoAirtel(0);
      setPhysCard(0);
      setPhysNotes("");
      setHasPhysicalCount(false);
      setPettyCashToday({ total_out: 0 });
      
      window.dispatchEvent(new CustomEvent('dayClosed', { detail: data }));
      window.dispatchEvent(new Event('refresh'));
      
      setTimeout(() => {
        forceHardRefresh();
      }, 1500);
      
    } catch (e) {
      console.error("Day closure error:", e);
      setError("Network error — could not reach the server. Please try again.");
      setIsFinalizing(false);
    }
  };

  // Light theme classes
  const bgClass = 'bg-gray-50';
  const textClass = 'text-gray-900';
  const cardBgClass = 'bg-white border-gray-200 shadow-sm';
  const headerBgClass = 'bg-white/80 border-gray-200 backdrop-blur-md';

  // Calculate credit count for badge
  const creditCount = creditsLedger.filter(c => 
    c.status === "PendingCashier" || 
    c.status === "PendingManagerApproval" || 
    c.status === "Approved"
  ).length;

  useEffect(() => {
    const handleDayClosed = () => {
      console.log("Day closed event received - resetting accountant dashboard");
      setDayClosed(true);
      setLiveSummary({ total_cash: 0, total_card: 0, total_mtn: 0, total_airtel: 0, total_gross: 0, order_count: 0, pending_credit_requests_amount: 0, credit_settlements_today: 0 });
      setVoidRequests([]);
      setVoidHistory([]);
      setPhysCash(0);
      setPhysMomoMTN(0);
      setPhysMomoAirtel(0);
      setPhysCard(0);
      setHasPhysicalCount(false);
      setPettyCashToday({ total_out: 0 });
      if (typeof refreshData === "function") refreshData();
      fetchLiveSummary();
      loadPhysicalCount();
      fetchPettyCashToday();
    };

    window.addEventListener('dayClosed', handleDayClosed);
    window.addEventListener('refresh', () => {
      if (typeof refreshData === "function") refreshData();
      fetchLiveSummary();
    });
    
    return () => {
      window.removeEventListener('dayClosed', handleDayClosed);
      window.removeEventListener('refresh', () => refreshData());
    };
  }, [refreshData, fetchLiveSummary, loadPhysicalCount, fetchPettyCashToday]);

  useEffect(() => {
    const checkIfDayClosed = async () => {
      try {
        const res = await fetch(`${API_URL}/api/day-closure/day-status`);
        if (res.ok) {
          const data = await res.json();
          if (data.is_closed) {
            console.log("Day is already closed, resetting display");
            setDayClosed(true);
            setLiveSummary({ total_cash: 0, total_card: 0, total_mtn: 0, total_airtel: 0, total_gross: 0, order_count: 0, pending_credit_requests_amount: 0, credit_settlements_today: 0 });
            setPhysCash(0);
            setPhysMomoMTN(0);
            setPhysMomoAirtel(0);
            setPhysCard(0);
            setHasPhysicalCount(false);
            setPettyCashToday({ total_out: 0 });
          }
        }
      } catch (e) {
        console.error("Check day status error:", e);
      }
    };
    
    checkIfDayClosed();
  }, []);

  return (
    <div className={`flex flex-row min-h-screen ${bgClass} font-[Outfit] transition-colors duration-300`}>
      {/* Sidebar - Sticky/fixed so it doesn't scroll */}
      <div className="sticky top-0 h-screen flex-shrink-0">
        <SideBar
          activeSection={isInventoryRoute ? "INVENTORY" : activeSection}
          setActiveSection={setActiveSection}
          isOpen={mobileMenuOpen}
          setIsOpen={setMobileMenuOpen}
          isDark={false}
          voidCount={voidRequests.length}
          creditCount={creditCount}
          historicalMode={businessSettings.mode === "HISTORICAL"}
        />
      </div>

      {/* Main content area - This scrolls */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen">
        <main className="p-4 md:p-10 space-y-8 flex-1 overflow-y-auto">
          {businessSettings.mode === "HISTORICAL" && (
            <div role="alert" className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-l-4 border-amber-600 bg-amber-100 px-4 py-3 text-sm font-black text-amber-950 shadow-sm">
              <AlertTriangle size={17} /> HISTORICAL BUSINESS DATE: {businessDate}
            </div>
          )}
          
          {/* Welcome Header Section */}
          <div className="mb-8 flex justify-between items-end">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1 h-6 bg-yellow-500 rounded-full" />
                <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-600">
                  Accountant Overview
                </h4>
              </div>
              <h2 className="text-base font-bold text-gray-900 tracking-tight">
                Welcome back,{" "}
                <span className="text-yellow-600 capitalize">
                  {firstName}
                </span>
              </h2>
              
            </div>
            
            {/* Quick actions if needed */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="text-right">
                <p className="text-[8px] font-black uppercase text-gray-400 tracking-wider">{kampalaDate()}</p>
              </div>
            </div>
          </div>

          {isInventoryRoute ? <InventoryManagement /> : <>
          {dayClosed && businessSettings.mode !== "HISTORICAL" && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center animate-in fade-in duration-500">
              <div className="flex items-center justify-center gap-2">
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                  ✅ Day Closed - All revenue and physical count totals have been reset. Credits persist for the month.
                </span>
              </div>
            </div>
          )}

          {activeSection === "DASHBOARD" && businessSettings.mode === "HISTORICAL" && (
            <HistoricalBusinessOverview
              API_URL={API_URL}
              dateRange={businessSettings.dateRange}
              timeRange={businessSettings.timeRange}
              onOpenReports={() => setActiveSection("REPORTS")}
            />
          )}

          {activeSection === "DASHBOARD" && businessSettings.mode !== "HISTORICAL" && (
            <ReconciliationOverview
              dayClosed={dayClosed}
              sys={counterSys}
              physCash={physCash}
              physMomoMTN={physMomoMTN}
              physMomoAirtel={physMomoAirtel}
              physCard={physCard}
              pettyCashToday={pettyCashToday}
              varCash={varCash}
              varMTN={varMTN}
              varAirtel={varAirtel}
              varCard={varCard}
              varTotal={varTotal}
              hasPhysicalCount={hasPhysicalCount}
              creditsLedger={creditsLedger}
              creditsLoading={creditsLoading}
              voidRequests={voidRequests}
              voidRequestsLoading={voidRequestsLoading}
              profitData={profitData}
              profitLoad={profitLoad}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              userName={userName}
              summaryAvailable={Boolean(liveSummary || todaySummary)}
              refreshDashboard={async () => {
                await Promise.all([
                  refreshData?.(),
                  fetchLiveSummary(),
                  fetchPettyCashToday(),
                  loadPhysicalCount(),
                  loadVoidRequests(),
                ]);
              }}
              setActiveSection={setActiveSection}
              handleDayClosure={handleDayClosure}
              isFinalizing={isFinalizing}
              error={error}
            />
          )}

          {activeSection === "PHYSICAL_COUNT" && businessSettings.mode === "LIVE" && (
            <PhysicalCount
              dayClosed={dayClosed}
              physLoading={physLoading}
              physCash={physCash}
              setPhysCash={setPhysCash}
              physMomoMTN={physMomoMTN}
              setPhysMomoMTN={setPhysMomoMTN}
              physMomoAirtel={physMomoAirtel}
              setPhysMomoAirtel={setPhysMomoAirtel}
              physCard={physCard}
              setPhysCard={setPhysCard}
              physNotes={physNotes}
              setPhysNotes={setPhysNotes}
              sys={counterSys}
              varCash={varCash}
              varMTN={varMTN}
              varAirtel={varAirtel}
              varCard={varCard}
              varTotal={varTotal}
              isDark={false}
              cardBgClass={cardBgClass}
              textClass={textClass}
              savingAll={physSaving}
              savedAll={physSaved}
              saveAllData={savePhysicalCount}
              creditSettledToday={creditSettledToday}
              setCreditSettledToday={setCreditSettledToday}
              creditOutstandingToday={creditOutstandingToday}
              setCreditOutstandingToday={setCreditOutstandingToday}
            />
          )}

          {activeSection === "END_OF_SHIFT" && businessSettings.mode === "LIVE" && (
            <EndOfShift
              dayClosed={dayClosed}
              hasPhysicalCount={hasPhysicalCount}
              sys={sys}
              physCash={physCash}
              physMomoMTN={physMomoMTN}
              physMomoAirtel={physMomoAirtel}
              physCard={physCard}
              varTotal={varTotal}
              isFinalizing={isFinalizing}
              error={error}
              handleDayClosure={handleDayClosure}
              setActiveSection={setActiveSection}
              isDark={false}
              cardBgClass={cardBgClass}
              textClass={textClass}
              creditSettledToday={creditSettledToday}
              creditOutstandingToday={creditOutstandingToday}
            />
          )}

          {activeSection === "LIVE_AUDIT" && (
            <LiveAudit
              voidRequests={voidRequests}
              voidRequestsLoading={voidRequestsLoading}
              voidHistory={voidHistory}
              voidHistoryLoading={voidHistoryLoading}
              approveVoid={approveVoid}
              rejectVoid={rejectVoid}
              loadVoidRequests={loadVoidRequests}
              loadVoidHistory={loadVoidHistory}
              isDark={false}
            />
          )}

          {activeSection === "CREDITS" && (
            <Credits
              creditsLedger={creditsLedger}
              creditsLoading={creditsLoading}
              creditFilter={creditFilter}
              setCreditFilter={setCreditFilter}
              filteredCredits={filteredCredits}
              totalOutstanding={totalOutstanding}
              totalSettled={totalSettled}
              totalRejected={totalRejected}
              isDark={false}
              cardBgClass={cardBgClass}
            />
          )}

          {activeSection === "MONTHLY_COSTS" && (
            <MonthlyCosts
              month={selectedMonth}
              monthLabel={new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}
              fixedItems={profitData?.costs?.fixed_items || []}
              profitLoad={profitLoad}
              onRefresh={fetchMonthlyData}
              dark={false}
              API_URL={API_URL}
              historicalMode={businessSettings.mode === "HISTORICAL"}
            />
          )}

          {activeSection === "REPORTS" && (
            <AccountingCenter
              setActiveSection={setActiveSection}
              initialDateRange={businessSettings.dateRange}
              timeRange={businessSettings.timeRange}
              onDateRangeChange={setReportingRange}
            />
          )}

          {activeSection === "STAFF_PERFORMANCE" && (
            <StaffSalesPerformance
              role="ACCOUNTANT"
              initialRange={businessSettings.dateRange}
              timeRange={businessSettings.timeRange}
              historicalMode={businessSettings.mode === "HISTORICAL"}
              onDateRangeChange={setReportingRange}
            />
          )}

          {activeSection === "DEPARTMENT_REPORTS" && <DepartmentHod department="all" embedded initialRange={businessSettings.dateRange} />}

          {activeSection === "SYSTEM_CONFIGURATION" && (
            <SystemConfiguration
              API_URL={API_URL}
              userName={userName}
              liveDate={liveDate}
              liveTime={liveTime}
              mode={businessSettings.mode}
              businessDate={businessDate}
              onBusinessDateChange={setHistoricalBusinessDate}
              businessTime={businessSettings.businessTime}
              onBusinessTimeChange={(businessTime) => setBusinessSettings((current) => ({ ...current, businessTime }))}
              dateRange={businessSettings.dateRange}
              onDateRangeChange={setReportingRange}
              timeRange={businessSettings.timeRange}
              onTimeRangeChange={(timeRange) => setBusinessSettings((current) => ({ ...current, timeRange }))}
              onReturnToLive={returnToLive}
            />
          )}
          </>}
        </main>
        <Footer isDark={false} />
      </div>

      <ReopenDayModal
        isOpen={showReopenModal}
        onClose={() => {
          setShowReopenModal(false);
        }}
        closedDays={closedDaysList}
        loading={loadingClosedDays}
        onReopen={handleReopenDay}
        reopening={reopeningDay}
      />

      <StartNewDayModal
        isOpen={showStartNewDayModal}
        onClose={() => setShowStartNewDayModal(false)}
        onStart={handleStartNewDay}
        starting={startingNewDay}
      />
    </div>
  );
}