import React, { useState } from "react";
import { Clock, Banknote, User, Hash, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { useData } from "../../../customer/components/context/DataContext"; // adjust path to your DataContext

const PER_PAGE = 20;

// ── Payment method config ─────────────────────────────────────────────────────
const METHOD_CONFIG = {
  CASH:   { color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  MOMO:   { color: "text-yellow-600",  bg: "bg-yellow-50 border-yellow-200",   dot: "bg-yellow-500" },
  CARD:   { color: "text-sky-600",     bg: "bg-sky-50 border-sky-200",         dot: "bg-sky-500" },
  CREDIT: { color: "text-purple-600",  bg: "bg-purple-50 border-purple-200",   dot: "bg-purple-500" },
  "CREDIT/CASH":   { color: "text-purple-600", bg: "bg-purple-50 border-purple-200", dot: "bg-purple-500" },
  "CREDIT/CARD":   { color: "text-purple-600", bg: "bg-purple-50 border-purple-200", dot: "bg-purple-500" },
  "CREDIT/MOMO":   { color: "text-purple-600", bg: "bg-purple-50 border-purple-200", dot: "bg-purple-500" },
  MIXED:  { color: "text-orange-600",  bg: "bg-orange-50 border-orange-200",   dot: "bg-orange-500" },
};
const DEFAULT_METHOD = { color: "text-gray-500", bg: "bg-gray-50 border-gray-200", dot: "bg-gray-400" };

// ── Status badge (supports Partial Settlement) ───────────────────────────────
function StatusBadge({ status, type }) {
  const s = (status || "").toLowerCase();
  
  if (type === "credit_settlement") {
    if (s === "settled") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[8px] font-black uppercase">
          <CheckCircle2 size={8} /> Settled
        </span>
      );
    }
    if (s === "partial settlement") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[8px] font-black uppercase">
          <Clock size={8} /> Partial Settlement
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 text-[8px] font-black uppercase">
        {status || "Settled"}
      </span>
    );
  }
  
  // Order statuses
  if (s === "paid" || s === "closed" || s === "completed")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[8px] font-black uppercase"><CheckCircle2 size={8} /> {status}</span>;
  if (s === "voided" || s === "cancelled")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[8px] font-black uppercase"><XCircle size={8} /> {status}</span>;
  if (s === "credit")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-[8px] font-black uppercase"><AlertCircle size={8} /> Credit</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 text-[8px] font-black uppercase">{status || "—"}</span>;
}

// ─── Transaction Row (handles both orders and credit settlements) ─────────────
function TransactionRow({ tx }) {
  const method = (tx.display_method || tx.method || "").toUpperCase();
  const mc = METHOD_CONFIG[method] || DEFAULT_METHOD;
  const name = tx.staff_name || "—";
  const role = tx.role || "STAFF";
  const amount = Number(tx.amount || 0);
  const time = tx.date ? new Date(tx.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
  const date = tx.date ? new Date(tx.date).toLocaleDateString([], { day: "2-digit", month: "short" }) : "—";

  return (
    <tr className="group relative transition-all duration-150 border-b border-gray-100 hover:bg-yellow-50/60">
      <td className="pl-0 pr-0 py-0 w-0 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-0 rounded-r-full bg-yellow-500 transition-all duration-200 group-hover:h-[60%]" />
       </td>
      <td className="pl-5 pr-4 py-3.5">
        <span className="inline-flex items-center gap-1 text-[10px] font-black tabular-nums text-gray-400">
          <Hash size={9} className="opacity-50" />
          {String(tx.source_id || "").slice(-5).padStart(5, "0")}
        </span>
       </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border bg-gray-100 border-gray-200 text-gray-800">
            {name[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-gray-900">{name}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider leading-none mt-0.5 text-gray-400">{role}</p>
          </div>
        </div>
       </td>
      <td className="px-4 py-3.5">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wider ${mc.bg} ${mc.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${mc.dot} opacity-80`} />
          {method || "—"}
        </span>
       </td>
      <td className="px-4 py-3.5">
        <span className={`text-sm font-black tabular-nums ${amount > 0 ? "text-emerald-600" : "text-gray-400"}`}>
          {amount > 0 ? `UGX ${amount.toLocaleString()}` : "—"}
        </span>
       </td>
      <td className="px-4 py-3.5 hidden sm:table-cell">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
          <Clock size={10} className="opacity-50 shrink-0" />
          <span>{time}</span>
          <span className="opacity-40">·</span>
          <span>{date}</span>
        </div>
       </td>
      <td className="px-4 py-3.5">
        <StatusBadge status={tx.status} type={tx.type} />
       </td>
     </tr>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      <td className="w-0 pl-0" />
      {[120, 160, 90, 100, 110, 80].map((w, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-3.5 rounded-lg animate-pulse bg-gray-100" style={{ width: `${w}px`, maxWidth: "100%" }} />
        </td>
      ))}
     </tr>
  );
}

// ─── Main HistorySection (now uses DataContext) ─────────────────────────────
export default function HistorySection() {
  // Use the filtered orders from context (they already respect day closure)
  const { orders, dayClosed, isLoading: contextLoading } = useData();
  const [page, setPage] = useState(1);

  // For credit settlements, we still need to fetch them separately (they are not in `orders`).
  // However, if you also want credit settlements to be included in the history table,
  // you should create a separate context value for them. For simplicity, this example
  // only displays orders. If you need credit settlements, you can extend the context.
  
  // Use the filtered orders from context directly
  const displayedOrders = orders; // orders is already filtered by the context
  const paginated = displayedOrders.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(displayedOrders.length / PER_PAGE));
  const HEADERS = ["ID", "Staff", "Method", "Amount", "Time", "Status"];

  if (contextLoading) {
    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 rounded-full bg-yellow-500" />
              <h3 className="text-base md:text-lg font-black uppercase tracking-tight text-gray-900">Order History</h3>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] ml-3 text-gray-400">Loading...</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr><th className="w-[3px]" />{HEADERS.map(h => <th key={h} className="px-4 py-3 text-[9px] font-black uppercase">{h}</th>)}</tr>
            </thead>
            <tbody>
              {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="font-[Outfit] space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-5 rounded-full bg-yellow-500" />
            <h3 className="text-base md:text-lg font-black uppercase tracking-tight text-gray-900">Order History</h3>
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] ml-3 text-gray-400">
            Global Records · {displayedOrders.length} orders
            {dayClosed && <span className="text-yellow-500 ml-2">(Day closed – new day only)</span>}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left relative">
          <thead>
            <tr>
              <th className="w-[3px] pl-0" />
              {HEADERS.map(h => (
                <th key={h} className={`px-4 py-3 text-[9px] font-black uppercase tracking-[0.18em] ${h === "Time" ? "hidden sm:table-cell" : ""} text-gray-400`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={HEADERS.length + 1} className="py-20 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gray-100 border border-gray-200">
                      <Banknote size={22} className="text-gray-400" />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">
                      {dayClosed ? "Day closed – no orders yet for the new day" : "No orders on record"}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              // Convert each order to the expected transaction format
              paginated.map(order => (
                <TransactionRow 
                  key={order.id}
                  tx={{
                    ...order,
                    type: 'order',
                    source_id: order.id,
                    date: order.created_at,
                    amount: order.total,
                    method: order.payment_method,
                    staff_name: order.staff_name || order.waiter_name,
                    role: order.role,
                    status: order.status,
                  }}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginated.length > 0 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Page {page} of {totalPages} · {displayedOrders.length} records</p>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p-1))}
                disabled={page === 1}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                  page === 1
                    ? "opacity-25 cursor-not-allowed text-gray-400"
                    : "bg-yellow-500 text-black hover:bg-yellow-400 shadow-sm shadow-yellow-500/20"
                }`}
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p+1))}
                disabled={page === totalPages}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                  page === totalPages
                    ? "opacity-25 cursor-not-allowed text-gray-400"
                    : "bg-yellow-500 text-black hover:bg-yellow-400 shadow-sm shadow-yellow-500/20"
                }`}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}