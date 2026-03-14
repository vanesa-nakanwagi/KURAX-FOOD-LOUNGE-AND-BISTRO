import React, { useState, useEffect, useCallback } from "react";
import {
  Banknote, Smartphone, CreditCard, Receipt,
  Menu, Calculator, Wallet, CheckCircle2,
  RotateCcw, BookOpen, User, Phone, Calendar,
  RefreshCw, TrendingUp, Save, AlertTriangle,
  BarChart3, ChefHat, Coffee, Wine, ChevronDown, ChevronUp
} from "lucide-react";
import { useData } from "../../customer/components/context/DataContext";
import SideBar from "./SideBar";
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

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, note, isCount = false }) {
  return (
    <div className="bg-zinc-900/30 p-5 rounded-[2rem] border border-white/5 flex flex-col gap-2 hover:bg-zinc-900/50 transition-colors group">
      <div className={`p-2.5 w-fit rounded-xl bg-black border border-white/5 shadow-inner ${color} group-hover:scale-110 transition-transform`}>{icon}</div>
      <div>
        <p className="text-[8px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-0.5">{label}</p>
        {note && <p className="text-[7px] text-zinc-700 uppercase font-bold mb-1">{note}</p>}
        <h3 className="text-xl font-black text-white italic tracking-tighter">
          {!isCount && <span className="text-[9px] mr-1 opacity-40 not-italic">UGX</span>}
          {isCount ? value : fmt(value)}
        </h3>
      </div>
    </div>
  );
}

function PhysInput({ label, value, onChange, color }) {
  return (
    <div>
      <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${color}`}>{label}</p>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-black text-lg outline-none focus:border-yellow-500/50 text-right"/>
    </div>
  );
}

function VarianceRow({ label, system, physical, variance }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5">
      <div>
        <p className="text-[9px] font-black uppercase text-zinc-500">{label}</p>
        <p className="text-[10px] text-zinc-600">Sys: {fmt(system)} · Phys: {fmt(physical)}</p>
      </div>
      <span className={`text-sm font-black italic ${variance === 0 ? "text-zinc-500" : variance > 0 ? "text-blue-400" : "text-rose-500"}`}>
        {variance >= 0 ? "+" : ""}{fmt(variance)}
      </span>
    </div>
  );
}

// ─── CREDIT ROW ───────────────────────────────────────────────────────────────
function AccountantCreditRow({ credit }) {
  return (
    <div className={`bg-zinc-900/20 border rounded-[2rem] p-5 flex items-start justify-between gap-3 flex-wrap
      ${credit.paid ? "border-emerald-500/20 opacity-70" : "border-purple-500/30"}`}>
      <div className="flex-1 min-w-0">

        {/* Table + status badge */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="font-black text-white uppercase italic tracking-tighter">{credit.table_name || "Table"}</span>
          {credit.paid
            ? <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase">Settled</span>
            : <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[9px] font-black uppercase animate-pulse">Outstanding</span>
          }
        </div>

        {/* Client details */}
        <div className="flex items-center gap-3 flex-wrap text-[10px] mb-1">
          {credit.client_name  && (
            <div className="flex items-center gap-1">
              <User size={10} className="text-zinc-600"/>
              <span className="text-zinc-300 font-bold">{credit.client_name}</span>
            </div>
          )}
          {credit.client_phone && (
            <div className="flex items-center gap-1">
              <Phone size={10} className="text-zinc-600"/>
              <span className="text-zinc-400">{credit.client_phone}</span>
            </div>
          )}
          {/* Pay-by date only shown for outstanding */}
          {!credit.paid && credit.pay_by && (
            <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
              <Calendar size={10} className="text-amber-400"/>
              <span className="text-amber-400 font-black">Pay by: {credit.pay_by}</span>
            </div>
          )}
        </div>

        {/* Settlement details for paid credits */}
        {credit.paid && credit.settle_method && (
          <p className="text-[9px] text-zinc-600 mt-1 font-mono">
            Settled via {credit.settle_method}
            {credit.settle_txn ? ` · TXN: ${credit.settle_txn}` : ""}
            {credit.paid_at    ? ` · ${toLocalDateStr(new Date(credit.paid_at))}` : ""}
          </p>
        )}

        <p className="text-[9px] text-zinc-700 mt-1">
          Approved by {credit.approved_by} · {toLocalDateStr(new Date(credit.created_at))}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-xl font-black text-purple-400 italic">UGX {fmt(credit.amount)}</p>
        {credit.paid && credit.amount_paid && Number(credit.amount_paid) !== Number(credit.amount) && (
          <p className="text-[9px] text-emerald-400 font-bold mt-0.5">Paid: UGX {fmt(credit.amount_paid)}</p>
        )}
      </div>
    </div>
  );
}

// ─── STATION CARD (View Sales) ────────────────────────────────────────────────
function StationCard({ icon, label, color, borderColor, summary, loading, tickets }) {
  const [expanded, setExpanded] = useState(false);
  const t = summary?.totals || {};

  return (
    <div className={`bg-zinc-900/30 border ${borderColor} rounded-[2.5rem] overflow-hidden`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${color.bg}`}>
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
          <div className="bg-black/40 rounded-2xl p-4">
            <p className="text-[8px] font-black uppercase text-zinc-600 mb-1">Tickets</p>
            <p className={`text-3xl font-black italic ${color.text}`}>{t.ticket_count || 0}</p>
          </div>
          <div className="bg-black/40 rounded-2xl p-4">
            <p className="text-[8px] font-black uppercase text-zinc-600 mb-1">Items</p>
            <p className={`text-3xl font-black italic ${color.text}`}>{t.total_items || 0}</p>
          </div>
          <div className="bg-black/40 rounded-2xl p-4 col-span-2">
            <p className="text-[8px] font-black uppercase text-zinc-600 mb-2">Status Breakdown</p>
            <div className="flex items-center gap-4 text-[10px] font-black uppercase">
              <span className="text-zinc-400">{t.pending_count   || 0} Pending</span>
              <span className="text-orange-400">{t.preparing_count || 0} Active</span>
              <span className="text-emerald-400">{t.completed_count || 0} Done</span>
            </div>
          </div>
        </div>
      </div>

      {/* Staff breakdown */}
      {(summary?.chefs || summary?.baristas || summary?.barmen || []).length > 0 && (
        <div className="px-6 pb-4">
          <p className="text-[8px] font-black uppercase text-zinc-600 tracking-widest mb-2">Staff Breakdown</p>
          <div className="space-y-1.5">
            {(summary?.chefs || summary?.baristas || summary?.barmen || []).map(s => {
              const name  = s.chef || s.barista || s.barman;
              const count = s.items_handled || s.drinks_made;
              return (
                <div key={name} className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full ${color.bg} ${color.text} flex items-center justify-center text-[8px] font-black`}>
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

      {/* Expandable ticket list */}
      {tickets && tickets.length > 0 && (
        <div className="px-6 pb-6">
          <button onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-[9px] font-black uppercase text-zinc-500 hover:text-white transition-colors mt-1">
            {expanded ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
            {expanded ? "Hide" : "Show"} {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
          </button>
          {expanded && (
            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
              {tickets.map(tk => (
                <div key={tk.id} className="bg-black/40 rounded-2xl p-3 flex items-center justify-between gap-2">
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

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function AccountantDashboard() {
  const { todaySummary, orders = [], setOrders } = useData() || {};

  const [activeSection,   setActiveSection]   = useState("FINANCIAL_HISTORY");
  const [mobileMenuOpen,  setMobileMenuOpen]  = useState(false);

  // ── Physical count ────────────────────────────────────────────────────────
  const [physCash,        setPhysCash]        = useState(0);
  const [physMomoMTN,     setPhysMomoMTN]     = useState(0);
  const [physMomoAirtel,  setPhysMomoAirtel]  = useState(0);
  const [physCard,        setPhysCard]        = useState(0);
  const [physNotes,       setPhysNotes]       = useState("");
  const [physSaving,      setPhysSaving]      = useState(false);
  const [physSaved,       setPhysSaved]       = useState(false);
  const [physLoading,     setPhysLoading]     = useState(false);

  // ── Credits ───────────────────────────────────────────────────────────────
  const [creditsLedger,   setCreditsLedger]   = useState([]);
  const [creditsLoading,  setCreditsLoading]  = useState(false);
  const [creditFilter,    setCreditFilter]    = useState("all");

  // ── Void requests ─────────────────────────────────────────────────────────
  const [voidRequests,        setVoidRequests]        = useState([]);
  const [voidRequestsLoading, setVoidRequestsLoading] = useState(false);

  // ── Station sales (View Sales) ────────────────────────────────────────────
  const [kitchenSummary,  setKitchenSummary]  = useState(null);
  const [baristaSummary,  setBaristaSummary]  = useState(null);
  const [barmanSummary,   setBarmanSummary]   = useState(null);
  const [salesLoading,    setSalesLoading]    = useState(false);
  const [salesDate,       setSalesDate]       = useState(kampalaDate());

  // ── Void requests polling ─────────────────────────────────────────────────
  const loadVoidRequests = useCallback(async () => {
    setVoidRequestsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/void-requests`);
      if (res.ok) setVoidRequests(await res.json());
    } catch (e) { console.error("Void requests:", e); }
    setVoidRequestsLoading(false);
  }, []);

  useEffect(() => {
    loadVoidRequests();
    const id = setInterval(loadVoidRequests, 15000);
    return () => clearInterval(id);
  }, [loadVoidRequests]);

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

  // ── Credits (always loaded so Financial History alert is live) ────────────
  useEffect(() => {
    const load = async () => {
      setCreditsLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/orders/credits`);
        if (res.ok) {
          const rows = await res.json();
          setCreditsLedger(rows.map(r => ({
            ...r,
            paid: r.paid === true || r.paid === "t" || r.paid === "true",
          })));
        }
      } catch (e) { console.error("Credits:", e); }
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
      if (brRes.status === "fulfilled" && brRes.value.ok) setBaristaSummary(await brRes.value.json());
      if (bmRes.status === "fulfilled" && bmRes.value.ok) setBarmanSummary(await bmRes.value.json());
    } catch (e) { console.error("sales:", e); }
    setSalesLoading(false);
  }, [salesDate]);

  useEffect(() => {
    if (activeSection === "VIEW_SALES") loadSales(salesDate);
  }, [activeSection, salesDate]);

  // ── Derived values ────────────────────────────────────────────────────────
  const sys = {
    cash:   Number(todaySummary?.total_cash)   || 0,
    card:   Number(todaySummary?.total_card)   || 0,
    mtn:    Number(todaySummary?.total_mtn)    || 0,
    airtel: Number(todaySummary?.total_airtel) || 0,
    credit: Number(todaySummary?.total_credit) || 0,
    mixed:  Number(todaySummary?.total_mixed)  || 0,
    gross:  Number(todaySummary?.total_gross)  || 0,
    orders: Number(todaySummary?.order_count)  || 0,
  };
  const varCash   = physCash       - sys.cash;
  const varMTN    = physMomoMTN    - sys.mtn;
  const varAirtel = physMomoAirtel - sys.airtel;
  const varCard   = physCard       - sys.card;
  const varTotal  = varCash + varMTN + varAirtel + varCard;

  const outstanding      = creditsLedger.filter(c => !c.paid);
  const settled          = creditsLedger.filter(c =>  c.paid);
  const totalOutstanding = outstanding.reduce((s,c) => s + Number(c.amount), 0);
  const totalSettled     = settled.reduce((s,c) => s + Number(c.amount_paid || c.amount), 0);
  const filteredCredits  = creditFilter === "outstanding" ? outstanding
    : creditFilter === "settled" ? settled : creditsLedger;

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

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#0a0a0a] font-[Outfit] text-slate-200">
      <SideBar
        activeSection={activeSection} setActiveSection={setActiveSection}
        isOpen={mobileMenuOpen}       setIsOpen={setMobileMenuOpen}
      />

      <div className="flex-1 flex flex-col">

        {/* ── HEADER ── */}
        <header className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 bg-zinc-900 rounded-xl text-yellow-500">
              <Menu size={20}/>
            </button>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-1 h-5 bg-yellow-500 rounded-full"/>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500/80">Accountant</h4>
              </div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">
                {activeSection.replace(/_/g," ")}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {voidRequests.length > 0 && (
              <button onClick={() => setActiveSection("LIVE_AUDIT")}
                className="flex items-center gap-2 px-3 py-2 bg-rose-500 rounded-xl animate-pulse">
                <AlertTriangle size={13} className="text-white"/>
                <span className="text-[10px] font-black text-white uppercase">{voidRequests.length} Void</span>
              </button>
            )}
          </div>
        </header>

        <main className="p-4 md:p-10 space-y-8 flex-1">

          {/* ══════════════════════════════════════════════════════
              FINANCIAL HISTORY
          ══════════════════════════════════════════════════════ */}
          {activeSection === "FINANCIAL_HISTORY" && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div>
                <h2 className="text-xl font-black text-white uppercase leading-none">Today's Revenue</h2>
                <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">Live from daily summaries — same source as all roles</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <StatCard icon={<Banknote size={18}/>}    label="Cash"        value={sys.cash}   color="text-emerald-500"/>
                <StatCard icon={<CreditCard size={18}/>}  label="Card"        value={sys.card}   color="text-blue-400"/>
                <StatCard icon={<Smartphone size={18}/>}  label="MTN Momo"    value={sys.mtn}    color="text-yellow-500"/>
                <StatCard icon={<Smartphone size={18}/>}  label="Airtel Momo" value={sys.airtel} color="text-red-500"/>
                <StatCard icon={<BookOpen size={18}/>}    label="Credits"     value={sys.credit} color="text-purple-400" note="not in gross"/>
                <StatCard icon={<Wallet size={18}/>}      label="Mixed"       value={sys.mixed}  color="text-orange-400"/>
                <StatCard icon={<Receipt size={18}/>}     label="Orders"      value={sys.orders} color="text-zinc-400" isCount/>
                <div className="bg-yellow-500 p-5 rounded-[2rem] border border-yellow-400 flex flex-col gap-2">
                  <div className="p-2.5 w-fit rounded-xl bg-black/20 text-black"><TrendingUp size={18}/></div>
                  <div>
                    <p className="text-[8px] font-black uppercase text-black/60 tracking-[0.2em] mb-1">Gross Revenue</p>
                    <h3 className="text-xl font-black text-black italic tracking-tighter">
                      <span className="text-[9px] mr-1 opacity-50 not-italic">UGX</span>{fmt(sys.gross)}
                    </h3>
                  </div>
                </div>
              </div>

             
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PHYSICAL COUNT
          ══════════════════════════════════════════════════════ */}
          {activeSection === "PHYSICAL_COUNT" && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div>
                <h2 className="text-xl font-black text-white uppercase leading-none">Physical Count</h2>
                <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">Enter actual cash/card/momo on hand — saved to database</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-zinc-900/30 border border-white/5 p-8 rounded-[2rem] space-y-5">
                  <h3 className="text-[10px] font-black uppercase text-yellow-500 tracking-widest flex items-center gap-2">
                    <Calculator size={13}/> Physical Cash Entry
                  </h3>
                  {physLoading ? (
                    <div className="h-40 animate-pulse bg-zinc-800/30 rounded-2xl"/>
                  ) : (
                    <>
                      <PhysInput label="Cash on Hand"  value={physCash}        onChange={setPhysCash}        color="text-emerald-400"/>
                      <PhysInput label="MTN Momo"       value={physMomoMTN}     onChange={setPhysMomoMTN}     color="text-yellow-400"/>
                      <PhysInput label="Airtel Momo"    value={physMomoAirtel}  onChange={setPhysMomoAirtel}  color="text-red-400"/>
                      <PhysInput label="Card / POS"     value={physCard}        onChange={setPhysCard}        color="text-blue-400"/>
                      <div>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Notes (optional)</p>
                        <textarea value={physNotes} onChange={e => setPhysNotes(e.target.value)}
                          placeholder="Any discrepancy notes..."
                          className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white text-sm outline-none focus:border-yellow-500/50 resize-none h-16"/>
                      </div>
                      <button onClick={savePhysicalCount} disabled={physSaving}
                        className={`w-full py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all
                          ${physSaved ? "bg-emerald-500 text-black" : "bg-yellow-500 text-black hover:bg-yellow-400 active:scale-[0.98]"}
                          ${physSaving ? "opacity-60 cursor-not-allowed" : ""}`}>
                        {physSaving ? "Saving…" : physSaved ? <><CheckCircle2 size={14}/> Saved!</> : <><Save size={14}/> Save Count</>}
                      </button>
                    </>
                  )}
                </div>

                <div className="bg-zinc-900/30 border border-white/5 p-8 rounded-[2rem] space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-yellow-500 tracking-widest flex items-center gap-2">
                    <TrendingUp size={13}/> Variance Analysis
                  </h3>
                  <div className="space-y-1">
                    <VarianceRow label="System Cash"   system={sys.cash}   physical={physCash}       variance={varCash}/>
                    <VarianceRow label="System MTN"    system={sys.mtn}    physical={physMomoMTN}    variance={varMTN}/>
                    <VarianceRow label="System Airtel" system={sys.airtel} physical={physMomoAirtel} variance={varAirtel}/>
                    <VarianceRow label="System Card"   system={sys.card}   physical={physCard}       variance={varCard}/>
                  </div>
                  <div className={`mt-2 p-6 rounded-2xl border transition-all
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
                  {/* System reference */}
                  <div className="pt-4 border-t border-white/5 space-y-2">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">System Totals (reference)</p>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      {[["Cash","emerald",sys.cash],["MTN","yellow",sys.mtn],["Airtel","red",sys.airtel],["Card","blue",sys.card]].map(([lbl,col,val]) => (
                        <div key={lbl} className="bg-black/40 rounded-xl p-3">
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
              LIVE AUDIT
          ══════════════════════════════════════════════════════ */}
          {activeSection === "LIVE_AUDIT" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white uppercase leading-none">Live Audit</h2>
                  <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">Void requests from waiters — approve or reject</p>
                </div>
                <button onClick={loadVoidRequests}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-white/5 rounded-2xl text-[10px] font-black text-zinc-400 uppercase hover:text-white transition-colors">
                  <RefreshCw size={12} className={voidRequestsLoading ? "animate-spin" : ""}/> Refresh
                </button>
              </div>

              {voidRequestsLoading && voidRequests.length === 0 ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_,i) => <div key={i} className="h-28 rounded-[2rem] bg-zinc-900/30 animate-pulse border border-white/5"/>)}
                </div>
              ) : voidRequests.length === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-zinc-900/10">
                  <CheckCircle2 size={32} className="mx-auto text-zinc-700 mb-4"/>
                  <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest italic">No pending void requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {voidRequests.map(vr => (
                    <div key={vr.id} className="bg-zinc-900/30 border border-rose-500/20 p-5 rounded-[2rem] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 bg-rose-500/20 rounded-2xl flex items-center justify-center text-rose-400 shrink-0">
                          <AlertTriangle size={18}/>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-black text-white uppercase text-sm italic">{vr.item_name}</p>
                            <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-400 text-[9px] font-black uppercase border border-white/5">
                              {vr.table_name || "Unknown Table"}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500">
                            Waiter: <span className="text-white font-bold">{vr.waiter_name || vr.requested_by}</span>
                            <span className="mx-2 text-zinc-700">·</span>
                            {new Date(vr.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                          </p>
                          <p className="text-[10px] text-rose-400 italic mt-0.5">"{vr.reason}"</p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => approveVoid(vr.id)}
                          className="bg-rose-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase hover:bg-rose-500 transition-all">Approve</button>
                        <button onClick={() => rejectVoid(vr.id)}
                          className="bg-zinc-800 text-zinc-400 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase border border-white/5 hover:bg-zinc-700 transition-all">Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              CREDITS
          ══════════════════════════════════════════════════════ */}
          {activeSection === "CREDITS" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div>
                <h2 className="text-xl font-black text-white uppercase leading-none">Credits Ledger</h2>
                <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">All on-account orders — outstanding and settled</p>
              </div>

              {/* Summary tiles */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-zinc-900/30 border border-white/5 p-5 rounded-[2rem]">
                  <div className="p-2.5 w-fit bg-purple-500/10 rounded-xl text-purple-400 mb-3"><BookOpen size={16}/></div>
                  <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Outstanding</p>
                  <h3 className="text-xl font-black text-purple-400 italic">UGX {fmt(totalOutstanding)}</h3>
                  <p className="text-[9px] text-zinc-600 mt-0.5">{outstanding.length} client{outstanding.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="bg-zinc-900/30 border border-white/5 p-5 rounded-[2rem]">
                  <div className="p-2.5 w-fit bg-emerald-500/10 rounded-xl text-emerald-400 mb-3"><CheckCircle2 size={16}/></div>
                  <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Settled</p>
                  <h3 className="text-xl font-black text-emerald-400 italic">UGX {fmt(totalSettled)}</h3>
                  <p className="text-[9px] text-zinc-600 mt-0.5">{settled.length} record{settled.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="bg-yellow-500 p-5 rounded-[2rem] col-span-2 md:col-span-1">
                  <div className="p-2.5 w-fit bg-black/20 rounded-xl text-black mb-3"><Receipt size={16}/></div>
                  <p className="text-[8px] font-black uppercase text-black/60 tracking-widest mb-1">All Time Credits</p>
                  <h3 className="text-xl font-black text-black italic">UGX {fmt(totalOutstanding + totalSettled)}</h3>
                  <p className="text-[9px] text-black/50 mt-0.5">{creditsLedger.length} total entries</p>
                </div>
              </div>

              {/* Filter tabs */}
              <div className="flex gap-1 p-1 bg-zinc-900 rounded-2xl w-fit">
                {[{key:"all",label:"All"},{key:"outstanding",label:"Outstanding"},{key:"settled",label:"Settled"}].map(({key,label}) => (
                  <button key={key} onClick={() => setCreditFilter(key)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                      ${creditFilter === key ? "bg-yellow-500 text-black" : "text-zinc-500 hover:text-zinc-300"}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Credits list */}
              {creditsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_,i) => <div key={i} className="h-24 rounded-[2rem] bg-zinc-900/30 animate-pulse border border-white/5"/>)}
                </div>
              ) : filteredCredits.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
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
                  <h2 className="text-xl font-black text-white uppercase leading-none">Station Sales</h2>
                  <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">Kitchen · Barista · Bar — daily output per station</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="date" value={salesDate}
                    onChange={e => setSalesDate(e.target.value)}
                    className="bg-zinc-900 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-xs font-bold outline-none focus:border-yellow-500/50"/>
                  <button onClick={() => loadSales(salesDate)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-white/5 rounded-2xl text-[10px] font-black text-zinc-400 uppercase hover:text-white transition-colors">
                    <RefreshCw size={12} className={salesLoading ? "animate-spin" : ""}/> Refresh
                  </button>
                </div>
              </div>

              {/* Combined total banner */}
              {(kitchenSummary || baristaSummary || barmanSummary) && (() => {
                const totalTickets = [kitchenSummary, baristaSummary, barmanSummary]
                  .reduce((s,d) => s + Number(d?.totals?.ticket_count || 0), 0);
                const totalItems   = [kitchenSummary, baristaSummary, barmanSummary]
                  .reduce((s,d) => s + Number(d?.totals?.total_items   || 0), 0);
                const totalDone    = [kitchenSummary, baristaSummary, barmanSummary]
                  .reduce((s,d) => s + Number(d?.totals?.completed_count || 0), 0);
                return (
                  <div className="bg-yellow-500 rounded-[2rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
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

              {/* Three station cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <StationCard
                  icon={<ChefHat size={22}/>} label="Kitchen"
                  color={{ text: "text-yellow-400", bg: "bg-yellow-500/10" }}
                  borderColor="border-yellow-500/20"
                  summary={kitchenSummary} loading={salesLoading}
                  tickets={kitchenSummary?.tickets || []}
                />
                <StationCard
                  icon={<Coffee size={22}/>} label="Barista"
                  color={{ text: "text-orange-400", bg: "bg-orange-500/10" }}
                  borderColor="border-orange-500/20"
                  summary={baristaSummary} loading={salesLoading}
                  tickets={baristaSummary?.tickets || []}
                />
                <StationCard
                  icon={<Wine size={22}/>} label="Bar"
                  color={{ text: "text-blue-400", bg: "bg-blue-500/10" }}
                  borderColor="border-blue-500/20"
                  summary={barmanSummary} loading={salesLoading}
                  tickets={barmanSummary?.tickets || []}
                />
              </div>

              {!salesLoading && !kitchenSummary && !baristaSummary && !barmanSummary && (
                <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                  <BarChart3 size={40} className="mx-auto text-zinc-700 mb-4"/>
                  <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">No station data for {salesDate}</p>
                  <p className="text-zinc-700 text-[9px] mt-2">Orders must pass through a station for tickets to be recorded</p>
                </div>
              )}
            </div>
          )}

        </main>
        <Footer/>
      </div>
    </div>
  );
}