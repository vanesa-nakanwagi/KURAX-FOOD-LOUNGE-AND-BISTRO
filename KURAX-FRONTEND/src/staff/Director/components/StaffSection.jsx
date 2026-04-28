import React, { useState } from "react";
import {
  Plus, Search, Settings, Trash2, Mail,
  Flame, EyeOff, Crown, Zap
} from "lucide-react";

// ── Role config ───────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  DIRECTOR:          { color: "text-yellow-600",  bg: "bg-yellow-50 border-yellow-200",  dot: "bg-yellow-500"  },
  MANAGER:           { color: "text-amber-600",   bg: "bg-amber-50 border-amber-200",   dot: "bg-amber-500"   },
  SUPERVISOR:        { color: "text-orange-600",  bg: "bg-orange-50 border-orange-200",  dot: "bg-orange-500"  },
  WAITER:            { color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  CASHIER:           { color: "text-sky-600",     bg: "bg-sky-50 border-sky-200",     dot: "bg-sky-500"     },
  CHEF:              { color: "text-indigo-600",  bg: "bg-indigo-50 border-indigo-200",  dot: "bg-indigo-500"  },
  BARISTA:           { color: "text-purple-600",  bg: "bg-purple-50 border-purple-200",  dot: "bg-purple-500"  },
  BARMAN:            { color: "text-rose-600",    bg: "bg-rose-50 border-rose-200",    dot: "bg-rose-500"    },
  ACCOUNTANT:        { color: "text-pink-600",    bg: "bg-pink-50 border-pink-200",    dot: "bg-pink-500"    },
  "CONTENT-MANAGER": { color: "text-fuchsia-600", bg: "bg-fuchsia-50 border-fuchsia-200", dot: "bg-fuchsia-500" },
};
const DEFAULT_ROLE = { color: "text-gray-500", bg: "bg-gray-50 border-gray-200", dot: "bg-gray-400" };

// ── StaffRow ──────────────────────────────────────────────────────────────────
function StaffRow({ staff, onTogglePermission, onDelete, onEdit }) {
  const role    = staff.role?.toUpperCase() || "";
  const rc      = ROLE_CONFIG[role] || DEFAULT_ROLE;
  const isDir   = role === "DIRECTOR";
  const isMgmt  = ["MANAGER", "SUPERVISOR"].includes(role);

  return (
    <tr className="group relative transition-all duration-150 border-b border-gray-100 hover:bg-yellow-50/60">
      {/* Yellow left-accent on hover */}
      <td className="pl-0 pr-0 py-0 w-0">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-0 rounded-r-full bg-yellow-500
          transition-all duration-200 group-hover:h-[60%]" />
      </td>

      {/* ── Name ── */}
      <td className="pl-5 pr-4 py-3.5">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className={`relative w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 border
            ${isDir
              ? "bg-yellow-500 text-black border-yellow-400"
              : "bg-gray-100 border-gray-200 text-gray-800"}`}>
            {staff.name?.[0]?.toUpperCase() || "?"}
            {isDir && (
              <Crown size={8} className="absolute -top-1.5 -right-1.5 text-yellow-500 drop-shadow" />
            )}
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-gray-900">
              {staff.name}
            </p>
            {/* Email shown under name on mobile */}
            <p className="text-[10px] font-medium leading-none mt-0.5 sm:hidden text-gray-400 truncate max-w-[140px]">
              {staff.email}
            </p>
          </div>
        </div>
      </td>

      {/* ── Role ── */}
      <td className="px-4 py-3.5">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wider ${rc.bg} ${rc.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${rc.dot} opacity-80`} />
          {staff.role}
        </span>
      </td>

      {/* ── Email (hidden on mobile — shown under name) ── */}
      <td className="px-4 py-3.5 hidden sm:table-cell">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
          <Mail size={11} className="shrink-0 opacity-50" />
          <span className="truncate max-w-[180px]">{staff.email}</span>
        </div>
      </td>

      {/* ── Permission ── */}
      <td className="px-4 py-3.5">
        {isDir ? (
          /* Director — crown badge, no toggle */
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-600 text-[9px] font-black uppercase">
            <Crown size={9} />
            Owner
          </span>
        ) : isMgmt ? (
          /* Manager / Supervisor — toggle */
          <button
            onClick={() => onTogglePermission(staff.id, staff.is_permitted)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-all
              ${staff.is_permitted
                ? "bg-yellow-500 border-yellow-400 text-black shadow-sm shadow-yellow-500/20"
                : "bg-gray-100 border-gray-200 text-gray-500 hover:border-gray-300"}`}
          >
            {staff.is_permitted ? <Flame size={9} /> : <EyeOff size={9} />}
            {staff.is_permitted ? "Active" : "Standard"}
          </button>
        ) : (
          /* All other staff — Live badge */
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 text-[9px] font-black uppercase">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Live
          </span>
        )}
      </td>

      {/* ── Actions ── */}
      <td className="px-4 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEdit(staff)}
            title="Edit"
            className="p-2 rounded-xl transition-all hover:bg-gray-100 text-gray-400 hover:text-gray-700"
          >
            <Settings size={13} />
          </button>
          {!isDir && (
            <button
              onClick={() => onDelete(staff.id, staff.name)}
              title="Terminate"
              className="p-2 rounded-xl hover:bg-red-50 text-red-400/70 hover:text-red-600 transition-all"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── StaffSection ──────────────────────────────────────────────────────────────
export default function StaffSection({
  onAdd, staffList, orders, onEdit, currentUser,
  onTogglePermission, onTerminate, onCardClick,
}) {
  const [search, setSearch] = useState("");

  const filtered = (staffList || []).filter(s => {
    if (!s?.id) return false;
    const term = search.toLowerCase();
    return (
      ((s.name  || "").toLowerCase().includes(term) ||
       (s.role  || "").toLowerCase().includes(term) ||
       (s.email || "").toLowerCase().includes(term)) &&
      s.id !== currentUser?.id
    );
  });

  // Sort: Director → Manager/Supervisor → rest
  const sorted = [...filtered].sort((a, b) => {
    const rank = r => r === "DIRECTOR" ? 0 : ["MANAGER","SUPERVISOR"].includes(r) ? 1 : 2;
    return rank(a.role?.toUpperCase()) - rank(b.role?.toUpperCase());
  });

  const HEADERS = ["Name", "Role", "Email", "Permission", "Actions"];

  return (
    <div className="font-[Outfit]">

      {/* ── Card header ─────────────────────────────────────────────────── */}
      <div className="px-0 pt-0 pb-5">

        {/* Title + Add button */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 rounded-full bg-yellow-500" />
              <h3 className="text-base md:text-lg font-black uppercase tracking-tight text-gray-900">
                Staff Ecosystem
              </h3>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] ml-3 text-gray-400">
              Access Control & Roles · {filtered.length} member{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>

          <button
            onClick={onAdd}
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600
              text-black font-black uppercase text-[10px] tracking-wider
              px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-yellow-500/20 shrink-0"
          >
            <Plus size={12} strokeWidth={3} />
            <span>Add Staff</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search name, role or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] font-medium border border-gray-200 outline-none transition-all bg-white text-gray-900 placeholder:text-gray-400 focus:border-yellow-400"
          />
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {sorted.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left relative">
            <thead>
              <tr>
                {/* spacer for left-accent column */}
                <th className="w-[3px] pl-0" />
                {HEADERS.map(h => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-[9px] font-black uppercase tracking-[0.18em]
                      ${h === "Email" ? "hidden sm:table-cell" : ""}
                      text-gray-400`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(staff => (
                <StaffRow
                  key={staff.id}
                  staff={staff}
                  onTogglePermission={onTogglePermission}
                  onDelete={onTerminate}
                  onEdit={onEdit}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Empty state ── */
        <div className="py-20 flex flex-col items-center justify-center gap-3 px-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gray-100 border border-gray-200">
            <Search size={22} className="text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">
              No staff members found
            </p>
            <p className="text-[9px] mt-1 text-gray-300">
              Try a different search term
            </p>
          </div>
        </div>
      )}

      {/* ── Footer count ─────────────────────────────────────────────────── */}
      {sorted.length > 0 && (
        <div className="pt-3 flex items-center justify-between">
          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
            {sorted.filter(s => ["MANAGER","SUPERVISOR"].includes(s.role?.toUpperCase())).length} management
            &nbsp;·&nbsp;
            {sorted.filter(s => !["DIRECTOR","MANAGER","SUPERVISOR"].includes(s.role?.toUpperCase())).length} live staff
          </p>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">
              All systems live
            </p>
          </div>
        </div>
      )}
    </div>
  );
}