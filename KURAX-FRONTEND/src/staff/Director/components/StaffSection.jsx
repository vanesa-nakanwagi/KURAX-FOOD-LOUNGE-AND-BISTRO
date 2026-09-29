import React, { useState } from "react";
import {
  Plus, Search, Settings, Trash2, Mail,
  Flame, EyeOff, Crown, Zap
} from "lucide-react";

// ── StaffRow ──────────────────────────────────────────────────────────────────
function StaffRow({ staff, onTogglePermission, onDelete, onEdit }) {
  const role    = staff.role?.toUpperCase() || "";
  const isDir   = role === "DIRECTOR";
  const isMgmt  = ["MANAGER", "SUPERVISOR"].includes(role);

  return (
    <tr className="group relative transition-all duration-150 border-b border-zinc-100 hover:bg-zinc-50">
      {/* Yellow left-accent on hover */}
      <td className="pl-0 pr-0 py-0 w-0">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-0 rounded-r-full bg-amber-500
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
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wider ${isDir ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-zinc-100 border-zinc-200 text-zinc-700'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isDir ? 'bg-amber-500' : 'bg-zinc-400'} opacity-80`} />
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
    <div className="grid gap-5 font-[Outfit] xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="h-fit rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-amber-300"><Crown size={18} /></span>
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Director control</p><h2 className="text-lg font-black text-zinc-900">Staff team</h2></div>
        </div>
        <p className="mt-4 text-sm text-zinc-500">Manage staff accounts, roles and access.</p>
        <div className="my-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Accounts</p><p className="mt-1 text-xl font-black">{filtered.length}</p></div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Management</p><p className="mt-1 text-xl font-black">{filtered.filter(person => ["MANAGER", "SUPERVISOR"].includes(person.role?.toUpperCase())).length}</p></div>
        </div>
        <button onClick={onAdd} className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-3 text-sm font-bold text-zinc-950 transition hover:bg-amber-300">
          <Plus size={16} strokeWidth={3} /> Add staff account
        </button>
      </aside>

      <section className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <header className="flex flex-col gap-4 border-b border-zinc-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-black text-zinc-900">Staff accounts</h2><p className="mt-1 text-xs text-zinc-500">{filtered.length} team member{filtered.length !== 1 ? "s" : ""}</p></div>
          <div className="relative w-full sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input type="text" placeholder="Search name, role or email" value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-sm text-zinc-900 outline-none transition focus:border-amber-500" />
          </div>
        </header>
        {sorted.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="relative w-full text-left">
              <thead className="bg-zinc-50"><tr><th className="w-[3px] pl-0" />{HEADERS.map(header => <th key={header} className={`px-4 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 ${header === "Email" ? "hidden sm:table-cell" : ""}`}>{header}</th>)}</tr></thead>
              <tbody>{sorted.map(staff => <StaffRow key={staff.id} staff={staff} onTogglePermission={onTogglePermission} onDelete={onTerminate} onEdit={onEdit} />)}</tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 px-8 py-20">
            <div className="grid h-14 w-14 place-items-center rounded-xl border border-zinc-200 bg-zinc-50"><Search size={22} className="text-zinc-400" /></div>
            <div className="text-center"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">No staff members found</p><p className="mt-1 text-xs text-zinc-400">Try a different search term</p></div>
          </div>
        )}
        {sorted.length > 0 && <footer className="flex items-center justify-between border-t border-zinc-100 px-5 py-3"><p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{sorted.filter(person => ["MANAGER", "SUPERVISOR"].includes(person.role?.toUpperCase())).length} management · {sorted.filter(person => !["DIRECTOR", "MANAGER", "SUPERVISOR"].includes(person.role?.toUpperCase())).length} staff</p><div className="flex items-center gap-1.5"><span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span><p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">All systems live</p></div></footer>}
      </section>
    </div>
  );
}