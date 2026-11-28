import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRight, Banknote, BookOpen,
  CheckCircle2, CircleAlert, Clock3, CreditCard, DollarSign,
  ExternalLink, Flag, Loader2, RefreshCw, ShieldCheck, Smartphone,
  WalletCards, XCircle
} from "lucide-react";
import { fmt, kampalaDate } from "../utils/helpers";
import { RevenueChart } from "../../Director/charts";
import MonthlyFinancialBreakdown from "../../components/MonthlyFinancialBreakdown";
import API_URL from "../../../config/api";

const MAROON = "#651b32";
const TODAY = kampalaDate();

function amount(value, available = true) {
  if (!available || value === null || value === undefined || Number.isNaN(Number(value))) return "Not available";
  return `UGX ${fmt(value)}`;
}

function statusLabel(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "pendingmanager" || normalized === "pendingmanagerapproval") return "Pending manager";
  if (normalized === "pendingcashier") return "Pending cashier";
  if (normalized === "partiallysettled") return "Partially settled";
  if (normalized === "fullysettled" || normalized === "settled") return "Settled";
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  return status || "Not available";
}

function isApprovedCredit(credit) {
  const status = String(credit?.status || "").trim().toLowerCase();
  return ["approved", "partiallysettled", "fullysettled", "settled"].includes(status);
}

function creditBalance(credit) {
  return Math.max(0, Number(credit?.balance ?? (Number(credit?.amount || 0) - Number(credit?.amount_paid || 0))) || 0);
}

function dueState(credit) {
  if (!credit?.pay_by || !isApprovedCredit(credit) || creditBalance(credit) <= 0) return "none";
  const due = String(credit.pay_by).slice(0, 10);
  if (due < TODAY) return "overdue";
  if (due === TODAY) return "today";
  return "future";
}

function SectionHeader({ eyebrow, title, detail, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-600">{eyebrow}</p>
        <h2 className="text-lg sm:text-xl font-black tracking-tight text-gray-900 mt-1">{title}</h2>
        {detail && <p className="text-[11px] text-gray-500 mt-1">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function Panel({ children, className = "" }) {
  return <section className={`bg-white border border-gray-200 rounded-2xl shadow-sm ${className}`}>{children}</section>;
}

function DataValue({ value, available = true, className = "" }) {
  return <span className={available ? className : "text-gray-400 italic text-xs"}>{available ? value : "Not available"}</span>;
}

function Severity({ level }) {
  const config = {
    high: { label: "High", className: "bg-red-50 text-red-700 border-red-200" },
    medium: { label: "Review", className: "bg-amber-50 text-amber-700 border-amber-200" },
    low: { label: "Open", className: "bg-blue-50 text-blue-700 border-blue-200" },
  }[level] || { label: "Review", className: "bg-gray-50 text-gray-600 border-gray-200" };
  return <span className={`px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-wider ${config.className}`}>{config.label}</span>;
}

function KpiCard({ icon, label, value, detail, accent = "text-gray-900", available = true }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm min-h-[128px]">
      <div className="flex items-start justify-between gap-3">
        <div className="p-2 rounded-xl bg-gray-50 border border-gray-100">{icon}</div>
        <span className="text-[8px] text-gray-400 uppercase tracking-widest text-right">Today</span>
      </div>
      <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider mt-4">{label}</p>
      <p className={`text-xl font-black mt-1 break-words ${available ? accent : "text-gray-400"}`}>
        <DataValue value={value} available={available} />
      </p>
      {detail && <p className="text-[10px] text-gray-500 mt-1">{detail}</p>}
    </div>
  );
}

export default function ReconciliationOverview({
  dayClosed,
  sys,
  physCash,
  physMomoMTN,
  physMomoAirtel,
  physCard,
  pettyCashIn,
  pettyCashToday,
  varCash,
  varMTN,
  varAirtel,
  varCard,
  varTotal,
  hasPhysicalCount,
  creditsLedger,
  creditsLoading,
  voidRequests,
  voidRequestsLoading,
  profitData,
  profitLoad,
  selectedMonth,
  setSelectedMonth,
  userName,
  summaryAvailable,
  setActiveSection,
  handleDayClosure,
  isFinalizing,
}) {
  const [methodFilter, setMethodFilter] = useState("All methods");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [monthlySummaryLoading, setMonthlySummaryLoading] = useState(false);
  const [monthlySummaryError, setMonthlySummaryError] = useState("");

  useEffect(() => {
    let active = true;
    const loadMonthlySummary = async () => {
      setMonthlySummary(null);
      setMonthlySummaryError("");
      setMonthlySummaryLoading(true);
      try {
        const response = await fetch(
          `${API_URL}/api/manager/target-progress?month=${encodeURIComponent(selectedMonth)}`
        );
        if (!response.ok) throw new Error(`Monthly financial summary request failed (${response.status}).`);
        const data = await response.json();
        if (active) setMonthlySummary(data);
      } catch (requestError) {
        console.error("Failed to load accountant monthly financial chart:", requestError);
        if (active) setMonthlySummaryError("Unable to load the monthly financial chart.");
      } finally {
        if (active) setMonthlySummaryLoading(false);
      }
    };

    loadMonthlySummary();
    return () => {
      active = false;
    };
  }, [selectedMonth]);

  const physicalAvailable = hasPhysicalCount && !dayClosed;
  const creditRows = useMemo(() => {
    const rows = Array.isArray(creditsLedger) ? creditsLedger : [];
    return rows.filter(row => {
      const methodMatch = methodFilter === "All methods" || methodFilter === "Credit";
      const statusMatch = statusFilter === "All statuses" || statusLabel(row.status) === statusFilter;
      return methodMatch && statusMatch;
    });
  }, [creditsLedger, methodFilter, statusFilter]);

  const approvedCredits = (creditsLedger || []).filter(isApprovedCredit).filter(credit => creditBalance(credit) > 0 || Number(credit.amount_paid || 0) > 0);
  const pendingManager = (creditsLedger || []).filter(credit => ["pendingmanager", "pendingmanagerapproval"].includes(String(credit.status || "").toLowerCase()));
  const pendingCashier = (creditsLedger || []).filter(credit => String(credit.status || "").toLowerCase() === "pendingcashier");
  const settledCredits = (creditsLedger || []).filter(credit => ["fullysettled", "settled"].includes(String(credit.status || "").toLowerCase()));
  const partiallyPaidCredits = (creditsLedger || []).filter(credit => String(credit.status || "").toLowerCase() === "partiallysettled");
  const outstandingCredits = approvedCredits.reduce((sum, credit) => sum + creditBalance(credit), 0);
  const totalPartiallyPaid = partiallyPaidCredits.reduce((sum, credit) => sum + Number(credit.amount_paid || 0), 0);
  const totalSettled = settledCredits.reduce((sum, credit) => sum + Number(credit.amount_paid || credit.amount || 0), 0);
  const totalExpected = approvedCredits.reduce((sum, credit) => sum + Number(credit.amount || 0), 0);
  const dueToday = approvedCredits.filter(credit => dueState(credit) === "today").reduce((sum, credit) => sum + creditBalance(credit), 0);
  const overdue = approvedCredits.filter(credit => dueState(credit) === "overdue").reduce((sum, credit) => sum + creditBalance(credit), 0);
  const aging = {
    today: approvedCredits.filter(credit => dueState(credit) === "today").length,
    week: approvedCredits.filter(credit => {
      if (!credit.pay_by) return false;
      const days = Math.ceil((new Date(`${String(credit.pay_by).slice(0, 10)}T00:00:00`) - new Date(`${TODAY}T00:00:00`)) / 86400000);
      return days >= 1 && days <= 7;
    }).length,
    month: approvedCredits.filter(credit => {
      if (!credit.pay_by) return false;
      const days = Math.ceil((new Date(`${String(credit.pay_by).slice(0, 10)}T00:00:00`) - new Date(`${TODAY}T00:00:00`)) / 86400000);
      return days >= 8 && days <= 30;
    }).length,
    older: approvedCredits.filter(credit => {
      if (!credit.pay_by) return false;
      const days = Math.ceil((new Date(`${String(credit.pay_by).slice(0, 10)}T00:00:00`) - new Date(`${TODAY}T00:00:00`)) / 86400000);
      return days > 30 || days < 0;
    }).length,
  };

  const physicalRows = [
    { label: "Cash", icon: <Banknote size={15} className="text-emerald-600" />, expected: sys.cash, counted: physCash, variance: varCash },
    { label: "MTN", icon: <Smartphone size={15} className="text-yellow-600" />, expected: sys.mtn, counted: physMomoMTN, variance: varMTN },
    { label: "Airtel", icon: <Smartphone size={15} className="text-red-600" />, expected: sys.airtel, counted: physMomoAirtel, variance: varAirtel },
    { label: "Card", icon: <CreditCard size={15} className="text-blue-600" />, expected: sys.card, counted: physCard, variance: varCard },
  ];

  const exceptions = [
    !hasPhysicalCount && !dayClosed ? { key: "count", level: "high", title: "Physical counts missing", detail: "Cash, MTN, Airtel, and Card counts have not been submitted.", owner: userName, action: "PHYSICAL_COUNT", actionLabel: "Enter counts" } : null,
    voidRequests?.length ? { key: "voids", level: "high", title: `${voidRequests.length} void request${voidRequests.length === 1 ? "" : "s"} unresolved`, detail: "Review unapproved voids before closing the day.", owner: "Accountant", action: "LIVE_AUDIT", actionLabel: "Review voids" } : null,
    varTotal < 0 ? { key: "variance", level: "high", title: "Shortage requires explanation", detail: `The combined physical count is ${amount(Math.abs(varTotal))} below system expectation.`, owner: userName, action: "PHYSICAL_COUNT", actionLabel: "Explain variance" } : null,
    pendingManager.length + pendingCashier.length ? { key: "credits", level: "medium", title: "Credit approvals unresolved", detail: `${pendingManager.length} manager and ${pendingCashier.length} cashier request${pendingManager.length + pendingCashier.length === 1 ? "" : "s"} pending.`, owner: "Cashier / Manager", action: "CREDITS", actionLabel: "Open credits" } : null,
    !dayClosed ? { key: "shift", level: "medium", title: "Day is not closed", detail: "The reconciliation gate is still open.", owner: userName, action: "END_OF_SHIFT", actionLabel: "Review close" } : null,
  ].filter(Boolean);

  const netCollected = summaryAvailable ? Number(sys.gross || 0) + Number(sys.credit_settlements || 0) : 0;
  const hasMonthlyProfit = Boolean(profitData?.sales || profitData?.costs);
  const monthlyRevenue = Number(profitData?.sales?.total_gross ?? 0) > 0
    ? Number(profitData?.sales?.total_gross ?? 0)
    : (Number(profitData?.sales?.from_paid_orders ?? 0) + Number(profitData?.sales?.from_credit_settlements ?? 0));
  const monthlyExpenses = profitData?.costs?.total;
  const monthlyNet = profitData?.net_profit;
  const checklist = [
    { label: "Payments confirmed", done: summaryAvailable },
    { label: "Shifts submitted", done: summaryAvailable && Number(sys.orders || 0) > 0 },
    { label: "Counts entered", done: hasPhysicalCount },
    { label: "Variances explained", done: hasPhysicalCount && varTotal === 0 },
    { label: "Petty cash logged", done: pettyCashToday !== null && pettyCashToday !== undefined },
    { label: "Voids resolved", done: !voidRequests?.length },
  ];
  const canClose = !dayClosed && hasPhysicalCount;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {monthlySummaryLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm font-bold text-gray-500">
          Loading monthly financial chart...
        </div>
      ) : monthlySummaryError ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {monthlySummaryError}
        </div>
      ) : monthlySummary ? (
        <MonthlyFinancialBreakdown
          month={selectedMonth}
          target={monthlySummary.target}
          grossSales={monthlySummary.grossSales}
          complimentaryPaid={monthlySummary.complimentaryPaid}
          complimentaryWaived={monthlySummary.complimentaryWaived}
          creditSettlements={monthlySummary.creditSettlements}
          creditBalance={monthlySummary.creditBalance}
          expenses={monthlySummary.expenses}
          currentCash={monthlySummary.currentCash}
          remaining={monthlySummary.remaining}
          percentage={monthlySummary.percentage}
        />
      ) : null}

      <Panel className="p-5 sm:p-6">
        <SectionHeader eyebrow="Revenue flow" title="Revenue flow" detail="Paid orders plus all collected credit payments, including partial and full settlements." />
        <div className="w-full overflow-hidden"><RevenueChart /></div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <SectionHeader eyebrow="Priority control" title="Payment reconciliation" detail="System expected against physical count. Variance is physical count minus system expected." action={<span className="text-[9px] font-black uppercase tracking-wider" style={{ color: MAROON }}>Cash controls</span>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead><tr className="border-y border-gray-100 text-[8px] uppercase tracking-widest text-gray-400"><th className="py-3 pr-4">Channel</th><th className="py-3 pr-4">System expected</th><th className="py-3 pr-4">Physical count</th><th className="py-3 pr-4">Variance</th><th className="py-3">Status</th></tr></thead>
            <tbody>
              {physicalRows.map(row => {
                const balanced = row.variance === 0;
                const available = summaryAvailable && physicalAvailable;
                const shortage = Number(row.variance) < 0;
                return <tr key={row.label} className="border-b border-gray-50 last:border-0 text-sm">
                  <td className="py-4 pr-4"><span className="inline-flex items-center gap-2 font-black text-gray-800">{row.icon}{row.label}</span></td>
                  <td className="py-4 pr-4 font-bold text-gray-700"><DataValue value={amount(row.expected)} available={summaryAvailable} /></td>
                  <td className="py-4 pr-4 font-bold text-gray-700"><DataValue value={amount(row.counted)} available={available} /></td>
                  <td className={`py-4 pr-4 font-black ${!available ? "text-gray-400" : balanced ? "text-emerald-700" : shortage ? "text-red-700" : "text-blue-700"}`}><DataValue value={amount(row.variance)} available={available} /></td>
                  <td className="py-4"><span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase ${!available ? "bg-gray-100 text-gray-500" : balanced ? "bg-emerald-50 text-emerald-700" : shortage ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{!available ? "Not available" : balanced ? "Balanced" : shortage ? "Short" : "Over"}</span></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
          <span className="text-[9px] font-black uppercase tracking-wider text-gray-500">Combined variance</span>
          <span className={`text-sm font-black ${physicalAvailable ? varTotal < 0 ? "text-red-700" : varTotal === 0 ? "text-emerald-700" : "text-blue-700" : "text-gray-400"}`}>{physicalAvailable ? amount(varTotal) : "Not available"}</span>
        </div>
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Panel className="p-5 sm:p-6 xl:col-span-3">
          <SectionHeader eyebrow="Receivables" title="Credit risk" detail="Approved credit is outstanding receivable. Settlements are collected cash, not new sales." action={<button onClick={() => setActiveSection("CREDITS")} className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-yellow-700 hover:text-yellow-800">Open ledger <ArrowRight size={12} /></button>} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              ["Total outstanding", outstandingCredits, "text-purple-700"],
              ["Total partially paid", totalPartiallyPaid, "text-amber-700"],
              ["Total settled", totalSettled, "text-emerald-700"],
              ["Total expected", totalExpected, "text-[#651b32]"],
            ].map(([label, value, color]) => (
              <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <p className="text-[8px] font-black uppercase text-gray-500 tracking-wider">{label}</p>
                <p className={`text-base font-black mt-1 ${color}`}>{amount(value, creditsLedger != null)}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3 sticky top-0 bg-white py-2 z-10">
            <select value={methodFilter} onChange={event => setMethodFilter(event.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-2 text-[9px] font-bold text-gray-700 bg-white"><option>All methods</option><option>Credit</option></select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-2 text-[9px] font-bold text-gray-700 bg-white"><option>All statuses</option><option>Pending manager</option><option>Pending cashier</option><option>Approved</option><option>Partially settled</option><option>Settled</option></select>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[590px] text-left"><thead><tr className="border-y border-gray-100 text-[8px] uppercase tracking-widest text-gray-400"><th className="py-3 pr-3">Client / owner</th><th className="py-3 pr-3">Due</th><th className="py-3 pr-3">Balance</th><th className="py-3">Status</th></tr></thead><tbody>{creditsLoading ? <tr><td colSpan="4" className="py-8 text-center text-xs text-gray-400"><Loader2 size={15} className="inline animate-spin mr-2" />Loading credits</td></tr> : creditRows.length ? creditRows.sort((a, b) => creditBalance(b) - creditBalance(a)).slice(0, 6).map(credit => <tr key={credit.id} className="border-b border-gray-50 last:border-0 text-xs"><td className="py-3 pr-3"><p className="font-black text-gray-800">{credit.client_name || "Not available"}</p><p className="text-[9px] text-gray-500">{credit.waiter_name || credit.forwarded_by || "Owner not available"}</p></td><td className="py-3 pr-3 text-gray-600">{credit.pay_by ? String(credit.pay_by).slice(0, 10) : "Not available"}</td><td className="py-3 pr-3 font-black text-gray-800">{amount(creditBalance(credit))}</td><td className="py-3"><span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-[8px] font-black uppercase">{statusLabel(credit.status)}</span></td></tr>) : <tr><td colSpan="4" className="py-8 text-center text-xs text-gray-400">{creditsLedger == null ? "Data source error." : "No credit records"}</td></tr>}</tbody></table></div>
        </Panel>

        <Panel className="p-5 sm:p-6 xl:col-span-2">
          <SectionHeader eyebrow="Profitability" title="Revenue and expense impact" detail={`Existing monthly source: ${selectedMonth || "Not available"}`} action={<select value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} className="border border-gray-200 rounded-lg px-2 py-2 text-[9px] font-bold text-gray-700 bg-white"><option value={selectedMonth}>{selectedMonth}</option><option value={`${new Date().getFullYear()}-${String(new Date().getMonth()).padStart(2, "0")}`}>{`${new Date().getFullYear()}-${String(new Date().getMonth()).padStart(2, "0")}`}</option></select>} />
          <div className="space-y-3">
            {[["Revenue", monthlyRevenue, "text-emerald-700"], ["Expenses", monthlyExpenses, "text-red-700"], ["Petty cash outflow", pettyCashToday?.total_out, "text-orange-700"]].map(([label, value, color]) => <div key={label} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3"><span className="text-[10px] font-bold text-gray-600">{label}</span><span className={`font-black ${color}`}>{amount(value, label === "Petty cash outflow" ? pettyCashToday != null : hasMonthlyProfit)}</span></div>)}
            <div className="rounded-xl p-4 mt-4" style={{ backgroundColor: `${MAROON}0d`, border: `1px solid ${MAROON}26` }}><p className="text-[8px] font-black uppercase tracking-widest" style={{ color: MAROON }}>Net result</p><p className="text-xl font-black mt-1" style={{ color: MAROON }}>{amount(monthlyNet, hasMonthlyProfit)}</p><p className="text-[9px] text-gray-500 mt-2">Estimated COGS: Not available</p></div>
            {profitLoad && <p className="text-[9px] text-gray-400">Refreshing monthly figures…</p>}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Panel className="p-5 sm:p-6 xl:col-span-3">
          <SectionHeader eyebrow="Control exceptions" title="Audit and exceptions" detail="Open each source module to investigate and assign responsibility." />
          <div className="divide-y divide-gray-100">{exceptions.length ? exceptions.map(item => <div key={item.key} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center gap-3"><div className="flex items-start gap-3 flex-1"><div className="p-2 rounded-xl bg-gray-50 border border-gray-100"><Flag size={15} className={item.level === "high" ? "text-red-600" : "text-amber-600"} /></div><div><p className="text-sm font-black text-gray-800">{item.title}</p><p className="text-[10px] text-gray-500 mt-1">{item.detail}</p><p className="text-[9px] text-gray-400 mt-1">Owner: {item.owner}</p></div></div><div className="flex items-center gap-2 shrink-0"><Severity level={item.level} /><button onClick={() => setActiveSection(item.action)} className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-gray-900 text-white text-[8px] font-black uppercase">{item.actionLabel} <ExternalLink size={11} /></button></div></div>) : <div className="py-8 text-center text-xs text-emerald-700">No known exceptions.</div>}</div>
          {voidRequestsLoading && <p className="text-[9px] text-gray-400 mt-4">Refreshing audit data…</p>}
        </Panel>

        <Panel className="p-5 sm:p-6 xl:col-span-2">
          <SectionHeader eyebrow="Closure gate" title="Day-closure checklist" detail="The existing close-day action remains unchanged." />
          <div className="space-y-3">{checklist.map(item => <div key={item.label} className="flex items-center gap-3"><div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${item.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{item.done ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}</div><span className={`text-[10px] font-bold ${item.done ? "text-gray-700" : "text-amber-700"}`}>{item.label}</span></div>)}</div>
          <div className="mt-5 pt-4 border-t border-gray-100"><button onClick={handleDayClosure} disabled={isFinalizing || !canClose} className={`w-full py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 ${isFinalizing || !canClose ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-yellow-500 text-black hover:bg-yellow-600"}`}>{isFinalizing ? <><RefreshCw size={14} className="animate-spin" /> Closing…</> : dayClosed ? <><CheckCircle2 size={14} /> Day closed</> : <><ShieldCheck size={14} /> Review and close day</>}</button><p className="text-[9px] text-gray-400 text-center mt-2">{!hasPhysicalCount && !dayClosed ? "Physical counts are required before closing." : exceptions.length ? "Review exceptions before final closure." : "All available controls are ready."}</p></div>
        </Panel>
      </div>
    </div>
  );
}
