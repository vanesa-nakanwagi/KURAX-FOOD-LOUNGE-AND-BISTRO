import React, { useEffect, useState } from "react";
import { FileText, FileSpreadsheet, PlusCircle, Package, Calendar, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import API_URL from "../../config/api";
import { downloadReportPdf } from "../reportExport";

function buildReportSections(reportType, data) {
  if (reportType === "income") {
    const revenueRows = (data.revenue || []).map((row) => [row.account_code, row.account_name, Number(row.amount || 0)]);
    const expenseRows = (data.expenses || []).map((row) => [row.account_code, row.account_name, Number(row.amount || 0)]);

    return [
      {
        title: "Revenue",
        columns: ["Account Code", "Account", "Amount (UGX)"],
        rows: [...revenueRows, ["", "Total Revenue", Number(data.totalRevenue || 0)]],
      },
      {
        title: "Expenses",
        columns: ["Account Code", "Account", "Amount (UGX)"],
        rows: [...expenseRows, ["", "Total Expenses", Number(data.totalExpenses || 0)]],
      },
      {
        title: "Net Profit",
        columns: ["Metric", "Amount (UGX)"],
        rows: [["Net Profit", Number(data.netProfit || 0)]],
      },
    ];
  }

  const currentYear = data.asOfDate?.slice(0, 4) || "Current year";
  const priorYear = data.priorAsOfDate?.slice(0, 4) || "Prior year";
  const accountRows = (accounts = []) => accounts.map((account) => [
    account.account_name,
    Number(account.balance || 0),
    Number(account.prior_balance || 0),
  ]);
  const columns = ["Account", `${currentYear} (UGX)`, `${priorYear} (UGX)`];

  return [
    {
      title: "Assets",
      columns,
      rows: [
        ["Current assets", "", ""],
        ...accountRows(data.assets?.current_accounts),
        ["Total current assets", Number(data.assets?.total_current_assets || 0), Number(data.assets?.prior_year_total_current_assets || 0)],
        ["Non-current assets", "", ""],
        ...accountRows(data.assets?.non_current_accounts),
        ["Total non-current assets", Number(data.assets?.total_non_current_assets || 0), Number(data.assets?.prior_year_total_non_current_assets || 0)],
        ["Total assets", Number(data.assets?.total_assets || 0), Number(data.assets?.prior_year_total_assets || 0)],
      ],
    },
    {
      title: "Liabilities and shareholders' equity",
      columns,
      rows: [
        ["Current liabilities", "", ""],
        ...accountRows(data.liabilities?.current_accounts),
        ["Total current liabilities", Number(data.liabilities?.total_current_liabilities || 0), Number(data.liabilities?.prior_year_total_current_liabilities || 0)],
        ["Non-current liabilities", "", ""],
        ...accountRows(data.liabilities?.non_current_accounts),
        ["Total non-current liabilities", Number(data.liabilities?.total_non_current_liabilities || 0), Number(data.liabilities?.prior_year_total_non_current_liabilities || 0)],
        ["Total liabilities", Number(data.liabilities?.total_liabilities || 0), Number(data.liabilities?.prior_year_total_liabilities || 0)],
        ["Shareholders' equity", "", ""],
        ...accountRows(data.equity?.accounts),
        ["Total shareholders' equity", Number(data.equity?.total_equity || 0), Number(data.equity?.prior_year_total_equity || 0)],
        ["Total liabilities and shareholders' equity", Number(data.total_liabilities_and_equity || 0), Number(data.prior_year_total_liabilities_and_equity || 0)],
        ["Balance difference", Number(data.difference || 0), Number(data.prior_year_difference || 0)],
      ],
    },
  ];
}

function formatUGX(value) {
  return `UGX ${Number(value || 0).toLocaleString()}`;
}

export default function ReportsPanel({ dark = false, initialDateRange, timeRange, onDateRangeChange }) {
  const [activeTab, setActiveTab] = useState("reports");
  const [reportType, setReportType] = useState("income");
  const [dateRange, setDateRange] = useState(() => {
    if (initialDateRange?.start && initialDateRange?.end) return initialDateRange;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, "0");
    return { start: `${year}-${month}-01`, end: `${year}-${month}-${lastDay}` };
  });
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialDateRange?.start && initialDateRange?.end) setDateRange(initialDateRange);
  }, [initialDateRange?.start, initialDateRange?.end]);

  const updateDateRange = (nextRange) => {
    setDateRange(nextRange);
    onDateRangeChange?.(nextRange);
  };

  const [purchaseForm, setPurchaseForm] = useState({
    purchase_date: new Date().toISOString().split("T")[0],
    supplier: "",
    total_amount: "",
    invoice_number: "",
    notes: ""
  });
  const [savingPurchase, setSavingPurchase] = useState(false);

  const [snapshotForm, setSnapshotForm] = useState({
    snapshot_date: new Date().toISOString().split("T")[0],
    total_value: "",
    notes: ""
  });
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  const generateReport = async () => {
    if (!dateRange.start || !dateRange.end) {
      setError("Please select both start and end dates");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const endpoint = reportType === "income"
        ? `${API_URL}/api/accountant/reports/income-statement`
        : `${API_URL}/api/accountant/reports/balance-sheet`;
      const body = reportType === "income"
        ? { startDate: dateRange.start, endDate: dateRange.end, startTime: timeRange?.start || null, endTime: timeRange?.end || null }
        : { asOfDate: dateRange.end, startTime: timeRange?.start || null, endTime: timeRange?.end || null };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setReportData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectReportMonth = (value) => {
    if (!value) return;
    const [year, month] = value.split("-").map(Number);
    const lastDay = String(new Date(year, month, 0).getDate()).padStart(2, "0");
    updateDateRange({
      start: `${value}-01`,
      end: `${value}-${lastDay}`,
    });
    setReportData(null);
    setError("");
  };

  const savePurchase = async () => {
    if (!purchaseForm.purchase_date || !purchaseForm.total_amount) {
      alert("Purchase date and total amount are required");
      return;
    }
    setSavingPurchase(true);
    try {
      const res = await fetch(`${API_URL}/api/accountant/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(purchaseForm)
      });
      if (!res.ok) throw new Error(await res.text());
      alert("Purchase recorded successfully");
      setPurchaseForm({
        purchase_date: new Date().toISOString().split("T")[0],
        supplier: "",
        total_amount: "",
        invoice_number: "",
        notes: ""
      });
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSavingPurchase(false);
    }
  };

  const saveSnapshot = async () => {
    if (!snapshotForm.snapshot_date || !snapshotForm.total_value) {
      alert("Date and total inventory value are required");
      return;
    }
    setSavingSnapshot(true);
    try {
      const res = await fetch(`${API_URL}/api/accountant/inventory-snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshotForm)
      });
      if (!res.ok) throw new Error(await res.text());
      alert("Inventory snapshot saved");
      setSnapshotForm({
        snapshot_date: new Date().toISOString().split("T")[0],
        total_value: "",
        notes: ""
      });
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSavingSnapshot(false);
    }
  };

  const getReportTitle = () => reportType === "income" ? "Income Statement" : "Balance Sheet";

  const handleExportPdf = () => {
    if (!reportData) return;
    const asOfDate = reportType === "balance";
    const dateLabel = dateRange.end || "latest";
    downloadReportPdf({
      filename: `${reportType}_report_${dateLabel}.pdf`,
      title: getReportTitle(),
      companyName: asOfDate ? "KURAX FOOD LOUNGE AND BISTRO" : "",
      periodText: `${asOfDate ? `As of: ${dateLabel}` : `Period: ${dateRange.start} to ${dateLabel}`}${timeRange?.start || timeRange?.end ? `, ${timeRange.start || "00:00"} to ${timeRange.end || "23:59"}` : ""}`,
      footerLabel: "Financial Report",
      from: dateRange.start,
      to: dateLabel,
      sections: buildReportSections(reportType, reportData),
    });
  };

  const handleExportExcel = () => {
    if (!reportData) return;
    const asOfDate = reportType === "balance";
    const rows = [
      [getReportTitle()],
      ...(asOfDate ? [["KURAX FOOD LOUNGE AND BISTRO"]] : []),
      [asOfDate ? "As of" : "Period start", asOfDate ? dateRange.end : dateRange.start],
      ...(!asOfDate ? [["Period end", dateRange.end]] : []),
      ...(timeRange?.start || timeRange?.end ? [["Time", `${timeRange.start || "00:00"} to ${timeRange.end || "23:59"}`]] : []),
      [],
    ];

    buildReportSections(reportType, reportData).forEach((section) => {
      rows.push([section.title], section.columns, ...section.rows, []);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = [{ wch: 38 }, { wch: 22 }, { wch: 22 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Financial Report");
    XLSX.writeFile(workbook, `${reportType}_report_${dateRange.end || "latest"}.xlsx`);
  };

  // ✅ FIXED: input styles with proper text color based on theme
  const inputClass = dark
    ? "w-full bg-zinc-800 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
    : "w-full bg-white border border-gray-300 rounded-xl p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500";

  const containerClass = dark
    ? "bg-zinc-900/30 border-white/5"
    : "bg-white border-gray-200 shadow-sm";

  const textClass = dark ? "text-white" : "text-gray-900";
  const labelClass = "block text-[9px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className={`text-2xl font-black uppercase leading-none ${textClass}`}>
          Financial Reports & Inventory
        </h2>
        <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">
          Generate income statement / balance sheet • Record purchases • Log inventory snapshots
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-white/10">
        <button
          onClick={() => setActiveTab("reports")}
          className={`px-5 py-2 text-[10px] font-black uppercase tracking-wider transition-all
            ${activeTab === "reports"
              ? "text-yellow-600 border-b-2 border-yellow-500"
              : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
        >
          <FileText size={12} className="inline mr-1" /> Generate Report
        </button>
        <button
          onClick={() => setActiveTab("inventory")}
          className={`px-5 py-2 text-[10px] font-black uppercase tracking-wider transition-all
            ${activeTab === "inventory"
              ? "text-yellow-600 border-b-2 border-yellow-500"
              : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
        >
          <Package size={12} className="inline mr-1" /> Inventory Data Entry
        </button>
      </div>

      {/* ========== TAB 1: REPORTS ========== */}
      {activeTab === "reports" && (
        <div className={`rounded-2xl p-6 space-y-5 ${containerClass}`}>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className={labelClass}>Report Month</label>
              <input
                type="month"
                value={dateRange.start.slice(0, 7)}
                onChange={(e) => selectReportMonth(e.target.value)}
                className={inputClass + " w-44"}
              />
            </div>
            <div>
              <label className={labelClass}>Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className={inputClass + " w-40"}
              >
                <option value="income">Income Statement (P&L)</option>
                <option value="balance">Balance Sheet</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => updateDateRange({ ...dateRange, start: e.target.value })}
                className={inputClass + " w-44"}
              />
            </div>
            <div>
              <label className={labelClass}>End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => updateDateRange({ ...dateRange, end: e.target.value })}
                className={inputClass + " w-44"}
              />
            </div>
            <button
              onClick={generateReport}
              disabled={isLoading}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-black px-5 py-3 rounded-xl text-[10px] uppercase disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : "Generate Report"}
            </button>
            {reportData && (
              <>
                <button
                  onClick={handleExportPdf}
                  className="border border-gray-300 dark:border-white/20 px-4 py-3 rounded-xl text-[10px] font-black hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                >
                  <FileText size={12} /> Export PDF
                </button>
                <button
                  onClick={handleExportExcel}
                  className="border border-gray-300 dark:border-white/20 px-4 py-3 rounded-xl text-[10px] font-black hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                >
                  <FileSpreadsheet size={12} /> Export Excel
                </button>
              </>
            )}
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}

          {reportData && (
            <section className="report-preview mt-6 space-y-5 bg-white p-5 text-gray-900">
              <header className="border-b border-gray-200 pb-4">
                <h3 className="text-xl font-black">{getReportTitle()}</h3>
                {reportType === "balance" && <p className="mt-1 text-sm font-semibold">KURAX FOOD LOUNGE AND BISTRO</p>}
                <p className="mt-1 text-sm text-gray-500">
                  {reportType === "balance"
                    ? `As of ${dateRange.end}`
                    : `${dateRange.start} to ${dateRange.end}`}
                </p>
              </header>
              {buildReportSections(reportType, reportData).map((section) => (
                <div key={section.title} className="overflow-x-auto">
                  <h4 className="mb-2 text-sm font-bold uppercase text-gray-600">{section.title}</h4>
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-300">
                        {section.columns.map((column) => (
                          <th key={column} className="px-3 py-2 font-bold">{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row, rowIndex) => (
                        <tr key={`${section.title}-${rowIndex}`} className="border-b border-gray-100">
                          {row.map((value, columnIndex) => (
                            <td key={`${section.title}-${rowIndex}-${columnIndex}`} className="px-3 py-2">
                              {typeof value === "number"
                                ? formatUGX(value)
                                : value}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {/* ========== TAB 2: INVENTORY DATA ENTRY ========== */}
      {activeTab === "inventory" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Record Purchase */}
          <div className={`rounded-2xl p-6 space-y-4 ${containerClass}`}>
            <h3 className="text-[11px] font-black uppercase text-yellow-600 flex items-center gap-2">
              <PlusCircle size={14} /> Record Purchase
            </h3>
            <div className="space-y-3">
              <input
                type="date"
                value={purchaseForm.purchase_date}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Supplier (optional)"
                value={purchaseForm.supplier}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })}
                className={inputClass}
              />
              <input
                type="number"
                placeholder="Total Amount *"
                value={purchaseForm.total_amount}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, total_amount: e.target.value })}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Invoice Number (optional)"
                value={purchaseForm.invoice_number}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, invoice_number: e.target.value })}
                className={inputClass}
              />
              <textarea
                placeholder="Notes (optional)"
                value={purchaseForm.notes}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                className={inputClass + " resize-none h-20"}
              />
              <button
                onClick={savePurchase}
                disabled={savingPurchase}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-black py-3 rounded-xl text-[10px] uppercase disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingPurchase ? <Loader2 size={14} className="animate-spin" /> : "Save Purchase"}
              </button>
            </div>
          </div>

          {/* Inventory Snapshot */}
          <div className={`rounded-2xl p-6 space-y-4 ${containerClass}`}>
            <h3 className="text-[11px] font-black uppercase text-emerald-600 flex items-center gap-2">
              <Calendar size={14} /> Inventory Snapshot (Total Stock Value)
            </h3>
            <div className="space-y-3">
              <input
                type="date"
                value={snapshotForm.snapshot_date}
                onChange={(e) => setSnapshotForm({ ...snapshotForm, snapshot_date: e.target.value })}
                className={inputClass}
              />
              <input
                type="number"
                placeholder="Total Inventory Value (UGX) *"
                value={snapshotForm.total_value}
                onChange={(e) => setSnapshotForm({ ...snapshotForm, total_value: e.target.value })}
                className={inputClass}
              />
              <textarea
                placeholder="Notes (e.g., physical count done by ...)"
                value={snapshotForm.notes}
                onChange={(e) => setSnapshotForm({ ...snapshotForm, notes: e.target.value })}
                className={inputClass + " resize-none h-24"}
              />
              <button
                onClick={saveSnapshot}
                disabled={savingSnapshot}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl text-[10px] uppercase disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingSnapshot ? <Loader2 size={14} className="animate-spin" /> : "Save Snapshot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}