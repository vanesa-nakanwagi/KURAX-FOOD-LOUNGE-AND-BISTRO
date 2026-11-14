import React, { useState } from "react";
import API_URL from "../../config/api";

function readStaffSession() {
  try {
    return JSON.parse(localStorage.getItem("kurax_user") || "null");
  } catch {
    return null;
  }
}

export default function ComplimentaryItemControl({ order, item, onUpdated, presentation = "inline" }) {
  const [sending, setSending] = useState(false);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const session = readStaffSession();
  const role = String(session?.role || "").toUpperCase();
  const canRequest = role === "MANAGER"
    || role === "SUPERVISOR"
    || (role === "WAITER" && Number(item.staff_id ?? order.staff_id ?? order.staffId) === Number(session?.id));
  const isVoided = item.voidProcessed === true || String(item.status || "").toUpperCase() === "VOIDED"
    || ["Voided", "Cancelled"].includes(String(order.status || ""));
  const itemIndex = item._orderItemIndex;
  const orderId = item._orderId ?? order.id;
  const isPending = item.complimentaryRequestPending === true;

  const sendRequest = async () => {
    if (sending || !canRequest || isVoided || isPending || !Number.isInteger(Number(itemIndex)) || !orderId) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/orders/${orderId}/items/${itemIndex}/complimentary`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
          },
          body: JSON.stringify({ complimentary: true }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 202) {
        throw new Error(data.error || "Could not send complimentary request to the cashier.");
      }
      setArmed(false);
      await onUpdated?.();
      setModalOpen(false);
    } catch (requestError) {
      setError(requestError.message || "Could not send complimentary request to the cashier.");
    } finally {
      setSending(false);
    }
  };

  if (!canRequest && !isPending && item.complimentary !== true) return null;

  const controls = (
    <>
      {item.complimentary === true && (
        <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-800">
          Comp · waived UGX {Number(item.complimentaryWaivedAmount || 0).toLocaleString()}
        </span>
      )}
      {isPending ? (
        <span className="rounded-full bg-orange-100 px-2 py-1 text-[9px] font-black uppercase text-orange-800">
          Comp request sent to cashier
        </span>
      ) : canRequest && !isVoided ? (
        armed ? (
          <>
            <button
              type="button"
              onClick={() => void sendRequest()}
              disabled={sending}
              className="rounded-full bg-amber-500 px-3 py-1.5 text-[9px] font-black uppercase text-black disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send to Cashier"}
            </button>
            <button
              type="button"
              onClick={() => setArmed(false)}
              disabled={sending}
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-[9px] font-bold uppercase text-zinc-600"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => { setError(""); setArmed(true); }}
            className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[9px] font-black uppercase text-amber-800 hover:bg-amber-100"
          >
            Comp
          </button>
        )
      ) : null}
      {error && <span role="alert" className="text-[9px] font-semibold text-red-600">{error}</span>}
      {isVoided && <span className="text-[8px] text-zinc-500">Voided items cannot be comped.</span>}
      {item.complimentary === true && !isPending && !canRequest && (
        <span className="text-[8px] text-zinc-500">Cashier-approved</span>
      )}
    </>
  );

  if (presentation === "modal") {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[9px] font-black uppercase text-amber-800 hover:bg-amber-100"
        >
          {isPending ? "Comp request pending" : item.complimentary === true ? "View comp" : "Comp"}
        </button>
        {modalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="complimentary-request-title"
              className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="complimentary-request-title" className="text-lg font-black uppercase text-zinc-900">
                    Complimentary request
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-zinc-600">
                    {item.name || "Order item"} · UGX {(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); setArmed(false); setError(""); }}
                  className="rounded-full px-3 py-1 text-sm font-bold text-zinc-500 hover:bg-zinc-100"
                  aria-label="Close complimentary request"
                >
                  ×
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/5 pt-4">
                {controls}
              </div>
            </section>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-black/5 pt-2">
      {controls}
    </div>
  );
}
