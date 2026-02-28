import React, { useMemo } from "react";
import { useData } from "../../customer/components/context/DataContext";
import { useTheme } from "../../customer/components/context/ThemeContext";
import {
  Target, ArrowUpRight, TrendingUp, TrendingDown,
  CheckCircle2, AlertTriangle, Zap, Calendar, Activity
} from "lucide-react";

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

function fmtUGX(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

function daysRemainingInMonth() {
  const now  = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(1, last - now.getDate() + 1);
}

function daysInMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function daysElapsed() {
  return new Date().getDate();
}

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────
export default function DirectorTargetView() {
  const { theme }                                     = useTheme();
  const { orders = [], monthlyTargets = {}, loading } = useData();
  const dark = theme === "dark";

  const currentMonthKey = new Date().toISOString().substring(0, 7);
  const monthLabel = new Date()
    .toLocaleString("default", { month: "long", year: "numeric" })
    .toUpperCase();

  const target        = monthlyTargets?.[currentMonthKey] ?? {};
  const targetRevenue = Number(target.revenue) || 0;

  const actualSales = useMemo(() => {
    return (orders || [])
      .filter(o =>
        o &&
        typeof o.date === "string" &&
        o.date.startsWith(currentMonthKey) &&
        o.status === "CLOSED"
      )
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [orders, currentMonthKey]);

  // ── Derived metrics ──────────────────────────────────────
  const progress       = targetRevenue > 0 ? Math.min((actualSales / targetRevenue) * 100, 100) : 0;
  const remaining      = Math.max(0, targetRevenue - actualSales);
  const daysLeft       = daysRemainingInMonth();
  const elapsed        = daysElapsed();
  const totalDays      = daysInMonth();
  const dailyPace      = daysLeft > 0 ? Math.round(remaining / daysLeft) : 0;
  const avgDailyActual = elapsed > 0 ? Math.round(actualSales / elapsed) : 0;
  const expectedByNow  = targetRevenue > 0
    ? Math.round((targetRevenue / totalDays) * elapsed) : 0;
  const paceGap = actualSales - expectedByNow;

  const isComplete = targetRevenue > 0 && actualSales >= targetRevenue;
  const isOnTrack  = paceGap >= 0;
  const isNotSet   = targetRevenue === 0;

  // ── Status config ─────────────────────────────────────────
  const statusConfig = isNotSet
    ? {
        label: "NOT SET",
        textColor: dark ? "text-zinc-400"    : "text-zinc-500",
        bg:        dark ? "bg-zinc-800/80"   : "bg-zinc-100",
        border:    dark ? "border-zinc-700"  : "border-zinc-300",
        icon: <Target size={13}/>,
      }
    : isComplete
    ? {
        label: "ACHIEVED",
        textColor: "text-emerald-400",
        bg:        dark ? "bg-emerald-500/15" : "bg-emerald-100",
        border:    dark ? "border-emerald-500/30" : "border-emerald-300",
        icon: <CheckCircle2 size={13}/>,
      }
    : isOnTrack
    ? {
        label: "ON TRACK",
        textColor: "text-yellow-400",
        bg:        dark ? "bg-yellow-500/15"  : "bg-yellow-100",
        border:    dark ? "border-yellow-500/30" : "border-yellow-300",
        icon: <Zap size={13}/>,
      }
    : {
        label: "BEHIND PACE",
        textColor: "text-rose-400",
        bg:        dark ? "bg-rose-500/15"    : "bg-rose-100",
        border:    dark ? "border-rose-500/30" : "border-rose-300",
        icon: <AlertTriangle size={13}/>,
      };

  // ── Bar color ─────────────────────────────────────────────
  const barColor = isComplete
    ? "bg-emerald-500"
    : progress > 75 ? "bg-yellow-400"
    : progress > 40 ? "bg-yellow-500"
    : "bg-rose-500";

  const barGlow = isComplete
    ? "shadow-[0_0_12px_rgba(52,211,153,0.35)]"
    : progress > 40
    ? "shadow-[0_0_12px_rgba(234,179,8,0.35)]"
    : "";

  // ── Reusable dark/light tokens ────────────────────────────
  // Outer card shell
  const outerCard = dark
    ? "bg-zinc-900 border-zinc-800"
    : "bg-white border-zinc-200";

  // Inner sub-card (slightly lighter/darker than outer)
  const innerCard = dark
    ? "bg-zinc-800/70 border-zinc-700/60"
    : "bg-zinc-50 border-zinc-200";

  // Emerald tinted inner card
  const emeraldCard = dark
    ? "bg-emerald-900/20 border-emerald-500/20"
    : "bg-emerald-50 border-emerald-200";

  // Insight card shell
  const insightCard = dark
    ? "bg-zinc-800/60 border-zinc-700/50 hover:bg-zinc-800 hover:border-zinc-600"
    : "bg-zinc-50 border-zinc-200 hover:bg-white hover:border-zinc-300";

  // Icon background
  const iconBg = dark ? "bg-zinc-700/80" : "bg-zinc-200/80";

  // Text tokens
  const strong = dark ? "text-white"    : "text-zinc-900";
  const muted  = dark ? "text-zinc-500" : "text-zinc-400";
  const faint  = dark ? "text-zinc-600" : "text-zinc-300";

  // Track background
  const trackBg = dark
    ? "bg-zinc-800 border-zinc-700/50"
    : "bg-zinc-100 border-zinc-200";

  // ── Loading skeleton ──────────────────────────────────────
  if (loading) {
    const skeletonBlock = dark ? "bg-zinc-800" : "bg-zinc-200";
    return (
      <div className={`rounded-3xl p-6 space-y-5 animate-pulse ${dark ? "bg-zinc-900" : "bg-zinc-50"}`}>
        <div className={`h-7 w-44 rounded-xl ${skeletonBlock}`}/>
        <div className={`h-36 w-full rounded-2xl ${skeletonBlock}`}/>
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className={`h-20 rounded-2xl ${skeletonBlock}`}/>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-[Outfit]">

      {/* ── HEADER ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className={`text-xl sm:text-2xl md:text-3xl font-black uppercase italic tracking-tighter leading-none ${strong}`}>
            Manager's Goal
          </h2>
          <p className={`text-[9px] font-bold uppercase tracking-[0.18em] mt-1 ${muted}`}>
            Target vs. Actual Performance
          </p>
        </div>

        <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1">
          {/* Status pill */}
          <span className={`
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border
            text-[9px] font-black uppercase tracking-widest
            ${statusConfig.textColor} ${statusConfig.bg} ${statusConfig.border}
          `}>
            {statusConfig.icon}
            {statusConfig.label}
          </span>
          <span className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest ${muted}`}>
            <Calendar size={9}/>
            {monthLabel}
          </span>
        </div>
      </div>

      {/* ── MAIN CARD ────────────────────────────────────── */}
      <div className={`rounded-2xl md:rounded-3xl border p-5 md:p-7 space-y-5 ${outerCard}`}>

        {/* Target + Actual boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-5">

          {/* Target */}
          <div className={`rounded-2xl border p-4 ${innerCard}`}>
            <p className={`text-[8px] font-black uppercase tracking-[0.18em] mb-3 ${muted}`}>
              Monthly Target
            </p>
            {isNotSet ? (
              <p className={`text-base font-black uppercase italic ${muted}`}>
                Not configured
              </p>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-black uppercase ${muted}`}>UGX</span>
                  <span className={`text-2xl sm:text-3xl font-black italic tracking-tighter ${strong}`}>
                    {fmtUGX(targetRevenue)}
                  </span>
                </div>
                <p className={`text-[8px] font-bold mt-1.5 ${muted}`}>
                  ≈ UGX {fmtUGX(Math.round(targetRevenue / totalDays))} / day required
                </p>
              </>
            )}
          </div>

          {/* Actual */}
          <div className={`rounded-2xl border p-4 ${emeraldCard}`}>
            <p className="text-[8px] font-black uppercase tracking-[0.18em] mb-3 text-emerald-500">
              Actual Revenue — Live
            </p>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[10px] font-black uppercase text-emerald-500">UGX</span>
              <span className="text-2xl sm:text-3xl font-black italic tracking-tighter text-emerald-400">
                {fmtUGX(actualSales)}
              </span>
            </div>
            <p className={`text-[8px] font-bold mt-1.5 ${muted}`}>
              ≈ UGX {fmtUGX(avgDailyActual)} / day average
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <p className={`text-[9px] font-black uppercase italic tracking-widest ${muted}`}>
              Monthly Completion
            </p>
            <p className={`text-xl sm:text-2xl font-black italic ${isComplete ? "text-emerald-400" : "text-yellow-500"}`}>
              {progress.toFixed(1)}%
            </p>
          </div>

          <div className={`w-full h-3 md:h-4 rounded-full overflow-hidden border p-[2px] ${trackBg}`}>
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor} ${barGlow}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {!isNotSet && (
            <div className="flex items-center justify-between pt-0.5">
              <span className={`flex items-center gap-1.5 text-[9px] font-bold uppercase ${
                isOnTrack || isComplete ? "text-emerald-400" : "text-rose-400"
              }`}>
                {isOnTrack || isComplete ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                {isComplete
                  ? "Target achieved!"
                  : isOnTrack
                  ? `UGX ${fmtUGX(paceGap)} ahead of pace`
                  : `UGX ${fmtUGX(Math.abs(paceGap))} behind pace`
                }
              </span>
              <span className={`text-[8px] font-bold ${muted}`}>
                Day {elapsed} of {totalDays}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── INSIGHT CARDS ────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

        <InsightCard
          label="Remaining"
          value={isNotSet ? "N/A" : `UGX ${fmtUGX(remaining)}`}
          sub={isComplete ? "Target hit!" : `${daysLeft} days left`}
          icon={<ArrowUpRight size={15}/>}
          valueColor={isComplete ? "text-emerald-400" : "text-yellow-400"}
          insightCard={insightCard}
          iconBg={iconBg}
          strong={strong}
          muted={muted}
        />

        <InsightCard
          label="Daily Pace Needed"
          value={isNotSet ? "N/A" : isComplete ? "Done" : `UGX ${fmtUGX(dailyPace)}`}
          sub={isNotSet ? "Set a target" : `avg actual: ${fmtUGX(avgDailyActual)}`}
          icon={<TrendingUp size={15}/>}
          valueColor={isOnTrack ? "text-emerald-400" : "text-rose-400"}
          insightCard={insightCard}
          iconBg={iconBg}
          strong={strong}
          muted={muted}
        />

        {/* Full-width on mobile, normal on desktop */}
        <div className="col-span-2 md:col-span-1">
          <InsightCard
            label="Target Status"
            value={statusConfig.label}
            sub={
              isNotSet   ? "Manager hasn't set a target" :
              isComplete ? `${progress.toFixed(1)}% complete` :
              isOnTrack  ? `${(100 - progress).toFixed(1)}% remaining` :
                           "Needs attention"
            }
            icon={statusConfig.icon}
            valueColor={statusConfig.textColor}
            insightCard={insightCard}
            iconBg={iconBg}
            strong={strong}
            muted={muted}
            fullHeight
          />
        </div>
      </div>

      {/* ── MONTHLY TIMELINE ─────────────────────────────── */}
      {!isNotSet && (
        <div className={`rounded-2xl border p-4 md:p-5 ${outerCard}`}>
          <div className="flex items-center gap-2 mb-4">
            <Activity size={12} className="text-yellow-500 shrink-0"/>
            <p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>
              Monthly Timeline
            </p>
            <span className={`ml-auto text-[8px] font-bold uppercase ${faint}`}>
              {totalDays} days total
            </span>
          </div>

          {/* Day bars */}
          <div className="flex gap-[2px] items-end h-8">
            {Array.from({ length: totalDays }, (_, i) => {
              const day     = i + 1;
              const isPast  = day < elapsed;
              const isToday = day === elapsed;
              const barH    = isToday ? "100%" : isPast ? "70%" : "35%";

              let barCls = "";
              if (isToday)     barCls = "bg-yellow-500 animate-pulse";
              else if (isPast) barCls = isOnTrack
                ? dark ? "bg-yellow-500/60" : "bg-yellow-400/70"
                : dark ? "bg-rose-500/50"   : "bg-rose-400/60";
              else             barCls = dark ? "bg-zinc-700/70" : "bg-zinc-200";

              return (
                <div
                  key={day}
                  title={`Day ${day}`}
                  className={`flex-1 rounded-[2px] transition-all duration-300 ${barCls}`}
                  style={{ height: barH }}
                />
              );
            })}
          </div>

          <div className="flex justify-between mt-2.5">
            <span className={`text-[8px] font-bold ${muted}`}>Day 1</span>
            <span className="text-[8px] font-bold text-yellow-500">Today · Day {elapsed}</span>
            <span className={`text-[8px] font-bold ${muted}`}>Day {totalDays}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// INSIGHT CARD
// ─────────────────────────────────────────────────────────
function InsightCard({ label, value, sub, icon, valueColor, insightCard, iconBg, strong, muted, fullHeight }) {
  return (
    <div className={`
      border rounded-2xl p-4 flex flex-col gap-3
      transition-all duration-200 active:scale-[0.98]
      ${insightCard}
      ${fullHeight ? "h-full" : ""}
    `}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-[8px] font-black uppercase tracking-widest leading-snug ${muted}`}>
          {label}
        </p>
        <div className={`p-1.5 rounded-xl shrink-0 ${iconBg} ${valueColor}`}>
          {icon}
        </div>
      </div>
      <div>
        <p className={`text-sm sm:text-base font-black italic tracking-tighter leading-tight ${valueColor}`}>
          {value}
        </p>
        {sub && (
          <p className={`text-[8px] font-bold mt-1 ${muted}`}>{sub}</p>
        )}
      </div>
    </div>
  );
}