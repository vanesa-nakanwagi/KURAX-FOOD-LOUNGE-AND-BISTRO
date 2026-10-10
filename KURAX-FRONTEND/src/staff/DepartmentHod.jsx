import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Boxes, Check, ChefHat, ClipboardList, CircleDollarSign, Coffee, Download, LogOut, RefreshCw, Users, Wine } from 'lucide-react';
import API_URL from '../config/api';
import { downloadReportPdf } from './reportExport';
import DepartmentInventory from './DepartmentInventory';

const DEPARTMENTS = {
  kitchen: { label: 'Kitchen', title: 'Kitchen station', role: 'KITCHEN_HOD', station: 'kitchen', workerRole: 'CHEF', icon: ChefHat },
  bar: { label: 'Bar', title: 'Bar station', role: 'BAR_HOD', station: 'barman', workerRole: 'BARMAN', icon: Wine },
  barista: { label: 'Barista', title: 'Barista station', role: 'BARISTA_HOD', station: 'barista', workerRole: 'BARISTA', icon: Coffee },
};
const PRESETS = ['Today', 'Yesterday', 'This Week', 'This Month', 'Select Month', 'Custom'];

function kampalaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
}

function datesFor(preset) {
  const today = kampalaToday();
  const cursor = new Date(`${today}T12:00:00Z`);
  if (preset === 'Yesterday') {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const yesterday = cursor.toISOString().slice(0, 10);
    return [yesterday, yesterday];
  }
  if (preset === 'This Week') {
    cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
    return [cursor.toISOString().slice(0, 10), today];
  }
  if (preset === 'This Month') return [`${today.slice(0, 7)}-01`, today];
  return [today, today];
}

function datesForMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = String(new Date(year, monthNumber, 0).getDate()).padStart(2, '0');
  return [`${month}-01`, `${month}-${lastDay}`];
}

function money(value) {
  return `UGX ${Number(value || 0).toLocaleString()}`;
}

function readSession() {
  try { return JSON.parse(localStorage.getItem('kurax_user') || 'null'); }
  catch { return null; }
}

async function request(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `${response.status} ${response.statusText || 'HTTP error'} for ${path}`);
  return data;
}

export default function DepartmentHod({ department: departmentKey = 'all', embedded = false, initialRange = null }) {
  const navigate = useNavigate();
  const [session] = useState(readSession);
  const [staff, setStaff] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [assignmentQueue, setAssignmentQueue] = useState([]);
  const [assignmentQueueError, setAssignmentQueueError] = useState('');
  const [assignmentSelections, setAssignmentSelections] = useState({});
  const [assigningOrderId, setAssigningOrderId] = useState(null);
  const [report, setReport] = useState(null);
  const [preset, setPreset] = useState(() => initialRange ? 'Custom' : 'Today');
  const [reportMonth, setReportMonth] = useState(() => kampalaToday().slice(0, 7));
  const [[from, to], setRange] = useState(() => initialRange?.start && initialRange?.end ? [initialRange.start, initialRange.end] : datesFor('Today'));
  const [form, setForm] = useState({ name: '', email: '', pin: '' });
  const [tab, setTab] = useState(departmentKey === 'all' ? 'reports' : 'orders');
  const [ticketView, setTicketView] = useState('active');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (initialRange?.start && initialRange?.end) {
      setRange([initialRange.start, initialRange.end]);
      setPreset('Custom');
    }
  }, [initialRange?.start, initialRange?.end]);
  const config = DEPARTMENTS[departmentKey];
  const DepartmentIcon = config?.icon || ClipboardList;
  const role = String(session?.role || '').toUpperCase();
  const isManagement = departmentKey === 'all';
  const allowed = isManagement
    ? ['DIRECTOR', 'MANAGER', 'ACCOUNTANT'].includes(session?.role)
    : session?.role === config?.role;

  useEffect(() => {
    if (!session?.token || !allowed) return undefined;
    let mounted = true;
    const load = async () => {
      if (isManagement && mounted) setReportLoading(true);
      try {
        const query = new URLSearchParams({ from, to });
        if (isManagement) {
          query.set('summary_only', 'true');
          const data = await request(`/api/departments/reports/consolidated?${query}`, session.token);
          if (mounted) setReport(data);
        } else {
          const [staffRows, reportData, queueResult, ticketResponse] = await Promise.all([
            request(`/api/departments/${departmentKey}/staff`, session.token),
            request(`/api/departments/${departmentKey}/reports?${query}`, session.token),
            request(`/api/departments/${departmentKey}/assignment-queue`, session.token)
              .then(data => ({ data, error: '' }))
              .catch(queueError => ({ data: [], error: queueError.message })),
            fetch(`${API_URL}/api/${config.station}/tickets?date=${kampalaToday()}`),
          ]);
          const ticketRows = ticketResponse.ok ? await ticketResponse.json() : [];
          if (mounted) {
            setStaff(staffRows);
            setReport(reportData);
            setAssignmentQueue(queueResult.data);
            setAssignmentQueueError(queueResult.error);
            setTickets(Array.isArray(ticketRows) ? ticketRows : []);
          }
        }
        if (mounted) setError('');
      } catch (loadError) {
        if (mounted) setError(loadError.message);
      } finally {
        if (isManagement && mounted) setReportLoading(false);
      }
    };
    load();
    const timer = isManagement ? null : window.setInterval(load, 12000);
    return () => { mounted = false; if (timer) window.clearInterval(timer); };
  }, [session?.token, allowed, departmentKey, from, to, refreshCounter]);

  function choosePreset(nextPreset) {
    setPreset(nextPreset);
    if (nextPreset === 'Select Month') setRange(datesForMonth(reportMonth));
    else if (nextPreset !== 'Custom') setRange(datesFor(nextPreset));
  }

  function downloadDepartmentReport() {
    if (!report || report.from !== from || report.to !== to) return;
    downloadReportPdf({
      filename: `${departmentKey}-report-${from}-to-${to}.pdf`,
      title: `${config.label} Department Report`,
      from: report.from,
      to: report.to,
      sections: [
        {
          title: 'Summary',
          columns: ['Metric', 'Value'],
          rows: [
            ['Orders', report.summary?.total_orders ?? 0],
            ['Sales', money(report.summary?.total_sales)],
            ['COGS', money(report.summary?.cogs)],
            ['Gross profit', money(report.summary?.gross_profit)],
            ['Inventory consumption', money(report.summary?.consumption_value)],
            ['Waste', money(report.summary?.waste)],
            ['Collected', money(report.summary?.amount_collected)],
            ['Outstanding', money(report.summary?.outstanding_balance)],
          ],
        },
        {
          title: 'Menu items',
          columns: ['Menu item', 'Quantity', 'Sales'],
          rows: (report.menu_items || []).map(item => [item.menu_item, item.quantity, money(item.sales)]),
        },
        {
          title: 'Inventory usage',
          columns: ['Ingredient', 'Quantity', 'Value'],
          rows: (report.inventory_usage || []).map(item => [item.item_name, `${item.quantity} ${item.unit}`, money(item.value)]),
        },
        {
          title: `Sales by ${config.workerRole.toLowerCase()}`,
          columns: ['Staff member', 'Items assigned', 'Completed items', 'Sales'],
          rows: (report.staff_performance || []).map(person => [person.staff_name, person.items_assigned, person.completed_items, money(person.total_sales)]),
        },
      ],
    });
  }

  async function downloadConsolidatedReport() {
    if (!report || report.from !== from || report.to !== to) return;
    setDownloadingPdf(true);
    setError('');
    try {
      const query = new URLSearchParams({ from, to });
      const fullReport = await request(`/api/departments/reports/consolidated?${query}`, session.token);
      const departments = fullReport.departments || [];
      const totals = fullReport.main_totals || departments.reduce((result, department) => ({
        total_orders: result.total_orders + Number(department.total_orders || 0),
        total_sales: result.total_sales + Number(department.total_sales || 0),
        cogs: result.cogs + Number(department.cogs || 0),
        gross_profit: result.gross_profit + Number(department.gross_profit || 0),
        consumption_value: result.consumption_value + Number(department.consumption_value || 0),
        waste: result.waste + Number(department.waste || 0),
        amount_collected: result.amount_collected + Number(department.amount_collected || 0),
        outstanding_balance: result.outstanding_balance + Number(department.outstanding_balance || 0),
        partially_paid_credit_count: result.partially_paid_credit_count + Number(department.partially_paid_credit_count || 0),
        partially_paid_credit_amount: result.partially_paid_credit_amount + Number(department.partially_paid_credit_amount || 0),
        settled_credit_count: result.settled_credit_count + Number(department.settled_credit_count || 0),
        settled_credit_amount: result.settled_credit_amount + Number(department.settled_credit_amount || 0),
        outstanding_credit_count: result.outstanding_credit_count + Number(department.outstanding_credit_count || 0),
        outstanding_credit_balance: result.outstanding_credit_balance + Number(department.outstanding_credit_balance || 0),
      }), { total_orders: 0, total_sales: 0, cogs: 0, gross_profit: 0, consumption_value: 0, waste: 0, amount_collected: 0, outstanding_balance: 0, partially_paid_credit_count: 0, partially_paid_credit_amount: 0, settled_credit_count: 0, settled_credit_amount: 0, outstanding_credit_count: 0, outstanding_credit_balance: 0 });
      const staffPerformance = departments.flatMap(department => (department.staff_performance || []).map(person => [
        department.label,
        String(person.worker_role || '').replaceAll('_', ' '),
        person.staff_name,
        person.items_assigned,
        person.completed_items,
        money(person.total_sales),
      ]));

      downloadReportPdf({
        filename: `department-report-${from}-to-${to}.pdf`,
        title: 'Department Sales Report',
        from: fullReport.from,
        to: fullReport.to,
        sections: [
        {
          title: 'Main department totals',
          columns: ['Metric', 'Value'],
          rows: [
            ['Orders', totals.total_orders],
            ['Sales', money(totals.total_sales)],
            ['COGS', money(totals.cogs)],
            ['Gross profit', money(totals.gross_profit)],
            ['Inventory consumption', money(totals.consumption_value)],
            ['Waste', money(totals.waste)],
            ['Partially paid credits', `${totals.partially_paid_credit_count} · ${money(totals.partially_paid_credit_amount)}`],
            ['Settled credits', `${totals.settled_credit_count} · ${money(totals.settled_credit_amount)}`],
            ['Outstanding credits', `${totals.outstanding_credit_count} · ${money(totals.outstanding_credit_balance)}`],
          ],
        },
        {
          title: 'Main departments',
          columns: ['Department', 'Orders', 'Sales', 'Collected', 'Outstanding', 'Partial credits', 'Settled credits', 'Credit balance'],
          rows: [
            ...departments.map(department => [department.label, department.total_orders, money(department.total_sales), money(department.amount_collected), money(department.outstanding_balance), `${department.partially_paid_credit_count} · ${money(department.partially_paid_credit_amount)}`, `${department.settled_credit_count} · ${money(department.settled_credit_amount)}`, `${department.outstanding_credit_count} · ${money(department.outstanding_credit_balance)}`]),
            ['Total main departments', totals.total_orders, money(totals.total_sales), money(totals.amount_collected), money(totals.outstanding_balance), `${totals.partially_paid_credit_count} · ${money(totals.partially_paid_credit_amount)}`, `${totals.settled_credit_count} · ${money(totals.settled_credit_amount)}`, `${totals.outstanding_credit_count} · ${money(totals.outstanding_credit_balance)}`],
          ],
        },
        {
          title: 'Menu items by department',
          columns: ['Department', 'Menu item', 'Quantity', 'Sales'],
          rows: departments.flatMap(department => (department.menu_items || []).map(item => [department.label, item.menu_item, item.quantity, money(item.sales)])),
        },
        {
          title: 'Inventory usage by department',
          columns: ['Department', 'Ingredient', 'Quantity', 'Value'],
          rows: departments.flatMap(department => (department.inventory_usage || []).map(item => [department.label, item.item_name, `${item.quantity} ${item.unit}`, money(item.value)])),
        },
        {
          title: 'Sales by department staff',
          columns: ['Department', 'Role', 'Staff member', 'Handled', 'Completed', 'Sales'],
          rows: staffPerformance,
        },
        ],
      });
    } catch (downloadError) {
      setError(downloadError.message || 'Could not download department report.');
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function addStaff(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request(`/api/departments/${departmentKey}/staff`, session.token, { method: 'POST', body: form });
      setForm({ name: '', email: '', pin: '' });
      setMessage('Department account created.');
      setStaff(await request(`/api/departments/${departmentKey}/staff`, session.token));
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleStaff(member) {
    setBusy(true);
    setError('');
    try {
      const updated = await request(`/api/departments/${departmentKey}/staff/${member.id}`, session.token, {
        method: 'PATCH', body: { is_active: !member.is_active },
      });
      setStaff(rows => rows.map(row => row.id === updated.id ? updated : row));
      setMessage(updated.is_active ? 'Account activated.' : 'Account deactivated.');
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy(false);
    }
  }

  async function assignOrder(order) {
    const staffId = assignmentSelections[order.id];
    if (!staffId) {
      setError(`Select a ${config.workerRole} before dispatching this order.`);
      return;
    }
    setAssigningOrderId(order.id);
    setError('');
    setMessage('');
    try {
      const result = await request(`/api/departments/${departmentKey}/orders/${order.id}/assign`, session.token, {
        method: 'POST', body: { staff_id: Number(staffId) },
      });
      setMessage(`Order #${order.id} assigned to ${result.assigned_to} and sent to ${config.label}.`);
      setAssignmentSelections(current => ({ ...current, [order.id]: '' }));
      setRefreshCounter(value => value + 1);
    } catch (assignError) {
      setError(assignError.message);
    } finally {
      setAssigningOrderId(null);
    }
  }

  function signOut() {
    localStorage.removeItem('kurax_user');
    navigate('/staff/login');
  }

  if (!session?.token) return <main className="min-h-screen bg-white p-8 text-black">Sign in to continue.</main>;
  if (!allowed) return <main className="min-h-screen bg-white p-8 text-black">This account cannot access this department.</main>;

  const departments = report?.departments || [];
  const summary = report?.summary || {};
  const assignedTickets = tickets.filter(ticket => (ticket.items || []).some(item => item.assignedTo));
  const activeTickets = assignedTickets.filter(ticket => !['Ready', 'Served', 'Paid', 'Closed'].includes(ticket.status));
  const visibleTickets = ticketView === 'completed'
    ? assignedTickets.filter(ticket => ['Ready', 'Served', 'Paid', 'Closed'].includes(ticket.status))
    : activeTickets;
  const tabs = isManagement ? [['reports', 'Department reports', CircleDollarSign]] : [
    ['orders', 'Orders', ClipboardList], ['team', 'Team', Users], ['inventory', 'Inventory', Boxes], ['reports', 'Reports', CircleDollarSign],
  ];

  return (
    <main className={`min-h-screen ${isManagement ? 'bg-white text-black' : 'bg-[#f4f3ef] text-zinc-900'}`}>
      {!isManagement ? (
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-8">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-amber-300"><DepartmentIcon size={21} /></span><div><p className="text-xs font-black uppercase tracking-[0.18em]">Kurax · Internal</p><p className="text-xs text-zinc-500">{config.label} Department</p></div></div>
            <div className="flex items-center gap-3"><span className="hidden text-right sm:block"><span className="block text-sm font-bold">{session.name}</span><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{role.replaceAll('_', ' ')}</span></span><button onClick={() => setRefreshCounter(value => value + 1)} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"><RefreshCw size={15} /> Refresh</button><button onClick={signOut} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"><LogOut size={15} /> Sign out</button></div>
          </div>
        </header>
      ) : (
        <header className={`${embedded ? '' : 'sticky top-0 z-30'} border-b border-yellow-500 bg-yellow-500 text-black`}>
          <div className="mx-auto flex w-full items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <div><p className="text-xs font-black uppercase tracking-[0.2em]">Kurax Operations</p><h1 className="mt-1 text-2xl font-black">Department reporting</h1></div>
            <div className="flex items-center gap-3 text-sm"><span className="hidden sm:block">{session.name}</span>{isManagement && <button type="button" onClick={() => setRefreshCounter(value => value + 1)} disabled={reportLoading} className="inline-flex items-center gap-2 rounded-md border border-black/20 px-3 py-2 text-xs font-bold hover:bg-black/10 disabled:opacity-50"><RefreshCw size={14} className={reportLoading ? 'animate-spin' : ''} /> Refresh</button>}{!embedded && <button title="Sign out" onClick={signOut} className="rounded-md border border-black/20 p-2 hover:bg-black/10"><LogOut size={18} /></button>}</div>
          </div>
        </header>
      )}
      {!isManagement && <div className="mx-auto mb-6 flex max-w-[1440px] flex-col justify-between gap-4 px-5 pt-6 sm:flex-row sm:items-end md:px-8"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Department control</p><h1 className="mt-1 text-3xl font-black tracking-tight">{config.title}</h1></div><div className="text-xs font-medium text-zinc-500">Connected to restaurant orders and waiter updates</div></div>}
      <div className={`mx-auto ${isManagement ? 'w-full px-5 py-6 sm:px-8' : 'max-w-[1440px] px-5 pb-8 md:px-8'}`}>
        {!isManagement && <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-zinc-200" aria-label="Department workspace">
          {tabs.map(([key, label, Icon]) => <button key={key} onClick={() => setTab(key)} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${tab === key ? 'border-amber-600 text-zinc-950' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`}><Icon size={16} /> {label}</button>)}
        </nav>}
        {(error || message) && <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : isManagement ? 'border-amber-200 bg-amber-50 text-zinc-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`} role="status">{error || message}</div>}
        {isManagement && reportLoading && <p role="status" className="mb-4 text-sm font-semibold text-zinc-600">Loading department report…</p>}

        {tab === 'orders' && !isManagement && <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-black">Incoming and active orders</h2><p className="text-sm text-zinc-500">Updates automatically every 12 seconds.</p></div><div className="flex gap-2"><button onClick={() => setTicketView('active')} className={`rounded-lg px-3 py-2 text-xs font-bold ${ticketView === 'active' ? 'bg-zinc-900 text-white' : 'border border-zinc-200 bg-white text-zinc-600'}`}>Active</button><button onClick={() => setTicketView('completed')} className={`rounded-lg px-3 py-2 text-xs font-bold ${ticketView === 'completed' ? 'bg-zinc-900 text-white' : 'border border-zinc-200 bg-white text-zinc-600'}`}>Completed</button><button onClick={() => navigate(`/${config.station}`)} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-300">Manage station <ArrowRight size={16} /></button></div></div>
          <div className="mb-6 overflow-hidden rounded-xl border border-amber-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3"><div><h3 className="font-black">Waiting for HOD assignment</h3><p className="text-xs text-zinc-500">Orders appear at the station only after you assign them.</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{assignmentQueue.length}</span></div>
            {assignmentQueueError ? <p role="alert" className="px-4 py-6 text-sm text-rose-700">{assignmentQueueError}. The assignment API must be deployed/restarted before HOD dispatch is available.</p> : assignmentQueue.length ? <div className="divide-y divide-zinc-100">
              {assignmentQueue.map(order => <div key={order.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_340px] lg:items-center">
                <div><p className="text-sm font-black">Order #{order.id} · {order.table_name || 'Walk-in'}</p><p className="mt-0.5 text-xs text-zinc-500">Waiter: {order.staff_name || 'Staff'}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">{order.items.map((item, index) => <span key={`${item.name}-${index}`} className="text-zinc-700">{item.quantity || 1} × {item.name}</span>)}</div></div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select aria-label={`Assign order ${order.id} to ${config.workerRole}`} value={assignmentSelections[order.id] || ''} onChange={event => setAssignmentSelections(current => ({ ...current, [order.id]: event.target.value }))} className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500"><option value="">Choose {config.workerRole.toLowerCase()}</option>{staff.filter(member => member.is_active).map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
                  <button type="button" disabled={assigningOrderId === order.id || !assignmentSelections[order.id]} onClick={() => assignOrder(order)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"><Check size={15} /> {assigningOrderId === order.id ? 'Assigning' : 'Assign & send'}</button>
                </div>
              </div>)}
            </div> : <p className="px-4 py-8 text-center text-sm text-zinc-400">No orders are waiting for assignment.</p>}
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[
            ['Open', activeTickets.length], ['Pending', activeTickets.filter(ticket => ticket.status === 'Pending').length], ['Preparing', activeTickets.filter(ticket => ticket.status === 'Preparing').length], ['Completed today', assignedTickets.filter(ticket => ['Ready', 'Served', 'Paid'].includes(ticket.status)).length],
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}</div>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500"><tr><th className="p-3">Order</th><th className="p-3">Table</th><th className="p-3">Waiter</th><th className="p-3">Items / assignee</th><th className="p-3">Status</th><th className="p-3">Total</th></tr></thead><tbody>
            {visibleTickets.map(ticket => <tr key={ticket.id} className="border-t border-zinc-100 align-top"><td className="p-3 font-bold">#{ticket.order_id}</td><td className="p-3">{ticket.table_name || 'Walk-in'}</td><td className="p-3">{ticket.staff_name || 'Staff'}</td><td className="p-3">{(ticket.items || []).map((item, index) => <div key={`${item.name}-${index}`}>{item.quantity || 1} × {item.name}{item.assignedTo ? <span className="text-zinc-500"> · {item.assignedTo}</span> : null}</div>)}</td><td className="p-3"><span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-900">{ticket.status}</span></td><td className="p-3 font-bold">{money(ticket.total)}</td></tr>)}
            {!visibleTickets.length && <tr><td colSpan="6" className="p-8 text-center text-zinc-400">No {ticketView} department orders today.</td></tr>}
          </tbody></table></div>
        </section>}

        {tab === 'team' && !isManagement && <section className="grid gap-5 xl:grid-cols-[340px_1fr]">
          <form onSubmit={addStaff} className="h-fit rounded-xl border border-zinc-200 bg-white p-5"><h2 className="text-lg font-black">Add {config.label} staff</h2><p className="mb-4 mt-1 text-sm text-zinc-500">Separate department login and PIN.</p><div className="grid gap-3">
            <input required placeholder="Full name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
            <input required type="email" placeholder="Email address" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
            <input required inputMode="numeric" minLength="4" maxLength="8" pattern="[0-9]{4,8}" placeholder="4-8 digit PIN" value={form.pin} onChange={event => setForm({ ...form, pin: event.target.value })} className="rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
            <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-50"><Check size={16} /> Create {config.workerRole} account</button>
          </div></form>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white"><div className="border-b border-zinc-100 px-5 py-4"><h2 className="font-black">Department accounts</h2></div><div className="divide-y divide-zinc-100">
            {staff.map(member => <div key={member.id} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="font-bold">{member.name}</p><p className="text-xs text-zinc-500">{member.email} · {member.role}</p></div><div className="flex items-center gap-3"><span className={`text-xs font-bold ${member.is_active ? 'text-emerald-700' : 'text-zinc-400'}`}>{member.is_active ? 'Active' : 'Inactive'}</span><button disabled={busy} onClick={() => toggleStaff(member)} className="text-xs font-bold text-amber-800 underline disabled:opacity-50">{member.is_active ? 'Deactivate' : 'Activate'}</button></div></div>)}
            {!staff.length && <p className="px-5 py-8 text-center text-sm text-zinc-400">No department accounts yet.</p>}
          </div></div>
        </section>}

  {tab === 'inventory' && !isManagement && <DepartmentInventory department={departmentKey} embedded />}

        {tab === 'reports' && <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-black">{isManagement ? 'Sales by department' : `${config.label} report`}</h2><p className="mt-1 text-sm text-stone-600">{from} to {to}</p></div><div className="flex flex-wrap gap-2" role="group" aria-label="Report date range">
            {PRESETS.map(option => <button key={option} onClick={() => choosePreset(option)} className={`rounded-lg px-3 py-2 text-xs font-bold ${preset === option ? (isManagement ? 'bg-yellow-500 text-black' : 'bg-zinc-900 text-white') : 'border border-zinc-200 bg-white text-zinc-600'}`}>{option}</button>)}
            {preset === 'Select Month' && <input aria-label="Report month" type="month" value={reportMonth} onChange={event => { if (!event.target.value) return; setReportMonth(event.target.value); setRange(datesForMonth(event.target.value)); }} className="rounded-md border border-stone-300 bg-white px-2 py-2 text-sm" />}
            {preset === 'Custom' && <><input aria-label="From date" type="date" value={from} onChange={event => setRange([event.target.value, to])} className="rounded-md border border-stone-300 bg-white px-2 py-2 text-sm" /><input aria-label="To date" type="date" value={to} onChange={event => setRange([from, event.target.value])} className="rounded-md border border-stone-300 bg-white px-2 py-2 text-sm" /></>}
            <button type="button" onClick={isManagement ? downloadConsolidatedReport : downloadDepartmentReport} disabled={!report || report.from !== from || report.to !== to || downloadingPdf} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 ${isManagement ? 'bg-yellow-500 hover:bg-yellow-400' : 'bg-amber-400 hover:bg-amber-300'}`}><Download size={15} /> {downloadingPdf ? 'Preparing PDF...' : 'Download PDF'}</button>
          </div></div>
          {isManagement ? <div className="overflow-x-auto border border-stone-300 bg-white"><table className="w-full min-w-[1250px] text-left text-sm"><thead className="bg-stone-100 text-xs uppercase tracking-wider text-stone-600"><tr><th className="p-3">Department</th><th className="p-3">Orders</th><th className="p-3">Sales</th><th className="p-3">Collected</th><th className="p-3">Unpaid balance</th><th className="p-3">Partial credits</th><th className="p-3">Settled credits</th><th className="p-3">Outstanding credits</th></tr></thead><tbody>{departments.map(row => <tr key={row.department} className="border-t border-stone-200"><td className="p-3 font-bold">{row.label}</td><td className="p-3">{row.total_orders}</td><td className="p-3">{money(row.total_sales)}</td><td className="p-3">{money(row.amount_collected)}</td><td className="p-3">{money(row.outstanding_balance)}</td><td className="p-3">{row.partially_paid_credit_count || 0} · {money(row.partially_paid_credit_amount)}</td><td className="p-3">{row.settled_credit_count || 0} · {money(row.settled_credit_amount)}</td><td className="p-3">{row.outstanding_credit_count || 0} · {money(row.outstanding_credit_balance)}</td></tr>)}</tbody><tfoot className="border-t-2 border-stone-400 bg-stone-100 font-black"><tr><td className="p-3">All departments</td><td className="p-3">{departments.reduce((total, row) => total + Number(row.total_orders || 0), 0)}</td><td className="p-3">{money(departments.reduce((total, row) => total + Number(row.total_sales || 0), 0))}</td><td className="p-3">{money(departments.reduce((total, row) => total + Number(row.amount_collected || 0), 0))}</td><td className="p-3">{money(departments.reduce((total, row) => total + Number(row.outstanding_balance || 0), 0))}</td><td className="p-3">{departments.reduce((total, row) => total + Number(row.partially_paid_credit_count || 0), 0)} · {money(departments.reduce((total, row) => total + Number(row.partially_paid_credit_amount || 0), 0))}</td><td className="p-3">{departments.reduce((total, row) => total + Number(row.settled_credit_count || 0), 0)} · {money(departments.reduce((total, row) => total + Number(row.settled_credit_amount || 0), 0))}</td><td className="p-3">{departments.reduce((total, row) => total + Number(row.outstanding_credit_count || 0), 0)} · {money(departments.reduce((total, row) => total + Number(row.outstanding_credit_balance || 0), 0))}</td></tr></tfoot></table></div> : <>
            <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Orders', summary.total_orders], ['Sales', money(summary.total_sales)], ['Collected', money(summary.amount_collected)], ['Outstanding', money(summary.outstanding_balance)], ['Partially paid credits', `${summary.partially_paid_credit_count || 0} · ${money(summary.partially_paid_credit_amount)}`], ['Settled credits', `${summary.settled_credit_count || 0} · ${money(summary.settled_credit_amount)}`], ['Outstanding credits', `${summary.outstanding_credit_count || 0} · ${money(summary.outstanding_credit_balance)}`]].map(([label, value]) => <article key={label} className="rounded-xl border border-zinc-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-3 text-2xl font-black">{value}</p></article>)}</div>
            <h3 className="mb-3 text-lg font-black">Staff performance</h3><div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">{(report?.staff_performance || []).map(person => <div key={person.staff_name} className="flex justify-between gap-4 p-4 text-sm"><span className="font-bold">{person.staff_name}</span><span>{person.completed_items} completed · {person.items_assigned} assigned</span></div>)}{!report?.staff_performance?.length && <p className="p-5 text-sm text-zinc-400">No assignment activity in this period.</p>}</div>
          </>}
        </section>}
        {tab === 'reports' && isManagement && <section className="mt-8">
          <h3 className="mb-2 text-lg font-black">Staff performance by department</h3>
          <div className="overflow-x-auto border border-stone-300 bg-white"><table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-stone-100 text-xs uppercase tracking-wider text-stone-600"><tr><th className="p-3">Department</th><th className="p-3">Staff member</th><th className="p-3">Handled</th><th className="p-3">Completed</th></tr></thead>
            <tbody>{departments.flatMap(row => (row.staff_performance || []).map(person => ({ ...person, departmentLabel: row.label, departmentKey: row.department }))).map(person => <tr key={`${person.departmentKey}-${person.staff_name}`} className="border-t border-stone-200"><td className="p-3">{person.departmentLabel}</td><td className="p-3 font-bold">{person.staff_name}</td><td className="p-3">{person.items_assigned}</td><td className="p-3">{person.completed_items}</td></tr>)}
              {!departments.some(row => row.staff_performance?.length) && <tr><td colSpan="4" className="p-5 text-center text-stone-500">No department staff activity in this period.</td></tr>}
            </tbody>
          </table></div>
        </section>}
      </div>
    </main>
  );
}