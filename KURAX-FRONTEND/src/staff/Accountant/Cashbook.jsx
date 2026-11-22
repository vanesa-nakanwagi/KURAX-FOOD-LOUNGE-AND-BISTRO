import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import API_URL from "../../config/api";
import { downloadReportPdf } from "../reportExport";
import Pagination from "../components/Pagination";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" }).format(new Date());
const monthStart = `${today.slice(0, 7)}-01`;
const cashbookUrl = `${API_URL}/api/accountant/accounting/cashbook`;

function makeRequestId() {
  return globalThis.crypto?.randomUUID?.()
    || `cashbook-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function emptyTransaction(type = "Receipt") {
  return {
    request_id: makeRequestId(),
    transaction_date: today,
    transaction_type: type,
    category: type === "Receipt" ? "Customer Payment" : "Expense",
    description: "",
    cash_account_code: "1001",
    counterpart_account_code: "",
    payment_method: "Cash",
    amount: "",
    external_reference: "",
    purchase_receipt_id: "",
  };
}

async function requestJSON(url, options = {}) {
  let token = "";
  try {
    token = JSON.parse(localStorage.getItem("kurax_user") || "{}").token || "";
  } catch {
    token = "";
  }
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function formatUGX(value) {
  return `UGX ${Number(value || 0).toLocaleString("en-UG", { maximumFractionDigits: 2 })}`;
}

function methodsForAccount(account) {
  if (!account) return [];
  if (account.code === "1001" || String(account.account_type).toLowerCase() === "cash") return ["Cash"];
  if (account.code === "1006") return ["MTN Mobile Money"];
  if (account.code === "1007") return ["Airtel Money"];
  if (account.code === "1003") return ["Mobile Money"];
  if (["bank", "bank account"].includes(String(account.account_type).toLowerCase())) return ["Bank Transfer", "Card"];
  if (String(account.account_type).toLowerCase() === "clearing") return ["Card"];
  return [];
}

function isPayableAccount(account) {
  return account?.category === "Liability" && /payable/i.test(String(account.account_type || ""));
}

function eligibleCounterparts(accounts, type, category) {
  return accounts.filter((account) => {
    const accountType = String(account.account_type || "").toLowerCase();
    const accountName = String(account.name || "").toLowerCase();
    if (account.is_active === false || account.is_postable === false) return false;
    if (["cash", "bank", "bank account", "mobile money", "clearing", "savings"].includes(accountType)) return false;

    if (type === "Receipt") {
      if (category === "Customer Payment") return account.category === "Asset" && accountType.includes("receivable");
      if (category === "Deposit Received") return account.category === "Liability";
      if (category === "Other Income") return account.category === "Revenue";
      return ["Asset", "Liability", "Equity", "Revenue"].includes(account.category);
    }

    if (category === "Expense") return account.category === "Expense";
    if (category === "Supplier Payment") {
      return (account.category === "Liability" && accountType.includes("payable")) || account.category === "Expense";
    }
    if (category === "Salaries") {
      return account.category === "Expense" && /salary|wage|staff/.test(`${accountType} ${accountName}`);
    }
    if (category === "Utilities") {
      return account.category === "Expense" && /utilit/.test(`${accountType} ${accountName}`);
    }
    return ["Asset", "Liability", "Equity", "Expense"].includes(account.category);
  });
}

function transactionColumns(entries) {
  return entries.map((entry) => [
    entry.transaction_date?.slice(0, 10),
    entry.reference,
    entry.external_reference || "",
    entry.description,
    entry.category,
    `${entry.account_name} (${entry.account_code})`,
    entry.payment_method,
    Number(entry.debit || 0),
    Number(entry.credit || 0),
    Number(entry.running_balance || 0),
    entry.status,
  ]);
}

export default function Cashbook({ initialDateRange, onDateRangeChange }) {
  const [dateRange, setDateRange] = useState(initialDateRange || { start: monthStart, end: today });
  const [accountCode, setAccountCode] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(null);
  const [allocatingEntry, setAllocatingEntry] = useState(null);
  const [allocationReceiptId, setAllocationReceiptId] = useState("");
  const [saving, setSaving] = useState(false);
  const [rowActionId, setRowActionId] = useState(null);
  const [reconciliationDate, setReconciliationDate] = useState(today);
  const [reconciliationData, setReconciliationData] = useState(null);
  const [reconciliationAccount, setReconciliationAccount] = useState("");
  const [countedBalance, setCountedBalance] = useState("");
  const [reconciliationNote, setReconciliationNote] = useState("");
  const [savingReconciliation, setSavingReconciliation] = useState(false);
  const [auditSearchInput, setAuditSearchInput] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  const [auditData, setAuditData] = useState(null);

  useEffect(() => {
    if (initialDateRange?.start && initialDateRange?.end) setDateRange(initialDateRange);
  }, [initialDateRange?.start, initialDateRange?.end]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setAuditSearch(auditSearchInput.trim());
      setAuditPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [auditSearchInput]);

  const loadCashbook = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
        accountCode,
        search,
        page: String(page),
        limit: String(pageSize),
      });
      setData(await requestJSON(`${cashbookUrl}?${query}`));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [accountCode, dateRange.end, dateRange.start, page, pageSize, search]);

  const loadReconciliations = useCallback(async () => {
    try {
      setReconciliationData(await requestJSON(
        `${cashbookUrl}/reconciliations?date=${encodeURIComponent(reconciliationDate)}`
      ));
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [reconciliationDate]);

  const loadAudit = useCallback(async () => {
    try {
      const query = new URLSearchParams({
        page: String(auditPage),
        limit: "20",
        search: auditSearch,
      });
      setAuditData(await requestJSON(`${cashbookUrl}/audit-trail?${query}`));
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [auditPage, auditSearch]);

  useEffect(() => { loadCashbook(); }, [loadCashbook]);
  useEffect(() => { loadReconciliations(); }, [loadReconciliations]);
  useEffect(() => { loadAudit(); }, [loadAudit]);

  const cashAccounts = data?.accounts || [];
  const counterpartAccounts = data?.counterpart_accounts || [];
  const capabilities = data?.capabilities || {};
  const transactionCategories = data?.categories?.[form?.transaction_type] || [];
  const formCashAccount = cashAccounts.find((account) => account.code === form?.cash_account_code);
  const paymentMethods = methodsForAccount(formCashAccount);
  const filteredCounterparts = useMemo(
    () => eligibleCounterparts(counterpartAccounts, form?.transaction_type, form?.category),
    [counterpartAccounts, form?.category, form?.transaction_type]
  );
  const selectedCounterpart = counterpartAccounts.find((account) => account.code === form?.counterpart_account_code);
  const needsSupplierInvoice = form?.transaction_type === "Payment"
    && form.category === "Supplier Payment"
    && isPayableAccount(selectedCounterpart);
  const selectedReconciliation = reconciliationData?.reconciliations?.find(
    (item) => item.code === reconciliationAccount
  );
  const calculatedDiscrepancy = countedBalance === "" || !selectedReconciliation
    ? null
    : Number(countedBalance) - Number(selectedReconciliation.expected_balance || 0);

  useEffect(() => {
    if (!form) return;
    if (!cashAccounts.some((account) => account.code === form.cash_account_code) && cashAccounts.length) {
      const defaultAccount = cashAccounts[0];
      setForm((current) => ({
        ...current,
        cash_account_code: defaultAccount.code,
        payment_method: methodsForAccount(defaultAccount)[0] || "",
      }));
      return;
    }
    if (!paymentMethods.includes(form.payment_method) && paymentMethods.length) {
      setForm((current) => ({ ...current, payment_method: paymentMethods[0] }));
    }
  }, [cashAccounts, form, paymentMethods]);

  useEffect(() => {
    if (!form || !filteredCounterparts.length) return;
    if (!filteredCounterparts.some((account) => account.code === form.counterpart_account_code)) {
      setForm((current) => ({ ...current, counterpart_account_code: filteredCounterparts[0].code }));
    }
  }, [filteredCounterparts, form]);

  useEffect(() => {
    if (!selectedReconciliation) {
      setCountedBalance("");
      setReconciliationNote("");
      return;
    }
    setCountedBalance(selectedReconciliation.counted_balance == null ? "" : String(selectedReconciliation.counted_balance));
    setReconciliationNote(selectedReconciliation.note || "");
  }, [selectedReconciliation]);

  const changeDateRange = (nextRange) => {
    setDateRange(nextRange);
    setPage(1);
    onDateRangeChange?.(nextRange);
  };

  const updateForm = (key, value) => setForm((current) => ({
    ...current,
    [key]: value,
    ...(["category", "counterpart_account_code", "transaction_type"].includes(key)
      ? { purchase_receipt_id: "" }
      : {}),
  }));

  const startNewTransaction = (type) => {
    const initial = emptyTransaction(type);
    const defaultCashAccount = cashAccounts.find((account) => account.code === "1001") || cashAccounts[0];
    if (defaultCashAccount) {
      initial.cash_account_code = defaultCashAccount.code;
      initial.payment_method = methodsForAccount(defaultCashAccount)[0] || "";
    }
    setForm(initial);
    setError("");
    setNotice("");
  };

  const editTransaction = (entry) => {
    setForm({
      request_id: entry.request_id,
      transaction_date: entry.transaction_date?.slice(0, 10) || today,
      transaction_type: entry.transaction_type,
      category: entry.category,
      description: entry.description,
      cash_account_code: entry.account_code,
      counterpart_account_code: entry.counterpart_account_code,
      payment_method: entry.payment_method,
      amount: String(entry.transaction_type === "Receipt" ? entry.debit : entry.credit),
      external_reference: entry.external_reference || "",
      purchase_receipt_id: entry.purchase_receipt_id ? String(entry.purchase_receipt_id) : "",
      id: entry.cashbook_id,
    });
    setError("");
    setNotice("");
  };

  const allocateSupplierInvoice = async (event) => {
    event.preventDefault();
    if (!allocatingEntry || !allocationReceiptId) return;
    setRowActionId(allocatingEntry.cashbook_id);
    setError("");
    setNotice("");
    try {
      const result = await requestJSON(`${cashbookUrl}/${allocatingEntry.cashbook_id}/allocate-supplier-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchase_receipt_id: Number(allocationReceiptId) }),
      });
      setNotice(result.duplicate
        ? `${allocatingEntry.reference} is already allocated to that invoice.`
        : `${allocatingEntry.reference} allocated to invoice ${result.allocation.reference}.`);
      setAllocatingEntry(null);
      setAllocationReceiptId("");
      await Promise.all([loadCashbook(), loadAudit()]);
    } catch (allocationError) {
      setError(allocationError.message);
    } finally {
      setRowActionId(null);
    }
  };

  const submitTransaction = async (event) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { id, ...payload } = form;
      const result = await requestJSON(id ? `${cashbookUrl}/${id}` : cashbookUrl, {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setForm(null);
      setNotice(result.duplicate
        ? `Transaction ${result.transaction.reference_number} was already posted.`
        : id
          ? `Transaction ${result.transaction.reference_number} was updated and posted.`
          : `Transaction ${result.transaction.reference_number} was posted to the General Ledger.`);
      await Promise.all([loadCashbook(), loadAudit()]);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const reverseTransaction = async (entry) => {
    const id = entry.cashbook_id;
    if (!id) return;
    const reason = window.prompt(`Reason for reversing ${entry.reference}:`);
    if (reason === null) return;

    setRowActionId(id);
    setError("");
    setNotice("");
    try {
      const result = await requestJSON(`${cashbookUrl}/${id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, reversal_date: today }),
      });
      const reference = result.transaction?.reference_number || entry.reference;
      setNotice(`${reference} reversed by journal entry ${result.reversal?.reference || ""}.`);
      await Promise.all([loadCashbook(), loadAudit()]);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setRowActionId(null);
    }
  };

  const saveReconciliation = async (event) => {
    event.preventDefault();
    if (!selectedReconciliation) return;
    setSavingReconciliation(true);
    setError("");
    setNotice("");
    try {
      const result = await requestJSON(`${cashbookUrl}/reconciliations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reconciliation_date: reconciliationDate,
          account_code: reconciliationAccount,
          counted_balance: countedBalance,
          note: reconciliationNote,
        }),
      });
      const discrepancy = Number(result.reconciliation.discrepancy || 0);
      setNotice(discrepancy === 0
        ? `${selectedReconciliation.name} reconciled with no discrepancy.`
        : `${selectedReconciliation.name} reconciled. Discrepancy: ${formatUGX(discrepancy)}.`);
      await Promise.all([loadReconciliations(), loadAudit()]);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingReconciliation(false);
    }
  };

  const getAllEntries = async () => {
    const totalPages = data?.pagination?.totalPages || 1;
    if (totalPages <= 1) return data?.entries || [];
    const pages = await Promise.all(Array.from({ length: totalPages }, (_, index) => {
      const query = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
        accountCode,
        search,
        page: String(index + 1),
        limit: String(pageSize),
      });
      return requestJSON(`${cashbookUrl}?${query}`);
    }));
    return pages.flatMap((result) => result.entries || []);
  };

  const exportPDF = async () => {
    try {
      const entries = await getAllEntries();
      if (!entries.length) return;
      downloadReportPdf({
        filename: `cashbook_${dateRange.start}_${dateRange.end}.pdf`,
        title: "Cashbook",
        companyName: "KURAX FOOD LOUNGE AND BISTRO",
        periodText: `Period: ${dateRange.start} to ${dateRange.end}`,
        footerLabel: "Accounting Report",
        from: dateRange.start,
        to: dateRange.end,
        orientation: "landscape",
        sections: [{
          title: "Cashbook Transaction Register",
          columns: ["Date", "Reference", "External Ref.", "Description", "Category", "Account", "Payment Method", "Debit", "Credit", "Running Balance", "Status"],
          rows: transactionColumns(entries).map((row) => row.map((value) => typeof value === "number" ? formatUGX(value) : value ?? "")),
        }],
      });
    } catch (exportError) {
      setError(exportError.message || "Unable to export the cashbook PDF.");
    }
  };

  const exportExcel = async () => {
    try {
      const entries = await getAllEntries();
      if (!entries.length) return;
      const worksheet = XLSX.utils.aoa_to_sheet([
        ["Cashbook Transaction Register"],
        ["KURAX FOOD LOUNGE AND BISTRO"],
        ["Period", `${dateRange.start} to ${dateRange.end}`],
        [],
        ["Date", "Reference", "External Ref.", "Description", "Category", "Account", "Payment Method", "Debit (UGX)", "Credit (UGX)", "Running Balance (UGX)", "Status"],
        ...transactionColumns(entries),
      ]);
      worksheet["!cols"] = [14, 22, 20, 36, 22, 28, 22, 18, 18, 22, 20].map((wch) => ({ wch }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Cashbook");
      XLSX.writeFile(workbook, `cashbook_${dateRange.start}_${dateRange.end}.xlsx`);
    } catch (exportError) {
      setError(exportError.message || "Unable to export the cashbook Excel report.");
    }
  };

  const entries = data?.entries || [];
  const categoriesForForm = data?.categories || {};

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-end gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => startNewTransaction("Receipt")} disabled={!capabilities.can_create} className="inline-flex items-center gap-2 rounded-md bg-yellow-500 px-3 py-2 text-xs font-bold text-black hover:bg-yellow-600 disabled:opacity-50">
            <Plus size={14} /> New receipt
          </button>
          <button type="button" onClick={() => startNewTransaction("Payment")} disabled={!capabilities.can_create} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Plus size={14} /> New payment
          </button>
        </div>
      </header>

      <section className="flex flex-wrap items-end gap-3 border-b border-gray-200 pb-4">
        <label className="text-[10px] font-bold uppercase text-gray-500">From
          <input type="date" value={dateRange.start} onChange={(event) => changeDateRange({ ...dateRange, start: event.target.value })} className="mt-1 block rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </label>
        <label className="text-[10px] font-bold uppercase text-gray-500">To
          <input type="date" value={dateRange.end} onChange={(event) => changeDateRange({ ...dateRange, end: event.target.value })} className="mt-1 block rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        </label>
        <label className="text-[10px] font-bold uppercase text-gray-500">Account
          <select value={accountCode} onChange={(event) => { setAccountCode(event.target.value); setPage(1); }} className="mt-1 block min-w-48 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
            <option value="">All cash accounts</option>
            {cashAccounts.map((account) => <option key={account.code} value={account.code}>{account.name}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-bold uppercase text-gray-500">Search transactions
          <span className="relative mt-1 block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Reference, description, category..." className="block w-64 max-w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm font-normal normal-case text-gray-900" />
          </span>
        </label>
        <button type="button" onClick={loadCashbook} disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Load data
        </button>
      </section>

      {error && <p role="alert" className="border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="border-l-4 border-green-600 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}

      {allocatingEntry && (
        <section className="border border-amber-300 bg-amber-50 p-4">
          <h4 className="font-bold text-gray-900">Allocate {formatUGX(allocatingEntry.credit)} supplier payment</h4>
          <p className="mt-1 text-xs text-gray-600">{allocatingEntry.reference} has already been posted to the General Ledger. Choose the invoice it paid to update its Accounts Payable balance.</p>
          <form onSubmit={allocateSupplierInvoice} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="min-w-[280px] flex-1 text-[10px] font-bold uppercase text-gray-500">
              Open supplier invoice
              <select
                required
                value={allocationReceiptId}
                onChange={(event) => setAllocationReceiptId(event.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case text-gray-900"
              >
                <option value="">Select an invoice</option>
                {(data?.supplier_payables || []).map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.reference} · {invoice.supplier_name} · Due {formatUGX(invoice.outstanding_balance)}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => setAllocatingEntry(null)} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700">Cancel</button>
            <button type="submit" disabled={!allocationReceiptId || rowActionId === allocatingEntry.cashbook_id} className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">
              {rowActionId === allocatingEntry.cashbook_id ? "Allocating..." : "Allocate payment"}
            </button>
          </form>
          {!data?.supplier_payables?.length && <p className="mt-2 text-sm text-red-700">There are no open supplier invoices available for this payment.</p>}
        </section>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Opening Balance", data?.summary?.opening_balance],
          ["Total Money Received", data?.summary?.total_received],
          ["Total Money Paid", data?.summary?.total_paid],
          ["Closing Balance", data?.summary?.closing_balance],
        ].map(([label, amount]) => (
          <div key={label} className="border border-gray-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-2 text-lg font-black text-gray-900">{formatUGX(amount)}</p>
          </div>
        ))}
      </section>

      {form && (
        <section className="border border-gray-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-gray-200 pb-3">
            <div>
              <h4 className="font-bold text-gray-900">{form.id ? "Edit transaction" : `New cash ${form.transaction_type.toLowerCase()}`}</h4>
              <p className="mt-1 text-xs text-gray-500">
                {form.id ? "Changes are posted to the General Ledger when saved." : "This entry is posted to the General Ledger immediately."}
              </p>
            </div>
            <button type="button" onClick={() => setForm(null)} className="rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50" aria-label="Close transaction form"><X size={15} /></button>
          </div>
          <form onSubmit={submitTransaction} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {!form.id && (
              <label className="text-[10px] font-bold uppercase text-gray-500">Type
                <select value={form.transaction_type} onChange={(event) => {
                  const type = event.target.value;
                  const category = categoriesForForm[type]?.[0] || "";
                  setForm((current) => ({ ...current, transaction_type: type, category, counterpart_account_code: "" }));
                }} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case text-gray-900">
                  <option value="Receipt">Receipt</option>
                  <option value="Payment">Payment</option>
                </select>
              </label>
            )}
            <label className="text-[10px] font-bold uppercase text-gray-500">Transaction date
              <input required type="date" max={today} value={form.transaction_date} onChange={(event) => updateForm("transaction_date", event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal normal-case text-gray-900" />
            </label>
            <label className="text-[10px] font-bold uppercase text-gray-500">Category
              <select required value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value, counterpart_account_code: "", purchase_receipt_id: "" }))} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case text-gray-900">
                {transactionCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-gray-500">Cash account
              <select required value={form.cash_account_code} onChange={(event) => {
                const account = cashAccounts.find((item) => item.code === event.target.value);
                setForm((current) => ({
                  ...current,
                  cash_account_code: event.target.value,
                  payment_method: methodsForAccount(account)[0] || "",
                }));
              }} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case text-gray-900">
                {cashAccounts.map((account) => <option key={account.code} value={account.code}>{account.name}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-gray-500">Category account
              <select required value={form.counterpart_account_code} onChange={(event) => updateForm("counterpart_account_code", event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case text-gray-900">
                {filteredCounterparts.map((account) => <option key={account.code} value={account.code}>{account.code} · {account.name}</option>)}
              </select>
            </label>
            {needsSupplierInvoice && (
              <label className="text-[10px] font-bold uppercase text-gray-500">
                Supplier invoice
                <select
                  required
                  value={form.purchase_receipt_id || ""}
                  onChange={(event) => updateForm("purchase_receipt_id", event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case text-gray-900"
                >
                  <option value="">Select an unpaid invoice</option>
                  {(data?.supplier_payables || []).map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.reference} · {invoice.supplier_name} · Due {formatUGX(invoice.outstanding_balance)}
                    </option>
                  ))}
                </select>
                {!data?.supplier_payables?.length && <span className="mt-1 block font-normal normal-case text-amber-700">No open supplier invoices are available to allocate.</span>}
              </label>
            )}
            <label className="text-[10px] font-bold uppercase text-gray-500">Payment method
              <select required value={form.payment_method} onChange={(event) => updateForm("payment_method", event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case text-gray-900">
                {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-gray-500">Amount (UGX)
              <input required type="number" min="0.01" max="9999999999.99" step="0.01" value={form.amount} onChange={(event) => updateForm("amount", event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal normal-case text-gray-900" />
            </label>
            <label className="text-[10px] font-bold uppercase text-gray-500">External reference
              <input maxLength={100} value={form.external_reference} onChange={(event) => updateForm("external_reference", event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal normal-case text-gray-900" />
            </label>
            <label className="text-[10px] font-bold uppercase text-gray-500 sm:col-span-2">Description
              <input required maxLength={500} value={form.description} onChange={(event) => updateForm("description", event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal normal-case text-gray-900" />
            </label>
            {!filteredCounterparts.length && <p className="text-sm text-red-700 sm:col-span-2">No active Chart of Accounts entry is available for this category.</p>}
            <div className="flex items-end justify-end gap-2 sm:col-span-2 xl:col-span-4">
              <button type="button" onClick={() => setForm(null)} disabled={saving} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={saving || !filteredCounterparts.length} className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">
                {saving ? "Saving..." : form.id ? "Save changes" : "Post entry"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-200 pb-3">
          <div>
            <h4 className="font-bold text-gray-900">Transaction Register</h4>
            <p className="mt-1 text-xs text-gray-500">POS and Cashbook activity posted to the General Ledger.</p>
          </div>
          {!!entries.length && (
            <div className="flex gap-2">
              <button type="button" onClick={exportPDF} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"><FileText size={14} /> PDF</button>
              <button type="button" onClick={exportExcel} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"><FileSpreadsheet size={14} /> Excel</button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto border-b border-gray-200">
          {loading ? <p className="py-10 text-center text-sm text-gray-500">Loading cashbook...</p> : entries.length ? (
            <table className="w-full min-w-[1450px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  {["Date", "Reference", "Description", "Category", "Account", "Payment Method", "Debit", "Credit", "Running Balance", "Status", "Actions"].map((column) => <th key={column} className="whitespace-nowrap px-3 py-3 text-xs font-bold text-gray-600">{column}</th>)}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isLegacyUnposted = entry.status === "Pending Approval";
                  const createdByActor = Number(entry.created_by_staff_id) === Number(capabilities.actor_id);
                  const rowBusy = rowActionId === entry.cashbook_id;
                  const canAllocateInvoice = entry.status === "Posted"
                    && entry.transaction_type === "Payment"
                    && entry.category === "Supplier Payment"
                    && !entry.purchase_receipt_id
                    && isPayableAccount(counterpartAccounts.find((account) => account.code === entry.counterpart_account_code))
                    && capabilities.can_create;
                  return (
                    <tr key={entry.row_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-3 text-gray-800">{entry.transaction_date?.slice(0, 10)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-gray-800">{entry.reference}{entry.external_reference ? <span className="block text-[10px] font-normal text-gray-500">Ref: {entry.external_reference}</span> : null}</td>
                      <td className="max-w-[280px] px-3 py-3 text-gray-800">{entry.description}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-gray-800">{entry.category}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-gray-800">{entry.account_name}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-gray-800">{entry.payment_method}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-gray-800">{Number(entry.debit) ? formatUGX(entry.debit) : "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-gray-800">{Number(entry.credit) ? formatUGX(entry.credit) : "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-gray-800">{formatUGX(entry.running_balance)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-gray-800">{isLegacyUnposted ? "Unposted" : entry.status}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <div className="flex items-center gap-2">
                          {entry.purchase_reference && <span className="text-xs text-gray-600">{entry.purchase_reference}</span>}
                          {canAllocateInvoice && (
                            <button
                              type="button"
                              disabled={rowBusy}
                              onClick={() => {
                                setAllocatingEntry(entry);
                                setAllocationReceiptId("");
                              }}
                              className="text-xs font-bold text-amber-700 hover:text-amber-900 disabled:opacity-50"
                            >
                              Allocate invoice
                            </button>
                          )}
                          {isLegacyUnposted && capabilities.can_edit && (createdByActor || capabilities.actor_role === "MANAGER" || capabilities.actor_role === "DIRECTOR") && (
                            <button type="button" onClick={() => editTransaction(entry)} className="text-xs font-bold text-gray-700 hover:text-black">Edit</button>
                          )}
                          {["Posted", "Approved"].includes(entry.status) && capabilities.can_reverse && (
                            <button type="button" disabled={rowBusy} onClick={() => reverseTransaction(entry)} className="inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:text-red-900 disabled:opacity-50"><RotateCcw size={13} /> Reverse</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : !error ? (
            <p className="py-10 text-center text-sm text-gray-500">No cashbook transactions for this selection.</p>
          ) : null}
          {data?.pagination && (
            <Pagination
              page={page}
              pageSize={pageSize}
              totalRecords={data.pagination.totalRecords}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          )}
        </div>
      </section>

      <section className="space-y-4 border-t border-gray-200 pt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h4 className="font-bold text-gray-900">Daily Cash Reconciliation</h4>
            <p className="mt-1 text-xs text-gray-500">Compare the ledger balance with the physical or provider-statement balance.</p>
          </div>
          <label className="text-[10px] font-bold uppercase text-gray-500">Reconciliation date
            <input type="date" max={today} value={reconciliationDate} onChange={(event) => setReconciliationDate(event.target.value)} className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm font-normal normal-case text-gray-900" />
          </label>
        </div>
        {capabilities.can_reconcile && (
          <form onSubmit={saveReconciliation} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="text-[10px] font-bold uppercase text-gray-500">Account
              <select required value={reconciliationAccount} onChange={(event) => { setReconciliationAccount(event.target.value); setCountedBalance(""); }} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case text-gray-900">
                <option value="">Select account</option>
                {(reconciliationData?.accounts || []).map((account) => <option key={account.code} value={account.code}>{account.name}</option>)}
              </select>
            </label>
            <div className="text-[10px] font-bold uppercase text-gray-500">Expected balance
              <p className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold normal-case text-gray-800">{formatUGX(selectedReconciliation?.expected_balance)}</p>
            </div>
            <label className="text-[10px] font-bold uppercase text-gray-500">Counted balance
              <input required type="number" min="0" max="9999999999.99" step="0.01" value={countedBalance} onChange={(event) => setCountedBalance(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal normal-case text-gray-900" />
            </label>
            <label className="text-[10px] font-bold uppercase text-gray-500">Note
              <input maxLength={1000} value={reconciliationNote} onChange={(event) => setReconciliationNote(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal normal-case text-gray-900" />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {calculatedDiscrepancy !== null && <span className={`text-xs font-bold ${calculatedDiscrepancy === 0 ? "text-green-700" : "text-red-700"}`}>Difference: {formatUGX(calculatedDiscrepancy)}</span>}
              <button type="submit" disabled={savingReconciliation || !selectedReconciliation || countedBalance === ""} className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">{savingReconciliation ? "Saving..." : "Save count"}</button>
            </div>
          </form>
        )}
        <div className="overflow-x-auto border-b border-gray-200">
          <table className="w-full min-w-[800px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-gray-300">{["Account", "Expected", "Counted", "Discrepancy", "Note", "Reconciled By"].map((column) => <th key={column} className="whitespace-nowrap px-3 py-3 text-xs font-bold text-gray-600">{column}</th>)}</tr></thead>
            <tbody>
              {(reconciliationData?.reconciliations || []).map((item) => (
                <tr key={item.code} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-3 text-gray-800">{item.name}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-800">{formatUGX(item.expected_balance)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-800">{item.counted_balance == null ? "Not reconciled" : formatUGX(item.counted_balance)}</td>
                  <td className={`whitespace-nowrap px-3 py-3 font-semibold ${Number(item.discrepancy || 0) === 0 ? "text-green-700" : "text-red-700"}`}>{item.discrepancy == null ? "-" : formatUGX(item.discrepancy)}</td>
                  <td className="px-3 py-3 text-gray-800">{item.note || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-800">{item.reconciled_by || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 border-t border-gray-200 pt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h4 className="font-bold text-gray-900">Cashbook Audit Trail</h4>
            <p className="mt-1 text-xs text-gray-500">Transaction creation, edits, decisions, reversals and reconciliation changes.</p>
          </div>
          <label className="text-[10px] font-bold uppercase text-gray-500">Search audit activity
            <input type="search" value={auditSearchInput} onChange={(event) => setAuditSearchInput(event.target.value)} placeholder="Actor, action, reference..." className="mt-1 block w-64 max-w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal normal-case text-gray-900" />
          </label>
        </div>
        <div className="overflow-x-auto border-b border-gray-200">
          {(auditData?.entries || []).length ? (
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-gray-300">{["Date", "Record", "Action", "Actor", "Details"].map((column) => <th key={column} className="whitespace-nowrap px-3 py-3 text-xs font-bold text-gray-600">{column}</th>)}</tr></thead>
              <tbody>
                {auditData.entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-3 text-gray-800">{entry.created_at ? new Date(entry.created_at).toLocaleString("en-GB", { timeZone: "Africa/Kampala" }) : "-"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-800">{entry.details?.reference || entry.entity_type} · {entry.entity_id}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-800">{entry.action}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-800">{entry.actor || "-"}</td>
                    <td className="max-w-[480px] whitespace-pre-wrap break-words px-3 py-3 text-gray-800">{typeof entry.details === "string" ? entry.details : JSON.stringify(entry.details || {})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="py-6 text-center text-sm text-gray-500">No cashbook audit activity found.</p>}
          {auditData?.pagination && (
            <Pagination
              page={auditPage}
              pageSize={auditData.pagination.pageSize}
              totalRecords={auditData.pagination.totalRecords}
              onPageChange={setAuditPage}
              onPageSizeChange={() => {}}
            />
          )}
        </div>
      </section>
    </div>
  );
}
