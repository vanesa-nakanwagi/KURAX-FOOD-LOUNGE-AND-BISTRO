import React, { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Landmark,
  RefreshCw,
  RotateCcw,
  Wallet,
} from "lucide-react";
import * as XLSX from "xlsx";
import API_URL from "../../config/api";
import { downloadReportPdf } from "../reportExport";
import ReportsPanel from "./ReportsPanel";

const VIEWS = [
  { key: "accounts", label: "Chart of Accounts", icon: BookOpen },
  { key: "cash", label: "Cash / Bank", icon: Wallet },
  { key: "journals", label: "Journal Entries", icon: FileText },
  { key: "ledger", label: "General Ledger", icon: Landmark },
  { key: "audit", label: "Audit Trail", icon: ClipboardList },
  { key: "trial", label: "Trial Balance", icon: CircleDollarSign },
  { key: "receivable", label: "Accounts Receivable", icon: CircleDollarSign },
  { key: "payable", label: "Accounts Payable", icon: CircleDollarSign },
  { key: "periods", label: "Accounting Periods", icon: CalendarDays },
  { key: "cashflow", label: "Cash Flow", icon: Wallet },
  { key: "statements", label: "Financial Statements", icon: FileSpreadsheet },
  { key: "expenses", label: "Expense Management", icon: CircleDollarSign },
];

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 7)}-01`;

async function requestJSON(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function getAccountantName() {
  try {
    return JSON.parse(localStorage.getItem("kurax_user") || "{}").name?.trim() || "Accountant";
  } catch {
    return "Accountant";
  }
}

function formatUGX(value) {
  const amount = Number(value || 0);
  return `UGX ${amount.toLocaleString()}`;
}

function formatSourceReference(source) {
  const value = String(source || '').trim();
  if (!value) return 'Manual entry';

  const [type, ...referenceParts] = value.split(':');
  const reference = referenceParts.join(':');
  const labels = {
    backdated_expense: 'Backdated expense',
    cashier_expense: 'Cashier expense',
    cashier_queue: 'Cashier sale',
    credit_settlement: 'Credit settlement',
    monthly_expense: 'Monthly expense',
    petty_cash: 'Petty cash entry',
    sale: 'Sale',
  };
  const label = labels[type.toLowerCase()];

  if (label) {
    const displayReference = type.toLowerCase() === 'cashier_queue' && reference
      ? `Queue #${reference}`
      : reference;
    return displayReference ? `${label} · ${displayReference}` : label;
  }
  if (/^PUR-/i.test(value)) return `Inventory purchase · ${value}`;
  if (/^WASTE-/i.test(value)) return `Inventory waste · ${value}`;
  return value;
}

function getTableModel(view, data) {
  if (!data) return { columns: [], rows: [] };

  if (view === "accounts") {
    return {
      columns: ["Code", "Account", "Category", "Account Type", "Normal Balance", "Status"],
      rows: (data.accounts || []).map((account) => [account.code, account.name, account.category, account.account_type, account.normal_balance, account.is_active ? "Active" : "Inactive"]),
    };
  }

  if (view === "cash") {
    const assetAccounts = [
      ...(data.balanceSheet?.assets?.current_accounts || []),
      ...(data.balanceSheet?.assets?.non_current_accounts || []),
    ];
    const balances = new Map(assetAccounts.map((account) => [account.account_code, account.balance]));
    const accounts = (data.accounts || []).filter((account) => ["cash", "bank", "mobile money"].includes(String(account.account_type || "").toLowerCase()));
    return {
      columns: ["Code", "Account", "Account Type", "Balance (UGX)"],
      rows: accounts.map((account) => [account.code, account.name, account.account_type, Number(balances.get(account.code) || 0)]),
    };
  }

  if (view === "journals") {
    const rows = (data.entries || []).map((entry) => {
      const lines = entry.lines || [];
      const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
      const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
      const relatedEntry = entry.reversal_of_reference
        ? `Reversal of ${entry.reversal_of_reference}`
        : entry.reversed_by_reference
          ? `Reversed by ${entry.reversed_by_reference}`
          : "";
      return [
      entry.reference,
      entry.entry_date?.slice(0, 10),
      entry.business_time?.slice(0, 5),
      entry.posted_at ? new Date(entry.posted_at).toLocaleString("en-GB", { timeZone: "Africa/Kampala" }) : "",
      entry.description,
      totalDebit,
      totalCredit,
      entry.status,
      relatedEntry,
      entry.reversal_reason || "",
      entry.posted_by || "",
      ];
    });
    return { columns: ["Journal Ref", "Transaction Date", "Business Time", "Posted On", "Description", "Debit Total (UGX)", "Credit Total (UGX)", "Status", "Linked Entry", "Reversal Reason", "Posted By"], rows };
  }

  if (view === "ledger") {
    return {
      columns: ["Transaction Date", "Business Time", "Posted On", "Account Code", "Account", "Description", "Source / Reference", "Debit (UGX)", "Credit (UGX)", "Posted By"],
      rows: (data.entries || []).map((entry) => [entry.entry_date?.slice(0, 10), entry.business_time?.slice(0, 5) || "-", entry.created_at ? new Date(entry.created_at).toLocaleString("en-GB", { timeZone: "Africa/Kampala" }) : "", entry.account_code, entry.account_name, entry.description, formatSourceReference(entry.source_transaction), Number(entry.debit || 0), Number(entry.credit || 0), entry.posted_by]),
    };
  }

  if (view === "trial") {
    return {
      columns: ["Account Code", "Account", "Total Debit (UGX)", "Total Credit (UGX)", "Net Balance (UGX)"],
      rows: (data.trial_balance || []).map((row) => [row.account_code, row.account_name, Number(row.total_debit || 0), Number(row.total_credit || 0), Number(row.balance || 0)]),
    };
  }

  if (view === "receivable" || view === "payable") {
    const receivable = view === "receivable";
    return {
      columns: ["Reference", receivable ? "Customer" : "Supplier", "Amount (UGX)", "Paid (UGX)", "Outstanding (UGX)", "Status", "Due Date"],
      rows: (data.entries || []).map((entry) => [entry.reference, receivable ? entry.customer_name : entry.supplier_name, Number(entry.amount || 0), Number(entry.amount_paid || 0), Number(entry.outstanding_balance || 0), entry.status, entry.due_date?.toString().slice(0, 10) || ""]),
    };
  }

  if (view === "periods") {
    return {
      columns: ["Period", "Start Date", "End Date", "Status", "Created By", "Closed At"],
      rows: (data.periods || []).map((period) => [period.period_name, period.start_date?.slice(0, 10), period.end_date?.slice(0, 10), period.status, period.created_by, period.closed_at?.slice(0, 10) || ""]),
    };
  }

  if (view === "audit") {
    return {
      columns: ["Date", "Entity", "Entity ID", "Action", "Actor", "Details"],
      rows: (data.entries || []).map((entry) => [entry.created_at?.toString().slice(0, 19), entry.entity_type, entry.entity_id, entry.action, entry.actor, typeof entry.details === "string" ? entry.details : JSON.stringify(entry.details || {})]),
    };
  }

  if (view === "cashflow") {
    return {
      columns: ["Cash Flow Activity", "Amount (UGX)"],
      rows: [
        ["Opening Cash", Number(data.opening_cash || 0)],
        ["Cash Received from Customers", Number(data.operating_activities?.cash_received_from_customers || 0)],
        ["Cash Paid for Expenses", Number(data.operating_activities?.cash_paid_for_expenses || 0)],
        ["Net Change in Cash", Number(data.net_change_in_cash || 0)],
        ["Closing Cash", Number(data.closing_cash || 0)],
      ],
    };
  }

  return { columns: [], rows: [] };
}

export default function AccountingCenter({ setActiveSection, initialDateRange, timeRange, onDateRangeChange }) {
  const [view, setView] = useState("accounts");
  const [dateRange, setDateRange] = useState(initialDateRange || { start: monthStart, end: today });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [periodForm, setPeriodForm] = useState({ period_name: today.slice(0, 7), start_date: monthStart, end_date: today });
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [reversalForm, setReversalForm] = useState(null);
  const [savingReversal, setSavingReversal] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (initialDateRange?.start && initialDateRange?.end) setDateRange(initialDateRange);
  }, [initialDateRange?.start, initialDateRange?.end]);

  const changeDateRange = (nextRange) => {
    setDateRange(nextRange);
    onDateRangeChange?.(nextRange);
  };

  const loadView = useCallback(async (targetView = view) => {
    if (["statements", "expenses"].includes(targetView)) return;
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ startDate: dateRange.start, endDate: dateRange.end });
    if (timeRange?.start) query.set("startTime", timeRange.start);
    if (timeRange?.end) query.set("endTime", timeRange.end);
    const asOfQuery = new URLSearchParams({ asOfDate: dateRange.end });
    if (timeRange?.start) asOfQuery.set("startTime", timeRange.start);
    if (timeRange?.end) asOfQuery.set("endTime", timeRange.end);
    const base = `${API_URL}/api/accountant/accounting`;
    try {
      let result;
      if (targetView === "accounts") result = await requestJSON(`${base}/chart-of-accounts`);
      if (targetView === "cash") {
        const [accounts, balanceSheet] = await Promise.all([
          requestJSON(`${base}/chart-of-accounts`),
          requestJSON(`${base}/balance-sheet?${asOfQuery}`),
        ]);
        result = { accounts: accounts.accounts, balanceSheet };
      }
      if (targetView === "journals") result = await requestJSON(`${base}/journal-entries?${query}&limit=500`);
      if (targetView === "ledger") result = await requestJSON(`${base}/general-ledger?${query}`);
      if (targetView === "audit") result = await requestJSON(`${base}/audit-trail`);
      if (targetView === "trial") result = await requestJSON(`${base}/trial-balance?${query}`);
      if (targetView === "receivable") result = await requestJSON(`${base}/accounts-receivable?${query}`);
      if (targetView === "payable") result = await requestJSON(`${base}/accounts-payable?${query}`);
      if (targetView === "periods") result = await requestJSON(`${base}/periods`);
      if (targetView === "cashflow") result = await requestJSON(`${base}/cash-flow?${query}`);
      setData(result);
    } catch (loadError) {
      setData(null);
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [dateRange, timeRange, view]);

  useEffect(() => {
    loadView(view);
  }, [view, loadView]);

  const table = getTableModel(view, data);
  const viewLabel = VIEWS.find((item) => item.key === view)?.label || "Accounting";

  const exportPDF = () => {
    if (!table.rows.length) return;
    downloadReportPdf({
      filename: `${view.replaceAll("_", "-")}_${dateRange.end}.pdf`,
      title: viewLabel,
      companyName: "KURAX FOOD LOUNGE AND BISTRO",
      periodText: `Period: ${dateRange.start} to ${dateRange.end}${timeRange?.start || timeRange?.end ? `, ${timeRange.start || "00:00"} to ${timeRange.end || "23:59"}` : ""}`,
      footerLabel: "Accounting Report",
      from: dateRange.start,
      to: dateRange.end,
      orientation: table.columns.length > 5 ? "landscape" : "portrait",
      sections: [{
        title: viewLabel,
        columns: table.columns,
        rows: table.rows.map((row) => row.map((value) => typeof value === "number" ? formatUGX(value) : value ?? "")),
      }],
    });
  };

  const exportExcel = () => {
    if (!table.rows.length) return;
    const worksheet = XLSX.utils.aoa_to_sheet([
      [viewLabel],
      ["KURAX FOOD LOUNGE AND BISTRO"],
      ["Period", `${dateRange.start} to ${dateRange.end}`],
      ...(timeRange?.start || timeRange?.end ? [["Time", `${timeRange.start || "00:00"} to ${timeRange.end || "23:59"}`]] : []),
      [],
      table.columns,
      ...table.rows,
    ]);
    worksheet["!cols"] = table.columns.map((column) => ({ wch: Math.max(16, column.length + 4) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Accounting");
    XLSX.writeFile(workbook, `${view.replaceAll("_", "-")}_${dateRange.end}.xlsx`);
  };

  const savePeriod = async (event) => {
    event.preventDefault();
    setSavingPeriod(true);
    setError("");
    try {
      await requestJSON(`${API_URL}/api/accountant/accounting/periods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...periodForm, created_by: getAccountantName() }),
      });
      await loadView("periods");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingPeriod(false);
    }
  };

  const submitReversal = async (event) => {
    event.preventDefault();
    if (!reversalForm) return;
    setSavingReversal(true);
    setError("");
    setNotice("");
    try {
      const actor = getAccountantName();
      const result = await requestJSON(`${API_URL}/api/accountant/accounting/journal-entries/${reversalForm.entry.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reversalDate: reversalForm.reversalDate, reason: reversalForm.reason, actor }),
      });
      setReversalForm(null);
      setNotice(`Reversal ${result.reversal.reference} posted for ${result.effectiveDate}.`);
      await loadView("journals");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingReversal(false);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[10px] font-black uppercase tracking-widest text-yellow-600">Accountant Workspace</p>
        <h2 className="mt-1 text-2xl font-black text-gray-900">Accounting Centre</h2>
      </header>

      <nav aria-label="Accounting views" className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-2">
        {VIEWS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-xs font-bold transition-colors ${view === item.key ? "border-yellow-500 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-900"}`}
            >
              <Icon size={15} /> {item.label}
            </button>
          );
        })}
      </nav>

      {view === "statements" && <ReportsPanel initialDateRange={dateRange} timeRange={timeRange} onDateRangeChange={changeDateRange} />}

      {view === "expenses" && (
        <section className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 py-5">
          <div>
            <h3 className="font-bold text-gray-900">Expense Management</h3>
            <p className="mt-1 text-sm text-gray-500">Open the existing Monthly Costs ledger to record and review expenses.</p>
          </div>
          <button onClick={() => setActiveSection("MONTHLY_COSTS")} className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-600">
            Open Monthly Costs
          </button>
        </section>
      )}

      {!['statements', 'expenses'].includes(view) && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-200 pb-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-[10px] font-bold uppercase text-gray-500">
                From
                <input type="date" value={dateRange.start} onChange={(event) => changeDateRange({ ...dateRange, start: event.target.value })} className="mt-1 block rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
              </label>
              <label className="text-[10px] font-bold uppercase text-gray-500">
                To / As of
                <input type="date" value={dateRange.end} onChange={(event) => changeDateRange({ ...dateRange, end: event.target.value })} className="mt-1 block rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
              </label>
              <button onClick={() => loadView()} disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Load data
              </button>
            </div>
            {!!table.rows.length && (
              <div className="flex gap-2">
                <button onClick={exportPDF} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"><FileText size={14} /> PDF</button>
                <button onClick={exportExcel} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"><FileSpreadsheet size={14} /> Excel</button>
              </div>
            )}
          </div>

          {error && <p role="alert" className="border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {notice && <p role="status" className="border-l-4 border-green-600 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}
          {view === "trial" && data && (
            <div className="flex flex-wrap gap-6 text-sm font-semibold text-gray-700">
              <span>Total debits: {formatUGX(data.total_debits)}</span>
              <span>Total credits: {formatUGX(data.total_credits)}</span>
              <span>Difference: {formatUGX(data.imbalance)}</span>
            </div>
          )}

          {view === "periods" && (
            <form onSubmit={savePeriod} className="flex flex-wrap items-end gap-3 border-b border-gray-200 pb-4">
              <label className="text-[10px] font-bold uppercase text-gray-500">Period name<input required value={periodForm.period_name} onChange={(event) => setPeriodForm((current) => ({ ...current, period_name: event.target.value }))} className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
              <label className="text-[10px] font-bold uppercase text-gray-500">Start<input required type="date" value={periodForm.start_date} onChange={(event) => setPeriodForm((current) => ({ ...current, start_date: event.target.value }))} className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
              <label className="text-[10px] font-bold uppercase text-gray-500">End<input required type="date" value={periodForm.end_date} onChange={(event) => setPeriodForm((current) => ({ ...current, end_date: event.target.value }))} className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>
              <button disabled={savingPeriod} className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">{savingPeriod ? "Saving..." : "Save Period"}</button>
            </form>
          )}

          {reversalForm && view === "journals" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <section role="dialog" aria-modal="true" aria-labelledby="reverse-journal-title" className="w-full max-w-lg border border-gray-200 bg-white p-5 shadow-xl">
                <h3 id="reverse-journal-title" className="text-lg font-bold text-gray-900">Reverse {reversalForm.entry.reference}</h3>
                <p className="mt-2 text-sm text-gray-600">A new posted entry will swap the original debits and credits. The original will remain in the ledger.</p>
                <p className="mt-1 text-xs text-gray-500">If this date is in a closed period, posting uses the next open period's start date.</p>
                <form onSubmit={submitReversal} className="mt-4 space-y-3">
                  <label className="block text-[10px] font-bold uppercase text-gray-500">
                    Reversal date
                    <input required type="date" value={reversalForm.reversalDate} onChange={(event) => setReversalForm((current) => ({ ...current, reversalDate: event.target.value }))} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900" />
                  </label>
                  <label className="block text-[10px] font-bold uppercase text-gray-500">
                    Reason
                    <textarea required maxLength={1000} rows={3} value={reversalForm.reason} onChange={(event) => setReversalForm((current) => ({ ...current, reason: event.target.value }))} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal normal-case text-gray-900" />
                  </label>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" disabled={savingReversal} onClick={() => setReversalForm(null)} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">Cancel</button>
                    <button type="submit" disabled={savingReversal} className="inline-flex items-center gap-2 rounded-md bg-yellow-500 px-3 py-2 text-sm font-bold text-black disabled:opacity-50">
                      <RotateCcw size={14} /> {savingReversal ? "Posting..." : "Post reversal"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          <div className="overflow-x-auto border-b border-gray-200">
            {loading ? <p className="py-10 text-center text-sm text-gray-500">Loading {viewLabel.toLowerCase()}...</p> : table.rows.length ? (
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead><tr className="border-b border-gray-300">{table.columns.map((column) => <th key={column} className="whitespace-nowrap px-3 py-3 text-xs font-bold text-gray-600">{column}</th>)}{view === "journals" && <th className="px-3 py-3 text-xs font-bold text-gray-600">Actions</th>}</tr></thead>
                <tbody>{table.rows.map((row, rowIndex) => (
                  <tr key={`${view}-${rowIndex}`} className="border-b border-gray-100 hover:bg-gray-50">
                    {row.map((value, columnIndex) => <td key={`${view}-${rowIndex}-${columnIndex}`} className="max-w-[320px] px-3 py-3 text-gray-800">{typeof value === "number" ? formatUGX(value) : value || "-"}</td>)}
                    {view === "journals" && (
                      <td className="px-3 py-3">
                        {data.entries[rowIndex]?.status === "Posted" && !data.entries[rowIndex]?.reversal_of && (
                          <button type="button" onClick={() => setReversalForm({ entry: data.entries[rowIndex], reversalDate: today, reason: "" })} className="inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:text-red-900">
                            <RotateCcw size={13} /> Reverse
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}</tbody>
              </table>
            ) : !error ? (
              <p className="py-10 text-center text-sm text-gray-500">
                {view === "payable"
                  ? "No supplier payables have been recorded. Inventory purchase entries are not treated as liabilities unless payment terms and balances are entered."
                  : `No ${viewLabel.toLowerCase()} records for this selection.`}
              </p>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}