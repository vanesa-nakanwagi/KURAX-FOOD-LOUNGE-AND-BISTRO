import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BookOpen, User, Phone, Calendar,
  RefreshCw, ChevronLeft, ChevronRight, FileText, CheckCircle2,
  Hourglass, Clock, XCircle, Search, TrendingUp, TrendingDown
} from "lucide-react";
import { FinanceRow } from "./shared/UIHelpers";
import API_URL from "../../../config/api";

// ─── UTILS ───────────────────────────────────────────────────────────────────
function kampalaMonth(offset = 0) {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" }));
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().substring(0, 7);
}
function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString("en-US", { month: "long", year: "numeric" });
}
function fmtUGX(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

// ─── SVG RING ────────────────────────────────────────────────────────────────
function Ring({ pct = 0, size = 72, stroke = 7, color = "#EAB308", bg = "rgba(0,0,0,0.06)", label, sub }) {
  const r  = (size - stroke) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(Math.max(pct / 100, 0), 1) * circ;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
          <circle
            cx={cx} cy={cx} r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: "stroke-dasharray 0.6s cubic-bezier(.4,0,.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-black text-gray-800 leading-none" style={{ fontSize: size * 0.18 }}>
            {Math.round(pct)}%
          </span>
        </div>
      </div>
      {label && <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 text-center leading-tight max-w-[70px]">{label}</p>}
      {sub   && <p className="text-[9px] font-bold text-gray-800 text-center leading-none">{sub}</p>}
    </div>
  );
}

// ─── CREDIT STATUS BADGE ─────────────────────────────────────────────────────
function CreditStatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  const map = {
    pendingcashier:         { label: "Cashier Queue",    color: "bg-yellow-100 border-yellow-300 text-yellow-700",  icon: <Hourglass size={8}/> },
    pendingmanagerapproval: { label: "Manager Queue",    color: "bg-orange-100 border-orange-300 text-orange-700",  icon: <Clock size={8}/> },
    approved:               { label: "Approved",         color: "bg-purple-100 border-purple-300 text-purple-700",  icon: <CheckCircle2 size={8}/> },
    fullysettled:           { label: "Settled",          color: "bg-emerald-100 border-emerald-300 text-emerald-700", icon: <CheckCircle2 size={8}/> },
    partiallysettled:       { label: "Part. Settled",    color: "bg-emerald-100 border-emerald-300 text-emerald-700", icon: <CheckCircle2 size={8}/> },
    rejected:               { label: "Rejected",         color: "bg-red-100 border-red-300 text-red-700",           icon: <XCircle size={8}/> },
  };
  const cfg = map[s] || { label: status || "Unknown", color: "bg-gray-100 border-gray-300 text-gray-600", icon: <BookOpen size={8}/> };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── SECTION HEADER ──────────────────────────────────────────────────────────
function SectionHeader({ title, sub, right }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-1 h-5 rounded-full bg-yellow-500" />
          <h3 className="text-base font-black uppercase tracking-tight text-gray-900">{title}</h3>
        </div>
        {sub && <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-500 ml-3">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

// ─── DIVIDER ─────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="border-t border-gray-200 my-8" />;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function FinancesSection({ creditsData = [], creditStats = {}, CreditStatusBadge: ExternalBadge }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const month = kampalaMonth(monthOffset);

  const [profit,      setProfit]      = useState(null);
  const [profitLoad,  setProfitLoad]  = useState(true);
  const [exporting,   setExporting]   = useState(false);
  const [creditFilter, setCreditFilter] = useState("all");
  const [searchQuery,  setSearchQuery]  = useState("");

  const Badge = ExternalBadge || CreditStatusBadge;

  // ── fetch ──
  const fetchProfit = useCallback(async () => {
    setProfitLoad(true);
    try {
      const res = await fetch(`${API_URL}/api/summaries/monthly-profit?month=${month}`);
      if (res.ok) setProfit(await res.json());
    } catch {}
    finally { setProfitLoad(false); }
  }, [month]);
  useEffect(() => { fetchProfit(); }, [fetchProfit]);

  // ── export pdf ──
  const handleDownloadPDF = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${API_URL}/api/summaries/export-pdf?month=${month}`);
      if (res.ok) {
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url; a.download = `Kurax_Report_${month}.pdf`; a.click();
        URL.revokeObjectURL(url);
      }
    } catch {}
    finally { setExporting(false); }
  };

  // ── credit filtering ──
  const normalize = s => {
    const v = String(s || "").toLowerCase();
    if (v === "pendingcashier")         return "pendingCashier";
    if (v === "pendingmanagerapproval") return "pendingManager";
    if (v === "fullysettled" || v === "partiallysettled") return "settled";
    return v;
  };

  const filteredCredits = useMemo(() => {
    let f = creditsData || [];
    if (creditFilter !== "all") f = f.filter(c => normalize(c.status) === creditFilter);
    if (searchQuery)            f = f.filter(c =>
      (c.table_name  || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.client_name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
    return f;
  }, [creditsData, creditFilter, searchQuery]);

  // ── derived numbers ──
  const costs      = profit?.costs || {};
  const sales      = profit?.sales || {};
  const fixedItems = costs.fixed_items || [];

  const gross      = Number(sales.total_gross  || 0);
  const expenses   = Number(costs.total        || 0);
  const net        = Number(profit?.net_profit  || 0);
  const marginPct  = Number(profit?.margin_pct  || 0);

  const totalCredits = creditsData?.length || 0;
  const settledCt    = creditStats?.settled || 0;
  const settledPct   = totalCredits > 0 ? (settledCt / totalCredits) * 100 : 0;

  const momoAmt = Number(sales.total_momo || 0);
  const cashAmt = Number(sales.total_cash || 0);
  const momoPct = gross > 0 ? (momoAmt / gross) * 100 : 0;
  const cashPct = gross > 0 ? (cashAmt / gross) * 100 : 0;

  const CREDIT_TABS = [
    { key: "all",           label: "All",            count: totalCredits },
    { key: "pendingCashier",label: "Cashier Queue",  count: creditStats?.pendingCashier || 0 },
    { key: "pendingManager",label: "Manager Queue",  count: creditStats?.pendingManager || 0 },
    { key: "approved",      label: "Approved",       count: creditStats?.approved       || 0 },
    { key: "settled",       label: "Settled",        count: creditStats?.settled        || 0 },
    { key: "rejected",      label: "Rejected",       count: creditStats?.rejected       || 0 },
  ];

  return (
    <div className="font-[Outfit] space-y-0">

      {/* ══ 1. CONTROL BAR ════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6">
        {/* Month stepper */}
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setMonthOffset(o => o - 1)}
            className="px-3 py-2.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 transition-all"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="px-4 text-[11px] font-black uppercase tracking-widest text-gray-800 min-w-[130px] text-center">
            {monthLabel(month)}
          </span>
          <button
            onClick={() => setMonthOffset(o => Math.min(o + 1, 0))}
            disabled={monthOffset >= 0}
            className="px-3 py-2.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 transition-all disabled:opacity-20"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchProfit}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-yellow-600 hover:border-yellow-300 transition-all"
          >
            <RefreshCw size={14} className={profitLoad ? "animate-spin" : ""} />
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500 text-black font-black uppercase text-[9px] tracking-wider hover:bg-yellow-400 transition-all disabled:opacity-50 shadow-sm shadow-yellow-500/20"
          >
            {exporting ? <RefreshCw size={12} className="animate-spin" /> : <FileText size={12} />}
            {exporting ? "Generating…" : "PDF Report"}
          </button>
        </div>
      </div>

      {/* ══ 2. P&L OVERVIEW ═══════════════════════════════════════════════ */}
      <SectionHeader title="Financial Overview" sub={`${monthLabel(month)} · Profit & Loss`} />

      {profitLoad ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-0">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Ring row ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Net margin ring */}
            <div className="col-span-2 md:col-span-1 flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border border-gray-200 bg-gray-50">
              <Ring
                pct={Math.max(0, marginPct)}
                size={88}
                stroke={8}
                color={marginPct >= 0 ? "#22c55e" : "#ef4444"}
                label="Net Margin"
                sub={`UGX ${fmtUGX(net)}`}
              />
            </div>

            {/* Gross sales ring */}
            <div className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border border-gray-200 bg-gray-50">
              <Ring pct={100} size={72} stroke={6} color="#EAB308" label="Gross Sales" sub={`UGX ${fmtUGX(gross)}`} />
            </div>

            {/* MoMo split ring */}
            <div className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border border-gray-200 bg-gray-50">
              <Ring pct={momoPct} size={72} stroke={6} color="#f59e0b" label="MoMo Share" sub={`UGX ${fmtUGX(momoAmt)}`} />
            </div>

            {/* Cash split ring */}
            <div className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border border-gray-200 bg-gray-50">
              <Ring pct={cashPct} size={72} stroke={6} color="#34d399" label="Cash Share" sub={`UGX ${fmtUGX(cashAmt)}`} />
            </div>
          </div>

          {/* ── KPI strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            <KpiTile label="Total Revenue"  value={`UGX ${Number(gross).toLocaleString()}`}   accent="text-gray-900" />
            <KpiTile label="Total Expenses" value={`UGX ${Number(expenses).toLocaleString()}`} accent="text-red-600" />
            <KpiTile
              label="Net Profit"
              value={`UGX ${Math.abs(net).toLocaleString()}`}
              accent={net >= 0 ? "text-emerald-600" : "text-red-600"}
              icon={net >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
              className="col-span-2 md:col-span-1"
            />
          </div>
        </>
      )}

      {/* Increased spacing between Financial Overview and Credits Ledger */}
      <div className="mt-12 mb-6">
        <Divider />
      </div>

      {/* ══ 3. CREDITS LEDGER ════════════════════════════════════════════ */}
      <SectionHeader
        title="Credits Ledger"
        sub={`${totalCredits} total · ${settledCt} settled`}
        right={
          <div className="flex items-center gap-5 mt-1">
            
            
          </div>
        }
      />

      
      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 mb-3">
        {CREDIT_TABS.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setCreditFilter(key)}
            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 transition-all
              ${creditFilter === key
                ? "bg-yellow-500 text-black shadow-sm shadow-yellow-500/20"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200"}`}
          >
            {label}
            {count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[8px] font-black
                ${creditFilter === key ? "bg-black/20" : "bg-gray-200"}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search table or client…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[12px] font-medium border border-gray-200 outline-none bg-white text-gray-700 placeholder:text-gray-400 focus:border-yellow-500 transition-all"
        />
      </div>

      {/* Credits list */}
      {filteredCredits.length === 0 ? (
        <div className="py-14 text-center border border-dashed border-gray-300 rounded-2xl">
          <BookOpen size={24} className="mx-auto text-gray-400 mb-2" />
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">No credits found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCredits.map(credit => (
            <CreditCardItem key={credit.id} credit={credit} Badge={Badge} />
          ))}
        </div>
      )}

      {/* Increased spacing between Credits Ledger and Verified Expenses */}
      <div className="mt-12 mb-6">
        <Divider />
      </div>

      {/* ══ 4. EXPENSE LEDGER ════════════════════════════════════════════ */}
      <SectionHeader
        title="Verified Expenses"
        sub={`${monthLabel(month)} · Accountant submissions`}
        right={
          !profitLoad && (
            <div className="text-right mt-1">
              <p className="text-[8px] font-black uppercase text-gray-500 tracking-wider">Total</p>
              <p className="text-lg font-black text-red-600">UGX {fmtUGX(costs.fixed_total)}</p>
            </div>
          )
        }
      />

      {profitLoad ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : fixedItems.length === 0 ? (
        <div className="py-14 text-center border border-dashed border-gray-300 rounded-2xl">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">No expenses for {monthLabel(month)}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {fixedItems.map(item => (
            <ExpenseRow key={item.id} item={item} />
          ))}
        </div>
      )}

      {!profitLoad && fixedItems.length > 0 && (
        <div className="flex justify-between items-center pt-4 mt-2 border-t border-gray-200">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
            {fixedItems.length} line item{fixedItems.length !== 1 ? "s" : ""} · {monthLabel(month)}
          </p>
          <p className="text-lg font-black text-red-600">
            UGX {Number(costs.fixed_total || 0).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── KPI TILE ────────────────────────────────────────────────────────────────
function KpiTile({ label, value, accent, icon, className = "" }) {
  return (
    <div className={`p-4 rounded-2xl border border-gray-200 bg-gray-50 ${className}`}>
      <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1">{label}</p>
      <div className={`flex items-center gap-1.5 font-black text-base ${accent}`}>
        {icon}
        {value}
      </div>
    </div>
  );
}

// ─── CREDIT CARD ITEM ────────────────────────────────────────────────────────
function CreditCardItem({ credit, Badge }) {
  const date = credit.created_at || credit.confirmed_at;
  const dateStr = date
    ? new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  const isSettled = credit.status === "FullySettled" || credit.status === "PartiallySettled";
  const isRejected = credit.status === "Rejected";
  const amount = isSettled ? (credit.amount_paid || credit.amount) : credit.amount;
  const amountColor = isSettled ? "text-emerald-600" : isRejected ? "text-red-600" : "text-purple-600";

  return (
    <div className="group flex items-start justify-between gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:bg-yellow-50 transition-all relative overflow-hidden">
      {/* yellow left accent */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-0 rounded-r-full bg-yellow-500 transition-all duration-200 group-hover:h-[55%]" />

      <div className="flex-1 min-w-0 pl-1">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <h4 className="font-black text-sm uppercase tracking-tight text-gray-900">{credit.table_name || "Table"}</h4>
          <Badge status={credit.status} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold text-gray-500">
          {credit.client_name && (
            <span className="flex items-center gap-1"><User size={9}/>{credit.client_name}</span>
          )}
          {credit.client_phone && (
            <span className="flex items-center gap-1"><Phone size={9}/>{credit.client_phone}</span>
          )}
          {credit.pay_by && !isSettled && !isRejected && (
            <span className="flex items-center gap-1 text-amber-600"><Calendar size={9}/>Pay by: {credit.pay_by}</span>
          )}
        </div>
        <p className="text-[7px] font-bold text-gray-400 mt-1.5">
          {credit.approved_by ? `Approved by ${credit.approved_by} · ` : ""}{dateStr}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className={`text-sm font-black ${amountColor}`}>UGX {Number(amount || 0).toLocaleString()}</p>
        {isSettled && credit.settle_method && (
          <p className="text-[8px] font-bold text-gray-500 mt-0.5">via {credit.settle_method}</p>
        )}
      </div>
    </div>
  );
}

// ─── EXPENSE ROW ─────────────────────────────────────────────────────────────
function ExpenseRow({ item }) {
  return (
    <div className="group flex items-start justify-between gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all relative overflow-hidden">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-0 rounded-r-full bg-red-500 transition-all duration-200 group-hover:h-[55%]" />
      <div className="flex-1 min-w-0 pl-1">
        <p className="text-[9px] font-black uppercase tracking-widest text-yellow-600 mb-0.5">{item.category}</p>
        <p className="text-[11px] font-bold text-gray-800 truncate">{item.description || "No description"}</p>
        <p className="text-[8px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
          {item.entered_by || "System"}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-black text-red-600">UGX {Number(item.amount).toLocaleString()}</p>
        <p className="text-[7px] font-bold text-gray-400 mt-0.5 uppercase">Verified</p>
      </div>
    </div>
  );
}

// expose for parent import
export { CreditStatusBadge };