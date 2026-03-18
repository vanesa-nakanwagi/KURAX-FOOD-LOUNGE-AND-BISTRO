import React, { useState, useEffect } from "react";
import { X, FileText, CalendarDays, BarChart2, BookOpen, Clock } from "lucide-react";
import { useTheme } from "./shared/ThemeContext";
import API_URL from "../../../config/api";

function kampalaToday() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" })
  ).toISOString().split("T")[0];
}

// ── Single stat row ───────────────────────────────────────────────────────────
function StatRow({ label, value, color, large, noBorder }) {
  const { t } = useTheme();
  return (
    <div className={`flex justify-between items-center py-3 ${noBorder ? "" : "border-b border-white/5 last:border-0"}`}>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${t.subtext}`}>{label}</span>
      <span className={`font-black ${large ? "text-lg italic" : "text-sm"} ${color}`}>{value}</span>
    </div>
  );
}

// ── ContentManagerStats ───────────────────────────────────────────────────────
function ContentManagerStats({ staffId, today }) {
  const { dark, t } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/content-manager/daily-stats?staffId=${staffId}&date=${today}`);
        if (!res.ok) throw new Error("Failed");
        setData(await res.json());
      } catch {}
      finally { setLoading(false); }
    })();
  }, [staffId, today]);

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  const items = [
    { label: "Total Menus",    value: data?.totalMenus    ?? 0, color: "text-fuchsia-400", bg: dark ? "bg-fuchsia-500/10" : "bg-fuchsia-50", icon: <FileText size={14}/> },
    { label: "Total Events",   value: data?.totalEvents   ?? 0, color: "text-yellow-400",  bg: dark ? "bg-yellow-500/10"  : "bg-yellow-50",  icon: <CalendarDays size={14}/> },
    { label: "Total Views",    value: (data?.totalViews   ?? 0).toLocaleString(), color: "text-blue-400", bg: dark ? "bg-blue-500/10" : "bg-blue-50", icon: <BarChart2 size={14}/> },
    { label: "Total Bookings", value: data?.totalBookings ?? 0, color: "text-emerald-400", bg: dark ? "bg-emerald-500/10" : "bg-emerald-50", icon: <BookOpen size={14}/> },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(({ label, value, color, bg, icon }) => (
        <div key={label} className={`border rounded-2xl p-4 flex flex-col gap-2 ${dark ? "bg-zinc-800/50 border-white/5" : "bg-zinc-50 border-zinc-200"}`}>
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${bg} ${color}`}>{icon}</div>
          <p className={`text-[8px] font-black uppercase tracking-widest ${t.subtext}`}>{label}</p>
          <p className={`text-2xl font-black italic ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function StaffAnalyticsModal({ staff, orders, onClose, shiftEnded = false }) {
  const { dark, t } = useTheme();
  const role  = (staff.role || "").toUpperCase();
  const today = kampalaToday();

  const [shifts,        setShifts]        = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);

  useEffect(() => {
    setShifts([]);
    if (!["WAITER","MANAGER","SUPERVISOR","CASHIER"].includes(role)) return;

    let active = true;

    const fetchShifts = async (isFirst = false) => {
      if (isFirst) setShiftsLoading(true);
      try {
        const url = `${API_URL}/api/waiter/shifts/${staff.id}?date=${today}`;
        const res = await fetch(url);
        const data = res.ok ? await res.json() : [];
        if (res.ok && active) setShifts(data);
      } catch (e) { console.error("shifts fetch:", e); }
      if (isFirst) setShiftsLoading(false);
    };

    fetchShifts(true);
    const id = setInterval(() => fetchShifts(false), 8000);
    return () => { active = false; clearInterval(id); };
  }, [staff.id, role, today]);

  const latestShift = shifts.length > 0 ? shifts[shifts.length - 1] : null;
  const shiftArchived = latestShift !== null;

  // Variables derived from latestShift
  const totalOrders = shiftArchived ? Number(latestShift.total_orders || 0) : 0;
  const totalCash   = shiftArchived ? Number(latestShift.total_cash   || 0) : 0;
  const totalMTN    = shiftArchived ? Number(latestShift.total_mtn    || 0) : 0;
  const totalAirtel = shiftArchived ? Number(latestShift.total_airtel || 0) : 0;
  const totalCard   = shiftArchived ? Number(latestShift.total_card   || 0) : 0;
  const totalMomo   = totalMTN + totalAirtel;
  const totalGross  = shiftArchived ? Number(latestShift.gross_total  || 0) : 0;
  const pettyCash   = shiftArchived ? Number(latestShift.petty_cash   || 0) : 0;
  const netCash     = totalCash - pettyCash;

  const ugx = n => `UGX ${Number(n || 0).toLocaleString()}`;

  const roleColors = {
    WAITER: "text-emerald-400", MANAGER: "text-yellow-500", SUPERVISOR: "text-yellow-400",
    CHEF: "text-blue-400", BARISTA: "text-purple-400", BARMAN: "text-orange-400",
    CASHIER: "text-emerald-400", ACCOUNTANT: "text-rose-400", "CONTENT-MANAGER": "text-fuchsia-400",
  };

  let content;

  if (role === "WAITER" || role === "SUPERVISOR") {
    content = shiftsLoading ? (
      <div className="flex items-center justify-center py-10">
        <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"/>
      </div>
    ) : (
      <div className={`rounded-2xl border overflow-hidden ${dark ? "border-white/5" : "border-zinc-200"}`}>
        <div className={`px-4 py-2.5 ${dark ? "bg-white/5" : "bg-zinc-50"}`}>
          <p className={`text-[8px] font-black uppercase tracking-[0.2em] ${t.subtext}`}>Daily Summary — {today}</p>
        </div>
        {!shiftArchived ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 opacity-40">
            <p className={`text-[11px] font-black uppercase tracking-widest ${dark ? "text-zinc-500" : "text-zinc-400"}`}>No shift ended yet today</p>
          </div>
        ) : (
          <>
            <div className="px-4 pb-1">
              <StatRow label="Total Orders"  value={totalOrders}       color="text-white"/>
              <StatRow label="Cash"          value={ugx(totalCash)}    color="text-emerald-400"/>
              <StatRow label="MTN Momo"      value={ugx(totalMTN)}     color="text-yellow-400"/>
              <StatRow label="Airtel Momo"   value={ugx(totalAirtel)}  color="text-red-400"/>
              <StatRow label="Total Momo"    value={ugx(totalMomo)}    color="text-orange-400"/>
              <StatRow label="Card"          value={ugx(totalCard)}    color="text-blue-400"/>
            </div>
            <div className={`mx-3 mb-3 rounded-xl px-4 py-3 ${dark ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-yellow-50 border border-yellow-200"}`}>
              <StatRow label="Gross Revenue" value={ugx(totalGross)} color="text-yellow-400" large noBorder/>
            </div>
          </>
        )}
      </div>
    );

  } else if (role === "MANAGER") {
    const creditApproved    = shiftArchived ? Number(latestShift.credit_approved     || 0) : 0;
    const creditRejected    = shiftArchived ? Number(latestShift.credit_rejected     || 0) : 0;
    const creditApprovedAmt = shiftArchived ? Number(latestShift.credit_approved_amt || 0) : 0;
    const dbPerm     = latestShift?.is_permitted;
    const wasPerm    = dbPerm === true || dbPerm === 1 || dbPerm === "t" || dbPerm === "true";
    const tookOrders = shiftArchived && (wasPerm || totalOrders > 0);

    content = shiftsLoading ? (
      <div className="flex items-center justify-center py-10">
        <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"/>
      </div>
    ) : (
      <div className="space-y-3">
        {!shiftArchived ? (
          <div className={`rounded-2xl border flex flex-col items-center justify-center py-8 gap-2 opacity-40 ${dark ? "border-white/5" : "border-zinc-200"}`}>
            <p className={`text-[11px] font-black uppercase tracking-widest ${dark ? "text-zinc-500" : "text-zinc-400"}`}>No shift ended yet today</p>
          </div>
        ) : (
          <>
            {tookOrders && (
              <div className={`rounded-2xl border overflow-hidden ${dark ? "border-white/5" : "border-zinc-200"}`}>
                <div className="px-4 pb-1 pt-3">
                  <StatRow label="Total Orders"  value={totalOrders}       color="text-white"/>
                  <StatRow label="Cash"          value={ugx(totalCash)}    color="text-emerald-400"/>
                  <StatRow label="Total Momo"    value={ugx(totalMomo)}    color="text-orange-400"/>
                  <StatRow label="Gross Revenue" value={ugx(totalGross)}   color="text-yellow-400" large/>
                </div>
              </div>
            )}
            <div className={`rounded-2xl border overflow-hidden ${dark ? "border-white/5" : "border-zinc-200"}`}>
              <div className="px-4 py-3 space-y-2">
                <StatRow label="Credits Approved" value={creditApproved} color="text-emerald-400"/>
                <StatRow label="Approved Amount" value={ugx(creditApprovedAmt)} color="text-emerald-400"/>
                <StatRow label="Credits Rejected" value={creditRejected} color="text-red-400"/>
              </div>
            </div>
          </>
        )}
      </div>
    );

  } else if (["CHEF", "BARISTA", "BARMAN"].includes(role)) {
    const stationMap = { CHEF: "kitchen", BARISTA: "barista", BARMAN: "barman" };
    const stn = stationMap[role];
    const stationTodayOrders = (orders || []).filter(o => {
      const d = new Date(new Date(o.created_at || o.timestamp || 0).toLocaleString("en-US", { timeZone: "Africa/Nairobi" })).toISOString().split("T")[0];
      return d === today;
    });
    const cnt = stationTodayOrders.filter(o =>
      (o.station || o.department || "").toLowerCase() === stn ||
      (Array.isArray(o.items) && o.items.some(i => (i.station || "").toLowerCase() === stn))
    ).length;

    content = (
      <div className="flex flex-col items-center justify-center py-6 gap-2">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${t.subtext}`}>{stn} orders today</p>
        <p className={`text-7xl font-black italic ${dark ? "text-white" : "text-zinc-900"}`}>{cnt}</p>
      </div>
    );

  } else if (role === "CASHIER") {
    content = shiftsLoading ? (
      <div className="flex items-center justify-center py-10">
        <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"/>
      </div>
    ) : (
      <div className={`rounded-2xl border overflow-hidden ${dark ? "border-white/5" : "border-zinc-200"}`}>
        <div className={`px-4 py-2.5 ${dark ? "bg-white/5" : "bg-zinc-50"}`}>
          <p className={`text-[8px] font-black uppercase tracking-[0.2em] ${t.subtext}`}>Final Shift Report — {today}</p>
        </div>
        {!shiftArchived ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 opacity-40">
            <p className={`text-[11px] font-black uppercase tracking-widest ${dark ? "text-zinc-500" : "text-zinc-400"}`}>Shift in progress</p>
            <p className={`text-[9px] font-bold uppercase tracking-widest ${dark ? "text-zinc-600" : "text-zinc-400"}`}>Final totals appear after cashier ends shift</p>
          </div>
        ) : (
          <>
            <div className="px-4 pb-1">
              <StatRow label="Total Collected" value={ugx(totalGross)} color="text-white"/>
              <StatRow label="Cash Payments"   value={ugx(totalCash)}  color="text-emerald-400"/>
              <StatRow label="Momo (MTN/Air)"  value={ugx(totalMomo)}  color="text-yellow-400"/>
              <StatRow label="Card/Visa"       value={ugx(totalCard)}  color="text-blue-400"/>
              <StatRow label="Petty Cash Out"  value={`- ${ugx(pettyCash)}`} color="text-rose-400"/>
            </div>
            <div className={`mx-3 mb-3 rounded-xl px-4 py-4 flex flex-col items-center justify-center ${dark ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-200"}`}>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${t.subtext}`}>Balance to Hand Over</p>
              <p className="text-2xl font-black italic text-emerald-400">{ugx(netCash)}</p>
            </div>
          </>
        )}
      </div>
    );

  } else if (role === "CONTENT-MANAGER") {
    content = <ContentManagerStats staffId={staff.id} today={today}/>;
  } else {
    content = <p className={`text-center py-8 text-[11px] italic ${t.subtext}`}>No analytics available.</p>;
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-xl flex items-end sm:items-center justify-center">
      <div className={`w-full sm:max-w-md sm:mx-4 rounded-t-[2rem] sm:rounded-[2rem] p-5 sm:p-8 shadow-2xl border max-h-[90dvh] flex flex-col ${dark ? "bg-zinc-900 border-white/10" : "bg-white border-zinc-200"}`}>
        <div className="flex justify-between items-start mb-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border ${dark ? "bg-zinc-800 border-white/5" : "bg-zinc-100 border-zinc-200"}`}>
              {staff.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="font-black uppercase text-sm">{staff.name}</p>
              <p className={`text-[9px] font-bold uppercase tracking-widest ${roleColors[role] || "text-zinc-400"}`}>{role}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors"><X size={15}/></button>
        </div>
        <div className="overflow-y-auto flex-1">{content}</div>
        <div className="mt-5 shrink-0">
          <button onClick={onClose} className="w-full py-3.5 bg-yellow-500 text-black font-black uppercase italic text-sm rounded-2xl active:scale-[0.98] transition-transform">Close</button>
        </div>
      </div>
    </div>
  );
}