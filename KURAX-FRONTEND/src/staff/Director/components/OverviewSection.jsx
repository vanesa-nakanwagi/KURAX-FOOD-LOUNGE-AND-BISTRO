import React, { useState, useEffect } from "react";
import { TrendingUp, Banknote, Smartphone, CreditCard } from "lucide-react";
import { useTheme } from "./shared/ThemeContext";
import { StatCard, ActivityItem, ShiftMiniCard, fmtK } from "./shared/UIHelpers";
import { RevenueChart } from "../charts";
import API_URL from "../../../config/api";

export default function OverviewSection({ onViewRegistry }) {
  const { dark, t } = useTheme();

  const [summary,        setSummary]      = useState(null);
  const [summaryLoading, setSumLoad]      = useState(true);
  const [logs,           setLogs]         = useState([]);
  const [logsLoading,    setLogsLoad]     = useState(true);
  const [shifts,         setShifts]       = useState([]);
  const [shiftsLoading,  setShiftsLoad]   = useState(true);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/overview/summary?date=${today}`);
        if (res.ok) setSummary(await res.json());
      } catch (e) { console.error("Summary fetch failed:", e); }
      finally { setSumLoad(false); }
    })();

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/overview/logs?limit=5`);
        if (res.ok) setLogs(await res.json());
      } catch (e) { console.error("Logs fetch failed:", e); }
      finally { setLogsLoad(false); }
    })();

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/overview/shifts?date=${today}`);
        if (res.ok) setShifts(await res.json());
      } catch (e) { console.error("Shifts fetch failed:", e); }
      finally { setShiftsLoad(false); }
    })();
  }, [today]);

  const todayRevenue = summary?.total_revenue    ?? 0;
  const yesterdayRev = summary?.yesterday_revenue ?? null;
  const revenueTrend = yesterdayRev && yesterdayRev > 0
    ? `${todayRevenue >= yesterdayRev ? "+" : ""}${(((todayRevenue - yesterdayRev) / yesterdayRev) * 100).toFixed(1)}%`
    : null;

  const logColor = (type) => ({
    SHIFT: "bg-yellow-500", SALE: "bg-emerald-500",
    STAFF: "bg-blue-500",   ORDER: "bg-emerald-500", ERROR: "bg-rose-500",
  })[type?.toUpperCase()] || "bg-zinc-500";

  const timeAgo = (ts) => {
    if (!ts) return "";
    const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (diff < 60)    return `${diff}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="space-y-4">

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Revenue" value={summaryLoading ? null : todayRevenue} trend={revenueTrend}
          color="text-emerald-500" icon={<TrendingUp size={12} />} loading={summaryLoading} />
        <StatCard label="Cash"    value={summaryLoading ? null : (summary?.total_cash ?? 0)}
          color="text-white"      icon={<Banknote size={12} />}    loading={summaryLoading} />
        <StatCard label="MoMo"    value={summaryLoading ? null : (summary?.total_momo ?? 0)}
          color="text-yellow-500" icon={<Smartphone size={12} />}  loading={summaryLoading} />
        <StatCard label="Card"    value={summaryLoading ? null : (summary?.total_card ?? 0)}
          color="text-blue-500"   icon={<CreditCard size={12} />}  loading={summaryLoading} />
      </div>

      {/* Chart + Live Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`lg:col-span-2 ${t.card} border rounded-2xl p-4 md:p-8`}>
          <h3 className={`text-xs font-black uppercase italic mb-3 tracking-widest ${t.subtext}`}>Revenue Flow</h3>
          <div className="w-full overflow-hidden"><RevenueChart /></div>
        </div>

        <div className={`${t.card} border rounded-2xl p-4 md:p-8`}>
          <h3 className="text-xs font-black uppercase italic mb-4 tracking-widest">Live Logs</h3>
          {logsLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className={`h-10 rounded-xl animate-pulse ${dark ? "bg-zinc-800" : "bg-zinc-100"}`} />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className={`text-[10px] font-bold uppercase ${t.subtext} text-center py-6`}>No activity yet today</p>
          ) : (
            <div className="space-y-4">
              {logs.map((log, i) => (
                <ActivityItem key={log.id ?? i} type={log.type} msg={log.message}
                  time={timeAgo(log.created_at)} color={logColor(log.type)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Shift Liquidations */}
      <div className={`${t.card} border rounded-2xl p-4 md:p-8`}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className={`text-xs font-black uppercase italic tracking-widest ${t.subtext}`}>Shift Liquidations</h3>
            <p className={`text-[8px] font-bold uppercase ${dark ? "text-zinc-600" : "text-zinc-400"}`}>Final tallies</p>
          </div>
          <button onClick={onViewRegistry}
            className="text-[9px] font-black text-yellow-500 border border-yellow-500/20 px-3 py-1.5 rounded-xl hover:bg-yellow-500 hover:text-black transition-all shrink-0">
            REGISTRY
          </button>
        </div>

        {shiftsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className={`h-16 rounded-xl animate-pulse ${dark ? "bg-zinc-800" : "bg-zinc-100"}`} />
            ))}
          </div>
        ) : shifts.length === 0 ? (
          <div className={`py-10 text-center border border-dashed rounded-2xl ${dark ? "border-white/5" : "border-zinc-200"}`}>
            <p className={`text-[9px] font-black uppercase italic tracking-widest ${dark ? "text-zinc-600" : "text-zinc-400"}`}>
              No shifts ended today
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {shifts.map((shift, i) => {
              const isServiceRole = ["CHEF", "BARISTA", "BARMAN"].includes(shift.role?.toUpperCase());
              return (
                <ShiftMiniCard
                  key={shift.id ?? i}
                  staff={`${shift.staff_name} (${shift.role})`}
                  time={shift.clock_out
                    ? new Date(shift.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "--:--"}
                  type={isServiceRole ? "service" : "cashier"}
                  status={isServiceRole ? shift.status ?? "" : undefined}
                  cash={isServiceRole ? undefined : fmtK(shift.total_cash)}
                  momo={isServiceRole ? undefined : fmtK(shift.total_momo)}
                  card={isServiceRole ? undefined : fmtK(shift.total_card)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}