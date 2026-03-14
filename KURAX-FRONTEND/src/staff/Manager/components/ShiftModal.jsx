import React, { useState, useEffect } from "react";
import {
  X, Clock, Banknote, CreditCard, Smartphone,
  CheckCircle, XCircle, ShieldCheck, AlertTriangle, Loader
} from "lucide-react";
import API_URL from "../../../config/api";

function kampalaToday() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" })
  ).toISOString().split("T")[0];
}

function Pill({ label, value, color, icon, bg }) {
  return (
    <div className={`p-3 rounded-2xl border ${bg}`}>
      <div className={`flex items-center gap-1 mb-1 ${color}`}>{icon}<span className="text-[8px] font-black uppercase">{label}</span></div>
      <p className="text-[11px] font-black italic">UGX {Number(value || 0).toLocaleString()}</p>
    </div>
  );
}

function CountPill({ label, value, color, icon, bg }) {
  return (
    <div className={`p-3 rounded-2xl border flex items-center justify-between ${bg}`}>
      <div className={`flex items-center gap-2 ${color}`}>{icon}<span className="text-[10px] font-black uppercase">{label}</span></div>
      <span className={`text-xl font-black ${color}`}>{value}</span>
    </div>
  );
}

export default function ShiftReportModal({
  isOpen, onClose, onConfirm, isArchiving,
  staffId, managerName, theme,
}) {
  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-zinc-800/60 border-white/5" : "bg-zinc-50 border-black/5";
  const today  = kampalaToday();

  const [loading,     setLoading]     = useState(false);
  const [orderCount,  setOrderCount]  = useState(0);
  const [totals,      setTotals]      = useState({ Cash: 0, MTN: 0, Airtel: 0, Card: 0, all: 0 });
  const [credits,     setCredits]     = useState({ approved: 0, rejected: 0, approvedAmt: 0 });

  useEffect(() => {
    if (!isOpen || !staffId) return;

    let active = true;
    setLoading(true);
    setOrderCount(0);
    setTotals({ Cash: 0, MTN: 0, Airtel: 0, Card: 0, all: 0 });
    setCredits({ approved: 0, rejected: 0, approvedAmt: 0 });

    const load = async () => {
      try {
        // ── 1. Check DB: does this manager have orders today? ─────────────
        const previewRes = await fetch(
          `${API_URL}/api/waiter/manager-shift-preview?staff_id=${staffId}&staff_name=${encodeURIComponent(managerName)}&date=${today}`
        );
        if (previewRes.ok && active) {
          const data = await previewRes.json();
          const count = Number(data.order_count || 0);
          setOrderCount(count);
          // Only set payment totals if there are actual orders
          if (count > 0) {
            setTotals({
              Cash:   Number(data.total_cash   || 0),
              MTN:    Number(data.total_mtn    || 0),
              Airtel: Number(data.total_airtel || 0),
              Card:   Number(data.total_card   || 0),
              all:    Number(data.gross_total  || 0),
            });
          }
        } else {
          console.error("[ShiftModal] manager-shift-preview failed:", previewRes.status, await previewRes.text().catch(() => ""));
        }

        // ── 2. Credit decisions (always fetch — independent of orders) ────
        const creditRes = await fetch(
          `${API_URL}/api/waiter/manager-credit-stats?manager_name=${encodeURIComponent(managerName)}&date=${today}`
        );
        if (creditRes.ok && active) {
          const data = await creditRes.json();
          setCredits({
            approved:    Number(data.approved    || 0),
            rejected:    Number(data.rejected    || 0),
            approvedAmt: Number(data.approvedAmt || 0),
          });
        }
      } catch (e) {
        console.error("[ShiftModal] load error:", e);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [isOpen, staffId, managerName, today]);

  if (!isOpen) return null;

  const hasOrders = orderCount > 0;
  const totalMomo = totals.MTN + totals.Airtel;

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md">
      <div className={`w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2.5rem] p-7 border overflow-y-auto max-h-[90dvh] ${
        isDark ? "bg-zinc-900 border-white/10 text-white" : "bg-white border-black/5 text-zinc-900"
      }`}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock className="text-yellow-500" />
            <div>
              <h2 className="text-lg font-black uppercase italic">Shift Summary</h2>
              <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                {managerName} · Manager · {today}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X size={15} /></button>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader size={24} className="text-yellow-500 animate-spin" />
            <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              Checking orders…
            </p>
          </div>
        ) : (
          <>
            {/* Orders section — only shown when DB confirms orders exist */}
            {hasOrders ? (
              <>
                <div className={`flex justify-between items-center p-4 rounded-2xl border mb-4 ${cardBg}`}>
                  <span className="text-[10px] font-black uppercase opacity-50">Total Orders</span>
                  <span className="text-2xl font-black">{orderCount}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <Pill label="Cash"        value={totals.Cash}   color="text-emerald-400" icon={<Banknote size={12}/>}   bg={cardBg} />
                  <Pill label="MTN Momo"    value={totals.MTN}    color="text-yellow-400"  icon={<Smartphone size={12}/>} bg={cardBg} />
                  <Pill label="Airtel Momo" value={totals.Airtel} color="text-red-400"     icon={<Smartphone size={12}/>} bg={cardBg} />
                  <Pill label="Card"        value={totals.Card}   color="text-blue-400"    icon={<CreditCard size={12}/>} bg={cardBg} />
                </div>

                {totalMomo > 0 && (
                  <div className={`flex justify-between items-center px-4 py-2.5 rounded-xl border mb-3 ${cardBg}`}>
                    <span className="text-[9px] font-black uppercase opacity-50">Total Momo (MTN + Airtel)</span>
                    <span className="text-sm font-black text-orange-400">UGX {totalMomo.toLocaleString()}</span>
                  </div>
                )}

                <div className="bg-yellow-500 p-5 rounded-2xl text-black text-center mb-4">
                  <p className="text-[9px] font-black uppercase opacity-60">Gross Revenue</p>
                  <p className="text-3xl font-black">UGX {totals.all.toLocaleString()}</p>
                </div>
              </>
            ) : (
              <div className={`flex items-center gap-3 p-4 rounded-2xl border mb-4 ${cardBg}`}>
                <AlertTriangle size={16} className="text-zinc-500 shrink-0" />
                <p className="text-[10px] font-black uppercase text-zinc-500">No orders taken today</p>
              </div>
            )}

            {/* Credits — always shown */}
            <div className={`rounded-2xl border p-4 mb-5 ${isDark ? "bg-zinc-800/40 border-white/5" : "bg-zinc-50 border-black/5"}`}>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-3 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                Credit Decisions Today
              </p>
              <div className="space-y-2">
                <CountPill
                  label="Credits Approved" value={credits.approved} color="text-emerald-400"
                  icon={<CheckCircle size={13}/>}
                  bg={`rounded-xl border ${isDark ? "bg-emerald-500/5 border-emerald-500/15" : "bg-emerald-50 border-emerald-200"}`}
                />
                {credits.approved > 0 && (
                  <div className={`flex justify-between items-center px-3 py-2 rounded-xl border ${isDark ? "bg-white/3 border-white/5" : "bg-zinc-100 border-zinc-200"}`}>
                    <span className="text-[9px] font-black uppercase text-zinc-500">Total Credit Amount</span>
                    <span className="text-sm font-black text-emerald-400">UGX {credits.approvedAmt.toLocaleString()}</span>
                  </div>
                )}
                <CountPill
                  label="Credits Rejected" value={credits.rejected} color="text-red-400"
                  icon={<XCircle size={13}/>}
                  bg={`rounded-xl border ${isDark ? "bg-red-500/5 border-red-500/15" : "bg-red-50 border-red-200"}`}
                />
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={onConfirm}
            disabled={isArchiving || loading}
            className={`w-full py-4 rounded-2xl font-black uppercase text-[11px] transition-all flex items-center justify-center gap-2
              ${isArchiving || loading ? "bg-rose-900 cursor-not-allowed opacity-80" : "bg-rose-600 hover:bg-rose-700 text-white active:scale-95"}`}
          >
            {isArchiving
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Processing…</span></>
              : <><ShieldCheck size={15}/> End Shift & Archive</>
            }
          </button>
          <button
            onClick={onClose} disabled={isArchiving}
            className={`w-full py-3.5 rounded-2xl font-black uppercase text-[11px] border transition-all
              ${isDark ? "border-white/10 hover:bg-white/5" : "border-black/10 hover:bg-black/5"}
              ${isArchiving ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}