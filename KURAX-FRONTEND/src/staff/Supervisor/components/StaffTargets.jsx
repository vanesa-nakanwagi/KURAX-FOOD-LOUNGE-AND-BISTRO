import React, { useState, useEffect, useRef } from "react";
import {
  Target, Save, Search, TrendingUp,
  Loader2, Award, PieChart, Check, ChevronLeft, ChevronRight,
  User, Star, Zap, BarChart3, Globe
} from "lucide-react";
import API_URL from "../../../config/api";

const ROLE_STYLE = {
  MANAGER:    { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", icon: <Star size={12}/> },
  SUPERVISOR: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200", icon: <BarChart3 size={12}/> },
  CASHIER:    { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", icon: <Zap size={12}/> },
  WAITER:     { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200", icon: <User size={12}/> },
};

const roleStyle = (role) => ROLE_STYLE[(role || "").toUpperCase()] || ROLE_STYLE.WAITER;

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export default function StaffTargets() {
  const [staff, setStaff] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [businessTarget, setBusinessTarget] = useState(null);
  const [targetLoading, setTargetLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchStaff();
    fetchBusinessTarget();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await fetch(`${API_URL}/api/staff/performance-list`);
      const data = await res.json();
      setStaff(data);
      if (data.length > 0 && !selected) {
        setSelected(data[0]);
        setTimeout(() => setAnimateIn(true), 100);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchBusinessTarget = async () => {
    try {
      const month = getCurrentMonth();
      const res = await fetch(`${API_URL}/api/manager/target-progress?month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setBusinessTarget(data);
      } else {
        setBusinessTarget({ target: 0, current: 0, percentage: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch business target:", err);
      setBusinessTarget({ target: 0, current: 0, percentage: 0 });
    } finally {
      setTargetLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selected || saving) return;
    setSaving(true);

    const income_target = Number(selected.monthly_income_target) || 0;
    const order_target = Number(selected.daily_order_target) || 0;

    try {
      const res = await fetch(`${API_URL}/api/staff/update-targets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: selected.id,
          income_target,
          order_target,
        }),
      });

      if (!res.ok) {
        console.error("Failed to save staff targets", await res.text());
        return;
      }

      const updated = staff.map(s =>
        s.id === selected.id
          ? { ...s, monthly_income_target: income_target, daily_order_target: order_target }
          : s
      );
      setStaff(updated);
      setSelected(prev => prev ? { ...prev, monthly_income_target: income_target, daily_order_target: order_target } : prev);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectStaff = (staffMember) => {
    setAnimateIn(false);
    setTimeout(() => {
      setSelected(staffMember);
      setSaved(false);
      setTimeout(() => setAnimateIn(true), 50);
    }, 150);
  };

  const scroll = (dir) => {
    if (scrollRef.current)
      scrollRef.current.scrollBy({ left: dir * 220, behavior: "smooth" });
  };

  const filtered = staff.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Use dynamic business target as max
  const businessTargetValue = businessTarget?.target || 0;
  const getProgressWidth = (value, max = businessTargetValue) => {
    if (!max || max === 0) return 0;
    return Math.min(100, (value / max) * 100);
  };

  const getOrderProgressWidth = (value, max = 100) => {
    return Math.min(100, (value / max) * 100);
  };

  // Helper: progress color based on percentage
  const getProgressColor = (percentage) => {
    if (percentage >= 75) return "text-emerald-500";
    if (percentage >= 50) return "text-yellow-500";
    if (percentage >= 25) return "text-orange-500";
    return "text-red-500";
  };

  const currentMonthLabel = (() => {
    const [year, month] = getCurrentMonth().split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleString("default", { month: "long", year: "numeric" }).toUpperCase();
  })();

  return (
    <div className="flex flex-col h-full min-h-0 bg-gradient-to-br from-gray-50 to-gray-100 font-[Outfit]">

      {/* ── HORIZONTAL STAFF SELECTOR ── */}
      <div className="shrink-0 border-b border-gray-200 bg-white/80 backdrop-blur-sm px-4 pt-6 pb-4 space-y-3 shadow-sm sticky top-0 z-10">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-yellow-500 rounded-full" />
              <p className="text-[12px] font-black uppercase tracking-[0.25em] text-yellow-700">
                TEAM ROSTER · {staff.length} ACTIVE MEMBERS
              </p>
            </div>
            <button
              onClick={() => { setShowSearch(v => !v); setSearchTerm(""); }}
              className={`p-1.5 rounded-lg transition-all duration-200 ${showSearch ? "bg-yellow-100 text-yellow-700 ring-2 ring-yellow-500/30" : "text-yellow-700 hover:text-gray-700 hover:bg-gray-100"}`}
            >
              <Search size={14}/>
            </button>
          </div>
          <div className="mt-2">
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Select a team member to view and adjust their monthly revenue and daily order targets.
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className={`overflow-hidden transition-all duration-300 ${showSearch ? "max-h-20 opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="relative pt-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
            <input
              autoFocus
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 text-sm font-medium text-gray-900 placeholder:text-gray-400 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all"
            />
          </div>
        </div>

        {/* Pill row */}
        <div className="relative flex items-center gap-1 mt-1">
          <button onClick={() => scroll(-1)}
            className="shrink-0 p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
            <ChevronLeft size={14}/>
          </button>
          <div className="relative flex-1">
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
            <div
              ref={scrollRef}
              className="flex items-center gap-2 overflow-x-auto scroll-smooth py-1"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="shrink-0 h-[56px] w-28 rounded-xl bg-gray-100 animate-pulse"
                    style={{ animationDelay: `${i * 60}ms` }}/>
                ))
              ) : filtered.length === 0 ? (
                <div className="flex-1 text-center py-3">
                  <p className="text-[11px] text-gray-500 font-medium">No staff members found</p>
                </div>
              ) : (
                filtered.map((s, idx) => {
                  const active = selected?.id === s.id;
                  const roleData = roleStyle(s.role);
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStaff(s)}
                      className={`shrink-0 flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-xl border font-bold transition-all duration-300 whitespace-nowrap
                        ${active
                          ? "bg-yellow-500 border-yellow-400 shadow-lg shadow-yellow-500/30 text-black scale-105"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-yellow-300 hover:shadow-md"
                        }`}
                      style={{ transitionDelay: `${idx * 30}ms` }}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-medium text-yellow-900 shrink-0 transition-all
                        ${active ? "bg-yellow-100" : roleData.bg + " " + roleData.text}`}>
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className={`text-[12px] font-medium uppercase leading-tight ${active ? "text-black" : "text-yellow-900"}`}>
                          {s.name.split(" ")[0]}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`text-[8px] font-bold uppercase tracking-wider ${active ? "text-black/60" : "text-gray-500"}`}>
                            {s.role}
                          </span>
                          {active && <div className="w-1 h-1 rounded-full bg-black/40" />}
                          {active && <span className="text-[8px] font-bold text-black/60">✓ Active</span>}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <button onClick={() => scroll(1)}
            className="shrink-0 p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
            <ChevronRight size={14}/>
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 overflow-y-auto p-6 pt-8">
        {selected ? (
          <div className={`max-w-3xl mx-auto space-y-6 transition-all duration-500 ${animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            
            {/* Hero Profile Card */}
            <div className="relative overflow-hidden bg-gradient-to-r from-white to-gray-50 rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-500/5 to-transparent rounded-full -mr-16 -mt-16" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-gray-100 to-transparent rounded-full -ml-12 -mb-12" />
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center text-white text-2xl font-black shadow-lg">
                    {selected.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] font-semibold text-yellow-900 uppercase tracking-wider ${roleStyle(selected.role).bg} ${roleStyle(selected.role).text} ${roleStyle(selected.role).border}`}>
                        {roleStyle(selected.role).icon}
                        {selected.role}
                      </span>
                      <span className="text-[9px] text-gray-400">ID: {String(selected.id).padStart(4, "0")}</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-semibold text-yellow-900 tracking-tight">
                      {selected.name}
                    </h1>
                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mt-1">
                      Performance Targets & Analytics
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all active:scale-95 shadow-md
                    ${saved
                      ? "bg-emerald-500 text-white shadow-emerald-500/20"
                      : "bg-yellow-500 text-black hover:bg-yellow-600 shadow-yellow-500/30 hover:shadow-yellow-500/40 disabled:opacity-60"
                    }`}
                >
                  {saving  ? <><Loader2 size={14} className="animate-spin"/> SAVING...</>
                  : saved  ? <><Check size={14}/> SAVED</>
                  :           <><Save size={14}/> SAVE TARGETS</>}
                </button>
              </div>
            </div>

            {/* Target Inputs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              
              {/* Monthly Revenue Card - now uses dynamic business target */}
              <div className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-yellow-100 group-hover:scale-110 transition-transform duration-300">
                        <TrendingUp size={16} className="text-yellow-600"/>
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-yellow-900">Monthly Revenue Target</p>
                        <p className="text-[10px] text-gray-400">Individual goal</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">UGX</span>
                  </div>
                  
                  <div className="relative">
                    <input
                      type="number"
                      value={selected.monthly_income_target || 0}
                      onChange={e => setSelected({ ...selected, monthly_income_target: e.target.value })}
                      className="w-full bg-transparent text-4xl font-black text-gray-900 outline-none border-b-2 border-gray-200 focus:border-yellow-500 pb-2 transition-colors"
                      placeholder="0"
                    />
                    <div className="absolute right-0 bottom-2 text-[11px] text-gray-400 font-bold">
                      UGX
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-yellow-900">Progress</span>
                      <span className={`${getProgressColor(getProgressWidth(selected.monthly_income_target))}`}>
                        {Math.min(100, Math.round(getProgressWidth(selected.monthly_income_target)))}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full transition-all duration-700"
                        style={{ width: `${getProgressWidth(selected.monthly_income_target)}%` }}
                      />
                    </div>
                    {/* Dynamic business target display */}
                    <p className="text-[10px] text-gray-500">
                      Business target: UGX {businessTargetValue.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Daily Orders Card */}
              <div className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-blue-100 group-hover:scale-110 transition-transform duration-300">
                        <PieChart size={16} className="text-blue-600"/>
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-yellow-900">Daily Orders Target</p>
                        <p className="text-[10px] text-gray-400">Per shift goal</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">orders/day</span>
                  </div>
                  
                  <div className="relative">
                    <input
                      type="number"
                      value={selected.daily_order_target || 0}
                      onChange={e => setSelected({ ...selected, daily_order_target: e.target.value })}
                      className="w-full bg-transparent text-4xl font-black text-gray-900 outline-none border-b-2 border-gray-200 focus:border-yellow-500 pb-2 transition-colors"
                      placeholder="0"
                    />
                    <div className="absolute right-0 bottom-2 text-[11px] text-gray-400 font-bold">
                      orders
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-yellow-900">Progress</span>
                      <span className="text-blue-600">{Math.min(100, Math.round(getOrderProgressWidth(selected.daily_order_target || 0, 100)))}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-700"
                        style={{ width: `${getOrderProgressWidth(selected.daily_order_target || 0, 100)}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Array.from({ length: Math.min(10, Math.floor((selected.daily_order_target || 0) / 10)) }).map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      ))}
                      {(selected.daily_order_target || 0) > 100 && (
                        <span className="text-[8px] text-gray-500 font-bold ml-1">
                          +{selected.daily_order_target - 100}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Insights Dashboard */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-yellow-500 rounded-full" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-yellow-900">
                  Performance Insights
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InsightCard 
                  icon={<Award size={16} className="text-yellow-900"/>} 
                  label="Current Standing" 
                  value={selected.monthly_income_target > (businessTargetValue * 0.4) ? "Top Performer" : "Rising Star"} 
                  accent="yellow"
                  metric={`${Math.round(getProgressWidth(selected.monthly_income_target))}% to business target`}
                />
                <InsightCard 
                  icon={<Target size={16} className="text-blue-600"/>} 
                  label="Projected Bonus" 
                  value={selected.monthly_income_target > (businessTargetValue * 0.6) ? "UGX 350,000" : "UGX 150,000"} 
                  accent="blue"
                  metric={selected.monthly_income_target > (businessTargetValue * 0.6) ? "Exceeding expectations" : "Meeting expectations"}
                />
                <InsightCard 
                  icon={<Zap size={16} className="text-emerald-600"/>} 
                  label="Current Status" 
                  value={selected.daily_order_target > 50 ? "On Fire 🔥" : "On Track ✓"} 
                  accent="emerald"
                  metric={`${selected.daily_order_target || 0} orders/day goal`}
                />
              </div>
            </div>

            {/* Achievement Badge */}
            {(selected.monthly_income_target > (businessTargetValue * 0.8) || selected.daily_order_target > 80) && (
              <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-2xl border border-yellow-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <Star size={18} className="text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-yellow-700 uppercase tracking-wider">🏆 Elite Performance</p>
                    <p className="text-[9px] text-gray-600 mt-0.5">This staff member is exceeding expectations! Outstanding contribution to Kurax.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
              <Target size={36} className="text-gray-400" />
            </div>
            <p className="text-[13px] font-semibold text-yellow-900 uppercase tracking-widest text-center">
              Select a staff member to begin
            </p>
            <p className="text-[10px] text-gray-400 text-center">Choose from the team roster above</p>
          </div>
        )}

        {/* BUSINESS TARGET CARD – moved to bottom, separate section */}
        {!targetLoading && businessTarget && businessTargetValue > 0 && (
          <div className="mt-8 pt-4 border-t border-gray-200">
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/50 to-white border border-blue-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Globe size={16} className="text-blue-600" />
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-800">Manager's Monthly Target</span>
              </div>
              <div className="flex flex-wrap gap-4 justify-between items-center">
                <div>
                  <p className="text-[9px] text-gray-500">Total Goal</p>
                  <p className="text-lg font-black text-blue-900">{businessTargetValue.toLocaleString()} UGX</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-500">Achieved</p>
                  <p className="text-lg font-black text-emerald-600">{businessTarget.current.toLocaleString()} UGX</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-500">Percentage</p>
                  <p className="text-lg font-black text-yellow-600">{businessTarget.percentage}%</p>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(businessTarget.percentage, 100)}%` }} />
              </div>
              <p className="text-[8px] text-gray-400 mt-2">Overall monthly revenue target set by management. Align individual targets to contribute to this goal.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InsightCard({ icon, label, value, accent, metric }) {
  const styles = {
    yellow:  "border-yellow-200 bg-yellow-50/50 hover:bg-yellow-50",
    blue:    "border-blue-200   bg-blue-50/50   hover:bg-blue-50",
    emerald: "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50",
  };
  return (
    <div className={`border rounded-xl p-4 transition-all duration-300 hover:shadow-md ${styles[accent]} group`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-white shadow-sm group-hover:scale-110 transition-transform duration-300">
            {icon}
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-yellow-900">{label}</p>
            <p className="text-sm font-black text-gray-900 mt-0.5">{value}</p>
          </div>
        </div>
      </div>
      {metric && <p className="text-[8px] text-gray-500 mt-2 pt-1 border-t border-gray-100">{metric}</p>}
    </div>
  );
}