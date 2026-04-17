import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { useNavigate } from 'react-router-dom';
import { 
  Plus, RotateCcw, Send, Bell, Lock, X, Coffee, Wine, Smartphone, CreditCard, Phone,
  Utensils, ChevronUp, ChevronDown, CheckCircle, 
  AlertTriangle, Clock, Receipt, Banknote,
  Calendar, User, BookOpen, ClipboardList, Search, Hourglass
} from 'lucide-react';
import API_URL from "../../../config/api";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(d.toLocaleString("en-US", { timeZone: "Africa/Nairobi" }))
    .toISOString().split("T")[0];
}
function getTodayLocal() { return toLocalDateStr(new Date()); }

// ─── PAYMENT METHODS ─────────────────────────────────────────────────────────
const MOMO_CODES = {
  "Momo-MTN":    { merchant: "*165*3#", till: "KURAX-MTN-001" },
  "Momo-Airtel": { merchant: "*185*9#", till: "KURAX-AIR-002" },
};
const PAY_METHODS = [
  { key: "Cash",        label: "Cash",        icon: <Banknote size={20}/>,   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  { key: "Card",        label: "Card",        icon: <CreditCard size={20}/>, color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/30" },
  { key: "Momo-MTN",    label: "MTN Momo",    icon: <Smartphone size={20}/>, color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/30" },
  { key: "Momo-Airtel", label: "Airtel Momo", icon: <Smartphone size={20}/>, color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30" },
  { key: "Credit",      label: "Credit",      icon: <BookOpen size={20}/>,   color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/30" },
];

// ─── PAY MODAL ───────────────────────────────────────────────────────────────
function PayModal({ target, onClose, onSend }) {
  const [method,      setMethod]      = useState(null);
  const [creditName,  setCreditName]  = useState("");
  const [creditPhone, setCreditPhone] = useState("");
  const [creditNote,  setCreditNote]  = useState("");
  const [sending,     setSending]     = useState(false);

  const isItem   = target?.type === "item";
  const amount   = isItem
    ? Number(target?.item?.price || 0) * Number(target?.item?.quantity || 1)
    : Number(target?.total || 0);
  const label    = isItem
    ? (target?.item?.name || "Item")
    : `Full Table · ${target?.tableName || ""}`;
  const isMomo   = method === "Momo-MTN" || method === "Momo-Airtel";
  const isCredit = method === "Credit";
  const canSend  = method && (!isCredit || (creditName.trim() && creditPhone.trim()));

  const handleSend = async () => {
    if (!canSend || sending) return;
    setSending(true);
    try {
      const orderId  = isItem ? (target?.item?._orderId ?? null) : null;
      const orderIds = isItem
        ? (orderId ? [orderId] : [])
        : (target?.orderIds || []);

      await onSend({
        type:       target?.type,
        tableName:  target?.tableName,
        method,
        amount,
        label,
        orderId,
        orderIds,
        item:       isItem ? target?.item : null,
        creditInfo: isCredit
          ? { name: creditName.trim(), phone: creditPhone.trim(), pay_by: creditNote.trim() }
          : null,
      });
    } catch (err) {
      console.error("PayModal send error:", err);
    } finally {
      setSending(false);
      onClose();
    }
  };

  if (!target) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-2 pb-0 sm:pb-4">
      <div className="w-full max-w-md bg-zinc-950 rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-zinc-950 z-10 flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
          <div>
            <p className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">
              {isItem ? "Item Payment" : "Table Payment"} · {target?.tableName}
            </p>
            <h2 className="text-lg font-black text-white uppercase tracking-tight leading-tight">{label}</h2>
            <p className="text-zinc-400 text-xs mt-0.5">UGX {amount.toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 shrink-0">
            <X size={16} className="text-zinc-400" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Select Payment Method</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PAY_METHODS.map(({ key, label: ml, icon, color, bg }) => (
                <button key={key} onClick={() => setMethod(key)}
                  className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest
                    ${method === key ? `${bg} ${color} scale-[1.02] shadow-lg` : "border-white/5 bg-white/3 text-zinc-500 hover:border-white/20"}`}>
                  <span className={method === key ? color : "text-zinc-600"}>{icon}</span>
                  {ml}
                </button>
              ))}
            </div>
          </div>
          {isMomo && MOMO_CODES[method] && (
            <div className="bg-white/3 rounded-2xl p-4 border border-white/5 space-y-2">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Payment Instructions</p>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Merchant Code</span>
                <span className="font-black text-white text-sm tracking-widest">{MOMO_CODES[method].merchant}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Till Number</span>
                <span className="font-black text-yellow-400 text-sm">{MOMO_CODES[method].till}</span>
              </div>
            </div>
          )}
          {isCredit && (
            <div className="space-y-3">
              <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Client Details</p>
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  value={creditName} 
                  onChange={e => setCreditName(e.target.value)}
                  placeholder="Client full name *"
                  className="w-full bg-zinc-900 border border-white/10 rounded-2xl pl-9 pr-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500/40" 
                />
              </div>
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  value={creditPhone} 
                  onChange={e => setCreditPhone(e.target.value)}
                  placeholder="Phone number *" 
                  type="tel"
                  className="w-full bg-zinc-900 border border-white/10 rounded-2xl pl-9 pr-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500/40" 
                />
              </div>
              <textarea 
                value={creditNote} 
                onChange={e => setCreditNote(e.target.value)}
                placeholder="Expected pay-by date — e.g. 'pays every Friday' or '2025-08-10'"
                className="w-full bg-zinc-900 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500/40 resize-none h-16" 
              />
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
                <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Requires cashier → manager approval</p>
              </div>
            </div>
          )}
          <div className="bg-white/3 rounded-2xl p-4 flex justify-between items-center border border-white/5">
            <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">
              {isItem ? "Item Total" : "Table Total"}
            </span>
            <span className="font-black text-white text-xl">UGX {amount.toLocaleString()}</span>
          </div>
          <button disabled={!canSend || sending} onClick={handleSend}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2
              ${canSend && !sending ? "bg-yellow-500 text-black hover:bg-yellow-400 active:scale-[0.98]" : "bg-white/5 text-zinc-600 cursor-not-allowed"}`}>
            {sending ? "Sending…" : canSend ? <><Send size={15}/> Send to Cashier</> : "Select a Method"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── VOID MODAL ──────────────────────────────────────────────────────────────
function VoidModal({ item, tableName, onClose, onConfirmVoid }) {
  const [reason, setReason]   = useState("");
  const [loading, setLoading] = useState(false);

  if (!item) return null;

  const handleVoid = async () => {
    if (!reason.trim() || loading) return;
    setLoading(true);
    try {
      await onConfirmVoid(item, reason);
    } catch (err) {
      console.error("VoidModal error:", err);
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-2">
      <div className="w-full max-w-sm bg-zinc-950 rounded-t-[2rem] sm:rounded-[2rem] border border-red-500/20 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-500" />
            </div>
            <div>
              <p className="font-black text-white text-sm">Request Void</p>
              <p className="text-[10px] text-zinc-500">{tableName} · {item?.name}</p>
            </div>
            <button onClick={onClose} className="ml-auto w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              <X size={14} className="text-zinc-400" />
            </button>
          </div>
          <div className="bg-white/3 rounded-2xl p-4 mb-4 border border-white/5">
            <div className="flex justify-between">
              <span className="text-white font-black text-sm">{item?.name}</span>
              <span className="text-yellow-400 font-black text-sm">x{item?.quantity || 1}</span>
            </div>
            <p className="text-zinc-500 text-[10px] mt-1">UGX {Number(item?.price || 0).toLocaleString()}</p>
          </div>
          <textarea 
            value={reason} 
            onChange={e => setReason(e.target.value)}
            placeholder="Reason for void request…"
            className="w-full bg-zinc-900 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-red-500/40 resize-none h-20 mb-4" 
          />
          <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse shrink-0" />
            <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Request will be sent to accountant for approval</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onClose}
              className="py-3 rounded-xl border border-white/10 text-zinc-400 font-black text-xs uppercase tracking-widest hover:bg-white/5">Cancel</button>
            <button onClick={handleVoid} disabled={!reason.trim() || loading}
              className="py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 font-black text-xs uppercase tracking-widest hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? "Sending…" : "Request Void"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CREDITED ITEMS PANEL ──────────────────────────────────────────────────────
function CreditedItemsPanel({ creditedItems, theme, onMarkCreditCollected }) {
  const isDark = theme === "dark";
  
  if (!creditedItems || creditedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center
          ${isDark ? "bg-purple-500/10 border border-purple-500/20" : "bg-purple-50 border border-purple-100"}`}>
          <BookOpen size={28} className="text-purple-400/60"/>
        </div>
        <div className="text-center">
          <p className={`text-xs font-black uppercase tracking-[0.25em] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>No credit requests</p>
          <p className={`text-[10px] mt-1 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>Credits requested will appear here</p>
        </div>
      </div>
    );
  }

  const pendingCashier = creditedItems.filter(c => c.status === "PendingCashier");
  const pendingManager = creditedItems.filter(c => c.status === "PendingManagerApproval");
  const approved = creditedItems.filter(c => c.status === "Approved");
  const settled = creditedItems.filter(c => c.status === "FullySettled" || c.status === "PartiallySettled");
  
  const totalPendingCashier = pendingCashier.reduce((s, c) => s + Number(c.balance || c.amount || 0), 0);
  const totalPendingManager = pendingManager.reduce((s, c) => s + Number(c.balance || c.amount || 0), 0);
  const totalApproved = approved.reduce((s, c) => s + Number(c.balance || c.amount || 0), 0);
  const totalSettled = settled.reduce((s, c) => s + Number(c.amount_paid || c.amount || 0), 0);

  return (
    <div className="space-y-5 pb-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {pendingCashier.length > 0 && (
          <div className={`rounded-2xl border p-4 ${isDark ? "bg-yellow-500/5 border-yellow-500/20" : "bg-yellow-50 border-yellow-100"}`}>
            <p className="text-[8px] font-black uppercase tracking-widest text-yellow-400 mb-1">Wait for Cashier</p>
            <p className="text-xl font-black text-yellow-400">UGX {totalPendingCashier.toLocaleString()}</p>
            <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{pendingCashier.length} waiting cashier</p>
          </div>
        )}
        {pendingManager.length > 0 && (
          <div className={`rounded-2xl border p-4 ${isDark ? "bg-orange-500/5 border-orange-500/20" : "bg-orange-50 border-orange-100"}`}>
            <p className="text-[8px] font-black uppercase tracking-widest text-orange-400 mb-1">Wait for Manager</p>
            <p className="text-xl font-black text-orange-400">UGX {totalPendingManager.toLocaleString()}</p>
            <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{pendingManager.length} waiting approval</p>
          </div>
        )}
        <div className={`rounded-2xl border p-4 ${isDark ? "bg-purple-500/5 border-purple-500/20" : "bg-purple-50 border-purple-100"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-purple-400 mb-1">Credit Approved</p>
          <p className="text-xl font-black text-purple-400">UGX {totalApproved.toLocaleString()}</p>
          <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{approved.length} credit{approved.length !== 1 ? "s" : ""} approved</p>
        </div>
        <div className={`rounded-2xl border p-4 ${isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-100"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-emerald-400 mb-1">Credit Collected</p>
          <p className="text-xl font-black text-emerald-400">UGX {totalSettled.toLocaleString()}</p>
          <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{settled.length} credit{settled.length !== 1 ? "s" : ""} collected</p>
        </div>
      </div>
      
      {pendingCashier.length > 0 && (
        <div className="space-y-2">
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Wait for Cashier · {pendingCashier.length}</p>
          {pendingCashier.map((credit, i) => (
            <CreditItemRow key={i} credit={credit} isDark={isDark} status="pendingCashier" />
          ))}
        </div>
      )}
      
      {pendingManager.length > 0 && (
        <div className="space-y-2">
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Wait for Manager · {pendingManager.length}</p>
          {pendingManager.map((credit, i) => (
            <CreditItemRow key={i} credit={credit} isDark={isDark} status="pendingManager" />
          ))}
        </div>
      )}
      
      {approved.length > 0 && (
        <div className="space-y-2">
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Credit Approved · {approved.length}</p>
          {approved.map((credit, i) => (
            <CreditItemRow 
              key={i} 
              credit={credit} 
              isDark={isDark} 
              status="approved"
              onMarkCollected={onMarkCreditCollected}
            />
          ))}
        </div>
      )}
      
      {settled.length > 0 && (
        <div className="space-y-2">
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Credit Collected · {settled.length}</p>
          {settled.map((credit, i) => (
            <CreditItemRow key={i} credit={credit} isDark={isDark} status="collected" />
          ))}
        </div>
      )}
    </div>
  );
}

function CreditItemRow({ credit, isDark, status, onMarkCollected }) {
  const date = credit?.created_at;
  const dateStr = date
    ? new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  
  const statusStyles = {
    pendingCashier: { 
      bg: isDark ? "bg-yellow-500/5 border-yellow-500/20" : "bg-yellow-50/60 border-yellow-200", 
      badge: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400", 
      icon: <Hourglass size={8}/>, 
      label: "Wait for Cashier"
    },
    pendingManager: { 
      bg: isDark ? "bg-orange-500/5 border-orange-500/20" : "bg-orange-50/60 border-orange-200", 
      badge: "bg-orange-500/10 border-orange-500/20 text-orange-400", 
      icon: <Hourglass size={8}/>, 
      label: "Wait for Manager"
    },
    approved: { 
      bg: isDark ? "bg-purple-500/5 border-purple-500/20" : "bg-purple-50/60 border-purple-200", 
      badge: "bg-purple-500/10 border-purple-500/20 text-purple-400", 
      icon: <CheckCircle size={8}/>, 
      label: "Credit Approved"
    },
    collected: { 
      bg: isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50/60 border-emerald-200", 
      badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400", 
      icon: <CheckCircle size={8}/>, 
      label: "Credit Collected"
    }
  };
  
  const style = statusStyles[status] || statusStyles.pendingCashier;
  const displayAmount = status === "collected" ? credit.amount_paid : (credit.balance || credit.amount);
  
  return (
    <div className={`rounded-2xl border p-4 flex items-start justify-between gap-3 transition-all ${style.bg} ${status === "collected" ? "opacity-70" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className={`font-black text-sm uppercase tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{credit.label || "Credit Item"}</span>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border ${style.badge} text-[8px] font-black uppercase`}>
            {style.icon} {style.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-bold ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>Table: {credit.table_name}</span>
        </div>
        {credit.client_name && (
          <div className="flex items-center gap-1 mb-1">
            <User size={9} className="text-zinc-500 shrink-0"/>
            <span className={`text-[10px] font-bold ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{credit.client_name}</span>
            {credit.client_phone && <span className={`text-[9px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>· {credit.client_phone}</span>}
          </div>
        )}
        {credit.pay_by && status !== "collected" && (
          <div className="flex items-center gap-1 mb-1">
            <Calendar size={9} className="text-amber-400 shrink-0"/>
            <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider">Pay by: {credit.pay_by}</span>
          </div>
        )}
        <p className={`text-[8px] font-bold mt-1 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>{dateStr}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-lg font-black ${status === "collected" ? "text-emerald-400" : status === "approved" ? "text-purple-400" : status === "pendingManager" ? "text-orange-400" : "text-yellow-400"}`}>
          UGX {Number(displayAmount || 0).toLocaleString()}
        </p>
        {status === "approved" && onMarkCollected && (
          <button
            onClick={() => onMarkCollected(credit)}
            className="mt-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all"
          >
            Mark Collected
          </button>
        )}
      </div>
    </div>
  );
}

// ─── ORDER CARD ──────────────────────────────────────────────────────────────
function OrderCard({ 
  order, 
  theme, 
  onMarkServed, 
  onUnserve,
  onPayTable,
  onPayItem,
  onVoidItem,
  onMarkTablePaid,
}) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  if (!order) return null;

  const isReady         = order.status === "Ready";
  const isServed        = order.status === "Served";
  const isPaid          = order.status === "Paid";
  const tableAllPaid    = order.allPaid;
  const hasPendingVoid   = (order.items || []).some(item => item.voidRequested === true && item.voidProcessed !== true);
  const hasPendingPayment = (order.items || []).some(item => item.paymentRequested === true && !item._rowPaid);

  const handleAddMore = () => {
    navigate('/staff/waiter/menu', { 
      state: { 
        tableName: order.tableName, 
        isAppending: true 
      } 
    });
  };

  // Only show items that are NOT voided as payable
  const payableItems = (order.items || []).filter(item => {
    return !item._rowPaid && item.status !== "VOIDED" && !item.voidProcessed && !item.paymentRequested && !item.creditRequested;
  });

  const allItemsVoided = order.items?.length > 0 && order.items.every(
    item => item.voidProcessed === true || item.status === "VOIDED"
  );

  const allItemsPaidOrRequested = order.items?.length > 0 && order.items.every(
    item => item._rowPaid === true || item.paymentRequested === true || item.creditRequested === true || item.status === "VOIDED" || item.voidProcessed === true
  );

  const statusConfig = {
    Pending:         { label: "Pending",          color: "text-zinc-400",    bg: "bg-zinc-500/10 border-zinc-500/20",       dot: "bg-zinc-400" },
    Preparing:       { label: "Preparing",        color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20",   dot: "bg-orange-400 animate-pulse" },
    Ready:           { label: "🔔 Ready!",        color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400" },
    Served:          { label: "Served",           color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",       dot: "bg-blue-400" },
    Paid:            { label: "Paid ✓",           color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
  };

  const currentStatus = allItemsVoided
    ? { label: "All Items Voided", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", dot: "bg-red-400" }
    : (statusConfig[order.status] || statusConfig.Pending);

  // If table is paid, show simple view
  if (isPaid || tableAllPaid) {
    return (
      <div className={`rounded-[1.5rem] border overflow-hidden transition-all duration-300 mb-4
        ${theme === "dark" ? "bg-zinc-900 border-white/5" : "bg-white border-black/5 shadow-sm"}`}>
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className={`font-black text-[16px] uppercase ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                {order.tableName}
              </span>
              <p className="text-[10px] font-bold text-zinc-500">
                {order.items?.filter(i => i.status !== "VOIDED" && !i.voidProcessed).length || 0} items · UGX {(order.total || 0).toLocaleString()}
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[8px] font-black uppercase ${statusConfig.Paid.bg} ${statusConfig.Paid.color}`}>
              <span className={`w-1 h-1 rounded-full ${statusConfig.Paid.dot}`} />
              {statusConfig.Paid.label}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-[1.5rem] border overflow-hidden transition-all duration-300 mb-4
      ${hasPendingVoid ? "border-orange-500/30 shadow-lg shadow-orange-500/5" : ""}
      ${hasPendingPayment ? "border-yellow-500/30 shadow-lg shadow-yellow-500/5" : ""}
      ${theme === "dark" ? "bg-zinc-900 border-white/5" : "bg-white border-black/5 shadow-sm"}`}>

      {/* MAIN CARD HEADER */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className={`font-black text-[16px] uppercase ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
              {order.tableName}
            </span>
            <p className="text-[10px] font-bold text-zinc-500">
              {order.items?.filter(i => i.status !== "VOIDED" && !i.voidProcessed).length || 0} items · UGX {(order.total || 0).toLocaleString()}
            </p>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[8px] font-black uppercase ${currentStatus.bg} ${currentStatus.color}`}>
            <span className={`w-1 h-1 rounded-full ${currentStatus.dot}`} />
            {currentStatus.label}
          </div>
        </div>

        {/* EXPAND BUTTON */}
        <button onClick={() => setExpanded(!expanded)}
          className={`mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all
            ${theme === "dark" ? "bg-white/5 text-zinc-400" : "bg-zinc-50 text-zinc-500"}`}>
          <Utensils size={10} />
          {expanded ? "Hide Items" : "View Items"}
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      </div>

      {/* ITEM LIST (EXPANDABLE) - Only show non-voided items */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-black/5 pt-3">
          {(order.items || []).filter(item => item.status !== "VOIDED" && !item.voidProcessed).map((item, i) => (
            <div key={i} className={`p-3 rounded-xl ${theme === "dark" ? "bg-white/5" : "bg-zinc-50"}`}>
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <p className={`font-black text-[12px]`}>
                    {item.name}
                    {item.voidRequested && !item.voidProcessed && (
                      <span className="ml-2 text-[8px] text-orange-400 font-black uppercase">(waiting accountant)</span>
                    )}
                    {item.paymentRequested && !item._rowPaid && (
                      <span className="ml-2 text-[8px] text-yellow-400 font-black uppercase">(awaiting cashier)</span>
                    )}
                    {item.creditRequested && !item._rowPaid && (
                      <span className="ml-2 text-[8px] text-purple-400 font-black uppercase">(credit pending)</span>
                    )}
                  </p>
                  <p className="text-[9px] font-bold text-zinc-400">
                    ×{item.quantity || 1} · UGX {Number(item.price || 0).toLocaleString()}
                  </p>
                </div>

                {/* ITEM LEVEL ACTIONS */}
                <div className="flex gap-1.5">
                  {isServed && !item._rowPaid && item.status !== 'VOIDED' && !item.voidProcessed && !item.paymentRequested && !item.creditRequested && (
                    <button
                      onClick={() => onPayItem && onPayItem(item, order)}
                      className="p-1.5 bg-yellow-500/10 text-yellow-500 rounded-lg hover:bg-yellow-500/20 transition-all">
                      <Receipt size={12} />
                    </button>
                  )}
                  {item.paymentRequested && !item._rowPaid && (
                    <div className="p-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg flex items-center gap-1">
                      <Hourglass size={10} />
                      <span className="text-[8px] font-black">Awaiting Cashier</span>
                    </div>
                  )}
                  {!item._rowPaid && item.status !== 'VOIDED' && !item.voidProcessed && !item.voidRequested && !item.paymentRequested && !item.creditRequested && (
                    <button
                      onClick={() => onVoidItem && onVoidItem(item, order)}
                      className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-all">
                      <AlertTriangle size={12} />
                    </button>
                  )}
                  {item.voidRequested && !item.voidProcessed && (
                    <div className="p-1.5 bg-orange-500/20 text-orange-400 rounded-lg flex items-center gap-1">
                      <Hourglass size={10} />
                      <span className="text-[8px] font-black">Wait for Accountant</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Show voided items as crossed out if any exist */}
          {(order.items || []).filter(item => item.status === "VOIDED" || item.voidProcessed).length > 0 && (
            <div className="mt-3 pt-2 border-t border-white/10">
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-2">Voided Items</p>
              {(order.items || []).filter(item => item.status === "VOIDED" || item.voidProcessed).map((item, i) => (
                <div key={`voided-${i}`} className="p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-black text-[11px] line-through text-zinc-500">
                        {item.name}
                      </p>
                      <p className="text-[8px] font-bold text-zinc-500">
                        ×{item.quantity || 1} · UGX {Number(item.price || 0).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-[8px] text-red-400 font-black">VOIDED</span>
                  </div>
                  {item.voidReason && (
                    <p className="text-[7px] text-zinc-500 mt-1">Reason: {item.voidReason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FOOTER ACTIONS */}
      <div className={`px-4 pb-4 pt-2 border-t ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {isReady && !isServed && (
              <button onClick={() => onMarkServed && onMarkServed(order)}
                className="flex-1 py-2.5 bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5">
                <Bell size={13}/> Mark Served
              </button>
            )}

            <button onClick={handleAddMore}
              className="flex-1 py-2.5 border border-yellow-500/40 text-yellow-600 font-black text-[10px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5">
              <Plus size={14} strokeWidth={3} /> Add Items
            </button>

            {isServed && !hasPendingPayment && (
              <button onClick={() => onUnserve && onUnserve(order)}
                className="py-2.5 px-3.5 border border-black/10 text-zinc-400 font-black text-[10px] rounded-xl">
                <RotateCcw size={12}/>
              </button>
            )}
          </div>

          {isServed && payableItems.length > 0 && !hasPendingPayment && (
            <button onClick={() => onPayTable && onPayTable(order)}
              className="w-full py-2.5 bg-yellow-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-500/20">
              <Send size={13}/> Pay Full Table
            </button>
          )}
          
          {isServed && allItemsPaidOrRequested && order.items?.filter(i => i.status !== "VOIDED" && !i.voidProcessed).length > 0 && payableItems.length === 0 && !hasPendingPayment && (
            <button onClick={() => onMarkTablePaid && onMarkTablePaid(order)}
              className="w-full py-2.5 bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20">
              <CheckCircle size={13}/> Mark as Paid
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── VOIDED ITEMS PANEL - Shows ONLY voided items, not tables ─────────────────
function VoidedItemsPanel({ voidedItems, theme }) {
  const isDark = theme === "dark";
  
  if (!voidedItems || voidedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center
          ${isDark ? "bg-red-500/10 border border-red-500/20" : "bg-red-50 border border-red-100"}`}>
          <AlertTriangle size={28} className="text-red-400/60"/>
        </div>
        <div className="text-center">
          <p className={`text-xs font-black uppercase tracking-[0.25em] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>No voided items</p>
          <p className={`text-[10px] mt-1 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>Cancelled items will appear here</p>
        </div>
      </div>
    );
  }

  const totalVoided = voidedItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity || 1)), 0);

  return (
    <div className="space-y-4 pb-8">
      <div className={`rounded-2xl border p-4 ${isDark ? "bg-red-500/5 border-red-500/20" : "bg-red-50 border-red-100"}`}>
        <p className="text-[8px] font-black uppercase tracking-widest text-red-400 mb-1">Total Cancelled Value</p>
        <p className="text-2xl font-black text-red-400">UGX {totalVoided.toLocaleString()}</p>
        <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{voidedItems.length} item{voidedItems.length !== 1 ? "s" : ""} voided</p>
      </div>
      
      <div className="space-y-2">
        <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Voided Items · {voidedItems.length}</p>
        {voidedItems.map((item, idx) => (
          <div key={idx} className={`rounded-2xl border p-4 ${isDark ? "bg-red-500/5 border-red-500/20" : "bg-red-50/60 border-red-200"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className={`font-black text-sm uppercase tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{item.name}</span>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-black uppercase">
                    <CheckCircle size={8}/> Voided
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>Table: {item.tableName}</span>
                  <span className={`text-[9px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>· x{item.quantity || 1}</span>
                </div>
                {item.voidReason && (
                  <p className={`text-[9px] font-bold truncate ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>Reason: {item.voidReason}</p>
                )}
                {item.voidedAt && (
                  <p className={`text-[8px] font-bold mt-1 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>
                    {new Date(item.voidedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-black text-red-400">UGX {(Number(item.price) * Number(item.quantity || 1)).toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function OrderHistory({ onAddItems }) {
  const { orders = [], currentUser, refreshData } = useData() || {};
  const { theme } = useTheme();
  const today = getTodayLocal();

  const savedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}"); }
    catch { return {}; }
  }, []);

  const currentStaffId   = currentUser?.id   ?? savedUser?.id;
  const currentStaffName = currentUser?.name ?? savedUser?.name ?? "Staff Member";

  const [activeTab,    setActiveTab]    = useState("Live");
  const [searchQuery,  setSearchQuery]  = useState("");
  const [payTarget,    setPayTarget]    = useState(null);
  const [voidTarget,   setVoidTarget]   = useState(null);
  const [creditsData,  setCreditsData]  = useState([]);
  const [pendingPayments, setPendingPayments] = useState({});

  // ─── DATA FILTERING ────────────────────────────────────────────────────────
  const dailyStaffOrders = useMemo(() => {
    if (!currentStaffId && !currentStaffName) return [];
    return (orders || []).filter(o => {
      const ts = o.timestamp || o.created_at;
      if (!ts) return false;
      const idMatch   = currentStaffId
        ? String(o.staff_id ?? o.staffId ?? "") === String(currentStaffId)
        : false;
      const nameMatch = currentStaffName && currentStaffName !== "Staff Member"
        ? (o.staff_name ?? o.waiterName ?? o.staffName ?? "").toLowerCase() === currentStaffName.toLowerCase()
        : false;
      return (idMatch || nameMatch) && toLocalDateStr(new Date(ts)) === today;
    });
  }, [orders, currentStaffId, currentStaffName, today]);

  // ─── GROUPING ──────────────────────────────────────────────────────────────
  const groupedTableOrders = useMemo(() => {
    const groups = {};
    dailyStaffOrders.forEach(order => {
      const key     = (order.table_name || order.tableName || "WALK-IN").trim().toUpperCase();
      const rowPaid = order.status === "Paid" || order.is_paid || order.isPaid;

      if (!groups[key]) {
        groups[key] = {
          tableName:  key,
          displayId:  order.id ? String(order.id).slice(-6) : "000000",
          total:      0,
          items:      [],
          status:     order.status || "Pending",
          timestamp:  order.timestamp || order.created_at,
          orderIds:   [],
          _rows:      [],
        };
      }
      const g = groups[key];
      g.total += Number(order.total) || 0;
      g.orderIds.push(order.id);
      g._rows.push({ id: order.id, paid: rowPaid, total: Number(order.total) || 0 });
      
      (order.items || []).forEach(item => {
        g.items.push({ 
          ...item, 
          _orderId: order.id, 
          _rowPaid: rowPaid,
          voidRequested: item.voidRequested || false,
          voidProcessed: item.voidProcessed || false,
          paymentRequested: pendingPayments[`${order.id}_${item.name}`] || item.paymentRequested || false,
          creditRequested: item.creditRequested || false,
          voidReason: item.voidReason || null,
          voidedAt: item.voidedAt || null,
          tableName: key,
        });
      });

      const rank = { Paid: 7, Served: 6, Ready: 5, Delayed: 4, Preparing: 3, Pending: 2 };
      if ((rank[order.status] || 0) > (rank[g.status] || 0)) g.status = order.status;
    });

    Object.values(groups).forEach(g => {
      g.items = g.items.map((item, idx) => ({ ...item, _itemIndex: idx }));
      // Recalculate total excluding voided items
      g.total = g.items.reduce((sum, item) => {
        if (item.status !== "VOIDED" && !item.voidProcessed) {
          return sum + (Number(item.price) * Number(item.quantity || 1));
        }
        return sum;
      }, 0);
    });
    return groups;
  }, [dailyStaffOrders, pendingPayments]);

  const enrichedGroups = useMemo(() =>
    Object.values(groupedTableOrders).map(group => {
      const allPaid = group._rows.length > 0 && group._rows.every(r => r.paid);
      return {
        ...group,
        allPaid,
      };
    }), [groupedTableOrders]);

  // ─── COLLECT VOIDED ITEMS - ONLY voided items, not tables ─────────────────
  const voidedItemsList = useMemo(() => {
    const items = [];
    enrichedGroups.forEach(group => {
      (group.items || []).forEach(item => {
        if (item.status === "VOIDED" || item.voidProcessed === true) {
          items.push({
            ...item,
            tableName: group.tableName,
          });
        }
      });
    });
    return items;
  }, [enrichedGroups]);

  // ─── FETCH CREDITS ────────────────────────────────────────────────────────
  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders/credits`);
      if (res.ok) {
        const data = await res.json();
        setCreditsData(data);
      }
    } catch (err) {
      console.error("Failed to fetch credits:", err);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits, refreshData]);

  // ─── ACTIONS ───────────────────────────────────────────────────────────────
  const handleMarkServed = useCallback(async (order) => {
    try {
      await Promise.all((order.orderIds || []).map(id =>
        fetch(`${API_URL}/api/orders/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Served" }),
        })
      ));
      refreshData?.();
    } catch (err) { console.error("Mark served failed:", err); }
  }, [refreshData]);

  const handleUnserve = useCallback(async (order) => {
    try {
      await Promise.all((order.orderIds || []).map(id =>
        fetch(`${API_URL}/api/orders/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Ready" }),
        })
      ));
      refreshData?.();
    } catch (err) { console.error("Unserve failed:", err); }
  }, [refreshData]);

  const handleMarkTablePaid = useCallback(async (order) => {
    try {
      await Promise.all((order.orderIds || []).map(id =>
        fetch(`${API_URL}/api/orders/${id}/pay`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Paid", payment_method: "Cash" }),
        })
      ));
      refreshData?.();
      fetchCredits();
    } catch (err) { console.error("Mark paid failed:", err); }
  }, [refreshData, fetchCredits]);

  const handleMarkCreditCollected = useCallback(async (credit) => {
    try {
      const res = await fetch(`${API_URL}/api/cashier-ops/credits/${credit.id}/settle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          settled_by: currentStaffName,
          settle_method: "Cash",
          amount_paid: credit.balance || credit.amount,
        }),
      });
      if (res.ok) {
        refreshData?.();
        fetchCredits();
      }
    } catch (err) { console.error("Mark credit collected failed:", err); }
  }, [currentStaffName, refreshData, fetchCredits]);

  const handleSend = useCallback(async (payload) => {
    try {
      const res = await fetch(`${API_URL}/api/cashier-ops/send-to-cashier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_ids: payload.orderIds,
          table_name: payload.tableName,
          label: payload.label,
          method: payload.method,
          amount: payload.amount,
          is_item: payload.type === "item",
          item: payload.item,
          credit_info: payload.creditInfo,
          requested_by: currentStaffName,
          staff_id: currentStaffId,
        }),
      });
      
      if (res.ok) {
        if (payload.type === "table") {
          payload.orderIds.forEach(orderId => {
            setPendingPayments(prev => ({
              ...prev,
              [`${orderId}_table`]: true
            }));
          });
        } else if (payload.type === "item" && payload.orderId) {
          setPendingPayments(prev => ({
            ...prev,
            [`${payload.orderId}_${payload.item?.name}`]: true
          }));
        }
        
        refreshData?.();
        fetchCredits();
      }
    } catch (err) { console.error("Send failed:", err); }
  }, [currentStaffName, currentStaffId, refreshData, fetchCredits]);

  const handleVoidConfirm = useCallback(async (item, reason) => {
    const orderId = item?._orderId;
    if (!orderId) {
      console.error("No Order ID found for void request — item:", item);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/orders/void-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id:     orderId,
          item_name:    item.name,
          reason,
          requested_by: currentStaffName,
        }),
      });
      if (res.ok) {
        refreshData?.();
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("Void failed:", errData?.message);
      }
    } catch (err) {
      console.error("Void request network error:", err);
    }
  }, [currentStaffName, refreshData]);

  // ─── FILTERING ─────────────────────────────────────────────────────────────
  const filteredOrders = useMemo(() =>
    enrichedGroups.filter(g => {
      const matchSearch = g.tableName.toLowerCase().includes(searchQuery.toLowerCase());
      const hasNonVoidedItems = (g.items || []).some(i => i.status !== "VOIDED" && !i.voidProcessed);
      const isPaidGroup = g.status === "Paid" || g._rows.every(r => r.paid);
      const isLiveGroup = ["Pending", "Preparing", "Ready", "Delayed", "Served"].includes(g.status) && !isPaidGroup;
      
      let matchTab = false;
      switch (activeTab) {
        case "Live":
          matchTab = isLiveGroup && hasNonVoidedItems;
          break;
        case "Served":
          matchTab = g.status === "Served" && !isPaidGroup && hasNonVoidedItems;
          break;
        case "Paid":
          matchTab = isPaidGroup;
          break;
        default:
          matchTab = false;
      }
      return matchSearch && matchTab;
    }), [enrichedGroups, searchQuery, activeTab]);

  const counts = useMemo(() => {
    const acc = { Live: 0, Served: 0, Paid: 0, Credits: creditsData.length, Voided: voidedItemsList.length };
    enrichedGroups.forEach(g => {
      const hasNonVoidedItems = (g.items || []).some(i => i.status !== "VOIDED" && !i.voidProcessed);
      const isPaid    = g.status === "Paid" || g._rows.every(r => r.paid);
      const isLive    = ["Pending", "Preparing", "Ready", "Delayed", "Served"].includes(g.status) && !isPaid;
      
      if (isLive && hasNonVoidedItems) acc.Live++;
      if (g.status === "Served" && !isPaid && hasNonVoidedItems) acc.Served++;
      if (isPaid) acc.Paid++;
    });
    return acc;
  }, [enrichedGroups, voidedItemsList, creditsData]);

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen font-[Outfit] pb-28 ${theme === "dark" ? "bg-zinc-950 text-white" : "bg-zinc-50 text-zinc-900"}`}>

      {/* Header */}
      <div className={`sticky top-0 z-20 w-full border-b px-6 py-4 flex items-center justify-between
        ${theme === "dark" ? "bg-zinc-950/80 backdrop-blur-xl border-white/5" : "bg-white/80 backdrop-blur-xl border-black/5"}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-yellow-500 flex items-center justify-center font-black text-black shadow-lg shadow-yellow-500/20">
            {currentStaffName[0]}
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-tight">{currentStaffName.split(" ")[0]}'s Tables</h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{today}</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
          <ClipboardList size={14} className="text-yellow-500" />
          <span className="text-[10px] font-black uppercase tracking-widest">{dailyStaffOrders.length} Active Orders</span>
        </div>
      </div>

      <div className="px-6 pt-6">

        {/* Navigation & Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex flex-wrap p-1 bg-white/5 rounded-2xl border border-white/5 w-fit gap-1">
            {["Live", "Served", "Paid", "Credits", "Voided"].map(tab => {
              const isActive = activeTab === tab;
              const count    = counts[tab] || 0;
              let activeStyles = "bg-yellow-500 text-black shadow-yellow-500/20";
              if (tab === "Voided") activeStyles = "bg-red-500 text-white shadow-red-500/20";
              if (tab === "Credits") activeStyles = "bg-purple-500 text-white shadow-purple-500/20";
              if (tab === "Paid") activeStyles = "bg-emerald-500 text-white shadow-emerald-500/20";
              const badgeStyles = isActive
                ? "bg-white/20 text-current"
                : theme === "dark" ? "bg-white/10 text-zinc-400" : "bg-black/5 text-zinc-500";
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2
                    ${isActive ? `${activeStyles} shadow-lg scale-[1.02]` : "text-zinc-500 hover:text-zinc-300"}`}>
                  {tab}
                  {count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black leading-none ${badgeStyles}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input
              type="text"
              placeholder="Search table name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-yellow-500/50 transition-all text-white placeholder-zinc-500" />
          </div>
        </div>

        {/* Conditional Rendering Based on Active Tab */}
        {activeTab === "Voided" ? (
          <VoidedItemsPanel voidedItems={voidedItemsList} theme={theme} />
        ) : activeTab === "Credits" ? (
          <CreditedItemsPanel 
            creditedItems={creditsData} 
            theme={theme} 
            onMarkCreditCollected={handleMarkCreditCollected}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredOrders.map(order => (
              <OrderCard
                key={order.tableName}
                order={order}
                theme={theme}
                onUnserve={handleUnserve}
                onMarkServed={handleMarkServed}
                onMarkTablePaid={handleMarkTablePaid}
                onPayItem={(item, ord) => {
                  const safeOrdId = item?._orderId ?? null;
                  setPayTarget({
                    type:      "item",
                    item,
                    tableName: ord?.tableName ?? order.tableName,
                    total:     Number(item?.price || 0) * Number(item?.quantity || 1),
                    orderId:   safeOrdId,
                    orderIds:  safeOrdId ? [safeOrdId] : [],
                  });
                }}
                onPayTable={(o) => setPayTarget({
                  type:      "table",
                  tableName: o.tableName,
                  total:     o.total,
                  orderIds:  o.orderIds,
                  orderId:   null,
                })}
                onVoidItem={(item, ord) => setVoidTarget({ item, order: ord })}
              />
            ))}

            {filteredOrders.length === 0 && (
              <div className="col-span-full py-32 text-center opacity-30">
                <div className="flex justify-center mb-4"><Utensils size={48} /></div>
                <p className="font-black uppercase tracking-[0.3em] text-xs">No {activeTab} Orders Found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {payTarget && (
        <PayModal
          target={payTarget}
          onClose={() => setPayTarget(null)}
          onSend={handleSend}
        />
      )}

      {voidTarget && (
        <VoidModal
          item={voidTarget.item}
          tableName={voidTarget.order?.tableName}
          onClose={() => setVoidTarget(null)}
          onConfirmVoid={handleVoidConfirm}
        />
      )}
    </div>
  );
}