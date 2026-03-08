import React, { useState, useEffect } from "react";
import {
  X, ShieldAlert, AlertTriangle,
  Package, Coffee, Wine,
  FileText, CalendarDays, BarChart2, BookOpen,
} from "lucide-react";
import { useTheme } from "./shared/ThemeContext";
import API_URL from "../../../config/api";

// ── MRow ──────────────────────────────────────────────────────────────────────
function MRow({ label, value, color, large }) {
  const { t } = useTheme();
  return (
    <div className="flex justify-between items-center gap-3">
      <span className={`text-[10px] font-bold uppercase tracking-wide shrink-0 ${t.subtext}`}>{label}</span>
      <span className={`${color} font-black text-right ${large ? "text-base italic" : "text-sm"}`}>{value}</span>
    </div>
  );
}

// ── ContentManagerStats ───────────────────────────────────────────────────────
function ContentManagerStats({ staffId, today }) {
  const { dark, t } = useTheme();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/content-manager/daily-stats?staffId=${staffId}&date=${today}`);
        if (!res.ok) throw new Error("Failed");
        setData(await res.json());
      } catch { setError("Could not load stats."); }
      finally { setLoading(false); }
    })();
  }, [staffId, today]);

  if (loading) return (
    <div className="flex flex-col items-center py-10 gap-3">
      <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      <p className={`text-[9px] font-bold uppercase tracking-widest ${t.subtext}`}>Loading…</p>
    </div>
  );
  if (error) return (
    <div className="flex flex-col items-center py-8 gap-2">
      <AlertTriangle size={22} className="text-rose-400" />
      <p className="text-[10px] font-bold uppercase text-rose-400">{error}</p>
    </div>
  );

  const items = [
    { label: "Total Menus",    value: data?.totalMenus    ?? 0, color: "text-fuchsia-400", bg: dark ? "bg-fuchsia-500/10" : "bg-fuchsia-50", icon: <FileText size={14} /> },
    { label: "Total Events",   value: data?.totalEvents   ?? 0, color: "text-yellow-400",  bg: dark ? "bg-yellow-500/10"  : "bg-yellow-50",  icon: <CalendarDays size={14} /> },
    { label: "Total Views",    value: (data?.totalViews   ?? 0).toLocaleString(), color: "text-blue-400", bg: dark ? "bg-blue-500/10" : "bg-blue-50", icon: <BarChart2 size={14} /> },
    { label: "Total Bookings", value: data?.totalBookings ?? 0, color: "text-emerald-400", bg: dark ? "bg-emerald-500/10" : "bg-emerald-50", icon: <BookOpen size={14} /> },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(({ label, value, color, bg, icon }) => (
        <div key={label} className={`border rounded-2xl p-4 flex flex-col gap-2
          ${dark ? "bg-zinc-800/50 border-white/5" : "bg-zinc-50 border-zinc-200"}`}>
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${bg} ${color}`}>{icon}</div>
          <p className={`text-[8px] font-black uppercase tracking-widest ${t.subtext}`}>{label}</p>
          <p className={`text-2xl font-black italic ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function StaffAnalyticsModal({ staff, stats, orders, onClose }) {
  const { dark, t } = useTheme();
  const role  = staff.role?.toUpperCase();
  const today = new Date().toISOString().split("T")[0];

  const todayOrders = (orders || []).filter(o => {
    const d = new Date(o.created_at || o.timestamp || 0).toISOString().split("T")[0];
    return d === today;
  });

  let content = null;

  if (["WAITER", "MANAGER", "SUPERVISOR"].includes(role)) {
    const my   = todayOrders.filter(o => o.staff_id === staff.id || o.waiter_id === staff.id);
    const cash = my.filter(o => o.payment_method === "CASH").reduce((s, o) => s + Number(o.total || 0), 0);
    const momo = my.filter(o => o.payment_method === "MOMO").reduce((s, o) => s + Number(o.total || 0), 0);
    const card = my.filter(o => o.payment_method === "CARD").reduce((s, o) => s + Number(o.total || 0), 0);
    content = (
      <div className="space-y-3">
        <MRow label="Total Orders Taken"  value={my.length} color="text-white" />
        <MRow label="Total Transactions"  value={my.filter(o => o.status === "PAID" || o.status === "CLOSED").length} color="text-emerald-400" />
        <div className={`border-t ${t.divider} pt-3 space-y-3`}>
          <MRow label="Total Cash" value={`UGX ${cash.toLocaleString()}`} color="text-emerald-400" />
          <MRow label="Total MoMo" value={`UGX ${momo.toLocaleString()}`} color="text-yellow-400" />
          <MRow label="Total Card" value={`UGX ${card.toLocaleString()}`} color="text-blue-400" />
        </div>
        <div className="border-t border-yellow-500/20 pt-3">
          <MRow label="Total Gross Income (Today)" value={`UGX ${(cash + momo + card).toLocaleString()}`} color="text-yellow-500" large />
        </div>
      </div>
    );

  } else if (["CHEF", "BARISTA", "BARMAN"].includes(role)) {
    const sm  = { CHEF: "kitchen", BARISTA: "barista", BARMAN: "bar" };
    const ic  = { CHEF: <Package size={22} />, BARISTA: <Coffee size={22} />, BARMAN: <Wine size={22} /> };
    const stn = sm[role];
    const cnt = todayOrders.filter(o =>
      (o.station || o.department || "").toLowerCase() === stn ||
      (Array.isArray(o.items) && o.items.some(i => (i.station || "").toLowerCase() === stn))
    ).length;
    content = (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <div className={`p-4 rounded-2xl ${dark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
          {ic[role]}
        </div>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${t.subtext}`}>Orders from {stn}</p>
        <p className={`text-6xl font-black italic ${dark ? "text-white" : "text-zinc-900"}`}>{cnt}</p>
        <p className={`text-xs ${t.subtext}`}>orders completed today</p>
      </div>
    );

  } else if (role === "CASHIER") {
    const confirmed = todayOrders.filter(o => o.cashier_id === staff.id || o.confirmed_by === staff.id);
    const allPaid   = todayOrders.filter(o => o.status === "PAID" || o.status === "CLOSED");
    const petty  = confirmed.filter(o => o.payment_method === "PETTY").reduce((s, o) => s + Number(o.total || 0), 0);
    const cash   = allPaid.filter(o => o.payment_method === "CASH").reduce((s, o) => s + Number(o.total || 0), 0);
    const momo   = allPaid.filter(o => o.payment_method === "MOMO").reduce((s, o) => s + Number(o.total || 0), 0);
    const card   = allPaid.filter(o => o.payment_method === "CARD").reduce((s, o) => s + Number(o.total || 0), 0);
    const credit = allPaid.filter(o => o.payment_method === "CREDIT").reduce((s, o) => s + Number(o.total || 0), 0);
    content = (
      <div className="space-y-3">
        <MRow label="Orders Confirmed & Closed"    value={confirmed.length}                color="text-emerald-400" />
        <MRow label="Total Petty Cash"             value={`UGX ${petty.toLocaleString()}`} color="text-zinc-300" />
        <div className={`border-t ${t.divider} pt-3 space-y-3`}>
          <MRow label="Cash at Hand" value={`UGX ${cash.toLocaleString()}`}  color="text-emerald-400" />
          <MRow label="Total MoMo"   value={`UGX ${momo.toLocaleString()}`}  color="text-yellow-400" />
          <MRow label="Total Card"   value={`UGX ${card.toLocaleString()}`}  color="text-blue-400" />
        </div>
        <div className={`border-t ${t.divider} pt-3 space-y-3`}>
          <MRow label="Total Gross"               value={`UGX ${(cash + momo + card).toLocaleString()}`} color="text-white" />
          <MRow label="Total Credit (On-Account)" value={`UGX ${credit.toLocaleString()}`}               color="text-rose-400" />
        </div>
      </div>
    );

  } else if (role === "ACCOUNTANT") {
    const paid = todayOrders.filter(o => o.status === "PAID" || o.status === "CLOSED");
    const cash = paid.filter(o => o.payment_method === "CASH").reduce((s, o) => s + Number(o.total || 0), 0);
    const momo = paid.filter(o => o.payment_method === "MOMO").reduce((s, o) => s + Number(o.total || 0), 0);
    const card = paid.filter(o => o.payment_method === "CARD").reduce((s, o) => s + Number(o.total || 0), 0);
    const exp  = cash + momo + card;
    const rep  = staff.reported_cash || cash;
    const v    = rep - exp;
    content = (
      <div className="space-y-3">
        <MRow label="Total Cash at Hand" value={`UGX ${cash.toLocaleString()}`} color="text-emerald-400" />
        <MRow label="Total MoMo"         value={`UGX ${momo.toLocaleString()}`} color="text-yellow-400" />
        <MRow label="Total Card"         value={`UGX ${card.toLocaleString()}`} color="text-blue-400" />
        <div className={`border-t ${t.divider} pt-3`}>
          <MRow label="System Expected" value={`UGX ${exp.toLocaleString()}`} color="text-white" />
        </div>
        <div className={`border-t pt-3 ${v === 0 ? "border-emerald-500/20" : "border-rose-500/20"}`}>
          <MRow
            label={`Variance (${v >= 0 ? "Surplus" : "Shortage"})`}
            value={`UGX ${Math.abs(v).toLocaleString()}`}
            color={v === 0 ? "text-emerald-400" : v > 0 ? "text-yellow-400" : "text-rose-400"}
            large
          />
          {v !== 0 && (
            <div className="flex items-center gap-1.5 mt-2 text-[9px] font-bold uppercase text-rose-400/70">
              <AlertTriangle size={9} /> Discrepancy — investigation required
            </div>
          )}
        </div>
      </div>
    );

  } else if (role === "CONTENT-MANAGER") {
    content = <ContentManagerStats staffId={staff.id} today={today} />;

  } else {
    content = (
      <div className="py-12 text-center">
        <ShieldAlert size={28} className="mx-auto text-zinc-600 mb-3" />
        <p className={`text-[10px] font-bold uppercase ${t.subtext}`}>No analytics for this role</p>
      </div>
    );
  }

  const roleColors = {
    WAITER: "text-emerald-400", MANAGER: "text-yellow-500", SUPERVISOR: "text-yellow-400",
    CHEF: "text-blue-400", BARISTA: "text-purple-400", BARMAN: "text-orange-400",
    CASHIER: "text-emerald-400", ACCOUNTANT: "text-rose-400", "CONTENT-MANAGER": "text-fuchsia-400",
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-xl flex items-end sm:items-center justify-center">
      <div className={`w-full sm:max-w-md sm:mx-4 rounded-t-[2rem] sm:rounded-[2rem] p-5 sm:p-8 shadow-2xl border
        max-h-[90dvh] flex flex-col
        ${dark ? "bg-zinc-900 border-white/10" : "bg-white border-zinc-200"}`}>

        {/* Drag handle */}
        <div className="sm:hidden flex justify-center mb-3 shrink-0">
          <div className="w-10 h-1 rounded-full bg-zinc-600" />
        </div>

        {/* Header */}
        <div className="flex justify-between items-start mb-5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border shrink-0
              ${dark ? "bg-zinc-800 border-white/5" : "bg-zinc-100 border-zinc-200"}`}>
              {staff.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <p className="font-black uppercase text-sm truncate">{staff.name}</p>
              <p className={`text-[9px] font-bold uppercase tracking-widest ${roleColors[role] || "text-zinc-400"}`}>{role}</p>
              <p className={`text-[8px] ${t.subtext}`}>{new Date().toDateString()} — Daily</p>
            </div>
          </div>
          <button onClick={onClose}
            className={`p-2 rounded-xl shrink-0 ml-2 ${dark ? "hover:bg-white/5 text-zinc-500" : "hover:bg-zinc-100 text-zinc-400"}`}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 min-h-0">{content}</div>

        <button onClick={onClose}
          className="mt-5 w-full py-3.5 bg-yellow-500 text-black font-black uppercase italic text-sm rounded-2xl hover:bg-yellow-400 transition-colors shrink-0">
          Close
        </button>
      </div>
    </div>
  );
}