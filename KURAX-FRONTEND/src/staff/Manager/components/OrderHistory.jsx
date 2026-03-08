import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import {
  Activity, Banknote, CreditCard, Smartphone, ClipboardList,
  CheckCircle, Search, ChevronDown, ChevronUp, Bell,
  Trash2, X, AlertTriangle, Utensils, TrendingUp,
  ShieldAlert, Users, Eye, Clock, UserX
} from "lucide-react";
import API_URL from "../../../config/api";

// ─── MOMO CODES ───────────────────────────────────────────────────────────────
const MOMO_CODES = {
  MTN:    { label: "MTN MoMo",    color: "#FFCC00", merchant: "*165*3#", till: "KURAX-MTN-001", instructions: "Dial *165*3# → Send Money → Merchant → Enter till number" },
  AIRTEL: { label: "Airtel Money", color: "#FF0000", merchant: "*185#",  till: "KURAX-AIR-002", instructions: "Dial *185# → Make Payment → Enter merchant code" },
};

// ─── PAY MODAL (own orders only) ─────────────────────────────────────────────
function PayModal({ order, onClose, onConfirmPay }) {
  const [step, setStep]           = useState("select");
  const [method, setMethod]       = useState(null);
  const [momoNetwork, setMomo]    = useState(null);
  const [confirming, setConfirm]  = useState(false);

  const handleSelectMethod = (m) => {
    setMethod(m);
    if (m === "Momo") { setStep("momo"); setMomo(null); }
  };

  const handlePay = async () => {
    setConfirm(true);
    await onConfirmPay(order, method, momoNetwork);
    setConfirm(false);
    onClose();
  };

  const canPay = method && (method !== "Momo" || momoNetwork);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-2 pb-0 sm:pb-4">
      <div className="w-full max-w-md bg-zinc-950 rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
          <div>
            <p className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">Payment</p>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">{order.tableName}</h2>
            <p className="text-zinc-400 text-xs mt-0.5">UGX {order.total.toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all">
            <X size={16} className="text-zinc-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {step === "select" && (
            <>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Select Payment Method</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "Cash", icon: <Banknote size={22} />, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
                  { key: "Card", icon: <CreditCard size={22} />, color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30" },
                  { key: "Momo", icon: <Smartphone size={22} />, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
                ].map(({ key, icon, color, bg }) => (
                  <button key={key} onClick={() => handleSelectMethod(key)}
                    className={`flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition-all font-black text-[11px] uppercase tracking-widest
                      ${method === key ? `${bg} ${color} scale-[1.03] shadow-lg` : "border-white/5 bg-white/3 text-zinc-500 hover:border-white/20"}`}>
                    <span className={method === key ? color : "text-zinc-600"}>{icon}</span>
                    {key}
                  </button>
                ))}
              </div>
            </>
          )}
          {step === "momo" && (
            <>
              <button onClick={() => { setStep("select"); setMethod(null); }}
                className="flex items-center gap-1 text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 hover:text-yellow-500 transition-colors">
                ← Back
              </button>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Select Network</p>
              <div className="space-y-3">
                {Object.entries(MOMO_CODES).map(([net, info]) => (
                  <button key={net} onClick={() => setMomo(net)}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${momoNetwork === net ? "border-yellow-500/50 bg-yellow-500/5" : "border-white/5 bg-white/3 hover:border-white/20"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black text-sm text-white">{info.label}</span>
                      <span className="text-[10px] font-black px-3 py-1 rounded-full" style={{ background: info.color + "22", color: info.color }}>{net}</span>
                    </div>
                    {momoNetwork === net && (
                      <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold">Merchant Code</span>
                          <span className="font-black text-white text-sm tracking-widest">{info.merchant}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold">Till Number</span>
                          <span className="font-black text-yellow-400 text-sm">{info.till}</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-relaxed mt-2 bg-white/3 rounded-xl p-3">{info.instructions}</p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="bg-white/3 rounded-2xl p-4 flex justify-between items-center border border-white/5">
            <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Total Due</span>
            <span className="font-black text-white text-xl">UGX {order.total.toLocaleString()}</span>
          </div>
          <button disabled={!canPay || confirming} onClick={handlePay}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2
              ${canPay ? "bg-yellow-500 text-black hover:bg-yellow-400 active:scale-[0.98]" : "bg-white/5 text-zinc-600 cursor-not-allowed"}`}>
            {confirming ? "Processing..." : canPay ? `Confirm ${method} Payment` : "Select a Method"}
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
            <div className="flex justify-between items-center">
              <span className="text-white font-black text-sm">{item.name}</span>
              <span className="text-yellow-400 font-black text-sm">x{item.quantity || 1}</span>
            </div>
            <p className="text-zinc-500 text-[10px] mt-1">UGX {Number(item.price || 0).toLocaleString()}</p>
          </div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for void..."
            className="w-full bg-white/3 border border-white/5 rounded-2xl p-4 text-sm text-white placeholder-zinc-600 outline-none focus:border-red-500/40 resize-none h-20 mb-4" />
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onClose} className="py-3 rounded-xl border border-white/10 text-zinc-400 font-black text-xs uppercase tracking-widest hover:bg-white/5 transition-all">Cancel</button>
            <button onClick={handleVoid} disabled={!reason.trim() || loading}
              className="py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 font-black text-xs uppercase tracking-widest hover:bg-red-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? "Sending..." : "Request Void"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DELAY TIMER HOOK ─────────────────────────────────────────────────────────
// Returns minutes elapsed since order was placed
function useMinutesElapsed(timestamp) {
  const [mins, setMins] = useState(0);
  useEffect(() => {
    const calc = () => {
      if (!timestamp) return;
      setMins(Math.floor((Date.now() - new Date(timestamp)) / 60000));
    };
    calc();
    const id = setInterval(calc, 30000); // refresh every 30s
    return () => clearInterval(id);
  }, [timestamp]);
  return mins;
}

// ─── ORDER CARD ───────────────────────────────────────────────────────────────
function OrderCard({ order, theme, onMarkServed, onOpenPay, onVoidItem, isOwnOrder }) {
  const [expanded, setExpanded] = useState(false);
  const isReady  = order.status === "Ready";
  const isPaid   = order.isPaid;
  const isServed = order.status === "Served";
  const minutesElapsed = useMinutesElapsed(order.timestamp);

  // Delayed = active (not served/paid) and over 30 minutes old
  const isDelayed = !isPaid && !isServed && minutesElapsed >= 30 &&
    ["Pending","Preparing","Ready"].includes(order.status);

  const statusConfig = {
    Pending:   { label: "Pending",   color: "text-zinc-400",    bg: "bg-zinc-500/10 border-zinc-500/20",      dot: "bg-zinc-400" },
    Preparing: { label: "Preparing", color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20",  dot: "bg-orange-400 animate-pulse" },
    Ready:     { label: "🔔 Ready!", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400" },
    Delayed:   { label: "Delayed",   color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",         dot: "bg-red-400" },
    Served:    { label: "Served",    color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",       dot: "bg-blue-400" },
    Paid:      { label: "Paid",      color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
  };
  const s = statusConfig[isPaid ? "Paid" : order.status] || statusConfig.Pending;

  // Card border: delayed overrides everything
  const borderClass = isDelayed
    ? "border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
    : isReady
      ? "border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.12)]"
      : theme === "dark" ? "border-white/5" : "border-black/5 shadow-sm";

  return (
    <div className={`rounded-[1.75rem] border-2 overflow-hidden transition-all duration-300 ${borderClass}
      ${theme === "dark" ? "bg-zinc-900" : "bg-white"}`}>

      {/* Delayed warning banner */}
      {isDelayed && (
        <div className="bg-red-500 px-5 py-2 flex items-center justify-center gap-2">
          <Clock size={12} className="text-white animate-pulse" />
          <p className="text-[10px] font-black text-white uppercase tracking-widest">
            Delayed {minutesElapsed}m — Check on {order.waiterName || "waiter"}
          </p>
          <UserX size={12} className="text-white" />
        </div>
      )}

      {/* Ready banner (own orders only or all-floor view) */}
      {isReady && !isPaid && !isDelayed && (
        <div className="bg-emerald-500 px-5 py-2 flex items-center justify-center gap-2">
          <Bell size={12} className="text-black" />
          <p className="text-[10px] font-black text-black uppercase tracking-widest">Order Ready — Please Serve!</p>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center shrink-0
              ${isDelayed ? "bg-red-500" : isReady ? "bg-emerald-500" : "bg-black"}`}>
              <p className="text-[7px] font-black text-white/40 leading-none">TBL</p>
              <p className={`text-base font-black italic leading-none ${isDelayed || isReady ? "text-black" : "text-white"}`}>
                {order.tableName.replace(/TABLE/i, "").trim() || "#"}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-black text-sm uppercase tracking-tight ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>{order.tableName}</span>
                <span className="text-[9px] text-zinc-500 font-bold">#{order.displayId}</span>
                {/* Live elapsed timer for active orders */}
                {!isPaid && !isServed && minutesElapsed > 0 && (
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest
                    ${isDelayed ? "bg-red-500/20 text-red-400" : "bg-zinc-800 text-zinc-500"}`}>
                    {minutesElapsed}m
                  </span>
                )}
              </div>
              <p className={`text-[10px] font-bold uppercase mt-0.5 ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`}>
                {order.items.length} item{order.items.length !== 1 ? "s" : ""} · UGX {order.total.toLocaleString()}
              </p>
              {order.waiterName && (
                <p className={`text-[9px] font-bold mt-0.5 uppercase tracking-wide
                  ${isDelayed ? "text-red-400" : "text-yellow-500/70"}`}>
                  by {order.waiterName}
                </p>
              )}
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest shrink-0
            ${isDelayed ? "bg-red-500/15 border-red-500/30 text-red-400" : `${s.bg} ${s.color}`}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isDelayed ? "bg-red-400 animate-pulse" : s.dot}`} />
            {isDelayed ? `${minutesElapsed}m Delayed` : s.label}
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

      {expanded && (
        <div className={`border-t px-5 pb-4 pt-3 space-y-2 ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
          {order.items.map((item, i) => (
            <div key={i} className={`flex items-center justify-between py-2.5 px-3 rounded-xl ${theme === "dark" ? "bg-white/3" : "bg-zinc-50"}`}>
              <div className="flex-1 min-w-0">
                <p className={`font-black text-sm truncate ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>{item.name}</p>
                <p className="text-[10px] text-zinc-500 font-medium">x{item.quantity || 1} · UGX {Number(item.price || 0).toLocaleString()}</p>
              </div>
              {/* Void only on own orders */}
              {isOwnOrder && !isPaid && !isServed && (
                <button onClick={() => onVoidItem(item, order)}
                  className="ml-3 w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 transition-all shrink-0">
                  <Trash2 size={13} className="text-red-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons — ONLY for manager's own orders */}
      {isOwnOrder && !isPaid && (
        <div className={`flex gap-3 px-5 pb-5 pt-2 border-t ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
          {isReady && !isServed && (
            <button onClick={() => onMarkServed(order)}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2">
              <CheckCircle size={14} /> Mark as Served
            </button>
          )}
          {isServed && (
            <button onClick={() => onOpenPay(order)}
              className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 active:scale-[0.98] text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2">
              <Banknote size={14} /> Collect Payment
            </button>
          )}
          {!isReady && !isServed && (
            <div className="flex-1 py-3 rounded-2xl border border-white/5 flex items-center justify-center">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Awaiting Kitchen…</p>
            </div>
          )}
        </div>
      )}

      {/* Floor view read-only indicator */}
      {!isOwnOrder && !isPaid && (
        <div className={`px-5 pb-5 pt-2 border-t ${theme === "dark" ? "border-white/5" : "border-black/5"}`}>
          <div className="py-2.5 rounded-2xl border border-white/5 flex items-center justify-center gap-2">
            <Eye size={11} className="text-zinc-600" />
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">View Only</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, highlight, theme, sub }) {
  const base = highlight
    ? "bg-yellow-500 border-yellow-500 text-black"
    : theme === "dark"
      ? "bg-zinc-900 border-white/5 text-white"
      : "bg-white border-black/5 text-zinc-900 shadow-sm";
  return (
    <div className={`p-5 rounded-2xl border transition-all hover:scale-[1.02] duration-200 ${base}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${highlight ? "bg-black/10" : theme === "dark" ? "bg-white/5" : "bg-zinc-50"}`}>
          {icon}
        </div>
        <span className={`text-[9px] font-black uppercase tracking-widest ${highlight ? "text-black/50" : "text-zinc-500"}`}>
          {highlight ? "Total" : "Collected"}
        </span>
      </div>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${highlight ? "text-black/60" : "text-zinc-500"}`}>{label}</p>
      <h3 className={`text-2xl font-black leading-tight tracking-tight ${highlight ? "text-black" : ""}`}>
        UGX {(Number(value) || 0).toLocaleString()}
      </h3>
      {sub && <p className={`text-[9px] font-bold mt-1 ${highlight ? "text-black/50" : "text-zinc-500"}`}>{sub}</p>}
    </div>
  );
}

// ─── NOT PERMITTED SCREEN ─────────────────────────────────────────────────────
function NotPermittedScreen({ theme, name }) {
  return (
    <div className={`min-h-screen flex items-center justify-center px-6 font-[Outfit] ${theme === "dark" ? "bg-black" : "bg-zinc-50"}`}>
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6">
          <ShieldAlert size={36} className="text-rose-500" />
        </div>
        <h2 className={`text-2xl font-black uppercase tracking-tight mb-2 ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
          Access Restricted
        </h2>
        <p className={`text-sm font-bold mb-1 ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}>
          Hey {name}, you don't have ordering permission yet.
        </p>
        <p className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest">
          Contact your Director to get permitted.
        </p>
        <div className="mt-8 px-5 py-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 inline-flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Awaiting Permission</span>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function ManagerOrderHistory() {
  const { orders = [], currentUser, refreshData } = useData() || {};
  const { theme } = useTheme();

  const savedUser        = useMemo(() => JSON.parse(localStorage.getItem("kurax_user") || "{}"), []);
  const currentStaffId   = currentUser?.id   || savedUser?.id;
  const currentStaffName = currentUser?.name || savedUser?.name || "Manager";
  const isPermitted      = currentUser?.is_permitted ?? savedUser?.is_permitted ?? false;

  const [activeTab,   setActiveTab]   = useState("Live");
  const [viewMode,    setViewMode]    = useState("mine");
  const [searchQuery, setSearchQuery] = useState("");
  const [payOrder,    setPayOrder]    = useState(null);
  const [voidItem,    setVoidItem]    = useState(null);

  const DAILY_GOAL = 20;

  const getLocalDate = (ts) => {
    if (!ts) return null;
    const d = new Date(ts);
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
  };

  const today = useMemo(() => getLocalDate(new Date()), []);

  const todayOrders = useMemo(() =>
    (orders || []).filter(o => getLocalDate(o.timestamp || o.created_at) === today),
  [orders, today]);

  const myOrders = useMemo(() =>
    todayOrders.filter(o => {
      const oId   = o.staff_id   || o.staffId;
      const oName = o.staff_name || o.waiterName;
      return oId === currentStaffId || oName === currentStaffName;
    }),
  [todayOrders, currentStaffId, currentStaffName]);

  const displayOrders = viewMode === "mine" ? myOrders : todayOrders;

  // Totals — manager's OWN paid orders only
  const totals = useMemo(() =>
    myOrders.reduce((acc, o) => {
      const isPaid = o.status === "Paid" || o.isPaid;
      if (isPaid) {
        const raw = (o.payment_method || o.paymentMethod || "Cash").toLowerCase();
        let m = "Cash";
        if (raw.includes("mtn"))         m = "Momo-MTN";
        else if (raw.includes("airtel")) m = "Momo-Airtel";
        else if (raw.includes("momo"))   m = "Momo-MTN";
        else if (raw.includes("card"))   m = "Card";
        acc[m]  = (acc[m] || 0) + Number(o.total);
        acc.all += Number(o.total);
      }
      return acc;
    }, { Cash: 0, Card: 0, "Momo-MTN": 0, "Momo-Airtel": 0, all: 0 }),
  [myOrders]);

  const groupedTableOrders = useMemo(() => {
    return displayOrders.reduce((acc, order) => {
      const key = (order.table_name || order.tableName || "WALK-IN").trim().toUpperCase();
      const isOwn = (order.staff_id || order.staffId) === currentStaffId ||
                    (order.staff_name || order.waiterName) === currentStaffName;
      if (!acc[key]) {
        acc[key] = {
          tableName:  key,
          displayId:  order.id ? String(order.id).slice(-6) : "000000",
          total:      Number(order.total) || 0,
          items:      [...(order.items || [])],
          status:     order.status || "Pending",
          isPaid:     order.status === "Paid" || order.isPaid,
          timestamp:  order.timestamp || order.created_at,
          orderIds:   [order.id],
          rawOrderId: order.id,
          waiterName: order.staff_name || order.waiterName,
          isOwnOrder: isOwn,
        };
      } else {
        acc[key].total += Number(order.total) || 0;
        acc[key].items.push(...(order.items || []));
        acc[key].orderIds.push(order.id);
        if (order.status !== "Ready" && acc[key].status === "Ready") acc[key].status = order.status;
        // If ANY order on this table belongs to manager, treat as own
        if (isOwn) acc[key].isOwnOrder = true;
      }
      return acc;
    }, {});
  }, [displayOrders, currentStaffId, currentStaffName]);

  const filteredOrders = useMemo(() => {
    return Object.values(groupedTableOrders).filter(g => {
      const matchSearch = g.tableName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTab    = activeTab === "Live"
        ? ["Pending","Preparing","Ready","Delayed"].includes(g.status)
        : ["Served","Paid","Closed"].includes(g.status);
      return matchSearch && matchTab;
    }).sort((a, b) => {
      // Delayed first, then Ready, then by time
      const score = (o) => {
        const mins = Math.floor((Date.now() - new Date(o.timestamp)) / 60000);
        if (mins >= 30 && !o.isPaid && !["Served","Paid","Closed"].includes(o.status)) return 0;
        if (o.status === "Ready") return 1;
        return 2;
      };
      const sd = score(a) - score(b);
      if (sd !== 0) return sd;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  }, [groupedTableOrders, searchQuery, activeTab]);

  const readyCount   = useMemo(() => Object.values(groupedTableOrders).filter(o => o.status === "Ready").length, [groupedTableOrders]);
  const delayedCount = useMemo(() => Object.values(groupedTableOrders).filter(o => {
    const mins = Math.floor((Date.now() - new Date(o.timestamp)) / 60000);
    return mins >= 30 && !o.isPaid && ["Pending","Preparing","Ready"].includes(o.status);
  }).length, [groupedTableOrders]);
  const liveCount    = useMemo(() => Object.values(groupedTableOrders).filter(o => ["Pending","Preparing","Ready","Delayed"].includes(o.status)).length, [groupedTableOrders]);
  const servedCount  = useMemo(() => Object.values(groupedTableOrders).filter(o => ["Served","Paid","Closed"].includes(o.status)).length, [groupedTableOrders]);

  const progressPercent = Math.min((myOrders.length / DAILY_GOAL) * 100, 100);
  const paidCount       = myOrders.filter(o => o.status === "Paid" || o.isPaid).length;
  const firstName       = currentStaffName.split(" ")[0];

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

  const handleConfirmPay = useCallback(async (order, method, momoNetwork) => {
    try {
      await Promise.all(order.orderIds.map(id =>
        fetch(`${API_URL}/api/orders/${id}/pay`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Paid", payment_method: momoNetwork ? `Momo-${momoNetwork}` : method }),
        })
      ));
      refreshData?.();
    } catch (err) { console.error("Payment failed:", err); }
  }, [refreshData]);

  const handleVoidItem = useCallback(async (item, reason) => {
    try {
      await fetch(`${API_URL}/api/orders/void-item`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id:     voidItem?.order?.rawOrderId,
          item_name:    item.name, reason,
          requested_by: currentStaffName,
        }),
      });
      refreshData?.();
    } catch (err) { console.error("Void failed:", err); }
  }, [voidItem, currentStaffName, refreshData]);

  if (!isPermitted) return <NotPermittedScreen theme={theme} name={firstName} />;

  return (
    <div className={`min-h-screen font-[Outfit] pb-28 md:pb-8 transition-colors duration-300 ${theme === "dark" ? "bg-black text-white" : "bg-zinc-50 text-zinc-900"}`}>

      {/* HEADER */}
      <div className={`sticky top-0 z-10 w-full border-b px-4 md:px-8 py-4 flex items-center justify-between gap-4
        ${theme === "dark" ? "bg-zinc-950/95 backdrop-blur-xl border-white/5" : "bg-white/95 backdrop-blur-xl border-black/5 shadow-sm"}`}>

        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-yellow-500 flex items-center justify-center font-black text-black text-base shrink-0">
            {firstName[0]}
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              <p className="text-[8px] font-black uppercase tracking-[0.25em] text-zinc-500">Manager · Active</p>
            </div>
            <h1 className="text-base font-black uppercase tracking-tighter leading-none">
              {firstName}'s <span className="text-yellow-500">Dashboard</span>
            </h1>
          </div>
        </div>

        {/* Desktop stats */}
        <div className="hidden lg:flex items-center gap-5 flex-1 justify-center flex-wrap">
          {[
            { label: "My Orders",  value: myOrders.length,                                suffix: `/${DAILY_GOAL}` },
            { label: "Gross",      value: `UGX ${totals.all.toLocaleString()}`,            color: "text-yellow-500" },
            { label: "Cash",       value: `UGX ${totals.Cash.toLocaleString()}`,           color: "text-emerald-500" },
            { label: "Card",       value: `UGX ${totals.Card.toLocaleString()}`,           color: "text-blue-400" },
            { label: "MTN",        value: `UGX ${totals["Momo-MTN"].toLocaleString()}`,    color: "text-yellow-400" },
            { label: "Airtel",     value: `UGX ${totals["Momo-Airtel"].toLocaleString()}`, color: "text-red-400" },
          ].map(({ label, value, suffix, color }, i, arr) => (
            <React.Fragment key={label}>
              <div className="text-center">
                <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{label}</p>
                <p className={`text-lg font-black leading-tight ${color || ""}`}>
                  {value}{suffix && <span className="text-xs text-zinc-500">{suffix}</span>}
                </p>
              </div>
              {i < arr.length - 1 && <div className={`w-px h-7 shrink-0 ${theme === "dark" ? "bg-white/10" : "bg-black/10"}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Alert pills */}
        <div className="flex items-center gap-2 shrink-0">
          {delayedCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500 rounded-xl animate-pulse">
              <Clock size={13} className="text-white" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">{delayedCount} Delayed</span>
            </div>
          )}
          {readyCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500 rounded-xl animate-pulse">
              <Bell size={13} className="text-black" />
              <span className="text-[10px] font-black text-black uppercase tracking-widest">{readyCount} Ready</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 md:px-8 pt-6">

        {/* Progress bar */}
        <div className={`p-4 rounded-2xl border mb-4 ${theme === "dark" ? "bg-zinc-900 border-white/5" : "bg-white border-black/5 shadow-sm"}`}>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-orange-400" />
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">My Daily Target</p>
            </div>
            <span className="text-[11px] font-black text-orange-400">{myOrders.length} / {DAILY_GOAL} · {Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-1000 rounded-full" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {/* Stat cards — own collections only */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:hidden gap-3 mb-6">
          <StatCard theme={theme} label="Cash"     value={totals.Cash}           icon={<Banknote size={18} className="text-emerald-500" />}  sub="My collections" />
          <StatCard theme={theme} label="Card"     value={totals.Card}           icon={<CreditCard size={18} className="text-blue-500" />}    sub="My collections" />
          <StatCard theme={theme} label="MTN Momo" value={totals["Momo-MTN"]}    icon={<Smartphone size={18} className="text-yellow-400" />}  sub="My collections" />
          <StatCard theme={theme} label="Airtel"   value={totals["Momo-Airtel"]} icon={<Smartphone size={18} className="text-red-400" />}     sub="My collections" />
          <StatCard theme={theme} label="Gross"    value={totals.all} highlight  icon={<TrendingUp size={18} className="text-black/60" />}    sub={`${paidCount} paid`} />
          <div className={`p-5 rounded-2xl border ${theme === "dark" ? "bg-zinc-900 border-white/5" : "bg-white border-black/5 shadow-sm"}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${theme === "dark" ? "bg-white/5" : "bg-zinc-50"}`}>
                <Users size={18} className="text-purple-400" />
              </div>
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Today</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">My Orders</p>
            <h3 className="text-2xl font-black">{myOrders.length}<span className="text-sm text-zinc-500 ml-1">/{DAILY_GOAL}</span></h3>
          </div>
        </div>

        {/* View toggle + filters */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className={`flex gap-1 p-1 rounded-2xl shrink-0 ${theme === "dark" ? "bg-zinc-900" : "bg-zinc-100"}`}>
            <button onClick={() => setViewMode("mine")}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                ${viewMode === "mine" ? "bg-yellow-500 text-black shadow" : theme === "dark" ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}>
              My Orders
            </button>
            <button onClick={() => setViewMode("all")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                ${viewMode === "all" ? "bg-yellow-500 text-black shadow" : theme === "dark" ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}>
              <Eye size={12} /> All Floor
              {delayedCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-black inline-flex items-center justify-center">
                  {delayedCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`flex gap-1 p-1 rounded-2xl shrink-0 ${theme === "dark" ? "bg-zinc-900" : "bg-zinc-100"}`}>
              {[{ key: "Live", count: liveCount }, { key: "Served", count: servedCount }].map(({ key, count }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5
                    ${activeTab === key ? "bg-yellow-500 text-black shadow" : theme === "dark" ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500"}`}>
                  {key}
                  {count > 0 && (
                    <span className={`w-4 h-4 rounded-full text-[8px] font-black inline-flex items-center justify-center
                      ${activeTab === key ? "bg-black/20 text-black" : "bg-zinc-800 text-zinc-400"}`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={13} />
              <input type="text" placeholder="Filter table..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full py-2.5 pl-8 pr-3 rounded-2xl text-xs font-bold outline-none border transition-all
                  ${theme === "dark" ? "bg-zinc-900 border-white/5 focus:border-yellow-500/50 text-white" : "bg-white border-black/5 focus:border-yellow-500 text-zinc-900"}`} />
            </div>
          </div>
        </div>

        {/* Orders grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOrders.length === 0 ? (
            <div className="col-span-full py-32 text-center opacity-20">
              <ClipboardList size={52} className="mx-auto mb-3" />
              <p className="text-xs font-black uppercase tracking-[0.3em]">No {activeTab.toLowerCase()} orders</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <OrderCard
                key={order.tableName}
                order={order}
                theme={theme}
                isOwnOrder={order.isOwnOrder}   // ← controls payment/void buttons
                onMarkServed={handleMarkServed}
                onOpenPay={setPayOrder}
                onVoidItem={(item, ord) => setVoidItem({ item, order: ord })}
              />
            ))
          )}
        </div>
      </div>

      {payOrder && <PayModal order={payOrder} onClose={() => setPayOrder(null)} onConfirmPay={handleConfirmPay} />}
      {voidItem && (
        <VoidModal item={voidItem.item} tableName={voidItem.order.tableName}
          onClose={() => setVoidItem(null)} onConfirmVoid={handleVoidItem} />
      )}
    </div>
  );
}