import React, { useEffect, useState } from "react";
import { FileText, FileSpreadsheet, PlusCircle, Package, Calendar, Loader2, TrendingUp } from "lucide-react";
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
        rows: [...revenueRows, ["", "Net Sales", Number(data.totalRevenue || 0)]],
      },
      {
        title: "Sales Adjustments",
        columns: ["Metric", "Amount (UGX)"],
        rows: [
          ["Gross Sales", Number(data.grossSales || 0)],
          ["Discounts", Number(data.totalDiscounts || 0)],
          ["Approved voids / refunds", Number(data.totalRefunds || 0)],
          ["Net Sales", Number(data.netSales ?? data.totalRevenue ?? 0)],
        ],
      },
      {
        title: "Cost of Goods Sold",
        columns: ["Account", "Amount (UGX)"],
        rows: [["Ingredient costs", Number(data.costOfGoodsSold || 0)]],
      },
      {
        title: "Gross Profit",
        columns: ["Metric", "Amount"],
        rows: [
          ["Gross Profit (UGX)", Number(data.grossProfit || 0)],
          ["Gross Profit Margin", `${Number(data.grossProfitMargin || 0).toFixed(1)}%`],
        ],
      },
      {
        title: "Expenses",
        columns: ["Account Code", "Account", "Amount (UGX)"],
        rows: [...expenseRows, ["", "Total Operating Expenses", Number(data.totalOperatingExpenses ?? data.totalExpenses ?? 0)]],
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

function buildMenuProfitabilitySections(report) {
  const summary = report?.summary || {};
  const rows = (report?.rows || []).map((row) => [
    row.menu_name || '',
    row.category || '',
    Number(row.quantity_sold || 0),
    Number(row.selling_price || 0),
    Number(row.net_sales || 0),
    Number(row.cogs || 0),
    Number(row.gross_profit || 0),
    Number(row.gross_profit_margin || 0),
    Number(row.contribution || 0),
    row.profitability_status || 'Profitable',
  ]);

  return [
    {
      title: 'Summary',
      columns: ['Metric', 'Value'],
      rows: [
        ['Total net sales (UGX)', Number(summary.totalNetSales || 0)],
        ['Ingredient COGS (UGX)', Number(summary.totalCogs || 0)],
        ['Gross profit (UGX)', Number(summary.grossProfit || 0)],
        ['Gross margin (%)', Number(summary.grossProfitMargin || 0)],
      ],
    },
    {
      title: 'Menu Item Profitability',
      columns: ['Menu item', 'Category', 'Qty sold', 'Selling price (UGX)', 'Net sales (UGX)', 'Ingredient cost (UGX)', 'Gross profit (UGX)', 'Margin (%)', 'Contribution (UGX)', 'Status'],
      rows,
    },
  ];
}

function staffAuthHeaders() {
  try {
    const token = JSON.parse(localStorage.getItem('kurax_user') || '{}').token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export default function ReportsPanel({ dark = false, initialDateRange, timeRange, onDateRangeChange, hideFinancialTabs = false }) {
  const [activeTab, setActiveTab] = useState(hideFinancialTabs ? "menu-profitability" : "reports");
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
  const [menuProfitability, setMenuProfitability] = useState(null);
  const [menuProfitabilityLoading, setMenuProfitabilityLoading] = useState(false);
  const [menuProfitabilityError, setMenuProfitabilityError] = useState("");
  const [menuFilters, setMenuFilters] = useState({
    start: dateRange.start,
    end: dateRange.end,
    category: 'ALL',
    search: '',
    sortBy: 'gross_profit',
    sortDir: 'desc',
  });

  const availableCategories = [...new Set([
    'Starters',
    'Local Foods',
    'Drinks & Cocktails',
    ...(menuProfitability?.categories || []),
  ].filter(Boolean))].sort();

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

  const loadMenuProfitability = async () => {
    if (!menuFilters.start || !menuFilters.end) {
      setMenuProfitabilityError('Please select both dates for the menu profitability report.');
      return;
    }

    setMenuProfitabilityLoading(true);
    setMenuProfitabilityError('');

    try {
      const params = new URLSearchParams({
        startDate: menuFilters.start,
        endDate: menuFilters.end,
        sortBy: menuFilters.sortBy,
        sortDir: menuFilters.sortDir,
      });
      if (menuFilters.category && menuFilters.category !== 'ALL') params.set('category', menuFilters.category);
      if (menuFilters.search) params.set('search', menuFilters.search);

      const res = await fetch(`${API_URL}/api/reports/menu-profitability?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json', ...staffAuthHeaders() },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMenuProfitability(data);
    } catch (err) {
      setMenuProfitabilityError(err.message || 'Unable to generate the menu profitability report.');
    } finally {
      setMenuProfitabilityLoading(false);
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

  const exportMenuProfitabilityExcel = () => {
    if (!menuProfitability) return;
    const reportSections = buildMenuProfitabilitySections(menuProfitability);
    const rows = [
      ['Menu Profitability Report'],
      ['Period', `${menuFilters.start} to ${menuFilters.end}`],
      ['Category', menuFilters.category === 'ALL' ? 'All categories' : menuFilters.category],
      ...(menuFilters.search ? [['Search', menuFilters.search]] : []),
      [],
    ];

    reportSections.forEach((section) => rows.push([section.title], section.columns, ...section.rows, []));
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 12 }, ...Array(7).fill({ wch: 20 }), { wch: 18 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Menu Profitability');
    XLSX.writeFile(workbook, `menu_profitability_${menuFilters.start}_to_${menuFilters.end}.xlsx`);
  };

  const exportMenuProfitabilityPdf = () => {
    if (!menuProfitability) return;
    const filterText = [
      menuFilters.category !== 'ALL' ? `Category: ${menuFilters.category}` : '',
      menuFilters.search ? `Search: ${menuFilters.search}` : '',
    ].filter(Boolean).join(' | ');
    downloadReportPdf({
      filename: `menu_profitability_${menuFilters.start}_to_${menuFilters.end}.pdf`,
      title: 'Menu Profitability Report',
      companyName: 'KURAX FOOD LOUNGE AND BISTRO',
      periodText: `Period: ${menuFilters.start} to ${menuFilters.end}${filterText ? ` | ${filterText}` : ''}`,
      footerLabel: 'Menu Profitability Report',
      from: menuFilters.start,
      to: menuFilters.end,
      orientation: 'landscape',
      sections: buildMenuProfitabilitySections(menuProfitability),
    });
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
          {hideFinancialTabs ? "Menu Profitability" : "Financial Reports & Inventory"}
        </h2>
        <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">
          {hideFinancialTabs
            ? "Track menu performance and profit by category and item."
            : "Generate income statement / balance sheet • Record purchases • Log inventory snapshots"}
        </p>
      </div>

      {/* Tabs */}
      {!hideFinancialTabs ? (
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
            onClick={() => setActiveTab("menu-profitability")}
            className={`px-5 py-2 text-[10px] font-black uppercase tracking-wider transition-all
              ${activeTab === "menu-profitability"
                ? "text-yellow-600 border-b-2 border-yellow-500"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
          >
            <TrendingUp size={12} className="inline mr-1" /> Menu Profitability
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
      ) : (
        <div className="flex gap-2 border-b border-gray-200 dark:border-white/10">
          <button
            onClick={() => setActiveTab("menu-profitability")}
            className={`px-5 py-2 text-[10px] font-black uppercase tracking-wider transition-all text-yellow-600 border-b-2 border-yellow-500`}
          >
            <TrendingUp size={12} className="inline mr-1" /> Menu Profitability
          </button>
        </div>
      )}

      {/* ========== TAB 1: REPORTS ========== */}
      {!hideFinancialTabs && activeTab === "reports" && (
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

      {(activeTab === "menu-profitability" || hideFinancialTabs) && (
        <div className={`rounded-2xl p-6 space-y-5 ${containerClass}`}>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className={labelClass}>Start Date</label>
              <input type="date" value={menuFilters.start} onChange={(e) => setMenuFilters((current) => ({ ...current, start: e.target.value }))} className={inputClass + " w-44"} />
            </div>
            <div>
              <label className={labelClass}>End Date</label>
              <input type="date" value={menuFilters.end} onChange={(e) => setMenuFilters((current) => ({ ...current, end: e.target.value }))} className={inputClass + " w-44"} />
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <select value={menuFilters.category} onChange={(e) => setMenuFilters((current) => ({ ...current, category: e.target.value }))} className={inputClass + " w-40"}>
                <option value="ALL">All categories</option>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Search</label>
              <input type="text" value={menuFilters.search} onChange={(e) => setMenuFilters((current) => ({ ...current, search: e.target.value }))} placeholder="Menu item" className={inputClass + " w-52"} />
            </div>
            <div>
              <label className={labelClass}>Sort</label>
              <select value={menuFilters.sortBy} onChange={(e) => setMenuFilters((current) => ({ ...current, sortBy: e.target.value }))} className={inputClass + " w-40"}>
                <option value="gross_profit">Gross profit</option>
                <option value="net_sales">Net sales</option>
                <option value="cogs">Ingredient cost</option>
                <option value="gross_profit_margin">Margin</option>
                <option value="menu_name">Menu item</option>
              </select>
            </div>
            <button onClick={loadMenuProfitability} disabled={menuProfitabilityLoading} className="bg-yellow-500 hover:bg-yellow-600 text-black font-black px-5 py-3 rounded-xl text-[10px] uppercase disabled:opacity-50 flex items-center gap-2">
              {menuProfitabilityLoading ? <Loader2 size={14} className="animate-spin" /> : 'Run report'}
            </button>
            <button onClick={exportMenuProfitabilityExcel} disabled={!menuProfitability || menuProfitabilityLoading} aria-label="Download menu profitability as Excel" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[10px] font-black uppercase text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button onClick={exportMenuProfitabilityPdf} disabled={!menuProfitability || menuProfitabilityLoading} aria-label="Download menu profitability as PDF" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-black uppercase text-red-800 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50">
              <FileText size={14} /> PDF
            </button>
          </div>

          {menuProfitabilityError && <div className="text-red-500 text-sm">{menuProfitabilityError}</div>}

          {menuProfitability && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[['Total net sales', menuProfitability.summary.totalNetSales], ['Ingredient COGS', menuProfitability.summary.totalCogs], ['Gross profit', menuProfitability.summary.grossProfit], ['Gross margin', `${Number(menuProfitability.summary.grossProfitMargin || 0).toFixed(1)}%`]].map(([label, value]) => (
                  <div key={label} className="border-l-2 border-amber-500 bg-zinc-50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase text-zinc-500">{label}</p>
                    <p className="mt-1 text-lg font-black">{label.includes('margin') ? value : formatUGX(value)}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-2 py-2">Menu item</th>
                      <th className="px-2 py-2">Category</th>
                      <th className="px-2 py-2">Qty sold</th>
                      <th className="px-2 py-2">Selling price</th>
                      <th className="px-2 py-2">Net sales</th>
                      <th className="px-2 py-2">Ingredient cost</th>
                      <th className="px-2 py-2">Gross profit</th>
                      <th className="px-2 py-2">Margin</th>
                      <th className="px-2 py-2">Contribution</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(menuProfitability.rows || []).map((row) => (
                      <tr key={`${row.menu_name}-${row.category}`} className="border-b border-gray-100 align-top">
                        <td className="px-2 py-2 font-semibold">{row.menu_name}</td>
                        <td className="px-2 py-2">{row.category}</td>
                        <td className="px-2 py-2">{Number(row.quantity_sold || 0)}</td>
                        <td className="px-2 py-2">{formatUGX(row.selling_price || 0)}</td>
                        <td className="px-2 py-2">{formatUGX(row.net_sales || 0)}</td>
                        <td className="px-2 py-2">{formatUGX(row.cogs || 0)}</td>
                        <td className="px-2 py-2 font-bold text-emerald-700">{formatUGX(row.gross_profit || 0)}</td>
                        <td className="px-2 py-2">{Number(row.gross_profit_margin || 0).toFixed(1)}%</td>
                        <td className="px-2 py-2">{formatUGX(row.contribution || 0)}</td>
                        <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${Number(row.gross_profit || 0) >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{row.profitability_status || 'Profitable'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========== TAB 2: INVENTORY DATA ENTRY ========== */}
      {!hideFinancialTabs && activeTab === "inventory" && (
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