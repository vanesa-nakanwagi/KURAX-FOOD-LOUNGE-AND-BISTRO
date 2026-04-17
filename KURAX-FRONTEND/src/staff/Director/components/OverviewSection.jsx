import React, { useState, useEffect } from "react";
import { TrendingUp, Banknote, Smartphone, CreditCard, BookOpen, CheckCircle2, Clock, User, Phone, ChevronDown, ChevronUp, Wallet, Trash2, PlusCircle, RefreshCw, Hourglass, XCircle } from "lucide-react";
import { useTheme } from "./shared/ThemeContext";
import { StatCard, ShiftMiniCard, fmtK } from "./shared/UIHelpers";
import LiveLogs from "./liveLogs";
import { RevenueChart } from "../charts";
import API_URL from "../../../config/api";

// ─── Petty categories (same list as cashier) ─────────────────────────────────
const PETTY_CATEGORIES = [
  "General","Charcoal/Fuel","Groceries/Ingredients","Cleaning Supplies",
  "Utilities","Maintenance","Transport","Staff Welfare","Packaging","Miscellaneous",
];

// ─── CREDIT STATUS BADGE ────────────────────────────────────────────────────
function CreditStatusBadge({ status }) {
  const normalizedStatus = String(status || '').toLowerCase();
  
  const statusMap = {
    'pendingcashier': { label: 'Wait for Cashier', icon: <Hourglass size={10} />, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    'pendingmanagerapproval': { label: 'Wait for Manager', icon: <Clock size={10} />, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    'approved': { label: 'Approved', icon: <CheckCircle2 size={10} />, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    'fullysettled': { label: 'Settled', icon: <CheckCircle2 size={10} />, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    'partiallysettled': { label: 'Partially Settled', icon: <CheckCircle2 size={10} />, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    'rejected': { label: 'Rejected', icon: <XCircle size={10} />, color: 'bg-red-500/20 text-red-400 border-red-500/30' }
  };
  
  const config = statusMap[normalizedStatus] || { 
    label: status || 'Unknown', 
    icon: <BookOpen size={10} />, 
    color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' 
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase ${config.color}`}>
      {config.icon} {config.label}
    </span>
  );
}

export default function OverviewSection({ onViewRegistry }) {
  const { dark, t } = useTheme();

  const [summary,        setSummary]    = useState(null);
  const [summaryLoading, setSumLoad]    = useState(true);

  const [shifts,         setShifts]     = useState([]);
  const [shiftsLoading,  setShiftsLoad] = useState(true);

  // Credits ledger - FIXED to use proper API endpoint
  const [creditsLedger,   setCreditsLedger]   = useState([]);
  const [creditsLoading,  setCreditsLoading]  = useState(true);
  const [creditsExpanded, setCreditsExpanded] = useState(false);
  const [creditFilter,    setCreditFilter]    = useState("all");

  // ── Petty cash (director read + log) ────────────────────────────────────────
  const [pettyData,       setPettyData]       = useState({ total_out: 0, total_in: 0, net: 0, entries: [] });
  const [pettyLoading,    setPettyLoading]    = useState(true);
  const [pettyExpanded,   setPettyExpanded]   = useState(false);
  const [pettyFilter,     setPettyFilter]     = useState("all");   // "all" | "OUT" | "IN"
  const [showPettyModal,  setShowPettyModal]  = useState(false);
  const [savingPetty,     setSavingPetty]     = useState(false);
  const [deletingPettyId, setDeletingPettyId] = useState(null);

  // Director shift detail modal
  const [selectedShift, setSelectedShift] = useState(null);

  // Petty form state
  const [pettyDirection,   setPettyDirection]   = useState("OUT");
  const [pettyAmount,      setPettyAmount]      = useState("");
  const [pettyCategory,    setPettyCategory]    = useState("General");
  const [pettyDescription, setPettyDescription] = useState("");

  // BUG FIX: was UTC — wrong date before 3am Kampala time
  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" })
  ).toISOString().split("T")[0];

  // ── Helper to normalize credit status ───────────────────────────────────────
  const getNormalizedStatus = (status) => {
    if (!status) return 'unknown';
    const s = String(status).toLowerCase();
    if (s === 'pendingcashier') return 'pendingCashier';
    if (s === 'pendingmanagerapproval') return 'pendingManager';
    if (s === 'approved') return 'approved';
    if (s === 'fullysettled') return 'settled';
    if (s === 'partiallysettled') return 'settled';
    if (s === 'rejected') return 'rejected';
    return s;
  };

  // ── Fetchers ─────────────────────────────────────────────────────────────────
  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API_URL}/api/summaries/today`);
      if (res.ok) setSummary(await res.json());
    } catch (e) { console.error("Summary fetch failed:", e); }
    finally { setSumLoad(false); }
  };

  // FIXED: Use the correct API endpoint for credits
  const fetchCredits = async () => {
    try {
      const res = await fetch(`${API_URL}/api/cashier-ops/credits`);
      if (res.ok) {
        const rows = await res.json();
        setCreditsLedger(rows);
      }
    } catch (e) { console.error("Credits fetch failed:", e); }
    finally { setCreditsLoading(false); }
  };

  const fetchPetty = async () => {
    try {
      const res = await fetch(`${API_URL}/api/summaries/petty-cash`);
      if (res.ok) setPettyData(await res.json());
    } catch (e) { console.error("Petty fetch failed:", e); }
    finally { setPettyLoading(false); }
  };

  useEffect(() => {
    fetchSummary();
    fetchCredits();
    fetchPetty();

    const summaryInterval = setInterval(fetchSummary, 10000);
    const creditsInterval = setInterval(fetchCredits, 30000);
    const pettyInterval   = setInterval(fetchPetty,   30000);

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/overview/shifts?date=${today}`);
        if (res.ok) setShifts(await res.json());
      } catch (e) { console.error("Shifts fetch failed:", e); }
      finally { setShiftsLoad(false); }
    })();

    return () => {
      clearInterval(summaryInterval);
      clearInterval(creditsInterval);
      clearInterval(pettyInterval);
    };
  }, [today]);

  // ── Petty handlers ──────────────────────────────────────────────────────────
  const handlePettyAdd = async () => {
    const amt = Number(pettyAmount);
    if (!amt || amt <= 0 || !pettyDescription.trim()) return;
    setSavingPetty(true);
    try {
      const loggedInUser = JSON.parse(localStorage.getItem("kurax_user") || "{}");
      const res = await fetch(`${API_URL}/api/summaries/petty-cash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount:      amt,
          direction:   pettyDirection,
          category:    pettyCategory,
          description: pettyDescription.trim(),
          logged_by:   loggedInUser?.name || "Director",
        }),
      });
      if (res.ok) {
        setPettyAmount(""); setPettyDescription(""); setPettyCategory("General"); setPettyDirection("OUT");
        setShowPettyModal(false);
        await fetchPetty();
        await fetchSummary();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save");
      }
    } catch (e) { console.error("Petty save failed:", e); }
    setSavingPetty(false);
  };

  const handlePettyDelete = async (id) => {
    setDeletingPettyId(id);
    try {
      await fetch(`${API_URL}/api/summaries/petty-cash/${id}`, { method: "DELETE" });
      await fetchPetty();
      await fetchSummary();
    } catch (e) { console.error("Petty delete failed:", e); }
    setDeletingPettyId(null);
  };

  // ── FIXED: Credit statistics with proper status separation ──────────────────
  const creditStats = {
    pendingCashier: creditsLedger.filter(c => getNormalizedStatus(c.status) === 'pendingCashier').length,
    pendingManager: creditsLedger.filter(c => getNormalizedStatus(c.status) === 'pendingManager').length,
    approved: creditsLedger.filter(c => getNormalizedStatus(c.status) === 'approved').length,
    settled: creditsLedger.filter(c => getNormalizedStatus(c.status) === 'settled').length,
    rejected: creditsLedger.filter(c => getNormalizedStatus(c.status) === 'rejected').length,
  };

  const pendingCashierCredits = creditsLedger.filter(c => getNormalizedStatus(c.status) === 'pendingCashier');
  const pendingManagerCredits = creditsLedger.filter(c => getNormalizedStatus(c.status) === 'pendingManager');
  const approvedCredits = creditsLedger.filter(c => getNormalizedStatus(c.status) === 'approved');
  const settledCredits = creditsLedger.filter(c => getNormalizedStatus(c.status) === 'settled');
  const rejectedCredits = creditsLedger.filter(c => getNormalizedStatus(c.status) === 'rejected');

  const totalOutstanding = [...pendingCashierCredits, ...pendingManagerCredits, ...approvedCredits]
    .reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalSettled = settledCredits.reduce((s, c) => s + Number(c.amount_paid || c.amount || 0), 0);
  const totalRejected = rejectedCredits.reduce((s, c) => s + Number(c.amount || 0), 0);

  // Filter credits based on selected tab
  const getFilteredCredits = () => {
    switch (creditFilter) {
      case 'pendingCashier': return pendingCashierCredits;
      case 'pendingManager': return pendingManagerCredits;
      case 'approved': return approvedCredits;
      case 'settled': return settledCredits;
      case 'rejected': return rejectedCredits;
      default: return creditsLedger;
    }
  };

  const filteredCredits = getFilteredCredits();

  // REVENUE - NOT deducted by petty expenses
  const totalGross  = Number(summary?.total_gross  ?? 0);
  const totalCash   = Number(summary?.total_cash   ?? 0);
  const totalCard   = Number(summary?.total_card   ?? 0);
  const totalMTN    = Number(summary?.total_mtn    ?? 0);
  const totalAirtel = Number(summary?.total_airtel ?? 0);
  const totalMomo   = totalMTN + totalAirtel;
  const orderCount  = Number(summary?.order_count  ?? 0);

  // PETTY CASH - separate tracking (does NOT affect revenue)
  const pettyOut = Number(pettyData.total_out ?? 0);
  const pettyIn = Number(pettyData.total_in ?? 0);
  const pettyNet = pettyIn - pettyOut;

  // Cash on Hand = Gross cash collected (NO deduction)
  const cashOnHand = totalCash;
  
  // Net Revenue = Gross revenue (NO deduction - petty is separate expense)
  const netRevenue = totalGross;

  const pettyEntries = pettyData.entries || [];
  const filteredPetty = pettyFilter === "OUT" ? pettyEntries.filter(e => e.direction === "OUT")
                      : pettyFilter === "IN"  ? pettyEntries.filter(e => e.direction === "IN")
                      : pettyEntries;

  // Credit tabs configuration
  const creditTabs = [
    { key: "all", label: "All", count: creditsLedger.length, color: "zinc" },
    { key: "pendingCashier", label: "Wait for Cashier", count: creditStats.pendingCashier, color: "yellow" },
    { key: "pendingManager", label: "Wait for Manager", count: creditStats.pendingManager, color: "orange" },
    { key: "approved", label: "Approved", count: creditStats.approved, color: "purple" },
    { key: "settled", label: "Settled", count: creditStats.settled, color: "green" },
    { key: "rejected", label: "Rejected", count: creditStats.rejected, color: "red" },
  ];

  return (
    <div className="space-y-4">

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Gross Revenue"
          value={summaryLoading ? null : netRevenue}
          trend={orderCount > 0 ? `${orderCount} orders` : null}
          color="text-emerald-500"
          icon={<TrendingUp size={12} />}
          loading={summaryLoading}
        />
        <StatCard
          label="Cash on Hand"
          value={summaryLoading ? null : cashOnHand}
          trend={pettyOut > 0 ? `${fmtK(pettyOut)} expenses` : null}
          color="text-white"
          icon={<Banknote size={12} />}
          loading={summaryLoading}
        />
        <StatCard
          label="MoMo"
          value={summaryLoading ? null : totalMomo}
          trend={totalMTN > 0 && totalAirtel > 0
            ? `MTN ${fmtK(totalMTN)} · Airtel ${fmtK(totalAirtel)}`
            : null}
          color="text-yellow-500"
          icon={<Smartphone size={12} />}
          loading={summaryLoading}
        />
        <StatCard
          label="Card"
          value={summaryLoading ? null : totalCard}
          color="text-blue-500"
          icon={<CreditCard size={12} />}
          loading={summaryLoading}
        />
      </div>

      {/* ── PETTY CASH LEDGER PANEL ─────────────────────────────────────────── */}
      <div className={`${t.card} border rounded-2xl overflow-hidden`}>
        <button
          onClick={() => setPettyExpanded(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <Wallet size={14}/>
            </div>
            <div className="text-left">
              <p className={`text-[10px] font-black uppercase tracking-widest ${t.subtext}`}>Petty Cash Ledger</p>
              <p className="text-[9px] text-zinc-600 mt-0.5">
                {pettyEntries.length} entries today ·{" "}
                <span className="text-rose-400 font-bold">OUT {fmtK(pettyOut)}</span>
                {pettyIn > 0 &&
                  <span className="text-emerald-400 font-bold"> · IN {fmtK(pettyIn)}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {pettyOut > 0 && (
              <span className="px-3 py-1 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase">
                −UGX {fmtK(pettyOut)} today
              </span>
            )}
            {pettyExpanded ? <ChevronUp size={14} className="text-zinc-500"/> : <ChevronDown size={14} className="text-zinc-500"/>}
          </div>
        </button>

        {pettyExpanded && (
          <div className={`border-t px-5 pb-5 pt-4 space-y-4 ${dark ? "border-white/5" : "border-black/5"}`}>
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3">
              <div className={`${dark ? "bg-black/40" : "bg-zinc-50"} rounded-2xl p-4`}>
                <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Total OUT</p>
                <p className="text-rose-400 font-black text-base">{fmtK(pettyOut)}</p>
                <p className="text-[9px] text-zinc-600">{pettyEntries.filter(e => e.direction === "OUT").length} entries</p>
              </div>
              <div className={`${dark ? "bg-black/40" : "bg-zinc-50"} rounded-2xl p-4`}>
                <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Total IN</p>
                <p className="text-emerald-400 font-black text-base">{fmtK(pettyIn)}</p>
                <p className="text-[9px] text-zinc-600">{pettyEntries.filter(e => e.direction === "IN").length} entries</p>
              </div>
              <div className={`rounded-2xl p-4 ${pettyNet >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
                <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Net</p>
                <p className={`font-black text-base ${pettyNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {pettyNet >= 0 ? "+" : ""}UGX {Math.abs(pettyNet).toLocaleString()}
                </p>
                <p className="text-[9px] text-zinc-600">IN − OUT</p>
              </div>
            </div>

            {/* Filter + Add button */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-1 p-1 rounded-xl w-fit" style={{background: dark ? "#18181b" : "#f4f4f5"}}>
                {[{k:"all",l:"All"},{k:"OUT",l:"Expenses"},{k:"IN",l:"Cash In"}].map(({k,l}) => (
                  <button key={k} onClick={() => setPettyFilter(k)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                      ${pettyFilter === k ? "bg-yellow-500 text-black shadow" : dark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-700"}`}>
                    {l}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPettyModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-black rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-yellow-400 transition-all">
                <PlusCircle size={12}/> Log Entry
              </button>
            </div>

            {/* Entries list */}
            {pettyLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className={`h-14 rounded-2xl animate-pulse ${dark ? "bg-zinc-800" : "bg-zinc-100"}`}/>)}
              </div>
            ) : filteredPetty.length === 0 ? (
              <div className={`py-10 text-center border-2 border-dashed rounded-2xl ${dark ? "border-white/5" : "border-zinc-200"}`}>
                <Wallet size={22} className="mx-auto mb-2 text-zinc-600"/>
                <p className={`text-[9px] font-black uppercase tracking-widest ${dark ? "text-zinc-600" : "text-zinc-400"}`}>
                  No entries today
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPetty.map(entry => (
                  <div key={entry.id}
                    className={`rounded-2xl p-4 border flex items-center justify-between gap-3 group transition-all
                      ${entry.direction === "OUT"
                        ? dark ? "bg-zinc-900/40 border-white/5" : "bg-zinc-50 border-zinc-200"
                        : dark ? "bg-emerald-500/5 border-emerald-500/15" : "bg-emerald-50 border-emerald-200"}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-xl shrink-0 ${entry.direction === "OUT"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}>
                        <Wallet size={13}/>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-xs font-black uppercase italic truncate ${dark ? "text-white" : "text-zinc-900"}`}>
                            {entry.description}
                          </p>
                          <span className={`text-[8px] px-2 py-0.5 rounded-lg font-black uppercase shrink-0
                            ${dark ? "bg-white/5 border border-white/5 text-zinc-500" : "bg-zinc-100 border border-zinc-200 text-zinc-500"}`}>
                            {entry.category}
                          </span>
                        </div>
                        <p className={`text-[9px] mt-0.5 ${dark ? "text-zinc-600" : "text-zinc-400"}`}>
                          {entry.logged_by} · {new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className={`text-sm font-black italic ${entry.direction === "OUT" ? "text-rose-400" : "text-emerald-400"}`}>
                        {entry.direction === "OUT" ? "−" : "+"}UGX {Number(entry.amount).toLocaleString()}
                      </p>
                      <button
                        onClick={() => handlePettyDelete(entry.id)}
                        disabled={deletingPettyId === entry.id}
                        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all disabled:opacity-30">
                        {deletingPettyId === entry.id
                          ? <RefreshCw size={13} className="animate-spin"/>
                          : <Trash2 size={13}/>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CREDITS LEDGER PANEL - FIXED with proper status tabs ── */}
      <div className={`${t.card} border rounded-2xl overflow-hidden`}>
        <button
          onClick={() => setCreditsExpanded(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <BookOpen size={14}/>
            </div>
            <div className="text-left">
              <p className={`text-[10px] font-black uppercase tracking-widest ${t.subtext}`}>Credits Ledger</p>
              <p className="text-[9px] text-zinc-600 mt-0.5">
                {creditsLedger.length} total ·{" "}
                <span className="text-yellow-400 font-bold">{creditStats.pendingCashier} wait cashier</span>
                {creditStats.pendingManager > 0 && <span className="text-orange-400 font-bold"> · {creditStats.pendingManager} wait manager</span>}
                {creditStats.approved > 0 && <span className="text-purple-400 font-bold"> · {creditStats.approved} approved</span>}
                {creditStats.settled > 0 && <span className="text-emerald-400 font-bold"> · {creditStats.settled} settled</span>}
                {creditStats.rejected > 0 && <span className="text-red-400 font-bold"> · {creditStats.rejected} rejected</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {totalOutstanding > 0 && (
              <span className="px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase">
                UGX {fmtK(totalOutstanding)} pending
              </span>
            )}
            {creditsExpanded ? <ChevronUp size={14} className="text-zinc-500"/> : <ChevronDown size={14} className="text-zinc-500"/>}
          </div>
        </button>

        {creditsExpanded && (
          <div className={`border-t px-5 pb-5 pt-4 space-y-4 ${dark ? "border-white/5" : "border-black/5"}`}>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className={`${dark ? "bg-yellow-500/10 border-yellow-500/20" : "bg-yellow-50 border-yellow-200"} rounded-2xl p-3 border`}>
                <p className="text-[7px] font-black uppercase text-yellow-400">Wait for Cashier</p>
                <p className="text-xl font-black text-yellow-400">{creditStats.pendingCashier}</p>
                <p className="text-[8px] text-zinc-500">UGX {pendingCashierCredits.reduce((s,c)=>s+Number(c.amount||0),0).toLocaleString()}</p>
              </div>
              <div className={`${dark ? "bg-orange-500/10 border-orange-500/20" : "bg-orange-50 border-orange-200"} rounded-2xl p-3 border`}>
                <p className="text-[7px] font-black uppercase text-orange-400">Wait for Manager</p>
                <p className="text-xl font-black text-orange-400">{creditStats.pendingManager}</p>
                <p className="text-[8px] text-zinc-500">UGX {pendingManagerCredits.reduce((s,c)=>s+Number(c.amount||0),0).toLocaleString()}</p>
              </div>
              <div className={`${dark ? "bg-purple-500/10 border-purple-500/20" : "bg-purple-50 border-purple-200"} rounded-2xl p-3 border`}>
                <p className="text-[7px] font-black uppercase text-purple-400">Approved</p>
                <p className="text-xl font-black text-purple-400">{creditStats.approved}</p>
                <p className="text-[8px] text-zinc-500">UGX {approvedCredits.reduce((s,c)=>s+Number(c.amount||0),0).toLocaleString()}</p>
              </div>
              <div className={`${dark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"} rounded-2xl p-3 border`}>
                <p className="text-[7px] font-black uppercase text-emerald-400">Settled</p>
                <p className="text-xl font-black text-emerald-400">{creditStats.settled}</p>
                <p className="text-[8px] text-zinc-500">UGX {totalSettled.toLocaleString()}</p>
              </div>
              <div className={`${dark ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200"} rounded-2xl p-3 border`}>
                <p className="text-[7px] font-black uppercase text-red-400">Rejected</p>
                <p className="text-xl font-black text-red-400">{creditStats.rejected}</p>
                <p className="text-[8px] text-zinc-500">UGX {totalRejected.toLocaleString()}</p>
              </div>
            </div>

            {/* Credit Tabs */}
            <div className="flex flex-wrap gap-1 p-1 rounded-xl w-fit" style={{background: dark ? "#18181b" : "#f4f4f5"}}>
              {creditTabs.map(({ key, label, count, color }) => {
                let activeColor = "";
                if (creditFilter === key) {
                  if (color === 'yellow') activeColor = "bg-yellow-500 text-black";
                  else if (color === 'orange') activeColor = "bg-orange-500 text-white";
                  else if (color === 'purple') activeColor = "bg-purple-500 text-white";
                  else if (color === 'green') activeColor = "bg-emerald-500 text-white";
                  else if (color === 'red') activeColor = "bg-red-500 text-white";
                  else activeColor = "bg-yellow-500 text-black";
                }
                return (
                  <button key={key} onClick={() => setCreditFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                      ${creditFilter === key ? activeColor : dark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-700"}`}>
                    {label}
                    {count > 0 && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[8px] font-black ${creditFilter === key ? "bg-white/20" : dark ? "bg-white/10" : "bg-black/5"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {creditsLoading ? (
              <div className="space-y-2">
                {[1,2].map(i => <div key={i} className={`h-16 rounded-2xl animate-pulse ${dark ? "bg-zinc-800" : "bg-zinc-100"}`}/>)}
              </div>
            ) : filteredCredits.length === 0 ? (
              <div className={`py-10 text-center border-2 border-dashed rounded-2xl ${dark ? "border-white/5" : "border-zinc-200"}`}>
                <BookOpen size={24} className="mx-auto mb-2 text-zinc-600"/>
                <p className={`text-[9px] font-black uppercase tracking-widest ${dark ? "text-zinc-600" : "text-zinc-400"}`}>
                  No {creditFilter} credits
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCredits.map(credit => (
                  <DirectorCreditRow key={credit.id} credit={credit} dark={dark} t={t} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Revenue Chart */}
      <div className={`${t.card} border rounded-2xl p-4 md:p-8`}>
        <h3 className={`text-xs font-black uppercase italic mb-3 tracking-widest ${t.subtext}`}>Revenue Flow</h3>
        <div className="w-full overflow-hidden"><RevenueChart /></div>
      </div>

      {/* ── LIVE ACTIVITY FEED ── */}
      <div className={`${t.card} border rounded-2xl p-4 md:p-6`} style={{ minHeight: 480 }}>
        <LiveLogs dark={dark} t={t} />
      </div>

      {/* Shift Liquidations */}
      <div className={`${t.card} border rounded-2xl p-4 md:p-8`}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className={`text-xs font-black uppercase italic tracking-widest ${t.subtext}`}>Shift Liquidations</h3>
            <p className={`text-[8px] font-bold uppercase ${dark ? "text-zinc-600" : "text-zinc-400"}`}>Final tallies</p>
          </div>
          <button onClick={onViewRegistry}
            className="text-[9px] font-black text-yellow-500 border border-yellow-500/20 px-3 py-1.5 rounded-xl hover:bg-yellow-500 hover:text-black transition-all shrink-0">
            REGISTRY
          </button>
        </div>
        {shiftsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1,2,3].map(i => <div key={i} className={`h-16 rounded-xl animate-pulse ${dark ? "bg-zinc-800" : "bg-zinc-100"}`}/>)}
          </div>
        ) : shifts.length === 0 ? (
          <div className={`py-10 text-center border border-dashed rounded-2xl ${dark ? "border-white/5" : "border-zinc-200"}`}>
            <p className={`text-[9px] font-black uppercase italic tracking-widest ${dark ? "text-zinc-600" : "text-zinc-400"}`}>No shifts ended today</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {shifts.map((shift, i) => {
              const isServiceRole = ["CHEF","BARISTA","BARMAN"].includes(shift.role?.toUpperCase());
              return (
                <div
                  key={shift.id ?? i}
                  onClick={() => setSelectedShift(shift)}
                  className="cursor-pointer group"
                >
                  <ShiftMiniCard
                    staff={`${shift.staff_name} (${shift.role})`}
                    time={shift.clock_out
                      ? new Date(shift.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "--:--"}
                    type={isServiceRole ? "service" : "cashier"}
                    status={isServiceRole ? shift.status ?? "" : undefined}
                    cash={isServiceRole ? undefined : fmtK(shift.total_cash)}
                    momo={isServiceRole ? undefined : fmtK((Number(shift.total_mtn||0) + Number(shift.total_airtel||0)))}
                    card={isServiceRole ? undefined : fmtK(shift.total_card)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PETTY CASH ADD MODAL ── */}
      {showPettyModal && (
        <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl space-y-5 border
            ${dark ? "bg-[#111] border-white/10" : "bg-white border-zinc-200"}`}>
            {/* Modal content - same as before */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black italic uppercase text-yellow-500 tracking-widest">New Petty Entry</h3>
              <button onClick={() => setShowPettyModal(false)}
                className={`p-1.5 rounded-full text-zinc-500 hover:text-white ${dark ? "bg-zinc-900" : "bg-zinc-100"}`}>
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "OUT", label: "Expense (OUT)", color: "bg-rose-500/20 border-rose-500/40 text-rose-300" },
                { key: "IN",  label: "Cash IN",       color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" },
              ].map(({ key, label, color }) => (
                <button key={key} onClick={() => setPettyDirection(key)}
                  className={`py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all
                    ${pettyDirection === key ? color : "border-white/5 text-zinc-500 hover:border-white/20"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${dark ? "text-zinc-500" : "text-zinc-400"}`}>Category</p>
              <select value={pettyCategory} onChange={e => setPettyCategory(e.target.value)}
                className={`w-full rounded-2xl p-3 text-xs font-bold outline-none border
                  ${dark ? "bg-black border-white/10 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-800"}`}>
                {PETTY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${dark ? "text-zinc-500" : "text-zinc-400"}`}>Description</p>
              <input value={pettyDescription} onChange={e => setPettyDescription(e.target.value)}
                placeholder="e.g. Bought charcoal for grill"
                className={`w-full rounded-xl p-4 text-xs outline-none border
                  ${dark ? "bg-black border-white/5 text-white focus:border-yellow-500/50" : "bg-zinc-50 border-zinc-200 text-zinc-800"}`}/>
            </div>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${dark ? "text-zinc-500" : "text-zinc-400"}`}>Amount (UGX)</p>
              <input type="number" value={pettyAmount} onChange={e => setPettyAmount(e.target.value)}
                placeholder="0"
                className={`w-full rounded-xl p-4 text-white font-black text-lg text-center outline-none border
                  ${dark ? "bg-black border-white/5 focus:border-yellow-500/50" : "bg-zinc-50 border-zinc-200 text-zinc-800"}`}/>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPettyModal(false)}
                className="flex-1 py-4 text-zinc-500 font-black text-[10px] uppercase">Discard</button>
              <button onClick={handlePettyAdd}
                disabled={savingPetty || !pettyAmount || !pettyDescription.trim()}
                className={`flex-[2] py-4 rounded-2xl font-black text-xs uppercase transition-all
                  ${!savingPetty && pettyAmount && pettyDescription.trim()
                    ? "bg-yellow-500 text-black hover:bg-yellow-400 active:scale-[0.98]"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}>
                {savingPetty ? "Saving…" : "Post Entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SHIFT DETAIL MODAL ── */}
      {selectedShift && (
        <ShiftDetailModal shift={selectedShift} dark={dark} onClose={() => setSelectedShift(null)} />
      )}
    </div>
  );
}

// ─── DIRECTOR CREDIT ROW - FIXED with proper status badge ────────────────────
function DirectorCreditRow({ credit, dark, t }) {
  const toLocalDateStr = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
  };
  
  const isSettled = credit.status === "FullySettled" || credit.status === "PartiallySettled";
  const isRejected = credit.status === "Rejected";
  const displayAmount = isSettled ? (credit.amount_paid || credit.amount) : credit.amount;
  
  return (
    <div className={`rounded-2xl p-4 border flex items-start justify-between gap-3 flex-wrap transition-all
      ${isSettled
        ? dark ? "bg-emerald-500/5 border-emerald-500/15 opacity-70" : "bg-emerald-50 border-emerald-200 opacity-80"
        : isRejected
        ? dark ? "bg-red-500/5 border-red-500/15" : "bg-red-50 border-red-200"
        : dark ? "bg-purple-500/5 border-purple-500/20" : "bg-purple-50 border-purple-200"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`font-black text-sm uppercase italic tracking-tighter ${dark ? "text-white" : "text-zinc-900"}`}>
            {credit.table_name || "Table"}
          </span>
          <CreditStatusBadge status={credit.status} />
        </div>
        <div className="flex items-center gap-3 flex-wrap text-[9px]">
          {credit.client_name  && <span className="flex items-center gap-1"><User size={9} className="text-zinc-500"/><span className={dark ? "text-zinc-300" : "text-zinc-700"}>{credit.client_name}</span></span>}
          {credit.client_phone && <span className="flex items-center gap-1"><Phone size={9} className="text-zinc-500"/><span className={dark ? "text-zinc-400" : "text-zinc-500"}>{credit.client_phone}</span></span>}
          {!isSettled && !isRejected && credit.pay_by && (
            <span className="flex items-center gap-1"><Clock size={9} className="text-amber-400"/><span className="text-amber-400 font-black">Pay by: {credit.pay_by}</span></span>
          )}
        </div>
        {isSettled && credit.settle_method && (
          <p className={`text-[8px] mt-1 font-mono ${dark ? "text-zinc-600" : "text-zinc-400"}`}>
            Settled via {credit.settle_method}{credit.settle_txn ? ` · ${credit.settle_txn}` : ""}
            {credit.paid_at ? ` · ${toLocalDateStr(new Date(credit.paid_at))}` : ""}
          </p>
        )}
        <p className={`text-[8px] mt-0.5 ${dark ? "text-zinc-700" : "text-zinc-400"}`}>
          {credit.approved_by ? `Approved by ${credit.approved_by} · ` : ""}
          {toLocalDateStr(new Date(credit.created_at))}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-base font-black italic ${isSettled ? "text-emerald-400" : isRejected ? "text-red-400" : "text-purple-400"}`}>
          UGX {Number(displayAmount).toLocaleString()}
        </p>
        {isSettled && credit.amount_paid && Number(credit.amount_paid) !== Number(credit.amount) && (
          <p className="text-[9px] text-emerald-400 font-bold mt-0.5">Paid: UGX {Number(credit.amount_paid).toLocaleString()}</p>
        )}
      </div>
    </div>
  );
}

// ─── SHIFT DETAIL MODAL (director view) ──────────────────────────────────────
function ShiftDetailModal({ shift, dark, onClose }) {
  const gross     = Number(shift.gross_total  || 0);
  const cash      = Number(shift.total_cash   || 0);
  const mtn       = Number(shift.total_mtn    || 0);
  const airtel    = Number(shift.total_airtel || 0);
  const card      = Number(shift.total_card   || 0);
  const credit    = Number(shift.credit_approved_amt || 0);
  const petty     = Number(shift.petty_out    || 0);
  const digital   = mtn + airtel + card;
  const staffName = (shift.staff_name || "Staff").toUpperCase();
  const role      = (shift.role || "STAFF").toUpperCase();
  const clockOut  = shift.clock_out
    ? new Date(shift.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--:--";
  const shiftDate = shift.shift_date || shift.clock_out?.split("T")[0] || "—";

  return (
    <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className={`w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden shadow-2xl border
        ${dark ? "bg-[#0f0f0f] border-white/10" : "bg-white border-zinc-200"}`}>

        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className={`w-10 h-1 rounded-full ${dark ? "bg-white/20" : "bg-zinc-200"}`} />
        </div>

        <div className={`flex items-center justify-between px-6 pt-4 pb-4 sm:pt-6 border-b ${dark ? "border-white/8" : "border-zinc-100"}`}>
          <div>
            <p className={`text-[10px] font-black tracking-[0.2em] uppercase mb-1 ${dark ? "text-zinc-600" : "text-zinc-400"}`}>
              {role} · {shiftDate}
            </p>
            <h2 className="text-lg font-black uppercase italic text-yellow-500 tracking-tight leading-none">
              {staffName}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border
              ${dark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-600"}`}>
              Shift ended {clockOut}
            </span>
            <button onClick={onClose}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all
                ${dark ? "bg-white/5 border border-white/10 text-zinc-500 hover:text-white" : "bg-zinc-100 border border-zinc-200 text-zinc-400 hover:text-zinc-700"}`}>
              <span style={{fontSize:18, lineHeight:1}}>×</span>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[70vh] sm:max-h-none px-5 pb-6 pt-4 space-y-3">
          <div className={`border rounded-2xl p-4 space-y-3 ${dark ? "bg-white/3 border-white/7" : "bg-zinc-50 border-zinc-100"}`}>
            <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${dark ? "text-zinc-600" : "text-zinc-400"}`}>Cash</p>
            <div className="flex justify-between items-center">
              <span className={`text-xs font-bold ${dark ? "text-zinc-400" : "text-zinc-500"}`}>Cash Collected</span>
              <span className={`text-sm font-black italic ${dark ? "text-white" : "text-zinc-800"}`}>UGX {cash.toLocaleString()}</span>
            </div>
            {petty > 0 && (
              <div className="flex justify-between items-center">
                <span className={`text-xs font-bold ${dark ? "text-zinc-400" : "text-zinc-500"}`}>Petty Outflow</span>
                <span className="text-sm font-black italic text-rose-400">− UGX {petty.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className={`border rounded-2xl p-4 ${dark ? "bg-white/3 border-white/7" : "bg-zinc-50 border-zinc-100"}`}>
            <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-3 ${dark ? "text-zinc-600" : "text-zinc-400"}`}>Digital Settlements</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "MTN Momo",  value: mtn,    color: "text-yellow-400", bg: dark ? "bg-yellow-500/8  border-yellow-500/15" : "bg-yellow-50  border-yellow-200" },
                { label: "Airtel",    value: airtel,  color: "text-red-400",   bg: dark ? "bg-red-500/8     border-red-500/15"    : "bg-red-50     border-red-200"    },
                { label: "POS Card",  value: card,    color: "text-blue-400",  bg: dark ? "bg-blue-500/8    border-blue-500/15"   : "bg-blue-50    border-blue-200"   },
                { label: "Credits",   value: credit,  color: "text-purple-400",bg: dark ? "bg-purple-500/8  border-purple-500/15" : "bg-purple-50  border-purple-200" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`${bg} border rounded-xl p-3`}>
                  <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${dark ? "text-zinc-500" : "text-zinc-400"}`}>{label}</p>
                  <p className={`text-sm font-black italic ${value > 0 ? color : dark ? "text-zinc-600" : "text-zinc-300"}`}>
                    UGX {value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {shift.total_orders > 0 && (
            <div className={`border rounded-2xl px-4 py-3 flex items-center justify-between ${dark ? "bg-white/3 border-white/7" : "bg-zinc-50 border-zinc-100"}`}>
              <span className={`text-xs font-bold ${dark ? "text-zinc-400" : "text-zinc-500"}`}>Orders Handled</span>
              <span className={`text-sm font-black italic ${dark ? "text-white" : "text-zinc-800"}`}>{shift.total_orders}</span>
            </div>
          )}

          <div className={`rounded-2xl p-4 flex items-center justify-between border
            ${dark ? "bg-yellow-500/6 border-yellow-500/20" : "bg-yellow-50 border-yellow-200"}`}>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${dark ? "text-yellow-700" : "text-yellow-600"}`}>
                Total Shift Revenue
              </p>
              <p className="text-2xl font-black italic text-yellow-500 tracking-tight">
                UGX {gross.toLocaleString()}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border
              ${dark ? "bg-yellow-500/10 border-yellow-500/25" : "bg-yellow-100 border-yellow-300"}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </div>

          <button onClick={onClose}
            className={`w-full py-4 rounded-xl font-black uppercase italic text-sm tracking-widest transition-all active:scale-[0.98]
              ${dark ? "bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white" : "bg-zinc-100 border border-zinc-200 text-zinc-500 hover:text-zinc-800"}`}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}