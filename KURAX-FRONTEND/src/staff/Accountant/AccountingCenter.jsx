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
  { key: "transactions", label: "Account Transactions", icon: Landmark },
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

function findAccountBySelection(accounts, value) {
  if (!value) return null;
  const search = String(value).trim().toLowerCase();
  if (!search) return null;

  return accounts.find((account) => {
    const name = String(account.name || "").toLowerCase();
    const code = String(account.code || "").toLowerCase();
    const label = `${account.name} (${account.code})`.toLowerCase();
    return name.includes(search) || code.includes(search) || label.includes(search);
  }) || null;
}

function getFilteredAccountOptions(accounts, searchValue) {
  const query = String(searchValue || '').trim().toLowerCase();
  if (!query) return accounts.filter((account) => account.is_active);

  return accounts.filter((account) => {
    const name = String(account.name || '').toLowerCase();
    const code = String(account.code || '').toLowerCase();
    const label = `${account.name} (${account.code})`.toLowerCase();
    return account.is_active && (name.includes(query) || code.includes(query) || label.includes(query));
  });
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

function formatAuditDetails(details) {
  let value = details;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return value;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return String(value || "-");

  const labels = {
    amount: "Amount",
    description: "Description",
    source_account: "Source account",
    destination_account: "Destination account",
    source_account_name: "Source account",
    destination_account_name: "Destination account",
    reference_number: "Reference number",
    transaction_date: "Transaction date",
    transaction_type: "Transaction type",
    source_transaction: "Origin",
  };
  const accountNames = { "1001": "Counter Cash", "1002": "Bank", "1003": "Mobile Money", "1005": "Kurax Savings" };

  return Object.entries(value).map(([key, item]) => {
    const label = labels[key] || key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    let displayValue = item;
    if (key === "amount" && Number.isFinite(Number(item))) displayValue = formatUGX(item);
    else if (["source_account", "destination_account"].includes(key) && accountNames[String(item)]) displayValue = `${accountNames[String(item)]} (${item})`;
    else if (key === "transaction_date" && item) {
      const date = new Date(item);
      if (!Number.isNaN(date.getTime())) displayValue = date.toLocaleDateString("en-GB", { timeZone: "Africa/Kampala", day: "2-digit", month: "short", year: "numeric" });
    } else if (key === "source_transaction" && typeof item === "string") {
      displayValue = item.replace(/^account_transfer:/i, "Account transfer reference ").replace(/^account_transaction:/i, "Account transaction reference ");
    } else if (item === null || item === "") displayValue = "Not provided";
    return `${label}: ${typeof displayValue === "object" ? JSON.stringify(displayValue) : displayValue}`;
  }).join("\n");
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

  if (view === "transactions") {
    return {
      columns: ["Date", "Type", "Reference", "Description", "Source", "Destination", "Amount (UGX)", "Status", "Posted By"],
      rows: (data.entries || []).map((entry) => {
        const lines = Array.isArray(entry.lines) ? entry.lines : [];
        const sourceLine = lines.find((line) => Number(line.credit || 0) > 0) || {};
        const destinationLine = lines.find((line) => Number(line.debit || 0) > 0) || {};
        const amount = Number(destinationLine.debit || sourceLine.credit || 0);
        return [
          entry.entry_date?.slice(0, 10),
          entry.description?.toLowerCase().includes('cash deposit') ? 'Transfer' : 'Internal Transfer',
          entry.reference,
          entry.description,
          sourceLine.account_name || "Counter Cash",
          destinationLine.account_name || "Bank",
          amount,
          entry.status,
          entry.posted_by || "",
        ];
      }),
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
      rows: (data.entries || []).map((entry) => [entry.created_at?.toString().slice(0, 19), entry.entity_type, entry.entity_id, entry.action, entry.actor, formatAuditDetails(entry.details)]),
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
  const [transferAccounts, setTransferAccounts] = useState([]);
  const [transferForm, setTransferForm] = useState({
    transactionType: "Transfer",
    transactionDate: today,
    amount: "500000",
    sourceAccountCode: "",
    destinationAccountCode: "",
    sourceAccountName: "",
    destinationAccountName: "",
    referenceNumber: "",
    description: "Cash deposit",
    businessTime: "",
  });
  const [transferPreview, setTransferPreview] = useState(null);
  const [postingTransfer, setPostingTransfer] = useState(false);
  const [sourceAccountInput, setSourceAccountInput] = useState("");
  const [destinationAccountInput, setDestinationAccountInput] = useState("");
  const [showSourceAccountMenu, setShowSourceAccountMenu] = useState(false);
  const [showDestinationAccountMenu, setShowDestinationAccountMenu] = useState(false);

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
      if (targetView === "transactions") {
        const [accounts, entries] = await Promise.all([
          requestJSON(`${base}/chart-of-accounts`),
          requestJSON(`${base}/account-transactions?${query}&limit=100`),
        ]);
        result = { accounts: accounts.accounts, entries: entries.entries || [] };
      }
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
    if (view === "transactions") {
      requestJSON(`${API_URL}/api/accountant/accounting/chart-of-accounts`)
        .then((result) => setTransferAccounts(result.accounts || []))
        .catch(() => setTransferAccounts([]));
    }
  }, [view]);

  useEffect(() => {
    loadView(view);
  }, [view, loadView]);

  const previewTransfer = async () => {
    try {
      const result = await requestJSON(`${API_URL}/api/accountant/accounting/account-transactions/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionType: transferForm.transactionType,
          transactionDate: transferForm.transactionDate,
          amount: transferForm.amount,
          sourceAccountCode: transferForm.sourceAccountCode,
          destinationAccountCode: transferForm.destinationAccountCode,
          sourceAccountName: transferForm.sourceAccountName,
          destinationAccountName: transferForm.destinationAccountName,
          description: transferForm.description,
        }),
      });
      setTransferPreview(result);
      setNotice("Preview generated successfully.");
      setError("");
    } catch (previewError) {
      setTransferPreview(null);
      setError(previewError.message);
    }
  };

  const submitTransfer = async (event) => {
    event.preventDefault();
    setPostingTransfer(true);
    setError("");
    setNotice("");
    try {
      const result = await requestJSON(`${API_URL}/api/accountant/accounting/account-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionType: transferForm.transactionType,
          transactionDate: transferForm.transactionDate,
          amount: transferForm.amount,
          sourceAccountCode: transferForm.sourceAccountCode,
          destinationAccountCode: transferForm.destinationAccountCode,
          sourceAccountName: transferForm.sourceAccountName,
          destinationAccountName: transferForm.destinationAccountName,
          referenceNumber: transferForm.referenceNumber,
          description: transferForm.description,
          businessTime: transferForm.businessTime,
          postedBy: getAccountantName(),
        }),
      });
      setNotice(`Transfer posted successfully. Journal reference: ${result.journal.reference}.`);
      setTransferPreview(null);
      await loadView("transactions");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setPostingTransfer(false);
    }
  };

  const table = getTableModel(view, data);
  const viewLabel = VIEWS.find((item) => item.key === view)?.label || "Accounting";

  const setSelectedAccount = (field, account) => {
    if (!account) return;

    if (field === "source") {
      setTransferForm((current) => ({
        ...current,
        sourceAccountCode: account.code,
        sourceAccountName: account.name,
      }));
      setSourceAccountInput(`${account.name} (${account.code})`);
      setShowSourceAccountMenu(false);
      return;
    }

    setTransferForm((current) => ({
      ...current,
      destinationAccountCode: account.code,
      destinationAccountName: account.name,
    }));
    setDestinationAccountInput(`${account.name} (${account.code})`);
    setShowDestinationAccountMenu(false);
  };

  useEffect(() => {
    if (transferAccounts.length) {
      const sourceAccount = findAccountBySelection(transferAccounts, transferForm.sourceAccountCode) || transferAccounts.find((account) => account.code === transferForm.sourceAccountCode);
      const destinationAccount = findAccountBySelection(transferAccounts, transferForm.destinationAccountCode) || transferAccounts.find((account) => account.code === transferForm.destinationAccountCode);

      if (sourceAccount) {
        setSourceAccountInput(`${sourceAccount.name} (${sourceAccount.code})`);
      }
      if (destinationAccount) {
        setDestinationAccountInput(`${destinationAccount.name} (${destinationAccount.code})`);
      }
    }
  }, [transferAccounts, transferForm.sourceAccountCode, transferForm.destinationAccountCode]);

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
          {view === "transactions" && (
            <form onSubmit={submitTransfer} className="space-y-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-gray-900">Internal account transfer</h3>
                  <p className="text-sm text-gray-500">Post a balanced transfer between eligible internal cash/bank accounts while preserving the historical business date.</p>
                </div>
                <button type="button" onClick={previewTransfer} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700">Preview journal</button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="text-[10px] font-bold uppercase text-gray-500">Transaction Type
                  <select value={transferForm.transactionType} onChange={(event) => setTransferForm((current) => ({ ...current, transactionType: event.target.value }))} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                    <option value="Transfer">Transfer</option>
                    <option value="Deposit">Deposit</option>
                    <option value="Withdrawal">Withdrawal</option>
                  </select>
                </label>
                <label className="text-[10px] font-bold uppercase text-gray-500">Transaction Date
                  <input type="date" value={transferForm.transactionDate} onChange={(event) => setTransferForm((current) => ({ ...current, transactionDate: event.target.value }))} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" required />
                </label>
                <label className="text-[10px] font-bold uppercase text-gray-500">Amount (UGX)
                  <input type="number" min="1" step="0.01" value={transferForm.amount} onChange={(event) => setTransferForm((current) => ({ ...current, amount: event.target.value }))} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" required />
                </label>
                <div className="text-[10px] font-bold uppercase text-gray-500">Source account
                  <div className="relative mt-1">
                    <input
                      type="text"
                      value={sourceAccountInput}
                      onFocus={() => setShowSourceAccountMenu(true)}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setSourceAccountInput(nextValue);
                        setShowSourceAccountMenu(true);
                        const selected = findAccountBySelection(transferAccounts, nextValue);
                        if (selected) {
                          setTransferForm((current) => ({
                            ...current,
                            sourceAccountCode: selected.code,
                            sourceAccountName: selected.name,
                          }));
                        }
                      }}
                      placeholder="Select source account from chart of accounts"
                      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-yellow-500 focus:outline-none"
                    />
                    {showSourceAccountMenu && (
                      <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-gray-300 bg-white shadow-lg">
                        {getFilteredAccountOptions(transferAccounts, sourceAccountInput).map((account) => (
                          <button
                            key={`source-${account.code}`}
                            type="button"
                            onClick={() => setSelectedAccount("source", account)}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${transferForm.sourceAccountCode === account.code ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}
                          >
                            <span>{account.name} ({account.code})</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{account.account_type || account.category}</span>
                          </button>
                        ))}
                        {!getFilteredAccountOptions(transferAccounts, sourceAccountInput).length && (
                          <div className="px-3 py-2 text-xs text-gray-500">No matching account found.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-[10px] font-bold uppercase text-gray-500">Destination account
                  <div className="relative mt-1">
                    <input
                      type="text"
                      value={destinationAccountInput}
                      onFocus={() => setShowDestinationAccountMenu(true)}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setDestinationAccountInput(nextValue);
                        setShowDestinationAccountMenu(true);
                        const selected = findAccountBySelection(transferAccounts, nextValue);
                        if (selected) {
                          setTransferForm((current) => ({
                            ...current,
                            destinationAccountCode: selected.code,
                            destinationAccountName: selected.name,
                          }));
                        }
                      }}
                      placeholder="Select destination account from chart of accounts"
                      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-yellow-500 focus:outline-none"
                    />
                    {showDestinationAccountMenu && (
                      <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-gray-300 bg-white shadow-lg">
                        {getFilteredAccountOptions(transferAccounts, destinationAccountInput).map((account) => (
                          <button
                            key={`destination-${account.code}`}
                            type="button"
                            onClick={() => setSelectedAccount("destination", account)}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${transferForm.destinationAccountCode === account.code ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}
                          >
                            <span>{account.name} ({account.code})</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{account.account_type || account.category}</span>
                          </button>
                        ))}
                        {!getFilteredAccountOptions(transferAccounts, destinationAccountInput).length && (
                          <div className="px-3 py-2 text-xs text-gray-500">No matching account found.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <label className="text-[10px] font-bold uppercase text-gray-500">Business time
                  <input type="time" value={transferForm.businessTime} onChange={(event) => setTransferForm((current) => ({ ...current, businessTime: event.target.value }))} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
                </label>
                <label className="text-[10px] font-bold uppercase text-gray-500 md:col-span-2 xl:col-span-3">Reference number
                  <input type="text" value={transferForm.referenceNumber} onChange={(event) => setTransferForm((current) => ({ ...current, referenceNumber: event.target.value }))} placeholder="Optional" className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
                </label>
                <label className="text-[10px] font-bold uppercase text-gray-500 md:col-span-2 xl:col-span-3">Description / reason
                  <input type="text" value={transferForm.description} onChange={(event) => setTransferForm((current) => ({ ...current, description: event.target.value }))} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" required />
                </label>
              </div>

              {transferPreview && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <h4 className="text-sm font-black uppercase tracking-widest text-yellow-700">Journal preview</h4>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left text-xs text-gray-700">
                      <thead>
                        <tr className="border-b border-yellow-200">
                          <th className="px-2 py-2 font-bold">Account</th>
                          <th className="px-2 py-2 font-bold">Debit</th>
                          <th className="px-2 py-2 font-bold">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transferPreview.lines.map((line) => (
                          <tr key={`${line.accountCode}-${line.debit || line.credit}`} className="border-b border-yellow-100">
                            <td className="px-2 py-2">{line.accountName}</td>
                            <td className="px-2 py-2">{Number(line.debit || 0).toLocaleString()}</td>
                            <td className="px-2 py-2">{Number(line.credit || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-gray-700">
                    <span>Business date: {transferPreview.transactionDate || transferForm.transactionDate}</span>
                    <span>Debits: UGX {Number(transferPreview.total_debit || 0).toLocaleString()}</span>
                    <span>Credits: UGX {Number(transferPreview.total_credit || 0).toLocaleString()}</span>
                    <span>Balanced: {transferPreview.balance === 0 ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={postingTransfer} className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">{postingTransfer ? 'Posting...' : 'Post transaction'}</button>
                <button type="button" onClick={() => setTransferPreview(null)} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700">Cancel</button>
              </div>
            </form>
          )}

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
                    {row.map((value, columnIndex) => <td key={`${view}-${rowIndex}-${columnIndex}`} className={`max-w-[320px] px-3 py-3 text-gray-800 ${view === "audit" && columnIndex === 5 ? "min-w-[320px] whitespace-pre-wrap break-words" : ""}`}>{typeof value === "number" ? formatUGX(value) : value || "-"}</td>)}
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