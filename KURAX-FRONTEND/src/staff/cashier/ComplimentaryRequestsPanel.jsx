import React, { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, XCircle } from "lucide-react";
import API_URL from "../../config/api";
import { cashierAuthHeaders } from "./cashierApi";
import { useData } from "../../customer/components/context/DataContext";
import { getOrderItemPaidAmount } from "../../utils/orderItemAmounts";

function originalAmount(item = {}) {
  const saved = Number(item.originalLineAmount);
  if (Number.isFinite(saved) && saved >= 0) return saved;
  return Number(item.originalUnitPrice ?? item.price ?? item.unit_price ?? 0)
    * Number(item.quantity || 1);
}

function formatMoney(value) {
  return `UGX ${Number(value || 0).toLocaleString()}`;
}

export default function ComplimentaryRequestsPanel() {
  const { refreshData } = useData();
  const [requests, setRequests] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/orders/complimentary-corrections`, {
        headers: cashierAuthHeaders(),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load complimentary requests.");
      const rows = Array.isArray(data) ? data : [];
      setRequests(rows);
      setDrafts((current) => {
        const next = { ...current };
        for (const request of rows) {
          if (!next[request.id]) {
            next[request.id] = {
              complimentary: false,
              waivedAmount: String(request.item?.complimentaryWaivedAmount || originalAmount(request.item)),
              paymentMethod: "",
            };
          }
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError.message || "Could not load complimentary requests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
    const timer = window.setInterval(() => void loadRequests(true), 10000);
    return () => window.clearInterval(timer);
  }, [loadRequests]);

  const updateDecision = async (request, decision) => {
    if (busyId !== null) return;
    const draft = drafts[request.id] || {};
    const maxAmount = originalAmount(request.item);
    const waivedAmount = Number(draft.waivedAmount);
    const payableAmount = Math.max(0, maxAmount - waivedAmount - getOrderItemPaidAmount(request.item));
    if (decision === "approve" && (!draft.complimentary
      || !Number.isFinite(waivedAmount) || waivedAmount <= 0 || waivedAmount > maxAmount)) {
      setError(`Tick Comp and enter an amount between UGX 1 and ${formatMoney(maxAmount)}.`);
      return;
    }
    if (decision === "approve" && payableAmount > 0 && !draft.paymentMethod) {
      setError("Select how the customer will pay the remaining balance.");
      return;
    }

    const reviewNote = decision === "reject"
      ? window.prompt("Reason for rejecting this complimentary request:")?.trim()
      : "";
    if (decision === "reject" && !reviewNote) return;

    setBusyId(request.id);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/orders/complimentary-corrections/${request.id}`,
        {
          method: "PATCH",
          headers: cashierAuthHeaders(true),
          body: JSON.stringify({
            decision,
            complimentary: decision === "approve" ? true : undefined,
            waivedAmount: decision === "approve" ? waivedAmount : undefined,
            paymentMethod: decision === "approve" ? draft.paymentMethod : undefined,
            reviewNote: reviewNote || "",
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not resolve complimentary request.");
      setRequests((current) => current.filter((entry) => entry.id !== request.id));
      refreshData?.();
    } catch (actionError) {
      setError(actionError.message || "Could not resolve complimentary request.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-5 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Complimentary Requests</h2>
          <p className="mt-1 text-sm text-zinc-500">The cashier sets and applies the waived amount for each request.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadRequests(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-bold disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      {loading ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">Loading requests…</p>
      ) : requests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">No complimentary requests awaiting review.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const item = request.item || {};
            const draft = drafts[request.id] || { complimentary: false, waivedAmount: "", paymentMethod: "" };
            const maxAmount = originalAmount(item);
            const payableAmount = Math.max(
              0,
              maxAmount - Number(draft.waivedAmount || 0) - getOrderItemPaidAmount(item)
            );
            return (
              <article key={request.id} className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-zinc-900">
                      Order #{request.order_id} · {request.table_name || "WALK-IN"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-700">
                      {item.name || "Order item"} × {Number(item.quantity || 1)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Original value {formatMoney(maxAmount)} · Requested by {request.requester_name || "Staff"}
                    </p>
                    {request.reason && <p className="mt-1 text-xs text-zinc-500">Reason: {request.reason}</p>}
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-black uppercase text-amber-800">Awaiting cashier</span>
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-4">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black uppercase text-amber-900">
                    <input
                      type="checkbox"
                      checked={draft.complimentary}
                      disabled={busyId === request.id}
                      onChange={(event) => setDrafts((current) => ({
                        ...current,
                        [request.id]: { ...draft, complimentary: event.target.checked },
                      }))}
                      className="h-4 w-4 accent-amber-500"
                    />
                    Comp
                  </label>
                  <label className="grid gap-1 text-[9px] font-black uppercase text-zinc-500">
                    Waived amount (UGX)
                    <input
                      type="number"
                      min="1"
                      max={maxAmount}
                      step="1"
                      value={draft.waivedAmount}
                      disabled={!draft.complimentary || busyId === request.id}
                      onChange={(event) => setDrafts((current) => ({
                        ...current,
                        [request.id]: { ...draft, waivedAmount: event.target.value },
                      }))}
                      className="w-44 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-100"
                    />
                  </label>
                  {draft.complimentary && payableAmount > 0 && (
                    <label className="grid gap-1 text-[9px] font-black uppercase text-zinc-500">
                      Payment method
                      <select
                        value={draft.paymentMethod}
                        disabled={busyId === request.id}
                        onChange={(event) => setDrafts((current) => ({
                          ...current,
                          [request.id]: { ...draft, paymentMethod: event.target.value },
                        }))}
                        className="min-w-44 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold normal-case text-zinc-900"
                      >
                        <option value="">Select method</option>
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="Momo-MTN">MTN Mobile Money</option>
                        <option value="Momo-Airtel">Airtel Mobile Money</option>
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => void updateDecision(request, "approve")}
                    disabled={!draft.complimentary || (payableAmount > 0 && !draft.paymentMethod) || busyId === request.id}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Check size={14} /> {busyId === request.id ? "Saving…" : "Apply comp"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateDecision(request, "reject")}
                    disabled={busyId === request.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-black uppercase text-red-700 disabled:opacity-40"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
                {draft.complimentary && (
                  <p className="mt-3 text-xs font-bold text-zinc-600">
                    Customer will pay {formatMoney(payableAmount)}.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
