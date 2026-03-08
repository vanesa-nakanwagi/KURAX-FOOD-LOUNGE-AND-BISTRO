import React, { useState, useEffect } from "react";
import { useTheme } from "./shared/ThemeContext";
import { OrderRow } from "./shared/UIHelpers";
import API_URL from "../../../config/api";

const PER_PAGE = 20;

export default function HistorySection() {
  const { dark, t } = useTheme();
  const [sub,     setSub]     = useState("ORDERS");
  const [orders,  setOrders]  = useState([]);
  const [shifts,  setShifts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    const url = sub === "ORDERS"
      ? `${API_URL}/api/history/orders?limit=100`
      : `${API_URL}/api/history/shifts?limit=100`;

    (async () => {
      try {
        const res  = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (sub === "ORDERS") setOrders(data);
        else                  setShifts(data);
      } catch (e) { console.error("History fetch failed:", e); }
      finally { setLoading(false); }
    })();
  }, [sub]);

  const paginated   = (arr) => arr.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages  = (arr) => Math.max(1, Math.ceil(arr.length / PER_PAGE));

  const Skeleton = () => (
    <tr>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <td key={i} className="p-3 md:p-5">
          <div className={`h-4 rounded-lg animate-pulse ${dark ? "bg-zinc-800" : "bg-zinc-100"}`} />
        </td>
      ))}
    </tr>
  );

  return (
    <div className="space-y-4">

      {/* Sub-tabs */}
      <div className={`flex gap-4 border-b pb-3 overflow-x-auto ${t.divider}`}>
        {["ORDERS", "SHIFTS"].map(tab => (
          <button key={tab} onClick={() => setSub(tab)}
            className={`whitespace-nowrap text-xs font-black uppercase italic transition-colors
              ${sub === tab ? "text-yellow-500" : t.subtext}`}>
            {tab === "ORDERS" ? "Global Orders" : "Shift Registry"}
          </button>
        ))}
      </div>

      <div className={`${t.card} border rounded-2xl overflow-hidden overflow-x-auto`}>
        {sub === "ORDERS" ? (
          <>
            <table className="w-full text-left min-w-[480px]">
              <thead className={dark ? "bg-white/5" : "bg-zinc-50"}>
                <tr className={`text-[9px] font-black uppercase ${t.subtext}`}>
                  {["ID", "Staff", "Method", "Amount", "Time", "Status"].map(h => (
                    <th key={h} className="p-3 md:p-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${dark ? "divide-white/5" : "divide-zinc-100"}`}>
                {loading
                  ? [1, 2, 3, 4, 5].map(i => <Skeleton key={i} />)
                  : paginated(orders).map(order => (
                      <OrderRow
                        key={order.id}
                        id={`#${order.id}`}
                        waiter={order.staff_name || order.waiter_name || "—"}
                        method={order.payment_method || "—"}
                        amount={Number(order.total || 0)}
                        time={order.created_at
                          ? new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                        status={order.status || "—"}
                      />
                    ))
                }
              </tbody>
            </table>
            {!loading && orders.length === 0 && (
              <p className={`text-center py-8 text-[10px] font-black uppercase ${t.subtext}`}>No orders found</p>
            )}
          </>
        ) : (
          <>
            <table className="w-full text-left min-w-[440px]">
              <thead className={dark ? "bg-white/5" : "bg-zinc-50"}>
                <tr className={`text-[9px] font-black uppercase ${t.subtext}`}>
                  {["Staff", "Role", "Shift End", "Cash Reported", "Digital Total"].map(h => (
                    <th key={h} className="p-3 md:p-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y text-xs font-bold uppercase italic ${dark ? "divide-white/5" : "divide-zinc-100"}`}>
                {loading
                  ? [1, 2, 3, 4, 5].map(i => <Skeleton key={i} />)
                  : paginated(shifts).map((shift, i) => (
                      <tr key={shift.id ?? i} className={t.rowHover}>
                        <td className="p-3 md:p-5">{shift.staff_name || "—"}</td>
                        <td className={`p-3 md:p-5 ${t.subtext}`}>{shift.role || "—"}</td>
                        <td className={`p-3 md:p-5 ${t.subtext}`}>
                          {shift.clock_out
                            ? new Date(shift.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </td>
                        <td className="p-3 md:p-5 text-emerald-500">
                          {Number(shift.total_cash || 0).toLocaleString()}
                        </td>
                        <td className="p-3 md:p-5 text-blue-500">
                          {(Number(shift.total_momo || 0) + Number(shift.total_card || 0)).toLocaleString()}
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
            {!loading && shifts.length === 0 && (
              <p className={`text-center py-8 text-[10px] font-black uppercase ${t.subtext}`}>No shifts on record</p>
            )}
          </>
        )}
      </div>

      {/* Pagination */}
      {!loading && (() => {
        const arr   = sub === "ORDERS" ? orders : shifts;
        const total = totalPages(arr);
        if (total <= 1) return null;
        return (
          <div className="flex items-center justify-between">
            <p className={`text-[9px] font-bold uppercase ${t.subtext}`}>
              Page {page} of {total} — {arr.length} records
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all
                  ${page === 1 ? "opacity-30 cursor-not-allowed" : "bg-yellow-500 text-black hover:bg-yellow-400"}`}>
                Prev
              </button>
              <button onClick={() => setPage(p => Math.min(total, p + 1))} disabled={page === total}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all
                  ${page === total ? "opacity-30 cursor-not-allowed" : "bg-yellow-500 text-black hover:bg-yellow-400"}`}>
                Next
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}