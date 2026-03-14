import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowDownRight, BookOpen, User, Phone, Calendar,
  RefreshCw, PlusCircle, Trash2, ChevronLeft, ChevronRight
} from "lucide-react";
import { useTheme } from "./shared/ThemeContext";
import { FinanceRow } from "./shared/UIHelpers";
import API_URL from "../../../config/api";

// ─── Default expense categories ───────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  "Rent", "Staff Wages", "Stock / Supplies", "Utilities",
  "Marketing", "Equipment", "Transport", "Other",
];

// ─── Kampala month helper ─────────────────────────────────────────────────────
function kampalaMonth(offset = 0) {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" }));
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().substring(0, 7); // YYYY-MM
}

function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString("en-US", { month: "long", year: "numeric" });
}

// ─── HELPER: DIRECTOR CREDIT ROW ─────────────────────────────────────────────
function DirectorCreditRow({ credit, dark, t }) {
  return (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all
      ${credit.paid
        ? dark ? "bg-zinc-900/20 border-white/5 opacity-60" : "bg-zinc-50 border-black/5 opacity-60"
        : dark ? "bg-purple-500/5 border-purple-500/20"     : "bg-purple-50 border-purple-200"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`font-black italic uppercase text-sm tracking-tighter ${dark ? "text-white" : "text-zinc-900"}`}>
            {credit.table_name}
          </span>
          {credit.paid
            ? <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase">Settled</span>
            : <span className="text-[8px] font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase">Open</span>
          }
        </div>
        <div className="flex items-center gap-3 text-[9px] flex-wrap">
          <div className="flex items-center gap-1">
            <User size={9} className="text-zinc-500" />
            <span className={dark ? "text-zinc-300" : "text-zinc-600"}>{credit.client_name || "—"}</span>
          </div>
          {credit.client_phone && (
            <div className="flex items-center gap-1">
              <Phone size={9} className="text-zinc-500" />
              <span className={dark ? "text-zinc-400" : "text-zinc-500"}>{credit.client_phone}</span>
            </div>
          )}
          {credit.pay_by && (
            <div className="flex items-center gap-1">
              <Calendar size={9} className="text-zinc-500" />
              <span className={dark ? "text-zinc-500" : "text-zinc-400"}>Pays: {credit.pay_by}</span>
            </div>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-black text-purple-400 italic">
          UGX {Number(credit.amount).toLocaleString()}
        </p>
        {credit.paid && credit.settle_method && (
          <p className={`text-[8px] mt-0.5 ${dark ? "text-zinc-600" : "text-zinc-400"}`}>
            via {credit.settle_method}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function FinancesSection() {
  const { dark, t } = useTheme();

  // Month navigation
  const [monthOffset, setMonthOffset] = useState(0);
  const month = kampalaMonth(monthOffset);

  // Monthly P&L data from backend
  const [profit,       setProfit]      = useState(null);
  const [profitLoad,   setProfitLoad]  = useState(true);

  // Expense entry form
  const [newCategory,  setNewCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [customCat,    setCustomCat]   = useState("");
  const [newAmount,    setNewAmount]   = useState("");
  const [newDesc,      setNewDesc]     = useState("");
  const [saving,       setSaving]      = useState(false);
  const [deletingId,   setDeletingId]  = useState(null);
  const [showForm,     setShowForm]    = useState(false);

  // Credits
  const [creditsLedger,  setCreditsLedger]  = useState([]);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [creditFilter,   setCreditFilter]   = useState("outstanding");

  const directorName = JSON.parse(localStorage.getItem("kurax_user") || "{}").name || "Director";

  // ── Fetch monthly P&L ──────────────────────────────────────────────────────
  const fetchProfit = useCallback(async () => {
    setProfitLoad(true);
    try {
      const res = await fetch(`${API_URL}/api/summaries/monthly-profit?month=${month}`);
      if (res.ok) setProfit(await res.json());
    } catch (e) { console.error("Monthly profit fetch failed:", e); }
    finally { setProfitLoad(false); }
  }, [month]);

  useEffect(() => { fetchProfit(); }, [fetchProfit]);

  // ── Fetch credits ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/orders/credits`);
        if (res.ok) setCreditsLedger(await res.json());
      } catch (e) { console.error("Credits fetch failed:", e); }
      finally { setCreditsLoading(false); }
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  // ── Save expense entry ─────────────────────────────────────────────────────
  const handleSave = async () => {
    const cat = newCategory === "__custom__" ? customCat.trim() : newCategory;
    const amt = Number(newAmount);
    if (!cat || !amt || amt <= 0) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/summaries/monthly-expenses`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          category:    cat,
          amount:      amt,
          description: newDesc.trim() || null,
          entered_by:  directorName,
        }),
      });
      if (res.ok) {
        setNewAmount(""); setNewDesc(""); setCustomCat(""); setShowForm(false);
        await fetchProfit();
      }
    } catch (e) { console.error("Expense save failed:", e); }
    setSaving(false);
  };

  // ── Delete expense entry ───────────────────────────────────────────────────
  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await fetch(`${API_URL}/api/summaries/monthly-expenses/${id}`, { method: "DELETE" });
      await fetchProfit();
    } catch (e) { console.error("Expense delete failed:", e); }
    setDeletingId(null);
  };

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      const res = await fetch(`${API_URL}/api/overview/export?date=${month}`);
      if (res.ok) {
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url; a.download = `finances_${month}.csv`; a.click();
        URL.revokeObjectURL(url);
      } else { alert("Export not available yet."); }
    } catch { alert("Export failed — check server."); }
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const sales      = profit?.sales   || {};
  const costs      = profit?.costs   || {};
  const grossSales = Number(sales.total_gross  || 0);
  const totalCash  = Number(sales.total_cash   || 0);
  const totalCard  = Number(sales.total_card   || 0);
  const totalMomo  = Number(sales.total_momo   || 0);
  const totalCosts = Number(costs.total        || 0);
  const netProfit  = Number(profit?.net_profit || 0);
  const margin     = Number(profit?.margin_pct || 0);
  const fixedItems = costs.fixed_items || [];

  const outstanding      = creditsLedger.filter(c => !c.paid);
  const settled          = creditsLedger.filter(c => c.paid);
  const totalOutstanding = outstanding.reduce((s, c) => s + Number(c.amount), 0);
  const totalSettled     = settled.reduce((s, c) => s + Number(c.amount_paid || c.amount), 0);
  const filteredCredits  = creditsLedger.filter(c => {
    if (creditFilter === "outstanding") return !c.paid;
    if (creditFilter === "settled")     return c.paid;
    return true;
  });

  const Pulse = ({ w = "w-24" }) => (
    <div className={`h-6 ${w} rounded-lg animate-pulse ${dark ? "bg-zinc-800" : "bg-zinc-200"}`} />
  );

  return (
    <div className="space-y-4">

      {/* ── Header + Month Nav + Export ─────────────────────────────────────── */}
      <div className={`flex flex-wrap justify-between items-center ${t.card} border p-4 rounded-2xl gap-3`}>
        <div>
          <h3 className="text-sm font-black uppercase italic">Financial Controller</h3>
          <p className={`text-[9px] font-bold uppercase ${t.subtext}`}>
            Monthly P&L — {monthLabel(month)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Month navigator */}
          <button onClick={() => setMonthOffset(o => o - 1)}
            className={`p-2 rounded-xl border font-black transition-all ${dark ? "border-white/10 hover:bg-white/5" : "border-zinc-200 hover:bg-zinc-100"}`}>
            <ChevronLeft size={14}/>
          </button>
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 ${t.subtext}`}>
            {monthLabel(month)}
          </span>
          <button onClick={() => setMonthOffset(o => Math.min(o + 1, 0))}
            disabled={monthOffset >= 0}
            className={`p-2 rounded-xl border font-black transition-all disabled:opacity-30
              ${dark ? "border-white/10 hover:bg-white/5" : "border-zinc-200 hover:bg-zinc-100"}`}>
            <ChevronRight size={14}/>
          </button>
          <button onClick={handleExport}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black uppercase italic text-[10px] transition-colors
              ${dark ? "bg-white text-black hover:bg-yellow-500" : "bg-zinc-900 text-white hover:bg-yellow-500 hover:text-black"}`}>
            <ArrowDownRight size={13} /> Export
          </button>
        </div>
      </div>

      {/* ── P&L Cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Net Profit Margin */}
        <div className={`${t.card} border p-5 rounded-2xl flex flex-col justify-center relative overflow-hidden`}>
          <div className={`absolute -right-4 -top-4 w-20 h-20 blur-3xl rounded-full
            ${margin >= 0 ? "bg-emerald-500/20" : "bg-rose-500/20"}`} />
          <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${t.subtext}`}>Net Profit Margin</p>
          {profitLoad
            ? <Pulse w="w-32" />
            : <h4 className={`text-5xl font-black italic ${margin >= 20 ? "text-emerald-500" : margin >= 0 ? "text-yellow-500" : "text-rose-500"}`}>
                {margin}%
              </h4>
          }
          <p className={`text-[10px] font-bold uppercase mt-2 ${t.subtext}`}>
            {profitLoad ? "—" : `UGX ${netProfit.toLocaleString()} net`}
          </p>
          {!profitLoad && (
            <p className={`text-[8px] mt-1 ${t.subtext} opacity-60`}>
              {sales.order_count || 0} orders this month
            </p>
          )}
        </div>

        {/* Revenue Breakdown */}
        <div className={`${t.card} border p-5 rounded-2xl space-y-3`}>
          <p className={`text-[9px] font-black uppercase tracking-widest ${t.subtext}`}>Revenue Breakdown</p>
          {profitLoad ? (
            <div className="space-y-3">{[1,2,3,4,5].map(i => <Pulse key={i}/>)}</div>
          ) : (
            <>
              <FinanceRow label="Cash Sales"   value={totalCash}  color="text-emerald-400" />
              <FinanceRow label="MoMo Sales"   value={totalMomo}  color="text-yellow-400" />
              <FinanceRow label="Card Sales"   value={totalCard}  color="text-blue-400" />
              <div className={`pt-2 border-t ${t.divider}`}>
                <FinanceRow label="Total Sales"  value={grossSales} color="text-white" bold />
              </div>
              <FinanceRow label="Total Costs"  value={totalCosts} color="text-rose-500" />
              <div className={`pt-2 border-t ${t.divider}`}>
                <FinanceRow label="Net Balance" value={netProfit}  color={netProfit >= 0 ? "text-emerald-500" : "text-rose-500"} bold />
              </div>
            </>
          )}
        </div>

        {/* Cost Breakdown */}
        <div className={`${t.card} border p-5 rounded-2xl space-y-3`}>
          <p className={`text-[9px] font-black uppercase tracking-widest ${t.subtext}`}>Cost Breakdown</p>
          {profitLoad ? (
            <div className="space-y-3">{[1,2].map(i => <Pulse key={i}/>)}</div>
          ) : (
            <>
              <FinanceRow label="Daily Petty Cash" value={Number(costs.petty_out || 0)} color="text-orange-400" />
              {fixedItems.map(item => (
                <FinanceRow key={item.id} label={item.category} value={Number(item.amount)} color="text-rose-400" />
              ))}
              {fixedItems.length === 0 && (
                <p className={`text-[9px] italic ${t.subtext}`}>No fixed costs entered yet</p>
              )}
              <div className={`pt-2 border-t ${t.divider}`}>
                <FinanceRow label="Total Costs" value={totalCosts} color="text-rose-500" bold />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Monthly Fixed Expenses Manager ───────────────────────────────────── */}
      <div className={`${t.card} border rounded-2xl overflow-hidden`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${t.divider}`}>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest">Monthly Fixed Expenses</h3>
            <p className={`text-[8px] mt-0.5 ${t.subtext}`}>Rent · Wages · Stock · Utilities — stored per month</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500 text-black rounded-xl font-black text-[9px] uppercase hover:bg-yellow-400 transition-all">
            <PlusCircle size={12}/> Add
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className={`px-5 py-4 border-b ${t.divider} space-y-3`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Category */}
              <div>
                <p className={`text-[8px] font-black uppercase tracking-widest mb-1.5 ${t.subtext}`}>Category</p>
                <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                  className={`w-full rounded-xl p-3 text-xs font-bold outline-none border
                    ${dark ? "bg-black border-white/10 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-800"}`}>
                  {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">+ Custom…</option>
                </select>
                {newCategory === "__custom__" && (
                  <input value={customCat} onChange={e => setCustomCat(e.target.value)}
                    placeholder="Custom category name"
                    className={`mt-2 w-full rounded-xl p-3 text-xs outline-none border
                      ${dark ? "bg-black border-white/10 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-800"}`}/>
                )}
              </div>

              {/* Amount */}
              <div>
                <p className={`text-[8px] font-black uppercase tracking-widest mb-1.5 ${t.subtext}`}>Amount (UGX)</p>
                <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)}
                  placeholder="0"
                  className={`w-full rounded-xl p-3 text-xs font-black outline-none border
                    ${dark ? "bg-black border-white/10 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-800"}`}/>
              </div>
            </div>

            {/* Description */}
            <div>
              <p className={`text-[8px] font-black uppercase tracking-widest mb-1.5 ${t.subtext}`}>Note (optional)</p>
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="e.g. Paid landlord for March"
                className={`w-full rounded-xl p-3 text-xs outline-none border
                  ${dark ? "bg-black border-white/10 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-800"}`}/>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)}
                className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase ${t.subtext}`}>
                Cancel
              </button>
              <button onClick={handleSave}
                disabled={saving || !newAmount}
                className={`flex-[2] py-3 rounded-xl font-black text-xs uppercase transition-all
                  ${!saving && newAmount
                    ? "bg-yellow-500 text-black hover:bg-yellow-400"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}>
                {saving ? "Saving…" : `Save for ${monthLabel(month)}`}
              </button>
            </div>
          </div>
        )}

        {/* Existing entries list */}
        <div className="p-4 space-y-2">
          {profitLoad ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className={`h-12 rounded-2xl animate-pulse ${dark ? "bg-zinc-800" : "bg-zinc-100"}`}/>)}
            </div>
          ) : fixedItems.length === 0 ? (
            <div className={`py-8 text-center border-2 border-dashed rounded-2xl ${dark ? "border-white/5" : "border-zinc-200"}`}>
              <p className={`text-[9px] font-black uppercase tracking-widest ${t.subtext}`}>
                No fixed expenses for {monthLabel(month)}
              </p>
              <p className={`text-[8px] mt-1 ${t.subtext} opacity-60`}>
                Click "Add" to enter rent, wages, stock etc.
              </p>
            </div>
          ) : (
            fixedItems.map(item => (
              <div key={item.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-2xl border group
                  ${dark ? "bg-zinc-900/40 border-white/5" : "bg-zinc-50 border-zinc-200"}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-black uppercase italic ${dark ? "text-white" : "text-zinc-900"}`}>
                    {item.category}
                  </p>
                  {item.description && (
                    <p className={`text-[8px] mt-0.5 ${t.subtext}`}>{item.description}</p>
                  )}
                  <p className={`text-[8px] mt-0.5 opacity-50 ${t.subtext}`}>
                    by {item.entered_by}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-sm font-black text-rose-400 italic">
                    UGX {Number(item.amount).toLocaleString()}
                  </p>
                  <button onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all">
                    {deletingId === item.id
                      ? <RefreshCw size={13} className="animate-spin"/>
                      : <Trash2 size={13}/>}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals footer */}
        {!profitLoad && fixedItems.length > 0 && (
          <div className={`flex items-center justify-between px-5 py-3 border-t ${t.divider}`}>
            <span className={`text-[9px] font-bold uppercase ${t.subtext}`}>
              {fixedItems.length} expense{fixedItems.length !== 1 ? "s" : ""} · {monthLabel(month)}
            </span>
            <span className="text-[10px] font-black text-rose-400">
              Total: UGX {Number(costs.fixed_total || 0).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* ── Credits Ledger ───────────────────────────────────────────────────── */}
      <div className={`${t.card} border rounded-2xl overflow-hidden`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${t.divider}`}>
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-purple-400" />
            <h3 className="text-[10px] font-black uppercase tracking-widest">Credits on Account</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-bold text-purple-400">
              UGX {totalOutstanding.toLocaleString()} outstanding
            </span>
            {creditsLoading && <RefreshCw size={12} className="text-zinc-500 animate-spin" />}
          </div>
        </div>

        <div className={`flex gap-1 p-3 border-b ${t.divider}`}>
          {[
            { key: "outstanding", label: "Outstanding", count: outstanding.length },
            { key: "settled",     label: "Settled",     count: settled.length },
            { key: "all",         label: "All",         count: creditsLedger.length },
          ].map(({ key, label, count }) => (
            <button key={key} onClick={() => setCreditFilter(key)}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5
                ${creditFilter === key ? "bg-yellow-500 text-black" : dark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}>
              {label}
              <span className={`w-4 h-4 rounded-full text-[8px] flex items-center justify-center font-black
                ${creditFilter === key ? "bg-black/20 text-black" : dark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-200 text-zinc-500"}`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
          {creditsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_,i) => (
                <div key={i} className={`h-16 rounded-2xl animate-pulse ${dark ? "bg-zinc-800" : "bg-zinc-200"}`} />
              ))}
            </div>
          ) : filteredCredits.length === 0 ? (
            <div className="py-10 text-center">
              <p className={`text-[10px] font-black uppercase tracking-widest ${t.subtext}`}>
                No {creditFilter} credits
              </p>
            </div>
          ) : (
            filteredCredits.map(credit => (
              <DirectorCreditRow key={credit.id} credit={credit} dark={dark} t={t} />
            ))
          )}
        </div>

        {!creditsLoading && creditsLedger.length > 0 && (
          <div className={`flex items-center justify-between px-5 py-3 border-t ${t.divider}`}>
            <span className={`text-[9px] font-bold uppercase ${t.subtext}`}>
              {creditsLedger.length} total · {outstanding.length} open
            </span>
            <span className="text-[9px] font-black text-purple-400">
              Recovered: UGX {totalSettled.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}