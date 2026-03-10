import React, { useState, useMemo, useEffect, useCallback } from "react";
import SideBar from "./SideBar";
import {
  Menu, Banknote, Smartphone, CreditCard, X, Wallet,
  Trash2, PlusCircle, ShieldCheck, Printer, ArrowRightLeft,
  BookOpen, User, Phone, Calendar, RefreshCw, Clock,
  CheckCircle, XCircle, AlertTriangle, TrendingUp, Send
} from "lucide-react";
import Footer from "../../customer/components/common/Foooter";
import API_URL from "../../config/api";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
}
function getTodayLocal() { return toLocalDateStr(new Date()); }
function timeAgo(ts) {
  const mins = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins/60)}h ${mins%60}m ago`;
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

// ─── SETTLE MODAL ─────────────────────────────────────────────────────────────
// Shown when cashier/manager clicks "Settle" on a credit entry.
// Collects: method, amount, transaction ref, notes.
function SettleModal({ credit, onClose, onSettle }) {
  const [method,  setMethod]  = useState("Cash");
  const [amount,  setAmount]  = useState(String(credit.amount || ""));
  const [txn,     setTxn]     = useState("");
  const [notes,   setNotes]   = useState("");
  const [loading, setLoading] = useState(false);

  const PAY_METHODS = [
    { key: "Cash",        label: "Cash",        color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
    { key: "Card",        label: "Card",        color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/30" },
    { key: "Momo-MTN",    label: "MTN Momo",    color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/30" },
    { key: "Momo-Airtel", label: "Airtel Momo", color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30" },
  ];

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    await onSettle(credit.id, {
      settle_method:      method,
      settle_transaction: txn.trim(),
      settle_notes:       notes.trim(),
      amount_paid:        Number(amount),
    });
    setLoading(false);
    onClose();
  };

  const isMomo = method === "Momo-MTN" || method === "Momo-Airtel";

  return (
    <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-[3rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]">

        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
          <div>
            <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Settle Credit</p>
            <h2 className="text-base font-black text-white uppercase tracking-tighter">
              {credit.client_name || "Client"} · {credit.table_name}
            </h2>
            <p className="text-zinc-400 text-xs mt-0.5">
              Outstanding: UGX {Number(credit.amount).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-zinc-900 rounded-full text-zinc-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Payment method */}
          <div>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">Payment Method</p>
            <div className="grid grid-cols-2 gap-2">
              {PAY_METHODS.map(({ key, label, color, bg }) => (
                <button key={key} onClick={() => setMethod(key)}
                  className={`py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all
                    ${method === key ? `${bg} ${color} scale-[1.02]` : "border-white/5 bg-white/3 text-zinc-500 hover:border-white/20"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">
              Amount Paid <span className="text-zinc-600">(UGX — partial allowed)</span>
            </p>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-black text-lg text-center outline-none focus:border-yellow-500/50" />
          </div>

          {/* Transaction ID — required for Momo */}
          {isMomo && (
            <div>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                Transaction ID <span className="text-red-400">*</span>
              </p>
              <input type="text" value={txn} onChange={e => setTxn(e.target.value)}
                placeholder="Enter transaction reference"
                className="w-full bg-black border border-yellow-500/30 rounded-2xl p-4 text-white font-black text-sm text-center uppercase tracking-widest outline-none focus:border-yellow-500" />
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Notes (optional)</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any notes about this settlement…"
              className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white text-sm outline-none focus:border-white/20 resize-none h-16" />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-4 text-zinc-500 font-black uppercase text-[10px]">Cancel</button>
            <button onClick={handleSubmit}
              disabled={loading || !amount || (isMomo && !txn.trim())}
              className={`flex-[2] py-4 rounded-2xl font-black text-xs uppercase transition-all flex items-center justify-center gap-2
                ${!loading && amount && (!isMomo || txn.trim())
                  ? "bg-emerald-500 text-black hover:bg-emerald-400 active:scale-[0.98]"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}>
              {loading ? "Settling…" : <><CheckCircle size={14}/> Confirm Settlement</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function CashierDashboard() {

  const loggedInUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}"); } catch { return {}; }
  }, []);
  const cashierName = loggedInUser?.name || "Cashier";

  const [activeSection,      setActiveSection]      = useState("PENDING");
  const [orderStatusFilter,  setOrderStatusFilter]  = useState("CLOSED");
  const [isSidebarOpen,      setIsSidebarOpen]      = useState(false);
  const [showShiftSummary,   setShowShiftSummary]   = useState(false);
  const [showReceipt,        setShowReceipt]        = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [settlingCredit,     setSettlingCredit]     = useState(null); // credit object for SettleModal

  // Payment modal state
  const [processingOrder,    setProcessingOrder]    = useState(null);
  const [momoTransactionId,  setMomoTransactionId]  = useState("");
  const [rejecting,          setRejecting]          = useState(false);
  const [rejectNote,         setRejectNote]         = useState("");
  const [confirming,         setConfirming]         = useState(false);
  const [animatingIds,       setAnimatingIds]       = useState([]);
  const [requestingApproval, setRequestingApproval] = useState(false);

  // Backend data
  const [liveQueue, setLiveQueue] = useState([]);
  const [credits,   setCredits]   = useState([]);
  const [history,   setHistory]   = useState([]);
  const [qLoading,  setQLoading]  = useState(true);

  // Petty cash
  const [pettyLogs,      setPettyLogs]      = useState([]);
  const [pettyCashTotal, setPettyCashTotal] = useState(0);

  // Riders
  const [riders, setRiders] = useState([]);

  // Today resets at local midnight
  const [today, setToday] = useState(getTodayLocal);
  useEffect(() => {
    const schedule = () => {
      const now  = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const t    = setTimeout(() => { setToday(getTodayLocal()); schedule(); }, next - now);
      return t;
    };
    const t = schedule(); return () => clearTimeout(t);
  }, []);

  // Totals from cashier_queue Confirmed rows
  const todayTotals = useMemo(() => {
    const zero = { cash: 0, card: 0, momo_mtn: 0, momo_airtel: 0, credit: 0, gross: 0 };
    return history.reduce((acc, row) => {
      const confirmedOn = toLocalDateStr(new Date(row.confirmed_at || row.created_at));
      if (row.status !== "Confirmed" || confirmedOn !== today) return acc;
      const amt = Number(row.amount) || 0;
      switch (row.method) {
        case "Cash":        acc.cash        += amt; acc.gross += amt; break;
        case "Card":        acc.card        += amt; acc.gross += amt; break;
        case "Momo-MTN":    acc.momo_mtn    += amt; acc.gross += amt; break;
        case "Momo-Airtel": acc.momo_airtel += amt; acc.gross += amt; break;
        case "Credit":      acc.credit      += amt;                   break;
        default: break;
      }
      return acc;
    }, { ...zero });
  }, [history, today]);

  const netCashOnCounter = todayTotals.cash - pettyCashTotal;

  // Fetch
  const fetchAll = useCallback(async () => {
    try {
      const [qRes, cRes, hRes] = await Promise.all([
        fetch(`${API_URL}/api/orders/cashier-queue`),
        fetch(`${API_URL}/api/orders/credits`),
        fetch(`${API_URL}/api/orders/cashier-history`),
      ]);
      if (qRes.ok) setLiveQueue(await qRes.json());
      if (cRes.ok) setCredits(await cRes.json());
      if (hRes.ok) setHistory(await hRes.json());
    } catch (e) { console.error("Cashier fetch failed:", e); }
    finally { setQLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 8000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const openModal = (order) => {
    setProcessingOrder(order);
    setMomoTransactionId("");
    setRejecting(false);
    setRejectNote("");
  };

  // ── Confirm (Cash/Card/Momo only) ─────────────────────────────────────────
  const handleFinalConfirm = async () => {
    const order  = processingOrder;
    const isMomo = order.method === "Momo-MTN" || order.method === "Momo-Airtel";
    if (isMomo && !momoTransactionId.trim()) return;

    setConfirming(true);
    setAnimatingIds(prev => [...prev, order.id]);
    try {
      const res = await fetch(`${API_URL}/api/orders/cashier-queue/${order.id}/confirm`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed_by:   cashierName,
          transaction_id: isMomo ? momoTransactionId.trim() : null,
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

  // ── Request approval (Credit rows only) ───────────────────────────────────
  const handleRequestApproval = async (order) => {
    setRequestingApproval(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/cashier-queue/${order.id}/request-approval`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requested_by: cashierName }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to forward to manager");
      }
      await fetchAll();
    } catch (e) { console.error("Request approval failed:", e); }
    setRequestingApproval(false);
    setProcessingOrder(null);
  };

  // ── Reject ─────────────────────────────────────────────────────────────────
  const handleReject = async () => {
    setConfirming(true);
    try {
      await fetch(`${API_URL}/api/orders/cashier-queue/${processingOrder.id}/reject`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectNote || "Rejected by cashier" }),
      });
      await fetchAll();
    } catch (e) { console.error("Reject failed:", e); }
    setConfirming(false);
    setProcessingOrder(null);
    setRejecting(false);
    setRejectNote("");
  };

  // ── Settle credit ──────────────────────────────────────────────────────────
  const handleSettleCredit = useCallback(async (creditId, settleData) => {
    try {
      await fetch(`${API_URL}/api/orders/credits/${creditId}/settle`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settled_by: cashierName, ...settleData }),
      });
      await fetchAll();
    } catch (e) { console.error("Settle credit failed:", e); }
  }, [cashierName, fetchAll]);

  // Riders
  const addNewRider = () => {
    const name = prompt("Enter Rider Name:");
    if (name) setRiders(prev => [...prev, { id: Date.now(), name, status: "IN", cash: 0, momo: 0 }]);
  };
  const handleRiderSettlement = (riderData) => {
    setRiders(prev => prev.map(r => r.id === riderData.id ? { ...r, cash: 0, momo: 0, status: "SETTLED" } : r));
    setSelectedSettlement(riderData);
    setShowReceipt(true);
  };

  // Separate live queue into normal vs credit-forwarded
  const normalQueue  = liveQueue.filter(r => r.status === "Pending");
  const forwardedQueue = liveQueue.filter(r => r.status === "PendingManagerApproval");

  const closedHistory = history.filter(h => {
    if (orderStatusFilter === "CLOSED")  return h.status === "Confirmed";
    if (orderStatusFilter === "PENDING") return h.status === "Pending";
    if (orderStatusFilter === "DELAYED") return h.status === "Pending" && Math.floor((Date.now() - new Date(h.created_at)) / 60000) >= 5;
    return true;
  });

  const isMomoProcessing = processingOrder?.method === "Momo-MTN" || processingOrder?.method === "Momo-Airtel";
  const isCredit         = processingOrder?.method === "Credit";
  const canConfirm       = !isMomoProcessing || momoTransactionId.trim().length > 0;
  const unpaidCredits    = credits.filter(c => !c.paid);

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
          cash: netCashOnCounter,
          momo: todayTotals.momo_mtn + todayTotals.momo_airtel,
          card: todayTotals.card,
        }}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* HEADER */}
        <header className="flex items-center justify-between px-6 py-4 bg-[#0c0c0c] border-b border-white/5 sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-zinc-900 rounded-xl text-yellow-500">
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
          <div className="flex items-center gap-3">
            {normalQueue.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500 rounded-xl animate-pulse">
                <AlertTriangle size={13} className="text-black" />
                <span className="text-[10px] font-black text-black uppercase tracking-widest">{normalQueue.length} Pending</span>
              </div>
            )}
            {forwardedQueue.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-xl">
                <Clock size={13} className="text-purple-400" />
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">{forwardedQueue.length} Awaiting Manager</span>
              </div>
            )}
            <button onClick={fetchAll} className="p-2 bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-all">
              <RefreshCw size={16} className={qLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10">

          {activeSection === "CLOSED" && (
            <div className="mb-10 flex gap-6 border-b border-white/5">
              {["PENDING","DELAYED","CLOSED"].map(s => (
                <button key={s} onClick={() => setOrderStatusFilter(s)}
                  className={`pb-2 text-[11px] font-black uppercase tracking-widest relative transition-colors
                    ${orderStatusFilter === s ? "text-yellow-500" : "text-zinc-500 hover:text-zinc-300"}`}>
                  {s}
                  {orderStatusFilter === s && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500" />}
                </button>
              ))}
            </div>
          )}

          {/* ── MY LIVE COLLECTION ── */}
          {activeSection === "PENDING" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">

              <div>
                <h2 className="text-xl font-black text-white uppercase leading-none">My Live Collection</h2>
                <p className="text-yellow-600 text-[14px] font-medium mt-1 italic tracking-tight">
                  Track your daily cash, card and mobile money collection
                </p>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <HeaderStat icon={<Banknote size={18}/>}    label="Cash on Counter" value={netCashOnCounter}           color="text-green-500" />
                <HeaderStat icon={<CreditCard size={18}/>}  label="Card Revenue"    value={todayTotals.card}           color="text-purple-500" />
                <HeaderStat icon={<Smartphone size={18}/>}  label="MTN Momo"        value={todayTotals.momo_mtn}       color="text-yellow-500" />
                <HeaderStat icon={<Smartphone size={18}/>}  label="Airtel Momo"     value={todayTotals.momo_airtel}    color="text-red-500" />
                <HeaderStat icon={<Wallet size={18}/>}      label="Petty Expenses"  value={pettyCashTotal}             color="text-rose-500" />
                <div className="bg-yellow-500 p-5 rounded-[2rem] border border-yellow-400 flex flex-col gap-2 col-span-2 md:col-span-1">
                  <div className="p-2.5 w-fit rounded-xl bg-black/20 text-black"><TrendingUp size={18}/></div>
                  <div>
                    <p className="text-[8px] font-black uppercase text-black/60 tracking-[0.2em] mb-1">Gross Revenue</p>
                    <h3 className="text-xl font-black text-black italic tracking-tighter">
                      <span className="text-[9px] mr-1 opacity-50 not-italic">UGX</span>
                      {todayTotals.gross.toLocaleString()}
                    </h3>
                  </div>
                </div>
              </div>

              {/* ── LIVE PAYMENT QUEUE (Cash/Card/Momo only) ── */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Live Payment Queue</h3>
                  {normalQueue.length > 0 && (
                    <span className="px-2 py-0.5 bg-yellow-500 text-black text-[9px] rounded-full font-black">{normalQueue.length}</span>
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
                        onRequestApproval={() => openModal(order)} />
                    ))}
                  </div>
                )}
              </div>

              {/* ── AWAITING MANAGER APPROVAL ── */}
              {forwardedQueue.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Awaiting Manager Approval</h3>
                    <span className="px-2 py-0.5 bg-purple-500 text-white text-[9px] rounded-full font-black animate-pulse">{forwardedQueue.length}</span>
                  </div>
                  <div className="space-y-3">
                    {forwardedQueue.map(order => (
                      <ForwardedCreditCard key={order.id} order={order} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── CREDITS LEDGER ── */}
              {unpaidCredits.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Credits / On Account</h3>
                    <span className="px-2 py-0.5 bg-purple-500 text-white text-[9px] rounded-full font-black">{unpaidCredits.length} unpaid</span>
                  </div>
                  <div className="space-y-3">
                    {credits.map(credit => (
                      <CreditRow
                        key={credit.id}
                        credit={credit}
                        onSettle={() => setSettlingCredit(credit)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── RIDERS ── */}
          {activeSection === "RIDERS" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Delivery Riders</h2>
                  <p className="text-yellow-500 text-[15px] italic font-medium mt-1">Settlement & Reconciliation</p>
                </div>
                <button onClick={addNewRider}
                  className="flex items-center gap-2 bg-yellow-500 text-black px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase italic shadow-xl shadow-yellow-500/10">
                  <PlusCircle size={16} /> Register Rider
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {riders.length > 0 ? riders.map(rider => (
                  <RiderCard key={rider.id} rider={rider}
                    onReconcile={(data) => handleRiderSettlement({ ...rider, ...data })} />
                )) : (
                  <div className="col-span-full py-20 text-center opacity-20 text-[10px] font-black uppercase tracking-[0.2em]">No active riders today</div>
                )}
              </div>
            </div>
          )}

          {/* ── PETTY CASH ── */}
          {activeSection === "PETTY CASH" && (
            <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-500">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase">Petty Cash</h2>
                  <p className="text-yellow-600 text-[14px] font-medium mt-1 italic tracking-tight">Track your daily expenses</p>
                </div>
                <div className="px-6 py-4 bg-zinc-900/50 border border-white/5 rounded-[2rem] flex items-center gap-4">
                  <div className="p-3 bg-rose-500/20 rounded-xl text-rose-500"><Wallet size={18}/></div>
                  <div>
                    <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest leading-none mb-1.5">Shift Outflow</p>
                    <p className="text-lg font-black text-white italic">UGX {pettyCashTotal.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <PettyCashManager pettyLogs={pettyLogs} setPettyLogs={setPettyLogs} onTotalChange={val => setPettyCashTotal(val)} />
            </div>
          )}

          {/* ── HISTORY ── */}
          {activeSection === "CLOSED" && (
            <div className="space-y-4 animate-in fade-in duration-500">
              {closedHistory.length === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-zinc-900/10">
                  <ShieldCheck size={32} className="mx-auto text-zinc-700 mb-4" />
                  <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest italic">No records found</p>
                </div>
              ) : (
                closedHistory.map(h => <HistoryCard key={h.id} item={h} />)
              )}
            </div>
          )}
        </main>
        <Footer />
      </div>

      {/* ── PAYMENT MODAL ── */}
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
              <button onClick={() => { setProcessingOrder(null); setRejecting(false); }}
                className="p-2 bg-zinc-900 rounded-full text-zinc-500 hover:text-white shrink-0 ml-2">
                <X size={18} />
              </button>
            </div>

            {/* Method icon */}
            <div className="flex justify-center mb-6">
              <div className={`p-6 rounded-full ${
                processingOrder.method === "Momo-MTN"    ? "bg-yellow-500/10 text-yellow-500" :
                processingOrder.method === "Momo-Airtel" ? "bg-red-500/10 text-red-500"       :
                processingOrder.method === "Card"        ? "bg-blue-500/10 text-blue-400"     :
                processingOrder.method === "Credit"      ? "bg-purple-500/10 text-purple-400" :
                                                           "bg-green-500/10 text-green-500"}`}>
                {processingOrder.method === "Cash"   ? <Banknote size={40} />   :
                 processingOrder.method === "Card"   ? <CreditCard size={40} /> :
                 processingOrder.method === "Credit" ? <BookOpen size={40} />   :
                 <Smartphone size={40} />}
              </div>
            </div>

            <div className="text-center mb-2">
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                processingOrder.method === "Cash"        ? "bg-green-500/10 text-green-400"   :
                processingOrder.method === "Card"        ? "bg-blue-500/10 text-blue-400"     :
                processingOrder.method === "Momo-MTN"    ? "bg-yellow-500/10 text-yellow-400" :
                processingOrder.method === "Momo-Airtel" ? "bg-red-500/10 text-red-400"       :
                "bg-purple-500/10 text-purple-400"}`}>
                {processingOrder.method}
              </span>
            </div>

            <h3 className="text-2xl font-black text-white text-center uppercase italic mb-2 tracking-tighter">
              {isCredit ? "Forward to Manager" : "Confirm Receipt"}
            </h3>

            <div className="bg-black border border-white/5 rounded-3xl p-6 mb-6 text-center">
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] block mb-2">
                {processingOrder.label || "Amount Due"}
              </span>
              <span className="text-3xl font-black text-white italic tracking-tighter">
                UGX {Number(processingOrder.amount).toLocaleString()}
              </span>
            </div>

            {/* Credit client info */}
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
                    ⚠️ This credit requires manager approval before it is recorded
                  </p>
                </div>
              </div>
            )}

            {/* Momo transaction ID */}
            {isMomoProcessing && !rejecting && (
              <div className="mb-6">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                  {processingOrder.method === "Momo-MTN" ? "MTN" : "Airtel"} Transaction ID
                  <span className="text-red-400 ml-1">*</span>
                </p>
                <input autoFocus type="text" placeholder="ENTER TRANSACTION ID"
                  className="w-full bg-black border border-yellow-500/30 p-5 rounded-2xl text-white font-black outline-none focus:border-yellow-500 text-center uppercase tracking-widest text-sm"
                  value={momoTransactionId} onChange={e => setMomoTransactionId(e.target.value)} />
                {!momoTransactionId.trim() && (
                  <p className="text-[9px] text-red-400 font-bold mt-2 uppercase tracking-widest text-center">
                    Required before confirming
                  </p>
                )}
              </div>
            )}

            {rejecting && (
              <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                placeholder="Reason for rejection (optional)..."
                className="w-full bg-black border border-red-500/20 p-4 rounded-2xl text-white font-bold outline-none focus:border-red-500/40 resize-none h-20 mb-6" />
            )}

            {/* Action buttons */}
            {!rejecting ? (
              <div className="flex flex-col gap-3">
                {/* Credit: show Request Approval button prominently */}
                {isCredit ? (
                  <>
                    <button onClick={() => handleRequestApproval(processingOrder)}
                      disabled={requestingApproval}
                      className="w-full py-5 bg-purple-500 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-purple-400 active:scale-[0.98] transition-all disabled:opacity-50">
                      {requestingApproval ? "Forwarding…" : <><Send size={14}/> Request Manager Approval</>}
                    </button>
                    <button onClick={() => setRejecting(true)}
                      className="w-full py-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2">
                      <XCircle size={14}/> Reject Credit Request
                    </button>
                    <button onClick={() => setProcessingOrder(null)}
                      className="w-full py-3 text-zinc-600 font-black uppercase text-[10px]">Cancel</button>
                  </>
                ) : (
                  <>
                    <div className="flex gap-3">
                      <button onClick={() => setProcessingOrder(null)}
                        className="flex-1 py-4 text-zinc-600 font-black uppercase text-[10px]">Cancel</button>
                      <button onClick={() => window.print()}
                        className="flex-1 py-4 border border-white/10 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2">
                        <Printer size={14}/> Print
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setRejecting(true)}
                        className="flex-1 py-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2">
                        <XCircle size={14}/> Reject
                      </button>
                      <button onClick={handleFinalConfirm}
                        disabled={!canConfirm || confirming}
                        className={`flex-[2] py-5 rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2
                          ${canConfirm && !confirming
                            ? "bg-yellow-500 text-black shadow-xl shadow-yellow-500/20 hover:bg-yellow-400 active:scale-[0.98]"
                            : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}>
                        {confirming ? "Processing..." : "Finalize Settlement"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => setRejecting(false)}
                  className="flex-1 py-4 border border-white/10 text-zinc-400 rounded-2xl font-black uppercase text-[10px]">Back</button>
                <button onClick={handleReject} disabled={confirming}
                  className="flex-[2] py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-red-400 transition-all disabled:opacity-50">
                  <XCircle size={14}/> Confirm Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {settlingCredit && (
        <SettleModal
          credit={settlingCredit}
          onClose={() => setSettlingCredit(null)}
          onSettle={handleSettleCredit} />
      )}
      {showReceipt && <ReceiptModal data={selectedSettlement} onClose={() => setShowReceipt(false)} />}
      {showShiftSummary && (
        <ShiftSummaryModal
          data={{
            cash:   todayTotals.cash,
            momo:   todayTotals.momo_mtn + todayTotals.momo_airtel,
            mtn:    todayTotals.momo_mtn,
            airtel: todayTotals.momo_airtel,
            card:   todayTotals.card,
            petty:  pettyCashTotal,
            net:    netCashOnCounter,
            credit: todayTotals.credit,
            gross:  todayTotals.gross,
          }}
          onClose={() => setShowShiftSummary(false)} />
      )}
    </div>
  );
}

// ─── LIVE ORDER CARD ───────────────────────────────────────────────────────────
function LiveOrderCard({ order, onConfirm, onRequestApproval, isAnimating }) {
  const age   = Math.floor((Date.now() - new Date(order.created_at)) / 60000);
  const isOld = age >= 5;
  const isCredit = order.method === "Credit";
  const { color, icon } = methodStyle(order.method);

  return (
    <div className={`bg-zinc-900/20 border border-white/5 rounded-[2.5rem] overflow-hidden transition-all duration-500
      ${isOld ? "border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.08)]" : ""}
      ${isCredit ? "border-purple-500/20" : ""}
      ${isAnimating ? "opacity-0 scale-90" : "opacity-100"}`}>

      {isOld && (
        <div className="bg-orange-500 px-4 py-1.5 flex items-center justify-center gap-2">
          <Clock size={11} className="text-black" />
          <p className="text-[9px] font-black text-black uppercase tracking-widest">Waiting {age}m — Action Needed</p>
        </div>
      )}
      {isCredit && !isOld && (
        <div className="bg-purple-500/20 border-b border-purple-500/20 px-4 py-1.5 flex items-center justify-center gap-2">
          <BookOpen size={11} className="text-purple-400" />
          <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Credit — Requires Manager Approval</p>
        </div>
      )}

      <div className="p-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-6">
          <div className={`p-5 rounded-2xl bg-black border border-white/5 shadow-inner ${color}`}>{icon}</div>
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h4 className="font-black text-white italic uppercase tracking-tighter text-base">{order.table_name || "TABLE"}</h4>
              <span className="text-zinc-700 font-black">•</span>
              <h4 className="font-black text-yellow-500 italic uppercase tracking-tighter text-base">
                {order.label || `#${String(order.id).slice(-5)}`}
              </h4>
              {isCredit && order.credit_name && (
                <span className="text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded-lg font-black uppercase tracking-widest">
                  {order.credit_name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">STAFF: {order.requested_by}</p>
              <div className="w-1 h-1 bg-zinc-700 rounded-full" />
              <span className={`text-[10px] font-black uppercase tracking-widest ${color}`}>{order.method}</span>
              <div className="w-1 h-1 bg-zinc-700 rounded-full" />
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{timeAgo(order.created_at)}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xl font-black text-white italic tracking-tighter">UGX {Number(order.amount).toLocaleString()}</p>
            <span className={`text-[9px] font-black uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded ${color}`}>{order.method}</span>
          </div>
          {isCredit ? (
            <button onClick={onConfirm}
              className="group bg-purple-500 text-white px-8 py-4 rounded-[1.5rem] text-[11px] font-black uppercase italic shadow-2xl shadow-purple-500/10 hover:bg-purple-400 transition-all active:scale-95 flex items-center gap-2">
              <Send size={14} /> Request Approval
            </button>
          ) : (
            <button onClick={onConfirm}
              className="group bg-yellow-500 text-black px-8 py-4 rounded-[1.5rem] text-[11px] font-black uppercase italic shadow-2xl shadow-yellow-500/10 hover:bg-yellow-400 transition-all active:scale-95 flex items-center gap-2">
              Confirm <ArrowRightLeft size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FORWARDED CREDIT CARD ────────────────────────────────────────────────────
// Read-only card showing credits the cashier has sent to manager
function ForwardedCreditCard({ order }) {
  return (
    <div className="bg-purple-500/5 border border-purple-500/20 rounded-[2.5rem] p-5 flex items-center justify-between gap-4 flex-wrap opacity-70">
      <div className="flex items-center gap-4">
        <div className="p-4 rounded-2xl bg-black border border-purple-500/20 text-purple-400"><BookOpen size={20}/></div>
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-black text-white italic uppercase text-sm">{order.table_name}</span>
            <span className="text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded-lg font-black uppercase">Credit</span>
            {order.credit_name && <span className="text-[9px] text-zinc-500 font-bold">{order.credit_name}</span>}
          </div>
          <p className="text-[10px] text-zinc-600 font-bold uppercase">Forwarded by {order.confirmed_by} · {timeAgo(order.created_at)}</p>
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

// ─── CREDIT ROW ───────────────────────────────────────────────────────────────
function CreditRow({ credit, onSettle }) {
  return (
    <div className={`bg-zinc-900/20 border rounded-[2.5rem] p-6 flex items-start justify-between gap-3
      ${credit.paid ? "border-emerald-500/20 opacity-60" : "border-purple-500/30"}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="font-black text-white uppercase italic tracking-tighter text-base">{credit.table_name || "Table"}</span>
          {credit.paid
            ? <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase">Settled</span>
            : <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[9px] font-black uppercase animate-pulse">Unpaid</span>
          }
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <User size={11} className="text-zinc-500" />
          <span className="text-sm font-black text-white">{credit.client_name || "—"}</span>
        </div>
        {credit.client_phone && (
          <div className="flex items-center gap-1.5 mb-1">
            <Phone size={11} className="text-zinc-500" />
            <span className="text-sm text-zinc-300">{credit.client_phone}</span>
          </div>
        )}
        {credit.pay_by && (
          <div className="flex items-center gap-1.5">
            <Calendar size={11} className="text-zinc-500" />
            <span className="text-[11px] text-zinc-400">Pays: {credit.pay_by}</span>
          </div>
        )}
        {credit.paid && credit.settle_method && (
          <p className="text-[9px] text-zinc-600 mt-2 font-mono">
            Settled via {credit.settle_method}{credit.settle_txn ? ` · TXN: ${credit.settle_txn}` : ""}
          </p>
        )}
        <p className="text-[9px] text-zinc-600 mt-1">
          Approved by {credit.approved_by} · {toLocalDateStr(new Date(credit.created_at))}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xl font-black text-purple-400 italic">UGX {Number(credit.amount).toLocaleString()}</p>
        {!credit.paid && (
          <button onClick={onSettle}
            className="mt-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500/20 transition-all">
            Settle
          </button>
        )}
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
        <p className={`text-xl font-black italic tracking-tighter ${color}`}>UGX {Number(item.amount).toLocaleString()}</p>
        <span className={`text-[8px] font-black uppercase tracking-widest ${item.status === "Confirmed" ? "text-emerald-400" : "text-red-400"}`}>
          {item.status}
        </span>
      </div>
    </div>
  );
}

// ─── STATIC COMPONENTS (unchanged from original) ──────────────────────────────
function HeaderStat({ icon, label, value, color }) {
  return (
    <div className="bg-zinc-900/30 p-5 rounded-[2rem] border border-white/5 flex flex-col gap-2 hover:bg-zinc-900/50 transition-colors group">
      <div className={`p-2.5 w-fit rounded-xl bg-black border border-white/5 shadow-inner ${color} group-hover:scale-110 transition-transform`}>{icon}</div>
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

function PettyCashManager({ pettyLogs, setPettyLogs, onTotalChange }) {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");

  const handleAddExpense = () => {
    if (!reason || !amount) return;
    const newLogs = [{ id: Date.now(), reason, amount: Number(amount), time: new Date().toLocaleTimeString() }, ...pettyLogs];
    setPettyLogs(newLogs);
    onTotalChange(newLogs.reduce((s, l) => s + l.amount, 0));
    setReason(""); setAmount(""); setShowModal(false);
  };

  const removeExpense = (id) => {
    const newLogs = pettyLogs.filter(l => l.id !== id);
    setPettyLogs(newLogs);
    onTotalChange(newLogs.reduce((s, l) => s + l.amount, 0));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-yellow-500 text-black px-6 py-3.5 rounded-2xl font-black uppercase text-[10px] italic shadow-lg shadow-yellow-500/10">
          <PlusCircle size={14}/> New Log
        </button>
      </div>
      <div className="grid gap-3">
        {pettyLogs.length > 0 ? pettyLogs.map(log => (
          <div key={log.id} className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex justify-between items-center group hover:border-rose-500/20 transition-all">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-black rounded-xl text-rose-500"><Wallet size={16}/></div>
              <div>
                <p className="text-xs font-black text-white uppercase italic">{log.reason}</p>
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest">{log.time}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <p className="text-sm font-black text-rose-500">- UGX {log.amount.toLocaleString()}</p>
              <button onClick={() => removeExpense(log.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-500 transition-all">
                <Trash2 size={16}/>
              </button>
            </div>
          </div>
        )) : (
          <div className="text-center py-12 text-[10px] font-black text-zinc-700 uppercase tracking-widest border border-dashed border-white/5 rounded-[2rem]">
            No expenses logged yet
          </div>
        )}
      </div>
      {showModal && (
        <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-sm font-black italic uppercase text-yellow-500 mb-8 text-center tracking-widest underline underline-offset-8">New Outflow</h3>
            <input placeholder="Expense Reason"
              className="w-full bg-black border border-white/5 p-4 rounded-xl text-xs text-white mb-4 outline-none focus:border-yellow-500/50"
              onChange={e => setReason(e.target.value)} />
            <input type="number" placeholder="Amount (UGX)"
              className="w-full bg-black border border-white/5 p-4 rounded-xl text-xs text-white mb-8 outline-none focus:border-yellow-500/50"
              onChange={e => setAmount(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-4 text-zinc-500 font-black text-[10px] uppercase">Discard</button>
              <button onClick={handleAddExpense} className="flex-[2] py-4 bg-yellow-500 text-black rounded-2xl font-black text-xs uppercase shadow-lg shadow-yellow-500/10">Post Expense</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShiftSummaryModal({ data, onClose }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-4">
      <div className="bg-[#0c0c0c] border border-white/10 w-full max-w-xl rounded-[4rem] p-12 shadow-[0_0_100px_-20px_rgba(234,179,8,0.2)]">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-3xl font-black uppercase italic text-yellow-500 tracking-tighter">Shift Audit Report</h2>
          <button onClick={onClose} className="p-2 bg-zinc-900 rounded-full text-zinc-500 hover:text-white"><X size={20}/></button>
        </div>
        <div className="space-y-4 mb-10">
          <SummaryRow label="Gross Cash Collections"  value={data.cash + data.petty} color="text-white" />
          <SummaryRow label="Total Petty Outflow"     value={data.petty}             color="text-rose-500" />
          <div className="my-4 border-b border-dashed border-white/10" />
          <SummaryRow label="Actual Drawer Handover"  value={data.net}               color="text-emerald-500" />
          <SummaryRow label="MTN Momo"                value={data.mtn}               color="text-yellow-400" />
          <SummaryRow label="Airtel Momo"             value={data.airtel}            color="text-red-400" />
          <SummaryRow label="POS Card Settlements"    value={data.card}              color="text-white" />
          <SummaryRow label="Credits (On Account)"    value={data.credit}            color="text-purple-400" />
          <div className="pt-8 border-t border-white/10 flex justify-between items-center">
            <div>
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] block mb-1">Total Shift Revenue</span>
              <span className="text-4xl font-black text-yellow-400 italic tracking-tighter">UGX {data.gross.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <button className="w-full py-6 bg-yellow-500 text-black font-black rounded-[2rem] uppercase italic text-xl shadow-2xl shadow-yellow-500/20 hover:scale-[1.02] transition-all">
          Submit & Finalize Audit
        </button>
      </div>
    </div>
  );
}

function RiderCard({ rider, onReconcile }) {
  const [cash, setCash] = useState(0);
  const [momo, setMomo] = useState(0);
  return (
    <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-[2.5rem] transition-all hover:bg-zinc-900/60 hover:border-yellow-500/20 group">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-yellow-500/10 text-yellow-500 rounded-2xl flex items-center justify-center font-black text-xl italic border border-yellow-500/10 group-hover:scale-110 transition-transform duration-500">
            {rider.name[0]}
          </div>
          <div>
            <h4 className="font-black text-white uppercase italic tracking-tight text-lg">{rider.name}</h4>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full font-black uppercase tracking-widest border border-emerald-500/10">{rider.status}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
          <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">Cash</p>
          <input type="number" value={cash} onChange={e => setCash(Number(e.target.value))} className="bg-transparent text-white font-black text-sm w-full outline-none" />
        </div>
        <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
          <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">Momo</p>
          <input type="number" value={momo} onChange={e => setMomo(Number(e.target.value))} className="bg-transparent text-white font-black text-sm w-full outline-none" />
        </div>
      </div>
      <button onClick={() => onReconcile({ cash, momo })}
        className="w-full bg-white/5 text-white hover:bg-yellow-500 hover:text-black py-4 rounded-2xl text-[10px] font-black uppercase italic tracking-widest transition-all">
        Post Settlement
      </button>
    </div>
  );
}

function SummaryRow({ label, value, color }) {
  return (
    <div className="flex justify-between items-center bg-zinc-900/40 p-6 rounded-3xl border border-white/5">
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
      <span className={`text-2xl font-black italic ${color}`}>UGX {(value || 0).toLocaleString()}</span>
    </div>
  );
}

function ReceiptModal({ data, onClose }) {
  return (
    <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white text-black w-full max-w-sm rounded-[3rem] p-12 font-mono shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-yellow-500" />
        <h2 className="text-2xl font-black uppercase text-center mb-2 tracking-tighter">KURAX BISTRO</h2>
        <p className="text-[10px] text-center mb-8 uppercase font-bold text-zinc-500">Official Settlement Voucher</p>
        <div className="space-y-4 border-y border-dashed border-zinc-200 py-8 mb-8">
          <div className="flex justify-between text-xs"><span>REFERENCE:</span><span className="font-bold">#SETL-{Date.now().toString().slice(-4)}</span></div>
          <div className="flex justify-between text-xs"><span>RIDER:</span><span className="font-bold uppercase">{data?.name}</span></div>
          <div className="my-4 border-t border-zinc-100" />
          <div className="flex justify-between text-sm"><span>CASH:</span><span className="font-bold">UGX {data?.cash?.toLocaleString()}</span></div>
          <div className="flex justify-between text-sm"><span>MOMO:</span><span className="font-bold">UGX {data?.momo?.toLocaleString()}</span></div>
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={() => window.print()}
            className="w-full py-4 bg-black text-white font-black rounded-2xl uppercase italic text-sm flex items-center justify-center gap-3">
            <Printer size={18}/> Print Voucher
          </button>
          <button onClick={onClose} className="w-full py-4 text-zinc-400 font-bold uppercase text-[10px]">Close Window</button>
        </div>
      </div>
    </div>
  );
}