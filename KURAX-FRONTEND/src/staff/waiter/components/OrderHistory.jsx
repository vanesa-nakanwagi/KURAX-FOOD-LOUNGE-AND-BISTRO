import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import {
  Activity, Banknote, CreditCard, Smartphone, ClipboardList,
  Search, ChevronDown, ChevronUp, Bell, X,
  AlertTriangle, Utensils, TrendingUp, Send, Receipt,
  BookOpen, User, Phone, CheckCircle, Clock, RotateCcw,
  Coffee, Wine, Target, Calendar, Plus
} from "lucide-react";
import API_URL from "../../../config/api";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(d.toLocaleString("en-US", { timeZone: "Africa/Nairobi" }))
    .toISOString().split("T")[0];
}
function getTodayLocal() { return toLocalDateStr(new Date()); }

// ─── STATION DETECTION ───────────────────────────────────────────────────────
function getItemStation(item) {
  const station  = (item.station  || "").toLowerCase();
  const category = (item.category || "").toLowerCase();
  if (station === "barista" || category.includes("barista") || category.includes("coffee"))
    return "barista";
  if (station === "barman" || category.includes("bar") || category.includes("cocktail") || category.includes("drink"))
    return "barman";
  return "kitchen";
}

const STATION_CONFIG = {
  barista: { label: "Awaiting Barista", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", dot: "bg-orange-400 animate-pulse", icon: <Coffee size={9}/> },
  barman:  { label: "Awaiting Barman",  color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",     dot: "bg-blue-400 animate-pulse",   icon: <Wine size={9}/> },
  kitchen: { label: "Awaiting Kitchen", color: "text-zinc-400",   bg: "bg-zinc-500/10 border-zinc-500/20",     dot: "bg-zinc-400 animate-pulse",   icon: <Utensils size={9}/> },
};

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

  const isItem   = target.type === "item";
  const amount   = isItem
    ? Number(target.item.price || 0) * Number(target.item.quantity || 1)
    : Number(target.total || 0);
  const label    = isItem ? target.item.name : `Full Table · ${target.tableName}`;
  const isMomo   = method === "Momo-MTN" || method === "Momo-Airtel";
  const isCredit = method === "Credit";
  const canSend  = method && (!isCredit || (creditName.trim() && creditPhone.trim()));

  const handleSend = async () => {
    setSending(true);
    await onSend({
      type:       target.type,
      tableName:  target.tableName,
      method,
      amount,
      label,
      orderIds:   isItem ? [target.orderId] : target.orderIds,
      item:       isItem ? target.item : null,
      creditInfo: isCredit
        ? { name: creditName.trim(), phone: creditPhone.trim(), pay_by: creditNote.trim() }
        : null,
    });
    setSending(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-2 pb-0 sm:pb-4">
      <div className="w-full max-w-md bg-zinc-950 rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-zinc-950 z-10 flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
          <div>
            <p className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">
              {isItem ? "Item Payment" : "Table Payment"} · {target.tableName}
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
                <input value={creditName} onChange={e => setCreditName(e.target.value)}
                  placeholder="Client full name *"
                  className="w-full bg-white/3 border border-white/5 rounded-2xl pl-9 pr-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-purple-500/40" />
              </div>
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input value={creditPhone} onChange={e => setCreditPhone(e.target.value)}
                  placeholder="Phone number *" type="tel"
                  className="w-full bg-white/3 border border-white/5 rounded-2xl pl-9 pr-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-purple-500/40" />
              </div>
              <textarea value={creditNote} onChange={e => setCreditNote(e.target.value)}
                placeholder="Note — e.g. 'pays every Friday'"
                className="w-full bg-white/3 border border-white/5 rounded-2xl p-4 text-sm text-white placeholder-zinc-600 outline-none focus:border-purple-500/40 resize-none h-16" />
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
                <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Requires cashier approval</p>
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
  const handleVoid = async () => {
    setLoading(true);
    await onConfirmVoid(item, reason);
    setLoading(false);
    onClose();
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
              <p className="text-[10px] text-zinc-500">{tableName} · {item.name}</p>
            </div>
            <button onClick={onClose} className="ml-auto w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              <X size={14} className="text-zinc-400" />
            </button>
          </div>
          <div className="bg-white/3 rounded-2xl p-4 mb-4 border border-white/5">
            <div className="flex justify-between">
              <span className="text-white font-black text-sm">{item.name}</span>
              <span className="text-yellow-400 font-black text-sm">x{item.quantity || 1}</span>
            </div>
            <p className="text-zinc-500 text-[10px] mt-1">UGX {Number(item.price || 0).toLocaleString()}</p>
          </div>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Reason for void request…"
            className="w-full bg-white/3 border border-white/5 rounded-2xl p-4 text-sm text-white placeholder-zinc-600 outline-none focus:border-red-500/40 resize-none h-20 mb-4" />
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

// ─── ORDER CARD ──────────────────────────────────────────────────────────────
// ── ADDED: onAddItems prop ───────────────────────────────────────────────────
function OrderCard({ order, theme, sentItems, onMarkServed, onUnserve, onPayItem, onPayTable, onVoidItem, onAddItems }) {
  const [expanded, setExpanded] = useState(false);

  const isReady      = order.status === "Ready";
  const isServed     = order.status === "Served";
  const tableAllPaid = order.allPaid;

  const payableItems = order.items.filter(item => {
    const key = itemKey(order.tableName, item);
    return !sentItems.has(key) && !item._rowPaid;
  });
  const allItemsSent  = !tableAllPaid && payableItems.length === 0 && order.items.length > 0;
  const someItemsSent = !tableAllPaid && order.items.some(item => sentItems.has(itemKey(order.tableName, item)));

  const allItemsVoided = order.items.length > 0 && order.items.every(
    item => item.voidProcessed === true || item.status === "VOIDED"
  );

  const preparingStation = useMemo(() => {
    if (tableAllPaid || isServed) return null;
    const stations = order.items.map(getItemStation);
    if (stations.every(s => s === "barista")) return "barista";
    if (stations.every(s => s === "barman"))  return "barman";
    return "kitchen";
  }, [order.items, tableAllPaid, isServed]);

  const statusConfig = {
    Pending:         { label: "Pending",          color: "text-zinc-400",    bg: "bg-zinc-500/10 border-zinc-500/20",       dot: "bg-zinc-400" },
    Preparing:       { label: "Preparing",         color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20",   dot: "bg-orange-400 animate-pulse" },
    Ready:           { label: "🔔 Ready!",         color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400" },
    Delayed:         { label: "Delayed",           color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",         dot: "bg-red-400" },
    Served:          { label: "Served",            color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",       dot: "bg-blue-400" },
    Paid:            { label: "Paid ✓",            color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
    Mixed:           { label: "Paid ✓",            color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
    Credit:          { label: "Credit",            color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20",   dot: "bg-purple-400" },
    AwaitingPayment: { label: "Awaiting Cashier",  color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/20",   dot: "bg-yellow-400 animate-pulse" },
    PartialSent:     { label: "Partial — Sent",    color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20",   dot: "bg-orange-400 animate-pulse" },
  };

  const derivedStatus =
    allItemsVoided  ? "Voided"
    : tableAllPaid  ? "Paid"
    : allItemsSent  ? "AwaitingPayment"
    : someItemsSent ? "PartialSent"
    : order.status;

  const voidedStatus = { label: "Cancelled", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", dot: "bg-red-400" };

  let s = derivedStatus === "Voided"
    ? voidedStatus
    : { ...(statusConfig[derivedStatus] || statusConfig.Pending) };
  if ((derivedStatus === "Preparing" || derivedStatus === "Pending") && preparingStation && preparingStation !== "kitchen") {
    const sc = STATION_CONFIG[preparingStation];
    s = { ...s, label: sc.label, color: sc.color, bg: sc.bg, dot: sc.dot };
  }

  return (
    <div className={`rounded-[1.5rem] border overflow-hidden transition-all duration-300 group
      ${allItemsVoided
        ? "border-red-500/20 opacity-60"
        : isReady && !tableAllPaid
        ? "border-emerald-500/40 shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_8px_32px_rgba(16,185,129,0.10)]"
        : theme === "dark" ? "border-white/[0.07] shadow-none" : "border-black/[0.07] shadow-sm"}
      ${theme === "dark" ? "bg-zinc-900" : "bg-white"}`}>

      {/* Cancelled banner */}
      {allItemsVoided && (
        <div className="bg-red-500/80 px-4 py-2 flex items-center justify-center gap-2">
          <X size={11} className="text-white"/>
          <p className="text-[9px] font-black text-white uppercase tracking-[0.18em]">Order Cancelled — All Items Voided</p>
        </div>
      )}

      {/* Ready banner */}
      {!allItemsVoided && isReady && !tableAllPaid && (
        <div className="bg-emerald-500 px-4 py-2 flex items-center justify-center gap-2">
          <Bell size={11} className="text-black" />
          <p className="text-[9px] font-black text-black uppercase tracking-[0.18em]">Order Ready — Serve Now</p>
        </div>
      )}

      {/* Card header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-black text-[15px] uppercase tracking-tight leading-none
                ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                {order.tableName}
              </span>
              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest
                ${theme === "dark" ? "bg-white/5 text-zinc-600" : "bg-zinc-100 text-zinc-400"}`}>
                #{order.displayId}
              </span>
            </div>
            <p className={`text-[10px] font-bold ${theme === "dark" ? "text-zinc-600" : "text-zinc-400"}`}>
              {order.items.length} item{order.items.length !== 1 ? "s" : ""}&nbsp;·&nbsp;
              <span className={theme === "dark" ? "text-zinc-400" : "text-zinc-600"}>
                UGX {order.total.toLocaleString()}
              </span>
            </p>
          </div>

          {/* Status pill */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[8px] font-black uppercase tracking-wider shrink-0 ${s.bg} ${s.color}`}>
            <span className={`w-1 h-1 rounded-full ${s.dot}`} />
            {s.label}
          </div>
        </div>

        {/* Expand toggle */}
        <button onClick={() => setExpanded(!expanded)}
          className={`mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all
            ${theme === "dark"
              ? "bg-white/4 text-zinc-600 hover:bg-white/7 hover:text-zinc-400"
              : "bg-zinc-50 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"}`}>
          <Utensils size={10} />
          {expanded ? "Hide Items" : "View Items"}
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      </div>

      {/* ── EXPANDED ITEMS ── */}
      {expanded && (
        <div className={`border-t px-4 pb-3 pt-3 space-y-1.5 ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
          {order.items.map((item, i) => {
            const key           = itemKey(order.tableName, item);
            const isSent        = sentItems.has(key);
            const itemPaid      = item._rowPaid;
            const voidApproved  = item.voidProcessed === true || item.status === "VOIDED";
            const voidRejected  = item.voidRejected  === true;
            const hasVoidReq    = item.voidRequested === true && !voidApproved && !voidRejected;
            const originalPrice = Number(item.price || 0);
            const displayPrice  = voidApproved ? 0 : originalPrice;
            const itemTotal     = displayPrice * Number(item.quantity || 1);
            const station       = getItemStation(item);
            const stCfg         = STATION_CONFIG[station];

            return (
              <div key={i}
                className={`rounded-xl overflow-hidden transition-all
                  ${voidApproved ? "opacity-35" : itemPaid ? "opacity-50" : ""}
                  ${theme === "dark" ? "bg-white/[0.04]" : "bg-zinc-50"}`}>
                <div className="flex items-center justify-between py-2.5 px-3 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <p className={`font-black text-[13px] truncate leading-none
                        ${voidApproved
                          ? "line-through text-zinc-600"
                          : theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                        {item.name}
                      </p>
                      {!voidApproved && (
                        <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[7px] font-black uppercase ${stCfg.bg} ${stCfg.color}`}>
                          {stCfg.icon}&nbsp;{station === "kitchen" ? "Kitchen" : station === "barista" ? "Barista" : "Barman"}
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] font-bold text-zinc-500">
                      ×{item.quantity || 1}&nbsp;
                      {voidApproved
                        ? <span className="line-through">UGX {(originalPrice * Number(item.quantity || 1)).toLocaleString()}</span>
                        : `UGX ${itemTotal.toLocaleString()}`}
                      {voidApproved && <span className="text-emerald-500 font-black ml-1">UGX 0</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {voidApproved && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase">
                        <CheckCircle size={8}/> Voided
                      </span>
                    )}
                    {voidRejected && !itemPaid && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-black uppercase">
                        <X size={8}/> Rejected
                      </span>
                    )}
                    {hasVoidReq && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-black uppercase animate-pulse">
                        <AlertTriangle size={8}/> Pending
                      </span>
                    )}
                    {itemPaid && !voidApproved && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase">
                        <CheckCircle size={8}/> Paid
                      </span>
                    )}
                    {isSent && !itemPaid && !voidApproved && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[8px] font-black uppercase animate-pulse">
                        <Clock size={8}/> Sent
                      </span>
                    )}
                    {isServed && !itemPaid && !isSent && !hasVoidReq && !voidApproved && (
                      <button onClick={() => onPayItem(item, order)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-black text-[8px] uppercase tracking-wider hover:bg-yellow-500/20 transition-all active:scale-95">
                        <Receipt size={9}/> Pay
                      </button>
                    )}
                    {!isServed && !itemPaid && !isSent && !hasVoidReq && !voidApproved && (
                      <button onClick={() => onVoidItem(item, order)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-black text-[8px] uppercase tracking-wider hover:bg-red-500/20 transition-all active:scale-95 whitespace-nowrap">
                        <AlertTriangle size={9}/> Void
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isServed && !tableAllPaid && payableItems.length > 0 && (
            <button onClick={() => onPayTable(order)}
              className="w-full mt-2 py-2.5 rounded-xl bg-yellow-500 text-black font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-yellow-400 active:scale-[0.98] transition-all shadow-lg shadow-yellow-500/20">
              <Banknote size={12}/>
              Pay {payableItems.length === order.items.length ? "Full Table" : "Remaining"} · UGX {order.unsentTotal.toLocaleString()}
            </button>
          )}
        </div>
      )}

      {/* ── BOTTOM ACTION BAR ── */}
      {!tableAllPaid && (
        <div className={`flex gap-2 px-4 pb-4 pt-2 border-t ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
          {allItemsVoided ? (
            <div className="flex-1 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center justify-center gap-2">
              <X size={12} className="text-red-400"/>
              <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Order Cancelled</p>
            </div>
          ) : (
            <>
              {isReady && !isServed && (
                <button onClick={() => onMarkServed(order)}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-black text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20">
                  <Bell size={13}/> Mark Served
                </button>
              )}
              {isServed && (
                <button onClick={() => onUnserve(order)}
                  className={`py-2.5 px-3.5 rounded-xl border font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shrink-0
                    ${theme === "dark" ? "border-white/10 text-zinc-500 hover:text-white hover:border-white/20" : "border-black/10 text-zinc-400 hover:text-zinc-700 hover:border-black/20"}`}>
                  <RotateCcw size={12}/> Unserve
                </button>
              )}
              {isServed && payableItems.length > 0 && (
                <button onClick={() => onPayTable(order)}
                  className="flex-1 py-2.5 bg-yellow-500 hover:bg-yellow-400 active:scale-[0.98] text-black font-black text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-500/20">
                  <Send size={13}/>
                  {payableItems.length < order.items.length ? "Pay Remaining" : "Pay Table"}
                </button>
              )}
              {isServed && allItemsSent && (
                <div className="flex-1 py-2.5 rounded-xl border border-yellow-500/20 bg-yellow-500/5 flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"/>
                  <p className="text-[9px] font-black text-yellow-400 uppercase tracking-widest">Awaiting Cashier</p>
                </div>
              )}
              {!isReady && !isServed && (
                <div className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-2
                  ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
                  {preparingStation && preparingStation !== "kitchen" ? (
                    <>
                      <span className={STATION_CONFIG[preparingStation].color}>
                        {STATION_CONFIG[preparingStation].icon}
                      </span>
                      <p className={`text-[9px] font-black uppercase tracking-widest ${STATION_CONFIG[preparingStation].color}`}>
                        {STATION_CONFIG[preparingStation].label}
                      </p>
                    </>
                  ) : (
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Awaiting Kitchen</p>
                  )}
                </div>
              )}

              {/* ── ADD ITEMS — switches to Take Order tab with this table pre-filled ── */}
              {!allItemsVoided && onAddItems && (
                <button
                  onClick={() => onAddItems({
                    name:  order.tableName,
                    items: order.items,
                    id:    order.orderIds?.[0],
                  })}
                  className={`py-2.5 px-3.5 rounded-xl border font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shrink-0
                    ${theme === "dark"
                      ? "border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
                      : "border-yellow-500/40 text-yellow-600 hover:bg-yellow-50"}`}
                >
                  <Plus size={12}/> Add Items
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ITEM KEY ────────────────────────────────────────────────────────────────
function itemKey(tableName, item) {
  return `${tableName}::${item.name}::${item._itemIndex ?? ""}`;
}

// ─── CREDITS PANEL ───────────────────────────────────────────────────────────
function CreditsPanel({ credits, staffName, theme }) {
  const isDark = theme === "dark";
  const outstanding = credits.filter(c => !c.paid && !c.settled && c.status === "Confirmed");
  const settled     = credits.filter(c => c.paid || c.settled);
  const totalOutstanding = outstanding.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalSettled     = settled.reduce((s, c) => s + Number(c.amount || 0), 0);

  if (credits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center
          ${isDark ? "bg-purple-500/10 border border-purple-500/20" : "bg-purple-50 border border-purple-100"}`}>
          <BookOpen size={28} className="text-purple-400/60"/>
        </div>
        <div className="text-center">
          <p className={`text-xs font-black uppercase tracking-[0.25em] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>No credit orders</p>
          <p className={`text-[10px] mt-1 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>Credits assigned to you will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-2xl border p-4 ${isDark ? "bg-purple-500/5 border-purple-500/20" : "bg-purple-50 border-purple-100"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-purple-400 mb-1">Outstanding</p>
          <p className="text-xl font-black text-purple-400">UGX {totalOutstanding.toLocaleString()}</p>
          <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{outstanding.length} credit{outstanding.length !== 1 ? "s" : ""} unpaid</p>
        </div>
        <div className={`rounded-2xl border p-4 ${isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-100"}`}>
          <p className="text-[8px] font-black uppercase tracking-widest text-emerald-400 mb-1">Settled</p>
          <p className="text-xl font-black text-emerald-400">UGX {totalSettled.toLocaleString()}</p>
          <p className={`text-[9px] font-bold mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{settled.length} credit{settled.length !== 1 ? "s" : ""} cleared</p>
        </div>
      </div>
      {outstanding.length > 0 && (
        <div className="space-y-2">
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Outstanding · {outstanding.length}</p>
          {outstanding.map((credit, i) => <CreditRow key={i} credit={credit} isDark={isDark} settled={false}/>)}
        </div>
      )}
      {settled.length > 0 && (
        <div className="space-y-2">
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Settled · {settled.length}</p>
          {settled.map((credit, i) => <CreditRow key={i} credit={credit} isDark={isDark} settled={true}/>)}
        </div>
      )}
      <div className={`text-center text-[9px] font-bold uppercase tracking-widest pt-2 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>
        Credits persist until end of month · Contact accountant to settle
      </div>
    </div>
  );
}

function CreditRow({ credit, isDark, settled }) {
  const date = credit.confirmed_at || credit.created_at;
  const dateStr = date ? new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  return (
    <div className={`rounded-2xl border p-4 flex items-start justify-between gap-3 transition-all
      ${settled
        ? isDark ? "bg-zinc-900/20 border-white/5 opacity-70" : "bg-zinc-50 border-black/5 opacity-70"
        : isDark ? "bg-purple-500/5 border-purple-500/20" : "bg-purple-50/60 border-purple-200"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className={`font-black text-sm uppercase tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{credit.table_name || "Table"}</span>
          {settled ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase"><CheckCircle size={8}/> Settled</span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[8px] font-black uppercase animate-pulse"><Clock size={8}/> Outstanding</span>
          )}
        </div>
        {credit.client_name && (
          <div className="flex items-center gap-1 mb-1">
            <User size={9} className="text-zinc-500 shrink-0"/>
            <span className={`text-[10px] font-bold ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{credit.client_name}</span>
            {credit.client_phone && <span className={`text-[9px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>· {credit.client_phone}</span>}
          </div>
        )}
        {credit.pay_by && !settled && (
          <div className="flex items-center gap-1 mb-1">
            <Calendar size={9} className="text-amber-400 shrink-0"/>
            <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider">Pay by: {credit.pay_by}</span>
          </div>
        )}
        {credit.label && <p className={`text-[9px] font-bold truncate ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{credit.label}</p>}
        <p className={`text-[8px] font-bold mt-1 ${isDark ? "text-zinc-700" : "text-zinc-400"}`}>{dateStr}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-lg font-black ${settled ? "text-emerald-400" : "text-purple-400"}`}>UGX {Number(credit.amount || 0).toLocaleString()}</p>
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
// ── ADDED: onAddItems prop ──
export default function OrderHistory({ shiftEnded = false, onAddItems }) {
  const { orders = [], currentUser, refreshData } = useData() || {};
  const { theme } = useTheme();

  // ── BUG FIX: read identity from BOTH context and localStorage ─────────────
  // context can be null on first render → orders filter returns [] → blank screen.
  // Using ?? (nullish) not || so we don't fall back on falsy id=0.
  const savedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}"); }
    catch { return {}; }
  }, []);

  const currentStaffId   = currentUser?.id   ?? savedUser?.id;
  const currentStaffName = currentUser?.name ?? savedUser?.name ?? "Staff Member";

  const [activeTab,      setActiveTab]      = useState("Live");
  const [searchQuery,    setSearchQuery]    = useState("");
  const [payTarget,      setPayTarget]      = useState(null);
  const [voidItem,       setVoidItem]       = useState(null);
  const [sentItems,      setSentItems]      = useState(new Set());
  const [confirmedQueue, setConfirmedQueue] = useState([]);
  const [creditsQueue,   setCreditsQueue]   = useState([]);

  const [staffTargets, setStaffTargets] = useState({
    daily_order_target:    null,
    monthly_income_target: null,
  });

  useEffect(() => {
    if (!currentStaffId) return;
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/staff/performance-list`);
        if (res.ok) {
          const list = await res.json();
          const me   = list.find(s => String(s.id) === String(currentStaffId));
          if (me) setStaffTargets({
            daily_order_target:    Number(me.daily_order_target)    || 0,
            monthly_income_target: Number(me.monthly_income_target) || 0,
          });
        }
      } catch {}
    };
    load();
  }, [currentStaffId]);

  const dailyOrderTarget     = staffTargets.daily_order_target    ?? 0;
  const monthlyRevenueTarget = staffTargets.monthly_income_target ?? 0;
  const targetsLoaded        = staffTargets.daily_order_target !== null;

  useEffect(() => {
    if (shiftEnded) { setConfirmedQueue([]); return; }
    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/api/orders/cashier-history`);
        if (res.ok) setConfirmedQueue(await res.json());
      } catch {}
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [shiftEnded]);

  useEffect(() => {
    const loadCredits = async () => {
      try {
        const res = await fetch(`${API_URL}/api/orders/cashier-history`);
        if (!res.ok) return;
        const all = await res.json();
        setCreditsQueue(all.filter(row =>
          row.method === "Credit" && row.requested_by === currentStaffName
        ));
      } catch {}
    };
    loadCredits();
    const id = setInterval(loadCredits, 30000);
    return () => clearInterval(id);
  }, [currentStaffName]);

  const [dayIsClosed, setDayIsClosed] = useState(false);
  useEffect(() => {
    if (shiftEnded) { setDayIsClosed(true); return; }
    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/api/summaries/today`);
        if (res.ok) {
          const data   = await res.json();
          const closed = data.day_closed === true || data.day_closed === "t" || data.day_closed === "true";
          setDayIsClosed(closed);
          if (closed) setConfirmedQueue([]);
        }
      } catch {}
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, [shiftEnded]);

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

  // ── BUG FIX: robust staff matching — id OR name, guards against undefined ──
  // The old code used String(o.staff_id) === String(currentStaffId) which
  // returns false whenever currentStaffId is undefined (context not yet loaded),
  // causing the list to appear empty on every fresh page load until the next
  // DataContext poll fires 10s later.
  //
  // Fix: use name as fallback, and only filter when we have at least one
  // identifier. This means orders show immediately on mount.
  const dailyStaffOrders = useMemo(() => {
    if (!currentStaffId && !currentStaffName) return [];

    return (orders || []).filter(o => {
      const ts = o.timestamp || o.created_at;
      if (!ts) return false;

      const idMatch = currentStaffId
        ? String(o.staff_id ?? o.staffId ?? "") === String(currentStaffId)
        : false;

      const nameMatch = currentStaffName && currentStaffName !== "Staff Member"
        ? (o.staff_name ?? o.waiterName ?? o.staffName ?? "")
            .toLowerCase() === currentStaffName.toLowerCase()
        : false;

      const mine    = idMatch || nameMatch;
      const cleared = o.shift_cleared === true || o.shift_cleared === "t" || o.shift_cleared === "true";
      const sameDay = toLocalDateStr(new Date(ts)) === today;

      return mine && sameDay && !cleared;
    });
  }, [orders, currentStaffId, currentStaffName, today]);

  const monthlyRevenue = useMemo(() => {
    if (shiftEnded || dayIsClosed) return 0;
    const now = new Date();
    return confirmedQueue.reduce((sum, row) => {
      if (row.status !== "Confirmed" || row.requested_by !== currentStaffName) return sum;
      const d = new Date(row.confirmed_at || row.created_at);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return sum;
      return sum + (Number(row.amount) || 0);
    }, 0);
  }, [confirmedQueue, currentStaffName, shiftEnded, dayIsClosed]);

  const groupedTableOrders = useMemo(() => {
    const groups = {};
    dailyStaffOrders.forEach(order => {
      const key     = (order.table_name || order.tableName || "WALK-IN").trim().toUpperCase();
      const rowPaid = order.status === "Paid" || order.status === "Credit"
                   || order.status === "Mixed" || order.is_paid || order.isPaid;
      const rowSent = order.sent_to_cashier || order.sentToCashier || false;

      if (!groups[key]) {
        groups[key] = {
          tableName: key,
          displayId: order.id ? String(order.id).slice(-6) : "000000",
          total: 0, items: [], status: order.status || "Pending",
          timestamp: order.timestamp || order.created_at,
          orderIds: [], _rows: [],
        };
      }
      const g = groups[key];
      g.total += Number(order.total) || 0;
      g.orderIds.push(order.id);
      g._rows.push({ id: order.id, paid: rowPaid, sent: rowSent, total: Number(order.total) || 0 });
      (order.items || []).forEach(item => g.items.push({ ...item, _orderId: order.id, _rowPaid: rowPaid }));

      const rank = { Served: 5, Ready: 4, Delayed: 3, Preparing: 2, Pending: 1 };
      if ((rank[order.status] || 0) > (rank[g.status] || 0)) g.status = order.status;
    });

    Object.values(groups).forEach(g => {
      g.items = g.items.map((item, idx) => ({ ...item, _itemIndex: idx }));
    });
    return groups;
  }, [dailyStaffOrders]);

  const enrichedGroups = useMemo(() =>
    Object.values(groupedTableOrders).map(group => {
      const allPaid        = group._rows.length > 0 && group._rows.every(r => r.paid);
      const unsentRows     = group._rows.filter(r => !r.paid && !r.sent);
      const unsentOrderIds = unsentRows.map(r => r.id);
      const unsentTotal    = unsentRows.reduce((s, r) => s + r.total, 0);
      return { ...group, allPaid, unsentOrderIds, unsentTotal: unsentTotal || group.total };
    }),
  [groupedTableOrders]);

  const filteredOrders = useMemo(() =>
    enrichedGroups
      .filter(g => {
        const allVoided   = g.items.length > 0 && g.items.every(i => i.voidProcessed === true || i.status === "VOIDED");
        const anyVoided   = g.items.some(i => i.voidProcessed === true || i.status === "VOIDED");
        const matchSearch = g.tableName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchTab =
          activeTab === "Live"
            ? ["Pending","Preparing","Ready","Delayed"].includes(g.status) && !allVoided
            : activeTab === "Served"
            ? ["Served","Paid","Closed","Credit","Mixed"].includes(g.status) && !allVoided
            : activeTab === "Voided"
            ? anyVoided
            : false;
        return matchSearch && matchTab;
      })
      .sort((a, b) => {
        if (a.status === "Ready"  && b.status !== "Ready")  return -1;
        if (b.status === "Ready"  && a.status !== "Ready")  return  1;
        if (a.status === "Served" && b.status !== "Served") return -1;
        if (b.status === "Served" && a.status !== "Served") return  1;
        return new Date(b.timestamp) - new Date(a.timestamp);
      }),
  [enrichedGroups, searchQuery, activeTab]);

  const totals = useMemo(() => {
    const acc = { Cash: 0, Card: 0, MTN: 0, Airtel: 0, Momo: 0, all: 0 };
    if (shiftEnded || dayIsClosed) return acc;
    confirmedQueue.forEach(row => {
      if (row.status !== "Confirmed") return;
      if (toLocalDateStr(new Date(row.confirmed_at || row.created_at)) !== today) return;
      if (row.requested_by !== currentStaffName) return;
      const amt = Number(row.amount) || 0;
      switch (row.method) {
        case "Cash":        acc.Cash   += amt; acc.all += amt; break;
        case "Card":        acc.Card   += amt; acc.all += amt; break;
        case "Momo-MTN":    acc.MTN    += amt; acc.Momo += amt; acc.all += amt; break;
        case "Momo-Airtel": acc.Airtel += amt; acc.Momo += amt; acc.all += amt; break;
        default:            acc.all    += amt; break;
      }
    });
    return acc;
  }, [confirmedQueue, today, currentStaffName, shiftEnded, dayIsClosed]);

  const isAllVoided  = o => o.items.length > 0 && o.items.every(i => i.voidProcessed === true || i.status === "VOIDED");
  const hasAnyVoided = o => o.items.some(i => i.voidProcessed === true || i.status === "VOIDED");

  const readyCount   = useMemo(() => enrichedGroups.filter(o => o.status === "Ready"  && !isAllVoided(o)).length, [enrichedGroups]);
  const liveCount    = useMemo(() => enrichedGroups.filter(o => ["Pending","Preparing","Ready","Delayed"].includes(o.status) && !isAllVoided(o)).length, [enrichedGroups]);
  const servedCount  = useMemo(() => enrichedGroups.filter(o => ["Served","Paid","Closed","Credit","Mixed"].includes(o.status) && !isAllVoided(o)).length, [enrichedGroups]);
  const voidedCount  = useMemo(() => enrichedGroups.filter(o => hasAnyVoided(o)).length, [enrichedGroups]);
  const outstandingCredits = useMemo(() => creditsQueue.filter(r => r.status === "Confirmed" && !r.paid && !r.settled), [creditsQueue]);
  const creditsCount = outstandingCredits.length;
  const firstName    = currentStaffName.split(" ")[0] || "Staff";

  const orderProgressPct   = dailyOrderTarget > 0 ? Math.min((dailyStaffOrders.length / dailyOrderTarget) * 100, 100) : 0;
  const revenueProgressPct = monthlyRevenueTarget > 0 ? Math.min((monthlyRevenue / monthlyRevenueTarget) * 100, 100) : 0;

  const handleMarkServed = useCallback(async (order) => {
    try {
      await Promise.all(order.orderIds.map(id =>
        fetch(`${API_URL}/api/orders/${id}/status`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Served" }),
        })
      ));
      refreshData?.();
    } catch (err) { console.error("Mark served failed:", err); }
  }, [refreshData]);

  const handleUnserve = useCallback(async (order) => {
    try {
      await Promise.all(order.orderIds.map(id =>
        fetch(`${API_URL}/api/orders/${id}/status`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Ready" }),
        })
      ));
      refreshData?.();
    } catch (err) { console.error("Unserve failed:", err); }
  }, [refreshData]);

  const handlePayItem  = useCallback((item, order) => {
    setPayTarget({ type: "item", tableName: order.tableName, item, orderId: item._orderId });
  }, []);

  const handlePayTable = useCallback((order) => {
    setPayTarget({
      type: "table", tableName: order.tableName,
      total: order.unsentTotal,
      orderIds: order.unsentOrderIds.length ? order.unsentOrderIds : order.orderIds,
    });
  }, []);

  const handleSend = useCallback(async (payload) => {
    try {
      await fetch(`${API_URL}/api/orders/send-to-cashier`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_ids: payload.orderIds, table_name: payload.tableName,
          method: payload.method, amount: payload.amount, label: payload.label,
          is_item: payload.type === "item", item: payload.item,
          credit_info: payload.creditInfo,
          requested_by: currentStaffName, staff_id: currentStaffId,
        }),
      });
      setSentItems(prev => {
        const next = new Set(prev);
        if (payload.type === "item" && payload.item) {
          next.add(itemKey(payload.tableName, payload.item));
        } else {
          const group = enrichedGroups.find(g => g.tableName === payload.tableName);
          if (group) group.items.forEach(item => { if (!item._rowPaid) next.add(itemKey(payload.tableName, item)); });
        }
        return next;
      });
      refreshData?.();
    } catch (err) { console.error("Send to cashier failed:", err); }
  }, [currentStaffName, currentStaffId, enrichedGroups, refreshData]);

  const handleVoidItem = useCallback(async (item, reason) => {
    try {
      await fetch(`${API_URL}/api/orders/void-item`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id:     item._orderId,
          item_name:    item.name,
          reason,
          requested_by: currentStaffName,
        }),
      });
      refreshData?.();
    } catch (err) { console.error("Void failed:", err); }
  }, [currentStaffName, refreshData]);

  return (
    <div className={`min-h-screen font-[Outfit] pb-28 transition-colors duration-300 ${theme === "dark" ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-900"}`}>

      {/* ═══ HEADER ════════════════════════════════════════════════════════ */}
      <div className={`sticky top-0 z-20 w-full border-b px-4 md:px-8 py-3 flex items-center justify-between gap-4
        ${theme === "dark" ? "bg-zinc-950/90 backdrop-blur-2xl border-white/[0.06]" : "bg-white/90 backdrop-blur-2xl border-black/[0.06] shadow-sm"}`}>

        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-yellow-500 flex items-center justify-center font-black text-black text-sm leading-none shrink-0 shadow-lg shadow-yellow-500/30">
              {firstName[0]}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-zinc-950" />
          </div>
          <div>
            <h1 className={`text-[13px] font-black uppercase tracking-tight leading-none ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
              {firstName} <span className="text-yellow-500">·</span> Dashboard
            </h1>
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em] mt-0.5">{today}</p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-6 flex-1 justify-center">
          <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${theme === "dark" ? "bg-white/3 border-white/5" : "bg-zinc-50 border-black/5"}`}>
            <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center"><ClipboardList size={13} className="text-orange-400" /></div>
            <div>
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-0.5">Orders Today</p>
              <p className="text-sm font-black leading-none">{dailyStaffOrders.length}{dailyOrderTarget > 0 && <span className="text-zinc-500 font-bold text-xs"> /{dailyOrderTarget}</span>}</p>
            </div>
          </div>
          <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${theme === "dark" ? "bg-white/3 border-white/5" : "bg-zinc-50 border-black/5"}`}>
            <div className="w-7 h-7 rounded-lg bg-yellow-500/15 flex items-center justify-center"><TrendingUp size={13} className="text-yellow-500" /></div>
            <div>
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-0.5">Gross Today</p>
              <p className="text-sm font-black text-yellow-500 leading-none">UGX {totals.all.toLocaleString()}</p>
            </div>
          </div>
          <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${theme === "dark" ? "bg-white/3 border-white/5" : "bg-zinc-50 border-black/5"}`}>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center"><Target size={13} className="text-emerald-400" /></div>
            <div>
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-0.5">This Month</p>
              <p className="text-sm font-black text-emerald-400 leading-none">UGX {monthlyRevenue.toLocaleString()}{monthlyRevenueTarget > 0 && <span className="text-zinc-500 font-bold text-xs"> / {monthlyRevenueTarget.toLocaleString()}</span>}</p>
            </div>
          </div>
        </div>

        {readyCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 rounded-xl shrink-0 shadow-lg shadow-emerald-500/30 animate-pulse">
            <Bell size={12} className="text-black" />
            <span className="text-[10px] font-black text-black uppercase tracking-widest">{readyCount} Ready</span>
          </div>
        )}
      </div>

      {/* ═══ PERFORMANCE PANEL ═════════════════════════════════════════════ */}
      <div className="px-4 md:px-8 pt-5">

        <div className="lg:hidden flex gap-2 mb-4 overflow-x-auto pb-1">
          {[
            { label: "Orders", value: `${dailyStaffOrders.length}${dailyOrderTarget > 0 ? `/${dailyOrderTarget}` : ""}`, color: "text-orange-400", dot: "bg-orange-500" },
            { label: "Gross",  value: `UGX ${totals.all.toLocaleString()}`,     color: "text-yellow-500",  dot: "bg-yellow-500" },
            { label: "Month",  value: `UGX ${monthlyRevenue.toLocaleString()}`, color: "text-emerald-400", dot: "bg-emerald-500" },
          ].map(({ label, value, color, dot }) => (
            <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 ${theme === "dark" ? "bg-zinc-900 border-white/5" : "bg-white border-black/5 shadow-sm"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{label}</span>
              <span className={`text-xs font-black ${color}`}>{value}</span>
            </div>
          ))}
        </div>

        <div className={`rounded-[1.5rem] border mb-5 overflow-hidden ${theme === "dark" ? "bg-zinc-900 border-white/[0.06]" : "bg-white border-black/[0.06] shadow-sm"}`}>
          <div className={`px-5 pt-4 pb-3 border-b flex items-center justify-between ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Performance Targets</p>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${targetsLoaded ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-500/10 text-zinc-500 border border-zinc-500/20"}`}>
              {targetsLoaded ? "Live" : "Loading"}
            </span>
          </div>
          <div className="p-5 space-y-5">
            <div>
              <div className="flex items-end justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-orange-500/15 flex items-center justify-center"><Activity size={11} className="text-orange-400" /></div>
                  <span className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">Daily Orders</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-black text-orange-400">
                    {targetsLoaded ? dailyOrderTarget > 0 ? `${dailyStaffOrders.length} / ${dailyOrderTarget}` : `${dailyStaffOrders.length} · No target` : "—"}
                  </span>
                  {targetsLoaded && dailyOrderTarget > 0 && <span className="ml-2 text-[9px] font-black text-zinc-600">{Math.round(orderProgressPct)}%</span>}
                </div>
              </div>
              <div className={`w-full h-2.5 rounded-full overflow-hidden ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-100"}`}>
                <div className="h-full rounded-full bg-gradient-to-r from-orange-600 to-amber-400 transition-all duration-1000 ease-out relative" style={{ width: `${orderProgressPct}%` }}>
                  {orderProgressPct > 5 && <div className="absolute inset-0 bg-white/20 rounded-full" style={{ width: "30%" }} />}
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-end justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-yellow-500/15 flex items-center justify-center"><Target size={11} className="text-yellow-400" /></div>
                  <span className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">Monthly Revenue</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-black text-yellow-400">
                    {targetsLoaded ? monthlyRevenueTarget > 0 ? `UGX ${monthlyRevenue.toLocaleString()} / ${monthlyRevenueTarget.toLocaleString()}` : `UGX ${monthlyRevenue.toLocaleString()} · No target` : "—"}
                  </span>
                  {targetsLoaded && monthlyRevenueTarget > 0 && <span className="ml-2 text-[9px] font-black text-zinc-600">{Math.round(revenueProgressPct)}%</span>}
                </div>
              </div>
              <div className={`w-full h-2.5 rounded-full overflow-hidden ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-100"}`}>
                <div className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-1000 ease-out relative" style={{ width: `${revenueProgressPct}%` }}>
                  {revenueProgressPct > 5 && <div className="absolute inset-0 bg-white/20 rounded-full" style={{ width: "30%" }} />}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ TABS + SEARCH ══════════════════════════════════════════════ */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className={`flex gap-1 p-1 rounded-2xl shrink-0 ${theme === "dark" ? "bg-zinc-900 border border-white/5" : "bg-zinc-200/70 border border-black/5"}`}>
            {[
              { key: "Live",    count: liveCount,    accent: "yellow" },
              { key: "Served",  count: servedCount,  accent: "yellow" },
              { key: "Credits", count: creditsCount, accent: "purple" },
              { key: "Voided",  count: voidedCount,  accent: "red"    },
            ].map(({ key, count, accent }) => {
              const isActive = activeTab === key;
              const isRed    = accent === "red";
              const isPurple = accent === "purple";
              const activeClass = isRed ? "bg-red-500 text-white shadow-lg shadow-red-500/25"
                : isPurple ? "bg-purple-500 text-white shadow-lg shadow-purple-500/25"
                : "bg-yellow-500 text-black shadow-lg shadow-yellow-500/25";
              const badgeClass = isActive
                ? isRed ? "bg-white/20 text-white" : isPurple ? "bg-white/20 text-white" : "bg-black/15 text-black"
                : isRed ? "bg-red-500/15 text-red-400"
                : isPurple ? "bg-purple-500/15 text-purple-400"
                : theme === "dark" ? "bg-white/8 text-zinc-400" : "bg-black/8 text-zinc-500";
              return (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`relative px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-200 flex items-center gap-1.5
                    ${isActive ? activeClass : theme === "dark" ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}>
                  {key}
                  {count > 0 && <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md leading-none ${badgeClass}`}>{count}</span>}
                </button>
              );
            })}
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={13} />
            <input type="text" placeholder="Search table…" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full py-2.5 pl-10 pr-4 rounded-xl text-xs font-bold outline-none border transition-all
                ${theme === "dark" ? "bg-zinc-900 border-white/5 focus:border-yellow-500/40 text-white placeholder-zinc-600" : "bg-white border-black/5 focus:border-yellow-500/60 text-zinc-900 placeholder-zinc-400 shadow-sm"}`} />
          </div>
        </div>

        {/* ═══ ORDERS GRID ════════════════════════════════════════════════ */}
        {activeTab === "Credits" ? (
          <CreditsPanel credits={creditsQueue} staffName={currentStaffName} theme={theme} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-28 gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center
                  ${activeTab === "Voided" ? "bg-red-500/10 border border-red-500/20" : theme === "dark" ? "bg-white/4 border border-white/5" : "bg-zinc-200 border border-black/5"}`}>
                  {activeTab === "Voided" ? <X size={28} className="text-red-400/60" /> : <ClipboardList size={28} className="text-zinc-500/50" />}
                </div>
                <div className="text-center">
                  <p className={`text-xs font-black uppercase tracking-[0.25em] ${theme === "dark" ? "text-zinc-600" : "text-zinc-400"}`}>
                    {activeTab === "Voided" ? "No voided orders" : `No ${activeTab.toLowerCase()} orders`}
                  </p>
                  <p className={`text-[10px] mt-1 ${theme === "dark" ? "text-zinc-700" : "text-zinc-400"}`}>
                    {activeTab === "Live" ? "New orders will appear here" : activeTab === "Served" ? "Served orders will appear here" : "Cancelled orders appear here"}
                  </p>
                </div>
              </div>
            ) : filteredOrders.map(order => (
              <OrderCard
                key={order.tableName}
                order={order}
                theme={theme}
                sentItems={sentItems}
                onMarkServed={handleMarkServed}
                onUnserve={handleUnserve}
                onPayItem={handlePayItem}
                onPayTable={handlePayTable}
                onVoidItem={(item, ord) => setVoidItem({ item, order: ord })}
                onAddItems={onAddItems}
              />
            ))}
          </div>
        )}
      </div>

      {payTarget && <PayModal target={payTarget} onClose={() => setPayTarget(null)} onSend={handleSend} />}
      {voidItem  && (
        <VoidModal
          item={voidItem.item}
          tableName={voidItem.order.tableName}
          onClose={() => setVoidItem(null)}
          onConfirmVoid={handleVoidItem} />
      )}
    </div>
  );
}