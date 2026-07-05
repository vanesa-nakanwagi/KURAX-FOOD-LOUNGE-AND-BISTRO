// ─── CashierDashboard.jsx ─────────────────────────────────────────────────────

import React, { useState, useMemo, useEffect, useCallback } from "react";
import SideBar from "./SideBar";
import {
  Menu, Banknote, Smartphone, CreditCard, X, Wallet,
  Trash2, PlusCircle, ShieldCheck, Printer, ArrowRightLeft,
  BookOpen, User, Phone, Calendar, RefreshCw, Clock,
  CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, Send, CheckCircle2,
  Bike, CircleDollarSign, Award, Target, Activity, Sparkles,
  Zap, ArrowUpRight, Coffee
} from "lucide-react";
import Footer from "../../customer/components/common/Foooter";
import API_URL from "../../config/api";
import PettyCashPanel from "./PettyCashPanel";
import DeliveryModal from "./DeliveryModal";
import DeliveriesPanel from "./DeliveriesPanel";
import CreditLedgerPanel from "./CreditLedgerPanel";
import { useData } from "../../customer/components/context/DataContext";

// ─── HELPERS (unchanged) ─────────────────────────────────────────────────────
function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
function getTodayLocal() { return toLocalDateStr(new Date()); }
function timeAgo(ts) {
  const mins = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}
function methodStyle(method) {
  switch (method) {
    case "Cash":        return { color: "text-emerald-600",  icon: <Banknote size={24} /> };
    case "Card":        return { color: "text-blue-600",     icon: <CreditCard size={24} /> };
    case "Momo-MTN":    return { color: "text-purple-600",   icon: <Smartphone size={24} /> };
    case "Momo-Airtel": return { color: "text-purple-600",   icon: <Smartphone size={24} /> };
    case "Credit":      return { color: "text-purple-600",   icon: <BookOpen size={24} /> };
    default:            return { color: "text-zinc-600",     icon: <Banknote size={24} /> };
  }
}

// ✅ NEW: Full amount formatter (no abbreviation)
function formatFullAmount(n) {
  const num = Number(n || 0);
  return `UGX ${num.toLocaleString()}`;
}

// ─── STAT CARD (full numbers) ────────────────────────────────────────────────
function StatCard({ icon, label, value, color, note, trend }) {
  const formattedValue = formatFullAmount(value);

  const colorBgMap = {
    "text-emerald-600": "bg-emerald-50",
    "text-blue-600":    "bg-blue-50",
    "text-purple-600":  "bg-purple-50",
    "text-rose-600":    "bg-rose-50",
    "text-yellow-600":  "bg-yellow-50",
    "text-orange-600":  "bg-orange-50",
  };
  const iconBg = colorBgMap[color] || "bg-zinc-100";

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 hover:border-yellow-500/30">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${iconBg}`}>{icon}</div>
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Today</span>
        </div>
        <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1 truncate">{label}</p>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-2xl font-black ${color} break-words whitespace-normal`}>
            {formattedValue}
          </span>
        </div>
        {note && <p className="text-[11px] text-zinc-500 mt-1 leading-tight">{note}</p>}
        {trend && (
          <div className={`flex items-center gap-1 mt-1.5 ${trend > 0 ? "text-emerald-500" : "text-red-500"}`}>
            {trend > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span className="text-[9px] font-black">{Math.abs(trend)}%</span>
            <span className="text-[8px] text-zinc-400 ml-1">vs yesterday</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GROSS REVENUE CARD (full numbers) ───────────────────────────────────────
function GrossRevenueCard({ grossSales, creditSettledToday }) {
  const combinedTotal = grossSales + creditSettledToday;
  const hasCredits = creditSettledToday > 0;

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 hover:border-yellow-500/30">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2.5 rounded-xl bg-emerald-50">
            <TrendingUp size={18} className="text-emerald-600" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[7px] font-black uppercase text-emerald-400 tracking-wider">Live</span>
            </span>
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Today</span>
          </div>
        </div>
        <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Gross Revenue</p>
        <span className="text-2xl font-black text-emerald-600 break-words whitespace-normal">
          {formatFullAmount(grossSales)}
        </span>
        {hasCredits ? (
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-zinc-500 font-bold">Credits settled today</p>
              <p className="text-[10px] font-black text-emerald-600">+{formatFullAmount(creditSettledToday)}</p>
            </div>
            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-2 py-1.5">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Combined</p>
              <p className="text-[11px] font-black text-gray-800 break-words">{formatFullAmount(combinedTotal)}</p>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500 mt-1 leading-tight">Cash + Card + Mobile Money</p>
        )}
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function CashierDashboard() {
  const { todaySummary, dayClosed, dayClosureInfo, refreshData } = useData();

  const loggedInUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}"); }
    catch { return {}; }
  }, []);
  const cashierName = loggedInUser?.name || "Cashier";
  const isDark = false;

  const [activeSection,      setActiveSection]      = useState("PENDING");
  const [orderStatusFilter,  setOrderStatusFilter]  = useState("CLOSED");
  const [isSidebarOpen,      setIsSidebarOpen]      = useState(false);
  const [showShiftSummary,   setShowShiftSummary]   = useState(false);
  const [showReceipt,        setShowReceipt]        = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);

  const [processingOrder,    setProcessingOrder]    = useState(null);
  const [momoTransactionId,  setMomoTransactionId]  = useState("");
  const [rejecting,          setRejecting]          = useState(false);
  const [rejectNote,         setRejectNote]         = useState("");
  const [confirming,         setConfirming]         = useState(false);
  const [animatingIds,       setAnimatingIds]       = useState([]);
  const [requestingApproval, setRequestingApproval] = useState(false);

  const [liveQueue,          setLiveQueue]          = useState([]);
  const [credits,            setCredits]            = useState([]);
  const [history,            setHistory]            = useState([]);
  const [qLoading,           setQLoading]           = useState(true);
  
  const [pettyCashOutTotal,  setPettyCashOutTotal]  = useState(0);
  const [pettyCashInTotal,   setPettyCashInTotal]   = useState(0);

  const [deliveryOrder,      setDeliveryOrder]      = useState(null);
  const [deliveryRefreshKey, setDeliveryRefreshKey] = useState(0);
  const [deliveryBadge,      setDeliveryBadge]      = useState(0);

  const [isFinalizing, setIsFinalizing] = useState(false);
  const [today, setToday] = useState(getTodayLocal);

  // ── DAY CLOSURE EFFECT – reset totals when dayClosed becomes true ─────────
  useEffect(() => {
    if (dayClosed) {
      fetchAll();
    }
  }, [dayClosed]);

  useEffect(() => {
    const schedule = () => {
      const now  = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const t    = setTimeout(() => { setToday(getTodayLocal()); schedule(); }, next - now);
      return t;
    };
    const t = schedule();
    return () => clearTimeout(t);
  }, []);

  // ── DERIVED TOTALS FROM CONTEXT (live, resets after day closure) ──────────
  const cashRevenue = Number(todaySummary?.total_cash ?? 0);
  const cardRevenue = Number(todaySummary?.total_card ?? 0);
  const momoMTN = Number(todaySummary?.total_mtn ?? 0);
  const momoAirtel = Number(todaySummary?.total_airtel ?? 0);
  const grossRevenue = cashRevenue + cardRevenue + momoMTN + momoAirtel;
  const creditSettledToday = Number(todaySummary?.credit_settlements_today ?? 0);

  const totalMobileMoney = momoMTN + momoAirtel;
  const cashOnCounter = Math.max(0, cashRevenue - pettyCashInTotal);
  const netCashAfterPetty = cashRevenue - pettyCashOutTotal;

  // Credit action counts (from credits array) – used only inside CREDITS section now
  const creditNeedsForwarding = useMemo(
    () => credits.filter(c => c.status === "PendingCashier").length,
    [credits]
  );
  const creditPendingManager = useMemo(
    () => credits.filter(c => c.status === "PendingManagerApproval").length,
    [credits]
  );
  const creditApprovedNotSettled = useMemo(
    () => credits.filter(c => c.status === "Approved").length,
    [credits]
  );
  const totalCreditsNeedingAction = creditNeedsForwarding + creditPendingManager + creditApprovedNotSettled;

  // ─── FETCH ALL DATA (queue, credits, history, petty) ───────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [qRes, cRes, hRes, pRes] = await Promise.all([
        fetch(`${API_URL}/api/cashier-ops/cashier-queue`),
        fetch(`${API_URL}/api/credits`),
        fetch(`${API_URL}/api/cashier-ops/cashier-history`),
        fetch(`${API_URL}/api/summaries/petty-cash?date=${today}`),
      ]);

      if (qRes.ok) {
        const rows = await qRes.json();
        setLiveQueue(rows.map(o => ({
          id:            o.id,
          table_name:    o.table_name,
          label:         o.label || `Order #${o.id}`,
          requested_by:  o.requested_by || o.waiter_name || "Waiter",
          method:        o.method || "Cash",
          amount:        Number(o.amount) || 0,
          status:        o.status || "Pending",
          created_at:    o.created_at,
          age_minutes:   Math.floor((Date.now() - new Date(o.created_at)) / 60000),
          credit_name:   o.credit_name,
          credit_phone:  o.credit_phone,
          credit_pay_by: o.credit_pay_by,
          is_item:       o.is_item,
        })));
      }
      if (cRes.ok) setCredits(await cRes.json());
      if (hRes.ok) setHistory(await hRes.json());
      if (pRes.ok) {
        const summary = await pRes.json();
        setPettyCashInTotal(Number(summary.total_in) || 0);
        setPettyCashOutTotal(Number(summary.total_out) || 0);
      }
    } catch (e) {
      console.error("Cashier fetch failed:", e);
    } finally {
      setQLoading(false);
    }
  }, [today]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 8000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const handleRefresh = () => {
    refreshData();
    fetchAll();
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/delivery/stats`);
        if (res.ok) {
          const data = await res.json();
          setDeliveryBadge(Number(data.out_for_delivery || 0) + Number(data.pending || 0));
        }
      } catch { /* silent */ }
    };
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [deliveryRefreshKey]);

  const openModal = (order) => {
    if (dayClosed) {
      alert("Day is closed. Cannot process payments.");
      return;
    }
    setProcessingOrder(order);
    setMomoTransactionId("");
    setRejecting(false);
    setRejectNote("");
  };

  const handleFinalConfirm = async () => {
    const order = processingOrder;
    const isMomo = order.method === "Momo-MTN" || order.method === "Momo-Airtel";
    const isSplit = order.split_payments && order.split_payments.length > 0;
    if (!isSplit && isMomo && !momoTransactionId.trim()) return;
    setConfirming(true);
    setAnimatingIds(prev => [...prev, order.id]);
    try {
      const payload = {
        confirmed_by: cashierName,
        transaction_id: momoTransactionId.trim() || null,
      };
      if (isSplit) payload.split_payments = order.split_payments;
      const res = await fetch(`${API_URL}/api/cashier-ops/cashier-queue/${order.id}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Confirm failed");
        setConfirming(false);
        setAnimatingIds(prev => prev.filter(id => id !== order.id));
        return;
      }
      await fetchAll();
      refreshData();
    } catch (e) { console.error("Confirm failed:", e); }
    setTimeout(() => {
      setAnimatingIds(prev => prev.filter(id => id !== order.id));
      setProcessingOrder(null);
      setConfirming(false);
    }, 500);
  };

  const handleForwardCredit = async (order) => {
    if (order.method !== "Credit") {
      alert("❌ This is not a credit request!");
      return;
    }
    if (!order.credit_name || order.credit_name.trim() === "") {
      alert("❌ Client name is required for credit requests!");
      return;
    }
    if (!order.credit_phone || order.credit_phone.trim() === "") {
      alert("❌ Client phone number is required for credit requests!");
      return;
    }
    if (!order.amount || order.amount <= 0) {
      alert("❌ Invalid credit amount.");
      return;
    }
    setRequestingApproval(true);
    try {
      const res = await fetch(`${API_URL}/api/cashier-ops/cashier-queue/${order.id}/request-approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          requested_by: cashierName,
          payment_method: "CREDIT",
          status: "PendingManagerApproval"
        }),
      });
      if (res.ok) {
        await fetchAll();
        refreshData();
        setProcessingOrder(null);
        setRequestingApproval(false);
        alert(`✅ Credit request forwarded to manager!\n\nClient: ${order.credit_name}\nAmount: ${formatFullAmount(order.amount)}`);
        return;
      }
      const error = await res.json();
      alert(error.error || "Failed to forward to manager. Please try again.");
    } catch (e) {
      console.error("Forward failed:", e);
      alert("Network error – please try again");
    }
    setRequestingApproval(false);
  };

  const handleReject = async () => {
    setConfirming(true);
    try {
      await fetch(`${API_URL}/api/cashier-ops/cashier-queue/${processingOrder.id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectNote || "Rejected by cashier" }),
      });
      await fetchAll();
      refreshData();
    } catch (e) { console.error("Reject failed:", e); }
    setConfirming(false);
    setProcessingOrder(null);
    setRejecting(false);
    setRejectNote("");
  };

  const handleFinalizeShift = async () => {
    const confirmEnd = window.confirm("Are you sure you want to finalize this shift?");
    if (!confirmEnd) return;
    setIsFinalizing(true);
    const payload = {
      waiter_id: loggedInUser?.id,
      waiter_name: loggedInUser?.name,
      role: loggedInUser?.role,
      total_cash: cashRevenue,
      total_mtn: momoMTN,
      total_airtel: momoAirtel,
      total_card: cardRevenue,
      gross_total: grossRevenue,
      petty_cash_spent: pettyCashOutTotal,
    };
    try {
      const res = await fetch(`${API_URL}/api/waiter/end-shift`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) { alert("Shift Finalized."); window.location.reload(); }
      else alert("Failed to finalize shift.");
    } catch { alert("A connection error occurred."); }
    setIsFinalizing(false);
  };

  const normalQueue = liveQueue.filter(r => r.status === "Pending");
  const forwardedQueue = liveQueue.filter(r => r.status === "PendingManagerApproval");

  const closedHistory = history.filter(h => {
    if (orderStatusFilter === "CLOSED") return h.status === "Confirmed" || h.status === "PartiallySettled";
    if (orderStatusFilter === "PENDING") {
      if (h.status === "Pending") return Math.floor((Date.now() - new Date(h.created_at)) / 60000) < 40;
      return false;
    }
    if (orderStatusFilter === "DELAYED") {
      return h.status === "Pending" && Math.floor((Date.now() - new Date(h.created_at)) / 60000) >= 40;
    }
    return true;
  });

  const displayList = (orderStatusFilter === "PENDING" || orderStatusFilter === "DELAYED")
    ? [...normalQueue, ...closedHistory]
    : closedHistory;

  const isMomoProcessing = processingOrder?.method === "Momo-MTN" || processingOrder?.method === "Momo-Airtel";
  const isCredit = processingOrder?.method === "Credit";
  const canConfirm = !isMomoProcessing || momoTransactionId.trim().length > 0;

  return (
    <div className="flex h-screen bg-white font-[Outfit] text-zinc-800 overflow-hidden">
      <SideBar
        activeSection={activeSection}
        setActiveSection={(section) => {
          setActiveSection(section);
          if (section === "CLOSED") setOrderStatusFilter("CLOSED");
        }}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onEndShift={() => setShowShiftSummary(true)}
        stats={{
          cash: cashOnCounter,
          momo: totalMobileMoney,
          card: cardRevenue,
        }}
        deliveryBadge={deliveryBadge}
        creditBadge={totalCreditsNeedingAction}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        <header className="flex items-center justify-between px-6 py-4 bg-white/80 border-b border-black/10 sticky top-0 z-50 flex-wrap gap-3 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 bg-zinc-100 rounded-xl text-yellow-500"
            >
              <Menu size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-1 h-6 bg-yellow-500 rounded-full" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-600">Cashier Overview</h4>
              </div>
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-black tracking-tight">
                Welcome back, <span className="text-yellow-600 capitalize whitespace-nowrap">{cashierName}</span>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {normalQueue.length > 0 && !dayClosed && (
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500 rounded-xl animate-pulse">
                <AlertTriangle size={13} className="text-black shrink-0" />
                <span className="text-[10px] font-black text-black uppercase tracking-widest whitespace-nowrap">
                  {normalQueue.length} Pending
                </span>
              </div>
            )}
            {creditNeedsForwarding > 0 && (
              <button
                onClick={() => setActiveSection("CREDITS")}
                className="flex items-center gap-2 px-3 py-2 bg-orange-100 border border-orange-300 rounded-xl hover:bg-orange-200 transition-all animate-pulse"
              >
                <Send size={13} className="text-orange-600 shrink-0" />
                <span className="text-[10px] font-black text-orange-700 uppercase tracking-widest whitespace-nowrap">
                  {creditNeedsForwarding} Need Forwarding
                </span>
              </button>
            )}
            {creditPendingManager > 0 && (
              <button
                onClick={() => setActiveSection("CREDITS")}
                className="flex items-center gap-2 px-3 py-2 bg-purple-100 border border-purple-300 rounded-xl hover:bg-purple-200 transition-all"
              >
                <Clock size={13} className="text-purple-600 shrink-0" />
                <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest whitespace-nowrap">
                  {creditPendingManager} Awaiting Mgr
                </span>
              </button>
            )}
            {creditApprovedNotSettled > 0 && (
              <button
                onClick={() => setActiveSection("CREDITS")}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-100 border border-emerald-300 rounded-xl hover:bg-emerald-200 transition-all"
              >
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest whitespace-nowrap">
                  {creditApprovedNotSettled} Approved - Settle Now
                </span>
              </button>
            )}
            {deliveryBadge > 0 && (
              <button
                onClick={() => setActiveSection("DELIVERIES")}
                className="flex items-center gap-2 px-3 py-2 bg-orange-100 border border-orange-300 rounded-xl hover:bg-orange-200 transition-all"
              >
                <Bike size={13} className="text-orange-600 shrink-0" />
                <span className="text-[10px] font-black text-orange-700 uppercase tracking-widest whitespace-nowrap">
                  {deliveryBadge} Delivery
                </span>
              </button>
            )}
            <button onClick={handleRefresh} className="p-2 bg-zinc-100 rounded-xl text-zinc-600 hover:text-black transition-all shrink-0">
              <RefreshCw size={16} className={qLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10">

          {/* ── DAY CLOSED BANNER ── */}
          {dayClosed && (
            <div className="mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">
                  Day Closed - All revenue totals have been reset. Credits persist for the month.
                </p>
              </div>
              {dayClosureInfo && (
                <p className="text-[8px] text-emerald-500/70 mt-1">
                  Closed by {dayClosureInfo.closed_by} at {dayClosureInfo.closed_at ? new Date(dayClosureInfo.closed_at).toLocaleTimeString() : new Date().toLocaleTimeString()}
                </p>
              )}
            </div>
          )}

          {activeSection === "CLOSED" && (
            <div className="mb-10 flex gap-6 border-b border-black/10 overflow-x-auto pb-1">
              {["PENDING", "DELAYED", "CLOSED"].map(s => (
                <button
                  key={s}
                  onClick={() => setOrderStatusFilter(s)}
                  className={`pb-2 text-[11px] font-black uppercase tracking-widest relative transition-colors whitespace-nowrap
                    ${orderStatusFilter === s ? "text-yellow-600" : "text-zinc-500 hover:text-zinc-700"}`}
                >
                  {s}
                  {orderStatusFilter === s && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500" />}
                </button>
              ))}
            </div>
          )}

          {activeSection === "PENDING" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">

              {/* ── 5 Stat Cards (using context values) ── */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                <StatCard
                  icon={<Banknote size={18} className="text-emerald-600" />}
                  label="Cash on Counter"
                  value={dayClosed ? 0 : cashOnCounter}
                  color="text-emerald-600"
                  note={pettyCashInTotal > 0 ? `-${formatFullAmount(pettyCashInTotal)} to petty` : null}
                />
                <StatCard
                  icon={<CreditCard size={18} className="text-blue-600" />}
                  label="Card Revenue"
                  value={dayClosed ? 0 : cardRevenue}
                  color="text-blue-600"
                />
                <StatCard
                  icon={<Smartphone size={18} className="text-purple-600" />}
                  label="Mobile Money"
                  value={dayClosed ? 0 : totalMobileMoney}
                  color="text-purple-600"
                  note="MTN + Airtel"
                />
                <StatCard
                  icon={<Wallet size={18} className="text-rose-600" />}
                  label="Petty Expenses"
                  value={dayClosed ? 0 : pettyCashOutTotal}
                  color="text-rose-600"
                  note="spent from petty"
                />
                <GrossRevenueCard
                  grossSales={dayClosed ? 0 : grossRevenue}
                  creditSettledToday={dayClosed ? 0 : creditSettledToday}
                />
              </div>

              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-yellow-500 rounded-full" />
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Live Payment Queue</h3>
                  </div>
                  {normalQueue.length > 0 && !dayClosed && (
                    <span className="px-2 py-0.5 bg-yellow-500 text-black text-[9px] rounded-full font-black">
                      {normalQueue.length}
                    </span>
                  )}
                </div>
                {dayClosed ? (
                  <div className="py-16 text-center border-2 border-dashed border-black/10 rounded-[3rem] bg-zinc-50/50">
                    <ShieldCheck size={32} className="mx-auto text-zinc-400 mb-4" />
                    <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest italic">Day Closed – No payments can be processed</p>
                  </div>
                ) : qLoading ? (
                  <div className="space-y-3">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="h-28 rounded-[2.5rem] bg-zinc-100/50 animate-pulse border border-black/5" />
                    ))}
                  </div>
                ) : normalQueue.length === 0 ? (
                  <div className="py-16 text-center border-2 border-dashed border-black/10 rounded-[3rem] bg-zinc-50/50">
                    <ShieldCheck size={32} className="mx-auto text-zinc-400 mb-4" />
                    <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest italic">All Clear</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {normalQueue.map(order => (
                      <LiveOrderCard
                        key={order.id}
                        order={order}
                        isAnimating={animatingIds.includes(order.id)}
                        onConfirm={() => openModal(order)}
                        onDelivery={() => setDeliveryOrder(order)}
                        onCreditView={() => setActiveSection("CREDITS")}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* ❌ REMOVED: "Credit Ledger" button (totalCreditsNeedingAction > 0) and "Awaiting Manager Approval" section */}
            </div>
          )}

          {activeSection === "CREDITS" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div>
                <h2 className="text-2xl font-black text-black uppercase tracking-tighter">Credit Ledger</h2>
                <p className="text-purple-600 text-[14px] italic font-medium mt-1">
                  Manage on-account orders, approvals and client settlements
                </p>
              </div>
              <CreditLedgerPanel 
                cashierName={cashierName} 
                onCreditSettled={handleRefresh}
                refreshTrigger={credits}
              />
            </div>
          )}

          {activeSection === "DELIVERIES" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex items-end justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-2xl font-black text-black uppercase tracking-tighter">Deliveries</h2>
                  <p className="text-orange-600 text-[14px] italic font-medium mt-1">Live dispatch & tracking</p>
                </div>
              </div>
              {normalQueue.length > 0 && !dayClosed && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Assign a Live Order for Delivery</p>
                  <div className="space-y-2">
                    {normalQueue.map(order => (
                      <div key={order.id} className="bg-zinc-50 border border-black/10 rounded-[2rem] p-4 flex items-center justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-black uppercase italic truncate">{order.table_name || `Order #${order.id}`}</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase mt-0.5">
                            {order.requested_by} · {formatFullAmount(order.amount)} · {timeAgo(order.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => setDeliveryOrder(order)}
                          className="flex items-center gap-2 px-5 py-3 bg-orange-500 text-white font-black text-[10px] uppercase rounded-xl hover:bg-orange-600 active:scale-[0.98] transition-all shadow-lg shadow-orange-500/20 shrink-0"
                        >
                          <Bike size={14} /> Assign Rider
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <DeliveriesPanel
                key={deliveryRefreshKey}
                dark={false}
                role="CASHIER"
                cashierName={cashierName}
                onPaymentConfirmed={handleRefresh}
              />
            </div>
          )}

          {activeSection === "PETTY CASH" && (
            <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-500">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-black uppercase">Petty Cash</h2>
                  <p className="text-yellow-600 text-[14px] font-medium mt-1 italic tracking-tight">Track your daily expenses</p>
                </div>
                <div className="px-6 py-4 bg-zinc-50 border border-black/10 rounded-[2rem] flex items-center gap-4 shrink-0">
                  <div className="p-3 bg-rose-100 rounded-xl text-rose-600"><Wallet size={18} /></div>
                  <div>
                    <p className="text-[8px] font-black text-rose-600 uppercase tracking-widest leading-none mb-1.5">Shift Outflow</p>
                    <p className="text-lg font-black text-black italic">{formatFullAmount(pettyCashOutTotal)}</p>
                  </div>
                </div>
              </div>
              <PettyCashPanel
                role="CASHIER"
                staffName={cashierName}
                grossCash={cashRevenue}
                theme="light"
                onTotalChange={(outTotal, inTotal) => {
                  setPettyCashOutTotal(outTotal);
                  setPettyCashInTotal(inTotal);
                }}
              />
            </div>
          )}

          {activeSection === "CLOSED" && (
            <div className="space-y-4 animate-in fade-in duration-500">
              {displayList.length === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-black/10 rounded-[3rem] bg-zinc-50/50">
                  <ShieldCheck size={32} className="mx-auto text-zinc-400 mb-4" />
                  <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest italic">No records found</p>
                </div>
              ) : (
                displayList.map(h => <HistoryCard key={`${h.id}-${h.created_at}`} item={h} />)
              )}
            </div>
          )}
        </main>

        <Footer />
      </div>

      {/* Payment Modal (unchanged) – but we already prevented opening if dayClosed */}
      {processingOrder && !dayClosed && (
        <div className="fixed inset-0 z-[300] bg-white/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white border border-black/10 rounded-[3rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-black/10">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h2 className="text-black font-black uppercase italic text-sm tracking-tighter truncate">
                  {processingOrder.table_name || "TABLE"}
                </h2>
                <span className="text-zinc-400 font-black shrink-0">•</span>
                <h2 className="text-yellow-600 font-black uppercase italic text-sm tracking-tighter shrink-0">
                  #{String(processingOrder.id).slice(-6)}
                </h2>
                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest bg-zinc-100 px-3 py-1.5 rounded-full shrink-0">
                  {processingOrder.requested_by}
                </span>
              </div>
              <button
                onClick={() => { setProcessingOrder(null); setRejecting(false); }}
                className="p-2 bg-zinc-100 rounded-full text-zinc-500 hover:text-black shrink-0 ml-2"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex justify-center mb-6">
              <div className={`p-6 rounded-full ${
                processingOrder.method === "Momo-MTN"    ? "bg-purple-100 text-purple-600" :
                processingOrder.method === "Momo-Airtel" ? "bg-purple-100 text-purple-600" :
                processingOrder.method === "Card"        ? "bg-blue-100 text-blue-600"     :
                processingOrder.method === "Credit"      ? "bg-purple-100 text-purple-600" :
                                                           "bg-emerald-100 text-emerald-600"}`}>
                {processingOrder.method === "Cash"   ? <Banknote size={40} />   :
                 processingOrder.method === "Card"   ? <CreditCard size={40} /> :
                 processingOrder.method === "Credit" ? <BookOpen size={40} />   :
                 <Smartphone size={40} />}
              </div>
            </div>

            <div className="text-center mb-2">
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                processingOrder.method === "Cash"        ? "bg-emerald-100 text-emerald-600" :
                processingOrder.method === "Card"        ? "bg-blue-100 text-blue-600"       :
                processingOrder.method === "Momo-MTN"    ? "bg-purple-100 text-purple-600"   :
                processingOrder.method === "Momo-Airtel" ? "bg-purple-100 text-purple-600"   :
                "bg-purple-100 text-purple-600"}`}>
                {processingOrder.method === "Momo-MTN" ? "MTN" : processingOrder.method === "Momo-Airtel" ? "Airtel" : processingOrder.method}
              </span>
            </div>

            <h3 className="text-2xl font-black text-black text-center uppercase italic mb-2 tracking-tighter">
              {isCredit ? "Forward Credit to Manager" : "Confirm Receipt"}
            </h3>

            <div className="bg-zinc-50 border border-black/10 rounded-3xl p-6 mb-6 text-center">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] block mb-2">
                {processingOrder.label || "Amount Due"}
              </span>
              <span className="text-3xl font-black text-black italic tracking-tighter break-words">
                {formatFullAmount(processingOrder.amount)}
              </span>
            </div>

            {isCredit && (
              <div className="bg-purple-50 border border-purple-200 rounded-3xl p-5 mb-6 space-y-2">
                <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-3">Client Info (REQUIRED)</p>
                <div className="flex items-center gap-2">
                  <User size={12} className="text-zinc-500 shrink-0" />
                  <span className={`text-sm font-black truncate ${processingOrder.credit_name ? "text-black" : "text-red-600"}`}>
                    {processingOrder.credit_name || "⚠️ Missing - Required!"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-zinc-500 shrink-0" />
                  <span className={`text-sm truncate ${processingOrder.credit_phone ? "text-zinc-700" : "text-red-600"}`}>
                    {processingOrder.credit_phone || "⚠️ Missing - Required!"}
                  </span>
                </div>
                {processingOrder.credit_pay_by && (
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-zinc-500 shrink-0" />
                    <span className="text-sm text-zinc-700 truncate">{processingOrder.credit_pay_by}</span>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-purple-200 bg-yellow-50 rounded-xl p-3">
                  <p className="text-[9px] font-black text-yellow-600 uppercase tracking-widest text-center">
                    ⚠️ Client name and phone number are required before forwarding
                  </p>
                  <p className="text-[8px] text-purple-600 text-center mt-1">
                    Manager approval required · Forwarding creates a credit record in the ledger
                  </p>
                </div>
              </div>
            )}

            {isMomoProcessing && !rejecting && (
              <div className="mb-6">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                  {processingOrder.method === "Momo-MTN" ? "MTN" : "Airtel"} Transaction ID
                  <span className="text-red-500 ml-1">*</span>
                </p>
                <input
                  autoFocus
                  type="text"
                  placeholder="ENTER TRANSACTION ID"
                  className="w-full bg-white border border-purple-300 p-5 rounded-2xl text-black font-black outline-none focus:border-purple-500 text-center uppercase tracking-widest text-sm"
                  value={momoTransactionId}
                  onChange={e => setMomoTransactionId(e.target.value)}
                />
              </div>
            )}

            {rejecting && (
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="Reason for rejection (optional)..."
                className="w-full bg-white border border-red-300 p-4 rounded-2xl text-black font-bold outline-none resize-none h-20 mb-6"
              />
            )}

            {!rejecting ? (
              <div className="flex flex-col gap-3">
                {isCredit ? (
                  <>
                    <button
                      onClick={() => handleForwardCredit(processingOrder)}
                      disabled={requestingApproval || !processingOrder.credit_name || !processingOrder.credit_phone}
                      className={`w-full py-5 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all
                        ${(!processingOrder.credit_name || !processingOrder.credit_phone)
                          ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                          : "bg-purple-600 text-white hover:bg-purple-700 active:scale-[0.98]"
                        }`}
                    >
                      {requestingApproval ? "Forwarding…" : <><Send size={14} /> Forward to Manager</>}
                    </button>
                    <button
                      onClick={() => setActiveSection("CREDITS")}
                      className="w-full py-3 bg-purple-50 border border-purple-200 text-purple-600 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2"
                    >
                      <BookOpen size={13} /> View Credit Ledger
                    </button>
                    <button
                      onClick={() => setRejecting(true)}
                      className="w-full py-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2"
                    >
                      <XCircle size={13} /> Reject Credit Request
                    </button>
                    <button onClick={() => setProcessingOrder(null)} className="w-full py-3 text-zinc-500 font-black uppercase text-[10px]">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex gap-3">
                      <button onClick={() => setProcessingOrder(null)} className="flex-1 py-4 text-zinc-500 font-black uppercase text-[10px]">
                        Cancel
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="flex-1 py-4 border border-black/10 text-black rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2"
                      >
                        <Printer size={14} /> Print
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setRejecting(true)}
                        className="flex-1 py-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                      <button
                        onClick={handleFinalConfirm}
                        disabled={!canConfirm || confirming}
                        className={`flex-[2] py-5 rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2
                          ${canConfirm && !confirming
                            ? "bg-yellow-500 text-black shadow-xl shadow-yellow-500/20 hover:bg-yellow-600 active:scale-[0.98]"
                            : "bg-zinc-100 text-zinc-400 cursor-not-allowed"}`}
                      >
                        {confirming ? "Processing..." : "Finalize Settlement"}
                      </button>
                    </div>
                    <button
                      onClick={() => { setProcessingOrder(null); setDeliveryOrder(processingOrder); }}
                      className="w-full py-3 bg-orange-50 border border-orange-200 text-orange-600 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 hover:bg-orange-100 transition-all"
                    >
                      <Bike size={13} /> Send for Delivery Instead
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => setRejecting(false)}
                  className="flex-1 py-4 border border-black/10 text-zinc-500 rounded-2xl font-black uppercase text-[10px]"
                >
                  Back
                </button>
                <button
                  onClick={handleReject}
                  disabled={confirming}
                  className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-red-700 transition-all disabled:opacity-50"
                >
                  <XCircle size={14} /> Confirm Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showReceipt && (
        <ReceiptModal data={selectedSettlement} onClose={() => setShowReceipt(false)} />
      )}

      {showShiftSummary && (
        <ShiftSummaryModal
          data={{
            cash: cashRevenue,
            momo: totalMobileMoney,
            mtn: momoMTN,
            airtel: momoAirtel,
            card: cardRevenue,
            petty: pettyCashOutTotal,
            net: netCashAfterPetty,
            credit: todaySummary?.total_credit || 0,
            gross: grossRevenue,
          }}
          onClose={() => setShowShiftSummary(false)}
          onFinalize={handleFinalizeShift}
          isFinalizing={isFinalizing}
        />
      )}

      {deliveryOrder && !dayClosed && (
        <DeliveryModal
          order={deliveryOrder}
          cashierName={cashierName}
          onClose={() => setDeliveryOrder(null)}
          onCreated={() => {
            setDeliveryOrder(null);
            setDeliveryRefreshKey(k => k + 1);
            setActiveSection("DELIVERIES");
            fetchAll();
          }}
        />
      )}
    </div>
  );
}

// ─── LIVE ORDER CARD (full amounts) ──────────────────────────────────────────
function LiveOrderCard({ order, onConfirm, onDelivery }) {
  const isCredit = order.method === "Credit";
  return (
    <div className={`border rounded-[2.5rem] p-4 sm:p-6 transition-all
      ${isCredit
        ? "bg-purple-50 border-purple-200 hover:border-purple-400"
        : "bg-white border-black/10 hover:border-yellow-500/50 shadow-sm"}`}>
      <div className="flex justify-between items-start mb-4 gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-black text-yellow-600 uppercase tracking-widest">
              {order.table_name}
            </span>
            {isCredit && (
              <span className="text-[8px] bg-purple-100 border border-purple-200 text-purple-600 px-2 py-0.5 rounded-lg font-black uppercase">
                Credit
              </span>
            )}
          </div>
          <h3 className="text-base sm:text-lg font-black text-black uppercase tracking-tighter truncate">
            {order.label || `Order #${order.id}`}
          </h3>
          <p className="text-zinc-500 text-[10px] font-bold uppercase mt-1 truncate">
            {order.requested_by} · {timeAgo(order.created_at)}
            {isCredit && order.credit_name && ` · ${order.credit_name}`}
            {isCredit && !order.credit_name && (
              <span className="text-red-500 ml-1">⚠️ Missing client name!</span>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isCredit ? "text-purple-600" : "text-zinc-500"}`}>
            {order.method === "Momo-MTN" ? "MTN" : order.method === "Momo-Airtel" ? "Airtel" : order.method}
          </p>
          <p className="text-base sm:text-xl font-black text-black italic tracking-tighter whitespace-nowrap">
            {formatFullAmount(order.amount)}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {isCredit ? (
          <>
            <button
              onClick={onConfirm}
              disabled={!order.credit_name || !order.credit_phone}
              className={`flex-1 py-3 font-black text-[10px] uppercase rounded-xl transition-all flex items-center justify-center gap-2
                ${(!order.credit_name || !order.credit_phone)
                  ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                  : "bg-purple-600 text-white hover:bg-purple-700"
                }`}
            >
              <Send size={13} /> Forward to Manager
            </button>
            <button
              onClick={onDelivery}
              className="p-3 bg-zinc-100 border border-black/10 text-zinc-600 rounded-xl hover:bg-orange-100 hover:text-orange-600 hover:border-orange-300 transition-all shrink-0"
            >
              <Bike size={16} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onConfirm}
              className="flex-1 py-3 bg-yellow-500 text-black font-black text-[10px] uppercase rounded-xl hover:bg-yellow-600 transition-all"
            >
              Process Payment
            </button>
            <button
              onClick={onDelivery}
              className="p-3 bg-zinc-100 border border-black/10 text-zinc-600 rounded-xl hover:bg-orange-100 hover:text-orange-600 hover:border-orange-300 transition-all shrink-0"
            >
              <Bike size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── FORWARDED CREDIT CARD (unchanged – amounts now full) ─────────────────────
function ForwardedCreditCard({ order }) {
  return (
    <div className="bg-purple-50 border border-purple-200 rounded-[2.5rem] p-5 flex items-center justify-between gap-4 flex-wrap opacity-70">
      <div className="flex items-center gap-4 min-w-0">
        <div className="p-4 rounded-2xl bg-white border border-purple-200 text-purple-600 shrink-0">
          <BookOpen size={20} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-black text-black italic uppercase text-sm truncate">{order.table_name}</span>
            <span className="text-[9px] bg-purple-100 border border-purple-200 text-purple-600 px-2 py-0.5 rounded-lg font-black uppercase">Credit</span>
            {order.credit_name && <span className="text-[9px] text-zinc-500 font-bold truncate">{order.credit_name}</span>}
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase">
            Forwarded by {order.confirmed_by} · {timeAgo(order.created_at)}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xl font-black text-purple-600 italic whitespace-nowrap">{formatFullAmount(order.amount)}</p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <Clock size={9} className="text-purple-600 animate-pulse" />
          <span className="text-[9px] text-purple-600 font-black uppercase tracking-widest whitespace-nowrap">Pending Manager</span>
        </div>
      </div>
    </div>
  );
}

// ─── HISTORY CARD (full amounts) ─────────────────────────────────────────────
function HistoryCard({ item }) {
  const { color, icon } = methodStyle(item.method);
  const isPartiallySettled = item.status === "PartiallySettled";
  const isConfirmed = item.status === "Confirmed";

  const displayAmount = isPartiallySettled && item.paid_amount
    ? `${formatFullAmount(item.paid_amount)} / ${formatFullAmount(item.amount)}`
    : formatFullAmount(item.amount);

  const statusColor = isPartiallySettled ? "text-yellow-600" : isConfirmed ? "text-emerald-600" : "text-red-600";
  const statusIcon  = isPartiallySettled
    ? <AlertTriangle size={10} className="text-yellow-600" />
    : isConfirmed
    ? <CheckCircle size={10} className="text-emerald-600" />
    : <XCircle size={10} className="text-red-600" />;
  const statusText = isPartiallySettled ? "Partial" : isConfirmed ? "Confirmed" : item.status;

  return (
    <div className={`bg-white border p-5 sm:p-6 rounded-[2.5rem] flex items-center justify-between gap-4 flex-wrap hover:bg-zinc-50 transition-all shadow-sm
      ${isPartiallySettled ? "border-yellow-300 bg-yellow-50/50" : "border-black/10"}`}>
      <div className="flex items-center gap-4 min-w-0">
        <div className={`p-4 rounded-2xl bg-white border ${isPartiallySettled ? "border-yellow-300" : "border-black/10"} shadow-sm ${color} shrink-0`}>
          {React.cloneElement(icon, { size: 20 })}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-black text-black italic uppercase tracking-tighter truncate">{item.table_name}</h4>
            <span className="text-zinc-400 shrink-0">•</span>
            <span className={`text-[9px] font-black uppercase ${color}`}>
              {item.method === "Momo-MTN" ? "MTN" : item.method === "Momo-Airtel" ? "Airtel" : item.method}
            </span>
            {item.order_type === "delivery" && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-100 border border-orange-200 text-orange-600 text-[9px] font-black uppercase">
                <Bike size={9} /> Delivery
              </span>
            )}
            {isPartiallySettled && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-yellow-100 border border-yellow-200 text-yellow-600 text-[9px] font-black uppercase">
                <AlertTriangle size={9} /> Partial Payment
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase truncate">
            {item.label} · {item.requested_by} · {timeAgo(item.confirmed_at || item.created_at)}
          </p>
          {item.transaction_id && (
            <p className="text-[9px] text-zinc-400 font-mono mt-0.5 truncate">TXN: {item.transaction_id}</p>
          )}
          {isPartiallySettled && item.remaining_amount > 0 && (
            <p className="text-[9px] text-yellow-600 font-mono mt-0.5">
              Remaining: {formatFullAmount(item.remaining_amount)}
            </p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-base sm:text-xl font-black italic tracking-tighter ${color} whitespace-nowrap`}>
          {displayAmount}
        </p>
        <div className="flex items-center justify-end gap-1 mt-1">
          {statusIcon}
          <span className={`text-[8px] font-black uppercase tracking-widest ${statusColor}`}>{statusText}</span>
        </div>
      </div>
    </div>
  );
}

// ─── SHIFT SUMMARY MODAL (full amounts) ─────────────────────────────────────
function ShiftSummaryModal({ data, onClose, onFinalize, isFinalizing }) {
  if (!data) return null;
  return (
    <div className="fixed inset-0 z-[500] bg-white/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-black/10 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <div className="w-12 h-1 bg-yellow-500 mx-auto rounded-full mb-4 opacity-50" />
          <h2 className="text-xl font-black text-black uppercase italic tracking-tight">Shift Review</h2>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Verify totals before closing</p>
        </div>
        <div className="space-y-4 mb-8">
          <SummaryRow label="Total Cash" value={formatFullAmount(data.cash)} />
          <SummaryRow label="Mobile Money" value={formatFullAmount(data.momo)} />
          <SummaryRow label="Card Payments" value={formatFullAmount(data.card)} />
          <SummaryRow label="Petty Cash" value={`-${formatFullAmount(data.petty)}`} color="text-rose-600" />
          <div className="pt-4 mt-4 border-t border-black/10">
            <div className="bg-yellow-500 p-5 rounded-2xl border border-yellow-400 shadow-xl shadow-yellow-500/20">
              <p className="text-[9px] font-black text-black/60 uppercase tracking-widest mb-1">Handover Balance (Cash)</p>
              <p className="text-2xl font-black text-black italic tracking-tighter break-words">{formatFullAmount(data.net)}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={onFinalize}
            disabled={isFinalizing}
            className={`w-full py-5 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3 transition-all
              ${isFinalizing ? "bg-zinc-100 text-zinc-400" : "bg-red-600 text-white hover:bg-red-700 active:scale-95 shadow-lg shadow-red-600/20"}`}
          >
            {isFinalizing
              ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /><span>Finalizing…</span></>
              : "Finalize & Clear Totals"
            }
          </button>
          <button onClick={onClose} disabled={isFinalizing} className="w-full py-2 text-zinc-500 font-bold uppercase text-[10px] tracking-widest hover:text-zinc-700">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color = "text-black" }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</span>
      <span className={`text-sm font-black italic ${color} break-words text-right`}>{value}</span>
    </div>
  );
}

// ─── RECEIPT MODAL (unchanged) ────────────────────────────────────────────────
function ReceiptModal({ data, onClose }) {
  return (
    <div className="fixed inset-0 z-[500] bg-white/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white text-black w-full max-w-sm rounded-[3rem] p-12 font-mono shadow-2xl relative overflow-hidden border border-black/10">
        <div className="absolute top-0 left-0 w-full h-2 bg-yellow-500" />
        <h2 className="text-2xl font-black uppercase text-center mb-2 tracking-tighter">KURAX BISTRO</h2>
        <p className="text-[10px] text-center mb-8 uppercase font-bold text-zinc-500">Official Settlement Voucher</p>
        <div className="space-y-4 border-y border-dashed border-zinc-200 py-8 mb-8">
          <div className="flex justify-between text-xs gap-4">
            <span className="shrink-0">REFERENCE:</span>
            <span className="font-bold break-words text-right">#SETL-{Date.now().toString().slice(-4)}</span>
          </div>
          <div className="flex justify-between text-xs gap-4">
            <span className="shrink-0">RIDER:</span>
            <span className="font-bold uppercase break-words text-right">{data?.name}</span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={() => window.print()} className="w-full py-4 bg-yellow-500 text-black font-black rounded-2xl uppercase italic text-sm flex items-center justify-center gap-3 hover:bg-yellow-600 transition-all">
            <Printer size={18} /> Print Voucher
          </button>
          <button onClick={onClose} className="w-full py-4 text-zinc-500 font-bold uppercase text-[10px] hover:text-zinc-700 transition-all">
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}