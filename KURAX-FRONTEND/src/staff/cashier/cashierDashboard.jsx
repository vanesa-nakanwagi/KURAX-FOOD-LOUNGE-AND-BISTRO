// ─── CashierDashboard.jsx (CORRECTED - Cash on Counter NOT reduced by petty) ────────────────

import React, { useState, useMemo, useEffect, useCallback } from "react";
import SideBar from "./SideBar";
import {
  Menu, Banknote, Smartphone, CreditCard, X, Wallet,
  Trash2, PlusCircle, ShieldCheck, Printer, ArrowRightLeft,
  BookOpen, User, Phone, Calendar, RefreshCw, Clock,
  CheckCircle, XCircle, AlertTriangle, TrendingUp, Send, CheckCircle2,
  Bike, CircleDollarSign
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
    case "Cash":        return { color: "text-green-500",  icon: <Banknote size={24} /> };
    case "Card":        return { color: "text-purple-500", icon: <CreditCard size={24} /> };
    case "Momo-MTN":    return { color: "text-yellow-500", icon: <Smartphone size={24} /> };
    case "Momo-Airtel": return { color: "text-red-500",    icon: <Smartphone size={24} /> };
    case "Credit":      return { color: "text-purple-400", icon: <BookOpen size={24} /> };
    default:            return { color: "text-zinc-400",   icon: <Banknote size={24} /> };
  }
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function CashierDashboard() {

  const loggedInUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}"); }
    catch { return {}; }
  }, []);
  const cashierName = loggedInUser?.name || "Cashier";

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeSection,      setActiveSection]      = useState("PENDING");
  const [orderStatusFilter,  setOrderStatusFilter]  = useState("CLOSED");
  const [isSidebarOpen,      setIsSidebarOpen]      = useState(false);
  const [showShiftSummary,   setShowShiftSummary]   = useState(false);
  const [showReceipt,        setShowReceipt]        = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);

  // ── Payment modal state ─────────────────────────────────────────────────────
  const [processingOrder,    setProcessingOrder]    = useState(null);
  const [momoTransactionId,  setMomoTransactionId]  = useState("");
  const [rejecting,          setRejecting]          = useState(false);
  const [rejectNote,         setRejectNote]         = useState("");
  const [confirming,         setConfirming]         = useState(false);
  const [animatingIds,       setAnimatingIds]       = useState([]);
  const [requestingApproval, setRequestingApproval] = useState(false);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [liveQueue,      setLiveQueue]      = useState([]);
  const [credits,        setCredits]        = useState([]);
  const [history,        setHistory]        = useState([]);
  const [qLoading,       setQLoading]       = useState(true);
  const [pettyCashTotal, setPettyCashTotal] = useState(0);

  // ── Delivery state ──────────────────────────────────────────────────────────
  const [deliveryOrder,      setDeliveryOrder]      = useState(null);
  const [deliveryRefreshKey, setDeliveryRefreshKey] = useState(0);
  const [deliveryBadge,      setDeliveryBadge]      = useState(0);

  const [isFinalizing, setIsFinalizing] = useState(false);

  // ── Today date ──────────────────────────────────────────────────────────────
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

  // ── TODAY TOTALS (FIXED - No double counting) ────────────────────────────────────────────
const todayTotals = useMemo(() => {
  const base = { cash: 0, card: 0, momo_mtn: 0, momo_airtel: 0, credit: 0, gross: 0 };

  // 1. Process ONLY confirmed payments from history (non-credit payments)
  history.forEach(row => {
    const confirmedOn = toLocalDateStr(new Date(row.confirmed_at || row.created_at));
    if (row.status !== "Confirmed" || confirmedOn !== today) return;
    
    // Skip credit payments from history because they will be counted in settlements
    if (row.method === "Credit") return;
    
    const amt = Number(row.amount) || 0;
    switch (row.method) {
      case "Cash":        base.cash += amt; base.gross += amt; break;
      case "Card":        base.card += amt; base.gross += amt; break;
      case "Momo-MTN":    base.momo_mtn += amt; base.gross += amt; break;
      case "Momo-Airtel": base.momo_airtel += amt; base.gross += amt; break;
      default: break;
    }
  });

  // 2. Process ONLY credit settlements (when client pays back the credit)
  credits.forEach(c => {
    const settlements = Array.isArray(c.settlements) ? c.settlements : [];
    settlements.forEach(s => {
      const settledDate = toLocalDateStr(new Date(s.created_at));
      if (settledDate !== today) return;
      const amt = Number(s.amount_paid || 0);
      if (amt <= 0) return;
      
      switch (s.method) {
        case "Cash":        
          base.cash += amt; 
          base.gross += amt; 
          break;
        case "Card":        
          base.card += amt; 
          base.gross += amt; 
          break;
        case "Momo-MTN":    
          base.momo_mtn += amt; 
          base.gross += amt; 
          break;
        case "Momo-Airtel": 
          base.momo_airtel += amt; 
          base.gross += amt; 
          break;
        default:            
          base.gross += amt; 
          break;
      }
    });
  });

  return base;
}, [history, credits, today]);

  // FIXED: Cash on Counter = Gross cash collected (NOT reduced by petty expenses)
  const cashOnCounter = todayTotals.cash;
  
  // Net cash after petty (for shift handover calculation only)
  const netCashAfterPetty = todayTotals.cash - pettyCashTotal;

  const creditNeedsAction = useMemo(
    () => credits.filter(c => c.status === "PendingCashier").length,
    [credits]
  );
  const creditPendingMgr = useMemo(
    () => credits.filter(c => c.status === "PendingManagerApproval").length,
    [credits]
  );

  // ── Data fetching ───────────────────────────────────────────────────────────
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
          id:             o.id,
          table_name:     o.table_name,
          label:          o.label || `Order #${o.id}`,
          requested_by:   o.requested_by || o.waiter_name || "Waiter",
          method:         o.method || "Cash",
          amount:         Number(o.amount) || 0,
          status:         o.status || "Pending",
          created_at:     o.created_at,
          age_minutes:    Math.floor((Date.now() - new Date(o.created_at)) / 60000),
          credit_name:    o.credit_name,
          credit_phone:   o.credit_phone,
          credit_pay_by:  o.credit_pay_by,
          is_item:        o.is_item,
        })));
      }
      if (cRes.ok) setCredits(await cRes.json());
      if (hRes.ok) setHistory(await hRes.json());
      if (pRes.ok) {
        const summary = await pRes.json();
        setPettyCashTotal(Number(summary.total_out) || 0);
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

  // ── Delivery badge ──────────────────────────────────────────────────────────
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
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [deliveryRefreshKey]);

  // ── Payment modal handlers ──────────────────────────────────────────────────
  const openModal = (order) => {
    setProcessingOrder(order);
    setMomoTransactionId("");
    setRejecting(false);
    setRejectNote("");
  };

  const handleFinalConfirm = async () => {
    const order  = processingOrder;
    const isMomo = order.method === "Momo-MTN" || order.method === "Momo-Airtel";
    if (isMomo && !momoTransactionId.trim()) return;
    setConfirming(true);
    setAnimatingIds(prev => [...prev, order.id]);
    try {
      const res = await fetch(`${API_URL}/api/cashier-ops/cashier-queue/${order.id}/confirm`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          confirmed_by:   cashierName,
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

  // ─── Forward Credit using the correct backend endpoint ─────────────────────
  const handleForwardCredit = async (order) => {
    setRequestingApproval(true);
    try {
      const res = await fetch(`${API_URL}/api/cashier-ops/cashier-queue/${order.id}/request-approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_by: cashierName,
        }),
      });

      if (res.ok) {
        await fetchAll();
        setProcessingOrder(null);
        setRequestingApproval(false);
        alert("Credit request forwarded to manager for approval.");
        return;
      }

      const error = await res.json();
      console.error("Forward failed:", error);
      
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
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reason: rejectNote || "Rejected by cashier" }),
      });
      await fetchAll();
    } catch (e) { console.error("Reject failed:", e); }
    setConfirming(false);
    setProcessingOrder(null);
    setRejecting(false);
    setRejectNote("");
  };

  // ── Shift finalization ──────────────────────────────────────────────────────
  const handleFinalizeShift = async () => {
    const confirmEnd = window.confirm("Are you sure you want to finalize this shift?");
    if (!confirmEnd) return;
    setIsFinalizing(true);
    const payload = {
      waiter_id:        loggedInUser?.id,
      waiter_name:      loggedInUser?.name,
      role:             loggedInUser?.role,
      total_cash:       todayTotals.cash,
      total_mtn:        todayTotals.momo_mtn,
      total_airtel:     todayTotals.momo_airtel,
      total_card:       todayTotals.card,
      gross_total:      todayTotals.gross,
      petty_cash_spent: pettyCashTotal,
    };
    try {
      const res = await fetch(`${API_URL}/api/waiter/end-shift`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      if (res.ok) { alert("Shift Finalized."); window.location.reload(); }
      else alert("Failed to finalize shift.");
    } catch { alert("A connection error occurred."); }
    setIsFinalizing(false);
  };

  // ── Derived lists ───────────────────────────────────────────────────────────
  const normalQueue    = liveQueue.filter(r => r.status === "Pending");
  const forwardedQueue = liveQueue.filter(r => r.status === "PendingManagerApproval");

  const closedHistory = history.filter(h => {
    if (orderStatusFilter === "CLOSED")  return h.status === "Confirmed";
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
  const isCredit         = processingOrder?.method === "Credit";
  const canConfirm       = !isMomoProcessing || momoTransactionId.trim().length > 0;

  // ── RENDER ──────────────────────────────────────────────────────────────────
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
          momo: todayTotals.momo_mtn + todayTotals.momo_airtel,
          card: todayTotals.card,
        }}
        deliveryBadge={deliveryBadge}
        creditBadge={creditNeedsAction + creditPendingMgr}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ── HEADER ── */}
        <header className="flex items-center justify-between px-6 py-4 bg-[#0c0c0c] border-b border-white/5 sticky top-0 z-50">
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
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-yellow-500/80">Cashier Overview</h4>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Welcome back, <span className="text-yellow-400 capitalize">{cashierName}</span>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {normalQueue.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500 rounded-xl animate-pulse">
                <AlertTriangle size={13} className="text-black" />
                <span className="text-[10px] font-black text-black uppercase tracking-widest">
                  {normalQueue.length} Pending
                </span>
              </div>
            )}
            {creditNeedsAction > 0 && (
              <button
                onClick={() => setActiveSection("CREDITS")}
                className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 border border-orange-500/30 rounded-xl hover:bg-orange-500/30 transition-all animate-pulse"
              >
                <BookOpen size={13} className="text-orange-400" />
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">
                  {creditNeedsAction} Credit{creditNeedsAction > 1 ? "s" : ""} Need Action
                </span>
              </button>
            )}
            {creditPendingMgr > 0 && (
              <button
                onClick={() => setActiveSection("CREDITS")}
                className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-xl hover:bg-purple-500/30 transition-all"
              >
                <Clock size={13} className="text-purple-400" />
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
                  {creditPendingMgr} Awaiting Mgr
                </span>
              </button>
            )}
            {deliveryBadge > 0 && (
              <button
                onClick={() => setActiveSection("DELIVERIES")}
                className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 border border-orange-500/30 rounded-xl hover:bg-orange-500/30 transition-all"
              >
                <Bike size={13} className="text-orange-400" />
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">
                  {deliveryBadge} Delivery
                </span>
              </button>
            )}
            <button onClick={fetchAll} className="p-2 bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-all">
              <RefreshCw size={16} className={qLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-10">

          {activeSection === "CLOSED" && (
            <div className="mb-10 flex gap-6 border-b border-white/5">
              {["PENDING", "DELAYED", "CLOSED"].map(s => (
                <button
                  key={s}
                  onClick={() => setOrderStatusFilter(s)}
                  className={`pb-2 text-[11px] font-black uppercase tracking-widest relative transition-colors
                    ${orderStatusFilter === s ? "text-yellow-500" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  {s}
                  {orderStatusFilter === s && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500" />}
                </button>
              ))}
            </div>
          )}

          {/* ── PENDING SECTION ── */}
          {activeSection === "PENDING" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
              <div>
                <h2 className="text-xl font-black text-white uppercase leading-none">My Live Collection</h2>
                <p className="text-yellow-600 text-[14px] font-medium mt-1 italic tracking-tight">
                  Track your daily cash, card and mobile money collection
                </p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <HeaderStat icon={<Banknote size={18} />}   label="Cash on Counter" value={cashOnCounter} color="text-green-500" />
                <HeaderStat icon={<CreditCard size={18} />} label="Card Revenue"    value={todayTotals.card}        color="text-purple-500" />
                <HeaderStat icon={<Smartphone size={18} />} label="MTN Momo"        value={todayTotals.momo_mtn}    color="text-yellow-500" />
                <HeaderStat icon={<Smartphone size={18} />} label="Airtel Momo"     value={todayTotals.momo_airtel} color="text-red-500" />
                <HeaderStat icon={<Wallet size={18} />}     label="Petty Expenses"  value={pettyCashTotal}          color="text-rose-500" />
                <div className="bg-yellow-500 p-5 rounded-[2rem] border border-yellow-400 flex flex-col gap-2 col-span-2 md:col-span-1">
                  <div className="p-2.5 w-fit rounded-xl bg-black/20 text-black"><TrendingUp size={18} /></div>
                  <div>
                    <p className="text-[8px] font-black uppercase text-black/60 tracking-[0.2em] mb-1">Gross Revenue</p>
                    <h3 className="text-xl font-black text-black italic tracking-tighter">
                      <span className="text-[9px] mr-1 opacity-50 not-italic">UGX</span>
                      {todayTotals.gross.toLocaleString()}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Live queue */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Live Payment Queue</h3>
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

              {/* Credit quick-access banner */}
              {(creditNeedsAction > 0 || creditPendingMgr > 0) && (
                <button
                  onClick={() => setActiveSection("CREDITS")}
                  className="w-full p-5 bg-purple-500/5 border border-purple-500/20 rounded-[2.5rem] flex items-center gap-4 hover:bg-purple-500/10 transition-all text-left group"
                >
                  <div className="p-4 rounded-2xl bg-black border border-purple-500/20 text-purple-400">
                    <BookOpen size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-white uppercase tracking-tighter text-sm">Credit Ledger</p>
                    <p className="text-[10px] text-zinc-500 font-bold mt-0.5">
                      {creditNeedsAction > 0 && `${creditNeedsAction} credit${creditNeedsAction > 1 ? "s" : ""} need forwarding to manager · `}
                      {creditPendingMgr > 0 && `${creditPendingMgr} awaiting manager approval`}
                    </p>
                  </div>
                  <ArrowRightLeft size={16} className="text-zinc-600 group-hover:text-purple-400 transition-colors" />
                </button>
              )}

              {/* Forwarded queue */}
              {forwardedQueue.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Awaiting Manager Approval</h3>
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

          {/* ── CREDITS SECTION ── */}
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

          {/* ── DELIVERIES SECTION ── */}
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
                        <div>
                          <p className="text-sm font-black text-white uppercase italic">{order.table_name || `Order #${order.id}`}</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase mt-0.5">
                            {order.requested_by} · UGX {Number(order.amount || 0).toLocaleString()} · {timeAgo(order.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => setDeliveryOrder(order)}
                          className="flex items-center gap-2 px-5 py-3 bg-orange-500 text-black font-black text-[10px] uppercase rounded-xl hover:bg-orange-400 active:scale-[0.98] transition-all shadow-lg shadow-orange-500/20"
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

          {/* ── PETTY CASH SECTION ── */}
          {activeSection === "PETTY CASH" && (
            <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-500">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase">Petty Cash</h2>
                  <p className="text-yellow-600 text-[14px] font-medium mt-1 italic tracking-tight">Track your daily expenses</p>
                </div>
                <div className="px-6 py-4 bg-zinc-900/50 border border-white/5 rounded-[2rem] flex items-center gap-4">
                  <div className="p-3 bg-rose-500/20 rounded-xl text-rose-500"><Wallet size={18} /></div>
                  <div>
                    <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest leading-none mb-1.5">Shift Outflow</p>
                    <p className="text-lg font-black text-white italic">UGX {pettyCashTotal.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <PettyCashPanel
                role="CASHIER"
                staffName={cashierName}
                grossCash={todayTotals.cash}
                theme="dark"
                onTotalChange={(val) => setPettyCashTotal(val)}
              />
            </div>
          )}

          {/* ── CLOSED / HISTORY SECTION ── */}
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

      {/* ── PAYMENT PROCESSING MODAL ── */}
      {processingOrder && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-[3rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-white font-black uppercase italic text-sm tracking-tighter">
                  {processingOrder.table_name || "TABLE"}
                </h2>
                <span className="text-zinc-700 font-black">•</span>
                <h2 className="text-yellow-500 font-black uppercase italic text-sm tracking-tighter">
                  #{String(processingOrder.id).slice(-6)}
                </h2>
                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full">
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
                processingOrder.method === "Momo-MTN"    ? "bg-yellow-500/10 text-yellow-500" :
                processingOrder.method === "Momo-Airtel" ? "bg-red-500/10 text-red-500" :
                processingOrder.method === "Card"        ? "bg-blue-500/10 text-blue-400" :
                processingOrder.method === "Credit"      ? "bg-purple-500/10 text-purple-400" :
                                                           "bg-green-500/10 text-green-500"}`}
              >
                {processingOrder.method === "Cash"   ? <Banknote size={40} /> :
                 processingOrder.method === "Card"   ? <CreditCard size={40} /> :
                 processingOrder.method === "Credit" ? <BookOpen size={40} /> :
                 <Smartphone size={40} />}
              </div>
            </div>

            <div className="text-center mb-2">
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                processingOrder.method === "Cash"        ? "bg-green-500/10 text-green-400" :
                processingOrder.method === "Card"        ? "bg-blue-500/10 text-blue-400" :
                processingOrder.method === "Momo-MTN"    ? "bg-yellow-500/10 text-yellow-400" :
                processingOrder.method === "Momo-Airtel" ? "bg-red-500/10 text-red-400" :
                "bg-purple-500/10 text-purple-400"}`}
              >
                {processingOrder.method}
              </span>
            </div>

            <h3 className="text-2xl font-black text-white text-center uppercase italic mb-2 tracking-tighter">
              {isCredit ? "Forward Credit to Manager" : "Confirm Receipt"}
            </h3>

            <div className="bg-black border border-white/5 rounded-3xl p-6 mb-6 text-center">
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] block mb-2">
                {processingOrder.label || "Amount Due"}
              </span>
              <span className="text-3xl font-black text-white italic tracking-tighter">
                UGX {Number(processingOrder.amount).toLocaleString()}
              </span>
            </div>

            {/* Credit info panel */}
            {isCredit && (
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-3xl p-5 mb-6 space-y-2">
                <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-3">Client Info</p>
                <div className="flex items-center gap-2">
                  <User size={12} className="text-zinc-500" />
                  <span className="text-sm font-black text-white">{processingOrder.credit_name || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-zinc-500" />
                  <span className="text-sm text-zinc-300">{processingOrder.credit_phone || "—"}</span>
                </div>
                {processingOrder.credit_pay_by && (
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-zinc-500" />
                    <span className="text-sm text-zinc-300">{processingOrder.credit_pay_by}</span>
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
                  className="w-full bg-black border border-yellow-500/30 p-5 rounded-2xl text-white font-black outline-none focus:border-yellow-500 text-center uppercase tracking-widest text-sm"
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
                      {requestingApproval
                        ? "Forwarding…"
                        : <><Send size={14} /> Forward to Manager</>
                      }
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
            cash:   todayTotals.cash,
            momo:   todayTotals.momo_mtn + todayTotals.momo_airtel,
            mtn:    todayTotals.momo_mtn,
            airtel: todayTotals.momo_airtel,
            card:   todayTotals.card,
            petty:  pettyCashTotal,
            net:    netCashAfterPetty,  // Net after petty for handover
            credit: todayTotals.credit,
            gross:  todayTotals.gross,
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

// ─── LIVE ORDER CARD ──────────────────────────────────────────────────────────
function LiveOrderCard({ order, onConfirm, onDelivery }) {
  const isCredit = order.method === "Credit";
  return (
    <div className={`border rounded-[2.5rem] p-6 transition-all
      ${isCredit
        ? "bg-purple-500/[0.03] border-purple-500/20 hover:border-purple-500/40"
        : "bg-zinc-900/40 border-white/5 hover:border-yellow-500/20"}`}
    >
      <div className="flex justify-between items-start mb-4">
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
          <h3 className="text-lg font-black text-white uppercase tracking-tighter truncate">
            {order.label || `Order #${order.id}`}
          </h3>
          <p className="text-zinc-500 text-[10px] font-bold uppercase mt-1">
            {order.requested_by} · {timeAgo(order.created_at)}
            {isCredit && order.credit_name && ` · ${order.credit_name}`}
          </p>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isCredit ? "text-purple-400" : "text-zinc-500"}`}>
            {order.method}
          </p>
          <p className="text-xl font-black text-white italic tracking-tighter">
            {Number(order.amount).toLocaleString()} <span className="text-[10px] not-italic text-zinc-500">UGX</span>
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
              className="p-3 bg-zinc-800 border border-white/5 text-zinc-400 rounded-xl hover:bg-orange-500/20 hover:text-orange-400 hover:border-orange-500/30 transition-all"
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
              className="p-3 bg-zinc-800 border border-white/5 text-zinc-400 rounded-xl hover:bg-orange-500/20 hover:text-orange-400 hover:border-orange-500/30 transition-all"
            >
              <Bike size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── FORWARDED CREDIT CARD ───────────────────────────────────────────────────
function ForwardedCreditCard({ order }) {
  return (
    <div className="bg-purple-500/5 border border-purple-500/20 rounded-[2.5rem] p-5 flex items-center justify-between gap-4 flex-wrap opacity-70">
      <div className="flex items-center gap-4">
        <div className="p-4 rounded-2xl bg-black border border-purple-500/20 text-purple-400">
          <BookOpen size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-black text-white italic uppercase text-sm">{order.table_name}</span>
            <span className="text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded-lg font-black uppercase">Credit</span>
            {order.credit_name && <span className="text-[9px] text-zinc-500 font-bold">{order.credit_name}</span>}
          </div>
          <p className="text-[10px] text-zinc-600 font-bold uppercase">
            Forwarded by {order.confirmed_by} · {timeAgo(order.created_at)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xl font-black text-purple-400 italic">UGX {Number(order.amount).toLocaleString()}</p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <Clock size={9} className="text-purple-400 animate-pulse" />
          <span className="text-[9px] text-purple-400 font-black uppercase tracking-widest">Pending Manager</span>
        </div>
      </div>
    </div>
  );
}

// ─── HISTORY CARD ─────────────────────────────────────────────────────────────
function HistoryCard({ item }) {
  const { color, icon } = methodStyle(item.method);
  return (
    <div className="bg-zinc-900/20 border border-white/5 p-6 rounded-[2.5rem] flex items-center justify-between gap-4 flex-wrap hover:bg-zinc-900/40 transition-all">
      <div className="flex items-center gap-4 min-w-0">
        <div className={`p-4 rounded-2xl bg-black border border-white/5 shadow-inner ${color}`}>
          {React.cloneElement(icon, { size: 20 })}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-black text-white italic uppercase tracking-tighter">{item.table_name}</h4>
            <span className="text-zinc-700">•</span>
            <span className={`text-[9px] font-black uppercase ${color}`}>{item.method}</span>
            {item.order_type === "delivery" && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[9px] font-black uppercase">
                <Bike size={9} /> Delivery
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase">
            {item.label} · {item.requested_by} · {timeAgo(item.confirmed_at || item.created_at)}
          </p>
          {item.transaction_id && (
            <p className="text-[9px] text-zinc-600 font-mono mt-0.5">TXN: {item.transaction_id}</p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-xl font-black italic tracking-tighter ${color}`}>
          UGX {Number(item.amount).toLocaleString()}
        </p>
        <span className={`text-[8px] font-black uppercase tracking-widest ${item.status === "Confirmed" ? "text-emerald-400" : "text-red-400"}`}>
          {item.status}
        </span>
      </div>
    </div>
  );
}

// ─── HEADER STAT ─────────────────────────────────────────────────────────────
function HeaderStat({ icon, label, value, color }) {
  return (
    <div className="bg-zinc-900/30 p-5 rounded-[2rem] border border-white/5 flex flex-col gap-2 hover:bg-zinc-900/50 transition-colors group">
      <div className={`p-2.5 w-fit rounded-xl bg-black border border-white/5 shadow-inner ${color} group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div>
        <p className="text-[8px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-1">{label}</p>
        <h3 className="text-xl font-black text-white italic tracking-tighter">
          <span className="text-[9px] mr-1 opacity-40 not-italic">UGX</span>
          {(value || 0).toLocaleString()}
        </h3>
      </div>
    </div>
  );
}

// ─── SHIFT SUMMARY MODAL ─────────────────────────────────────────────────────
function ShiftSummaryModal({ data, onClose, onFinalize, isFinalizing }) {
  if (!data) return null;
  const ugx = (val) => `UGX ${Number(val || 0).toLocaleString()}`;
  return (
    <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#0c0c0c] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <div className="w-12 h-1 text-yellow-500 bg-yellow-500 mx-auto rounded-full mb-4 opacity-50" />
          <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Shift Review</h2>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Verify totals before closing</p>
        </div>
        <div className="space-y-4 mb-8">
          <SummaryRow label="Total Cash"        value={ugx(data.cash)} />
          <SummaryRow label="Momo (MTN/Airtel)" value={ugx(data.momo)} />
          <SummaryRow label="Card Payments"     value={ugx(data.card)} />
          <SummaryRow label="Petty Cash"        value={`-${ugx(data.petty)}`} color="text-rose-500" />
          <div className="pt-4 mt-4 border-t border-white/5">
            <div className="bg-yellow-500 p-5 rounded-2xl border border-yellow-400 shadow-xl shadow-yellow-500/10">
              <p className="text-[9px] font-black text-black/60 uppercase tracking-widest mb-1">Handover Balance (Cash)</p>
              <p className="text-2xl font-black text-black italic tracking-tighter">{ugx(data.net)}</p>
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
    <div className="flex justify-between items-center">
      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</span>
      <span className={`text-sm font-black italic ${color}`}>{value}</span>
    </div>
  );
}

// ─── RECEIPT MODAL ───────────────────────────────────────────────────────────
function ReceiptModal({ data, onClose }) {
  return (
    <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white text-black w-full max-w-sm rounded-[3rem] p-12 font-mono shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-yellow-500" />
        <h2 className="text-2xl font-black uppercase text-center mb-2 tracking-tighter">KURAX BISTRO</h2>
        <p className="text-[10px] text-center mb-8 uppercase font-bold text-zinc-500">Official Settlement Voucher</p>
        <div className="space-y-4 border-y border-dashed border-zinc-200 py-8 mb-8">
          <div className="flex justify-between text-xs">
            <span>REFERENCE:</span>
            <span className="font-bold">#SETL-{Date.now().toString().slice(-4)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>RIDER:</span>
            <span className="font-bold uppercase">{data?.name}</span>
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