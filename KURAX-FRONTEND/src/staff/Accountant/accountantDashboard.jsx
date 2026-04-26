import React, { useState, useEffect, useCallback } from "react";
import {
  Banknote, Smartphone, CreditCard, Receipt, Clock,
  Menu, Calculator, Wallet, CheckCircle2,
  RotateCcw, BookOpen, User, Phone, Calendar,
  RefreshCw, TrendingUp, Save, AlertTriangle,
  BarChart3, ChefHat, Coffee, Wine, ChevronDown, ChevronUp,
  ClipboardList, Hourglass, XCircle, Sun, Moon, LayoutGrid,
  TrendingDown, PieChart, DollarSign, Activity, Sparkles,
  Zap, Shield, Gem, ArrowUpRight, CircleDollarSign, Loader2, XCircle as XCircleIcon
} from "lucide-react";
import { useData } from "../../customer/components/context/DataContext";
import SideBar from "./SideBar";
import MonthlyCosts from "./MonthlyCosts";
import Footer from "../../customer/components/common/Foooter";
import API_URL from "../../config/api";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
}

function kampalaDate(d = new Date()) {
  return new Date(d.toLocaleString("en-US", { timeZone: "Africa/Nairobi" }))
    .toISOString().split("T")[0];
}

function fmt(n) { return Number(n || 0).toLocaleString(); }

function formatCurrencyCompact(n) {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `UGX ${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `UGX ${(num / 1_000).toFixed(0)}K`;
  return `UGX ${num.toLocaleString()}`;
}

function getCreditStatus(credit) {
  const status = credit.status;
  if (status === "FullySettled") return "settled";
  if (status === "PartiallySettled") return "settled";
  if (status === "Approved") return "approved";
  if (status === "PendingManager") return "pendingManager";
  if (status === "PendingCashier") return "pendingCashier";
  if (status === "Rejected") return "rejected";
  if (credit.paid === true || credit.paid === "t" || credit.paid === "true") return "settled";
  return "outstanding";
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, gradient, note, trend, isCompact = true }) {
  const formattedValue = isCompact ? formatCurrencyCompact(value) : `UGX ${fmt(value)}`;
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

// ─── GROSS REVENUE CARD ───────────────────────────────────────────────────────
function GrossRevenueCard({ grossSales, settledCredits }) {
  const combinedTotal = grossSales + settledCredits;
  const hasSettledCredits = settledCredits > 0;

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
              Live Today
            </span>
          </div>
        </div>
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1 h-3 bg-black/30 rounded-full" />
            <p className="text-[8px] font-black uppercase text-black/60 tracking-[0.2em]">Gross Revenue</p>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-black italic tracking-tighter leading-tight">
            {formatCurrencyCompact(grossSales)}
          </h3>
          <p className="text-[7px] font-bold text-black/40 uppercase tracking-wider mt-1">
            Cash + Card + Mobile Money
          </p>
        </div>
        {hasSettledCredits && (
          <div className="mt-2 pt-2 border-t border-black/20 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 animate-pulse" />
                <p className="text-[7px] font-black uppercase text-black/60 tracking-wider">Credits Settled Today</p>
              </div>
              <div className="flex items-center gap-1">
                <ArrowUpRight size={10} className="text-emerald-800" />
                <p className="text-[10px] font-black text-emerald-900 italic">+ {formatCurrencyCompact(settledCredits)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 bg-black/20 backdrop-blur-sm rounded-xl px-3 py-2 group-hover:bg-black/30 transition-all">
              <div className="flex items-center gap-1.5">
                <Zap size={10} className="text-black/60" />
                <p className="text-[7px] font-black uppercase text-black/70 tracking-wider">Combined Total</p>
              </div>
              <p className="text-[11px] font-black text-black italic tracking-tighter">
                {formatCurrencyCompact(combinedTotal)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PhysInput({ label, value, onChange, color }) {
  return (
    <div className="group">
      <p className={`text-[9px] font-black uppercase tracking-widest mb-2 transition-colors duration-200 ${color}`}>{label}</p>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-white font-black text-lg outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 transition-all duration-200 text-right hover:border-white/20"
      />
    </div>
  );
}

function VarianceRow({ label, system, physical, variance }) {
  const variancePercent = system > 0 ? (variance / system) * 100 : 0;
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 hover:bg-white/5 transition-colors duration-200 px-2 rounded-lg">
      <div>
        <p className="text-[9px] font-black uppercase text-zinc-500">{label}</p>
        <p className="text-[10px] text-zinc-600">Sys: {fmt(system)} · Phys: {fmt(physical)}</p>
      </div>
      <div className="text-right">
        <span className={`text-sm font-black italic ${variance === 0 ? "text-zinc-500" : variance > 0 ? "text-blue-400" : "text-rose-500"}`}>
          {variance >= 0 ? "+" : ""}{fmt(variance)}
        </span>
        <p className={`text-[8px] font-bold ${variance === 0 ? "text-zinc-600" : variance > 0 ? "text-blue-400/60" : "text-rose-500/60"}`}>
          ({variancePercent > 0 ? "+" : ""}{variancePercent.toFixed(1)}%)
        </p>
      </div>
    </div>
  );
}

// ─── CREDIT ROW ───────────────────────────────────────────────────────────────
function AccountantCreditRow({ credit }) {
  const status = getCreditStatus(credit);
  const statusConfig = {
    pendingCashier: { label: "Wait for Cashier", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", icon: <Hourglass size={12}/> },
    pendingManager: { label: "Wait for Manager", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", icon: <Clock size={12}/> },
    approved:       { label: "Approved",         color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", icon: <CheckCircle2 size={12}/> },
    settled:        { label: "Settled",          color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 size={12}/> },
    rejected:       { label: "Rejected",         color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",       icon: <XCircle size={12}/> },
    outstanding:    { label: "Outstanding",      color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", icon: <BookOpen size={12}/> },
  };
  const config = statusConfig[status] || statusConfig.outstanding;
  const isSettled = status === "settled";
  const isRejected = status === "rejected";
  const isPartiallySettled = credit.status === "PartiallySettled";
  const remainingBalance = isPartiallySettled ? (Number(credit.amount || 0) - Number(credit.amount_paid || 0)) : 0;

  return (
    <div className={`rounded-2xl border p-5 flex items-start justify-between gap-3 flex-wrap transition-all duration-300 hover:shadow-lg hover:scale-[1.01] ${config.bg}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="font-black text-white uppercase italic tracking-tighter text-lg">{credit.table_name || "Table"}</span>
          <span className={`px-2 py-0.5 rounded-full border ${config.bg} ${config.color} text-[9px] font-black uppercase flex items-center gap-1`}>
            {config.icon} {config.label}
          </span>
          {isPartiallySettled && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[8px] font-black uppercase">
              Partial Payment
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap text-[10px] mb-1">
          {credit.client_name && (
            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
              <User size={10} className="text-zinc-500"/>
              <span className="text-zinc-300 font-bold">{credit.client_name}</span>
            </div>
          )}
          {credit.client_phone && (
            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
              <Phone size={10} className="text-zinc-500"/>
              <span className="text-zinc-400">{credit.client_phone}</span>
            </div>
          )}
          {!isSettled && !isRejected && credit.pay_by && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
              <Calendar size={10} className="text-amber-400"/>
              <span className="text-amber-400 font-black">Pay by: {credit.pay_by}</span>
            </div>
          )}
          {isRejected && credit.reject_reason && (
            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg">
              <AlertTriangle size={10} className="text-red-400"/>
              <span className="text-red-400 font-black text-[9px]">Reason: {credit.reject_reason}</span>
            </div>
          )}
        </div>
        {(isSettled || isPartiallySettled) && credit.settle_method && (
          <p className="text-[9px] text-zinc-600 mt-1 font-mono">
            {isPartiallySettled ? "Partially settled" : "Settled"} via {credit.settle_method}
            {credit.settle_txn ? ` · TXN: ${credit.settle_txn}` : ""}
            {credit.paid_at    ? ` · ${toLocalDateStr(new Date(credit.paid_at))}` : ""}
          </p>
        )}
        <p className="text-[9px] text-zinc-700 mt-1">
          {credit.approved_by ? `Approved by ${credit.approved_by} · ` : ""}
          {toLocalDateStr(new Date(credit.created_at))}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-2xl font-black italic ${config.color}`}>UGX {fmt(credit.amount)}</p>
        {isPartiallySettled && (
          <>
            <p className="text-[9px] text-emerald-400 font-bold mt-0.5">Paid: UGX {fmt(credit.amount_paid)}</p>
            <p className="text-[9px] text-yellow-400 font-bold">Remaining: UGX {fmt(remainingBalance)}</p>
          </>
        )}
        {isSettled && credit.amount_paid && Number(credit.amount_paid) !== Number(credit.amount) && (
          <p className="text-[9px] text-emerald-400 font-bold mt-0.5">Paid: UGX {fmt(credit.amount_paid)}</p>
        )}
      </div>
    </div>
  );
}

// ─── STATION CARD ─────────────────────────────────────────────────────────────
function StationCard({ icon, label, color, borderColor, summary, loading, tickets }) {
  const [expanded, setExpanded] = useState(false);
  const t = summary?.totals || {};

  return (
    <div className={`bg-gradient-to-br from-zinc-900/40 to-zinc-900/20 border ${borderColor} rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.01]`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color.bg} transition-transform duration-300`}>
              <span className={color.text}>{icon}</span>
            </div>
            <div>
              <h3 className="font-black uppercase italic tracking-tighter text-white text-xl leading-none">{label}</h3>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{summary?.date || kampalaDate()}</p>
            </div>
          </div>
          {loading && <RefreshCw size={14} className="text-zinc-600 animate-spin"/>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-black/40 rounded-xl p-4 text-center">
            <p className="text-[8px] font-black uppercase text-zinc-600 mb-1">Tickets</p>
            <p className={`text-3xl font-black italic ${color.text}`}>{t.ticket_count || 0}</p>
          </div>
          <div className="bg-black/40 rounded-xl p-4 text-center">
            <p className="text-[8px] font-black uppercase text-zinc-600 mb-1">Items</p>
            <p className={`text-3xl font-black italic ${color.text}`}>{t.total_items || 0}</p>
          </div>
          <div className="bg-black/40 rounded-xl p-4 col-span-2">
            <p className="text-[8px] font-black uppercase text-zinc-600 mb-2">Status Breakdown</p>
            <div className="flex items-center justify-center gap-6 text-[10px] font-black uppercase">
              <div className="text-center">
                <div className="w-2 h-2 rounded-full bg-zinc-400 mx-auto mb-1" />
                <span className="text-zinc-400">{t.pending_count || 0} Pending</span>
              </div>
              <div className="text-center">
                <div className="w-2 h-2 rounded-full bg-orange-400 mx-auto mb-1 animate-pulse" />
                <span className="text-orange-400">{t.preparing_count || 0} Active</span>
              </div>
              <div className="text-center">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mx-auto mb-1" />
                <span className="text-emerald-400">{t.completed_count || 0} Done</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(summary?.chefs || summary?.baristas || summary?.barmen || []).length > 0 && (
        <div className="px-6 pb-4">
          <p className="text-[8px] font-black uppercase text-zinc-600 tracking-widest mb-2">Staff Breakdown</p>
          <div className="space-y-1.5">
            {(summary?.chefs || summary?.baristas || summary?.barmen || []).map(s => {
              const name  = s.chef || s.barista || s.barman;
              const count = s.items_handled || s.drinks_made;
              return (
                <div key={name} className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-xl hover:bg-black/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full ${color.bg} ${color.text} flex items-center justify-center text-[9px] font-black`}>
                      {name?.[0]}
                    </div>
                    <span className="text-[10px] font-black text-white uppercase">{name}</span>
                  </div>
                  <span className={`text-[10px] font-black ${color.text}`}>
                    {count} item{Number(count) !== 1 ? "s" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tickets && tickets.length > 0 && (
        <div className="px-6 pb-6">
          <button onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-[9px] font-black uppercase text-zinc-500 hover:text-white transition-colors mt-1 group">
            {expanded
              ? <ChevronUp size={11} className="group-hover:-translate-y-0.5 transition-transform"/>
              : <ChevronDown size={11} className="group-hover:translate-y-0.5 transition-transform"/>}
            {expanded ? "Hide" : "Show"} {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
          </button>
          {expanded && (
            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
              {tickets.map(tk => (
                <div key={tk.id} className="bg-black/40 rounded-xl p-3 flex items-center justify-between gap-2 hover:bg-black/60 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black text-white uppercase">T-{tk.table_name}</span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase
                        ${["Ready","Served","Paid"].includes(tk.status)
                          ? "bg-emerald-500/10 text-emerald-400"
                          : tk.status === "Preparing"
                          ? "bg-orange-500/10 text-orange-400"
                          : "bg-zinc-700/50 text-zinc-400"}`}>
                        {tk.status}
                      </span>
                    </div>
                    <p className="text-[9px] text-zinc-600 mt-0.5">
                      {tk.staff_name} · {new Date(tk.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                    </p>
                  </div>
                  <span className={`text-sm font-black italic ${color.text}`}>
                    {Array.isArray(tk.items) ? tk.items.length : 0} item{(Array.isArray(tk.items)?tk.items.length:0) !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
me

// ─── START NEW DAY MODAL ──────────────────────────────────────────────────────
function StartNewDayModal({ isOpen, onClose, onStart, starting }) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  
  if (!isOpen) return null;
  
  const today = new Date().toISOString().split('T')[0];
  const minDate = today;
  
  return (
    <div className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <Sparkles size={20} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Start New Day</h3>
              <p className="text-[9px] text-zinc-500 mt-0.5">Initialize a brand new business day</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-all">
            <XCircleIcon size={18} className="text-zinc-400" />
          </button>
        </div>
        
        <div className="mb-4">
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">
            Select Date for New Day
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={minDate}
            className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-emerald-500/50 transition-all"
          />
          <p className="text-[8px] text-zinc-600 mt-2">
            {selectedDate === today 
              ? "⚠️ Starting today will reset current day's data" 
              : "✅ This will create a fresh day with zero totals"}
          </p>
        </div>
        
        <div className="mb-6">
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., New financial period, System reset, etc."
            className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-emerald-500/50 resize-none h-20"
          />
        </div>
        
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 mb-6">
          <p className="text-[8px] font-black text-yellow-400 uppercase tracking-widest text-center">
            ⚠️ This will create a brand new day with ALL totals set to ZERO
          </p>
          <p className="text-[7px] text-zinc-500 text-center mt-2">
            Previous days will remain archived in the system
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl border border-white/10 text-zinc-400 font-black text-[10px] uppercase hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onStart(selectedDate, notes)}
            disabled={starting}
            className={`flex-[2] py-4 rounded-2xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2
              ${starting
                ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                : "bg-emerald-500 text-white hover:bg-emerald-400 active:scale-[0.98]"
              }`}
          >
            {starting ? (
              <><Loader2 size={14} className="animate-spin" /> Starting...</>
            ) : (
              <><Sparkles size={14} /> Start New Day</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FORCE HARD REFRESH FUNCTION ──────────────────────────────────────────────
const forceHardRefresh = () => {
  console.log("Performing hard refresh to clear all totals...");
  
  const userData = localStorage.getItem("kurax_user");
  localStorage.clear();
  if (userData) localStorage.setItem("kurax_user", userData);
  
  sessionStorage.clear();
  
  document.cookie.split(";").forEach(function(c) {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
  
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
  
  window.location.href = window.location.pathname + '?refresh=' + Date.now();
};

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function AccountantDashboard() {
  const { todaySummary, orders = [], refreshData } = useData() || {};
  const [isDark, setIsDark] = useState(true);
  const [activeSection,  setActiveSection]  = useState("FINANCIAL_HISTORY");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [error, setError] = useState(null);
  const [dayClosed, setDayClosed] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // ── Reopen Day State ────────────────────────────────────────────────────────
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [closedDaysList, setClosedDaysList] = useState([]);
  const [selectedReopenDate, setSelectedReopenDate] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [reopeningDay, setReopeningDay] = useState(false);
  const [loadingClosedDays, setLoadingClosedDays] = useState(false);

  // ── Start New Day State ─────────────────────────────────────────────────────
  const [showStartNewDayModal, setShowStartNewDayModal] = useState(false);
  const [startingNewDay, setStartingNewDay] = useState(false);

  // ── Live summary ──────────────────────────────────────────────────────────
  const [liveSummary, setLiveSummary] = useState(null);

  const fetchLiveSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/accountant/today?t=${Date.now()}`);
      if (res.ok) setLiveSummary(await res.json());
    } catch (e) { console.error("live summary:", e); }
  }, []);

  useEffect(() => {
    fetchLiveSummary();
    const id = setInterval(fetchLiveSummary, 15000);
    return () => clearInterval(id);
  }, [fetchLiveSummary]);

  // ── Physical count ────────────────────────────────────────────────────────
  const [physCash,       setPhysCash]       = useState(0);
  const [physMomoMTN,    setPhysMomoMTN]    = useState(0);
  const [physMomoAirtel, setPhysMomoAirtel] = useState(0);
  const [physCard,       setPhysCard]       = useState(0);
  const [physNotes,      setPhysNotes]      = useState("");
  const [physSaving,     setPhysSaving]     = useState(false);
  const [physSaved,      setPhysSaved]      = useState(false);
  const [physLoading,    setPhysLoading]    = useState(false);
  const [hasPhysicalCount, setHasPhysicalCount] = useState(false);

  // ── Today's petty cash ─────────────────────────────────────────────────────
  const [pettyCashToday, setPettyCashToday] = useState({ total_in: 0, total_out: 0 });

  const fetchPettyCashToday = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/accountant/petty-cash?date=${kampalaDate()}`);
      if (res.ok) setPettyCashToday(await res.json());
    } catch (e) { console.error("petty cash today:", e); }
  }, []);

  useEffect(() => {
    fetchPettyCashToday();
    const id = setInterval(fetchPettyCashToday, 30000);
    return () => clearInterval(id);
  }, [fetchPettyCashToday]);

  // ── Credits ───────────────────────────────────────────────────────────────
  const [creditsLedger,  setCreditsLedger]  = useState([]);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditFilter,   setCreditFilter]   = useState("all");

  // ── Void requests ─────────────────────────────────────────────────────────
  const [voidRequests,        setVoidRequests]        = useState([]);
  const [voidRequestsLoading, setVoidRequestsLoading] = useState(false);
  const [voidHistory,         setVoidHistory]         = useState([]);
  const [voidHistoryLoading,  setVoidHistoryLoading]  = useState(false);

  // ── Station sales ─────────────────────────────────────────────────────────
  const [kitchenSummary, setKitchenSummary] = useState(null);
  const [baristaSummary, setBaristaSummary] = useState(null);
  const [barmanSummary,  setBarmanSummary]  = useState(null);
  const [salesLoading,   setSalesLoading]   = useState(false);
  const [salesDate,      setSalesDate]      = useState(kampalaDate());

  // ── Monthly profit / expenses ─────────────────────────────────────────────
  const [profitData,    setProfitData]    = useState(null);
  const [profitLoad,    setProfitLoad]    = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));

  // ── Day closure state ─────────────────────────────────────────────────────
  const [isFinalizing, setIsFinalizing] = useState(false);

  // ─── Fetch closed days for reopen modal ────────────────────────────────────
  const fetchClosedDays = useCallback(async () => {
    setLoadingClosedDays(true);
    try {
      const res = await fetch(`${API_URL}/api/day-closure/closed-days?limit=30`);
      if (res.ok) {
        const data = await res.json();
        setClosedDaysList(data.closed_days || []);
      }
    } catch (e) {
      console.error("Fetch closed days error:", e);
    } finally {
      setLoadingClosedDays(false);
    }
  }, []);

  // ─── Handle Reopen Day ──────────────────────────────────────────────────────
  const handleReopenDay = async (date, reason) => {
    if (!date) {
      alert("Please select a date to reopen");
      return;
    }
    
    const confirmed = window.confirm(
      `⚠️ REOPEN DAY - ${date} ⚠️\n\n` +
      `This will:\n` +
      `• Restore all revenue totals for ${date}\n` +
      `• Make all orders from that date visible again\n` +
      `• Reactivate kitchen tickets\n` +
      `• Allow staff to continue working on that day\n\n` +
      `This is useful if the day was closed by mistake or if you need to make corrections.\n\n` +
      `Are you sure you want to reopen ${date}?`
    );
    
    if (!confirmed) return;
    
    setReopeningDay(true);
    setError(null);
    
    try {
      const actor = (() => {
        try { return JSON.parse(localStorage.getItem("kurax_user") || "{}").name; }
        catch { return "Accountant"; }
      })();
      
      const res = await fetch(`${API_URL}/api/day-closure/reopen-day`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: date,
          reopened_by: actor,
          reason: reason || "Day reopened for continued operations"
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reopen day");
        return;
      }
      
      alert(`✅ Day ${date} has been reopened successfully!\n\nStaff can now resume work.`);
      
      setShowReopenModal(false);
      setSelectedReopenDate('');
      setReopenReason('');
      setDayClosed(false);
      setDayClosureInfo(null);
      
      await Promise.all([
        fetchLiveSummary(),
        fetchPettyCashToday(),
        loadPhysicalCount(),
        refreshData()
      ]);
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (e) {
      console.error("Reopen day error:", e);
      setError("Network error — could not reopen the day. Please try again.");
    } finally {
      setReopeningDay(false);
    }
  };

  // ─── Handle Start New Day ───────────────────────────────────────────────────
  const handleStartNewDay = async (date, notes) => {
    const confirmed = window.confirm(
      `⚠️ START BRAND NEW DAY - ${date} ⚠️\n\n` +
      `This will:\n` +
      `• Initialize a brand new day with ZERO totals\n` +
      `• Clear all current revenue data for ${date}\n` +
      `• Allow staff to start fresh with zero balances\n\n` +
      `${date === new Date().toISOString().split('T')[0] 
        ? "⚠️ WARNING: You are starting today as a new day. This will reset all current data!\n\n" 
        : ""}` +
      `Are you sure you want to start a new day on ${date}?`
    );
    
    if (!confirmed) return;
    
    setStartingNewDay(true);
    setError(null);
    
    try {
      const actor = (() => {
        try { return JSON.parse(localStorage.getItem("kurax_user") || "{}").name; }
        catch { return "Accountant"; }
      })();
      
      const res = await fetch(`${API_URL}/api/day-closure/start-new-day`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: date,
          started_by: actor,
          notes: notes
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start new day");
        return;
      }
      
      alert(`✅ Brand new day ${date} has been started!\n\nAll totals are set to zero. Staff can now begin working.`);
      
      setShowStartNewDayModal(false);
      setDayClosed(false);
      setDayClosureInfo(null);
      
      await Promise.all([
        fetchLiveSummary(),
        fetchPettyCashToday(),
        loadPhysicalCount(),
        refreshData()
      ]);
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (e) {
      console.error("Start new day error:", e);
      setError("Network error — could not start new day. Please try again.");
    } finally {
      setStartingNewDay(false);
    }
  };

  // ── Check if month has changed (for credit ledger persistence) ─────────────
  useEffect(() => {
    const now = new Date();
    const currentMonthNum = now.getMonth();
    const currentYearNum = now.getFullYear();
    
    if (currentMonthNum !== currentMonth || currentYearNum !== currentYear) {
      console.log(`Month changed from ${currentMonth}/${currentYear} to ${currentMonthNum}/${currentYearNum}`);
      setCurrentMonth(currentMonthNum);
      setCurrentYear(currentYearNum);
      const load = async () => {
        const res = await fetch(`${API_URL}/api/credits`);
        if (res.ok) {
          const rows = await res.json();
          const currentMonthCredits = rows.filter(credit => {
            const creditDate = new Date(credit.created_at);
            return creditDate.getMonth() === currentMonthNum && creditDate.getFullYear() === currentYearNum;
          });
          setCreditsLedger(currentMonthCredits);
        }
      };
      load();
    }
  }, [currentMonth, currentYear]);

  const checkPhysicalCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/accountant/physical-count`);
      if (res.ok) {
        const data = await res.json();
        const hasData = data.cash > 0 || data.momo_mtn > 0 || data.momo_airtel > 0 || data.card > 0;
        setHasPhysicalCount(hasData);
      }
    } catch (e) {
      console.error("Check physical count error:", e);
    }
  }, []);

  useEffect(() => {
    checkPhysicalCount();
    const id = setInterval(checkPhysicalCount, 10000);
    return () => clearInterval(id);
  }, [checkPhysicalCount]);

  const fetchMonthlyData = useCallback(async () => {
    setProfitLoad(true);
    try {
      const res = await fetch(`${API_URL}/api/summaries/monthly-profit?month=${selectedMonth}`);
      if (res.ok) setProfitData(await res.json());
    } catch (e) { console.error("monthly profit:", e); }
    finally { setProfitLoad(false); }
  }, [selectedMonth]);

  useEffect(() => { fetchMonthlyData(); }, [fetchMonthlyData]);

  // ── Void history ──────────────────────────────────────────────────────────
  const loadVoidHistory = useCallback(async () => {
    setVoidHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/void-requests/history`);
      if (res.ok) setVoidHistory(await res.json());
    } catch (e) { console.error("void history:", e); }
    setVoidHistoryLoading(false);
  }, []);

  const loadVoidRequests = useCallback(async () => {
    setVoidRequestsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/void-requests`);
      if (res.ok) setVoidRequests(await res.json());
    } catch (e) { console.error("void requests:", e); }
    setVoidRequestsLoading(false);
    loadVoidHistory();
  }, [loadVoidHistory]);

  useEffect(() => {
    loadVoidRequests();
    loadVoidHistory();
    const id = setInterval(loadVoidRequests, 15000);
    return () => clearInterval(id);
  }, [loadVoidRequests, loadVoidHistory]);

  // ── Physical count load ───────────────────────────────────────────────────
  const loadPhysicalCount = useCallback(async () => {
    setPhysLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/accountant/physical-count`);
      if (res.ok) {
        const d = await res.json();
        setPhysCash(Number(d.cash) || 0);
        setPhysMomoMTN(Number(d.momo_mtn) || 0);
        setPhysMomoAirtel(Number(d.momo_airtel) || 0);
        setPhysCard(Number(d.card) || 0);
        setPhysNotes(d.notes || "");
      }
    } catch (e) { console.error("physical count load:", e); }
    setPhysLoading(false);
  }, []);

  useEffect(() => { loadPhysicalCount(); }, [loadPhysicalCount]);

  const savePhysicalCount = async () => {
    setPhysSaving(true);
    try {
      const u = JSON.parse(localStorage.getItem("kurax_user") || "{}");
      await fetch(`${API_URL}/api/accountant/physical-count`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cash: physCash, momo_mtn: physMomoMTN, momo_airtel: physMomoAirtel,
          card: physCard, notes: physNotes, submitted_by: u?.name || "Accountant",
        }),
      });
      setPhysSaved(true);
      setHasPhysicalCount(true);
      setTimeout(() => setPhysSaved(false), 3000);
    } catch (e) { console.error("save physical count:", e); }
    setPhysSaving(false);
  };

  // ── Credits - Load only current month's credits ───────────────────────────
  useEffect(() => {
    const load = async () => {
      setCreditsLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/credits`);
        if (res.ok) {
          const rows = await res.json();
          const now = new Date();
          const currentMonthNum = now.getMonth();
          const currentYearNum = now.getFullYear();
          
          const currentMonthCredits = rows.filter(credit => {
            const creditDate = new Date(credit.created_at);
            return creditDate.getMonth() === currentMonthNum && creditDate.getFullYear() === currentYearNum;
          });
          setCreditsLedger(currentMonthCredits);
        } else {
          console.error("Failed to fetch credits:", res.status);
        }
      } catch (e) {
        console.error("Credits fetch error:", e);
      }
      setCreditsLoading(false);
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  // ── Station sales ─────────────────────────────────────────────────────────
  const loadSales = useCallback(async (date) => {
    setSalesLoading(true);
    const d = date || salesDate;
    try {
      const [kRes, brRes, bmRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/kitchen/tickets/summary?date=${d}`),
        fetch(`${API_URL}/api/barista/tickets/summary?date=${d}`),
        fetch(`${API_URL}/api/barman/tickets/summary?date=${d}`),
      ]);
      if (kRes.status  === "fulfilled" && kRes.value.ok)  setKitchenSummary(await kRes.value.json());
      else setKitchenSummary(null);
      if (brRes.status === "fulfilled" && brRes.value.ok) setBaristaSummary(await brRes.value.json());
      else setBaristaSummary(null);
      if (bmRes.status === "fulfilled" && bmRes.value.ok) setBarmanSummary(await bmRes.value.json());
      else setBarmanSummary(null);
    } catch (e) { console.error("sales:", e); }
    setSalesLoading(false);
  }, [salesDate]);

  useEffect(() => {
    if (activeSection === "VIEW_SALES") loadSales(salesDate);
  }, [activeSection, salesDate]);

  // ── Derived values ────────────────────────────────────────────────────────
  const src = liveSummary || todaySummary || {};
  const sys = {
    cash:   Number(src.total_cash)   || 0,
    card:   Number(src.total_card)   || 0,
    mtn:    Number(src.total_mtn)    || 0,
    airtel: Number(src.total_airtel) || 0,
    gross:  Number(src.total_gross)  || 0,
    orders: Number(src.order_count)  || 0,
  };

  const totalMobileMoney = sys.mtn + sys.airtel;

  // ── VARIANCE CALCULATION ───────────────────────────────────────────────────
  const pettyCashIn      = Number(pettyCashToday.total_in) || 0;
  const adjustedPhysCash = physCash - pettyCashIn;

  const varCash   = adjustedPhysCash - sys.cash;
  const varMTN    = physMomoMTN      - sys.mtn;
  const varAirtel = physMomoAirtel   - sys.airtel;
  const varCard   = physCard         - sys.card;
  const varTotal  = varCash + varMTN + varAirtel + varCard;

  // ── Credit totals ─────────────────────────────────────────────────────────
  const settled = creditsLedger.filter(c => getCreditStatus(c) === "settled");

  const totalSettledToday = settled
    .filter(c => {
      const settledDate = toLocalDateStr(new Date(c.paid_at || c.created_at));
      return settledDate === kampalaDate();
    })
    .reduce((s, c) => s + Number(c.amount_paid || c.amount || 0), 0);

  const approvedAndPending = creditsLedger.filter(c => {
    const status = getCreditStatus(c);
    return status === "approved" || status === "pendingCashier" || status === "pendingManager";
  });

  const partiallySettled = creditsLedger.filter(c => c.status === "PartiallySettled");

  const totalOutstanding = approvedAndPending.reduce((s, c) => s + Number(c.amount || 0), 0)
    + partiallySettled.reduce((s, c) => s + (Number(c.amount || 0) - Number(c.amount_paid || 0)), 0);

  const totalSettled = settled.reduce((s, c) => s + Number(c.amount_paid || c.amount || 0), 0);

  const totalRejected = creditsLedger
    .filter(c => getCreditStatus(c) === "rejected")
    .reduce((s, c) => s + Number(c.amount || 0), 0);

  const filteredCredits = creditFilter === "outstanding" ? approvedAndPending.concat(partiallySettled)
    : creditFilter === "settled"   ? settled
    : creditFilter === "rejected"  ? creditsLedger.filter(c => getCreditStatus(c) === "rejected")
    : creditsLedger;

  // ── Void handlers ─────────────────────────────────────────────────────────
  const loggedInUser = JSON.parse(localStorage.getItem("kurax_user") || "{}");

  const approveVoid = async (id) => {
    try {
      await fetch(`${API_URL}/api/orders/void-requests/${id}/approve`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_by: loggedInUser?.name || "Accountant" }),
      });
      loadVoidRequests();
    } catch (e) { console.error("void approve:", e); }
  };

  const rejectVoid = async (id) => {
    try {
      await fetch(`${API_URL}/api/orders/void-requests/${id}/reject`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejected_by: loggedInUser?.name || "Accountant" }),
      });
      loadVoidRequests();
    } catch (e) { console.error("void reject:", e); }
  };

  // ── DAY CLOSURE HANDLER WITH HARD REFRESH ───────────────────────────────────
  const handleDayClosure = async () => {
    if (!hasPhysicalCount) {
      alert("⚠️ Please enter the physical count first before closing the day!\n\nGo to PHYSICAL COUNT section and enter all cash, mobile money, and card totals.");
      setActiveSection("PHYSICAL_COUNT");
      return;
    }

    const confirmed = window.confirm(
      "⚠️ CLOSE DAY - THIS ACTION CANNOT BE UNDONE! ⚠️\n\n" +
      "This will:\n" +
      "• Archive all today's orders\n" +
      "• Clear kitchen, barista & bar ticket boards\n" +
      "• Reset all revenue totals to zero\n" +
      "• Reset all physical count entries to zero\n" +
      "• Reset variance analysis to zero\n" +
      "• Expire any pending void requests\n" +
      "• Save a permanent audit record of today's close\n\n" +
      "Credit ledger will persist for the entire month.\n\n" +
      "The page will automatically refresh to show zero totals.\n\n" +
      "Are you absolutely sure you want to close the day?"
    );
    if (!confirmed) return;

    setIsFinalizing(true);
    setError(null);
    
    try {
      const actor = (() => {
        try { return JSON.parse(localStorage.getItem("kurax_user") || "{}").name; }
        catch { return "Accountant"; }
      })();

      const res = await fetch(`${API_URL}/api/day-closure/close-day`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closed_by: actor,
          final_cash: physCash,
          final_card: physCard,
          final_mtn: physMomoMTN,
          final_airtel: physMomoAirtel,
          final_gross: sys.gross,
          notes: `Day closed by ${actor}. Physical count: Cash=${physCash}, Card=${physCard}, MTN=${physMomoMTN}, Airtel=${physMomoAirtel}`
        }),
      });

      const data = await res.json();
      if (!res.ok) { 
        setError(data.error || "Server error — please try again."); 
        setIsFinalizing(false);
        return; 
      }

      alert(`✅ Day closed successfully!\n\nOrders Archived: ${data.cleared_orders}\nTickets Cleared: ${data.cleared_tickets}\n\nThe page will now refresh to show zero totals.`);
      
      setDayClosed(true);
      
      setLiveSummary({ total_cash: 0, total_card: 0, total_mtn: 0, total_airtel: 0, total_gross: 0, order_count: 0 });
      setVoidRequests([]);
      setVoidHistory([]);
      setKitchenSummary(null);
      setBaristaSummary(null);
      setBarmanSummary(null);
      setProfitData(null);
      
      setPhysCash(0);
      setPhysMomoMTN(0);
      setPhysMomoAirtel(0);
      setPhysCard(0);
      setPhysNotes("");
      setHasPhysicalCount(false);
      setPettyCashToday({ total_in: 0, total_out: 0 });
      
      window.dispatchEvent(new CustomEvent('dayClosed', { detail: data }));
      window.dispatchEvent(new Event('refresh'));
      
      setTimeout(() => {
        forceHardRefresh();
      }, 1500);
      
    } catch (e) {
      console.error("Day closure error:", e);
      setError("Network error — could not reach the server. Please try again.");
      setIsFinalizing(false);
    }
  };



  const bgClass      = isDark ? 'bg-[#0a0a0a]'                        : 'bg-gray-50';
  const textClass    = isDark ? 'text-white'                           : 'text-gray-900';
  const cardBgClass  = isDark ? 'bg-zinc-900/30 border-white/5'        : 'bg-white/80 border-gray-200 shadow-sm';

  useEffect(() => {
    const handleDayClosed = () => {
      console.log("Day closed event received - resetting accountant dashboard");
      setDayClosed(true);
      setLiveSummary({ total_cash: 0, total_card: 0, total_mtn: 0, total_airtel: 0, total_gross: 0 });
      setVoidRequests([]);
      setVoidHistory([]);
      setPhysCash(0);
      setPhysMomoMTN(0);
      setPhysMomoAirtel(0);
      setPhysCard(0);
      setHasPhysicalCount(false);
      setPettyCashToday({ total_in: 0, total_out: 0 });
      if (typeof refreshData === "function") refreshData();
      fetchLiveSummary();
      loadPhysicalCount();
      fetchPettyCashToday();
    };

    window.addEventListener('dayClosed', handleDayClosed);
    window.addEventListener('refresh', () => {
      if (typeof refreshData === "function") refreshData();
      fetchLiveSummary();
    });
    
    return () => {
      window.removeEventListener('dayClosed', handleDayClosed);
      window.removeEventListener('refresh', () => refreshData());
    };
  }, [refreshData, fetchLiveSummary, loadPhysicalCount, fetchPettyCashToday]);

  useEffect(() => {
    const checkIfDayClosed = async () => {
      try {
        const res = await fetch(`${API_URL}/api/day-closure/day-status`);
        if (res.ok) {
          const data = await res.json();
          if (data.is_closed) {
            console.log("Day is already closed, resetting display");
            setDayClosed(true);
            setLiveSummary({ total_cash: 0, total_card: 0, total_mtn: 0, total_airtel: 0, total_gross: 0 });
            setPhysCash(0);
            setPhysMomoMTN(0);
            setPhysMomoAirtel(0);
            setPhysCard(0);
            setHasPhysicalCount(false);
          }
        }
      } catch (e) {
        console.error("Check day status error:", e);
      }
    };
    
    checkIfDayClosed();
  }, []);

  return (
    <div className={`flex flex-col lg:flex-row min-h-screen ${bgClass} font-[Outfit] transition-colors duration-300`}>
      <SideBar
        activeSection={activeSection} setActiveSection={setActiveSection}
        isOpen={mobileMenuOpen}       setIsOpen={setMobileMenuOpen}
        isDark={isDark}
      />

      <div className="flex-1 flex flex-col">

        <header className={`flex justify-between items-center px-6 py-4 border-b sticky top-0 z-50 backdrop-blur-md transition-colors duration-300
          ${isDark ? 'bg-black/40 border-white/5' : 'bg-white/80 border-gray-200'}`}>
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 bg-zinc-900 rounded-xl text-yellow-500">
              <Menu size={20}/>
            </button>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-1 h-5 bg-yellow-500 rounded-full"/>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500/80">Accountant</h4>
              </div>
              <h2 className={`text-xl font-black uppercase italic tracking-tighter transition-colors duration-300 ${textClass}`}>
                {activeSection.replace(/_/g," ")}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              
              
            </div>
            
           
            
            {/* Start New Day Button */}
            <button 
              onClick={() => setShowStartNewDayModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider hover:bg-emerald-400 transition-all"
            >
              <Sparkles size={12} /> Start New Day
            </button>
            
            {/* Reopen Day Button - Only show when day is closed */}
            {dayClosed && (
              <button 
                onClick={() => {
                  fetchClosedDays();
                  setShowReopenModal(true);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500 text-white font-black text-[10px] uppercase tracking-wider hover:bg-purple-400 transition-all"
              >
                <RotateCcw size={12} /> Reopen Day
              </button>
            )}
            
            {voidRequests.length > 0 && (
              <button onClick={() => setActiveSection("LIVE_AUDIT")}
                className="flex items-center gap-2 px-3 py-2 bg-rose-500 rounded-xl animate-pulse hover:bg-rose-600 transition-all">
                <AlertTriangle size={13} className="text-white"/>
                <span className="text-[10px] font-black text-white uppercase">{voidRequests.length} Void</span>
              </button>
            )}
          </div>
        </header>

        <main className="p-4 md:p-10 space-y-8 flex-1">

          {dayClosed && (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center animate-in fade-in duration-500">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">
                  ✅ Day Closed - All revenue and physical count totals have been reset. Credits persist for the month.
                </p>
              </div>
            </div>
          )}

          {!hasPhysicalCount && activeSection !== "PHYSICAL_COUNT" && !dayClosed && (
            <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/20 p-4 text-center animate-pulse">
              <div className="flex items-center justify-center gap-2">
                <AlertTriangle size={18} className="text-yellow-500" />
                <p className="text-[10px] font-black text-yellow-600 uppercase tracking-wider">
                  ⚠️ Physical count required before closing the day!
                </p>
                <button 
                  onClick={() => setActiveSection("PHYSICAL_COUNT")}
                  className="ml-2 px-3 py-1 bg-yellow-500 text-black rounded-lg text-[9px] font-black"
                >
                  Go to Physical Count
                </button>
              </div>
            </div>
          )}


          {/* PHYSICAL COUNT - Shows zeros when day is closed */}
          {activeSection === "PHYSICAL_COUNT" && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div>
                <h2 className={`text-2xl font-black uppercase leading-none transition-colors duration-300 ${textClass}`}>Physical Count</h2>
                <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">Enter actual cash/card/momo on hand — saved to database</p>
              </div>

              {dayClosed && (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                  <p className="text-[10px] font-black text-emerald-600">✅ Day is closed - Physical count has been archived and reset to zero</p>
                </div>
              )}

              {pettyCashIn > 0 && !dayClosed && (
                <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
                  <Zap size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-yellow-400 tracking-widest">Petty Cash Replenishment Active</p>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      UGX {fmt(pettyCashIn)} was added to the drawer as replenishment today.
                      This is automatically deducted from your physical cash before calculating the variance,
                      since it is not sales revenue.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`p-8 rounded-2xl transition-all duration-300 ${cardBgClass}`}>
                  <h3 className="text-[10px] font-black uppercase text-yellow-500 tracking-widest flex items-center gap-2 mb-5">
                    <Calculator size={13}/> Physical Cash Entry
                  </h3>
                  {physLoading ? (
                    <div className="h-40 animate-pulse bg-zinc-800/30 rounded-2xl"/>
                  ) : (
                    <>
                      <PhysInput label="Cash on Hand (including replenishment)" value={physCash} onChange={setPhysCash} color="text-emerald-400"/>
                      <PhysInput label="MTN Momo" value={physMomoMTN} onChange={setPhysMomoMTN} color="text-yellow-400"/>
                      <PhysInput label="Airtel Momo" value={physMomoAirtel} onChange={setPhysMomoAirtel} color="text-red-400"/>
                      <PhysInput label="Card / POS" value={physCard} onChange={setPhysCard} color="text-blue-400"/>
                      <div>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Notes (optional)</p>
                        <textarea value={physNotes} onChange={e => setPhysNotes(e.target.value)}
                          placeholder="Any discrepancy notes..."
                          disabled={dayClosed}
                          className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-yellow-500/50 resize-none h-16 transition-all disabled:opacity-50"/>
                      </div>
                      <button onClick={savePhysicalCount} disabled={physSaving || dayClosed}
                        className={`w-full py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all duration-300
                          ${physSaved ? "bg-emerald-500 text-black" : "bg-gradient-to-r from-yellow-500 to-yellow-600 text-black hover:scale-[1.02]"}
                          ${(physSaving || dayClosed) ? "opacity-60 cursor-not-allowed" : ""}`}>
                        {physSaving ? "Saving…" : dayClosed ? <><CheckCircle2 size={14}/> Day Closed</> : physSaved ? <><CheckCircle2 size={14}/> Saved!</> : <><Save size={14}/> Save Count</>}
                      </button>
                    </>
                  )}
                </div>

                <div className={`p-8 rounded-2xl transition-all duration-300 ${cardBgClass}`}>
                  <h3 className="text-[10px] font-black uppercase text-yellow-500 tracking-widest flex items-center gap-2 mb-5">
                    <TrendingUp size={13}/> Variance Analysis
                  </h3>
                  {dayClosed ? (
                    <div className="text-center py-12">
                      <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4" />
                      <p className="text-[11px] font-black text-emerald-600">All variances have been reset to zero</p>
                      <p className="text-[9px] text-zinc-500 mt-2">Day has been closed and archived</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <VarianceRow
                          label={pettyCashIn > 0 ? `Cash (adj. −UGX ${fmt(pettyCashIn)} replenishment)` : "System Cash"}
                          system={sys.cash}
                          physical={adjustedPhysCash}
                          variance={varCash}
                        />
                        <VarianceRow label="System MTN" system={sys.mtn} physical={physMomoMTN} variance={varMTN}/>
                        <VarianceRow label="System Airtel" system={sys.airtel} physical={physMomoAirtel} variance={varAirtel}/>
                        <VarianceRow label="System Card" system={sys.card} physical={physCard} variance={varCard}/>
                      </div>

                      <div className={`mt-4 p-6 rounded-2xl border transition-all duration-300
                        ${varTotal === 0 ? "bg-emerald-500/10 border-emerald-500/20"
                          : varTotal > 0 ? "bg-blue-500/10 border-blue-500/20"
                          : "bg-rose-500/10 border-rose-500/20"}`}>
                        <p className="text-[9px] font-black uppercase text-zinc-500 mb-1">Total Variance</p>
                        <h4 className={`text-2xl font-black italic
                          ${varTotal === 0 ? "text-emerald-500" : varTotal > 0 ? "text-blue-400" : "text-rose-500"}`}>
                          {varTotal >= 0 ? "+" : ""}UGX {fmt(varTotal)}
                        </h4>
                        <p className="text-[9px] text-zinc-600 mt-1 uppercase font-bold">
                          {varTotal === 0 ? "Perfect match" : varTotal > 0 ? "Surplus on counter" : "Shortage detected"}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-white/5 space-y-2">
                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">System Totals (reference)</p>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          {[["Cash","emerald",sys.cash],["MTN","yellow",sys.mtn],["Airtel","red",sys.airtel],["Card","blue",sys.card]].map(([lbl,col,val]) => (
                            <div key={lbl} className="bg-black/40 rounded-xl p-3 hover:bg-black/60 transition-colors">
                              <p className="text-zinc-600 uppercase font-bold mb-0.5">{lbl}</p>
                              <p className={`text-${col}-400 font-black`}>UGX {fmt(val)}</p>
                            </div>
                          ))}
                        </div>
                        {pettyCashIn > 0 && (
                          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                            <p className="text-[8px] font-black uppercase text-yellow-500 tracking-widest">Replenishment netted from cash</p>
                            <p className="text-yellow-400 font-black text-sm mt-0.5">−UGX {fmt(pettyCashIn)}</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* END OF SHIFT - Day Closure */}
          {activeSection === "END_OF_SHIFT" && (
            <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="text-center">
                <h2 className={`text-2xl font-black uppercase tracking-tighter transition-colors duration-300 ${textClass}`}>Day Finalization</h2>
                <p className="text-yellow-600 text-[12px] font-bold mt-2 uppercase tracking-widest italic opacity-80">
                  Reconcile system data with physical collections
                </p>
              </div>

              {dayClosed && (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">
                      ✅ Day has been closed - All totals have been reset to zero
                    </p>
                  </div>
                </div>
              )}

              {!hasPhysicalCount && !dayClosed && (
                <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <AlertTriangle size={18} className="text-red-500" />
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-wider">
                      ⚠️ You must enter physical count before closing the day!
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveSection("PHYSICAL_COUNT")}
                    className="mt-3 px-4 py-2 bg-yellow-500 text-black rounded-xl text-[9px] font-black"
                  >
                    Go to Physical Count
                  </button>
                </div>
              )}

              <div className={`rounded-3xl p-10 shadow-2xl relative overflow-hidden transition-all duration-300 ${cardBgClass}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 blur-[60px] rounded-full"/>

                <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.25em] mb-10 text-center">
                  Verification Summary
                </h3>

                <div className="space-y-6 mb-12">
                  <div className="flex justify-between items-center border-b border-white/5 pb-6">
                    <span className="text-zinc-500 text-[11px] font-black uppercase tracking-wider">System Gross</span>
                    <span className={`text-2xl font-black italic transition-colors duration-300 ${textClass}`}>
                      {dayClosed ? "UGX 0" : `UGX ${fmt(sys.gross)}`}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center border-b border-white/5 pb-6">
                    <span className="text-zinc-500 text-[11px] font-black uppercase tracking-wider">Physical Total</span>
                    <span className={`text-2xl font-black italic transition-colors duration-300 ${textClass}`}>
                      {dayClosed ? "UGX 0" : `UGX ${fmt(physCash + physMomoMTN + physMomoAirtel + physCard)}`}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center pt-4">
                    <span className="text-zinc-500 text-[11px] font-black uppercase tracking-wider">Closing Variance</span>
                    <div className="text-right">
                      <span className={`text-2xl font-black italic ${dayClosed ? "text-emerald-500" : varTotal >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {dayClosed ? "UGX 0" : `${varTotal >= 0 ? "+" : ""}UGX ${fmt(varTotal)}`}
                      </span>
                      <p className="text-[8px] font-black uppercase opacity-40 mt-1">
                        {dayClosed ? "Day Closed" : (varTotal === 0 ? "Balanced" : varTotal > 0 ? "Overage" : "Shortage")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-black/30 rounded-2xl p-5 mb-8 space-y-2.5">
                  <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest mb-3">This will</p>
                  {[
                    "Archive all today's orders across all staff",
                    "Clear kitchen, barista & bar ticket boards",
                    "Reset all gross / revenue totals to zero",
                    "Reset all physical count entries to zero",
                    "Reset variance analysis to zero",
                    "Expire any pending void requests",
                    "Save a permanent audit record of today's close",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"/>
                      </div>
                      <p className="text-[10px] font-bold text-zinc-400">{item}</p>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 mb-6">
                    <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5"/>
                    <p className="text-[11px] font-bold text-rose-400">{error}</p>
                  </div>
                )}

                <button onClick={handleDayClosure} disabled={isFinalizing || !hasPhysicalCount || dayClosed}
                  className={`w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black uppercase text-[12px] tracking-[0.15em]
                    py-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-4 shadow-xl shadow-yellow-500/20
                    ${(isFinalizing || !hasPhysicalCount || dayClosed) ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] hover:shadow-2xl"}`}>
                  {isFinalizing
                    ? <><RefreshCw size={18} className="animate-spin"/> Closing Accounts…</>
                    : dayClosed 
                      ? <><CheckCircle2 size={18}/> Day Already Closed</>
                      : <><RotateCcw size={18}/> Close Accounts & Reset Dashboard</>}
                </button>
                
                {!hasPhysicalCount && !dayClosed && (
                  <p className="text-center text-[9px] text-red-400 mt-3">
                    Physical count required before closing
                  </p>
                )}
                
                {dayClosed && (
                  <p className="text-center text-[9px] text-emerald-500 mt-3">
                    This day has been closed. All revenue and physical count totals have been archived.
                  </p>
                )}
              </div>
            </div>
          )}

        
          {/* LIVE AUDIT, CREDITS, VIEW SALES, MONTHLY COSTS sections remain the same */}
          {activeSection === "LIVE_AUDIT" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className={`text-2xl font-black uppercase leading-none transition-colors duration-300 ${textClass}`}>Live Audit</h2>
                  <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">
                    Void requests from waiters — approve or reject
                  </p>
                </div>
                <button onClick={() => { loadVoidRequests(); loadVoidHistory(); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase transition-all duration-300
                    ${isDark ? 'bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900'}`}>
                  <RefreshCw size={12} className={voidRequestsLoading ? "animate-spin" : ""}/> Refresh
                </button>
              </div>

              <div>
                <p className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-3 flex items-center gap-2">
                  <AlertTriangle size={10} className="text-rose-400"/>
                  Pending Requests
                  {voidRequests.length > 0 && (
                    <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                      {voidRequests.length}
                    </span>
                  )}
                </p>

                {voidRequestsLoading && voidRequests.length === 0 ? (
                  <div className="space-y-3">
                    {[...Array(2)].map((_,i) => (
                      <div key={i} className="h-28 rounded-2xl bg-zinc-900/30 animate-pulse border border-white/5"/>
                    ))}
                  </div>
                ) : voidRequests.length === 0 ? (
                  <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-3xl bg-zinc-900/10">
                    <CheckCircle2 size={28} className="mx-auto text-zinc-700 mb-3"/>
                    <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest italic">No pending void requests</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {voidRequests.map(vr => (
                      <div key={vr.id}
                        className="bg-gradient-to-r from-rose-500/5 to-transparent border border-rose-500/20 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-300 hover:shadow-lg">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 bg-rose-500/20 rounded-xl flex items-center justify-center text-rose-400 shrink-0">
                            <AlertTriangle size={18}/>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="font-black text-white uppercase text-sm italic">{vr.item_name}</p>
                              {vr.table_name && (
                                <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-400 text-[9px] font-black uppercase border border-white/5">
                                  {vr.table_name}
                                </span>
                              )}
                              {vr.chef_name && vr.chef_name !== 'Not assigned' && (
                                <span className="px-2 py-0.5 rounded-lg bg-orange-500/20 text-orange-400 text-[8px] font-black uppercase border border-orange-500/20">
                                  Chef: {vr.chef_name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 flex-wrap text-[10px] text-zinc-500">
                              <span>Waiter: <span className="text-white font-bold">{vr.waiter_name || vr.requested_by}</span></span>
                              {vr.chef_name && vr.chef_name !== 'Not assigned' && (
                                <span>· Chef: <span className="text-yellow-400 font-bold">{vr.chef_name}</span></span>
                              )}
                              <span className="text-zinc-700">
                                {new Date(vr.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                              </span>
                            </div>
                            <p className="text-[10px] text-rose-400 italic mt-0.5">"{vr.reason}"</p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => approveVoid(vr.id)}
                            className="bg-rose-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase hover:bg-rose-500 transition-all duration-300 hover:scale-105">
                            Approve
                          </button>
                          <button onClick={() => rejectVoid(vr.id)}
                            className="bg-zinc-800 text-zinc-400 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase border border-white/5 hover:bg-zinc-700 transition-all duration-300">
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/5">
                <p className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-3 flex items-center gap-2">
                  <ClipboardList size={10} className="text-zinc-400"/>
                  Today's Resolved Voids
                  {voidHistory.length > 0 && (
                    <span className="bg-zinc-700 text-zinc-300 text-[8px] font-black px-1.5 py-0.5 rounded-full">
                      {voidHistory.length}
                    </span>
                  )}
                </p>

                {voidHistoryLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_,i) => (
                      <div key={i} className="h-16 rounded-2xl bg-zinc-900/30 animate-pulse border border-white/5"/>
                    ))}
                  </div>
                ) : voidHistory.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-white/5 rounded-2xl">
                    <p className="text-zinc-700 font-black uppercase text-[9px] tracking-widest">No resolved voids today</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {voidHistory.map(vr => (
                      <div key={vr.id}
                        className={`p-4 rounded-2xl border flex items-center justify-between gap-3 flex-wrap transition-all duration-300
                          ${vr.status === 'Approved'
                            ? 'bg-rose-500/5 border-rose-500/15'
                            : vr.status === 'Rejected'
                            ? 'bg-zinc-900/20 border-white/5'
                            : 'bg-zinc-900/10 border-white/5 opacity-50'}`}>
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[11px] font-black
                            ${vr.status === 'Approved' ? 'bg-rose-500/20 text-rose-400' : 'bg-zinc-800 text-zinc-500'}`}>
                            {vr.status === 'Approved' ? '✓' : '✕'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[11px] font-black text-white uppercase">{vr.item_name}</p>
                              {vr.table_name && (
                                <span className="text-[8px] font-black text-zinc-600 uppercase">{vr.table_name}</span>
                              )}
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg uppercase
                                ${vr.status === 'Approved'
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : vr.status === 'Rejected'
                                  ? 'bg-zinc-700/50 text-zinc-500'
                                  : 'bg-zinc-800 text-zinc-600'}`}>
                                {vr.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap text-[9px] text-zinc-600 mt-0.5">
                              <span>Waiter: <span className="text-zinc-400">{vr.waiter_name || vr.requested_by}</span></span>
                              {vr.chef_name && (
                                <span>· Chef: <span className="text-yellow-500/70">{vr.chef_name}</span></span>
                              )}
                            </div>
                            <p className="text-[8px] text-zinc-700 italic mt-0.5">"{vr.reason}"</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {vr.resolved_by && (
                            <p className="text-[9px] font-black text-zinc-500 uppercase">by {vr.resolved_by}</p>
                          )}
                          <p className="text-[8px] text-zinc-700">
                            {vr.resolved_at
                              ? new Date(vr.resolved_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})
                              : new Date(vr.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CREDITS */}
          {activeSection === "CREDITS" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div>
                <h2 className={`text-2xl font-black uppercase leading-none transition-colors duration-300 ${textClass}`}>Credits Ledger</h2>
                <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">All on-account orders — pending, approved, settled, and rejected (Persists for current month)</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] ${cardBgClass}`}>
                  <div className="p-2.5 w-fit bg-purple-500/10 rounded-xl text-purple-400 mb-3"><BookOpen size={16}/></div>
                  <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Outstanding</p>
                  <h3 className="text-xl font-black text-purple-400 italic">{formatCurrencyCompact(totalOutstanding)}</h3>
                  <p className="text-[9px] text-zinc-600 mt-0.5">{approvedAndPending.length + partiallySettled.length} pending</p>
                </div>
                <div className={`rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] ${cardBgClass}`}>
                  <div className="p-2.5 w-fit bg-emerald-500/10 rounded-xl text-emerald-400 mb-3"><CheckCircle2 size={16}/></div>
                  <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Settled</p>
                  <h3 className="text-xl font-black text-emerald-400 italic">{formatCurrencyCompact(totalSettled)}</h3>
                  <p className="text-[9px] text-zinc-600 mt-0.5">{settled.length} cleared</p>
                </div>
                <div className={`rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] ${cardBgClass}`}>
                  <div className="p-2.5 w-fit bg-red-500/10 rounded-xl text-red-400 mb-3"><XCircle size={16}/></div>
                  <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Rejected</p>
                  <h3 className="text-xl font-black text-red-400 italic">{formatCurrencyCompact(totalRejected)}</h3>
                  <p className="text-[9px] text-zinc-600 mt-0.5">{creditsLedger.filter(c => getCreditStatus(c) === "rejected").length} rejected</p>
                </div>
                <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-5 rounded-2xl">
                  <div className="p-2.5 w-fit bg-black/20 rounded-xl text-black mb-3"><Receipt size={16}/></div>
                  <p className="text-[8px] font-black uppercase text-black/60 tracking-widest mb-1">All Time Credits</p>
                  <h3 className="text-xl font-black text-black italic">{formatCurrencyCompact(totalOutstanding + totalSettled + totalRejected)}</h3>
                  <p className="text-[9px] text-black/50 mt-0.5">{creditsLedger.length} total entries (current month)</p>
                </div>
              </div>

              <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-2xl w-fit">
                {[
                  { key: "all",         label: "All" },
                  { key: "outstanding", label: "Outstanding" },
                  { key: "settled",     label: "Settled" },
                  { key: "rejected",    label: "Rejected" },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setCreditFilter(key)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300
                      ${creditFilter === key ? "bg-yellow-500 text-black shadow-lg" : "text-zinc-500 hover:text-zinc-300"}`}>
                    {label}
                  </button>
                ))}
              </div>

              {creditsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_,i) => <div key={i} className="h-24 rounded-2xl bg-zinc-900/30 animate-pulse border border-white/5"/>)}
                </div>
              ) : filteredCredits.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                  <BookOpen size={32} className="mx-auto text-zinc-700 mb-3"/>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">No credits found for this month</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCredits.map(credit => <AccountantCreditRow key={credit.id} credit={credit}/>)}
                </div>
              )}
            </div>
          )}

          {/* VIEW SALES */}
          {activeSection === "VIEW_SALES" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h2 className={`text-2xl font-black uppercase leading-none transition-colors duration-300 ${textClass}`}>Station Sales</h2>
                  <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">Kitchen · Barista · Bar — daily output per station</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="date" value={salesDate} onChange={e => setSalesDate(e.target.value)}
                    className="bg-zinc-900 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-xs font-bold outline-none focus:border-yellow-500/50"/>
                  <button onClick={() => loadSales(salesDate)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-white/5 rounded-2xl text-[10px] font-black text-zinc-400 uppercase hover:text-white transition-colors">
                    <RefreshCw size={12} className={salesLoading ? "animate-spin" : ""}/> Refresh
                  </button>
                </div>
              </div>

              {(kitchenSummary || baristaSummary || barmanSummary) && (() => {
                const totalTickets = [kitchenSummary, baristaSummary, barmanSummary].reduce((s,d) => s + Number(d?.totals?.ticket_count || 0), 0);
                const totalItems   = [kitchenSummary, baristaSummary, barmanSummary].reduce((s,d) => s + Number(d?.totals?.total_items   || 0), 0);
                const totalDone    = [kitchenSummary, baristaSummary, barmanSummary].reduce((s,d) => s + Number(d?.totals?.completed_count || 0), 0);
                return (
                  <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                    <div>
                      <p className="text-[9px] font-black uppercase text-black/60 tracking-widest">All Stations Combined</p>
                      <h3 className="text-3xl font-black text-black italic mt-0.5">{totalTickets} tickets</h3>
                    </div>
                    <div className="flex items-center gap-6 text-black">
                      <div className="text-center">
                        <p className="text-[8px] font-black uppercase opacity-60">Total Items</p>
                        <p className="text-2xl font-black">{totalItems}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black uppercase opacity-60">Completed</p>
                        <p className="text-2xl font-black">{totalDone}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black uppercase opacity-60">Date</p>
                        <p className="text-sm font-black">{salesDate}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <StationCard icon={<ChefHat size={22}/>} label="Kitchen"
                  color={{ text: "text-yellow-400", bg: "bg-yellow-500/10" }} borderColor="border-yellow-500/20"
                  summary={kitchenSummary} loading={salesLoading} tickets={kitchenSummary?.tickets || []}/>
                <StationCard icon={<Coffee size={22}/>} label="Barista"
                  color={{ text: "text-orange-400", bg: "bg-orange-500/10" }} borderColor="border-orange-500/20"
                  summary={baristaSummary} loading={salesLoading} tickets={baristaSummary?.tickets || []}/>
                <StationCard icon={<Wine size={22}/>} label="Bar"
                  color={{ text: "text-blue-400", bg: "bg-blue-500/10" }} borderColor="border-blue-500/20"
                  summary={barmanSummary} loading={salesLoading} tickets={barmanSummary?.tickets || []}/>
              </div>

              {!salesLoading && !kitchenSummary && !baristaSummary && !barmanSummary && (
                <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-3xl">
                  <BarChart3 size={40} className="mx-auto text-zinc-700 mb-4"/>
                  <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">No station data for {salesDate}</p>
                  <p className="text-zinc-700 text-[9px] mt-2">Orders must pass through a station for tickets to be recorded</p>
                </div>
              )}
            </div>
          )}

          {/* MONTHLY COSTS */}
          {activeSection === "MONTHLY_COSTS" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div>
                <h2 className={`text-2xl font-black uppercase leading-none transition-colors duration-300 ${textClass}`}>Monthly Expenses</h2>
                <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">Manage recurring operational costs for Kurax Bistro</p>
              </div>
              <div className="max-w-4xl">
                <MonthlyCosts
                  month={selectedMonth}
                  monthLabel={new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}
                  fixedItems={profitData?.costs?.fixed_items || []}
                  profitLoad={profitLoad}
                  onRefresh={fetchMonthlyData}
                  dark={isDark}
                  t={{
                    card: isDark ? "bg-zinc-900/30 border-white/5" : "bg-white/80 border-gray-200 shadow-sm",
                    divider: isDark ? "border-white/5" : "border-gray-200",
                    subtext: isDark ? "text-zinc-500" : "text-gray-500"
                  }}
                  API_URL={API_URL}
                />
              </div>
            </div>
          )}

        </main>
        <Footer isDark={isDark} />
      </div>

      {/* Modals */}
      <ReopenDayModal
        isOpen={showReopenModal}
        onClose={() => {
          setShowReopenModal(false);
          setSelectedReopenDate('');
          setReopenReason('');
        }}
        closedDays={closedDaysList}
        loading={loadingClosedDays}
        onReopen={handleReopenDay}
        reopening={reopeningDay}
      />

      <StartNewDayModal
        isOpen={showStartNewDayModal}
        onClose={() => setShowStartNewDayModal(false)}
        onStart={handleStartNewDay}
        starting={startingNewDay}
      />
    </div>
  );
}