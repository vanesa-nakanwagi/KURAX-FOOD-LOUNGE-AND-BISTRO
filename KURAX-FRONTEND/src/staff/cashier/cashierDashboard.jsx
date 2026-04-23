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

// ─── HELPERS ──────────────────────────────────────────────────────────────────
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
    case "Cash":        return { color: "text-emerald-500",  icon: <Banknote size={24} /> };
    case "Card":        return { color: "text-blue-400", icon: <CreditCard size={24} /> };
    case "Momo-MTN":    return { color: "text-purple-400", icon: <Smartphone size={24} /> };
    case "Momo-Airtel": return { color: "text-purple-400",    icon: <Smartphone size={24} /> };
    case "Credit":      return { color: "text-purple-400", icon: <BookOpen size={24} /> };
    default:            return { color: "text-zinc-400",   icon: <Banknote size={24} /> };
  }
}

// Format currency in compact form (UGX 70K, UGX 1.2M, etc.)
function formatCurrencyCompact(n) {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `UGX ${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `UGX ${(num / 1_000).toFixed(0)}K`;
  return `UGX ${num.toLocaleString()}`;
}

// ─── ENHANCED STAT CARD (Matches Accountant Dashboard) ────────────────────────
function StatCard({ icon, label, value, color, gradient, note, trend }) {
  const formattedValue = formatCurrencyCompact(value);
  const numericValue = Number(value || 0);
  
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
          {note && (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-white/10 text-zinc-400 uppercase tracking-wider">
              {note}
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
function GrossRevenueCard({ grossSales, creditSettledToday }) {
  const combinedTotal = grossSales + creditSettledToday;
  const hasCredits = creditSettledToday > 0;
  const formattedGross = formatCurrencyCompact(grossSales);
  const formattedSettled = formatCurrencyCompact(creditSettledToday);
  const formattedCombined = formatCurrencyCompact(combinedTotal);
  
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
              Today
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
            Cash + Card + Mobile Money
          </p>
        </div>

        {hasCredits && (
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

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function CashierDashboard() {

  const loggedInUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}"); }
    catch { return {}; }
  }, []);
  const cashierName = loggedInUser?.name || "Cashier";
  const isDark = true;

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
  
  // FIXED: Track both petty cash OUT (expenses) and IN (replenishment)
  const [pettyCashOutTotal,  setPettyCashOutTotal]  = useState(0);
  const [pettyCashInTotal,   setPettyCashInTotal]   = useState(0);
  const [creditSettledToday, setCreditSettledToday] = useState(0);

  const [deliveryOrder,      setDeliveryOrder]      = useState(null);
  const [deliveryRefreshKey, setDeliveryRefreshKey] = useState(0);
  const [deliveryBadge,      setDeliveryBadge]      = useState(0);

  const [isFinalizing, setIsFinalizing] = useState(false);
  const [today, setToday] = useState(getTodayLocal);

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

  // ── TODAY TOTALS - Exclude partially settled credits from gross ──
  const todayTotals = useMemo(() => {
    const base = { cash: 0, card: 0, momo_mtn: 0, momo_airtel: 0, credit: 0, gross: 0 };
    history.forEach(row => {
      const confirmedOn = toLocalDateStr(new Date(row.confirmed_at || row.created_at));
      
      if (row.status === "Confirmed" && confirmedOn === today) {
        if (row.method !== "Credit") {
          const amt = Number(row.amount) || 0;
          switch (row.method) {
            case "Cash":        base.cash += amt; base.gross += amt; break;
            case "Card":        base.card += amt; base.gross += amt; break;
            case "Momo-MTN":    base.momo_mtn += amt; base.gross += amt; break;
            case "Momo-Airtel": base.momo_airtel += amt; base.gross += amt; break;
            default: break;
          }
        }
      }
      
      if (row.method === "Credit" && row.status === "Confirmed" && confirmedOn === today) {
        base.credit += Number(row.amount) || 0;
      }
    });
    return base;
  }, [history, today]);

  // Combined mobile money total
  const totalMobileMoney = todayTotals.momo_mtn + todayTotals.momo_airtel;

  // FIXED: Cash on Counter = Gross Cash - Replenishment (petty cash IN)
  // Because replenishment moves money FROM main drawer TO petty cash wallet
  const cashOnCounter = Math.max(0, todayTotals.cash - pettyCashInTotal);

  // Net cash after petty expenses (for shift summary)
  const netCashAfterPetty = todayTotals.cash - pettyCashOutTotal;

  const creditNeedsAction = useMemo(
    () => credits.filter(c => c.status === "PendingCashier").length,
    [credits]
  );
  const creditPendingMgr = useMemo(
    () => credits.filter(c => c.status === "PendingManagerApproval").length,
    [credits]
  );

  const fetchAll = useCallback(async () => {
    try {
      const [qRes, cRes, hRes, pRes, sRes] = await Promise.all([
        fetch(`${API_URL}/api/cashier-ops/cashier-queue`),
        fetch(`${API_URL}/api/credits`),
        fetch(`${API_URL}/api/cashier-ops/cashier-history`),
        fetch(`${API_URL}/api/summaries/petty-cash?date=${today}`),
        fetch(`${API_URL}/api/summaries/today`),
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
        // FIXED: Track both IN and OUT separately
        setPettyCashInTotal(Number(summary.total_in) || 0);
        setPettyCashOutTotal(Number(summary.total_out) || 0);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        setCreditSettledToday(Number(sData.credit_settlements_today || 0));
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
    setProcessingOrder(order);
    setMomoTransactionId("");
    setRejecting(false);
    setRejectNote("");
  };

  const handleFinalConfirm = async () => {
    const order = processingOrder;
    const isMomo = order.method === "Momo-MTN" || order.method === "Momo-Airtel";
    if (isMomo && !momoTransactionId.trim()) return;
    setConfirming(true);
    setAnimatingIds(prev => [...prev, order.id]);
    try {
      const res = await fetch(`${API_URL}/api/cashier-ops/cashier-queue/${order.id}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed_by: cashierName,
          transaction_id: momoTransactionId.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Confirm failed");
        setConfirming(false);
        setAnimatingIds(prev => prev.filter(id => id !== order.id));
        return;
      }
      await fetchAll();
    } catch (e) { console.error("Confirm failed:", e); }
    setTimeout(() => {
      setAnimatingIds(prev => prev.filter(id => id !== order.id));
      setProcessingOrder(null);
      setConfirming(false);
    }, 500);
  };

  const handleForwardCredit = async (order) => {
    setRequestingApproval(true);
    try {
      const res = await fetch(`${API_URL}/api/cashier-ops/cashier-queue/${order.id}/request-approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requested_by: cashierName }),
      });
      if (res.ok) {
        await fetchAll();
        setProcessingOrder(null);
        setRequestingApproval(false);
        alert("Credit request forwarded to manager for approval.");
        return;
      }
      const error = await res.json();
      if (error.error && error.error.includes("table_name")) {
        alert(
          "Table information missing for this credit.\n\n" +
          "Please ask the waiter to resend the credit request with the correct table information."
        );
      } else {
        alert(error.error || "Failed to forward to manager. Please try again.");
      }
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
      total_cash: todayTotals.cash,
      total_mtn: todayTotals.momo_mtn,
      total_airtel: todayTotals.momo_airtel,
      total_card: todayTotals.card,
      gross_total: todayTotals.gross,
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
    if (orderStatusFilter === "CLOSED") {
      return h.status === "Confirmed" || h.status === "PartiallySettled";
    }
    if (orderStatusFilter === "PENDING") {
      if (h.status === "Pending") {
        return Math.floor((Date.now() - new Date(h.created_at)) / 60000) < 40;
      }
      return false;
    }
    if (orderStatusFilter === "DELAYED") {
      return h.status === "Pending" &&
        Math.floor((Date.now() - new Date(h.created_at)) / 60000) >= 40;
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
    <div className="flex h-screen bg-black font-[Outfit] text-slate-200 overflow-hidden">
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
          card: todayTotals.card,
        }}
        deliveryBadge={deliveryBadge}
        creditBadge={creditNeedsAction + creditPendingMgr}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        <header className="flex items-center justify-between px-6 py-4 bg-black/40 border-b border-white/5 sticky top-0 z-50 flex-wrap gap-3 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 bg-zinc-900 rounded-xl text-yellow-500"
            >
              <Menu size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-1 h-6 bg-yellow-500 rounded-full" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500/80">Cashier Overview</h4>
              </div>
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white tracking-tight">
                Welcome back, <span className="text-yellow-400 capitalize whitespace-nowrap">{cashierName}</span>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {normalQueue.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500 rounded-xl animate-pulse">
                <AlertTriangle size={13} className="text-black shrink-0" />
                <span className="text-[10px] font-black text-black uppercase tracking-widest whitespace-nowrap">
                  {normalQueue.length} Pending
                </span>
              </div>
            )}
            {creditNeedsAction > 0 && (
              <button
                onClick={() => setActiveSection("CREDITS")}
                className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 border border-orange-500/30 rounded-xl hover:bg-orange-500/30 transition-all animate-pulse"
              >
                <BookOpen size={13} className="text-orange-400 shrink-0" />
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest whitespace-nowrap">
                  {creditNeedsAction} Credit{creditNeedsAction > 1 ? "s" : ""} Need Action
                </span>
              </button>
            )}
            {creditPendingMgr > 0 && (
              <button
                onClick={() => setActiveSection("CREDITS")}
                className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-xl hover:bg-purple-500/30 transition-all"
              >
                <Clock size={13} className="text-purple-400 shrink-0" />
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest whitespace-nowrap">
                  {creditPendingMgr} Awaiting Mgr
                </span>
              </button>
            )}
            {deliveryBadge > 0 && (
              <button
                onClick={() => setActiveSection("DELIVERIES")}
                className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 border border-orange-500/30 rounded-xl hover:bg-orange-500/30 transition-all"
              >
                <Bike size={13} className="text-orange-400 shrink-0" />
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest whitespace-nowrap">
                  {deliveryBadge} Delivery
                </span>
              </button>
            )}
            <button onClick={fetchAll} className="p-2 bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-all shrink-0">
              <RefreshCw size={16} className={qLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10">

          {activeSection === "CLOSED" && (
            <div className="mb-10 flex gap-6 border-b border-white/5 overflow-x-auto pb-1">
              {["PENDING", "DELAYED", "CLOSED"].map(s => (
                <button
                  key={s}
                  onClick={() => setOrderStatusFilter(s)}
                  className={`pb-2 text-[11px] font-black uppercase tracking-widest relative transition-colors whitespace-nowrap
                    ${orderStatusFilter === s ? "text-yellow-500" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  {s}
                  {orderStatusFilter === s && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500" />}
                </button>
              ))}
            </div>
          )}

          {activeSection === "PENDING" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
              
              {/* 5 Stat Cards in responsive grid - FIXED Cash on Counter */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                <StatCard
                  icon={<Banknote size={20} className="text-emerald-400" />}
                  label="Cash on Counter"
                  value={cashOnCounter}
                  color="text-emerald-500"
                  gradient="from-emerald-900/30 to-emerald-800/10"
                  note={pettyCashInTotal > 0 ? `-${formatCurrencyCompact(pettyCashInTotal)} to petty` : null}
                  trend={5.2}
                />
                <StatCard
                  icon={<CreditCard size={20} className="text-blue-400" />}
                  label="Card Revenue"
                  value={todayTotals.card}
                  color="text-blue-400"
                  gradient="from-blue-900/30 to-blue-800/10"
                  trend={-2.1}
                />
                <StatCard
                  icon={<Smartphone size={20} className="text-purple-400" />}
                  label="Mobile Money"
                  value={totalMobileMoney}
                  color="text-purple-400"
                  gradient="from-purple-900/30 to-purple-800/10"
                  note="MTN + Airtel"
                  trend={8.3}
                />
                <StatCard
                  icon={<Wallet size={20} className="text-rose-400" />}
                  label="Petty Expenses"
                  value={pettyCashOutTotal}
                  color="text-rose-500"
                  gradient="from-rose-900/30 to-rose-800/10"
                  note="spent from petty"
                />
                <GrossRevenueCard
                  grossSales={todayTotals.gross}
                  creditSettledToday={creditSettledToday}
                />
              </div>

              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-yellow-500 rounded-full" />
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Live Payment Queue</h3>
                  </div>
                  {normalQueue.length > 0 && (
                    <span className="px-2 py-0.5 bg-yellow-500 text-black text-[9px] rounded-full font-black">
                      {normalQueue.length}
                    </span>
                  )}
                </div>
                {qLoading ? (
                  <div className="space-y-3">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="h-28 rounded-[2.5rem] bg-zinc-900/30 animate-pulse border border-white/5" />
                    ))}
                  </div>
                ) : normalQueue.length === 0 ? (
                  <div className="py-16 text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-zinc-900/10">
                    <ShieldCheck size={32} className="mx-auto text-zinc-700 mb-4" />
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

              {(creditNeedsAction > 0 || creditPendingMgr > 0) && (
                <button
                  onClick={() => setActiveSection("CREDITS")}
                  className="w-full p-5 bg-purple-500/5 border border-purple-500/20 rounded-[2.5rem] flex items-center gap-4 hover:bg-purple-500/10 transition-all text-left group"
                >
                  <div className="p-4 rounded-2xl bg-black border border-purple-500/20 text-purple-400 shrink-0">
                    <BookOpen size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-white uppercase tracking-tighter text-sm">Credit Ledger</p>
                    <p className="text-[10px] text-zinc-500 font-bold mt-0.5 break-words">
                      {creditNeedsAction > 0 && `${creditNeedsAction} credit${creditNeedsAction > 1 ? "s" : ""} need forwarding to manager · `}
                      {creditPendingMgr > 0 && `${creditPendingMgr} awaiting manager approval`}
                    </p>
                  </div>
                  <ArrowRightLeft size={16} className="text-zinc-600 group-hover:text-purple-400 transition-colors shrink-0" />
                </button>
              )}

              {forwardedQueue.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 bg-purple-500 rounded-full" />
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Awaiting Manager Approval</h3>
                    </div>
                    <span className="px-2 py-0.5 bg-purple-500 text-white text-[9px] rounded-full font-black animate-pulse">
                      {forwardedQueue.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {forwardedQueue.map(order => <ForwardedCreditCard key={order.id} order={order} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === "CREDITS" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Credit Ledger</h2>
                <p className="text-purple-400 text-[14px] italic font-medium mt-1">
                  Manage on-account orders, approvals and client settlements
                </p>
              </div>
              <CreditLedgerPanel cashierName={cashierName} />
            </div>
          )}

          {activeSection === "DELIVERIES" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex items-end justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Deliveries</h2>
                  <p className="text-orange-400 text-[14px] italic font-medium mt-1">Live dispatch & tracking</p>
                </div>
              </div>
              {normalQueue.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Assign a Live Order for Delivery</p>
                  <div className="space-y-2">
                    {normalQueue.map(order => (
                      <div key={order.id} className="bg-zinc-900/20 border border-white/5 rounded-[2rem] p-4 flex items-center justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-white uppercase italic truncate">{order.table_name || `Order #${order.id}`}</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase mt-0.5">
                            {order.requested_by} · {formatCurrencyCompact(order.amount)} · {timeAgo(order.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => setDeliveryOrder(order)}
                          className="flex items-center gap-2 px-5 py-3 bg-orange-500 text-black font-black text-[10px] uppercase rounded-xl hover:bg-orange-400 active:scale-[0.98] transition-all shadow-lg shadow-orange-500/20 shrink-0"
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
                dark={true}
                role="CASHIER"
                cashierName={cashierName}
                onPaymentConfirmed={fetchAll}
              />
            </div>
          )}

          {activeSection === "PETTY CASH" && (
            <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-500">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase">Petty Cash</h2>
                  <p className="text-yellow-600 text-[14px] font-medium mt-1 italic tracking-tight">Track your daily expenses</p>
                </div>
                <div className="px-6 py-4 bg-zinc-900/50 border border-white/5 rounded-[2rem] flex items-center gap-4 shrink-0">
                  <div className="p-3 bg-rose-500/20 rounded-xl text-rose-500"><Wallet size={18} /></div>
                  <div>
                    <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest leading-none mb-1.5">Shift Outflow</p>
                    <p className="text-lg font-black text-white italic">{formatCurrencyCompact(pettyCashOutTotal)}</p>
                  </div>
                </div>
              </div>
              <PettyCashPanel
                role="CASHIER"
                staffName={cashierName}
                grossCash={todayTotals.cash}
                theme="dark"
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
                <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-zinc-900/10">
                  <ShieldCheck size={32} className="mx-auto text-zinc-700 mb-4" />
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

      {/* Payment Modal - Same styling */}
      {processingOrder && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-[3rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h2 className="text-white font-black uppercase italic text-sm tracking-tighter truncate">
                  {processingOrder.table_name || "TABLE"}
                </h2>
                <span className="text-zinc-700 font-black shrink-0">•</span>
                <h2 className="text-yellow-500 font-black uppercase italic text-sm tracking-tighter shrink-0">
                  #{String(processingOrder.id).slice(-6)}
                </h2>
                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full shrink-0">
                  {processingOrder.requested_by}
                </span>
              </div>
              <button
                onClick={() => { setProcessingOrder(null); setRejecting(false); }}
                className="p-2 bg-zinc-900 rounded-full text-zinc-500 hover:text-white shrink-0 ml-2"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex justify-center mb-6">
              <div className={`p-6 rounded-full ${
                processingOrder.method === "Momo-MTN"    ? "bg-purple-500/10 text-purple-400" :
                processingOrder.method === "Momo-Airtel" ? "bg-purple-500/10 text-purple-400" :
                processingOrder.method === "Card"        ? "bg-blue-500/10 text-blue-400"     :
                processingOrder.method === "Credit"      ? "bg-purple-500/10 text-purple-400" :
                                                           "bg-emerald-500/10 text-emerald-400"}`}>
                {processingOrder.method === "Cash"   ? <Banknote size={40} />   :
                 processingOrder.method === "Card"   ? <CreditCard size={40} /> :
                 processingOrder.method === "Credit" ? <BookOpen size={40} />   :
                 <Smartphone size={40} />}
              </div>
            </div>

            <div className="text-center mb-2">
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                processingOrder.method === "Cash"        ? "bg-emerald-500/10 text-emerald-400"   :
                processingOrder.method === "Card"        ? "bg-blue-500/10 text-blue-400"     :
                processingOrder.method === "Momo-MTN"    ? "bg-purple-500/10 text-purple-400" :
                processingOrder.method === "Momo-Airtel" ? "bg-purple-500/10 text-purple-400" :
                "bg-purple-500/10 text-purple-400"}`}>
                {processingOrder.method === "Momo-MTN" ? "MTN" : processingOrder.method === "Momo-Airtel" ? "Airtel" : processingOrder.method}
              </span>
            </div>

            <h3 className="text-2xl font-black text-white text-center uppercase italic mb-2 tracking-tighter">
              {isCredit ? "Forward Credit to Manager" : "Confirm Receipt"}
            </h3>

            <div className="bg-black border border-white/5 rounded-3xl p-6 mb-6 text-center">
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] block mb-2">
                {processingOrder.label || "Amount Due"}
              </span>
              <span className="text-3xl font-black text-white italic tracking-tighter break-words">
                {formatCurrencyCompact(processingOrder.amount)}
              </span>
            </div>

            {isCredit && (
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-3xl p-5 mb-6 space-y-2">
                <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-3">Client Info</p>
                <div className="flex items-center gap-2">
                  <User size={12} className="text-zinc-500 shrink-0" />
                  <span className="text-sm font-black text-white truncate">{processingOrder.credit_name || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-zinc-500 shrink-0" />
                  <span className="text-sm text-zinc-300 truncate">{processingOrder.credit_phone || "—"}</span>
                </div>
                {processingOrder.credit_pay_by && (
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-zinc-500 shrink-0" />
                    <span className="text-sm text-zinc-300 truncate">{processingOrder.credit_pay_by}</span>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-purple-500/10 bg-purple-500/5 rounded-xl p-3">
                  <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest text-center">
                    Manager approval required · Forwarding creates a credit record in the ledger
                  </p>
                </div>
              </div>
            )}

            {isMomoProcessing && !rejecting && (
              <div className="mb-6">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                  {processingOrder.method === "Momo-MTN" ? "MTN" : "Airtel"} Transaction ID
                  <span className="text-red-400 ml-1">*</span>
                </p>
                <input
                  autoFocus
                  type="text"
                  placeholder="ENTER TRANSACTION ID"
                  className="w-full bg-black border border-purple-500/30 p-5 rounded-2xl text-white font-black outline-none focus:border-purple-500 text-center uppercase tracking-widest text-sm"
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
                className="w-full bg-black border border-red-500/20 p-4 rounded-2xl text-white font-bold outline-none resize-none h-20 mb-6"
              />
            )}

            {!rejecting ? (
              <div className="flex flex-col gap-3">
                {isCredit ? (
                  <>
                    <button
                      onClick={() => handleForwardCredit(processingOrder)}
                      disabled={requestingApproval}
                      className="w-full py-5 bg-purple-500 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-purple-400 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {requestingApproval ? "Forwarding…" : <><Send size={14} /> Forward to Manager</>}
                    </button>
                    <button
                      onClick={() => setActiveSection("CREDITS")}
                      className="w-full py-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2"
                    >
                      <BookOpen size={13} /> View Credit Ledger
                    </button>
                    <button
                      onClick={() => setRejecting(true)}
                      className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2"
                    >
                      <XCircle size={13} /> Reject Credit Request
                    </button>
                    <button onClick={() => setProcessingOrder(null)} className="w-full py-3 text-zinc-600 font-black uppercase text-[10px]">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex gap-3">
                      <button onClick={() => setProcessingOrder(null)} className="flex-1 py-4 text-zinc-600 font-black uppercase text-[10px]">
                        Cancel
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="flex-1 py-4 border border-white/10 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2"
                      >
                        <Printer size={14} /> Print
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setRejecting(true)}
                        className="flex-1 py-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                      <button
                        onClick={handleFinalConfirm}
                        disabled={!canConfirm || confirming}
                        className={`flex-[2] py-5 rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2
                          ${canConfirm && !confirming
                            ? "bg-yellow-500 text-black shadow-xl shadow-yellow-500/20 hover:bg-yellow-400 active:scale-[0.98]"
                            : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}
                      >
                        {confirming ? "Processing..." : "Finalize Settlement"}
                      </button>
                    </div>
                    <button
                      onClick={() => { setProcessingOrder(null); setDeliveryOrder(processingOrder); }}
                      className="w-full py-3 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 hover:bg-orange-500/20 transition-all"
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
                  className="flex-1 py-4 border border-white/10 text-zinc-400 rounded-2xl font-black uppercase text-[10px]"
                >
                  Back
                </button>
                <button
                  onClick={handleReject}
                  disabled={confirming}
                  className="flex-[2] py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-red-400 transition-all disabled:opacity-50"
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
            cash: todayTotals.cash,
            momo: totalMobileMoney,
            mtn: todayTotals.momo_mtn,
            airtel: todayTotals.momo_airtel,
            card: todayTotals.card,
            petty: pettyCashOutTotal,
            net: netCashAfterPetty,
            credit: todayTotals.credit,
            gross: todayTotals.gross,
          }}
          onClose={() => setShowShiftSummary(false)}
          onFinalize={handleFinalizeShift}
          isFinalizing={isFinalizing}
        />
      )}

      {deliveryOrder && (
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

// ─── LIVE ORDER CARD (Updated with compact currency) ──────────────────────────
function LiveOrderCard({ order, onConfirm, onDelivery }) {
  const isCredit = order.method === "Credit";
  return (
    <div className={`border rounded-[2.5rem] p-4 sm:p-6 transition-all
      ${isCredit
        ? "bg-purple-500/[0.03] border-purple-500/20 hover:border-purple-500/40"
        : "bg-zinc-900/40 border-white/5 hover:border-yellow-500/20"}`}>
      <div className="flex justify-between items-start mb-4 gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">
              {order.table_name}
            </span>
            {isCredit && (
              <span className="text-[8px] bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded-lg font-black uppercase">
                Credit
              </span>
            )}
          </div>
          <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tighter truncate">
            {order.label || `Order #${order.id}`}
          </h3>
          <p className="text-zinc-500 text-[10px] font-bold uppercase mt-1 truncate">
            {order.requested_by} · {timeAgo(order.created_at)}
            {isCredit && order.credit_name && ` · ${order.credit_name}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isCredit ? "text-purple-400" : "text-zinc-500"}`}>
            {order.method === "Momo-MTN" ? "MTN" : order.method === "Momo-Airtel" ? "Airtel" : order.method}
          </p>
          <p className="text-base sm:text-xl font-black text-white italic tracking-tighter whitespace-nowrap">
            {formatCurrencyCompact(order.amount)}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {isCredit ? (
          <>
            <button
              onClick={onConfirm}
              className="flex-1 py-3 bg-purple-500 text-white font-black text-[10px] uppercase rounded-xl hover:bg-purple-400 transition-all flex items-center justify-center gap-2"
            >
              <Send size={13} /> Forward to Manager
            </button>
            <button
              onClick={onDelivery}
              title="Assign Delivery Rider"
              className="p-3 bg-zinc-800 border border-white/5 text-zinc-400 rounded-xl hover:bg-orange-500/20 hover:text-orange-400 hover:border-orange-500/30 transition-all shrink-0"
            >
              <Bike size={16} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onConfirm}
              className="flex-1 py-3 bg-white text-black font-black text-[10px] uppercase rounded-xl hover:bg-yellow-500 transition-all"
            >
              Process Payment
            </button>
            <button
              onClick={onDelivery}
              title="Assign Delivery Rider"
              className="p-3 bg-zinc-800 border border-white/5 text-zinc-400 rounded-xl hover:bg-orange-500/20 hover:text-orange-400 hover:border-orange-500/30 transition-all shrink-0"
            >
              <Bike size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── FORWARDED CREDIT CARD ────────────────────────────────────────────────────
function ForwardedCreditCard({ order }) {
  return (
    <div className="bg-purple-500/5 border border-purple-500/20 rounded-[2.5rem] p-5 flex items-center justify-between gap-4 flex-wrap opacity-70">
      <div className="flex items-center gap-4 min-w-0">
        <div className="p-4 rounded-2xl bg-black border border-purple-500/20 text-purple-400 shrink-0">
          <BookOpen size={20} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-black text-white italic uppercase text-sm truncate">{order.table_name}</span>
            <span className="text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded-lg font-black uppercase">Credit</span>
            {order.credit_name && <span className="text-[9px] text-zinc-500 font-bold truncate">{order.credit_name}</span>}
          </div>
          <p className="text-[10px] text-zinc-600 font-bold uppercase">
            Forwarded by {order.confirmed_by} · {timeAgo(order.created_at)}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xl font-black text-purple-400 italic whitespace-nowrap">{formatCurrencyCompact(order.amount)}</p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <Clock size={9} className="text-purple-400 animate-pulse" />
          <span className="text-[9px] text-purple-400 font-black uppercase tracking-widest whitespace-nowrap">Pending Manager</span>
        </div>
      </div>
    </div>
  );
}

// ─── HISTORY CARD (Updated with compact currency) ─────────────────────────────
function HistoryCard({ item }) {
  const { color, icon } = methodStyle(item.method);
  const isPartiallySettled = item.status === "PartiallySettled";
  const isConfirmed = item.status === "Confirmed";
  
  const displayAmount = isPartiallySettled && item.paid_amount 
    ? `${formatCurrencyCompact(item.paid_amount)} / ${formatCurrencyCompact(item.amount)}`
    : formatCurrencyCompact(item.amount);
  
  const statusColor = isPartiallySettled 
    ? "text-yellow-400" 
    : isConfirmed 
    ? "text-emerald-400" 
    : "text-red-400";
  
  const statusIcon = isPartiallySettled 
    ? <AlertTriangle size={10} className="text-yellow-400" />
    : isConfirmed 
    ? <CheckCircle size={10} className="text-emerald-400" />
    : <XCircle size={10} className="text-red-400" />;
  
  const statusText = isPartiallySettled 
    ? "Partial" 
    : isConfirmed 
    ? "Confirmed" 
    : item.status;

  return (
    <div className={`bg-zinc-900/20 border p-5 sm:p-6 rounded-[2.5rem] flex items-center justify-between gap-4 flex-wrap hover:bg-zinc-900/40 transition-all
      ${isPartiallySettled ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-white/5'}`}>
      <div className="flex items-center gap-4 min-w-0">
        <div className={`p-4 rounded-2xl bg-black border ${isPartiallySettled ? 'border-yellow-500/30' : 'border-white/5'} shadow-inner ${color} shrink-0`}>
          {React.cloneElement(icon, { size: 20 })}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-black text-white italic uppercase tracking-tighter truncate">{item.table_name}</h4>
            <span className="text-zinc-700 shrink-0">•</span>
            <span className={`text-[9px] font-black uppercase ${color}`}>
              {item.method === "Momo-MTN" ? "MTN" : item.method === "Momo-Airtel" ? "Airtel" : item.method}
            </span>
            {item.order_type === "delivery" && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[9px] font-black uppercase">
                <Bike size={9} /> Delivery
              </span>
            )}
            {isPartiallySettled && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[9px] font-black uppercase">
                <AlertTriangle size={9} /> Partial Payment
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase truncate">
            {item.label} · {item.requested_by} · {timeAgo(item.confirmed_at || item.created_at)}
          </p>
          {item.transaction_id && (
            <p className="text-[9px] text-zinc-600 font-mono mt-0.5 truncate">TXN: {item.transaction_id}</p>
          )}
          {isPartiallySettled && item.remaining_amount > 0 && (
            <p className="text-[9px] text-yellow-500/70 font-mono mt-0.5">
              Remaining: {formatCurrencyCompact(item.remaining_amount)}
            </p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-center gap-2 justify-end">
          <p className={`text-base sm:text-xl font-black italic tracking-tighter ${color} whitespace-nowrap`}>
            {displayAmount}
          </p>
        </div>
        <div className="flex items-center justify-end gap-1 mt-1">
          {statusIcon}
          <span className={`text-[8px] font-black uppercase tracking-widest ${statusColor}`}>
            {statusText}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── SHIFT SUMMARY MODAL ──────────────────────────────────────────────────────
function ShiftSummaryModal({ data, onClose, onFinalize, isFinalizing }) {
  if (!data) return null;
  return (
    <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#0c0c0c] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <div className="w-12 h-1 text-yellow-500 bg-yellow-500 mx-auto rounded-full mb-4 opacity-50" />
          <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Shift Review</h2>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Verify totals before closing</p>
        </div>
        <div className="space-y-4 mb-8">
          <SummaryRow label="Total Cash" value={formatCurrencyCompact(data.cash)} />
          <SummaryRow label="Mobile Money" value={formatCurrencyCompact(data.momo)} />
          <SummaryRow label="Card Payments" value={formatCurrencyCompact(data.card)} />
          <SummaryRow label="Petty Cash" value={`-${formatCurrencyCompact(data.petty)}`} color="text-rose-500" />
          <div className="pt-4 mt-4 border-t border-white/5">
            <div className="bg-yellow-500 p-5 rounded-2xl border border-yellow-400 shadow-xl shadow-yellow-500/10">
              <p className="text-[9px] font-black text-black/60 uppercase tracking-widest mb-1">Handover Balance (Cash)</p>
              <p className="text-2xl font-black text-black italic tracking-tighter break-words">{formatCurrencyCompact(data.net)}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={onFinalize}
            disabled={isFinalizing}
            className={`w-full py-5 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3 transition-all
              ${isFinalizing ? "bg-zinc-800 text-zinc-600" : "bg-red-600 text-white hover:bg-red-500 active:scale-95 shadow-lg shadow-red-600/20"}`}
          >
            {isFinalizing
              ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /><span>Finalizing…</span></>
              : "Finalize & Clear Totals"
            }
          </button>
          <button onClick={onClose} disabled={isFinalizing} className="w-full py-2 text-zinc-600 font-bold uppercase text-[10px] tracking-widest hover:text-zinc-400">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color = "text-white" }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</span>
      <span className={`text-sm font-black italic ${color} break-words text-right`}>{value}</span>
    </div>
  );
}

// ─── RECEIPT MODAL ────────────────────────────────────────────────────────────
function ReceiptModal({ data, onClose }) {
  return (
    <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white text-black w-full max-w-sm rounded-[3rem] p-12 font-mono shadow-2xl relative overflow-hidden">
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
          <button onClick={() => window.print()} className="w-full py-4 bg-black text-white font-black rounded-2xl uppercase italic text-sm flex items-center justify-center gap-3">
            <Printer size={18} /> Print Voucher
          </button>
          <button onClick={onClose} className="w-full py-4 text-zinc-400 font-bold uppercase text-[10px]">Close Window</button>
        </div>
      </div>
    </div>
  );
}