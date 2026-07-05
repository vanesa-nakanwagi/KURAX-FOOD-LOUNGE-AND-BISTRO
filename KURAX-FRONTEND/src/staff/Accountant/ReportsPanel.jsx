import React, { useState } from "react";
import { FileText, PlusCircle, Package, Calendar, TrendingUp, TrendingDown, Printer, Download, Loader2 } from "lucide-react";
import API_URL from "../../config/api";

export default function ReportsPanel({ dark = false }) {
  const [activeTab, setActiveTab] = useState("reports");
  const [reportType, setReportType] = useState("income");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
        ? { startDate: dateRange.start, endDate: dateRange.end }
        : { asOfDate: dateRange.end };
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

  const handlePrint = () => window.print();
  const handleDownload = () => {
    if (!reportData) return;
    const dataStr = JSON.stringify(reportData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}_report_${dateRange.end || "latest"}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className={inputClass + " w-44"}
              />
            </div>
            <div>
              <label className={labelClass}>End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
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
                  onClick={handlePrint}
                  className="border border-gray-300 dark:border-white/20 px-4 py-3 rounded-xl text-[10px] font-black hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                >
                  <Printer size={12} /> Print
                </button>
                <button
                  onClick={handleDownload}
                  className="border border-gray-300 dark:border-white/20 px-4 py-3 rounded-xl text-[10px] font-black hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                >
                  <Download size={12} /> Export JSON
                </button>
              </>
            )}
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}

          {/* Income Statement Display */}
          {reportData && reportType === "income" && (
            <div className="mt-6 space-y-4 overflow-x-auto">
              <h3 className="text-lg font-black">Income Statement</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-black/40 p-4 rounded-xl">
                  <p className="text-gray-500 text-xs">Total Revenue</p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    UGX {reportData.revenue?.toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-black/40 p-4 rounded-xl">
                  <p className="text-gray-500 text-xs">Cost of Goods Sold</p>
                  <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
                    UGX {reportData.cogs?.toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-black/40 p-4 rounded-xl">
                  <p className="text-gray-500 text-xs">Beginning Inventory</p>
                  <p className="font-bold text-gray-900 dark:text-white">{reportData.beginning_inventory?.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 dark:bg-black/40 p-4 rounded-xl">
                  <p className="text-gray-500 text-xs">Purchases</p>
                  <p className="font-bold text-gray-900 dark:text-white">{reportData.purchases?.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 dark:bg-black/40 p-4 rounded-xl">
                  <p className="text-gray-500 text-xs">Ending Inventory</p>
                  <p className="font-bold text-gray-900 dark:text-white">{reportData.ending_inventory?.toLocaleString()}</p>
                </div>
                <div className="bg-yellow-100 dark:bg-yellow-500/20 p-4 rounded-xl col-span-1 sm:col-span-2">
                  <p className="text-gray-700 dark:text-gray-300 font-bold">Net Income</p>
                  <p className="text-3xl font-black text-yellow-700 dark:text-yellow-400">
                    UGX {reportData.netIncome?.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Balance Sheet Display */}
          {reportData && reportType === "balance" && (
            <div className="mt-6">
              <h3 className="text-lg font-black">Balance Sheet (as of {dateRange.end})</h3>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-gray-50 dark:bg-black/40 p-4 rounded-xl">
                  <p className="text-gray-500 text-xs">Inventory (Asset)</p>
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    UGX {reportData.assets?.inventory?.toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-black/40 p-4 rounded-xl">
                  <p className="text-gray-500 text-xs">Total Assets</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    UGX {reportData.assets?.total_assets?.toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Note: Cash, receivables, liabilities, and equity will be added in a future update.
              </p>
            </div>
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