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

  // ── Fetch + poll completed shift rows from staff_shifts ─────────────────
  // Polls every 8s so the director sees the archived row appear automatically
  // the moment a waiter ends their shift — no manual refresh needed.
  // When a shift_shifts row exists for this staff today, it means the shift
  // has been ended and the totals shown switch from live+DB to DB-only.
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
        // DEBUG — remove once confirmed working
        console.log(`[StaffAnalyticsModal] staff.id="${staff.id}" role="${role}" date="${today}" → ${res.status}`, data);
        if (res.ok && active) setShifts(data);
      } catch (e) { console.error("shifts fetch:", e); }
      if (isFirst) setShiftsLoading(false);
    };

    fetchShifts(true);
    // Poll every 8s — director sees shift-end reflected without refreshing
    const id = setInterval(() => fetchShifts(false), 8000);

    return () => { active = false; clearInterval(id); };
  }, [staff.id, role, today]);

  // ── Totals — ONLY from staff_shifts DB row, never from live orders ────────
  // This modal is a shift registry viewer, not a live monitor.
  // Rules:
  //   - No staff_shifts row today → shift not yet ended → show zeros + "No shift ended yet"
  //   - staff_shifts row exists   → show the archived snapshot from that row
  //   - Waiter starts a new shift (new orders appear, no new staff_shifts row yet) → zeros again
  // The poll above refetches every 8s so the director sees the row appear
  // automatically within 8s of the waiter ending their shift.
  const latestShift = shifts.length > 0 ? shifts[shifts.length - 1] : null;
  const shiftArchived = latestShift !== null;

  const totalOrders = shiftArchived ? Number(latestShift.total_orders || 0) : 0;
  const totalCash   = shiftArchived ? Number(latestShift.total_cash   || 0) : 0;
  const totalMTN    = shiftArchived ? Number(latestShift.total_mtn    || 0) : 0;
  const totalAirtel = shiftArchived ? Number(latestShift.total_airtel || 0) : 0;
  const totalCard   = shiftArchived ? Number(latestShift.total_card   || 0) : 0;
  const totalMomo   = totalMTN + totalAirtel;
  const totalGross  = shiftArchived ? Number(latestShift.gross_total  || 0) : 0;

  const ugx = n => `UGX ${Number(n || 0).toLocaleString()}`;

  const roleColors = {
    WAITER: "text-emerald-400", MANAGER: "text-yellow-500", SUPERVISOR: "text-yellow-400",
    CHEF: "text-blue-400", BARISTA: "text-purple-400", BARMAN: "text-orange-400",
    CASHIER: "text-emerald-400", ACCOUNTANT: "text-rose-400", "CONTENT-MANAGER": "text-fuchsia-400",
  };

  // ── Content by role ───────────────────────────────────────────────────────
  let content;

  if (role === "WAITER" || role === "SUPERVISOR") {
    content = shiftsLoading ? (
      <div className="flex items-center justify-center py-10">
        <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"/>
      </div>
    ) : (
      <div className={`rounded-2xl border overflow-hidden ${dark ? "border-white/5" : "border-zinc-200"}`}>
        <div className={`px-4 py-2.5 ${dark ? "bg-white/5" : "bg-zinc-50"}`}>
          <p className={`text-[8px] font-black uppercase tracking-[0.2em] ${t.subtext}`}>
            Daily Summary — {today}
          </p>
        </div>
        {!shiftArchived ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 opacity-40">
            <p className={`text-[11px] font-black uppercase tracking-widest ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
              No shift ended yet today
            </p>
            <p className={`text-[9px] font-bold uppercase tracking-widest ${dark ? "text-zinc-600" : "text-zinc-400"}`}>
              Totals appear here after staff ends shift
            </p>
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
    // Manager modal — two sections:
    // 1. Order totals (only meaningful if they took orders today — gross > 0 or orders > 0)
    // 2. Credit decisions (always shown — this is the manager's core daily activity)
    const creditApproved    = shiftArchived ? Number(latestShift.credit_approved     || 0) : 0;
    const creditRejected    = shiftArchived ? Number(latestShift.credit_rejected     || 0) : 0;
    const creditApprovedAmt = shiftArchived ? Number(latestShift.credit_approved_amt || 0) : 0;
    // is_permitted comes from staff_shifts row (backend queried staff table on end-shift).
    // Coerce safely — DB may return boolean, 1/0, or "t"/"f".
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
            <p className={`text-[11px] font-black uppercase tracking-widest ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
              No shift ended yet today
            </p>
            <p className={`text-[9px] font-bold uppercase tracking-widest ${dark ? "text-zinc-600" : "text-zinc-400"}`}>
              Totals appear here after manager ends shift
            </p>
          </div>
        ) : (
          <>
            {/* Order section — only if manager took orders (permitted day) */}
            {tookOrders && (
              <div className={`rounded-2xl border overflow-hidden ${dark ? "border-white/5" : "border-zinc-200"}`}>
                <div className={`px-4 py-2.5 ${dark ? "bg-white/5" : "bg-zinc-50"}`}>
                  <p className={`text-[8px] font-black uppercase tracking-[0.2em] ${t.subtext}`}>Orders — {today}</p>
                </div>
                <div className="px-4 pb-1">
                  <StatRow label="Total Orders"  value={totalOrders}       color="text-white"/>
                  <StatRow label="Cash"          value={ugx(totalCash)}    color="text-emerald-400"/>
                  <StatRow label="MTN Momo"      value={ugx(totalMTN)}     color="text-yellow-400"/>
                  <StatRow label="Airtel Momo"   value={ugx(totalAirtel)}  color="text-red-400"/>
                  <StatRow label="Card"          value={ugx(totalCard)}    color="text-blue-400"/>
                </div>
                <div className={`mx-3 mb-3 rounded-xl px-4 py-3 ${dark ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-yellow-50 border border-yellow-200"}`}>
                  <StatRow label="Gross Revenue" value={ugx(totalGross)} color="text-yellow-400" large noBorder/>
                </div>
              </div>
            )}

            {/* Credit decisions section — always shown */}
            <div className={`rounded-2xl border overflow-hidden ${dark ? "border-white/5" : "border-zinc-200"}`}>
              <div className={`px-4 py-2.5 ${dark ? "bg-white/5" : "bg-zinc-50"}`}>
                <p className={`text-[8px] font-black uppercase tracking-[0.2em] ${t.subtext}`}>Credit Decisions — {today}</p>
              </div>
              <div className="px-4 pb-3 pt-1 space-y-1">
                {/* Approved */}
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${dark ? "bg-emerald-500/5 border-emerald-500/15" : "bg-emerald-50 border-emerald-200"}`}>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <span className="text-[9px] font-black uppercase tracking-widest">✓ Credits Approved</span>
                  </div>
                  <span className="font-black text-lg text-emerald-400">{creditApproved}</span>
                </div>
                {/* Approved amount */}
                {creditApproved > 0 && (
                  <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${dark ? "bg-white/3 border-white/5" : "bg-zinc-100 border-zinc-200"}`}>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${t.subtext}`}>Total Credit Amount</span>
                    <span className="font-black text-sm text-emerald-400">{ugx(creditApprovedAmt)}</span>
                  </div>
                )}
                {/* Rejected */}
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${dark ? "bg-red-500/5 border-red-500/15" : "bg-red-50 border-red-200"}`}>
                  <div className="flex items-center gap-2 text-red-400">
                    <span className="text-[9px] font-black uppercase tracking-widest">✕ Credits Rejected</span>
                  </div>
                  <span className="font-black text-lg text-red-400">{creditRejected}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );

  } else if (["CHEF", "BARISTA", "BARMAN"].includes(role)) {
    const stationMap = { CHEF: "kitchen", BARISTA: "barista", BARMAN: "barman" };
    const stn = stationMap[role];
    // Station roles don't end shifts — count today's orders directly from orders[]
    const stationTodayOrders = (orders || []).filter(o => {
      const d = new Date(
        new Date(o.created_at || o.timestamp || 0)
          .toLocaleString("en-US", { timeZone: "Africa/Nairobi" })
      ).toISOString().split("T")[0];
      return d === today;
    });
    const cnt = stationTodayOrders.filter(o =>
      (o.station || o.department || "").toLowerCase() === stn ||
      (Array.isArray(o.items) && o.items.some(i => (i.station || "").toLowerCase() === stn))
    ).length;

    content = (
      <div className="flex flex-col items-center justify-center py-6 gap-2">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${t.subtext}`}>
          {stn} orders today
        </p>
        <p className={`text-7xl font-black italic ${dark ? "text-white" : "text-zinc-900"}`}>{cnt}</p>
        <p className={`text-[9px] font-bold uppercase tracking-widest ${t.subtext}`}>{today}</p>
      </div>
    );

  } else if (role === "CASHIER") {
    const cashierTodayOrders = (orders || []).filter(o => {
      const d = new Date(
        new Date(o.created_at || o.timestamp || 0)
          .toLocaleString("en-US", { timeZone: "Africa/Nairobi" })
      ).toISOString().split("T")[0];
      return d === today;
    });
    const paidOrders = cashierTodayOrders.filter(o => ["PAID","CLOSED","Paid","Closed"].includes(o.status));
    const cash = paidOrders.filter(o => (o.payment_method||"").toUpperCase() === "CASH")
      .reduce((s,o) => s + Number(o.total||0), 0);

    content = (
      <div className={`rounded-2xl border overflow-hidden ${dark ? "border-white/5" : "border-zinc-200"}`}>
        <div className="px-4 pb-1 pt-3">
          <StatRow label="Cash at Hand" value={ugx(cash)} color="text-emerald-400" large/>
        </div>
      </div>
    );

  } else if (role === "CONTENT-MANAGER") {
    content = <ContentManagerStats staffId={staff.id} today={today}/>;

  } else {
    content = (
      <p className={`text-center py-8 text-[11px] italic ${t.subtext}`}>
        No analytics available for this role.
      </p>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-xl flex items-end sm:items-center justify-center">
      <div className={`w-full sm:max-w-md sm:mx-4 rounded-t-[2rem] sm:rounded-[2rem] p-5 sm:p-8 shadow-2xl border
        max-h-[90dvh] flex flex-col ${dark ? "bg-zinc-900 border-white/10" : "bg-white border-zinc-200"}`}>

        {/* Header */}
        <div className="flex justify-between items-start mb-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border
              ${dark ? "bg-zinc-800 border-white/5" : "bg-zinc-100 border-zinc-200"}`}>
              {staff.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="font-black uppercase text-sm">{staff.name}</p>
              <p className={`text-[9px] font-bold uppercase tracking-widest ${roleColors[role] || "text-zinc-400"}`}>{role}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
            <X size={15}/>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">{content}</div>

        {/* Footer */}
        <div className="mt-5 shrink-0">
          <button onClick={onClose}
            className="w-full py-3.5 bg-yellow-500 text-black font-black uppercase italic text-sm rounded-2xl active:scale-[0.98] transition-transform">
            Close
          </button>
        </div>

      </div>
    </div>
  );
}