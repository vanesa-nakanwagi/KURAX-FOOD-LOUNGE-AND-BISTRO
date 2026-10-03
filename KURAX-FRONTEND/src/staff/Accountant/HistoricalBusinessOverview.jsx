import React, { useEffect, useState } from "react";
import { AlertTriangle, BookOpen, RefreshCw } from "lucide-react";

function formatUGX(value) {
  return `UGX ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export default function HistoricalBusinessOverview({ API_URL, dateRange, timeRange, onOpenReports }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ startDate: dateRange.start, endDate: dateRange.end });
        if (timeRange.start) query.set("startTime", timeRange.start);
        if (timeRange.end) query.set("endTime", timeRange.end);
        const response = await fetch(`${API_URL}/api/accountant/accounting/historical-summary?${query}`);
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
        if (active) setData(result);
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError.message || "Could not load historical activity.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [API_URL, dateRange.start, dateRange.end, timeRange.start, timeRange.end]);

  const sales = data?.sales || {};
  const metrics = [
    ["Sales recorded", formatUGX(sales.total_gross)],
    ["Orders", Number(sales.order_count || 0).toLocaleString()],
    ["Credit settlements", formatUGX(sales.credit_settlements)],
    ["Ledger expenses", formatUGX((data?.expenses || []).reduce((sum, row) => sum + Number(row.amount || 0), 0))],
    ["Petty cash out", formatUGX(data?.petty_cash_out)],
    ["Cash flow change", formatUGX(data?.cash_flow?.net_change_in_cash)],
  ];
  const activities = [
    ...(data?.orders || []).map((row) => ({ key: `order-${row.id}`, type: "Order", at: row.transaction_at, reference: `Order #${row.id} · ${row.table_name || "Table not set"}`, actor: row.staff_name, status: `${row.status || "Unknown"} · ${row.payment_method || "Payment not set"}`, amount: row.total })),
    ...(data?.credits || []).map((row) => ({ key: `credit-${row.id}`, type: "Credit", at: row.created_at, reference: row.client_name || `Credit #${row.id}`, actor: "", status: row.status, amount: row.amount })),
    ...(data?.credit_settlements || []).map((row) => ({ key: `settlement-${row.id}`, type: "Credit settlement", at: row.created_at, reference: row.client_name || `Credit #${row.credit_id}`, actor: row.method, status: "Settled", amount: row.amount_paid })),
    ...(data?.station_tickets || []).map((row) => ({ key: `ticket-${row.station}-${row.id}`, type: `${row.station} ticket`, at: row.created_at, reference: `Ticket #${row.id} · ${row.table_name || "Table not set"}`, actor: row.staff_name, status: row.status, amount: row.total })),
    ...(data?.shisha_orders || []).map((row) => ({ key: `shisha-${row.id}`, type: "Shisha order", at: row.created_at, reference: `Shisha #${row.id}`, actor: `Waiter ${row.shisha_waiter_id || "-"}`, status: row.order_status, amount: row.total_amount })),
  ].sort((left, right) => new Date(right.at || 0) - new Date(left.at || 0));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-amber-300 pb-4">
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-800"><AlertTriangle size={14} /> Historical business activity</p>
          <h2 className="mt-1 text-2xl font-black text-gray-900">{formatDate(dateRange.start)}{dateRange.end !== dateRange.start ? ` to ${formatDate(dateRange.end)}` : ""}</h2>
          {(timeRange.start || timeRange.end) && <p className="mt-1 text-xs text-gray-600">Time range: {timeRange.start || "00:00"} to {timeRange.end || "23:59"}</p>}
        </div>
        <button type="button" onClick={onOpenReports} className="inline-flex items-center gap-2 border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
          <BookOpen size={14} /> Accounting reports
        </button>
      </header>

      <p className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-xs text-amber-950">
        This view includes date-filtered orders, credit activity, settlements, station tickets, shisha orders, daily summaries, petty cash, and the accounting ledger. Use Department Reports and Staff Sales Performance for their date-filtered breakdowns. Daily summary and older date-only entries remain full-day totals when a time filter is set.
      </p>
      {error && <p role="alert" className="border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading && !data ? (
        <p className="py-10 text-center text-sm text-gray-500"><RefreshCw size={15} className="mr-2 inline animate-spin" />Loading historical activity...</p>
      ) : data ? (
        <>
          <section className="grid grid-cols-2 gap-3 border-b border-gray-200 pb-5 sm:grid-cols-3 lg:grid-cols-6">
            {metrics.map(([label, value]) => (
              <div key={label} className="border-l-2 border-yellow-500 pl-3 py-1">
                <p className="text-[9px] font-bold uppercase text-gray-500">{label}</p>
                <p className="mt-1 break-words text-sm font-black text-gray-900">{value}</p>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Orders and operating activity ({activities.length})</h3>
            <div className="overflow-x-auto border-b border-gray-200">
              {activities.length ? (
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead><tr className="border-b border-gray-300">{["Type", "Date / time", "Reference", "Actor / method", "Status", "Amount"].map((label) => <th key={label} className="whitespace-nowrap px-3 py-3 text-xs font-bold text-gray-600">{label}</th>)}</tr></thead>
                  <tbody>{activities.map((entry) => <tr key={entry.key} className="border-b border-gray-100">
                    <td className="px-3 py-3 font-semibold">{entry.type}</td>
                    <td className="whitespace-nowrap px-3 py-3">{entry.at ? new Date(entry.at).toLocaleString("en-GB", { timeZone: "Africa/Kampala" }) : "-"}</td>
                    <td className="px-3 py-3">{entry.reference}</td>
                    <td className="px-3 py-3">{entry.actor || "-"}</td>
                    <td className="px-3 py-3">{entry.status || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{entry.amount == null ? "-" : formatUGX(entry.amount)}</td>
                  </tr>)}</tbody>
                </table>
              ) : <p className="py-8 text-center text-sm text-gray-500">No operational activity in this range.</p>}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Journal activity ({data.journal_entries?.length || 0})</h3>
            <div className="overflow-x-auto border-b border-gray-200">
              {data.journal_entries?.length ? (
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead><tr className="border-b border-gray-300">{["Transaction Date", "Reference", "Description", "Debit", "Credit", "Posted On", "Actor"].map((label) => <th key={label} className="whitespace-nowrap px-3 py-3 text-xs font-bold text-gray-600">{label}</th>)}</tr></thead>
                  <tbody>{data.journal_entries.map((entry) => {
                    const lines = entry.lines || [];
                    const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
                    const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
                    return <tr key={entry.id} className="border-b border-gray-100">
                      <td className="whitespace-nowrap px-3 py-3">{entry.entry_date?.slice(0, 10) || "-"}{entry.business_time ? ` ${entry.business_time.slice(0, 5)}` : ""}</td>
                      <td className="px-3 py-3 font-semibold">{entry.reference}</td>
                      <td className="max-w-[300px] px-3 py-3">{entry.description}</td>
                      <td className="px-3 py-3">{formatUGX(debit)}</td>
                      <td className="px-3 py-3">{formatUGX(credit)}</td>
                      <td className="whitespace-nowrap px-3 py-3">{entry.posted_at ? new Date(entry.posted_at).toLocaleString("en-GB", { timeZone: "Africa/Kampala" }) : "-"}</td>
                      <td className="px-3 py-3">{entry.posted_by || "-"}</td>
                    </tr>;
                  })}</tbody>
                </table>
              ) : <p className="py-8 text-center text-sm text-gray-500">No journal entries in this range.</p>}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}