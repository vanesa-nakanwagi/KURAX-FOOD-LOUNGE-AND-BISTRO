import React, { useState, useEffect } from 'react';
import { User, Target, Save, Search, TrendingUp, ChevronRight, Loader2, Award, PieChart } from 'lucide-react';
import API_URL from "../../../config/api";

export default function StaffTargets() {
  const [staff, setStaff] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => { fetchStaff(); }, []);

  const fetchStaff = async () => {
    try {
      const res = await fetch(`${API_URL}/api/staff/performance-list`);
      setStaff(await res.json());
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const filteredStaff = staff.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex h-full bg-black font-[Outfit] animate-in fade-in duration-1000">
      
      {/* ── LEFT: REFINED DIRECTORY (30% Width) ─────────────────────── */}
      <div className="w-[320px] border-r border-white/5 flex flex-col bg-zinc-950/50">
        <div className="p-8 pb-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-6">Directory</h2>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-yellow-500 transition-colors" size={14} />
            <input 
              type="text"
              placeholder="Filter by name..."
              className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-[11px] font-medium text-white placeholder:text-zinc-700 focus:outline-none focus:bg-white/10 transition-all"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 custom-scrollbar">
          {filteredStaff.map(s => (
            <button 
              key={s.id}
              onClick={() => setSelected(s)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group ${
                selected?.id === s.id ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/10" : "hover:bg-white/5 text-zinc-400"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${selected?.id === s.id ? "bg-black/10" : "bg-zinc-900 border border-white/5"}`}>
                {s.name.charAt(0)}
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className={`text-[11px] font-bold uppercase truncate ${selected?.id === s.id ? "text-black" : "text-zinc-200"}`}>{s.name}</p>
                <p className={`text-[9px] font-medium uppercase tracking-widest ${selected?.id === s.id ? "text-black/60" : "text-zinc-600"}`}>{s.role}</p>
              </div>
              {selected?.id === s.id && <ChevronRight size={14} />}
            </button>
          ))}
        </div>
      </div>

      {/* ── RIGHT: EXECUTIVE FOCUS ZONE (70% Width) ─────────────────── */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <div className="flex-1 p-12 flex flex-col">
            
            {/* Profile Header */}
            <div className="flex justify-between items-end mb-16">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[9px] font-black uppercase tracking-widest rounded-full">Management Console</span>
                  <span className="text-zinc-700 text-[9px] font-black uppercase tracking-widest">ID: {selected.id.toString().padStart(4, '0')}</span>
                </div>
                <h1 className="text-6xl font-black text-white uppercase italic tracking-tighter leading-none select-none">
                  {selected.name}
                </h1>
              </div>
              
              <button 
                onClick={async () => {
                    setSaving(true);
                    try {
                      await fetch(`${API_URL}/api/staff/update-targets`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          staff_id: selected.id,
                          income_target: selected.monthly_income_target,
                          order_target: selected.daily_order_target
                        })
                      });
                    } finally { setSaving(false); }
                }}
                className="bg-white text-black h-16 px-10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-yellow-500 transition-all flex items-center gap-3 active:scale-95"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Commit Changes
              </button>
            </div>

            <div className="grid grid-cols-2 gap-12">
              {/* Input Group 1 */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-zinc-500">
                  <TrendingUp size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Monthly Revenue Quota</span>
                </div>
                <div className="group relative">
                  <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-0 group-focus-within:h-12 bg-yellow-500 transition-all rounded-full" />
                  <input 
                    type="number" 
                    value={selected.monthly_income_target || 0}
                    onChange={(e) => setSelected({...selected, monthly_income_target: e.target.value})}
                    className="w-full bg-transparent text-7xl font-black text-white outline-none border-b border-white/5 focus:border-yellow-500/50 pb-4 transition-all"
                  />
                  <p className="text-[10px] text-zinc-600 font-bold mt-4 uppercase tracking-widest">Target in Uganda Shillings (UGX)</p>
                </div>
              </div>

              {/* Input Group 2 */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-zinc-500">
                  <PieChart size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Daily Order Volume</span>
                </div>
                <div className="group relative">
                  <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-0 group-focus-within:h-12 bg-yellow-500 transition-all rounded-full" />
                  <input 
                    type="number" 
                    value={selected.daily_order_target || 0}
                    onChange={(e) => setSelected({...selected, daily_order_target: e.target.value})}
                    className="w-full bg-transparent text-7xl font-black text-white outline-none border-b border-white/5 focus:border-yellow-500/50 pb-4 transition-all"
                  />
                  <p className="text-[10px] text-zinc-600 font-bold mt-4 uppercase tracking-widest">Orders served per shift</p>
                </div>
              </div>
            </div>

            {/* Visual Insights Section */}
            <div className="mt-auto grid grid-cols-3 gap-6">
                <InsightCard icon={<Award className="text-yellow-500"/>} label="Rank" value="Top Performer" />
                <InsightCard icon={<Target className="text-blue-500"/>} label="Projected Bonus" value="UGX 250,000" />
                <InsightCard icon={<PieChart className="text-emerald-500"/>} label="Current Status" value="Healthy" />
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-20">
            <Target size={120} strokeWidth={0.5} className="mb-8" />
            <p className="text-[11px] font-black uppercase tracking-[0.8em] text-white">Select Personnel</p>
          </div>
        )}
      </div>
    </div>
  );
}

function InsightCard({ icon, label, value }) {
    return (
        <div className="bg-white/5 border border-white/5 p-6 rounded-[2rem] flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{label}</span>
                {icon}
            </div>
            <p className="text-white text-lg font-black uppercase italic">{value}</p>
        </div>
    )
}