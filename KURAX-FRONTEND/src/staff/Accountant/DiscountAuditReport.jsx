import React, { useEffect, useState } from "react";
import API_URL from "../../config/api";

function authHeaders() {
  try {
    const user = JSON.parse(localStorage.getItem("kurax_user") || "null");
    return user?.token ? { Authorization: `Bearer ${user.token}` } : {};
  } catch {
    return {};
  }
}

function formatUGX(value) {
  return `UGX ${Number(value || 0).toLocaleString()}`;
}

function getMonthRange() {
  const now = new Date();
  const date = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  return {
    start: date(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: date(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export default function DiscountAuditReport() {
  const [range, setRange] = useState(getMonthRange);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ startDate: range.start, endDate: range.end });
        const response = await fetch(`${API_URL}/api/reports/discount-audit?${query}`, {
          headers: authHeaders(),
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Unable to load discount audit.");
        if (active) setReport(result);
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [range.start, range.end]);

  const summary = report?.summary || {};
  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-black uppercase text-gray-900">Discount and void audit</h2>
          <p className="mt-1 text-xs text-gray-500">Gross sales, each discount category and approved voids are recorded separately.</p>
        </div>
        <div className="flex gap-2">
          <label className="text-[9px] font-bold uppercase text-gray-500">From<input type="date" value={range.start} onChange={(event) => setRange((old) => ({ ...old, start: event.target.value }))} className="mt-1 block rounded-lg border p-2 text-sm text-gray-900" /></label>
          <label className="text-[9px] font-bold uppercase text-gray-500">To<input type="date" value={range.end} onChange={(event) => setRange((old) => ({ ...old, end: event.target.value }))} className="mt-1 block rounded-lg border p-2 text-sm text-gray-900" /></label>
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading audit…</p>}
      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Gross sales", summary.gross_sales],
              ["Menu promotions", summary.menu_discounts],
              ["Special bill discounts", summary.special_bill_discounts],
              ["Approved voids", summary.approved_voids],
              ["Net sales", summary.net_sales],
            ].map(([label, amount]) => (
              <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">{label}</p>
                <p className="mt-1 text-lg font-black text-gray-900">{formatUGX(amount)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">{summary.cogs_and_profit_source}</p>
          <AuditTable
            title="Cashier special bill discounts"
            rows={report.special_bill_discounts || []}
            columns={[
              ["applied_at", "Applied", (row) => new Date(row.applied_at).toLocaleString()],
              ["order_id", "Order", (row) => `#${row.order_id}`],
              ["discount_type", "Type", (row) => row.discount_type === "percentage" ? `${row.discount_value}%` : formatUGX(row.discount_value)],
              ["discount_amount", "Discount", (row) => formatUGX(row.discount_amount)],
              ["final_payable_amount", "Final bill", (row) => formatUGX(row.final_payable_amount)],
              ["applied_by_name", "Cashier", (row) => row.applied_by_name],
              ["reason", "Reason", (row) => row.reason],
            ]}
          />
          <AuditTable
            title="Menu-item promotions"
            rows={report.menu_discounts || []}
            columns={[
              ["sold_at", "Sold", (row) => new Date(row.sold_at).toLocaleString()],
              ["order_id", "Order", (row) => `#${row.order_id}`],
              ["menu_name", "Menu item", (row) => row.menu_name],
              ["discount_type", "Type", (row) => row.discount_type === "fixed" ? formatUGX(row.discount_value) : `${Number(row.discount_value || 0)}%`],
              ["discount_amount", "Discount", (row) => formatUGX(row.discount_amount)],
            ]}
          />
          <AuditTable
            title="Approved voids"
            rows={report.approved_voids || []}
            columns={[
              ["resolved_at", "Resolved", (row) => new Date(row.resolved_at).toLocaleString()],
              ["order_id", "Order", (row) => `#${row.order_id}`],
              ["item_name", "Item", (row) => row.item_name],
              ["void_amount", "Voided", (row) => formatUGX(row.void_amount)],
              ["approved_by", "Approved by", (row) => row.approved_by],
              ["reason", "Reason", (row) => row.reason],
            ]}
          />
        </>
      )}
    </section>
  );
}

function AuditTable({ title, rows, columns }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <h3 className="border-b border-gray-100 px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-700">{title}</h3>
      {!rows.length ? <p className="p-4 text-xs text-gray-500">No records for this period.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="bg-gray-50 text-[9px] uppercase text-gray-500">
              <tr>{columns.map(([key, label]) => <th key={key} className="px-4 py-2">{label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id || `${row.order_id}-${index}`} className="border-t border-gray-100">
                  {columns.map(([key, _label, render]) => (
                    <td key={key} className="px-4 py-3 text-gray-700">{render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
