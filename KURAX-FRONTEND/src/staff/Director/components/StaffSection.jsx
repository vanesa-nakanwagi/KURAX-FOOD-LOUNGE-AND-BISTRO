import React, { useState } from "react";
import {
  Plus, Search, Settings, Trash2, Mail,
  ChevronRight, Flame, EyeOff,
} from "lucide-react";
import { useTheme } from "./shared/ThemeContext";

// ── StaffCard ─────────────────────────────────────────────────────────────────
function StaffCard({ staff, onTogglePermission, onDelete, onEdit, onCardClick }) {
  const { dark, t } = useTheme();
  const role         = staff.role?.toUpperCase() || "";
  const isDirector   = role === "DIRECTOR";
  const isManagement = ["MANAGER", "SUPERVISOR"].includes(role);
  const isClickable  = [
    "WAITER", "MANAGER", "SUPERVISOR", "CHEF",
    "BARISTA", "BARMAN", "CASHIER", "ACCOUNTANT", "CONTENT-MANAGER",
  ].includes(role);

  const roleColor = ({
    DIRECTOR:          "text-rose-500",
    MANAGER:           "text-yellow-500",
    SUPERVISOR:        "text-yellow-400",
    WAITER:            "text-emerald-400",
    CASHIER:           "text-blue-400",
    CHEF:              "text-indigo-400",
    BARISTA:           "text-purple-400",
    BARMAN:            "text-orange-400",
    ACCOUNTANT:        "text-pink-400",
    "CONTENT-MANAGER": "text-fuchsia-400",
  })[role] || "text-zinc-400";

  return (
    <div className={`border rounded-2xl p-4 flex flex-col gap-3 transition-all
      ${dark ? "bg-black/50 border-white/5 hover:border-white/10" : "bg-white border-zinc-200 hover:border-zinc-300"}`}>

      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          onClick={isClickable ? onCardClick : undefined}
          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border shrink-0 transition-colors
            ${isDirector
              ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
              : dark ? "bg-zinc-800 text-white border-white/5" : "bg-zinc-100 text-zinc-700 border-zinc-200"}
            ${isClickable ? "cursor-pointer" : ""}`}>
          {staff.name?.[0]?.toUpperCase() || "?"}
        </div>

        {/* Info */}
        <div
          onClick={isClickable ? onCardClick : undefined}
          className={`flex-1 min-w-0 ${isClickable ? "cursor-pointer" : ""}`}>
          <p className="text-sm font-black uppercase italic leading-tight truncate flex items-center gap-1">
            {staff.name}
            {isClickable && <ChevronRight size={11} className={`shrink-0 ${t.subtext}`} />}
          </p>
          <p className={`text-[9px] font-bold uppercase tracking-widest ${roleColor}`}>{staff.role}</p>
          <p className={`text-[9px] flex items-center gap-1 mt-0.5 ${dark ? "text-zinc-600" : "text-zinc-400"}`}>
            <Mail size={8} className="shrink-0" />
            <span className="truncate">{staff.email}</span>
          </p>
        </div>

        {/* Permission toggle (managers/supervisors) */}
        {!isDirector && isManagement && (
          <button onClick={onTogglePermission}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-xl border transition-all shrink-0 text-[8px] font-black uppercase
              ${staff.is_permitted
                ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500"
                : dark ? "bg-zinc-800 border-zinc-700 text-zinc-500" : "bg-zinc-100 border-zinc-200 text-zinc-400"}`}>
            {staff.is_permitted ? <Flame size={10} /> : <EyeOff size={10} />}
            <span className="hidden xs:inline">{staff.is_permitted ? "Busy" : "Std"}</span>
          </button>
        )}
      </div>

      {/* Footer */}
      <div className={`flex items-center justify-between pt-3 border-t ${t.divider}`}>
        <button onClick={onEdit}
          className={`flex items-center gap-1.5 text-[9px] font-black uppercase transition-colors
            ${dark ? "text-zinc-500 hover:text-white" : "text-zinc-400 hover:text-zinc-800"}`}>
          <Settings size={11} /> Edit
        </button>
        {!isDirector && (
          <button onClick={onDelete}
            className="flex items-center gap-1.5 text-[9px] font-black uppercase text-zinc-600 hover:text-rose-500 transition-colors">
            <Trash2 size={11} /> Terminate
          </button>
        )}
      </div>
    </div>
  );
}

// ── StaffSection ──────────────────────────────────────────────────────────────
export default function StaffSection({
  onAdd, staffList, orders, onEdit, currentUser,
  onTogglePermission, onTerminate, onCardClick,
}) {
  const { t } = useTheme();
  const [search, setSearch] = useState("");
  const today = new Date().toISOString().split("T")[0];

  const filtered = (staffList || []).filter(s => {
    if (!s?.id) return false;
    const term = search.toLowerCase();
    return (
      ((s.name || "").toLowerCase().includes(term) ||
       (s.role || "").toLowerCase().includes(term)) &&
      s.id !== currentUser?.id
    );
  });

  const getTodayStats = (staff) => {
    const my = (orders || []).filter(o => {
      const d = new Date(o.created_at || o.timestamp || 0).toISOString().split("T")[0];
      return (o.staff_id === staff.id || o.waiter_id === staff.id) && d === today;
    });
    return {
      my,
      totalOrders:  my.length,
      totalRevenue: my.reduce((s, o) => s + Number(o.total || 0), 0),
      CASH: my.filter(o => o.payment_method === "CASH").reduce((s, o) => s + Number(o.total || 0), 0),
      MOMO: my.filter(o => o.payment_method === "MOMO").reduce((s, o) => s + Number(o.total || 0), 0),
      CARD: my.filter(o => o.payment_method === "CARD").reduce((s, o) => s + Number(o.total || 0), 0),
    };
  };

  return (
    <div className={`${t.card} border rounded-2xl md:rounded-[2.5rem] p-4 md:p-8`}>

      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base md:text-xl font-black uppercase italic">Staff Ecosystem</h3>
            <p className={`text-[9px] font-bold uppercase tracking-widest ${t.subtext}`}>Access Control & Roles</p>
          </div>
          <button onClick={onAdd}
            className="bg-yellow-500 text-black px-4 py-2.5 rounded-xl font-black uppercase italic text-[10px] flex items-center gap-1.5 hover:bg-yellow-400 transition-colors shrink-0">
            <Plus size={13} /> New
          </button>
        </div>
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.subtext}`} size={14} />
          <input type="text" placeholder="Search name or role…" value={search}
            onChange={e => setSearch(e.target.value)}
            className={`w-full ${t.input} border p-3 pl-9 rounded-xl text-sm font-bold focus:border-yellow-500/50 outline-none`} />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
        {filtered.map(staff => (
          <StaffCard
            key={staff.id}
            staff={staff}
            onEdit={() => onEdit(staff)}
            onDelete={() => onTerminate(staff.id, staff.name)}
            onTogglePermission={() => onTogglePermission(staff.id, staff.is_permitted)}
            onCardClick={() => onCardClick(staff, getTodayStats(staff))}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center border border-dashed border-white/5 rounded-2xl mt-4">
          <p className="text-zinc-600 font-black uppercase italic text-[9px] tracking-[0.2em]">No Staff Members Found</p>
        </div>
      )}
    </div>
  );
}