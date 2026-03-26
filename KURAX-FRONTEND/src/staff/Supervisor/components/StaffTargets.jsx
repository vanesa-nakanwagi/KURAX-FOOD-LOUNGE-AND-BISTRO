import React, { useState, useEffect, useRef } from "react";
import {
  Target, Save, Search, TrendingUp,
  Loader2, Award, PieChart, Check, ChevronLeft, ChevronRight,
} from "lucide-react";
import API_URL from "../../../config/api";

const ROLE_STYLE = {
  MANAGER:    "text-yellow-400  bg-yellow-500/10  border-yellow-500/25",
  SUPERVISOR: "text-blue-400    bg-blue-500/10    border-blue-500/25",
  CASHIER:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  WAITER:     "text-zinc-300    bg-zinc-500/10    border-zinc-500/25",
};
const roleStyle = (role) =>
  ROLE_STYLE[(role || "").toUpperCase()] || ROLE_STYLE.WAITER;

export default function StaffTargets() {
  const [staff,      setStaff]      = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { fetchStaff(); }, []);

  const fetchStaff = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/staff/performance-list`);
      const data = await res.json();
      setStaff(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/staff/update-targets`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id:      selected.id,
          income_target: selected.monthly_income_target,
          order_target:  selected.daily_order_target,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  const scroll = (dir) => {
    if (scrollRef.current)
      scrollRef.current.scrollBy({ left: dir * 220, behavior: "smooth" });
  };

  const filtered = staff.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-black font-[Outfit]">

      {/* ── HORIZONTAL STAFF SELECTOR ───────────────────────────────────────── */}
      <div className="shrink-0 border-b border-white/5 bg-[#0a0a0a] px-4 pt-4 pb-3 space-y-2.5">

        {/* Label row */}
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600">
            Staff · {staff.length} members
          </p>
          <button
            onClick={() => { setShowSearch(v => !v); setSearchTerm(""); }}
            className={`p-1.5 rounded-lg transition-all ${showSearch ? "bg-yellow-500/15 text-yellow-400" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/5"}`}
          >
            <Search size={13}/>
          </button>
        </div>

        {/* Search input — collapsible */}
        {showSearch && (
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"/>
            <input
              autoFocus
              type="text"
              placeholder="Filter by name…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/8 rounded-xl py-2 pl-8 pr-3 text-xs font-bold text-white placeholder:text-zinc-700 outline-none focus:border-yellow-500/30 transition-all"
            />
          </div>
        )}

        {/* Pill row */}
        <div className="flex items-center gap-1">
          <button onClick={() => scroll(-1)}
            className="shrink-0 p-1 rounded-lg text-zinc-700 hover:text-zinc-300 hover:bg-white/5 transition-all">
            <ChevronLeft size={14}/>
          </button>

          <div
            ref={scrollRef}
            className="flex-1 flex items-center gap-2 overflow-x-auto"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shrink-0 h-[52px] w-28 rounded-2xl bg-white/5 animate-pulse"
                  style={{ animationDelay: `${i * 60}ms` }}/>
              ))
            ) : filtered.length === 0 ? (
              <p className="text-[10px] text-zinc-700 font-bold italic px-2">No matches</p>
            ) : (
              filtered.map(s => {
                const active = selected?.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelected(s); setSaved(false); }}
                    className={`shrink-0 flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-2xl border font-bold transition-all duration-200 whitespace-nowrap
                      ${active
                        ? "bg-yellow-500 border-yellow-400 shadow-md shadow-yellow-500/15 text-black"
                        : "bg-white/3 border-white/8 text-zinc-400 hover:bg-white/8 hover:text-zinc-200 hover:border-white/15"}`}
                  >
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0
                      ${active ? "bg-black/20 text-black" : "bg-zinc-800 text-zinc-400"}`}>
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className={`text-[11px] font-black uppercase leading-none ${active ? "text-black" : "text-zinc-200"}`}>
                        {s.name.split(" ")[0]}
                      </p>
                      <p className={`text-[8px] font-bold uppercase tracking-wider mt-0.5 ${active ? "text-black/50" : "text-zinc-600"}`}>
                        {s.role}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <button onClick={() => scroll(1)}
            className="shrink-0 p-1 rounded-lg text-zinc-700 hover:text-zinc-300 hover:bg-white/5 transition-all">
            <ChevronRight size={14}/>
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="p-6 sm:p-8 max-w-2xl space-y-6">

            {/* Profile header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <span className={`inline-flex px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest mb-3 ${roleStyle(selected.role)}`}>
                  {selected.role}
                </span>
                <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">
                  {selected.name}
                </h1>
                <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest mt-2">
                  ID: {String(selected.id).padStart(4, "0")} · Performance Targets
                </p>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-[0.97] shrink-0
                  ${saved
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                    : "bg-yellow-500 text-black hover:bg-yellow-400 shadow-lg shadow-yellow-500/15 disabled:opacity-60"}`}
              >
                {saving  ? <><Loader2 size={13} className="animate-spin"/> Saving…</>
                : saved  ? <><Check size={13}/> Saved</>
                :           <><Save size={13}/> Save Targets</>}
              </button>
            </div>

            {/* Target inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Revenue */}
              <div className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4 focus-within:border-yellow-500/25 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-yellow-500/10">
                      <TrendingUp size={12} className="text-yellow-400"/>
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Monthly Revenue</p>
                  </div>
                  <span className="text-[9px] font-bold text-zinc-700">UGX</span>
                </div>
                <input
                  type="number"
                  value={selected.monthly_income_target || 0}
                  onChange={e => setSelected({ ...selected, monthly_income_target: e.target.value })}
                  className="w-full bg-transparent text-3xl font-black text-white outline-none border-b border-white/8 focus:border-yellow-500/40 pb-2 transition-colors"
                />
                <div>
                  <div className="flex justify-between mb-1.5">
                    <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">Monthly quota</p>
                    <p className="text-[9px] text-zinc-600 font-bold">
                      {Number(selected.monthly_income_target || 0).toLocaleString()} UGX
                    </p>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (Number(selected.monthly_income_target || 0) / 5_000_000) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Daily orders */}
              <div className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4 focus-within:border-blue-500/25 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                      <PieChart size={12} className="text-blue-400"/>
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Daily Orders</p>
                  </div>
                  <span className="text-[9px] font-bold text-zinc-700">per shift</span>
                </div>
                <input
                  type="number"
                  value={selected.daily_order_target || 0}
                  onChange={e => setSelected({ ...selected, daily_order_target: e.target.value })}
                  className="w-full bg-transparent text-3xl font-black text-white outline-none border-b border-white/8 focus:border-blue-500/40 pb-2 transition-colors"
                />
                <div>
                  <div className="flex justify-between mb-1.5">
                    <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">Daily target</p>
                    <p className="text-[9px] text-zinc-600 font-bold">
                      {Number(selected.daily_order_target || 0)} orders
                    </p>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: Math.min(20, Number(selected.daily_order_target || 0)) }).map((_, i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-blue-500/70"/>
                    ))}
                    {Number(selected.daily_order_target || 0) > 20 && (
                      <span className="text-[9px] text-zinc-600 font-bold ml-1">
                        +{Number(selected.daily_order_target) - 20}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Insight cards */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-700 mb-3">
                Performance Insights
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InsightCard icon={<Award size={14} className="text-yellow-400"/>}    label="Standing"        value="Top Performer" accent="yellow"/>
                <InsightCard icon={<Target size={14} className="text-blue-400"/>}     label="Projected Bonus" value="UGX 250,000"   accent="blue"/>
                <InsightCard icon={<PieChart size={14} className="text-emerald-400"/>} label="Current Status" value="On Track"      accent="emerald"/>
              </div>
            </div>

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 opacity-25 p-8">
            <Target size={44} strokeWidth={1} className="text-zinc-500"/>
            <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest text-center">
              Select a staff member above
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function InsightCard({ icon, label, value, accent }) {
  const styles = {
    yellow:  "border-yellow-500/15 bg-yellow-500/5",
    blue:    "border-blue-500/15   bg-blue-500/5",
    emerald: "border-emerald-500/15 bg-emerald-500/5",
  };
  return (
    <div className={`border rounded-2xl px-4 py-3.5 flex items-center gap-3 ${styles[accent]}`}>
      <div className="p-1.5 rounded-xl bg-white/5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{label}</p>
        <p className="text-sm font-black text-white italic uppercase truncate mt-0.5">{value}</p>
      </div>
    </div>
  );
}