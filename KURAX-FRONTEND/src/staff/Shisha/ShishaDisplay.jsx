import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, Flame, Play, Power, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../customer/components/context/DataContext";
import API_URL from "../../config/api";

const ACTIVE_STATUSES = ["Pending", "Preparing", "Ready"];
const COMPLETED_STATUSES = ["Served", "Paid", "Closed", "Credit", "Mixed"];

function kampalaDate() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" }))
    .toISOString().split("T")[0];
}

export default function ShishaDisplay() {
  const { orders = [], setOrders, refreshData } = useData() || {};
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [ticketIds, setTicketIds] = useState({});
  const syncedOrders = useRef(new Set());
  const savedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}"); }
    catch { return {}; }
  }, []);
  const shishaStaffName = savedUser.name || "Shisha Station";
  const handleLogout = () => {
    localStorage.removeItem("kurax_user");
    navigate("/staff/login");
  };

  const shishaOrders = useMemo(() => orders
    .filter(order => (order.items || []).some(item => item.station?.toLowerCase() === "shisha"))
    .filter(order => ACTIVE_STATUSES.includes(order.status) || COMPLETED_STATUSES.includes(order.status))
    .filter(order => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return String(order.id).includes(query) ||
        (order.table_name || order.tableName || "").toLowerCase().includes(query);
    })
    .map(order => ({
      ...order,
      items: (order.items || []).filter(item => item.station?.toLowerCase() === "shisha")
    }))
    .sort((a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp)),
  [orders, searchQuery]);

  useEffect(() => {
    shishaOrders.forEach(async order => {
      if (syncedOrders.current.has(order.id)) return;
      syncedOrders.current.add(order.id);
      try {
        const response = await fetch(`${API_URL}/api/shisha/tickets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: order.id,
            table_name: order.table_name || order.tableName || "WALK-IN",
            staff_name: order.staff_name || order.waiterName || "Staff",
            items: order.items,
            total: order.total || 0,
            status: order.status
          })
        });
        if (response.ok) {
          const ticket = await response.json();
          setTicketIds(prev => ({ ...prev, [order.id]: ticket.id }));
        }
      } catch (error) {
        console.error("Shisha ticket sync failed:", error);
      }
    });
  }, [shishaOrders]);

  const updateStatus = async (order, status) => {
    setOrders(prev => prev.map(item => item.id === order.id ? { ...item, status } : item));
    try {
      await fetch(`${API_URL}/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const ticketId = ticketIds[order.id];
      if (ticketId) {
        await fetch(`${API_URL}/api/shisha/tickets/${ticketId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status })
        });
      }
    } catch (error) {
      console.error("Shisha status update failed:", error);
      refreshData?.();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-5 md:p-8 font-[Outfit]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-3 text-amber-400 mb-2">
              <Flame size={22} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Production Station</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight">Shisha Orders</h1>
            <p className="text-zinc-500 text-sm mt-2">{shishaStaffName} · Active Shisha Session</p>
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={17} />
              <input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search table or order"
                className="w-full bg-zinc-900 border border-white/10 rounded-full py-3 pl-11 pr-4 text-sm outline-none focus:border-amber-500"
              />
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all text-[10px] font-black uppercase italic shrink-0"
            >
              <Power size={13} /> Out
            </button>
          </div>
        </div>

        {shishaOrders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 py-24 text-center text-zinc-500">
            <Flame className="mx-auto mb-3 opacity-30" size={36} />
            <p className="text-xs font-black uppercase tracking-[0.25em]">No Shisha Orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {shishaOrders.map(order => (
              <article key={order.id} className="bg-zinc-900 border border-white/10 rounded-3xl p-5 shadow-xl">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest">Order #{order.id}</p>
                    <h2 className="text-2xl font-black uppercase mt-1">{order.table_name || order.tableName || "Walk-in"}</h2>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-300">{order.status}</span>
                </div>
                <div className="space-y-3 mb-6">
                  {order.items.map((item, index) => (
                    <div key={`${item.id || item.name}-${index}`} className="flex justify-between gap-3 border-b border-white/5 pb-3">
                      <span className="font-bold text-sm">{item.quantity}x {item.name}</span>
                      <span className="text-amber-400 text-sm font-black">UGX {Number(item.price || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-zinc-500 text-xs mb-5">
                  <Clock3 size={14} /> {order.staff_name || order.waiterName || "Staff"}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {order.status === "Pending" && (
                    <button onClick={() => updateStatus(order, "Preparing")} className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 text-black py-3 text-[10px] font-black uppercase tracking-widest">
                      <Play size={14} /> Prepare
                    </button>
                  )}
                  {order.status === "Preparing" && (
                    <button onClick={() => updateStatus(order, "Ready")} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-black py-3 text-[10px] font-black uppercase tracking-widest">
                      <CheckCircle2 size={14} /> Ready
                    </button>
                  )}
                  {order.status === "Ready" && (
                    <button onClick={() => updateStatus(order, "Served")} className="col-span-2 rounded-xl bg-white text-black py-3 text-[10px] font-black uppercase tracking-widest">
                      Mark Served
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
