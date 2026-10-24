import React, { useEffect, useState } from "react";
import API_URL from "../../config/api";

function readStaffSession() {
  try {
    return JSON.parse(localStorage.getItem("kurax_user") || "null");
  } catch {
    return null;
  }
}

function originalLineAmount(item) {
  const stored = Number(item.originalLineAmount);
  if (Number.isFinite(stored) && stored >= 0) return stored;
  return Number(item.originalUnitPrice ?? item.price ?? item.unit_price ?? 0)
    * Number(item.quantity || 1);
}

export default function ComplimentaryItemControl({ order, item, onUpdated }) {
  const [saving, setSaving] = useState(false);
  const [waivedAmount, setWaivedAmount] = useState(
    Number(item.complimentaryWaivedAmount ?? originalLineAmount(item))
  );
  const [reason, setReason] = useState(item.complimentaryReason || "");
  const session = readStaffSession();
  const role = String(session?.role || "").toUpperCase();
  const canEdit = role === "MANAGER"
    || role === "SUPERVISOR"
    || (role === "WAITER" && Number(item.staff_id ?? order.staff_id ?? order.staffId) === Number(session?.id));
  const isVoided = item.voidProcessed === true || String(item.status || "").toUpperCase() === "VOIDED"
    || ["Voided", "Cancelled"].includes(String(order.status || ""));

  useEffect(() => {
    setWaivedAmount(Number(item.complimentaryWaivedAmount ?? originalLineAmount(item)));
    setReason(item.complimentaryReason || "");
  }, [item.complimentary, item.complimentaryWaivedAmount, item.complimentaryReason, item.price, item.quantity]);

  const save = async (complimentary, amount = waivedAmount) => {
    if (saving || !canEdit || isVoided) return;
    setSaving(true);
    try {
      const token = session?.token;
      const orderId = item._orderId ?? order.id;
      const response = await fetch(
        `${API_URL}/api/orders/${orderId}/items/${item._orderItemIndex}/complimentary`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            complimentary,
            waivedAmount: Number(amount),
            reason,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 202) {
        throw new Error(data.error || "Could not update complimentary status.");
      }
      if (response.status === 202) {
        window.alert(data.message || "Correction request sent for approval.");
      }
      await onUpdated?.();
    } catch (error) {
      window.alert(error.message || "Could not update complimentary status.");
    } finally {
      setSaving(false);
    }
  };

  const handleChecked = (checked) => {
    if (checked) {
      const amount = Number(item.complimentaryWaivedAmount) > 0
        ? Number(item.complimentaryWaivedAmount)
        : originalLineAmount(item);
      setWaivedAmount(amount);
      void save(true, amount);
    } else {
      setWaivedAmount(0);
      void save(false, 0);
    }
  };

  const handleWaiverBlur = () => {
    const amount = Number(waivedAmount);
    if (!Number.isFinite(amount) || amount < 0 || amount > originalLineAmount(item)) {
      window.alert("The waived amount must be between zero and the original item total.");
      setWaivedAmount(Number(item.complimentaryWaivedAmount || originalLineAmount(item)));
      return;
    }
    if (amount !== Number(item.complimentaryWaivedAmount || 0)) void save(true, amount);
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-black/5 pt-2">
      <label className="inline-flex items-center gap-1.5 text-[9px] font-bold text-yellow-700">
        <input
          type="checkbox"
          checked={item.complimentary === true}
          disabled={!canEdit || isVoided || saving}
          onChange={(event) => handleChecked(event.target.checked)}
          className="accent-yellow-500"
        />
        Complimentary
      </label>
      {item.complimentary === true && (
        <>
          <label className="inline-flex items-center gap-1 text-[8px] font-semibold text-zinc-500">
            Waived UGX
            <input
              type="number"
              min="0"
              max={originalLineAmount(item)}
              step="1"
              value={waivedAmount}
              disabled={!canEdit || isVoided || saving}
              onChange={(event) => setWaivedAmount(event.target.value)}
              onBlur={handleWaiverBlur}
              className="w-24 rounded border border-yellow-500/30 bg-transparent px-1.5 py-1 text-[9px] text-current"
              aria-label="Complimentary amount waived"
            />
          </label>
          <input
            type="text"
            maxLength="500"
            value={reason}
            disabled={!canEdit || isVoided || saving}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => {
              if (reason !== (item.complimentaryReason || "")) {
                void save(true, Number(item.complimentaryWaivedAmount || waivedAmount));
              }
            }}
            placeholder="Optional reason"
            aria-label="Complimentary reason"
            className="min-w-28 flex-1 rounded border border-yellow-500/30 bg-transparent px-1.5 py-1 text-[9px] text-current"
          />
        </>
      )}
      {saving && <span className="text-[8px] text-zinc-500">Saving…</span>}
      {!canEdit && <span className="text-[8px] text-zinc-500">Not authorized</span>}
    </div>
  );
}
