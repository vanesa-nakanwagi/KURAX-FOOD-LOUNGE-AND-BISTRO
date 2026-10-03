import React, { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, RotateCcw } from "lucide-react";

const EXPENSE_CATEGORIES = [
  "Cleaning Supplies", "Rent", "Staff Wages", "Stock / Supplies", "Utilities",
  "Marketing", "Equipment", "Transport", "Other",
];

function prettyDate(value) {
  if (!value) return "-";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
  });
}

export default function SystemConfiguration({
  API_URL,
  userName,
  liveDate,
  liveTime,
  mode,
  businessDate,
  onBusinessDateChange,
  businessTime,
  onBusinessTimeChange,
  dateRange,
  onDateRangeChange,
  timeRange,
  onTimeRangeChange,
  onReturnToLive,
}) {
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(businessDate);
  const [transactionTime, setTransactionTime] = useState(businessTime || "");
  const [paymentAccountCode, setPaymentAccountCode] = useState("1001");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => setTransactionDate(businessDate), [businessDate]);
  useEffect(() => setTransactionTime(businessTime || ""), [businessTime]);

  const updateDateRange = (key, value) => onDateRangeChange({ ...dateRange, [key]: value });

  const handlePostExpense = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!category || !amount || Number(amount) <= 0 || !description.trim() || !reason.trim()) {
      setError("Complete the category, amount, description, and reason before posting.");
      return;
    }

    if (transactionDate < liveDate) {
      const confirmed = window.confirm(
        `You are about to post a transaction for:\n\nBusiness Date: ${prettyDate(transactionDate)}${transactionTime ? ` at ${transactionTime}` : ""}\nCurrent Date: ${prettyDate(liveDate)}\n\nThis will be recorded as a backdated transaction. Its actual posting date and time will be preserved.\n\nContinue?`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      let actor = userName || "Accountant";
      try {
        actor = JSON.parse(localStorage.getItem("kurax_user") || "{}").name || actor;
      } catch {
        actor = userName || "Accountant";
      }
      const response = await fetch(`${API_URL}/api/accountant/accounting/backdated-expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount, category, description: description.trim(), paymentAccountCode,
          transactionDate, businessTime: transactionTime || null, reason: reason.trim(), postedBy: actor,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Posting failed (${response.status})`);

      const postedAt = data.journal?.posted_at
        ? new Date(data.journal.posted_at).toLocaleString("en-GB", { timeZone: "Africa/Kampala", dateStyle: "medium", timeStyle: "short" })
        : "recorded by the server";
      setNotice(`${data.journal.reference} posted for ${prettyDate(transactionDate)}. Posted on ${postedAt} by ${actor}.`);
      setAmount("");
      setDescription("");
      setReason("");
    } catch (postError) {
      setError(postError.message || "Could not post the expense.");
    } finally {
      setSaving(false);
    }
  };

  const historical = mode === "HISTORICAL";
  const fieldClass = "mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";
  const fieldLabelClass = "block text-[10px] font-bold uppercase text-gray-500";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-200 pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-600">Accountant Workspace</p>
          <h2 className="mt-1 text-2xl font-black text-gray-900">System Configuration</h2>
        </div>
        <span className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-black ${historical ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
          {historical && <AlertTriangle size={14} />}
          {historical ? "HISTORICAL / BACKDATED MODE" : "LIVE MODE"}
        </span>
      </header>

      <section className="grid gap-5 border-b border-gray-200 pb-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Business date and reporting context</h3>
          <p className="mt-1 text-xs text-gray-500">These settings do not change the server or computer clock.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="border-l-2 border-gray-300 pl-3">
              <p className="text-[9px] font-bold uppercase text-gray-500">Current live date</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{prettyDate(liveDate)}</p>
              <p className="mt-2 text-[9px] font-bold uppercase text-gray-500">Current live time</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{liveTime} Kampala time</p>
            </div>
            <div className={`border-l-2 pl-3 ${historical ? "border-amber-500" : "border-emerald-500"}`}>
              <p className="text-[9px] font-bold uppercase text-gray-500">Current business date</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{prettyDate(businessDate)}</p>
              <p className="mt-2 text-[9px] font-bold uppercase text-gray-500">Current business time</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{historical ? businessTime || "Not specified" : `${liveTime} Kampala time`}</p>
            </div>
          </div>
        </div>

        <div className="grid content-start gap-3 sm:grid-cols-2">
          <label className={fieldLabelClass}>
            Selected reporting date
            <input type="date" max={liveDate} value={businessDate} onChange={(event) => onBusinessDateChange(event.target.value)} className={fieldClass} />
          </label>
          <label className={fieldLabelClass}>
            Business time (optional)
            <input type="time" value={businessTime} onChange={(event) => onBusinessTimeChange(event.target.value)} className={fieldClass} />
          </label>
          <label className={fieldLabelClass}>
            Date range from
            <input type="date" max={dateRange.end || liveDate} value={dateRange.start} onChange={(event) => updateDateRange("start", event.target.value)} className={fieldClass} />
          </label>
          <label className={fieldLabelClass}>
            Date range to
            <input type="date" min={dateRange.start} max={liveDate} value={dateRange.end} onChange={(event) => updateDateRange("end", event.target.value)} className={fieldClass} />
          </label>
          <label className={fieldLabelClass}>
            Time range from
            <input type="time" max={timeRange.end || undefined} value={timeRange.start} onChange={(event) => onTimeRangeChange({ ...timeRange, start: event.target.value })} className={fieldClass} />
          </label>
          <label className={fieldLabelClass}>
            Time range to
            <input type="time" min={timeRange.start || undefined} value={timeRange.end} onChange={(event) => onTimeRangeChange({ ...timeRange, end: event.target.value })} className={fieldClass} />
          </label>
          {historical && (
            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 border-l-4 border-amber-500 bg-amber-50 px-4 py-3">
              <p className="text-xs font-bold text-amber-900">Historical business date: {prettyDate(businessDate)}</p>
              <button type="button" onClick={onReturnToLive} className="inline-flex items-center gap-2 text-xs font-bold text-amber-900 hover:text-black">
                <RotateCcw size={14} /> Return to live date/time
              </button>
            </div>
          )}
          {(timeRange.start || timeRange.end) && <p className="sm:col-span-2 text-xs text-gray-500">Time filters apply to accounting entries with a recorded business time. Daily sales, petty cash, and older date-only entries remain full-day totals.</p>}
        </div>
      </section>

      <section className="max-w-4xl">
        <div className="flex items-start gap-3 border-b border-gray-200 pb-3">
          <CalendarClock size={19} className="mt-0.5 text-yellow-600" />
          <div>
            <h3 className="text-base font-bold text-gray-900">Post a missed expense</h3>
            <p className="mt-1 text-sm text-gray-600">This creates a new journal entry. The transaction date is separate from the server-recorded posting time.</p>
          </div>
        </div>
        {transactionDate < liveDate && <p role="status" className="mt-4 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">You are posting this transaction to {prettyDate(transactionDate)}.</p>}
        {error && <p role="alert" className="mt-4 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-4 border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

        <form onSubmit={handlePostExpense} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={fieldLabelClass}>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)} className={fieldClass}>{EXPENSE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
          </label>
          <label className={fieldLabelClass}>
            Amount (UGX)
            <input required min="0.01" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} className={fieldClass} />
          </label>
          <label className={fieldLabelClass}>
            Transaction / business date
            <input required type="date" max={liveDate} value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} className={fieldClass} />
          </label>
          <label className={fieldLabelClass}>
            Business time (if known)
            <input type="time" value={transactionTime} onChange={(event) => setTransactionTime(event.target.value)} className={fieldClass} />
          </label>
          <label className={fieldLabelClass}>
            Payment account
            <select value={paymentAccountCode} onChange={(event) => setPaymentAccountCode(event.target.value)} className={fieldClass}>
              <option value="1001">Counter Cash</option><option value="1002">Bank</option><option value="1003">Mobile Money</option>
            </select>
          </label>
          <label className={fieldLabelClass}>
            Posting reason
            <input required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Expense was omitted from the original business date" className={fieldClass} />
          </label>
          <label className={`${fieldLabelClass} sm:col-span-2`}>
            Description
            <textarea required rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What was purchased and why?" className={fieldClass} />
          </label>
          <p className="sm:col-span-2 text-xs text-gray-500">Closed accounting periods are protected. This form will not post to a closed or unconfigured period.</p>
          <div className="sm:col-span-2"><button type="submit" disabled={saving} className="rounded-md bg-yellow-500 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50">{saving ? "Posting..." : "Post expense"}</button></div>
        </form>
      </section>
    </div>
  );
}