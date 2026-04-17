import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowDownRight, BookOpen, User, Phone, Calendar,
  RefreshCw, ChevronLeft, ChevronRight, FileText, CheckCircle2,
  Banknote, CreditCard, Smartphone, Wallet, TrendingUp,
  ChevronDown, ChevronUp, Search, Filter, Hourglass, Clock, XCircle
} from "lucide-react";
import { useTheme } from "./shared/ThemeContext";
import { FinanceRow } from "./shared/UIHelpers";
import API_URL from "../../../config/api";

// ─── UTILS ──────────────────────────────────────────────────────────────────
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

export default function FinancesSection({ creditsData = [], creditStats = {}, CreditStatusBadge: ExternalBadge }) {
  const { dark, t } = useTheme();
  const [monthOffset, setMonthOffset] = useState(0);
  const month = kampalaMonth(monthOffset);
  
  const [profit, setProfit] = useState(null);
  const [profitLoad, setProfitLoad] = useState(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  
  // Credits state
  const [expandedCredits, setExpandedCredits] = useState(false);
  const [creditFilter, setCreditFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Use the passed badge component or the local one
  const Badge = ExternalBadge || CreditStatusBadge;

  // ─── FETCH PROFIT DATA ─────────────────────────────────────────────────────
  const fetchProfit = useCallback(async () => {
    setProfitLoad(true);
    try {
      const res = await fetch(`${API_URL}/api/summaries/monthly-profit?month=${month}`);
      if (res.ok) setProfit(await res.json());
    } catch (e) { console.error("Profit fetch error:", e); }
    finally { setProfitLoad(false); }
  }, [month]);

  useEffect(() => { fetchProfit(); }, [fetchProfit]);

  // ─── EXPORT PDF ───────────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    setIsExportingPDF(true);
    try {
      const res = await fetch(`${API_URL}/api/summaries/export-pdf?month=${month}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Kurax_Report_${month}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else { alert("PDF route not configured on backend."); }
    } catch (e) { alert("Network error during PDF generation."); }
    finally { setIsExportingPDF(false); }
  };

  // ─── CREDIT FILTERING ─────────────────────────────────────────────────────
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

  const filteredCredits = useMemo(() => {
    let filtered = creditsData || [];
    
    if (creditFilter === "pendingCashier") {
      filtered = filtered.filter(c => getNormalizedStatus(c.status) === 'pendingCashier');
    } else if (creditFilter === "pendingManager") {
      filtered = filtered.filter(c => getNormalizedStatus(c.status) === 'pendingManager');
    } else if (creditFilter === "approved") {
      filtered = filtered.filter(c => getNormalizedStatus(c.status) === 'approved');
    } else if (creditFilter === "settled") {
      filtered = filtered.filter(c => getNormalizedStatus(c.status) === 'settled');
    } else if (creditFilter === "rejected") {
      filtered = filtered.filter(c => getNormalizedStatus(c.status) === 'rejected');
    }
    
    if (searchQuery) {
      filtered = filtered.filter(c => 
        (c.table_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.client_name || "").toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  }, [creditsData, creditFilter, searchQuery]);

  const costs = profit?.costs || {};
  const fixedItems = costs.fixed_items || [];

  // Credit tabs configuration
  const creditTabs = [
    { key: "all", label: "All", count: creditsData?.length || 0, color: "zinc" },
    { key: "pendingCashier", label: "Wait for Cashier", count: creditStats?.pendingCashier || 0, color: "yellow" },
    { key: "pendingManager", label: "Wait for Manager", count: creditStats?.pendingManager || 0, color: "orange" },
    { key: "approved", label: "Approved", count: creditStats?.approved || 0, color: "purple" },
    { key: "settled", label: "Settled", count: creditStats?.settled || 0, color: "green" },
    { key: "rejected", label: "Rejected", count: creditStats?.rejected || 0, color: "red" },
  ];

  const getTabColor = (color, isActive) => {
    if (!isActive) return dark ? "text-zinc-500 hover:text-zinc-300" : "text-gray-500 hover:text-gray-700";
    switch(color) {
      case 'yellow': return 'bg-yellow-500 text-black';
      case 'orange': return 'bg-orange-500 text-white';
      case 'purple': return 'bg-purple-500 text-white';
      case 'green': return 'bg-emerald-500 text-white';
      case 'red': return 'bg-red-500 text-white';
      default: return 'bg-yellow-500 text-black';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* ── CONTROL BAR ── */}
      <div className={`flex flex-wrap justify-between items-center ${t.card} border p-5 rounded-[2rem] gap-4`}>
        <div>
          <h3 className="text-sm font-black uppercase italic tracking-tighter text-yellow-500">Financial Audit Mode</h3>
          <p className={`text-[10px] font-bold uppercase ${t.subtext}`}>Monitoring Accountant Submissions</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`flex items-center rounded-xl p-1 border ${dark ? "bg-black/20 border-white/5" : "bg-gray-100 border-gray-200"}`}>
            <button onClick={() => setMonthOffset(o => o - 1)} className="p-2 hover:text-yellow-500 transition-colors"><ChevronLeft size={16}/></button>
            <span className="text-[10px] font-black uppercase px-4 min-w-[120px] text-center">{monthLabel(month)}</span>
            <button onClick={() => setMonthOffset(o => Math.min(o + 1, 0))} disabled={monthOffset >= 0} className="p-2 disabled:opacity-20 hover:text-yellow-500 transition-colors"><ChevronRight size={16}/></button>
          </div>
          
          <button 
            onClick={handleDownloadPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-2 px-5 py-3 bg-white text-black rounded-2xl font-black uppercase italic text-[10px] hover:bg-yellow-500 transition-all active:scale-95 disabled:opacity-50">
            {isExportingPDF ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
            {isExportingPDF ? "Generating PDF..." : "Download PDF Report"}
          </button>
        </div>
      </div>

      {/* ── P&L SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className={`${t.card} border p-6 rounded-[2rem] relative overflow-hidden`}>
          <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-1">Monthly Net Margin</p>
          <h4 className={`text-5xl font-black italic ${profit?.margin_pct >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {profitLoad ? "..." : `${profit?.margin_pct || 0}%`}
          </h4>
          <p className="text-[10px] font-bold text-zinc-400 mt-2 uppercase">UGX {Number(profit?.net_profit || 0).toLocaleString()} Profit</p>
        </div>

        <div className={`${t.card} border p-6 rounded-[2rem] space-y-3`}>
          <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Revenue Breakdown</p>
          <FinanceRow label="Gross Sales" value={profit?.sales?.total_gross} color="text-white" bold />
          <FinanceRow label="Total MoMo" value={profit?.sales?.total_momo} color="text-yellow-500" />
          <FinanceRow label="Total Cash" value={profit?.sales?.total_cash} color="text-emerald-500" />
        </div>

        <div className={`${t.card} border p-6 rounded-[2rem] space-y-3`}>
          <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Cost Summary</p>
          <FinanceRow label="Fixed Expenses" value={costs.fixed_total} color="text-rose-400" />
          <FinanceRow label="Petty Cash Out" value={costs.petty_out} color="text-orange-400" />
          <div className="pt-2 border-t border-white/5">
            <FinanceRow label="Total Expenses" value={costs.total} color="text-rose-500" bold />
          </div>
        </div>
      </div>

      {/* ── CREDITS LEDGER SECTION ── */}
      <div className={`${t.card} border rounded-[2.5rem] overflow-hidden`}>
        <div className="px-8 py-6 border-b border-white/5 bg-white/5 flex justify-between items-center flex-wrap gap-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-tighter">Credits Ledger</h3>
            <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">Track all credit accounts, approvals, and settlements</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
            <BookOpen size={12} className="text-purple-500" />
            <span className="text-[8px] font-black text-purple-500 uppercase">{creditsData?.length || 0} Total Credits</span>
          </div>
        </div>

        {/* Credit Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 border-b border-white/5">
          <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-[7px] font-black uppercase text-yellow-400">Wait for Cashier</p>
            <p className="text-xl font-black text-yellow-400">{creditStats?.pendingCashier || 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <p className="text-[7px] font-black uppercase text-orange-400">Wait for Manager</p>
            <p className="text-xl font-black text-orange-400">{creditStats?.pendingManager || 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <p className="text-[7px] font-black uppercase text-purple-400">Approved</p>
            <p className="text-xl font-black text-purple-400">{creditStats?.approved || 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-[7px] font-black uppercase text-emerald-400">Settled</p>
            <p className="text-xl font-black text-emerald-400">{creditStats?.settled || 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-[7px] font-black uppercase text-red-400">Rejected</p>
            <p className="text-xl font-black text-red-400">{creditStats?.rejected || 0}</p>
          </div>
        </div>

        {/* Credit Tabs */}
        <div className="px-6 pt-4">
          <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-white/5 w-fit">
            {creditTabs.map(({ key, label, count, color }) => (
              <button
                key={key}
                onClick={() => setCreditFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                  ${creditFilter === key ? getTabColor(color, true) : (dark ? "text-zinc-500 hover:text-zinc-300" : "text-gray-500 hover:text-gray-700")}`}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[8px] font-black ${creditFilter === key ? "bg-white/20" : dark ? "bg-white/10" : "bg-black/5"}`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 pt-4">
          <div className="relative">
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? "text-zinc-500" : "text-gray-400"}`} />
            <input
              type="text"
              placeholder="Search by table or client name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs font-bold outline-none border transition-all
                ${dark ? "bg-zinc-800/50 border-white/10 focus:border-yellow-500/50 text-white placeholder-zinc-600" 
                      : "bg-gray-100 border-gray-200 focus:border-yellow-500 text-gray-900 placeholder-gray-400"}`}
            />
          </div>
        </div>

        {/* Credits List */}
        <div className="p-6">
          {filteredCredits.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
              <BookOpen size={32} className="mx-auto text-zinc-700 mb-3" />
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">No {creditFilter} credits found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCredits.map(credit => (
                <CreditCardItem key={credit.id} credit={credit} Badge={Badge} dark={dark} />
              ))}
            </div>
          )}
        </div>

        {/* Expand/Collapse Button */}
        {creditsData?.length > 5 && (
          <div className="px-6 pb-6">
            <button
              onClick={() => setExpandedCredits(!expandedCredits)}
              className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl transition-all
                ${dark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"}`}
            >
              {expandedCredits ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span className="text-[9px] font-black uppercase tracking-widest">
                {expandedCredits ? "Show Less" : `Show All ${creditsData.length} Credits`}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ── ACCOUNTANT'S COST LEDGER ── */}
      <div className={`${t.card} border rounded-[2.5rem] overflow-hidden`}>
        <div className="px-8 py-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
          <div>
            <h3 className="text-xs font-black uppercase tracking-tighter">Verified Monthly Expenses</h3>
            <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">Audit trail of costs entered by accounting staff</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <span className="text-[8px] font-black text-emerald-500 uppercase">Live Records</span>
          </div>
        </div>

        <div className="p-6">
          {profitLoad ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />)}
            </div>
          ) : fixedItems.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
              <p className="text-[10px] font-black uppercase text-zinc-600 italic">No costs submitted for {monthLabel(month)}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fixedItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-5 bg-black/40 border border-white/5 rounded-2xl hover:bg-black/60 transition-colors">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">{item.category}</p>
                    <p className="text-xs font-bold text-white mt-0.5 truncate">{item.description || "No description provided"}</p>
                    <p className="text-[8px] text-zinc-600 mt-2 font-black uppercase">Staff: {item.entered_by || "System"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-rose-400 italic">UGX {Number(item.amount).toLocaleString()}</p>
                    <p className="text-[7px] text-zinc-700 uppercase font-black">Verified Cost</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!profitLoad && fixedItems.length > 0 && (
          <div className="px-8 py-4 bg-zinc-900/50 border-t border-white/5 flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-zinc-500">Subtotal for {monthLabel(month)}</span>
            <span className="text-xl font-black text-rose-500 italic">UGX {Number(costs.fixed_total || 0).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CREDIT CARD ITEM COMPONENT ──────────────────────────────────────────────
function CreditCardItem({ credit, Badge, dark }) {
  const date = credit.created_at || credit.confirmed_at;
  const dateStr = date ? new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  
  const isSettled = credit.status === "FullySettled" || credit.status === "PartiallySettled";
  const displayAmount = isSettled ? (credit.amount_paid || credit.amount) : credit.amount;

  return (
    <div className={`p-4 rounded-xl border transition-all hover:shadow-md ${dark ? "bg-zinc-900/40 border-white/10" : "bg-white border-gray-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h4 className="font-black text-base uppercase tracking-tighter">{credit.table_name || "Table"}</h4>
            <Badge status={credit.status} />
          </div>
          
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
            {credit.client_name && (
              <div className="flex items-center gap-1">
                <User size={10} className="text-zinc-500" />
                <span className={dark ? "text-zinc-300" : "text-gray-600"}>{credit.client_name}</span>
              </div>
            )}
            {credit.client_phone && (
              <div className="flex items-center gap-1">
                <Phone size={10} className="text-zinc-500" />
                <span className={dark ? "text-zinc-400" : "text-gray-500"}>{credit.client_phone}</span>
              </div>
            )}
            {credit.pay_by && !isSettled && credit.status !== "Rejected" && (
              <div className="flex items-center gap-1">
                <Calendar size={10} className="text-amber-400" />
                <span className="text-amber-400 font-black">Pay by: {credit.pay_by}</span>
              </div>
            )}
          </div>
          
          <p className={`text-[8px] font-bold mt-2 ${dark ? "text-zinc-600" : "text-gray-400"}`}>
            {credit.approved_by ? `Approved by ${credit.approved_by} · ` : ""}
            {dateStr}
          </p>
        </div>
        
        <div className="text-right shrink-0">
          <p className={`text-lg font-black ${isSettled ? "text-emerald-400" : credit.status === "Rejected" ? "text-red-400" : "text-purple-400"}`}>
            UGX {Number(displayAmount || 0).toLocaleString()}
          </p>
          {isSettled && credit.settle_method && (
            <p className={`text-[8px] font-bold ${dark ? "text-zinc-500" : "text-gray-400"}`}>
              via {credit.settle_method}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}