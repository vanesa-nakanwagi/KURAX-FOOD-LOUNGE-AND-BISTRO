import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import {
  Activity, Banknote, CreditCard, Smartphone, ClipboardList,
  Search, ChevronDown, ChevronUp, Bell, X,
  AlertTriangle, Utensils, TrendingUp, Send, Receipt,
  BookOpen, User, Phone, CheckCircle, Clock, RotateCcw,
  Coffee, Wine
} from "lucide-react";
import API_URL from "../../../config/api";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function toLocalDateStr(date) {
  // Always convert through Kampala timezone — new Date().toISOString() is UTC
  // and gives yesterday's date before 3am in Kampala.
  const d = date instanceof Date ? date : new Date(date);
  return new Date(d.toLocaleString("en-US", { timeZone: "Africa/Nairobi" }))
    .toISOString().split("T")[0];
}
function getTodayLocal() { return toLocalDateStr(new Date()); }

// ─── STATION DETECTION ───────────────────────────────────────────────────────
// Returns "barista" | "barman" | "kitchen" based on item category/station tags
function getItemStation(item) {
  const station   = (item.station   || "").toLowerCase();
  const category  = (item.category  || "").toLowerCase();
  const name      = (item.name      || "").toLowerCase();

  if (station === "barista" || category.includes("barista") || category.includes("coffee"))
    return "barista";
  if (station === "barman"  || category.includes("bar") || category.includes("cocktail") || category.includes("drink"))
    return "barman";
  return "kitchen";
}

// Station display config
const STATION_CONFIG = {
  barista: { label: "Awaiting Barista", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", dot: "bg-orange-400 animate-pulse", icon: <Coffee size={9}/> },
  barman:  { label: "Awaiting Barman",  color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",     dot: "bg-blue-400 animate-pulse",   icon: <Wine size={9}/> },
  kitchen: { label: "Awaiting Kitchen", color: "text-zinc-400",   bg: "bg-zinc-500/10 border-zinc-500/20",     dot: "bg-zinc-400 animate-pulse",   icon: <Utensils size={9}/> },
};

// ─── PAYMENT METHODS ──────────────────────────────────────────────────────────
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

// ─── PAY MODAL ────────────────────────────────────────────────────────────────
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

// ─── VOID MODAL ───────────────────────────────────────────────────────────────
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

// ─── ORDER CARD ───────────────────────────────────────────────────────────────
function OrderCard({ order, theme, sentItems, onMarkServed, onUnserve, onPayItem, onPayTable, onVoidItem }) {
  const [expanded, setExpanded] = useState(false);

  const isReady      = order.status === "Ready";
  const isServed     = order.status === "Served";
  const isPreparing  = order.status === "Preparing";
  const isPending    = order.status === "Pending";
  const tableAllPaid = order.allPaid;

  const payableItems = order.items.filter(item => {
    const key = itemKey(order.tableName, item);
    return !sentItems.has(key) && !item._rowPaid;
  });
  const allItemsSent  = !tableAllPaid && payableItems.length === 0 && order.items.length > 0;
  const someItemsSent = !tableAllPaid && order.items.some(item => sentItems.has(itemKey(order.tableName, item)));

  // ✅ True when every item on this table has been voided (approved)
  // voidProcessed:true OR status==="VOIDED" counts as voided
  const allItemsVoided = order.items.length > 0 && order.items.every(
    item => item.voidProcessed === true || item.status === "VOIDED"
  );

  // Determine station label for items that are still being prepared
  // Show the dominant station type for the card-level status
  const preparingStation = useMemo(() => {
    if (tableAllPaid || isServed) return null;
    const stations = order.items.map(getItemStation);
    if (stations.every(s => s === "barista")) return "barista";
    if (stations.every(s => s === "barman"))  return "barman";
    return "kitchen"; // mixed or all kitchen
  }, [order.items, tableAllPaid, isServed]);

  const statusConfig = {
    Pending:         { label: "Pending",          color: "text-zinc-400",    bg: "bg-zinc-500/10 border-zinc-500/20",       dot: "bg-zinc-400" },
    Preparing:       { label: `Preparing`,         color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20",   dot: "bg-orange-400 animate-pulse" },
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
    tableAllPaid    ? "Paid"
    : allItemsSent  ? "AwaitingPayment"
    : someItemsSent ? "PartialSent"
    : order.status;

  // Override Preparing label with station-specific text
  let s = { ...(statusConfig[derivedStatus] || statusConfig.Pending) };
  if ((derivedStatus === "Preparing" || derivedStatus === "Pending") && preparingStation && preparingStation !== "kitchen") {
    const sc = STATION_CONFIG[preparingStation];
    s = { ...s, label: sc.label, color: sc.color, bg: sc.bg, dot: sc.dot };
  }

  return (
    <div className={`rounded-[1.75rem] border-2 overflow-hidden transition-all duration-300
      ${isReady && !tableAllPaid ? "border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.12)]" : theme === "dark" ? "border-white/5" : "border-black/5 shadow-sm"}
      ${theme === "dark" ? "bg-zinc-900" : "bg-white"}`}>

      {isReady && !tableAllPaid && (
        <div className="bg-emerald-500 px-5 py-2 flex items-center justify-center gap-2">
          <Bell size={12} className="text-black" />
          <p className="text-[10px] font-black text-black uppercase tracking-widest">Order Ready — Please Serve!</p>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-black text-base uppercase tracking-tight ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                {order.tableName}
              </span>
              <span className="text-[9px] text-zinc-500 font-bold">#{order.displayId}</span>
            </div>
            <p className={`text-[10px] font-bold uppercase mt-0.5 ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`}>
              {order.items.length} item{order.items.length !== 1 ? "s" : ""} · UGX {order.total.toLocaleString()}
            </p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest shrink-0 ${s.bg} ${s.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
          </div>
        </div>

        <button onClick={() => setExpanded(!expanded)}
          className={`mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
            ${theme === "dark" ? "bg-white/3 text-zinc-500 hover:bg-white/8" : "bg-zinc-50 text-zinc-400 hover:bg-zinc-100"}`}>
          <Utensils size={11} />
          {expanded ? "Hide Items" : "View Items"}
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* ── EXPANDED ITEMS ── */}
      {expanded && (
        <div className={`border-t px-5 pb-4 pt-3 space-y-2 ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
          {order.items.map((item, i) => {
            const key            = itemKey(order.tableName, item);
            const isSent         = sentItems.has(key);
            const itemPaid       = item._rowPaid;
            const voidApproved   = item.voidProcessed === true || item.status === "VOIDED";
            const voidRejected   = item.voidRejected  === true;
            const hasVoidReq     = item.voidRequested === true && !voidApproved && !voidRejected;
            const originalPrice  = Number(item.price || 0);
            const displayPrice   = voidApproved ? 0 : originalPrice;
            const itemTotal      = displayPrice * Number(item.quantity || 1);
            const station        = getItemStation(item);
            const stCfg          = STATION_CONFIG[station];

            return (
              <div key={i}
                className={`rounded-xl overflow-hidden transition-all
                  ${voidApproved ? "opacity-40" : itemPaid ? "opacity-50" : ""}
                  ${theme === "dark" ? "bg-white/3" : "bg-zinc-50"}`}>
                <div className="flex items-center justify-between py-2.5 px-3 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Item name — struck through if void approved */}
                      <p className={`font-black text-sm truncate
                        ${voidApproved
                          ? "line-through text-zinc-600"
                          : theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                        {item.name}
                      </p>
                      {/* Station badge */}
                      {!voidApproved && (
                        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[8px] font-black uppercase ${stCfg.bg} ${stCfg.color}`}>
                          {stCfg.icon} {station === "kitchen" ? "Kitchen" : station === "barista" ? "Barista" : "Barman"}
                        </span>
                      )}
                    </div>
                    <p className={`text-[10px] font-medium ${voidApproved ? "text-zinc-600" : "text-zinc-500"}`}>
                      x{item.quantity || 1} ·{" "}
                      {voidApproved
                        ? <span className="line-through mr-1">UGX {(originalPrice * Number(item.quantity || 1)).toLocaleString()}</span>
                        : `UGX ${itemTotal.toLocaleString()}`}
                      {voidApproved && <span className="text-emerald-600 font-black">UGX 0</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* ── VOID APPROVED — green tick, crossed out ── */}
                    {voidApproved && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase">
                        <CheckCircle size={9}/> Voided
                      </span>
                    )}
                    {/* ── VOID REJECTED — red badge, void button reappears ── */}
                    {voidRejected && !itemPaid && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-black uppercase">
                        <X size={9}/> Void Rejected
                      </span>
                    )}
                    {/* ── VOID PENDING ── */}
                    {hasVoidReq && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[9px] font-black uppercase animate-pulse">
                        <AlertTriangle size={9}/> Void Pending
                      </span>
                    )}
                    {/* ── PAID ── */}
                    {itemPaid && !voidApproved && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase">
                        <CheckCircle size={9}/> Paid
                      </span>
                    )}
                    {/* ── SENT TO CASHIER ── */}
                    {isSent && !itemPaid && !voidApproved && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[9px] font-black uppercase animate-pulse">
                        <Clock size={9}/> Sent ↗
                      </span>
                    )}
                    {/* ── PAY button ── */}
                    {isServed && !itemPaid && !isSent && !hasVoidReq && !voidApproved && (
                      <button onClick={() => onPayItem(item, order)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-black text-[10px] uppercase tracking-widest hover:bg-yellow-500/20 transition-all">
                        <Receipt size={11}/> Pay
                      </button>
                    )}
                    {/* ── REQUEST VOID — also shows again after rejection ── */}
                    {!isServed && !itemPaid && !isSent && !hasVoidReq && !voidApproved && (
                      <button onClick={() => onVoidItem(item, order)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-black text-[9px] uppercase tracking-widest hover:bg-red-500/20 transition-all whitespace-nowrap">
                        <AlertTriangle size={10}/> Void
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pay remaining */}
          {isServed && !tableAllPaid && payableItems.length > 0 && (
            <button onClick={() => onPayTable(order)}
              className="w-full mt-2 py-2.5 rounded-xl bg-yellow-500 text-black font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-yellow-400 active:scale-[0.98] transition-all">
              <Banknote size={13}/>
              Pay {payableItems.length === order.items.length ? "Full Table" : "Remaining"} · UGX {order.unsentTotal.toLocaleString()}
            </button>
          )}
        </div>
      )}

      {/* ── BOTTOM ACTION BAR ── */}
      {!tableAllPaid && (
        <div className={`flex gap-3 px-5 pb-5 pt-2 border-t ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>

          {/* ── ALL ITEMS VOIDED → Cancelled Order (replaces everything) ── */}
          {allItemsVoided ? (
            <div className="flex-1 py-3 rounded-2xl border border-red-500/20 bg-red-500/5 flex items-center justify-center gap-2">
              <X size={13} className="text-red-400"/>
              <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Cancelled Order</p>
            </div>
          ) : (
            <>
              {/* Mark as served — only when not all voided */}
              {isReady && !isServed && (
                <button onClick={() => onMarkServed(order)}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2">
                  <Bell size={14}/> Mark as Served
                </button>
              )}
              {/* Unserve — lets waiter undo accidental serve */}
              {isServed && (
                <button onClick={() => onUnserve(order)}
                  className={`py-3 px-4 rounded-2xl border font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shrink-0
                    ${theme === "dark" ? "border-white/10 text-zinc-500 hover:text-white hover:border-white/20" : "border-black/10 text-zinc-400 hover:text-zinc-700"}`}>
                  <RotateCcw size={13}/> Unserve
                </button>
              )}
              {/* Pay button — hidden if all remaining items are voided */}
              {isServed && payableItems.length > 0 && (
                <button onClick={() => onPayTable(order)}
                  className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 active:scale-[0.98] text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2">
                  <Send size={14}/>
                  {payableItems.length < order.items.length ? "Pay Remaining" : "Pay"}
                </button>
              )}
              {/* All items sent, waiting cashier */}
              {isServed && allItemsSent && (
                <div className="flex-1 py-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"/>
                  <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Awaiting Cashier</p>
                </div>
              )}
              {/* Not ready yet — station-specific waiting message */}
              {!isReady && !isServed && (
                <div className="flex-1 py-3 rounded-2xl border border-white/5 flex items-center justify-center gap-2">
                  {preparingStation && preparingStation !== "kitchen" ? (
                    <>
                      <span className={STATION_CONFIG[preparingStation].color}>
                        {STATION_CONFIG[preparingStation].icon}
                      </span>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${STATION_CONFIG[preparingStation].color}`}>
                        {STATION_CONFIG[preparingStation].label}…
                      </p>
                    </>
                  ) : (
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Awaiting Kitchen…</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, highlight, theme, sub }) {
  const base = highlight
    ? "bg-yellow-500 border-yellow-500 text-black"
    : theme === "dark" ? "bg-zinc-900 border-white/5 text-white" : "bg-white border-black/5 text-zinc-900 shadow-sm";
  return (
    <div className={`p-5 rounded-2xl border transition-all hover:scale-[1.02] duration-200 ${base}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${highlight ? "bg-black/10" : theme === "dark" ? "bg-white/5" : "bg-zinc-50"}`}>{icon}</div>
        <span className={`text-[9px] font-black uppercase tracking-widest ${highlight ? "text-black/50" : "text-zinc-500"}`}>{highlight ? "Total" : "Collected"}</span>
      </div>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${highlight ? "text-black/60" : "text-zinc-500"}`}>{label}</p>
      <h3 className={`text-2xl font-black leading-tight tracking-tight ${highlight ? "text-black" : ""}`}>
        UGX {(Number(value) || 0).toLocaleString()}
      </h3>
      {sub && <p className={`text-[9px] font-bold mt-1 ${highlight ? "text-black/50" : "text-zinc-500"}`}>{sub}</p>}
    </div>
  );
}

// ─── ITEM KEY ─────────────────────────────────────────────────────────────────
function itemKey(tableName, item) {
  return `${tableName}::${item.name}::${item._itemIndex ?? ""}`;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function OrderHistory({ shiftEnded = false }) {
  const { orders = [], currentUser, refreshData } = useData() || {};
  const { theme } = useTheme();

  const savedUser        = useMemo(() => { try { return JSON.parse(localStorage.getItem("kurax_user") || "{}"); } catch { return {}; } }, []);
  const currentStaffId   = currentUser?.id   || savedUser?.id;
  const currentStaffName = currentUser?.name || savedUser?.name || "Staff Member";

  const [activeTab,   setActiveTab]   = useState("Live");
  const [searchQuery, setSearchQuery] = useState("");
  const [payTarget,   setPayTarget]   = useState(null);
  const [voidItem,    setVoidItem]    = useState(null);
  const [sentItems,   setSentItems]   = useState(new Set());
  const [confirmedQueue, setConfirmedQueue] = useState([]);

  // When shiftEnded=true (passed from WaiterLayout after end-shift):
  // clear confirmedQueue immediately and stop polling so SOURCE 2 totals
  // don't survive after the shift is archived.
  useEffect(() => {
    if (shiftEnded) {
      setConfirmedQueue([]);
      return; // don't start a new poll
    }
    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/api/orders/cashier-history`);
        if (res.ok) setConfirmedQueue(await res.json());
      } catch {}
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [shiftEnded]); // re-runs when shiftEnded flips to true

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

  const DAILY_GOAL = 20;

  const dailyStaffOrders = useMemo(() =>
    (orders || []).filter(o => {
      const ts = o.timestamp || o.created_at;
      if (!ts) return false;
      const mine =
        String(o.staff_id || o.staffId) === String(currentStaffId) ||
        (o.staff_name || o.waiterName) === currentStaffName;
      // KEY FIX: exclude shift_cleared orders — these are archived to staff_shifts DB.
      // Without this, the waiter sees yesterday's totals on their next shift because
      // the orders still exist in the DB (archived, not deleted) and still match
      // the date + staff filters above.
      const cleared = o.shift_cleared === true || o.shift_cleared === "t" || o.shift_cleared === "true";
      return mine && toLocalDateStr(new Date(ts)) === today && !cleared;
    }),
  [orders, currentStaffId, currentStaffName, today]);

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

      (order.items || []).forEach(item => {
        g.items.push({ ...item, _orderId: order.id, _rowPaid: rowPaid });
      });

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
        const matchSearch = g.tableName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchTab =
          activeTab === "Live"
            ? ["Pending","Preparing","Ready","Delayed"].includes(g.status)
            : ["Served","Paid","Closed","Credit","Mixed"].includes(g.status);
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

  // Totals come from confirmedQueue ONLY — never from orders[].
  // orders[].payment_method is always "Cash" (hardcoded in NewOrder.jsx),
  // so reading it would double-count every non-cash payment and miscount cash.
  // confirmedQueue has the real method for every payment (full-order + item-level).
  // After end-shift: confirmedQueue is cleared (shiftEnded=true + backend filter),
  // so totals correctly drop to zero for the new shift.
  const totals = useMemo(() => {
    const acc = { Cash: 0, Card: 0, MTN: 0, Airtel: 0, Momo: 0, all: 0 };
    if (shiftEnded) return acc; // shift ended — show zeros until next end-shift
    confirmedQueue.forEach(row => {
      if (row.status !== "Confirmed") return;
      const confirmedOn = toLocalDateStr(new Date(row.confirmed_at || row.created_at));
      if (confirmedOn !== today) return;
      if (row.requested_by !== currentStaffName) return;
      const amt = Number(row.amount) || 0;
      switch (row.method) {
        case "Cash":        acc.Cash   += amt; acc.all += amt; break;
        case "Card":        acc.Card   += amt; acc.all += amt; break;
        case "Momo-MTN":    acc.MTN    += amt; acc.Momo += amt; acc.all += amt; break;
        case "Momo-Airtel": acc.Airtel += amt; acc.Momo += amt; acc.all += amt; break;
        default:            acc.all    += amt; break; // Credit/Mixed → gross only
      }
    });
    return acc;
  }, [confirmedQueue, today, currentStaffName, shiftEnded]);

  const readyCount      = useMemo(() => enrichedGroups.filter(o => o.status === "Ready").length, [enrichedGroups]);
  const liveCount       = useMemo(() => enrichedGroups.filter(o => ["Pending","Preparing","Ready","Delayed"].includes(o.status)).length, [enrichedGroups]);
  const servedCount     = useMemo(() => enrichedGroups.filter(o => ["Served","Paid","Closed","Credit","Mixed"].includes(o.status)).length, [enrichedGroups]);
  const progressPercent = Math.min((dailyStaffOrders.length / DAILY_GOAL) * 100, 100);
  const paidCount       = dailyStaffOrders.filter(o => o.status === "Paid" || o.is_paid).length;
  const firstName       = (currentStaffName.split(" ")[0] || "Staff");

  // ── Mark served ───────────────────────────────────────────────────────────
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

  // ── ✅ UNSERVE — sets status back to Ready ────────────────────────────────
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

  // ── ✅ VOID — hits API so accountant sees it in Live Audit ────────────────
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
    <div className={`min-h-screen font-[Outfit] pb-28 transition-colors duration-300 ${theme === "dark" ? "bg-black text-white" : "bg-zinc-50 text-zinc-900"}`}>

      {/* HEADER */}
      <div className={`sticky top-0 z-10 w-full border-b px-4 md:px-8 lg:px-12 py-4 flex items-center justify-between gap-4
        ${theme === "dark" ? "bg-zinc-950/95 backdrop-blur-xl border-white/5" : "bg-white/95 backdrop-blur-xl border-black/5 shadow-sm"}`}>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-yellow-500 flex items-center justify-center font-black text-black text-base shrink-0">
            {firstName[0]}
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              <p className="text-[8px] font-black uppercase tracking-[0.25em] text-zinc-500">Active · {today}</p>
            </div>
            <h1 className="text-base font-black uppercase tracking-tighter leading-none">
              {firstName}'s <span className="text-yellow-500">Dashboard</span>
            </h1>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-8 flex-1 justify-center">
          {[
            { label: "Orders", value: `${dailyStaffOrders.length}`, suffix: `/${DAILY_GOAL}` },
            { label: "Gross",  value: `UGX ${totals.all.toLocaleString()}`,  color: "text-yellow-500" },
            { label: "Cash",   value: `UGX ${totals.Cash.toLocaleString()}`, color: "text-emerald-500" },
            { label: "Momo",   value: `UGX ${totals.Momo.toLocaleString()}`, color: "text-yellow-400" },
            { label: "Card",   value: `UGX ${totals.Card.toLocaleString()}`, color: "text-blue-400" },
          ].map(({ label, value, suffix, color }, i, arr) => (
            <React.Fragment key={label}>
              <div className="text-center">
                <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{label}</p>
                <p className={`text-xl font-black ${color || ""}`}>
                  {value}{suffix && <span className="text-xs text-zinc-500">{suffix}</span>}
                </p>
              </div>
              {i < arr.length - 1 && <div className={`w-px h-8 ${theme === "dark" ? "bg-white/10" : "bg-black/10"}`} />}
            </React.Fragment>
          ))}
        </div>

        {readyCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500 rounded-xl shrink-0 animate-pulse">
            <Bell size={13} className="text-black" />
            <span className="text-[10px] font-black text-black uppercase tracking-widest">{readyCount} Ready</span>
          </div>
        )}
      </div>

      <div className="px-4 md:px-8 lg:px-12 pt-6">
        {/* Progress */}
        <div className={`p-4 rounded-2xl border mb-4 ${theme === "dark" ? "bg-zinc-900 border-white/5" : "bg-white border-black/5 shadow-sm"}`}>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-orange-400" />
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Daily Target Progress</p>
            </div>
            <span className="text-[11px] font-black text-orange-400">
              {dailyStaffOrders.length} / {DAILY_GOAL} · {Math.round(progressPercent)}%
            </span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-1000 rounded-full"
              style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {/* Mobile stat cards */}
        <div className="lg:hidden grid grid-cols-2 gap-3 mb-6">
          <StatCard theme={theme} label="Cash"  value={totals.Cash} icon={<Banknote size={18} className="text-emerald-500"/>} sub={totals.Cash > 0 ? "✓ Collected" : "None yet"} />
          <StatCard theme={theme} label="Momo"  value={totals.Momo} icon={<Smartphone size={18} className="text-yellow-500"/>} sub={totals.Momo > 0 ? "✓ Collected" : "None yet"} />
          <StatCard theme={theme} label="Card"  value={totals.Card} icon={<CreditCard size={18} className="text-blue-500"/>} sub={totals.Card > 0 ? "✓ Collected" : "None yet"} />
          <StatCard theme={theme} label="Gross" value={totals.all}  highlight icon={<TrendingUp size={18} className="text-black/60"/>} sub={`${paidCount} paid`} />
        </div>

        {/* Tabs + search */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex gap-1 p-1 rounded-2xl bg-zinc-900 shrink-0">
            {[{ key: "Live", count: liveCount }, { key: "Served", count: servedCount }].map(({ key, count }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2
                  ${activeTab === key ? "bg-yellow-500 text-black shadow" : "text-zinc-500 hover:text-zinc-300"}`}>
                {key}
                {count > 0 && (
                  <span className={`w-5 h-5 rounded-full text-[9px] font-black inline-flex items-center justify-center
                    ${activeTab === key ? "bg-black/20 text-black" : "bg-zinc-800 text-zinc-400"}`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
            <input type="text" placeholder="Filter by table…" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full py-2.5 pl-9 pr-4 rounded-2xl text-xs font-bold outline-none border transition-all
                ${theme === "dark" ? "bg-zinc-900 border-white/5 focus:border-yellow-500/50 text-white" : "bg-white border-black/5 focus:border-yellow-500 text-zinc-900"}`} />
          </div>
        </div>

        {/* Orders grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOrders.length === 0 ? (
            <div className="col-span-full py-32 text-center opacity-20">
              <ClipboardList size={52} className="mx-auto mb-3" />
              <p className="text-xs font-black uppercase tracking-[0.3em]">No orders in {activeTab}</p>
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
              onVoidItem={(item, ord) => setVoidItem({ item, order: ord })} />
          ))}
        </div>
      </div>

      {payTarget && (
        <PayModal target={payTarget} onClose={() => setPayTarget(null)} onSend={handleSend} />
      )}
      {voidItem && (
        <VoidModal
          item={voidItem.item}
          tableName={voidItem.order.tableName}
          onClose={() => setVoidItem(null)}
          onConfirmVoid={handleVoidItem} />
      )}
    </div>
  );
}