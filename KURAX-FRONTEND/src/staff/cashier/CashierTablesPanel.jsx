import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BookOpen, CheckCircle2, Clock3, Crown, RefreshCw, Search, Table2, User, XCircle } from "lucide-react";
import API_URL from "../../config/api";
import { cashierAuthHeaders } from "./cashierApi";
import { getOrderItemPaidAmount, getOrderItemPayableAmount } from "../../utils/orderItemAmounts";

const TABLE_FILTERS = ["All", "Open", "Closed", "Credits", "Voided"];

function formatAmount(value) {
  return `UGX ${Number(value || 0).toLocaleString()}`;
}

function itemTotal(item) {
  return getOrderItemPayableAmount(item);
}

function isVoided(item) {
  return String(item.status || "").toUpperCase() === "VOIDED" || item.voidProcessed === true;
}

function paidAmount(item, order) {
  const recordedPaid = getOrderItemPaidAmount(item);
  if (recordedPaid > 0) return recordedPaid;
  if (item._rowPaid === true || item.paid_at || String(item.status || "").toLowerCase() === "paid") {
    return itemTotal(item);
  }
  const hasItemPaymentDetails = Array.isArray(order.items) && order.items.some(orderItem =>
    orderItem._rowPaid === true
    || orderItem.paid_at
    || orderItem.creditRequested === true
    || orderItem.is_partially_paid === true
    || Number(orderItem.partial_amount_paid || 0) > 0
    || ["paid", "voided"].includes(String(orderItem.status || "").toLowerCase())
  );
  if (!hasItemPaymentDetails && (order.is_paid === true || String(order.status || "").toLowerCase() === "paid")) {
    return itemTotal(item);
  }
  const partial = Number(item.partial_amount_paid || item.amount_paid || 0);
  return partial > 0 ? Math.min(partial, itemTotal(item)) : 0;
}

function isCredited(item, order) {
  if (item.creditRequested === true || String(item.payment_method || "").toUpperCase().includes("CREDIT")) return true;
  const hasItemCreditDetails = Array.isArray(order.items) && order.items.some(orderItem =>
    orderItem.creditRequested === true
    || String(orderItem.payment_method || "").toUpperCase().includes("CREDIT")
  );
  return !hasItemCreditDetails
    && (String(order.payment_method || "").toUpperCase() === "CREDIT"
      || String(order.status || "").toLowerCase() === "credit");
}

function itemPaymentLabel(item, order) {
  if (isVoided(item)) return "Voided";
  const paid = paidAmount(item, order);
  const total = itemTotal(item);
  if (item.complimentary === true && total === 0) return "Complimentary";
  if (paid >= total && total > 0) return "Paid";
  if (isCredited(item, order)) return paid > 0 ? "Partially paid" : "Credited";
  if (paid > 0) return "Partially paid";
  if (item.paymentRequested === true) return "Awaiting cashier";
  return "Unpaid";
}

function creditBalance(credit) {
  const status = String(credit.status || "").toLowerCase();
  if (["fullysettled", "rejected"].includes(status) || credit.paid === true) return 0;
  const recordedBalance = Number(credit.balance || 0);
  return Math.max(0, recordedBalance || Number(credit.amount || 0) - Number(credit.amount_paid || 0));
}

function getTableSummary(table) {
  let total = 0;
  let paid = 0;
  let unpaid = 0;
  let hasOutstandingItems = false;
  let voidedCount = 0;

  table.orders.forEach(order => {
    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) {
      const status = String(order.status || "").toLowerCase();
      if (["voided", "cancelled"].includes(status)) return;
      total += Number(order.total || 0);
      if (order.is_paid === true || status === "paid") paid += Number(order.total || 0);
      else unpaid += Number(order.total || 0);
      return;
    }
    items.forEach(item => {
      const amount = itemTotal(item);
      if (isVoided(item)) {
        voidedCount += 1;
        return;
      }
      total += amount;
      const paidForItem = paidAmount(item, order);
      paid += paidForItem;
      if (Math.max(0, amount - paidForItem) > 0) hasOutstandingItems = true;
      if (!isCredited(item, order)) unpaid += Math.max(0, amount - paidForItem);
    });
  });

  const outstandingCredits = table.credits.reduce((sum, credit) => sum + creditBalance(credit), 0);
  const hasVoided = voidedCount > 0;
  const isOpen = hasOutstandingItems || unpaid > 0 || outstandingCredits > 0;
  return { total, paid, unpaid, outstandingCredits, voidedCount, hasVoided, isOpen };
}

function statusClass(status) {
  if (status === "Open" || status === "Awaiting cashier") return "bg-yellow-500 text-black";
  if (status === "Closed" || status === "Paid") return "bg-green-500 text-white";
  if (status === "Available" || status === "Unpaid") return "bg-gray-500 text-white";
  if (status === "Credited") return "bg-purple-500 text-white";
  if (status === "Partially paid") return "bg-orange-500 text-white";
  return "bg-red-500 text-white";
}

function TableCard({ table }) {
  const summary = getTableSummary(table);
  const isClosed = !summary.isOpen;
  const status = summary.isOpen ? "Open" : (table.orders.length ? "Closed" : (table.status || "Available"));
  const statusColor = statusClass(status);

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-2 border-b border-zinc-200/70 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <Crown size={16} className="shrink-0 text-yellow-500" />
          <h2 className="truncate text-base font-black uppercase text-yellow-600">{table.name}</h2>
        </div>
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${statusColor}`}>
          {status === "Closed" || status === "Paid" ? <CheckCircle2 size={9} /> : <Clock3 size={9} />}
          {status}
        </span>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1 text-zinc-500"><User size={12} /><span>Waiter:</span></div>
        <span className="max-w-[65%] truncate text-right font-medium text-zinc-800">
          {table.staffNames.length ? table.staffNames.join(", ") : "Staff assignment unavailable"}
        </span>
      </div>

      <div className="mb-3 rounded-lg bg-zinc-100/70 p-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase text-zinc-500">Payment Summary</span>
          <span className="text-[11px] text-zinc-500">
            Items: {table.orders.reduce((count, order) => count + order.items.length, 0)}
            <span className="mx-1">|</span>
            Paid: <span className="font-bold text-yellow-600">{formatAmount(summary.paid)}</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[11px]">
          <FinancialValue label="Order total" value={summary.total} />
          <FinancialValue label="Unpaid" value={summary.unpaid} accent={summary.unpaid > 0 ? "text-orange-600" : ""} />
          <FinancialValue label="Credit balance" value={summary.outstandingCredits} accent={summary.outstandingCredits > 0 ? "text-purple-600" : ""} />
          <FinancialValue label="Paid" value={summary.paid} accent="text-green-600" />
        </div>
      </div>

      <div className="space-y-3">
        {table.orders.map(order => (
          <section key={order.id} className="rounded-xl border border-zinc-200/70 bg-zinc-50/80 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/70 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-zinc-700">Order #{order.id}</span>
                {order.staff_role && <span className="text-[9px] font-bold uppercase text-zinc-400">{order.staff_role}</span>}
              </div>
              <span className="text-[9px] font-medium text-zinc-500">
                {order.created_at || order.timestamp ? new Date(order.created_at || order.timestamp).toLocaleString() : "Date unavailable"}
              </span>
            </div>
            {order.items.length ? (
              <div className="space-y-2">
                {order.items.map((item, index) => {
                  const itemStatus = itemPaymentLabel(item, order);
                  return (
                    <div key={`${order.id}-${index}`} className={`flex items-start justify-between gap-3 rounded px-1.5 py-1.5 ${isVoided(item) ? "bg-gray-500/5" : itemStatus === "Paid" ? "bg-green-500/5" : "bg-orange-500/5"}`}>
                      <div className="min-w-0">
                        <p className={`truncate text-xs font-bold ${isVoided(item) ? "text-zinc-400 line-through" : "text-zinc-800"}`}>
                          {item.name || "Item"} <span className="font-medium text-zinc-500">× {item.quantity || 1}</span>
                        </p>
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${statusClass(itemStatus)}`}>
                          {itemStatus}
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] font-black text-zinc-700">{formatAmount(itemTotal(item))}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No item details recorded · {formatAmount(order.total)}</p>
            )}
          </section>
        ))}

        {table.credits.map(credit => (
          <div key={`credit-${credit.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-purple-100 bg-purple-50/70 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2 text-purple-800">
              <BookOpen size={14} />
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black">{credit.client_name || credit.label || "Table credit"}</p>
                <p className="text-[9px] font-medium">{credit.status || "Credit"} · {formatAmount(credit.amount_paid)} paid</p>
              </div>
            </div>
            <span className="text-[10px] font-black text-purple-800">Balance {formatAmount(creditBalance(credit))}</span>
          </div>
        ))}

        {isClosed && !table.orders.length && (
          <p className="text-xs text-zinc-500">No order history is available for this table.</p>
        )}
      </div>
    </article>
  );
}

function FinancialValue({ label, value, accent = "" }) {
  return (
    <div className="min-w-0 rounded-xl bg-zinc-50 px-3 py-2">
      <p className="text-[8px] font-black uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`mt-1 break-words text-[11px] font-black text-zinc-800 ${accent}`}>{formatAmount(value)}</p>
    </div>
  );
}

export default function CashierTablesPanel() {
  const [data, setData] = useState({ tables: [], orders: [], credits: [] });
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchTables = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/cashier-ops/tables`, {
        headers: cashierAuthHeaders(),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Could not load table history.");
      }
      const result = await response.json();
      setData({
        tables: Array.isArray(result.tables) ? result.tables : [],
        orders: Array.isArray(result.orders) ? result.orders : [],
        credits: Array.isArray(result.credits) ? result.credits : [],
      });
    } catch (fetchError) {
      console.error("Cashier table history fetch failed:", fetchError);
      setError(fetchError.message || "Could not load table history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const tableCards = useMemo(() => {
    const grouped = new Map();
    const getOrCreate = (name, dbTable = null) => {
      const normalizedName = String(name || "").trim();
      const key = normalizedName.toUpperCase();
      if (!key) return null;
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: dbTable?.id || key,
          name: normalizedName,
          status: dbTable?.status || "Closed",
          orders: [],
          credits: [],
          staffNames: [],
        });
      } else if (dbTable?.status) {
        grouped.get(key).status = dbTable.status;
      }
      return grouped.get(key);
    };

    data.tables.forEach(table => getOrCreate(table.name, table));
    data.orders.forEach(order => {
      const table = getOrCreate(order.table_name);
      if (!table || table.orders.some(existing => String(existing.id) === String(order.id))) return;
      const staffName = order.staff_name || "Staff assignment unavailable";
      if (staffName !== "Staff assignment unavailable" && !table.staffNames.includes(staffName)) table.staffNames.push(staffName);
      table.orders.push({
        ...order,
        items: Array.isArray(order.items) ? order.items : [],
      });
    });
    data.credits.forEach(credit => {
      const table = getOrCreate(credit.table_name);
      if (table && !table.credits.some(existing => String(existing.id) === String(credit.id))) table.credits.push(credit);
    });

    return Array.from(grouped.values()).map(table => ({
      ...table,
      orders: table.orders.sort((left, right) => new Date(right.created_at || right.timestamp || 0) - new Date(left.created_at || left.timestamp || 0)),
    }));
  }, [data]);

  const filteredTables = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tableCards.filter(table => {
      const summary = getTableSummary(table);
      const hasCredits = table.credits.some(credit => creditBalance(credit) > 0);
      const matchesFilter = filter === "All"
        || (filter === "Open" && summary.isOpen)
        || (filter === "Closed" && !summary.isOpen)
        || (filter === "Credits" && hasCredits)
        || (filter === "Voided" && summary.hasVoided);
      return matchesFilter && (!query || table.name.toLowerCase().includes(query)
        || table.staffNames.some(name => name.toLowerCase().includes(query)));
    });
  }, [filter, search, tableCards]);

  const counts = useMemo(() => ({
    All: tableCards.length,
    Open: tableCards.filter(table => getTableSummary(table).isOpen).length,
    Closed: tableCards.filter(table => !getTableSummary(table).isOpen).length,
    Credits: tableCards.filter(table => table.credits.some(credit => creditBalance(credit) > 0)).length,
    Voided: tableCards.filter(table => getTableSummary(table).hasVoided).length,
  }), [tableCards]);

  return (
    <section className="space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Table2 size={20} className="text-yellow-600" />
            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900">View Tables</h1>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Read-only table and payment history for all service staff.</p>
        </div>
        <button
          type="button"
          onClick={() => fetchTables(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wide text-zinc-700 hover:border-yellow-400 disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="flex flex-wrap gap-1 rounded-xl border border-zinc-200 bg-white p-1">
          {TABLE_FILTERS.map(tab => (
            <button
              type="button"
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-wide transition-colors ${
                filter === tab ? "bg-yellow-500 text-black" : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              {tab} <span className="ml-1 opacity-70">{counts[tab]}</span>
            </button>
          ))}
        </div>
        <label className="relative min-w-0 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search table or staff member"
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-xs outline-none focus:border-yellow-500"
          />
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-xs font-bold text-zinc-500">
          <RefreshCw size={16} className="animate-spin" /> Loading latest table data…
        </div>
      ) : filteredTables.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredTables.map(table => <TableCard key={table.id} table={table} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white py-16 text-center">
          {filter === "Voided" ? <XCircle size={28} className="mx-auto text-red-400" /> : filter === "Open" ? <Clock3 size={28} className="mx-auto text-amber-500" /> : <CheckCircle2 size={28} className="mx-auto text-zinc-400" />}
          <p className="mt-3 text-xs font-black uppercase tracking-widest text-zinc-500">No matching tables</p>
          <p className="mt-1 text-[10px] text-zinc-400">Try another status filter or search term.</p>
        </div>
      )}
    </section>
  );
}
