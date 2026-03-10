import React, { useState, useEffect } from "react";
import { ArrowDownRight, BookOpen, User, Phone, Calendar, RefreshCw } from "lucide-react";
import { useTheme } from "./shared/ThemeContext";
import { FinanceRow } from "./shared/UIHelpers";
import API_URL from "../../../config/api";

// ─── HELPER COMPONENT: DIRECTOR CREDIT ROW ─────────────────────────────────────
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

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function FinancesSection() {
  const { dark, t } = useTheme();
  const [revenue,    setRevenue]   = useState({ cash: 0, momo: 0, card: 0 });
  const [revLoading, setRevLoad]   = useState(true);
  const [expenses,   setExpenses]  = useState(0);
  const [expSaving,  setExpSaving] = useState(false);

  // Credits ledger state
  const [creditsLedger,  setCreditsLedger]  = useState([]);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [creditFilter,   setCreditFilter]   = useState("outstanding");

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/overview/summary?date=${today}`);
        if (res.ok) {
          const data = await res.json();
          setRevenue({
            cash: Number(data.total_cash || 0),
            momo: Number(data.total_momo || 0),
            card: Number(data.total_card || 0),
          });
          if (data.daily_expenses != null) setExpenses(Number(data.daily_expenses));
        }
      } catch (e) { console.error("Finance summary failed:", e); }
      finally { setRevLoad(false); }
    })();
  }, [today]);

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

  const saveExpenses = async (value) => {
    setExpSaving(true);
    try {
      await fetch(`${API_URL}/api/overview/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, amount: value }),
      });
    } catch (e) { console.error("Expense save failed:", e); }
    finally { setExpSaving(false); }
  };

  const total  = revenue.cash + revenue.momo + revenue.card;
  const net    = total - expenses;
  const margin = total > 0 ? ((net / total) * 100).toFixed(1) : 0;

  const outstanding      = creditsLedger.filter(c => !c.paid);
  const settled          = creditsLedger.filter(c => c.paid);
  const totalOutstanding = outstanding.reduce((s, c) => s + Number(c.amount), 0);
  const totalSettled     = settled.reduce((s, c) => s + Number(c.amount_paid || c.amount), 0);

  const filteredCredits  = creditsLedger.filter(c => {
    if (creditFilter === "outstanding") return !c.paid;
    if (creditFilter === "settled")     return c.paid;
    return true;
  });

  const Pulse = () => (
    <div className={`h-6 w-24 rounded-lg animate-pulse ${dark ? "bg-zinc-800" : "bg-zinc-200"}`} />
  );

  return (
    <div className="space-y-4">
      {/* Header + Export */}
      <div className={`flex justify-between items-center ${t.card} border p-4 rounded-2xl gap-3`}>
        <div>
          <h3 className="text-sm font-black uppercase italic">Financial Controller</h3>
          <p className={`text-[9px] font-bold uppercase ${t.subtext}`}>Revenue vs. Expenditure — {today}</p>
        </div>
        <button
          onClick={async () => {
            try {
              const res = await fetch(`${API_URL}/api/overview/export?date=${today}`);
              if (res.ok) {
                const blob = await res.blob();
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement("a");
                a.href = url; a.download = `finances_${today}.csv`; a.click();
                URL.revokeObjectURL(url);
              } else { alert("Export not available yet."); }
            } catch { alert("Export failed — check server."); }
          }}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black uppercase italic text-[10px] transition-colors shrink-0
            ${dark ? "bg-white text-black hover:bg-yellow-500" : "bg-zinc-900 text-white hover:bg-yellow-500 hover:text-black"}`}>
          <ArrowDownRight size={13} /> Export
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Expense input */}
        <div className={`${t.card} border p-5 rounded-2xl flex flex-col gap-4`}>
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">Daily Expenses</p>
            {expSaving && <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />}
          </div>
          <div className="relative">
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs ${t.subtext}`}>UGX</span>
            <input
              type="number"
              value={expenses}
              onChange={e => setExpenses(Number(e.target.value))}
              onBlur={e => saveExpenses(Number(e.target.value))}
              className={`w-full ${t.input} border p-3.5 pl-12 rounded-xl text-lg font-black focus:border-yellow-500 outline-none`}
            />
          </div>
          <p className={`text-[8px] font-bold uppercase italic ${t.subtext}`}>
            *rent, stock, wages — auto-saved on blur
          </p>
        </div>

        {/* Profit margin */}
        <div className={`${t.card} border p-5 rounded-2xl flex flex-col justify-center relative overflow-hidden`}>
          <div className={`absolute -right-4 -top-4 w-20 h-20 blur-3xl rounded-full
            ${Number(margin) > 0 ? "bg-emerald-500/20" : "bg-rose-500/20"}`} />
          <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${t.subtext}`}>Net Profit Margin</p>
          {revLoading
            ? <Pulse />
            : <h4 className={`text-5xl font-black italic ${Number(margin) > 20 ? "text-emerald-500" : "text-rose-500"}`}>
                {margin}%
              </h4>
          }
          <p className={`text-[10px] font-bold uppercase mt-2 ${t.subtext}`}>
            {revLoading ? "—" : `UGX ${net.toLocaleString()} take-home`}
          </p>
        </div>

        {/* Breakdown */}
        <div className={`${t.card} border p-5 rounded-2xl space-y-3`}>
          <p className={`text-[9px] font-black uppercase tracking-widest ${t.subtext}`}>Breakdown</p>
          {revLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Pulse key={i} />)}</div>
          ) : (
            <>
              <FinanceRow label="Cash Sales"  value={revenue.cash} color="text-emerald-400" />
              <FinanceRow label="MoMo Sales"  value={revenue.momo} color="text-yellow-400" />
              <FinanceRow label="Card Sales"  value={revenue.card} color="text-blue-400" />
              <FinanceRow label="Total Sales" value={total}        color="text-white" />
              <FinanceRow label="Total Costs" value={expenses}     color="text-rose-500" />
              <div className={`pt-2 border-t ${t.divider}`}>
                <FinanceRow label="Net Balance" value={net} color="text-emerald-500" bold />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Credits Ledger ── */}
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