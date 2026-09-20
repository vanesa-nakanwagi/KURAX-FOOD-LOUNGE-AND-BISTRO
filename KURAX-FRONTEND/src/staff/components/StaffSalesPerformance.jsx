import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, RefreshCw, ShieldAlert, Users } from "lucide-react";
import { useData } from "../../customer/components/context/DataContext";
import API_URL from "../../config/api";

const REPORT_ROLES = ["DIRECTOR", "MANAGER", "SUPERVISOR"];
const STAFF_ROLES = ["", "MANAGER", "SUPERVISOR", "WAITER"];

function dateString(date) {
  return date.toLocaleDateString("en-CA");
}

function getRange(preset) {
  const today = new Date();
  const todayString = dateString(today);
  if (preset === "today") return { startDate: todayString, endDate: todayString };
  if (preset === "yesterday") {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const value = dateString(yesterday);
    return { startDate: value, endDate: value };
  }
  if (preset === "week") {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    return { startDate: dateString(start), endDate: todayString };
  }
  if (preset === "month") {
    return { startDate: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`, endDate: todayString };
  }
  return { startDate: todayString, endDate: todayString };
}

function formatMoney(value) {
  return `UGX ${Number(value || 0).toLocaleString()}`;
}

function MetricCard({ label, value, accent }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">{label}</p>
      <p className="mt-3 text-2xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function BarList({ title, rows, valueKey, formatter }) {
  const max = Math.max(...rows.map(row => Number(row[valueKey] || 0)), 1);
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-700">
        <BarChart3 size={15} className="text-yellow-600" /> {title}
      </h3>
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-zinc-400">No data for this period.</p>}
        {rows.map(row => (
          <div key={row.staff_id || row.staff_name}>
            <div className="mb-1 flex justify-between gap-3 text-xs">
              <span className="truncate font-semibold text-zinc-700">{row.staff_name}</span>
              <span className="shrink-0 font-bold text-zinc-500">{formatter(row[valueKey])}</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100">
              <div className="h-2 rounded-full bg-yellow-500 transition-all" style={{ width: `${(Number(row[valueKey] || 0) / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function StaffSalesPerformance({ role: roleProp }) {
  const { currentUser } = useData();
  const role = (roleProp || currentUser?.role || JSON.parse(localStorage.getItem("kurax_user") || "{}").role || "").toUpperCase();
  const [preset, setPreset] = useState("today");
  const [customStart, setCustomStart] = useState(dateString(new Date()));
  const [customEnd, setCustomEnd] = useState(dateString(new Date()));
  const [staffId, setStaffId] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [staffDirectory, setStaffDirectory] = useState([]);
  const [report, setReport] = useState(null);
  const [today, setToday] = useState(null);
  const [month, setMonth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const range = useMemo(() => preset === "custom"
    ? { startDate: customStart, endDate: customEnd }
    : getRange(preset), [preset, customStart, customEnd]);

  useEffect(() => {
    if (!REPORT_ROLES.includes(role)) return;
    fetch(`${API_URL}/api/staff/performance-list`)
      .then(response => response.ok ? response.json() : [])
      .then(data => setStaffDirectory(data.filter(staff => REPORT_ROLES.includes(staff.role) || staff.role === "WAITER")))
      .catch(() => setStaffDirectory([]));
  }, [role]);

  useEffect(() => {
    if (!REPORT_ROLES.includes(role)) return;
    let cancelled = false;
    const query = filters => new URLSearchParams(filters).toString();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const currentMonth = getRange("month");
        const selectedFilters = { ...range, staffId, role: staffRole, paymentStatus };
        const [selectedResponse, todayResponse, monthResponse] = await Promise.all([
          fetch(`${API_URL}/api/manager/staff-sales-performance?${query(selectedFilters)}`),
          fetch(`${API_URL}/api/manager/staff-sales-performance?${query({ ...getRange("today"), paymentStatus })}`),
          fetch(`${API_URL}/api/manager/staff-sales-performance?${query({ ...currentMonth, paymentStatus })}`)
        ]);
        if (!selectedResponse.ok || !todayResponse.ok || !monthResponse.ok) throw new Error("Unable to load performance data");
        const [selectedData, todayData, monthData] = await Promise.all([
          selectedResponse.json(), todayResponse.json(), monthResponse.json()
        ]);
        if (!cancelled) {
          setReport(selectedData);
          setToday(todayData);
          setMonth(monthData);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [role, range, staffId, staffRole, paymentStatus]);

  if (!REPORT_ROLES.includes(role)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-800">
          <ShieldAlert className="mx-auto mb-3" />
          <h2 className="font-black uppercase tracking-wide">Restricted report</h2>
          <p className="mt-2 text-sm">Staff sales performance is available to Directors, Managers, and Supervisors only.</p>
        </div>
      </div>
    );
  }

  const selectedRows = report?.staff || [];
  const dailyRows = report?.daily || [];
  const dailyStaffRows = useMemo(() => {
    const totals = new Map();
    dailyRows.forEach(day => Object.entries(day.staff || {}).forEach(([name, sales]) => {
      totals.set(name, (totals.get(name) || 0) + Number(sales || 0));
    }));
    return Array.from(totals, ([staff_name, total_sales]) => ({ staff_name, total_sales }));
  }, [dailyRows]);

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-6 w-1 rounded-full bg-yellow-500" />
            <p className="text-xl font-semibold uppercase tracking-[0.14em] text-yellow-900">Staff Sales Performance</p>
          </div>
          <p className="text-sm text-zinc-500">Sales and orders handled by Managers, Supervisors, and Waiters.</p>
        </div>
        <button onClick={() => window.location.reload()} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-zinc-700">
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">Loading staff performance...</div>}

      {!loading && report && <>
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Today's orders" value={today?.summary?.total_orders || 0} accent="border-yellow-200 bg-yellow-50 text-yellow-950" />
          <MetricCard label="Today's sales" value={formatMoney(today?.summary?.total_sales)} accent="border-emerald-200 bg-emerald-50 text-emerald-950" />
          <MetricCard label="Monthly orders" value={month?.summary?.total_orders || 0} accent="border-blue-200 bg-blue-50 text-blue-950" />
          <MetricCard label="Monthly sales" value={formatMoney(month?.summary?.total_sales)} accent="border-orange-200 bg-orange-50 text-orange-950" />
        </section>

        <section className="grid grid-cols-1 gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Period
            <select value={preset} onChange={event => setPreset(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 p-2.5 text-sm font-semibold normal-case tracking-normal outline-none focus:border-yellow-500">
              <option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">This week</option><option value="month">This month</option><option value="custom">Custom range</option>
            </select>
          </label>
          {preset === "custom" && <>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Start date<input type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 p-2.5 text-sm normal-case tracking-normal" /></label>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">End date<input type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 p-2.5 text-sm normal-case tracking-normal" /></label>
          </>}
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Staff member
            <select value={staffId} onChange={event => setStaffId(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 p-2.5 text-sm font-semibold normal-case tracking-normal"><option value="">All staff</option>{staffDirectory.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}</select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Role
            <select value={staffRole} onChange={event => setStaffRole(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 p-2.5 text-sm font-semibold normal-case tracking-normal">{STAFF_ROLES.map(value => <option key={value} value={value}>{value || "All roles"}</option>)}</select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Payment status
            <select value={paymentStatus} onChange={event => setPaymentStatus(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 p-2.5 text-sm font-semibold normal-case tracking-normal"><option value="all">All statuses</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="credit">Credit</option></select>
          </label>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <BarList title="Daily sales by staff" rows={dailyStaffRows} valueKey="total_sales" formatter={formatMoney} />
          <BarList title="Monthly sales by staff" rows={month?.staff || []} valueKey="total_sales" formatter={formatMoney} />
          <BarList title="Orders handled by staff" rows={month?.staff || []} valueKey="orders_count" formatter={value => Number(value || 0).toLocaleString()} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 p-5">
            <div><h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-zinc-800"><Users size={16} className="text-yellow-600" /> Staff performance</h2><p className="mt-1 text-xs text-zinc-500">{range.startDate} to {range.endDate} · {report.summary.total_orders} orders · {formatMoney(report.summary.total_sales)}</p></div>
            <CalendarDays size={18} className="text-zinc-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm"><thead className="bg-zinc-50 text-[10px] uppercase tracking-widest text-zinc-500"><tr><th className="px-5 py-3">Staff</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Orders</th><th className="px-5 py-3">Total sales</th><th className="px-5 py-3">Average/day</th><th className="px-5 py-3">Payment breakdown</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">{selectedRows.map(row => <tr key={row.staff_id || row.staff_name} className="hover:bg-yellow-50/40"><td className="px-5 py-4 font-bold text-zinc-800">{row.staff_name}</td><td className="px-5 py-4 text-xs font-semibold text-zinc-500">{row.role}</td><td className="px-5 py-4 font-bold">{row.orders_count}</td><td className="px-5 py-4 font-black text-yellow-700">{formatMoney(row.total_sales)}</td><td className="px-5 py-4 text-zinc-600">{formatMoney(row.average_sales_per_day)}</td><td className="px-5 py-4 text-xs text-zinc-500">{Object.entries(row.payment_breakdown).map(([method, count]) => `${method}: ${count}`).join(" · ") || "No orders"}</td></tr>)}{selectedRows.length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-zinc-400">No staff sales found for the selected filters.</td></tr>}</tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm"><h2 className="mb-4 text-sm font-black uppercase tracking-[0.14em] text-zinc-800">Daily breakdown</h2><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{dailyRows.map(day => <div key={day.date} className="rounded-xl bg-zinc-50 p-4"><p className="text-xs font-bold text-zinc-500">{day.date}</p><p className="mt-2 font-black text-zinc-900">{formatMoney(day.total_sales)}</p><p className="text-xs text-zinc-500">{day.orders_count} orders</p></div>)}</div></section>
      </>}
    </div>
  );
}
