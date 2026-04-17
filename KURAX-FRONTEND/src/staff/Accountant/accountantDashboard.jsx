import React, { useState, useEffect, useCallback } from "react";
import {
  Banknote, Smartphone, CreditCard, Receipt, Clock,
  Menu, Calculator, Wallet, CheckCircle2,
  RotateCcw, BookOpen, User, Phone, Calendar,
  RefreshCw, TrendingUp, Save, AlertTriangle,
  BarChart3, ChefHat, Coffee, Wine, ChevronDown, ChevronUp,
  ClipboardList, Hourglass, XCircle, Sun, Moon, LayoutGrid,
  TrendingDown, PieChart, DollarSign, Activity
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

// Helper to get correct credit status
function getCreditStatus(credit) {
  if (credit.status === "FullySettled" || credit.status === "PartiallySettled") return "settled";
  if (credit.status === "Approved") return "approved";
  if (credit.status === "PendingManagerApproval") return "pendingManager";
  if (credit.status === "PendingCashier") return "pendingCashier";
  if (credit.status === "Rejected") return "rejected";
  if (credit.paid === true || credit.paid === "t" || credit.paid === "true") return "settled";
  return "outstanding";
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, note, isCount = false, trend }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-900/30 p-5 border border-white/5 hover:border-yellow-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/5">
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-yellow-500/5 to-transparent rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500" />
      <div className="relative z-10">
        <div className={`p-2.5 w-fit rounded-xl bg-black/40 border border-white/10 ${color} group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <div className="mt-3">
          <p className="text-[8px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-0.5">{label}</p>
          {note && <p className="text-[7px] text-zinc-600 uppercase font-bold mb-1">{note}</p>}
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-2xl font-black text-white italic tracking-tighter">
              {!isCount && <span className="text-[9px] mr-1 opacity-40 not-italic">UGX</span>}
              {isCount ? value : fmt(value)}
            </h3>
            {trend && (
              <span className={`text-[8px] font-black flex items-center gap-0.5 ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                {trend > 0 ? <TrendingUp size={10}/> : trend < 0 ? <TrendingDown size={10}/> : null}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
        </div>
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

// ─── CREDIT ROW - FIXED to show correct status ───────────────────────────────
function AccountantCreditRow({ credit }) {
  const status = getCreditStatus(credit);
  
  const statusConfig = {
    pendingCashier: { label: "Wait for Cashier", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", icon: <Hourglass size={12}/> },
    pendingManager: { label: "Wait for Manager", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", icon: <Clock size={12}/> },
    approved: { label: "Approved", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", icon: <CheckCircle2 size={12}/> },
    settled: { label: "Settled", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 size={12}/> },
    rejected: { label: "Rejected", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: <XCircle size={12}/> },
    outstanding: { label: "Outstanding", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", icon: <BookOpen size={12}/> },
  };
  
  const config = statusConfig[status] || statusConfig.outstanding;
  const isSettled = status === "settled";
  const isRejected = status === "rejected";
  
  return (
    <div className={`rounded-2xl border p-5 flex items-start justify-between gap-3 flex-wrap transition-all duration-300 hover:shadow-lg hover:scale-[1.01] ${config.bg}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="font-black text-white uppercase italic tracking-tighter text-lg">{credit.table_name || "Table"}</span>
          <span className={`px-2 py-0.5 rounded-full border ${config.bg} ${config.color} text-[9px] font-black uppercase flex items-center gap-1`}>
            {config.icon} {config.label}
          </span>
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
        {isSettled && credit.settle_method && (
          <p className="text-[9px] text-zinc-600 mt-1 font-mono">
            Settled via {credit.settle_method}
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
        <p className={`text-2xl font-black italic ${config.color}`}>
          UGX {fmt(credit.amount)}
        </p>
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
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color.bg} transition-transform duration-300 group-hover:scale-110`}>
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
            {expanded ? <ChevronUp size={11} className="group-hover:-translate-y-0.5 transition-transform"/> : <ChevronDown size={11} className="group-hover:translate-y-0.5 transition-transform"/>}
            {expanded ? "Hide" : "Show"} {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
          </button>
          {expanded && (
            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
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

// ─── THEME TOGGLE BUTTON ──────────────────────────────────────────────────────
function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="relative w-12 h-6 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 p-0.5 transition-all duration-300 hover:scale-105 focus:outline-none"
    >
      <div className={`absolute inset-0 rounded-full bg-black/20 transition-opacity duration-300 ${isDark ? 'opacity-0' : 'opacity-100'}`} />
      <div className={`relative w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 flex items-center justify-center ${isDark ? 'translate-x-6' : 'translate-x-0'}`}>
        {isDark ? <Moon size={10} className="text-zinc-800" /> : <Sun size={10} className="text-yellow-500" />}
      </div>
    </button>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function AccountantDashboard() {
  const { todaySummary, orders = [], setOrders } = useData() || {};
  const [isDark, setIsDark] = useState(true);

  const [activeSection,  setActiveSection]  = useState("FINANCIAL_HISTORY");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Live summary (own fetch — bypasses DataContext polling delay) ─────────
  const [liveSummary, setLiveSummary] = useState(null);

  const fetchLiveSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/summaries/today`);
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
  const [profitData,     setProfitData]     = useState(null);
  const [profitLoad,     setProfitLoad]     = useState(false);
  const [selectedMonth,  setSelectedMonth]  = useState(new Date().toISOString().substring(0, 7));

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

  // ── Void pending requests (also refreshes history) ────────────────────────
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

  // ── Physical count ────────────────────────────────────────────────────────
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cash: physCash, momo_mtn: physMomoMTN, momo_airtel: physMomoAirtel,
          card: physCard, notes: physNotes, submitted_by: u?.name || "Accountant",
        }),
      });
      setPhysSaved(true);
      setTimeout(() => setPhysSaved(false), 3000);
    } catch (e) { console.error("save physical count:", e); }
    setPhysSaving(false);
  };

  // ── Credits - FIXED to show correct statuses ───────────────────────────────
  useEffect(() => {
    const load = async () => {
      setCreditsLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/cashier-ops/credits`);
        if (res.ok) {
          const rows = await res.json();
          setCreditsLedger(rows);
        }
      } catch (e) { console.error("Credits:", e); }
      setCreditsLoading(false);
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  // In AccountantDashboard.jsx, update the loadSales function:
  const loadSales = useCallback(async (date) => {
    setSalesLoading(true);
    const d = date || salesDate;
    try {
      const [kRes, brRes, bmRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/kitchen/tickets/summary?date=${d}`),
        fetch(`${API_URL}/api/barista/tickets/summary?date=${d}`),
        fetch(`${API_URL}/api/barman/tickets/summary?date=${d}`),
      ]);
      
      if (kRes.status === "fulfilled" && kRes.value.ok) {
        setKitchenSummary(await kRes.value.json());
      } else {
        console.log("Kitchen summary not available");
        setKitchenSummary(null);
      }
      
      if (brRes.status === "fulfilled" && brRes.value.ok) {
        setBaristaSummary(await brRes.value.json());
      } else {
        console.log("Barista summary not available");
        setBaristaSummary(null);
      }
      
      if (bmRes.status === "fulfilled" && bmRes.value.ok) {
        setBarmanSummary(await bmRes.value.json());
      } else {
        console.log("Barman summary not available");
        setBarmanSummary(null);
      }
    } catch (e) { 
      console.error("sales:", e); 
    }
    setSalesLoading(false);
  }, [salesDate]);

  useEffect(() => {
    if (activeSection === "VIEW_SALES") loadSales(salesDate);
  }, [activeSection, salesDate]);

  // ── Derived values — use liveSummary (direct fetch) ──────────────────────
  const src = liveSummary || todaySummary || {};
  const sys = {
    cash:   Number(src.total_cash)   || 0,
    card:   Number(src.total_card)   || 0,
    mtn:    Number(src.total_mtn)    || 0,
    airtel: Number(src.total_airtel) || 0,
    gross:  Number(src.total_gross)  || 0,
    orders: Number(src.order_count)  || 0,
  };

  const varCash   = physCash       - sys.cash;
  const varMTN    = physMomoMTN    - sys.mtn;
  const varAirtel = physMomoAirtel - sys.airtel;
  const varCard   = physCard       - sys.card;
  const varTotal  = varCash + varMTN + varAirtel + varCard;

  // FIXED: Credit filtering by actual status
  const outstanding = creditsLedger.filter(c => {
    const status = getCreditStatus(c);
    return status === "outstanding" || status === "approved" || status === "pendingCashier" || status === "pendingManager";
  });
  const settled = creditsLedger.filter(c => getCreditStatus(c) === "settled");
  const rejected = creditsLedger.filter(c => getCreditStatus(c) === "rejected");
  
  const totalOutstanding = outstanding.reduce((s,c) => s + Number(c.amount || 0), 0);
  const totalSettled = settled.reduce((s,c) => s + Number(c.amount_paid || c.amount || 0), 0);
  const totalRejected = rejected.reduce((s,c) => s + Number(c.amount || 0), 0);
  
  const filteredCredits = creditFilter === "outstanding" ? outstanding
    : creditFilter === "settled" ? settled
    : creditFilter === "rejected" ? rejected
    : creditsLedger;

  // ── Void handlers ─────────────────────────────────────────────────────────
  const loggedInUser = JSON.parse(localStorage.getItem("kurax_user") || "{}");

  const approveVoid = async (id) => {
    try {
      await fetch(`${API_URL}/api/orders/void-requests/${id}/approve`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_by: loggedInUser?.name || "Accountant" }),
      });
      loadVoidRequests(); // also refreshes history
    } catch (e) { console.error("void approve:", e); }
  };

  const rejectVoid = async (id) => {
    try {
      await fetch(`${API_URL}/api/orders/void-requests/${id}/reject`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejected_by: loggedInUser?.name || "Accountant" }),
      });
      loadVoidRequests(); // also refreshes history
    } catch (e) { console.error("void reject:", e); }
  };

  // Theme toggle handler
  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const bgClass = isDark ? 'bg-[#0a0a0a]' : 'bg-gray-50';
  const textClass = isDark ? 'text-white' : 'text-gray-900';
  const cardBgClass = isDark ? 'bg-zinc-900/30 border-white/5' : 'bg-white/80 border-gray-200 shadow-sm';

  return (
    <div className={`flex flex-col lg:flex-row min-h-screen ${bgClass} font-[Outfit] transition-colors duration-300`}>
      <SideBar
        activeSection={activeSection} setActiveSection={setActiveSection}
        isOpen={mobileMenuOpen}       setIsOpen={setMobileMenuOpen}
         isDark={isDark}
      />

      <div className="flex-1 flex flex-col">

        {/* ── HEADER ── */}
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
            {/* Theme Toggle Button */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Theme</span>
              <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
            </div>
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

          {/* ══════════════════════════════════════════════════════
              FINANCIAL HISTORY - REMOVED Mixed and Credit pills
          ══════════════════════════════════════════════════════ */}
          {activeSection === "FINANCIAL_HISTORY" && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div>
                <h2 className={`text-2xl font-black uppercase leading-none transition-colors duration-300 ${textClass}`}>Today's Revenue</h2>
                <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">Live from cashier queue — updates every 15 seconds</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard icon={<Banknote size={18}/>}   label="Cash"        value={sys.cash}   color="text-emerald-500"/>
                <StatCard icon={<CreditCard size={18}/>} label="Card"        value={sys.card}   color="text-blue-400"/>
                <StatCard icon={<Smartphone size={18}/>} label="MTN Momo"    value={sys.mtn}    color="text-yellow-500"/>
                <StatCard icon={<Smartphone size={18}/>} label="Airtel Momo" value={sys.airtel} color="text-red-500"/>
                <StatCard icon={<Receipt size={18}/>}    label="Orders"      value={sys.orders} color="text-zinc-400" isCount/>

                <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-5 rounded-2xl flex flex-col gap-2 shadow-lg shadow-yellow-500/20 col-span-2 md:col-span-1">
                  <div className="p-2.5 w-fit rounded-xl bg-black/20 text-black"><TrendingUp size={18}/></div>
                  <div>
                    <p className="text-[8px] font-black uppercase text-black/60 tracking-[0.2em] mb-1">Gross Revenue</p>
                    <h3 className="text-2xl font-black text-black italic tracking-tighter">
                      <span className="text-[9px] mr-1 opacity-50 not-italic">UGX</span>{fmt(sys.gross)}
                    </h3>
                  </div>
                </div>
              </div>

              

              {/* Monthly Expenses */}
              <div className="pt-4">
                <div className="mb-4">
                  <h2 className={`text-xl font-black uppercase leading-none transition-colors duration-300 ${textClass}`}>Monthly Expenses</h2>
                  <p className="text-zinc-500 text-[11px] font-medium mt-1 italic uppercase tracking-wider">Fixed Costs & Operational Overheads</p>
                </div>
                <MonthlyCosts
                  month={selectedMonth}
                  monthLabel={selectedMonth}
                  fixedItems={profitData?.costs?.fixed_items || []}
                  profitLoad={profitLoad}
                  onRefresh={fetchMonthlyData}
                  API_URL={API_URL}
                  dark={isDark}
                  t={{ card: isDark ? "bg-zinc-900/30" : "bg-white/80", divider: isDark ? "border-white/5" : "border-gray-200", subtext: isDark ? "text-zinc-500" : "text-gray-500" }}
                />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PHYSICAL COUNT
          ══════════════════════════════════════════════════════ */}
          {activeSection === "PHYSICAL_COUNT" && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div>
                <h2 className={`text-2xl font-black uppercase leading-none transition-colors duration-300 ${textClass}`}>Physical Count</h2>
                <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">Enter actual cash/card/momo on hand — saved to database</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`p-8 rounded-2xl transition-all duration-300 ${cardBgClass}`}>
                  <h3 className="text-[10px] font-black uppercase text-yellow-500 tracking-widest flex items-center gap-2 mb-5">
                    <Calculator size={13}/> Physical Cash Entry
                  </h3>
                  {physLoading ? (
                    <div className="h-40 animate-pulse bg-zinc-800/30 rounded-2xl"/>
                  ) : (
                    <>
                      <PhysInput label="Cash on Hand" value={physCash}        onChange={setPhysCash}        color="text-emerald-400"/>
                      <PhysInput label="MTN Momo"      value={physMomoMTN}     onChange={setPhysMomoMTN}     color="text-yellow-400"/>
                      <PhysInput label="Airtel Momo"   value={physMomoAirtel}  onChange={setPhysMomoAirtel}  color="text-red-400"/>
                      <PhysInput label="Card / POS"    value={physCard}        onChange={setPhysCard}        color="text-blue-400"/>
                      <div>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Notes (optional)</p>
                        <textarea value={physNotes} onChange={e => setPhysNotes(e.target.value)}
                          placeholder="Any discrepancy notes..."
                          className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-yellow-500/50 resize-none h-16 transition-all"/>
                      </div>
                      <button onClick={savePhysicalCount} disabled={physSaving}
                        className={`w-full py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all duration-300
                          ${physSaved ? "bg-emerald-500 text-black" : "bg-gradient-to-r from-yellow-500 to-yellow-600 text-black hover:scale-[1.02]"}
                          ${physSaving ? "opacity-60 cursor-not-allowed" : ""}`}>
                        {physSaving ? "Saving…" : physSaved ? <><CheckCircle2 size={14}/> Saved!</> : <><Save size={14}/> Save Count</>}
                      </button>
                    </>
                  )}
                </div>

                <div className={`p-8 rounded-2xl transition-all duration-300 ${cardBgClass}`}>
                  <h3 className="text-[10px] font-black uppercase text-yellow-500 tracking-widest flex items-center gap-2 mb-5">
                    <TrendingUp size={13}/> Variance Analysis
                  </h3>
                  <div className="space-y-1">
                    <VarianceRow label="System Cash"   system={sys.cash}   physical={physCash}       variance={varCash}/>
                    <VarianceRow label="System MTN"    system={sys.mtn}    physical={physMomoMTN}    variance={varMTN}/>
                    <VarianceRow label="System Airtel" system={sys.airtel} physical={physMomoAirtel} variance={varAirtel}/>
                    <VarianceRow label="System Card"   system={sys.card}   physical={physCard}       variance={varCard}/>
                  </div>
                  <div className={`mt-4 p-6 rounded-2xl border transition-all duration-300
                    ${varTotal === 0 ? "bg-emerald-500/10 border-emerald-500/20"
                      : varTotal > 0 ? "bg-blue-500/10 border-blue-500/20"
                      :                "bg-rose-500/10 border-rose-500/20"}`}>
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
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              END OF SHIFT
          ══════════════════════════════════════════════════════ */}
          {activeSection === "END_OF_SHIFT" && (
            <AccountantEndShift
              sys={sys}
              physTotals={{ cash: physCash, mtn: physMomoMTN, airtel: physMomoAirtel, card: physCard }}
              variance={varTotal}
              isDark={isDark}
            />
          )}

          {/* ══════════════════════════════════════════════════════
              LIVE AUDIT
          ══════════════════════════════════════════════════════ */}
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

              {/* ── PENDING REQUESTS ── */}
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
                    <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest italic">
                      No pending void requests
                    </p>
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
                            </div>
                            <div className="flex items-center gap-3 flex-wrap text-[10px] text-zinc-500">
                              <span>Waiter: <span className="text-white font-bold">{vr.waiter_name || vr.requested_by}</span></span>
                              {vr.chef_name && (
                                <span>· Chef: <span className="text-yellow-400 font-bold">{vr.chef_name}</span></span>
                              )}
                              {vr.station && (
                                <span className="text-zinc-600 capitalize">· {vr.station}</span>
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

              {/* ── TODAY'S VOID HISTORY LEDGER ── */}
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
                    <p className="text-zinc-700 font-black uppercase text-[9px] tracking-widest">
                      No resolved voids today
                    </p>
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
                            ${vr.status === 'Approved'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-zinc-800 text-zinc-500'}`}>
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
                              {vr.station && (
                                <span className="text-zinc-700 capitalize">· {vr.station}</span>
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
                              : new Date(vr.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})
                            }
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              CREDITS - FIXED with proper status tabs
          ══════════════════════════════════════════════════════ */}
          {activeSection === "CREDITS" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div>
                <h2 className={`text-2xl font-black uppercase leading-none transition-colors duration-300 ${textClass}`}>Credits Ledger</h2>
                <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">All on-account orders — pending, approved, settled, and rejected</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] ${cardBgClass}`}>
                  <div className="p-2.5 w-fit bg-purple-500/10 rounded-xl text-purple-400 mb-3"><BookOpen size={16}/></div>
                  <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Outstanding</p>
                  <h3 className="text-xl font-black text-purple-400 italic">UGX {fmt(totalOutstanding)}</h3>
                  <p className="text-[9px] text-zinc-600 mt-0.5">{outstanding.length} pending</p>
                </div>
                <div className={`rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] ${cardBgClass}`}>
                  <div className="p-2.5 w-fit bg-emerald-500/10 rounded-xl text-emerald-400 mb-3"><CheckCircle2 size={16}/></div>
                  <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Settled</p>
                  <h3 className="text-xl font-black text-emerald-400 italic">UGX {fmt(totalSettled)}</h3>
                  <p className="text-[9px] text-zinc-600 mt-0.5">{settled.length} cleared</p>
                </div>
                <div className={`rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] ${cardBgClass}`}>
                  <div className="p-2.5 w-fit bg-red-500/10 rounded-xl text-red-400 mb-3"><XCircle size={16}/></div>
                  <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Rejected</p>
                  <h3 className="text-xl font-black text-red-400 italic">UGX {fmt(totalRejected)}</h3>
                  <p className="text-[9px] text-zinc-600 mt-0.5">{rejected.length} rejected</p>
                </div>
                <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-5 rounded-2xl">
                  <div className="p-2.5 w-fit bg-black/20 rounded-xl text-black mb-3"><Receipt size={16}/></div>
                  <p className="text-[8px] font-black uppercase text-black/60 tracking-widest mb-1">All Time Credits</p>
                  <h3 className="text-xl font-black text-black italic">UGX {fmt(totalOutstanding + totalSettled + totalRejected)}</h3>
                  <p className="text-[9px] text-black/50 mt-0.5">{creditsLedger.length} total entries</p>
                </div>
              </div>

              <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-2xl w-fit">
                {[
                  { key: "all", label: "All" },
                  { key: "outstanding", label: "Outstanding" },
                  { key: "settled", label: "Settled" },
                  { key: "rejected", label: "Rejected" }
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
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">No {creditFilter} credits</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCredits.map(credit => <AccountantCreditRow key={credit.id} credit={credit}/>)}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              VIEW SALES
          ══════════════════════════════════════════════════════ */}
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

          {/* ══════════════════════════════════════════════════════
              MONTHLY COSTS
          ══════════════════════════════════════════════════════ */}
          {activeSection === "MONTHLY_COSTS" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div>
                <h2 className={`text-2xl font-black uppercase leading-none transition-colors duration-300 ${textClass}`}>Monthly Expenses</h2>
                <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">
                  Manage recurring operational costs for Kurax Bistro
                </p>
              </div>
              <div className="max-w-4xl">
                <MonthlyCosts
                  month={selectedMonth}
                  monthLabel={new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}
                  fixedItems={profitData?.costs?.fixed_items || []}
                  profitLoad={profitLoad}
                  onRefresh={fetchMonthlyData}
                  dark={isDark}
                  t={{ card: isDark ? "bg-zinc-900/30 border-white/5" : "bg-white/80 border-gray-200 shadow-sm", 
                        divider: isDark ? "border-white/5" : "border-gray-200", 
                        subtext: isDark ? "text-zinc-500" : "text-gray-500" }}
                  API_URL={API_URL}
                />
              </div>
            </div>
          )}

        </main>
        <Footer isDark={isDark} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNTANT END SHIFT
// ─────────────────────────────────────────────────────────────────────────────
function AccountantEndShift({ sys, physTotals, variance, isDark }) {
  const { refreshData } = useData() || {};

  const [isFinalizing, setIsFinalizing] = useState(false);
  const [done,         setDone]         = useState(false);
  const [result,       setResult]       = useState(null);
  const [error,        setError]        = useState(null);

  const physTotal = (physTotals?.cash    || 0)
                  + (physTotals?.mtn     || 0)
                  + (physTotals?.airtel  || 0)
                  + (physTotals?.card    || 0);

  const handleFinalSync = async () => {
    const confirmed = window.confirm(
      "Close today's accounts?\n\n" +
      "• All orders will be archived\n" +
      "• Kitchen / barista / bar boards will clear\n" +
      "• Revenue totals will reset to zero\n" +
      "• Pending void requests will be expired\n\n" +
      "This cannot be undone."
    );
    if (!confirmed) return;

    setIsFinalizing(true);
    setError(null);
    try {
      const actor = (() => {
        try { return JSON.parse(localStorage.getItem("kurax_user") || "{}").name; }
        catch { return "Accountant"; }
      })();

      const res = await fetch(`${API_URL}/api/accountant/finalize-day`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ final_gross: sys?.gross || 0, recorded_by: actor }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Server error — please try again."); return; }

      setResult(data);
      setDone(true);

      if (typeof refreshData === "function") {
        await refreshData();
      } else {
        setTimeout(() => window.location.reload(), 2500);
      }
    } catch (e) {
      console.error("Finalize day error:", e);
      setError("Network error — could not reach the server. Please try again.");
    } finally {
      setIsFinalizing(false);
    }
  };

  if (done && result) return (
    <div className="flex flex-col items-center justify-center py-24 gap-6 animate-in zoom-in-95 duration-700">
      <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
        <CheckCircle2 size={48}/>
      </div>
      <div className="text-center">
        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Accounts Closed</h2>
        <p className="text-zinc-600 text-[10px] mt-2 uppercase tracking-[0.3em] font-bold">
          {result.date} · closed successfully
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 w-full max-w-md">
        {[
          { label: "Orders Archived", value: result.cleared_orders,    color: "text-yellow-400" },
          { label: "Tickets Cleared", value: result.cleared_tickets,   color: "text-orange-400" },
          { label: "Final Gross",     value: `UGX ${fmt(sys?.gross)}`, color: "text-emerald-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 text-center">
            <p className="text-[8px] font-black uppercase text-zinc-600 tracking-widest mb-1">{label}</p>
            <p className={`text-lg font-black italic ${color}`}>{value}</p>
          </div>
        ))}
      </div>
      <p className="text-zinc-700 text-[9px] uppercase font-bold tracking-widest">All dashboards will refresh automatically</p>
    </div>
  );

  const cardBgClass = isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-white/80 border-gray-200 shadow-sm';
  const textClass = isDark ? 'text-white' : 'text-gray-900';

  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="text-center">
        <h2 className={`text-2xl font-black uppercase tracking-tighter transition-colors duration-300 ${textClass}`}>Day Finalization</h2>
        <p className="text-yellow-600 text-[12px] font-bold mt-2 uppercase tracking-widest italic opacity-80">
          Reconcile system data with physical collections
        </p>
      </div>

      <div className={`rounded-3xl p-10 shadow-2xl relative overflow-hidden transition-all duration-300 ${cardBgClass}`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 blur-[60px] rounded-full"/>

        <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.25em] mb-10 text-center">
          Verification Summary
        </h3>

        <div className="space-y-6 mb-12">
          <div className="flex justify-between items-center border-b border-white/5 pb-6">
            <span className="text-zinc-500 text-[11px] font-black uppercase tracking-wider">System Gross</span>
            <span className={`text-2xl font-black italic transition-colors duration-300 ${textClass}`}>UGX {fmt(sys?.gross)}</span>
          </div>
          <div className="flex justify-between items-center border-b border-white/5 pb-6">
            <span className="text-zinc-500 text-[11px] font-black uppercase tracking-wider">Physical Total</span>
            <span className={`text-2xl font-black italic transition-colors duration-300 ${textClass}`}>UGX {fmt(physTotal)}</span>
          </div>
          <div className="flex justify-between items-center pt-4">
            <span className="text-zinc-500 text-[11px] font-black uppercase tracking-wider">Closing Variance</span>
            <div className="text-right">
              <span className={`text-2xl font-black italic ${variance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {variance >= 0 ? "+" : ""}UGX {fmt(variance)}
              </span>
              <p className="text-[8px] font-black uppercase opacity-40 mt-1">
                {variance === 0 ? "Balanced" : variance > 0 ? "Overage" : "Shortage"}
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

        <button onClick={handleFinalSync} disabled={isFinalizing}
          className={`w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black uppercase text-[12px] tracking-[0.15em]
            py-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-4 shadow-xl shadow-yellow-500/20
            ${isFinalizing ? "opacity-70 cursor-not-allowed" : "hover:scale-[1.02] hover:shadow-2xl"}`}>
          {isFinalizing
            ? <><RefreshCw size={18} className="animate-spin"/> Closing Accounts…</>
            : <><RotateCcw size={18}/> Close Accounts & Reset Dashboard</>}
        </button>
      </div>
    </div>
  );
}