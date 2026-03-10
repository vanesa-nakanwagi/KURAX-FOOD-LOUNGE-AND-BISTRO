import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import {
  Activity, Banknote, CreditCard, Smartphone, ClipboardList,
  Search, ChevronDown, ChevronUp, Bell, Trash2, X,
  AlertTriangle, Utensils, TrendingUp, Send, Receipt,
  BookOpen, User, Phone, CheckCircle, Clock
} from "lucide-react";
import API_URL from "../../../config/api";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
}
function getTodayLocal() { return toLocalDateStr(new Date()); }

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
// Used for both single-item pay and full-table pay.
// All data it needs (tableName, orderId, amount) is passed directly in `target`
// — no dependency on external state that could be stale.
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
      // For item pay: the single order row this item lives in
      // For table pay: all unsent order row ids
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

        {/* Header */}
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

          {/* Method selector */}
          <div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Select Payment Method</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PAY_METHODS.map(({ key, label: ml, icon, color, bg }) => (
                <button key={key} onClick={() => setMethod(key)}
                  className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest
                    ${method === key
                      ? `${bg} ${color} scale-[1.02] shadow-lg`
                      : "border-white/5 bg-white/3 text-zinc-500 hover:border-white/20"}`}>
                  <span className={method === key ? color : "text-zinc-600"}>{icon}</span>
                  {ml}
                </button>
              ))}
            </div>
          </div>

          {/* Momo instructions */}
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

          {/* Credit fields */}
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

          {/* Amount */}
          <div className="bg-white/3 rounded-2xl p-4 flex justify-between items-center border border-white/5">
            <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">
              {isItem ? "Item Total" : "Table Total"}
            </span>
            <span className="font-black text-white text-xl">UGX {amount.toLocaleString()}</span>
          </div>

          {/* Send button */}
          <button disabled={!canSend || sending} onClick={handleSend}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2
              ${canSend && !sending
                ? "bg-yellow-500 text-black hover:bg-yellow-400 active:scale-[0.98]"
                : "bg-white/5 text-zinc-600 cursor-not-allowed"}`}>
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
              <p className="font-black text-white text-sm">Void Item Request</p>
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
            placeholder="Reason for void…"
            className="w-full bg-white/3 border border-white/5 rounded-2xl p-4 text-sm text-white placeholder-zinc-600 outline-none focus:border-red-500/40 resize-none h-20 mb-4" />
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
// sentItems  = Set of item keys already sent to cashier (tracked in parent state)
// tableAllPaid = true when every order row for this table is Paid/Credit
function OrderCard({ order, theme, sentItems, onMarkServed, onPayItem, onPayTable, onVoidItem }) {
  const [expanded, setExpanded] = useState(false);

  const isReady    = order.status === "Ready";
  const isServed   = order.status === "Served";
  const tableAllPaid = order.allPaid;

  // How many items are still payable (served, not yet sent, not paid at row level)
  const payableItems = order.items.filter(item => {
    const key = itemKey(order.tableName, item);
    return !sentItems.has(key) && !item._rowPaid;
  });
  const allItemsSent = !tableAllPaid && payableItems.length === 0 && order.items.length > 0;
  const someItemsSent = !tableAllPaid && order.items.some(item => sentItems.has(itemKey(order.tableName, item)));

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
    tableAllPaid    ? "Paid"
    : allItemsSent  ? "AwaitingPayment"
    : someItemsSent ? "PartialSent"
    : order.status;

  const s = statusConfig[derivedStatus] || statusConfig.Pending;

  return (
    <div className={`rounded-[1.75rem] border-2 overflow-hidden transition-all duration-300
      ${isReady && !tableAllPaid ? "border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.12)]" : theme === "dark" ? "border-white/5" : "border-black/5 shadow-sm"}
      ${theme === "dark" ? "bg-zinc-900" : "bg-white"}`}>

      {/* Ready banner */}
      {isReady && !tableAllPaid && (
        <div className="bg-emerald-500 px-5 py-2 flex items-center justify-center gap-2">
          <Bell size={12} className="text-black" />
          <p className="text-[10px] font-black text-black uppercase tracking-widest">Order Ready — Please Serve!</p>
        </div>
      )}

      {/* Card header */}
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

      {/* ── EXPANDED ITEMS ─────────────────────────────────────────────────── */}
      {expanded && (
        <div className={`border-t px-5 pb-4 pt-3 space-y-2 ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
          {order.items.map((item, i) => {
            const key      = itemKey(order.tableName, item);
            const isSent   = sentItems.has(key);
            const itemPaid = item._rowPaid;
            const itemTotal= Number(item.price || 0) * Number(item.quantity || 1);

            return (
              <div key={i}
                className={`rounded-xl overflow-hidden transition-all ${itemPaid ? "opacity-50" : ""}
                  ${theme === "dark" ? "bg-white/3" : "bg-zinc-50"}`}>
                <div className="flex items-center justify-between py-2.5 px-3 gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`font-black text-sm truncate ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
                      {item.name}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-medium">
                      x{item.quantity || 1} · UGX {itemTotal.toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Paid badge */}
                    {itemPaid && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase">
                        <CheckCircle size={9}/> Paid
                      </span>
                    )}
                    {/* Sent-to-cashier badge — shows while waiting for cashier */}
                    {isSent && !itemPaid && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[9px] font-black uppercase animate-pulse">
                        <Clock size={9}/> Sent ↗
                      </span>
                    )}
                    {/* PAY button — only when: order is Served, item not yet sent, not paid */}
                    {isServed && !itemPaid && !isSent && (
                      <button onClick={() => onPayItem(item, order)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-black text-[10px] uppercase tracking-widest hover:bg-yellow-500/20 transition-all">
                        <Receipt size={11}/> Pay
                      </button>
                    )}
                    {/* Void — only before served, not sent, not paid */}
                    {!isServed && !itemPaid && !isSent && (
                      <button onClick={() => onVoidItem(item, order)}
                        className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 transition-all">
                        <Trash2 size={13} className="text-red-400"/>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pay remaining — only shows if served and at least one item is unsent/unpaid */}
          {isServed && !tableAllPaid && payableItems.length > 0 && (
            <button onClick={() => onPayTable(order)}
              className="w-full mt-2 py-2.5 rounded-xl bg-yellow-500 text-black font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-yellow-400 active:scale-[0.98] transition-all">
              <Banknote size={13}/>
              Pay {payableItems.length === order.items.length ? "Full Table" : "Remaining"} · UGX {order.unsentTotal.toLocaleString()}
            </button>
          )}
        </div>
      )}

      {/* ── BOTTOM ACTION BAR ──────────────────────────────────────────────── */}
      {!tableAllPaid && (
        <div className={`flex gap-3 px-5 pb-5 pt-2 border-t ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
          {/* Mark as served */}
          {isReady && !isServed && (
            <button onClick={() => onMarkServed(order)}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2">
              <Bell size={14}/> Mark as Served
            </button>
          )}
          {/* Pay button — shows when served and there are items not yet sent */}
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
          {/* Not ready yet */}
          {!isReady && !isServed && (
            <div className="flex-1 py-3 rounded-2xl border border-white/5 flex items-center justify-center">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Awaiting Kitchen…</p>
            </div>
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
// Unique string to identify one specific item for sentItems tracking.
// Always uses item._itemIndex (assigned during grouping) so the key is
// consistent whether called from OrderCard, handlePayItem, or handleSend.
// "_itemIndex" is the item's position in the merged items array for the table.
function itemKey(tableName, item) {
  return `${tableName}::${item.name}::${item._itemIndex ?? ""}`;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function OrderHistory() {
  const { orders = [], currentUser, refreshData } = useData() || {};
  const { theme } = useTheme();

  const savedUser        = useMemo(() => { try { return JSON.parse(localStorage.getItem("kurax_user") || "{}"); } catch { return {}; } }, []);
  const currentStaffId   = currentUser?.id   || savedUser?.id;
  const currentStaffName = currentUser?.name || savedUser?.name || "Staff Member";

  const [activeTab,   setActiveTab]   = useState("Live");
  const [searchQuery, setSearchQuery] = useState("");
  const [payTarget,   setPayTarget]   = useState(null);
  const [voidItem,    setVoidItem]    = useState(null);

  // ── sentItems: Set of itemKey strings ─────────────────────────────────────
  // This is the KEY fix. Instead of relying on the DB row's sent_to_cashier
  // flag (which is one boolean for the whole order row covering ALL items),
  // we track sent status per individual item in local React state.
  //
  // When waiter sends Pilao by Cash → sentItems.add("T4::Pilao::0")
  // When waiter sends Chicken by Card → sentItems.add("T4::Chicken::1")
  // Chicken's Pay button is still visible while Pilao shows "Sent ↗"
  // They are two independent queue entries at the cashier with different methods.
  const [sentItems,      setSentItems]      = useState(new Set());
  const [confirmedQueue, setConfirmedQueue] = useState([]);

  // Poll cashier-history for per-item confirmed amounts (for waiter totals)
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/api/orders/cashier-history`);
        if (res.ok) setConfirmedQueue(await res.json());
      } catch {}
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  // Today resets at local midnight
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

  // ── Filter to my orders today ──────────────────────────────────────────────
  const dailyStaffOrders = useMemo(() =>
    (orders || []).filter(o => {
      const ts = o.timestamp || o.created_at;
      if (!ts) return false;
      const mine =
        String(o.staff_id || o.staffId) === String(currentStaffId) ||
        (o.staff_name || o.waiterName)   === currentStaffName;
      return mine && toLocalDateStr(new Date(ts)) === today;
    }),
  [orders, currentStaffId, currentStaffName, today]);

  // ── Group DB rows by table ─────────────────────────────────────────────────
  // Each DB order row carries its items array. Multiple rows can belong to
  // the same table (e.g. waiter added items in two submissions).
  // We merge them into one grouped card, annotating each item with:
  //   _orderId  — which DB row it came from (needed for routing send-to-cashier)
  //   _rowPaid  — whether that DB row is already Paid/Credit
  //   _itemIndex— its position within the merged items array (used for itemKey)
  const groupedTableOrders = useMemo(() => {
    const groups = {};
    dailyStaffOrders.forEach(order => {
      const key      = (order.table_name || order.tableName || "WALK-IN").trim().toUpperCase();
      const rowPaid  = order.status === "Paid" || order.status === "Credit"
                       || order.status === "Mixed"
                       || order.is_paid || order.isPaid;
      const rowSent  = order.sent_to_cashier || order.sentToCashier || false;

      if (!groups[key]) {
        groups[key] = {
          tableName:  key,
          displayId:  order.id ? String(order.id).slice(-6) : "000000",
          total:      0,
          items:      [],
          status:     order.status || "Pending",
          timestamp:  order.timestamp || order.created_at,
          orderIds:   [],
          _rows:      [],   // raw DB rows for this table
        };
      }

      const g = groups[key];
      g.total += Number(order.total) || 0;
      g.orderIds.push(order.id);
      g._rows.push({ id: order.id, paid: rowPaid, sent: rowSent, total: Number(order.total) || 0 });

      (order.items || []).forEach(item => {
        g.items.push({
          ...item,
          _orderId: order.id,  // which DB row this item belongs to
          _rowPaid: rowPaid,   // is that DB row fully paid?
          // NOTE: _sentToCashier is intentionally NOT set here.
          // The DB sent_to_cashier flag covers the whole order row, not
          // individual items. Per-item sent state is tracked exclusively
          // via the sentItems Set in component state.
        });
      });

      // Promote status: Served > Ready > Preparing > Pending
      const rank = { Served: 5, Ready: 4, Delayed: 3, Preparing: 2, Pending: 1 };
      if ((rank[order.status] || 0) > (rank[g.status] || 0)) g.status = order.status;
    });

    // Assign stable _itemIndex after all items are collected
    Object.values(groups).forEach(g => {
      g.items = g.items.map((item, idx) => ({ ...item, _itemIndex: idx }));
    });

    return groups;
  }, [dailyStaffOrders]);

  // ── Enrich: derive allPaid, unsentTotal, unsentOrderIds ───────────────────
  const enrichedGroups = useMemo(() =>
    Object.values(groupedTableOrders).map(group => {
      const allPaid = group._rows.length > 0 && group._rows.every(r => r.paid);
      // Unsent rows = not paid and not sent at the DB level
      // Used for "Pay Full Table" which sends all unsent rows at once
      const unsentRows     = group._rows.filter(r => !r.paid && !r.sent);
      const unsentOrderIds = unsentRows.map(r => r.id);
      const unsentTotal    = unsentRows.reduce((s, r) => s + r.total, 0);

      return {
        ...group,
        allPaid,
        unsentOrderIds,
        unsentTotal: unsentTotal || group.total, // fallback to full total
      };
    }),
  [groupedTableOrders]);

  // ── Filtered + sorted for display ─────────────────────────────────────────
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

  // ── Totals ─────────────────────────────────────────────────────────────────
  // Strategy:
  //   Full-table payments (Cash/Card/Momo): read from orders.payment_method
  //   Per-item payments (Mixed):            read from cashier_queue Confirmed rows
  //     filtered to this staff + today — same source the cashier uses.
  //   This gives accurate Cash/Card/Momo splits for both flows.
  const totals = useMemo(() => {
    const acc = { Cash: 0, Card: 0, Momo: 0, all: 0 };

    // ── 1. Full-table paid orders (non-Mixed) ────────────────────────────────
    dailyStaffOrders.forEach(o => {
      const paid = o.status === "Paid" || o.is_paid || o.isPaid;
      if (!paid) return;
      const raw = (o.payment_method || o.paymentMethod || "").toLowerCase().trim();
      if (raw === "mixed") return; // handled below via cashier_queue
      const amt = Number(o.total) || 0;
      if      (!raw || raw === "cash")                          { acc.Cash += amt; acc.all += amt; }
      else if (raw === "card" || raw.includes("card"))          { acc.Card += amt; acc.all += amt; }
      else if (raw.includes("mtn") || raw.includes("airtel") || raw.includes("momo")) {
                                                                  acc.Momo += amt; acc.all += amt; }
      else                                                      {                  acc.all += amt; }
    });

    // ── 2. Per-item confirmed payments from cashier_queue ────────────────────
    // Filter: Confirmed today + sent by this staff + is_item=true.
    // is_item=true means this was a per-item payment (not a full-table payment).
    // Full-table payments (is_item=false) are already counted from orders above.
    // Filtering by is_item avoids double-counting without needing to know
    // whether the orders row has reached status=Mixed yet.
    confirmedQueue.forEach(row => {
      if (row.status !== "Confirmed") return;
      if (!row.is_item) return;  // skip full-table payments (counted from orders above)
      const confirmedOn = toLocalDateStr(new Date(row.confirmed_at || row.created_at));
      if (confirmedOn !== today) return;
      if (row.requested_by !== currentStaffName) return;

      const amt = Number(row.amount) || 0;
      switch (row.method) {
        case "Cash":        acc.Cash += amt; acc.all += amt; break;
        case "Card":        acc.Card += amt; acc.all += amt; break;
        case "Momo-MTN":
        case "Momo-Airtel": acc.Momo += amt; acc.all += amt; break;
        default: break;
      }
    });

    return acc;
  }, [dailyStaffOrders, confirmedQueue, today, currentStaffName]);

  const readyCount      = useMemo(() => enrichedGroups.filter(o => o.status === "Ready").length,  [enrichedGroups]);
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

  // ── Open pay modal for a single item ──────────────────────────────────────
  const handlePayItem = useCallback((item, order) => {
    setPayTarget({
      type:      "item",
      tableName: order.tableName,
      item,
      orderId:   item._orderId,   // the DB row this item belongs to
    });
  }, []);

  // ── Open pay modal for full/remaining table ────────────────────────────────
  const handlePayTable = useCallback((order) => {
    setPayTarget({
      type:       "table",
      tableName:  order.tableName,
      total:      order.unsentTotal,
      orderIds:   order.unsentOrderIds.length ? order.unsentOrderIds : order.orderIds,
    });
  }, []);

  // ── Send to cashier ────────────────────────────────────────────────────────
  // After sending, we mark the item(s) in sentItems so their Pay button hides
  // immediately — no need to wait for a DB round-trip / refreshData.
  const handleSend = useCallback(async (payload) => {
    try {
      await fetch(`${API_URL}/api/orders/send-to-cashier`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_ids:    payload.orderIds,
          table_name:   payload.tableName,
          method:       payload.method,
          amount:       payload.amount,
          label:        payload.label,
          is_item:      payload.type === "item",
          item:         payload.item,
          credit_info:  payload.creditInfo,
          requested_by: currentStaffName,
          staff_id:     currentStaffId,
        }),
      });

      // Mark item(s) as sent in local state immediately
      setSentItems(prev => {
        const next = new Set(prev);
        if (payload.type === "item" && payload.item) {
          // Single item: mark just this item's key
          next.add(itemKey(payload.tableName, payload.item));
        } else {
          // Full / remaining table: mark every unpaid item in the group
          const group = enrichedGroups.find(g => g.tableName === payload.tableName);
          if (group) {
            group.items.forEach(item => {
              if (!item._rowPaid) next.add(itemKey(payload.tableName, item));
            });
          }
        }
        return next;
      });

      refreshData?.();
    } catch (err) { console.error("Send to cashier failed:", err); }
  }, [currentStaffName, currentStaffId, enrichedGroups, refreshData]);

  // ── Void item ──────────────────────────────────────────────────────────────
  const handleVoidItem = useCallback(async (item, reason) => {
    try {
      await fetch(`${API_URL}/api/orders/void-item`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
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

      {/* ── HEADER ── */}
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
              onPayItem={handlePayItem}
              onPayTable={handlePayTable}
              onVoidItem={(item, ord) => setVoidItem({ item, order: ord })} />
          ))}
        </div>
      </div>

      {payTarget && (
        <PayModal
          target={payTarget}
          onClose={() => setPayTarget(null)}
          onSend={handleSend} />
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