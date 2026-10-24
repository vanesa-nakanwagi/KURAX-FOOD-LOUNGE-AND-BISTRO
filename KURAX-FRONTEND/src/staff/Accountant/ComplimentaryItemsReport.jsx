import React, { useCallback, useEffect, useState } from "react";
import API_URL from "../../config/api";

function kampalaDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" }).format(date);
}

function addDays(date, days) {
  const result = new Date(`${date}T12:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function dateRangeFor(period, today) {
  if (period === "yesterday") {
    const yesterday = addDays(today, -1);
    return { start: yesterday, end: yesterday };
  }
  if (period === "week") {
    const weekday = new Date(`${today}T12:00:00.000Z`).getUTCDay();
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    return { start: addDays(today, mondayOffset), end: today };
  }
  if (period === "month") return { start: `${today.slice(0, 7)}-01`, end: today };
  return { start: today, end: today };
}

function staffToken() {
  try {
    return JSON.parse(localStorage.getItem("kurax_user") || "{}").token || "";
  } catch {
    return "";
  }
}

function formatMoney(value) {
  return `UGX ${Number(value || 0).toLocaleString()}`;
}

async function requestJSON(url, options = {}) {
  const token = staffToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

export default function ComplimentaryItemsReport() {
  const today = kampalaDate();
  const [period, setPeriod] = useState("today");
  const [range, setRange] = useState(() => dateRangeFor("today", today));
  const [report, setReport] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState(null);

  const load = useCallback(async (selectedRange = range) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ startDate: selectedRange.start, endDate: selectedRange.end });
      const [reportData, pendingCorrections] = await Promise.all([
        requestJSON(`${API_URL}/api/reports/complimentary-items?${params.toString()}`),
        requestJSON(`${API_URL}/api/orders/complimentary-corrections`),
      ]);
      setReport(reportData);
      setCorrections(pendingCorrections);
    } catch (loadError) {
      setError(loadError.message || "Unable to load complimentary item reporting.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  const selectPeriod = (nextPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod !== "custom") setRange(dateRangeFor(nextPeriod, today));
  };

  const reviewCorrection = async (id, decision) => {
    const reviewNote = window.prompt(
      decision === "approve" ? "Optional approval note:" : "Reason for rejecting this correction:"
    );
    if (reviewNote === null) return;
    if (decision === "reject" && !reviewNote.trim()) {
      window.alert("Enter a reason before rejecting the correction.");
      return;
    }
    setReviewing(id);
    setError("");
    try {
      await requestJSON(`${API_URL}/api/orders/complimentary-corrections/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ decision, reviewNote }),
      });
      await load(range);
    } catch (reviewError) {
      setError(reviewError.message || "Unable to review correction.");
    } finally {
      setReviewing(null);
    }
  };

  const totals = report?.totals || {};
  const periodChoices = [
    ["today", "Today"],
    ["yesterday", "Yesterday"],
    ["week", "Week"],
    ["month", "Month"],
    ["custom", "Custom"],
  ];

  return (
    <section className="space-y-6 text-zinc-900 dark:text-white">
      <header>
        <h2 className="text-2xl font-black uppercase">Complimentary Items Report</h2>
        <p className="mt-1 text-sm text-zinc-500">Actual order payments, inventory consumption, and approved corrections.</p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-zinc-200 p-1 dark:border-white/10">
          {periodChoices.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => selectPeriod(key)}
              className={`rounded-lg px-3 py-2 text-xs font-bold ${period === key ? "bg-yellow-500 text-black" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/10"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <>
            <label className="grid gap-1 text-[10px] font-bold uppercase text-zinc-500">
              Start date
              <input
                type="date"
                value={range.start}
                onChange={(event) => setRange((current) => ({ ...current, start: event.target.value }))}
                className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-white/10"
              />
            </label>
            <label className="grid gap-1 text-[10px] font-bold uppercase text-zinc-500">
              End date
              <input
                type="date"
                value={range.end}
                onChange={(event) => setRange((current) => ({ ...current, end: event.target.value }))}
                className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-white/10"
              />
            </label>
          </>
        )}
        <button
          type="button"
          onClick={() => void load(range)}
          disabled={loading || !range.start || !range.end || range.start > range.end}
          className="rounded-lg bg-yellow-500 px-4 py-2.5 text-xs font-black uppercase text-black disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh report"}
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Complimentary item lines", totals.items || 0],
          ["Complimentary quantity", totals.quantity || 0],
          ["Waived sales value", formatMoney(totals.waived_amount)],
          ["Original selling value", formatMoney(totals.original_amount)],
          ["Actual payments", formatMoney(totals.paid_amount)],
          ["Outstanding receivable", formatMoney(totals.outstanding_receivable)],
          ["Credit balance", formatMoney(totals.credit_balance)],
          ["Complimentary cost", formatMoney(totals.complimentary_cost)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
            <p className="text-[9px] font-black uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-2 text-sm font-black">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10">
        <table className="min-w-[1450px] w-full border-collapse text-left text-xs">
          <thead className="bg-zinc-100 text-[9px] uppercase text-zinc-500 dark:bg-white/5">
            <tr>
              {["Order", "Table", "Item", "Qty", "Department", "Original price", "Waived", "Paid", "Receivable", "Credit balance", "Actual cost", "Marked / approved by", "Reason", "Date / time"].map((heading) => (
                <th key={heading} className="px-3 py-3 font-black">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(report?.rows || []).map((row, index) => (
              <tr key={`${row.order_id}-${row.item_index}-${index}`} className="border-t border-zinc-200 dark:border-white/10">
                <td className="px-3 py-3 font-bold">{row.order_reference}</td>
                <td className="px-3 py-3">{row.table_name}</td>
                <td className="px-3 py-3 font-semibold">{row.item_name}</td>
                <td className="px-3 py-3">{row.quantity}</td>
                <td className="px-3 py-3">{row.department}</td>
                <td className="px-3 py-3">{formatMoney(row.original_amount)}</td>
                <td className="px-3 py-3 font-bold text-amber-600">{formatMoney(row.waived_amount)}</td>
                <td className="px-3 py-3">{formatMoney(row.paid_amount)}</td>
                <td className="px-3 py-3">{formatMoney(row.outstanding_receivable)}</td>
                <td className="px-3 py-3">{formatMoney(row.credit_balance)}</td>
                <td className="px-3 py-3">{formatMoney(row.complimentary_cost)}</td>
                <td className="px-3 py-3">
                  {row.marked_by}
                  {row.approved_by && <span className="block text-[10px] text-zinc-500">Approved by {row.approved_by}</span>}
                </td>
                <td className="max-w-48 px-3 py-3">{row.reason || "—"}</td>
                <td className="whitespace-nowrap px-3 py-3">
                  {row.complimentary_at
                    ? new Date(row.complimentary_at).toLocaleString("en-GB", { timeZone: "Africa/Kampala" })
                    : "—"}
                </td>
              </tr>
            ))}
            {!loading && !report?.rows?.length && (
              <tr><td colSpan="14" className="px-4 py-10 text-center text-zinc-500">No complimentary items in this date range.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {corrections.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-black uppercase">Pending corrections</h3>
          {corrections.map((request) => (
            <article key={request.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div>
                <p className="font-bold">Order #{request.order_id} · {request.table_name || "WALK-IN"} · {request.item?.name || "Order item"}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Requested waived amount: {formatMoney(request.requested_waived_amount)} · by {request.requester_name || "Staff"} · {request.reason || "No reason supplied"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={reviewing === request.id}
                  onClick={() => void reviewCorrection(request.id, "approve")}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase text-white disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={reviewing === request.id}
                  onClick={() => void reviewCorrection(request.id, "reject")}
                  className="rounded-lg bg-red-600 px-3 py-2 text-[10px] font-black uppercase text-white disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
