import React, { useState, useEffect } from "react";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import {
  Plus, Clock, Coffee, LayoutGrid, ChevronRight,
  User, CheckCircle2, AlertCircle, UtensilsCrossed, Receipt
} from "lucide-react";
import API_URL from "../../../config/api";

// ── Parse items safely from DB (can be string or array) ─────────────────────
function parseItems(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Compute grand total from items array ──────────────────────────────────────
function computeTotal(items) {
  return items.reduce((sum, item) => {
    const price = Number(item.price || 0);
    const qty   = Number(item.quantity || 1);
    const voided = item.voidProcessed === true || item.status === "VOIDED";
    return voided ? sum : sum + price * qty;
  }, 0);
}

export default function ManageTables({ onEditTable }) {
  const [tables,  setTables]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({}); // { [tableId]: bool }
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // ── Fetch tables from backend ─────────────────────────────────────────────
  const fetchTables = async () => {
    try {
      const response = await fetch(`${API_URL}/api/orders/tables/all`);
      const data     = await response.json();
      if (Array.isArray(data)) {
        setTables(data);
      } else {
        console.error("API did not return an array:", data);
        setTables([]);
      }
    } catch (err) {
      console.error("Error fetching live tables:", err);
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount + refresh every 10s so new items appear quickly
  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleExpand = (key) =>
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const occupiedCount = tables.filter(t => t.status === "Occupied").length;

  return (
    <div className="p-6 h-full overflow-y-auto no-scrollbar">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter">Floor Management</h2>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
            Real-time Status • {occupiedCount} Occupied
          </p>
        </div>
        <div className={`p-4 rounded-2xl border ${isDark ? "bg-zinc-900 border-white/5" : "bg-white border-black/5"}`}>
          <LayoutGrid size={24} className="text-yellow-500" />
        </div>
      </div>

      {/* ── States ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-30">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-black uppercase tracking-widest text-sm">Loading tables…</p>
        </div>
      ) : tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-20 italic">
          <Coffee size={64} className="mb-4" />
          <p className="font-black uppercase tracking-widest text-sm">No tables configured</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {tables.map((table) => {
            const isOccupied  = table.status === "Occupied";
            const tableKey    = table.id || table.name;
            const isExpanded  = !!expanded[tableKey];
            const items       = parseItems(table.active_items);
            const grandTotal  = isOccupied
              ? (items.length > 0 ? computeTotal(items) : Number(table.current_total || 0))
              : 0;
            const activeItems = items.filter(i => i.voidProcessed !== true && i.status !== "VOIDED");

            return (
              <div
                key={tableKey}
                className={`group relative rounded-[2.5rem] border-2 transition-all duration-500 overflow-hidden ${
                  isOccupied
                    ? isDark
                      ? "bg-zinc-900 border-yellow-500/20 shadow-xl shadow-yellow-500/5"
                      : "bg-white border-yellow-500 shadow-xl shadow-yellow-500/10"
                    : isDark
                      ? "bg-zinc-900/40 border-white/5 opacity-70"
                      : "bg-zinc-50 border-black/5 opacity-80"
                }`}
              >
                {/* ── Card top section ── */}
                <div className="p-8">

                  {/* Header: badge + status */}
                  <div className="flex justify-between items-start mb-8">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-black shadow-lg transition-transform group-hover:scale-110 ${
                      isOccupied ? "bg-yellow-500 shadow-yellow-500/20" : "bg-zinc-400 shadow-black/10"
                    }`}>
                      <span className="font-black text-lg">
                        {table.name.replace(/\D/g, "") || table.name.charAt(0)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-1">Status</p>
                      <div className={`flex items-center gap-1.5 justify-end font-black text-[10px] uppercase tracking-tighter ${
                        isOccupied ? "text-yellow-500" : "text-zinc-500"
                      }`}>
                        {isOccupied ? <AlertCircle size={10}/> : <CheckCircle2 size={10}/>}
                        {table.status}
                      </div>
                    </div>
                  </div>

                  {/* Table name + waiter */}
                  <h3 className="text-3xl font-black uppercase tracking-tighter mb-1">{table.name}</h3>
                  <div className="flex items-center gap-2 mb-6">
                    <User size={10} className="text-zinc-500" />
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                      {isOccupied ? `Assigned: ${table.waiter_name || "Staff"}` : "Unassigned"}
                    </p>
                  </div>

                  {/* ── Order summary box ── */}
                  <div className={`rounded-3xl p-5 mb-5 transition-colors ${isDark ? "bg-black/40" : "bg-zinc-50"}`}>
                    {isOccupied ? (
                      <>
                        {/* Time + item count row */}
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <Clock size={12} className="text-zinc-500" />
                            <span className="text-[9px] font-black uppercase text-zinc-500">
                              {table.order_start
                                ? new Date(table.order_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : "--:--"}
                            </span>
                          </div>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                            isDark ? "bg-white/5 text-zinc-400" : "bg-zinc-200 text-zinc-500"
                          }`}>
                            {activeItems.length} item{activeItems.length !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* Grand total */}
                        <div className={`flex justify-between items-center pt-3 border-t ${isDark ? "border-white/5" : "border-black/5"}`}>
                          <div className="flex items-center gap-1.5">
                            <Receipt size={11} className="text-zinc-400" />
                            <span className="text-[9px] font-black uppercase text-zinc-500">Total</span>
                          </div>
                          <span className="text-xl font-black text-yellow-500">
                            UGX {grandTotal.toLocaleString()}
                          </span>
                        </div>

                        {/* Toggle items button */}
                        {activeItems.length > 0 && (
                          <button
                            onClick={() => toggleExpand(tableKey)}
                            className={`mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                              isDark
                                ? "bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
                                : "bg-zinc-200/60 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
                            }`}
                          >
                            <UtensilsCrossed size={10} />
                            {isExpanded ? "Hide Items" : "View Items"}
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="py-2 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        Ready for New Guests
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => onEditTable({ ...table, id: table.last_order_id })}
                    className={`w-full py-5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 ${
                      isOccupied
                        ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/10 hover:bg-yellow-400"
                        : "bg-zinc-800 text-white hover:bg-zinc-700"
                    }`}
                  >
                    <Plus size={16} />
                    {isOccupied ? "Add / Manage Order" : "Open New Bill"}
                    <ChevronRight size={14} className="ml-auto" />
                  </button>
                </div>

                {/* ── Expanded items list ── */}
                {isExpanded && isOccupied && activeItems.length > 0 && (
                  <div className={`border-t px-6 pb-6 pt-4 space-y-2 ${isDark ? "border-white/5" : "border-black/5"}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">
                      Order Breakdown
                    </p>

                    {activeItems.map((item, idx) => {
                      const itemPrice = Number(item.price || 0);
                      const itemQty   = Number(item.quantity || 1);
                      const itemTotal = itemPrice * itemQty;

                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
                            isDark ? "bg-white/[0.04]" : "bg-zinc-50"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`font-black text-sm truncate leading-tight ${
                              isDark ? "text-white" : "text-zinc-900"
                            }`}>
                              {item.name}
                            </p>
                            <p className="text-[10px] text-zinc-500 font-bold mt-0.5">
                              ×{itemQty} · UGX {itemPrice.toLocaleString()} each
                            </p>
                          </div>
                          <span className="font-black text-sm text-yellow-500 shrink-0 ml-4">
                            UGX {itemTotal.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}

                    {/* Divider + grand total repeat */}
                    <div className={`flex justify-between items-center pt-3 mt-2 border-t ${
                      isDark ? "border-white/10" : "border-black/8"
                    }`}>
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Grand Total
                      </span>
                      <span className="font-black text-yellow-500 text-lg">
                        UGX {grandTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}