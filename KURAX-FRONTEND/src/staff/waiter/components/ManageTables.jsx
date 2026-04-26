import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { useNavigate } from 'react-router-dom';
import { 
  Plus, RotateCcw, Send, Bell, Lock, AlertCircle, X, Coffee, Wine, Smartphone, CreditCard, Phone,
  Utensils, ChevronUp, ChevronDown, CheckCircle, 
  AlertTriangle, Clock, Receipt, Banknote,
  Calendar, User, BookOpen, ClipboardList, Search, Hourglass,
  CheckCircle2, XCircle, Award, CircleDollarSign, Zap
} from 'lucide-react';
import API_URL from "../../../config/api";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(d.toLocaleString("en-US", { timeZone: "Africa/Nairobi" }))
    .toISOString().split("T")[0];
}
function getTodayLocal() { return toLocalDateStr(new Date()); }

function fmtUGX(n) {
  return `UGX ${Number(n || 0).toLocaleString()}`;
}

function fmtLargeNumber(n) {
  const num = Number(n || 0);
  if (num >= 1_000_000) {
    return `UGX ${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `UGX ${(num / 1_000).toFixed(0)}K`;
  }
  return `UGX ${num.toLocaleString()}`;
}

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

// ─── PAY MODAL (Single Payment) ───────────────────────────────────────────────
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
      await onSend({
        type:       target?.type,
        tableName:  target?.tableName,
        method,
        amount,
        label,
        orderId:    target?.orderId,
        orderIds:   target?.orderIds || [],
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
      <div className="w-full max-w-md bg-zinc-950 rounded-t-2xl sm:rounded-2xl border border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-zinc-950 z-10 flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-white/5">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">
              {isItem ? "Item Payment" : "Table Payment"} · {target?.tableName}
            </p>
            <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-tight leading-tight truncate">{label}</h2>
            <p className="text-zinc-400 text-xs mt-0.5">UGX {amount.toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 shrink-0">
            <X size={16} className="text-zinc-400" />
          </button>
        </div>
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Select Payment Method</p>
            <div className="grid grid-cols-2 gap-2">
              {PAY_METHODS.map(({ key, label: ml, icon, color, bg }) => (
                <button key={key} onClick={() => setMethod(key)}
                  className={`flex flex-col items-center gap-2 py-3 sm:py-4 rounded-xl sm:rounded-2xl border-2 transition-all font-black text-[9px] sm:text-[10px] uppercase tracking-widest
                    ${method === key ? `${bg} ${color} scale-[1.02] shadow-lg` : "border-white/5 bg-white/3 text-zinc-500 hover:border-white/20"}`}>
                  <span className={method === key ? color : "text-zinc-600"}>{icon}</span>
                  <span className="text-[9px] sm:text-[10px]">{ml}</span>
                </button>
              ))}
            </div>
          </div>
          {isMomo && MOMO_CODES[method] && (
            <div className="bg-white/3 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/5 space-y-2">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Payment Instructions</p>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-0">
                <span className="text-[9px] sm:text-[10px] text-zinc-500 uppercase font-bold">Merchant Code</span>
                <span className="font-black text-white text-xs sm:text-sm tracking-widest">{MOMO_CODES[method].merchant}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-0">
                <span className="text-[9px] sm:text-[10px] text-zinc-500 uppercase font-bold">Till Number</span>
                <span className="font-black text-yellow-400 text-xs sm:text-sm">{MOMO_CODES[method].till}</span>
              </div>
            </div>
          )}
          {isCredit && (
            <div className="space-y-3">
              <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Client Details (Required)</p>
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  value={creditName} 
                  onChange={e => setCreditName(e.target.value)}
                  placeholder="Client full name *"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl sm:rounded-2xl pl-9 pr-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500/40" 
                />
              </div>
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  value={creditPhone} 
                  onChange={e => setCreditPhone(e.target.value)}
                  placeholder="Phone number *" 
                  type="tel"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl sm:rounded-2xl pl-9 pr-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500/40" 
                />
              </div>
              <textarea 
                value={creditNote} 
                onChange={e => setCreditNote(e.target.value)}
                placeholder="Expected pay-by date — e.g. 'pays every Friday' or '2025-08-10'"
                className="w-full bg-zinc-900 border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500/40 resize-none h-16" 
              />
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
                <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Credit requires cashier → manager approval</p>
              </div>
            </div>
          )}
          <div className="bg-white/3 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex justify-between items-center border border-white/5">
            <span className="text-[10px] sm:text-[11px] font-black text-zinc-400 uppercase tracking-widest">
              {isItem ? "Item Total" : "Table Total"}
            </span>
            <span className="font-black text-white text-lg sm:text-xl">UGX {amount.toLocaleString()}</span>
          </div>
          <button disabled={!canSend || sending} onClick={handleSend}
            className={`w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2
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
      <div className="w-full max-w-sm bg-zinc-950 rounded-t-2xl sm:rounded-2xl border border-red-500/20 overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-red-500/10 flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-white text-xs sm:text-sm">Request Void</p>
              <p className="text-[9px] sm:text-[10px] text-zinc-500 truncate">{tableName} · {item?.name}</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 flex items-center justify-center">
              <X size={14} className="text-zinc-400" />
            </button>
          </div>
          <div className="bg-white/3 rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-4 border border-white/5">
            <div className="flex justify-between">
              <span className="text-white font-black text-xs sm:text-sm truncate">{item?.name}</span>
              <span className="text-yellow-400 font-black text-xs sm:text-sm shrink-0 ml-2">x{item?.quantity || 1}</span>
            </div>
            <p className="text-zinc-500 text-[9px] sm:text-[10px] mt-1">UGX {Number(item?.price || 0).toLocaleString()}</p>
          </div>
          <textarea 
            value={reason} 
            onChange={e => setReason(e.target.value)}
            placeholder="Reason for void request…"
            className="w-full bg-zinc-900 border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-red-500/40 resize-none h-16 sm:h-20 mb-4" 
          />
          <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse shrink-0" />
            <p className="text-[8px] sm:text-[9px] font-black text-orange-400 uppercase tracking-widest">Request will be sent to accountant for approval</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onClose}
              className="py-2.5 sm:py-3 rounded-xl border border-white/10 text-zinc-400 font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-white/5">Cancel</button>
            <button onClick={handleVoid} disabled={!reason.trim() || loading}
              className="py-2.5 sm:py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? "Sending…" : "Request Void"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper to get credit status display
function getCreditStatusDisplay(credit) {
  const status = credit.status;
  const isFullySettled = status === "FullySettled" || credit.paid === true;
  const isPartiallySettled = status === "PartiallySettled";
  const isRejected = status === "Rejected";
  const isPendingManager = status === "PendingManagerApproval";
  const isPendingCashier = status === "PendingCashier";
  const isApproved = status === "Approved";
  
  if (isFullySettled) {
    return { label: "Settled ✓", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: <CheckCircle2 size={10} /> };
  }
  if (isPartiallySettled) {
    return { label: "Partially Settled", color: "text-yellow-500", bg: "bg-yellow-500/10", icon: <Clock size={10} /> };
  }
  if (isRejected) {
    return { label: "Rejected ✗", color: "text-red-500", bg: "bg-red-500/10", icon: <XCircle size={10} /> };
  }
  if (isPendingManager || isPendingCashier) {
    return { label: "Pending Approval", color: "text-orange-500", bg: "bg-orange-500/10", icon: <Clock size={10} className="animate-pulse" /> };
  }
  if (isApproved) {
    return { label: "Approved", color: "text-purple-500", bg: "bg-purple-500/10", icon: <CheckCircle size={10} /> };
  }
  return { label: "Outstanding", color: "text-purple-400", bg: "bg-purple-500/10", icon: <BookOpen size={10} /> };
}

// ─── CREDITED ITEMS PANEL ────────────────────────────────────────────────────
function CreditedItemsPanel({ creditedItems, theme }) {
  const isDark = theme === "dark";
  
  const myCredits = creditedItems || [];
  
  const creditStats = useMemo(() => {
    const settled = myCredits.filter(c => c.status === "FullySettled" || c.paid === true);
    const partiallySettled = myCredits.filter(c => c.status === "PartiallySettled");
    const approved = myCredits.filter(c => c.status === "Approved");
    const rejected = myCredits.filter(c => c.status === "Rejected");
    
    const fullySettledAmount = settled.reduce((s, c) => s + Number(c.amount_paid || c.amount || 0), 0);
    const partiallySettledPaidAmount = partiallySettled.reduce((s, c) => s + Number(c.amount_paid || 0), 0);
    const settledAmount = fullySettledAmount + partiallySettledPaidAmount;
    
    const approvedAmount = approved.reduce((s, c) => s + Number(c.amount || 0), 0);
    const partiallySettledRemaining = partiallySettled.reduce((s, c) => s + Number(c.balance || c.amount || 0), 0);
    const outstandingAmount = approvedAmount + partiallySettledRemaining;
    
    const rejectedAmount = rejected.reduce((s, c) => s + Number(c.amount || 0), 0);
    
    return {
      settled: { count: settled.length + partiallySettled.length, amount: settledAmount },
      outstanding: { count: approved.length + partiallySettled.length, amount: outstandingAmount },
      rejected: { count: rejected.length, amount: rejectedAmount },
      total: myCredits.length,
      totalAmount: myCredits.reduce((s, c) => s + Number(c.amount || 0), 0),
    };
  }, [myCredits]);

  if (!creditedItems || creditedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-28 gap-3 sm:gap-4">
        <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center
          ${isDark ? "bg-purple-500/10 border border-purple-500/20" : "bg-purple-50 border border-purple-100"}`}>
          <BookOpen size={24} className="text-purple-400/60"/>
        </div>
        <div className="text-center">
          <p className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>No credit requests</p>
          <p className={`text-[8px] sm:text-[10px] mt-1 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>Credits requested will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-6 sm:pb-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

        {/* Settled Credits */}
        <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border ${isDark ? "bg-zinc-900 border-white/5" : "bg-white border-zinc-100"}`}>
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-emerald-500/10"><CheckCircle2 size={14} className="text-emerald-500" /></div>
            <h3 className={`text-xs sm:text-sm font-black uppercase tracking-tighter ${isDark ? "text-white" : "text-zinc-900"}`}>Settled Credits</h3>
            <span className="ml-auto text-[8px] sm:text-[10px] font-black text-emerald-500 whitespace-nowrap">{creditStats.settled.count} records</span>
          </div>
          <div className="mb-3 pb-2 border-b border-zinc-100">
            <p className="text-[9px] sm:text-[10px] text-zinc-500">Total Settled</p>
            <p className="text-base sm:text-lg font-black text-emerald-600 break-words">{fmtLargeNumber(creditStats.settled.amount)}</p>
          </div>
          <div className="space-y-2 sm:space-y-3 max-h-80 overflow-y-auto">
            {myCredits.filter(c => c.status === "FullySettled" || c.status === "PartiallySettled" || c.paid === true).map((credit, idx) => {
              const sd = getCreditStatusDisplay(credit);
              const displayAmount = credit.status === "PartiallySettled" ? credit.amount_paid : (credit.amount_paid || credit.amount);
              return (
                <div key={idx} className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? "bg-zinc-800/50" : "bg-zinc-50"}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-[10px] sm:text-[11px] font-black break-words ${isDark ? "text-white" : "text-zinc-900"}`}>{credit.table_name || "Table"}</p>
                      <p className={`text-[7px] sm:text-[8px] font-bold uppercase mt-0.5 break-words ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{credit.client_name || "Client"} · {credit.label || "Credit"}</p>
                      {credit.settle_method && <p className="text-[6px] sm:text-[7px] text-emerald-500 mt-1 break-words">Paid via {credit.settle_method}</p>}
                      {credit.status === "PartiallySettled" && credit.balance > 0 && (
                        <p className="text-[6px] sm:text-[7px] text-yellow-500 mt-1 break-words">Remaining: {fmtUGX(credit.balance)}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] sm:text-[11px] font-black text-emerald-500 whitespace-nowrap">{fmtUGX(displayAmount)}</p>
                      <div className="flex items-center gap-1 mt-1 justify-end">{sd.icon}<span className={`text-[6px] sm:text-[7px] font-black uppercase ${sd.color}`}>{sd.label}</span></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Outstanding Credits */}
        <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border ${isDark ? "bg-zinc-900 border-white/5" : "bg-white border-zinc-100"}`}>
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-orange-500/10"><AlertCircle size={14} className="text-orange-500" /></div>
            <h3 className={`text-xs sm:text-sm font-black uppercase tracking-tighter ${isDark ? "text-white" : "text-zinc-900"}`}>Outstanding Credits</h3>
            <span className="ml-auto text-[8px] sm:text-[10px] font-black text-orange-500 whitespace-nowrap">{creditStats.outstanding.count} records</span>
          </div>
          <div className="mb-3 pb-2 border-b border-zinc-100">
            <p className="text-[9px] sm:text-[10px] text-zinc-500">Total Outstanding</p>
            <p className="text-base sm:text-lg font-black text-orange-600 break-words">{fmtLargeNumber(creditStats.outstanding.amount)}</p>
          </div>
          <div className="space-y-2 sm:space-y-3 max-h-80 overflow-y-auto">
            {myCredits.filter(c => c.status === "Approved" || c.status === "PartiallySettled").map((credit, idx) => {
              const sd = getCreditStatusDisplay(credit);
              const displayAmount = credit.status === "PartiallySettled" ? (credit.balance || credit.amount) : credit.amount;
              return (
                <div key={idx} className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? "bg-zinc-800/50" : "bg-zinc-50"}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-[10px] sm:text-[11px] font-black break-words ${isDark ? "text-white" : "text-zinc-900"}`}>{credit.table_name || "Table"}</p>
                      <p className={`text-[7px] sm:text-[8px] font-bold uppercase mt-0.5 break-words ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{credit.client_name || "Client"} · {credit.pay_by ? `Pay by: ${credit.pay_by}` : "No due date"}</p>
                      {Number(credit.amount_paid) > 0 && <p className="text-[6px] sm:text-[7px] text-yellow-500 mt-1 break-words">Paid: {fmtUGX(credit.amount_paid)}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] sm:text-[11px] font-black text-orange-500 whitespace-nowrap">{fmtUGX(displayAmount)}</p>
                      <div className="flex items-center gap-1 mt-1 justify-end">{sd.icon}<span className={`text-[6px] sm:text-[7px] font-black uppercase ${sd.color}`}>{sd.label}</span></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rejected Credits */}
        <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border ${isDark ? "bg-zinc-900 border-white/5" : "bg-white border-zinc-100"}`}>
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-red-500/10"><XCircle size={14} className="text-red-500" /></div>
            <h3 className={`text-xs sm:text-sm font-black uppercase tracking-tighter ${isDark ? "text-white" : "text-zinc-900"}`}>Rejected Credits</h3>
            <span className="ml-auto text-[8px] sm:text-[10px] font-black text-red-500 whitespace-nowrap">{creditStats.rejected.count} records</span>
          </div>
          <div className="mb-3 pb-2 border-b border-zinc-100">
            <p className="text-[9px] sm:text-[10px] text-zinc-500">Total Rejected</p>
            <p className="text-base sm:text-lg font-black text-red-600 break-words">{fmtLargeNumber(creditStats.rejected.amount)}</p>
          </div>
          <div className="space-y-2 sm:space-y-3 max-h-80 overflow-y-auto">
            {myCredits.filter(c => c.status === "Rejected").map((credit, idx) => {
              const sd = getCreditStatusDisplay(credit);
              return (
                <div key={idx} className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? "bg-zinc-800/50" : "bg-zinc-50"}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-[10px] sm:text-[11px] font-black break-words ${isDark ? "text-white" : "text-zinc-900"}`}>{credit.table_name || "Table"}</p>
                      <p className={`text-[7px] sm:text-[8px] font-bold uppercase mt-0.5 break-words ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{credit.client_name || "Client"}</p>
                      {credit.reject_reason && <p className="text-[6px] sm:text-[7px] text-red-500 mt-1 break-words">Reason: {credit.reject_reason}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] sm:text-[11px] font-black text-red-500 whitespace-nowrap">{fmtUGX(credit.amount)}</p>
                      <div className="flex items-center gap-1 mt-1 justify-end">{sd.icon}<span className={`text-[6px] sm:text-[7px] font-black uppercase ${sd.color}`}>{sd.label}</span></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pending approvals section */}
      {myCredits.filter(c => c.status === "PendingCashier" || c.status === "PendingManagerApproval").length > 0 && (
        <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border ${isDark ? "bg-zinc-900 border-white/5" : "bg-white border-zinc-100"}`}>
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-yellow-500/10"><Clock size={14} className="text-yellow-500" /></div>
            <h3 className={`text-xs sm:text-sm font-black uppercase tracking-tighter ${isDark ? "text-white" : "text-zinc-900"}`}>Pending Approvals</h3>
            <span className="ml-auto text-[8px] sm:text-[10px] font-black text-yellow-500 whitespace-nowrap">
              {myCredits.filter(c => c.status === "PendingCashier" || c.status === "PendingManagerApproval").length} records
            </span>
          </div>
          <div className="space-y-2 sm:space-y-3 max-h-80 overflow-y-auto">
            {myCredits.filter(c => c.status === "PendingCashier" || c.status === "PendingManagerApproval").map((credit, idx) => {
              const sd = getCreditStatusDisplay(credit);
              return (
                <div key={idx} className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? "bg-zinc-800/50" : "bg-zinc-50"}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-[10px] sm:text-[11px] font-black break-words ${isDark ? "text-white" : "text-zinc-900"}`}>{credit.table_name || "Table"}</p>
                      <p className={`text-[7px] sm:text-[8px] font-bold uppercase mt-0.5 break-words ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{credit.client_name || "Client"} · {credit.label || "Credit"}</p>
                      {credit.pay_by && <p className="text-[6px] sm:text-[7px] text-amber-500 mt-1 break-words">Pay by: {credit.pay_by}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-[10px] sm:text-[11px] font-black whitespace-nowrap ${sd.color}`}>{fmtUGX(credit.amount)}</p>
                      <div className="flex items-center gap-1 mt-1 justify-end">{sd.icon}<span className={`text-[6px] sm:text-[7px] font-black uppercase ${sd.color}`}>{sd.label}</span></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RECENTLY PAID ITEMS PANEL ────────────────────────────────────────────────
function RecentlyPaidItemsPanel({ orders, theme }) {
  const isDark = theme === "dark";
  
  const paidItems = useMemo(() => {
    const items = [];
    orders.forEach(order => {
      let orderItems = order.items || [];
      if (typeof orderItems === 'string') {
        try {
          orderItems = JSON.parse(orderItems);
        } catch {
          orderItems = [];
        }
      }
      
      orderItems.forEach(item => {
        if (item._rowPaid === true || item.paid_at) {
          items.push({
            id: `${order.id}_${item.name}`,
            order_id: order.id,
            table_name: order.table_name,
            name: item.name,
            quantity: item.quantity || 1,
            price: item.price || 0,
            total: (item.price || 0) * (item.quantity || 1),
            payment_method: item.payment_method || "Cash",
            paid_at: item.paid_at || new Date().toISOString(),
            timestamp: order.timestamp || order.created_at,
          });
        }
      });
    });
    
    items.sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at));
    return items;
  }, [orders]);

  if (paidItems.length === 0) {
    return (
      <div className={`rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-sm border ${isDark ? "bg-zinc-900 border-white/5" : "bg-white border-zinc-100"} text-center`}>
        <div className="flex flex-col items-center justify-center gap-3">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center ${isDark ? "bg-emerald-500/10" : "bg-emerald-50"}`}>
            <CheckCircle2 size={20} className="text-emerald-400" />
          </div>
          <p className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            No paid items yet
          </p>
          <p className="text-[8px] sm:text-[9px] text-zinc-400">Items paid by cashier will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border ${isDark ? "bg-zinc-900 border-white/5" : "bg-white border-zinc-100"}`}>
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-wrap">
        <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-emerald-500/10">
          <CheckCircle2 size={14} className="text-emerald-500" />
        </div>
        <h3 className={`text-xs sm:text-sm font-black uppercase tracking-tighter ${isDark ? "text-white" : "text-zinc-900"}`}>
          Paid Items History
        </h3>
        <span className="ml-auto text-[8px] sm:text-[10px] font-black text-emerald-500 whitespace-nowrap">
          Total: {paidItems.length} items
        </span>
      </div>
      
      <div className="space-y-2 sm:space-y-3 max-h-96 overflow-y-auto">
        {paidItems.map((item, idx) => {
          const date = new Date(item.paid_at);
          const dateStr = date.toLocaleDateString("en-GB", { 
            day: "2-digit", 
            month: "short", 
            hour: "2-digit", 
            minute: "2-digit" 
          });
          
          return (
            <div key={idx} className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? "bg-zinc-800/50" : "bg-zinc-50"}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-[10px] sm:text-[11px] font-black break-words ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {item.name}
                    </p>
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[6px] sm:text-[7px] font-black uppercase">
                      Paid
                    </span>
                  </div>
                  <p className={`text-[8px] sm:text-[9px] font-bold uppercase mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                    Table: {item.table_name || "WALK-IN"} · Order #{String(item.order_id).slice(-6)}
                  </p>
                  <div className="flex items-center gap-2 sm:gap-3 mt-1 flex-wrap">
                    <p className="text-[7px] sm:text-[8px] text-zinc-500">Qty: {item.quantity}</p>
                    <p className="text-[7px] sm:text-[8px] text-emerald-500">Paid via: {item.payment_method}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] sm:text-[11px] font-black text-emerald-500 whitespace-nowrap">
                    {fmtUGX(item.total)}
                  </p>
                  <p className="text-[7px] sm:text-[8px] text-zinc-500 mt-1">{dateStr}</p>
                </div>
              </div>
            </div>
          );
        })}
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
  const [isSendingPayment, setIsSendingPayment] = useState(false);
  const navigate = useNavigate();
  const isDark = theme === "dark";

  if (!order) return null;

  const isReady         = order.status === "Ready";
  const isServed        = order.status === "Served";
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

  const payableItems = (order.items || []).filter(item => {
    return !item._rowPaid && item.status !== "VOIDED" && !item.voidProcessed && !item.paymentRequested && !item.creditRequested;
  });

  const allItemsVoided = order.items?.length > 0 && order.items.every(
    item => item.voidProcessed === true || item.status === "VOIDED"
  );

  const allItemsPaidOrRequested = order.items?.length > 0 && order.items.every(
    item => item._rowPaid === true || item.paymentRequested === true || item.creditRequested === true || item.status === "VOIDED" || item.voidProcessed === true
  );

  const nonVoidedItems = (order.items || []).filter(i => i.status !== "VOIDED" && !i.voidProcessed);
  const allItemsPaid = nonVoidedItems.length > 0 && nonVoidedItems.every(item => item._rowPaid === true);
  const hasAnyPaidItems = nonVoidedItems.some(item => item._rowPaid === true);
  const hasAnyCreditItems = nonVoidedItems.some(item => item.creditRequested === true);
  const hasAnyPendingItems = nonVoidedItems.some(item => !item._rowPaid && !item.paymentRequested && !item.creditRequested);
  const hasAnyPaymentRequested = nonVoidedItems.some(item => item.paymentRequested === true);

  const hasTablePaymentRequested = order.orderIds?.some(orderId => 
    localStorage.getItem(`payment_sent_${orderId}`) === 'true'
  ) || false;

  // Display status pill
  let displayStatus = order.status;
  let displayColor = "text-zinc-400";
  let displayBg = "bg-zinc-500/10 border-zinc-500/20";
  let displayDot = "bg-zinc-400";

  if (allItemsVoided) {
    displayStatus = "All Voided";
    displayColor = "text-red-400";
    displayBg = "bg-red-500/10 border-red-500/20";
    displayDot = "bg-red-400";
  } else if (allItemsPaid) {
    displayStatus = "Paid ✓";
    displayColor = "text-emerald-400";
    displayBg = "bg-emerald-500/10 border-emerald-500/20";
    displayDot = "bg-emerald-400";
  } else if (hasAnyPaidItems && hasAnyCreditItems) {
    displayStatus = "Mixed Payment";
    displayColor = "text-purple-400";
    displayBg = "bg-purple-500/10 border-purple-500/20";
    displayDot = "bg-purple-400";
  } else if (hasAnyCreditItems) {
    displayStatus = "Credit";
    displayColor = "text-purple-400";
    displayBg = "bg-purple-500/10 border-purple-500/20";
    displayDot = "bg-purple-400";
  } else if (hasAnyPaymentRequested || hasTablePaymentRequested) {
    displayStatus = "Awaiting Cashier";
    displayColor = "text-yellow-500";
    displayBg = "bg-yellow-500/10 border-yellow-500/20";
    displayDot = "bg-yellow-400 animate-pulse";
  } else if (hasAnyPaidItems) {
    displayStatus = "Partially Paid";
    displayColor = "text-blue-400";
    displayBg = "bg-blue-500/10 border-blue-500/20";
    displayDot = "bg-blue-400";
  } else if (hasAnyPendingItems) {
    if (order.status === "Ready") {
      displayStatus = "🔔 Ready!";
      displayColor = "text-yellow-900";
      displayBg = "bg-yellow-400/10 border-yellow-400/30";
      displayDot = "bg-yellow-400";
    } else if (order.status === "Served") {
      displayStatus = "Served";
      displayColor = "text-blue-400";
      displayBg = "bg-blue-500/10 border-blue-500/20";
      displayDot = "bg-blue-400";
    } else {
      displayStatus = order.status;
    }
  }

  // If table is fully paid, show simple view
  if (allItemsPaid) {
    return (
      <div className={`rounded-xl sm:rounded-2xl border overflow-hidden transition-all duration-300 mb-4
        ${isDark ? "bg-zinc-900 border-white/5" : "bg-white border-black/5 shadow-sm"}`}>
        <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2 sm:pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className={`font-black text-sm sm:text-base uppercase ${isDark ? "text-white" : "text-zinc-900"}`}>
                {order.tableName}
              </span>
              <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500">
                {nonVoidedItems.length} items · UGX {(order.total || 0).toLocaleString()}
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl border text-[7px] sm:text-[8px] font-black uppercase bg-emerald-500/10 border-emerald-500/20 text-emerald-400`}>
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              Paid ✓
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl sm:rounded-2xl border overflow-hidden transition-all duration-300 mb-4
      ${hasPendingVoid ? "border-orange-500/30 shadow-lg shadow-orange-500/5" : ""}
      ${hasPendingPayment ? "border-yellow-500/30 shadow-lg shadow-yellow-500/5" : ""}
      ${isDark ? "bg-zinc-900 border-white/5" : "bg-white border-black/5 shadow-sm"}`}>

      <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2 sm:pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className={`font-black text-sm sm:text-base uppercase ${isDark ? "text-white" : "text-zinc-900"}`}>
              {order.tableName}
            </span>
            <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500">
              {nonVoidedItems.length} items · UGX {(order.total || 0).toLocaleString()}
            </p>
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl border text-[7px] sm:text-[8px] font-black uppercase ${displayBg} ${displayColor}`}>
            <span className={`w-1 h-1 rounded-full ${displayDot}`} />
            {displayStatus}
          </div>
        </div>

        <button onClick={() => setExpanded(!expanded)}
          className={`mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all
            ${isDark ? "bg-white/5 text-zinc-400" : "bg-zinc-50 text-zinc-500"}`}>
          <Utensils size={10} />
          {expanded ? "Hide Items" : "View Items"}
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      </div>

      {expanded && (
        <div className="px-3 sm:px-4 pb-3 space-y-2 border-t border-black/5 pt-3">
          <div className="mb-2 flex items-center gap-2">
            <CircleDollarSign size={10} className="text-yellow-500" />
            <p className="text-[7px] sm:text-[8px] font-black text-yellow-400 uppercase tracking-widest">
              Click the receipt icon on any item to pay it individually
            </p>
          </div>
          {nonVoidedItems.map((item, i) => (
            <div key={i} className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${isDark ? "bg-white/5" : "bg-zinc-50"}`}>
              <div className="flex justify-between items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className={`font-black text-[10px] sm:text-[12px] break-words`}>
                    {item.name}
                    {item.voidRequested && !item.voidProcessed && (
                      <span className="ml-1 sm:ml-2 text-[7px] sm:text-[8px] text-orange-400 font-black uppercase">(waiting accountant)</span>
                    )}
                    {item.paymentRequested && !item._rowPaid && (
                      <span className="ml-1 sm:ml-2 text-[7px] sm:text-[8px] text-yellow-400 font-black uppercase">(awaiting cashier)</span>
                    )}
                    {item.creditRequested && !item._rowPaid && (
                      <span className="ml-1 sm:ml-2 text-[7px] sm:text-[8px] text-purple-400 font-black uppercase">(credit pending)</span>
                    )}
                    {item._rowPaid && (
                      <span className="ml-1 sm:ml-2 text-[7px] sm:text-[8px] text-emerald-400 font-black uppercase">✓ paid</span>
                    )}
                  </p>
                  <p className="text-[8px] sm:text-[9px] font-bold text-zinc-400">
                    ×{item.quantity || 1} · UGX {Number(item.price || 0).toLocaleString()}
                  </p>
                </div>

                <div className="flex gap-1 sm:gap-1.5 shrink-0">
                  {isServed && !item._rowPaid && item.status !== 'VOIDED' && !item.voidProcessed && !item.paymentRequested && !item.creditRequested && !hasTablePaymentRequested && (
                    <button
                      onClick={() => onPayItem && onPayItem(item, order)}
                      className="p-1.5 bg-yellow-500/10 text-yellow-500 rounded-lg hover:bg-yellow-500/20 transition-all"
                      title="Pay this item individually">
                      <Receipt size={11} />
                    </button>
                  )}
                  {item.paymentRequested && !item._rowPaid && (
                    <div className="p-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg flex items-center gap-1">
                      <Hourglass size={9} />
                      <span className="text-[6px] sm:text-[8px] font-black hidden sm:inline">Awaiting</span>
                    </div>
                  )}
                  {!item._rowPaid && item.status !== 'VOIDED' && !item.voidProcessed && !item.voidRequested && !item.paymentRequested && !item.creditRequested && !hasTablePaymentRequested && (
                    <button
                      onClick={() => onVoidItem && onVoidItem(item, order)}
                      className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-all"
                      title="Request void for this item">
                      <AlertTriangle size={11} />
                    </button>
                  )}
                  {item.voidRequested && !item.voidProcessed && (
                    <div className="p-1.5 bg-orange-500/20 text-orange-400 rounded-lg flex items-center gap-1">
                      <Hourglass size={9} />
                      <span className="text-[6px] sm:text-[8px] font-black hidden sm:inline">Wait</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Show voided items */}
          {(order.items || []).filter(item => item.status === "VOIDED" || item.voidProcessed).length > 0 && (
            <div className="mt-3 pt-2 border-t border-white/10">
              <p className="text-[7px] sm:text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-2">Voided Items</p>
              {(order.items || []).filter(item => item.status === "VOIDED" || item.voidProcessed).map((item, i) => (
                <div key={`voided-${i}`} className="p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div className="flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <p className="font-black text-[9px] sm:text-[11px] line-through text-zinc-500 break-words">
                        {item.name}
                      </p>
                      <p className="text-[7px] sm:text-[8px] font-bold text-zinc-500">
                        ×{item.quantity || 1} · UGX {Number(item.price || 0).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-[7px] sm:text-[8px] text-red-400 font-black shrink-0">VOIDED</span>
                  </div>
                  {item.voidReason && (
                    <p className="text-[6px] sm:text-[7px] text-zinc-500 mt-1 break-words">Reason: {item.voidReason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={`px-3 sm:px-4 pb-3 sm:pb-4 pt-2 border-t ${isDark ? "border-white/5" : "border-black/5"}`}>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {isReady && !isServed && (
              <button onClick={() => onMarkServed && onMarkServed(order)}
                className="flex-1 py-1.5 sm:py-2.5 bg-yellow-400 text-black font-black text-[8px] sm:text-[8px] uppercase tracking-widest rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-1.5">
                 Mark Served
              </button>
            )}

            <button onClick={handleAddMore}
              className="flex-1 py-1.5 sm:py-2.5 border border-yellow-500/40 text-yellow-600 font-black text-[8px] sm:text-[10px] uppercase tracking-widest rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-1.5">
              <Plus size={12} strokeWidth={3} /> Add Items
            </button>

            {isServed && !hasPendingPayment && !hasAnyPaymentRequested && !hasTablePaymentRequested && (
              <button onClick={() => onUnserve && onUnserve(order)}
                className="py-1.5 sm:py-2.5 px-2.5 sm:px-3.5 border border-black/10 text-zinc-400 font-black text-[8px] sm:text-[10px] rounded-lg sm:rounded-xl">
                <RotateCcw size={11}/>
              </button>
            )}
          </div>

          {isServed && payableItems.length > 0 && !hasPendingPayment && !hasAnyPaymentRequested && !hasTablePaymentRequested && (
            <button 
              onClick={() => onPayTable && onPayTable(order)}
              disabled={isSendingPayment}
              className={`w-full py-1.5 sm:py-2.5 font-black text-[8px] sm:text-[10px] uppercase tracking-widest rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-1.5 shadow-lg transition-all
                ${isSendingPayment 
                  ? "bg-zinc-600 text-zinc-300 cursor-not-allowed" 
                  : "bg-yellow-500 text-black hover:bg-yellow-400 active:scale-[0.98] shadow-yellow-500/20"}`}>
              {isSendingPayment ? (
                <><Hourglass size={11} className="animate-spin" /> Sending...</>
              ) : (
                <><Send size={11}/> Pay Full Table</>
              )}
            </button>
          )}
          
          {/* Show "Sent to Cashier" button after payment is sent */}
          {isServed && (hasAnyPaymentRequested || hasTablePaymentRequested) && !allItemsPaid && (
            <div className="w-full py-1.5 sm:py-2.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 font-black text-[8px] sm:text-[10px] uppercase tracking-widest rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-1.5">
              <Hourglass size={11} className="animate-pulse" />
              Sent to Cashier - Awaiting Confirmation
            </div>
          )}
          
          {isServed && allItemsPaidOrRequested && nonVoidedItems.length > 0 && payableItems.length === 0 && !hasPendingPayment && !hasAnyPaymentRequested && !allItemsPaid && (
            <button onClick={() => onMarkTablePaid && onMarkTablePaid(order)}
              className="w-full py-1.5 sm:py-2.5 bg-emerald-500 text-black font-black text-[8px] sm:text-[10px] uppercase tracking-widest rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-1.5 shadow-lg shadow-emerald-500/20">
              <CheckCircle size={11}/> Mark as Paid
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── VOIDED ITEMS PANEL ──────────────────────────────────────────────────────
function VoidedItemsPanel({ voidedItems, theme }) {
  const isDark = theme === "dark";
  
  if (!voidedItems || voidedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-28 gap-3 sm:gap-4">
        <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center
          ${isDark ? "bg-red-500/10 border border-red-500/20" : "bg-red-50 border border-red-100"}`}>
          <AlertTriangle size={24} className="text-red-400/60"/>
        </div>
        <div className="text-center">
          <p className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>No voided items</p>
          <p className={`text-[8px] sm:text-[10px] mt-1 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>Cancelled items will appear here</p>
        </div>
      </div>
    );
  }

  const totalVoided = voidedItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity || 1)), 0);

  return (
    <div className="space-y-3 sm:space-y-4 pb-6 sm:pb-8">
      <div className={`rounded-xl sm:rounded-2xl border p-3 sm:p-4 ${isDark ? "bg-red-500/5 border-red-500/20" : "bg-red-50 border-red-100"}`}>
        <p className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-red-400 mb-1">Total Cancelled Value</p>
        <p className="text-lg sm:text-2xl font-black text-red-400">UGX {totalVoided.toLocaleString()}</p>
        <p className={`text-[8px] sm:text-[9px] font-bold mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{voidedItems.length} item{voidedItems.length !== 1 ? "s" : ""} voided</p>
      </div>
      
      <div className="space-y-2">
        <p className={`text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Voided Items · {voidedItems.length}</p>
        {voidedItems.map((item, idx) => (
          <div key={idx} className={`rounded-xl sm:rounded-2xl border p-3 sm:p-4 ${isDark ? "bg-red-500/5 border-red-500/20" : "bg-red-50/60 border-red-200"}`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className={`font-black text-xs sm:text-sm uppercase tracking-tight ${isDark ? "text-white" : "text-zinc-900"} break-words`}>{item.name}</span>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[6px] sm:text-[8px] font-black uppercase">
                    <CheckCircle size={7}/> Voided
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                  <span className={`text-[9px] sm:text-[10px] font-bold ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>Table: {item.tableName}</span>
                  <span className={`text-[8px] sm:text-[9px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>· x{item.quantity || 1}</span>
                </div>
                {item.voidReason && (
                  <p className={`text-[8px] sm:text-[9px] font-bold truncate ${isDark ? "text-zinc-600" : "text-zinc-400"} break-words`}>Reason: {item.voidReason}</p>
                )}
                {item.voidedAt && (
                  <p className={`text-[7px] sm:text-[8px] font-bold mt-1 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>
                    {new Date(item.voidedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-base sm:text-lg font-black text-red-400">UGX {(Number(item.price) * Number(item.quantity || 1)).toLocaleString()}</p>
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

  // ─── COLLECT VOIDED ITEMS ─────────────────────────────────────────────────
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
      const res = await fetch(`${API_URL}/api/cashier-ops/credits`);
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
      setTimeout(() => refreshData?.(), 500);
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

  const handleSend = useCallback(async (payload) => {
    try {
      // Validate credit requests
      if (payload.method === "Credit") {
        if (!payload.creditInfo?.name || !payload.creditInfo?.phone) {
          alert("❌ Client name and phone number are required for credit requests!");
          return;
        }
      }
      
      const requestBody = {
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
      };
      
      const res = await fetch(`${API_URL}/api/cashier-ops/send-to-cashier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      
      if (res.ok) {
        if (payload.type === "table") {
          payload.orderIds.forEach(orderId => {
            setPendingPayments(prev => ({
              ...prev,
              [`${orderId}_table`]: true
            }));
          });
          alert(`✅ Payment request for ${payload.tableName} (${payload.method} of UGX ${payload.amount.toLocaleString()}) has been sent to cashier!`);
        } else if (payload.type === "item" && payload.orderId) {
          setPendingPayments(prev => ({
            ...prev,
            [`${payload.orderId}_${payload.item?.name}`]: true
          }));
          alert(`✅ Payment request for ${payload.item?.name} (UGX ${payload.amount.toLocaleString()}) has been sent to cashier!`);
        }
        
        refreshData?.();
        fetchCredits();
      } else {
        const error = await res.json();
        alert(`❌ Failed to send payment: ${error.error || "Unknown error"}`);
      }
    } catch (err) { 
      console.error("Send failed:", err);
      alert(`❌ Network error: ${err.message}`);
    }
  }, [currentStaffName, currentStaffId, refreshData, fetchCredits]);

  const handleVoidConfirm = useCallback(async (item, reason) => {
    const orderId = item?._orderId;
    if (!orderId) {
      console.error("No Order ID found for void request — item:", item);
      alert("Error: Could not find order ID for this item");
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/orders/void-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          item_name: item.name,
          reason: reason,
          requested_by: currentStaffName,
        }),
      });
      
      if (res.ok) {
        alert(`✅ Void request for "${item.name}" sent to accountant for approval!`);
        refreshData?.();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`❌ Failed to send void request: ${errData.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Void request network error:", err);
      alert(`❌ Network error: ${err.message}`);
    }
  }, [currentStaffName, refreshData]);

  // ─── FILTERING ─────────────────────────────────────────────────────────────
  const filteredOrders = useMemo(() =>
    enrichedGroups.filter(g => {
      const matchSearch = g.tableName.toLowerCase().includes(searchQuery.toLowerCase());
      const hasNonVoidedItems = (g.items || []).some(i => i.status !== "VOIDED" && !i.voidProcessed);
      
      const allNonVoidedItemsPaid = (g.items || [])
        .filter(i => i.status !== "VOIDED" && !i.voidProcessed)
        .every(item => item._rowPaid === true);
      
      const hasAnyPaidItems = (g.items || []).some(item => item._rowPaid === true);
      const hasAnyCreditItems = (g.items || []).some(item => item.creditRequested === true);
      
      const hasCreditOrderStatus = g.orderIds?.some(orderId => {
        const order = orders.find(o => o.id === orderId);
        return order?.status === "Credit" || order?.payment_method === "Credit";
      }) || false;
      
      const isLiveGroup = !hasAnyPaidItems && !hasAnyCreditItems && !hasCreditOrderStatus && hasNonVoidedItems;
      const isServedGroup = g.status === "Served" && !allNonVoidedItemsPaid && hasNonVoidedItems;
      
      let matchTab = false;
      switch (activeTab) {
        case "Live":
          matchTab = isLiveGroup && hasNonVoidedItems;
          break;
        case "Served":
          matchTab = isServedGroup;
          break;
        case "Paid":
          matchTab = false;
          break;
        default:
          matchTab = false;
      }
      return matchSearch && matchTab;
    }), [enrichedGroups, searchQuery, activeTab, orders]);

  const totalPaidItemsCount = useMemo(() => {
    let count = 0;
    orders.forEach(order => {
      let orderItems = order.items || [];
      if (typeof orderItems === 'string') {
        try {
          orderItems = JSON.parse(orderItems);
        } catch {
          orderItems = [];
        }
      }
      orderItems.forEach(item => {
        if (item._rowPaid === true || item.paid_at) {
          count++;
        }
      });
    });
    return count;
  }, [orders]);

  const counts = useMemo(() => {
    const acc = { Live: 0, Served: 0, Paid: totalPaidItemsCount, Credits: creditsData.length, Voided: voidedItemsList.length };
    enrichedGroups.forEach(g => {
      const hasNonVoidedItems = (g.items || []).some(i => i.status !== "VOIDED" && !i.voidProcessed);
      
      const allNonVoidedItemsPaid = (g.items || [])
        .filter(i => i.status !== "VOIDED" && !i.voidProcessed)
        .every(item => item._rowPaid === true);
      
      const hasAnyPaidItems = (g.items || []).some(item => item._rowPaid === true);
      const hasAnyCreditItems = (g.items || []).some(item => item.creditRequested === true);
      
      const hasCreditOrderStatus = g.orderIds?.some(orderId => {
        const order = orders.find(o => o.id === orderId);
        return order?.status === "Credit" || order?.payment_method === "Credit";
      }) || false;
      
      const isLiveGroup = !hasAnyPaidItems && !hasAnyCreditItems && !hasCreditOrderStatus && hasNonVoidedItems;
      const isServedGroup = g.status === "Served" && !allNonVoidedItemsPaid && hasNonVoidedItems;
      
      if (isLiveGroup && hasNonVoidedItems) acc.Live++;
      if (isServedGroup) acc.Served++;
    });
    return acc;
  }, [enrichedGroups, voidedItemsList, creditsData, totalPaidItemsCount, orders]);

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen font-[Outfit] pb-20 sm:pb-28 ${theme === "dark" ? "bg-zinc-950 text-white" : "bg-zinc-50 text-zinc-900"}`}>

      {/* Header */}
      <div className={`sticky top-0 z-20 w-full border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between
        ${theme === "dark" ? "bg-zinc-950/80 backdrop-blur-xl border-white/5" : "bg-white/80 backdrop-blur-xl border-black/5"}`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full sm:rounded-2xl bg-yellow-500 flex items-center justify-center font-black text-black shadow-lg shadow-yellow-500/20">
            {currentStaffName[0]}
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-semi-bold text-yellow-900 uppercase tracking-tight truncate">{currentStaffName.split(" ")[0]}'s Tables</h1>
            <p className="text-[8px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{today}</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/5 rounded-lg sm:rounded-xl border border-white/5">
          <ClipboardList size={12} className="text-yellow-500" />
          <span className="text-[8px] sm:text-[10px] font-semi-bold text-yellow-900 uppercase tracking-widest">{dailyStaffOrders.length} Active Orders</span>
        </div>
      </div>

      <div className="px-4 sm:px-6 pt-6">

        {/* Navigation & Search */}
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex flex-wrap p-1 bg-white/5 rounded-xl sm:rounded-2xl border border-white/5 w-fit gap-1">
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
                  className={`px-3 sm:px-5 py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 sm:gap-2
                    ${isActive ? `${activeStyles} shadow-lg scale-[1.02]` : "text-zinc-500 hover:text-zinc-300"}`}>
                  {tab}
                  {count > 0 && (
                    <span className={`px-1 py-0.5 rounded-md text-[7px] sm:text-[9px] font-black leading-none ${badgeStyles}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
            <input
              type="text"
              placeholder="Search table name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl py-2 sm:py-3 pl-9 sm:pl-12 pr-3 sm:pr-4 text-xs sm:text-sm outline-none focus:border-yellow-500/50 transition-all text-white placeholder-zinc-500" />
          </div>
        </div>

        {/* Conditional Rendering Based on Active Tab */}
        {activeTab === "Voided" ? (
          <VoidedItemsPanel voidedItems={voidedItemsList} theme={theme} />
        ) : activeTab === "Credits" ? (
          <CreditedItemsPanel 
            creditedItems={creditsData} 
            theme={theme} 
          />
        ) : activeTab === "Paid" ? (
          <RecentlyPaidItemsPanel orders={orders} theme={theme} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
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
              <div className="col-span-full py-20 sm:py-32 text-center opacity-30">
                <div className="flex justify-center mb-3 sm:mb-4"><Utensils size={36} className="sm:w-12 sm:h-12" /></div>
                <p className="font-black uppercase tracking-[0.3em] text-[10px] sm:text-xs">No {activeTab} Orders Found</p>
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