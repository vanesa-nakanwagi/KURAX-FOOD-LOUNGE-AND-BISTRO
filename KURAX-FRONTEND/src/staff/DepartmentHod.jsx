import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoutConfirmDialog from './components/LogoutConfirmDialog';
import { ArrowRight, BellRing, Boxes, ChefHat, ClipboardList, CircleDollarSign, Coffee, Download, FileSpreadsheet, LogOut, RefreshCw, Search, Wine } from 'lucide-react';
import * as XLSX from 'xlsx';
import ProductionPanel from './components/ProductionPanel';
import API_URL from '../config/api';
import { downloadReportPdf } from './reportExport';
import DepartmentInventory from './DepartmentInventory';

const DEPARTMENTS = {
  kitchen: { label: 'Kitchen', title: 'Kitchen station', role: 'KITCHEN_HOD', station: 'kitchen', productionStation: 'kitchen', workerRole: 'CHEF', icon: ChefHat },
  bar: { label: 'Bar', title: 'Bar station', role: 'BAR_HOD', station: 'barman', productionStation: 'bar', workerRole: 'BARMAN', icon: Wine },
  barista: { label: 'Barista', title: 'Barista station', role: 'BARISTA_HOD', station: 'barista', productionStation: 'barista', workerRole: 'BARISTA', icon: Coffee },
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

function isCompletedTicket(ticket) {
  return ['ready', 'served', 'paid', 'closed'].includes(String(ticket.status || '').trim().toLowerCase());
}

function isAssignedItem(item) {
  return Boolean(item?.production_staff_name || item?.assignedTo || item?.assigned_to);
}

function isVoidedProductionItem(item) {
  return item?.voidProcessed === true
    || String(item?.voidProcessed || '').toLowerCase() === 'true'
    || String(item?.production_status || '').toLowerCase() === 'voided'
    || String(item?.status || '').toLowerCase() === 'voided';
}

function productionItemValue(item) {
  const price = Number(item?.price ?? item?.unit_price ?? 0);
  const quantity = Number(item?.quantity || 1);
  return Number.isFinite(price) && Number.isFinite(quantity) ? price * quantity : 0;
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
  const [tickets, setTickets] = useState([]);
  const [report, setReport] = useState(null);
  const [preset, setPreset] = useState(() => initialRange ? 'Custom' : 'Today');
  const [reportMonth, setReportMonth] = useState(() => kampalaToday().slice(0, 7));
  const [[from, to], setRange] = useState(() => initialRange?.start && initialRange?.end ? [initialRange.start, initialRange.end] : datesFor('Today'));
  const [tab, setTab] = useState(departmentKey === 'all' ? 'reports' : 'orders');
  const [ticketView, setTicketView] = useState('active');
  const [tableSearch, setTableSearch] = useState('');
  const [error, setError] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [claimingWorkId, setClaimingWorkId] = useState(null);
  const [claimPin, setClaimPin] = useState('');
  const [claimingBusy, setClaimingBusy] = useState(false);
  const [showStationQueue, setShowStationQueue] = useState(false);

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
          const ticketResponse = await request(`/api/departments/${departmentKey}/tickets?date=${kampalaToday()}`, session.token);
          const reportData = await request(`/api/departments/${departmentKey}/reports?${query}`, session.token);
          if (mounted) {
            setReport(reportData);
            setTickets(Array.isArray(ticketResponse) ? ticketResponse : []);
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

  async function claimProductionItem(event, workId) {
    event.preventDefault();
    if (!config || claimingBusy || !/^\d{4,8}$/.test(claimPin)) return;
    setClaimingBusy(true);
    setError('');
    try {
      const station = departmentKey === 'bar' ? 'bar' : departmentKey;
      await request(`/api/production/work/${workId}/claim`, session.token, {
        method: 'POST',
        body: { pin: claimPin, station },
      });
      setClaimingWorkId(null);
      setClaimPin('');
      setRefreshCounter(value => value + 1);
    } catch (claimError) {
      setError(claimError.message);
    } finally {
      setClaimingBusy(false);
    }
  }

  async function notifyProductionSender(workId, currentStatus) {
    if (!session?.token || claimingBusy) return;
    setClaimingBusy(true);
    setError('');
    try {
      let status = String(currentStatus || '').toLowerCase();
      if (status === 'claimed') {
        await request(`/api/production/work/${workId}/status`, session.token, {
          method: 'PATCH',
          body: { status: 'Preparing' },
        });
        status = 'preparing';
      }
      if (status === 'preparing') {
        await request(`/api/production/work/${workId}/status`, session.token, {
          method: 'PATCH',
          body: { status: 'Completed' },
        });
      }
      await request(`/api/production/work/${workId}/notify`, session.token, { method: 'POST' });
      setRefreshCounter(value => value + 1);
    } catch (notifyError) {
      setError(notifyError.message);
      setRefreshCounter(value => value + 1);
    } finally {
      setClaimingBusy(false);
    }
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
            ['Complimentary quantity', report.summary?.complimentary_quantity ?? 0],
            ['Fully waived quantity', report.summary?.fully_waived_quantity ?? 0],
            ['Partially waived quantity', report.summary?.partially_waived_quantity ?? 0],
            ['Complimentary waived value', money(report.summary?.complimentary_waived_amount)],
            ['Complimentary amount payable', money(report.summary?.complimentary_payable_amount)],
            ['Complimentary amount collected', money(report.summary?.complimentary_collected_amount)],
            ['Complimentary outstanding', money(report.summary?.complimentary_outstanding_amount)],
            ['Voided', money(report.summary?.voided_total)],
            ['Voided quantity', report.summary?.voided_quantity ?? 0],
            ['Production voided items', report.summary?.production_voided_items ?? 0],
            ['Production voided quantity', report.summary?.production_voided_quantity ?? 0],
            ['Production voided total', money(report.summary?.production_voided_total)],
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
          columns: ['Menu item', 'Quantity', 'Sales', 'Comp qty', 'Fully waived qty', 'Partially waived qty', 'Comp waived', 'Voided quantity', 'Voided total'],
          rows: (report.menu_items || []).map(item => [
            item.menu_item, item.quantity, money(item.sales), item.complimentary_quantity || 0, item.fully_waived_quantity || 0,
            item.partially_waived_quantity || 0, money(item.complimentary_waived_amount),
            item.voided_quantity || 0, money(item.voided_total),
          ]),
        },
        {
          title: 'Claimed production and voided items',
          columns: ['Claimed by', 'Items claimed', 'Completed', 'Production value', 'Voided items', 'Voided quantity', 'Voided total'],
          rows: (report.production_performance || []).map(person => [
            person.claimed_by, person.items_claimed, person.completed_items, money(person.production_value),
            person.voided_items, person.voided_quantity, money(person.voided_total),
          ]),
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

  function downloadDepartmentExcel() {
    if (!report || report.from !== from || report.to !== to) return;
    setDownloadingExcel(true);
    try {
      const summaryRows = [
        ['KURAX DEPARTMENT REPORT'],
        ['Period', report.from, 'to', report.to],
        [],
        ['Metric', 'Value'],
        ['Orders', Number(report.summary?.total_orders || 0)],
        ['Sales (UGX)', Number(report.summary?.total_sales || 0)],
        ['Complimentary quantity', Number(report.summary?.complimentary_quantity || 0)],
        ['Fully waived quantity', Number(report.summary?.fully_waived_quantity || 0)],
        ['Partially waived quantity', Number(report.summary?.partially_waived_quantity || 0)],
        ['Complimentary waived value (UGX)', Number(report.summary?.complimentary_waived_amount || 0)],
        ['Complimentary amount payable (UGX)', Number(report.summary?.complimentary_payable_amount || 0)],
        ['Complimentary amount collected (UGX)', Number(report.summary?.complimentary_collected_amount || 0)],
        ['Complimentary outstanding (UGX)', Number(report.summary?.complimentary_outstanding_amount || 0)],
        ['Voided quantity', Number(report.summary?.voided_quantity || 0)],
        ['Voided total (UGX)', Number(report.summary?.voided_total || 0)],
        ['Collected (UGX)', Number(report.summary?.amount_collected || 0)],
        ['Outstanding (UGX)', Number(report.summary?.outstanding_balance || 0)],
      ];
      const menuRows = [
        ['Menu item', 'Quantity', 'Sales (UGX)', 'Comp qty', 'Fully waived qty', 'Partially waived qty', 'Comp waived (UGX)', 'Voided quantity', 'Voided total (UGX)'],
        ...(report.menu_items || []).map(item => [
          item.menu_item,
          Number(item.quantity || 0),
          Number(item.sales || 0),
          Number(item.complimentary_quantity || 0),
          Number(item.fully_waived_quantity || 0),
          Number(item.partially_waived_quantity || 0),
          Number(item.complimentary_waived_amount || 0),
          Number(item.voided_quantity || 0),
          Number(item.voided_total || 0),
        ]),
      ];
      const productionRows = [
        ['Claimed by', 'Items claimed', 'Completed', 'Production value (UGX)', 'Voided items', 'Voided quantity', 'Voided total (UGX)'],
        ...(report.production_performance || []).map(person => [
          person.claimed_by,
          Number(person.items_claimed || 0),
          Number(person.completed_items || 0),
          Number(person.production_value || 0),
          Number(person.voided_items || 0),
          Number(person.voided_quantity || 0),
          Number(person.voided_total || 0),
        ]),
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(menuRows), 'Menu Items');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(productionRows), 'Production');
      XLSX.writeFile(workbook, `${departmentKey}-report-${report.from}-to-${report.to}.xlsx`);
    } catch (downloadError) {
      setError(downloadError.message || 'Could not download department Excel report.');
    } finally {
      setDownloadingExcel(false);
    }
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
        complimentary_quantity: result.complimentary_quantity + Number(department.complimentary_quantity || 0),
        fully_waived_quantity: result.fully_waived_quantity + Number(department.fully_waived_quantity || 0),
        partially_waived_quantity: result.partially_waived_quantity + Number(department.partially_waived_quantity || 0),
        complimentary_waived_amount: result.complimentary_waived_amount + Number(department.complimentary_waived_amount || 0),
        complimentary_payable_amount: result.complimentary_payable_amount + Number(department.complimentary_payable_amount || 0),
        complimentary_collected_amount: result.complimentary_collected_amount + Number(department.complimentary_collected_amount || 0),
        complimentary_outstanding_amount: result.complimentary_outstanding_amount + Number(department.complimentary_outstanding_amount || 0),
        voided_total: result.voided_total + Number(department.voided_total || 0),
        voided_quantity: result.voided_quantity + Number(department.voided_quantity || 0),
        production_voided_items: result.production_voided_items + Number(department.production_voided_items || 0),
        production_voided_quantity: result.production_voided_quantity + Number(department.production_voided_quantity || 0),
        production_voided_total: result.production_voided_total + Number(department.production_voided_total || 0),
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
      }), { total_orders: 0, total_sales: 0, complimentary_quantity: 0, fully_waived_quantity: 0, partially_waived_quantity: 0, complimentary_waived_amount: 0, complimentary_payable_amount: 0, complimentary_collected_amount: 0, complimentary_outstanding_amount: 0, voided_total: 0, voided_quantity: 0, production_voided_items: 0, production_voided_quantity: 0, production_voided_total: 0, cogs: 0, gross_profit: 0, consumption_value: 0, waste: 0, amount_collected: 0, outstanding_balance: 0, partially_paid_credit_count: 0, partially_paid_credit_amount: 0, settled_credit_count: 0, settled_credit_amount: 0, outstanding_credit_count: 0, outstanding_credit_balance: 0 });
      const staffPerformance = departments.flatMap(department => (department.staff_performance || []).map(person => [
        department.label,
        String(person.worker_role || '').replaceAll('_', ' '),
        person.staff_name,
        person.items_assigned,
        person.completed_items,
        money(person.total_sales),
      ]));
      const productionPerformance = departments.flatMap(department => (department.production_performance || []).map(person => [
        department.label,
        String(person.worker_role || '').replaceAll('_', ' '),
        person.claimed_by,
        person.items_claimed,
        person.completed_items,
        money(person.production_value),
        person.voided_items,
        person.voided_quantity,
        money(person.voided_total),
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
            ['Complimentary quantity', totals.complimentary_quantity],
            ['Fully waived quantity', totals.fully_waived_quantity],
            ['Partially waived quantity', totals.partially_waived_quantity],
            ['Complimentary waived value', money(totals.complimentary_waived_amount)],
            ['Complimentary amount payable', money(totals.complimentary_payable_amount)],
            ['Complimentary amount collected', money(totals.complimentary_collected_amount)],
            ['Complimentary outstanding', money(totals.complimentary_outstanding_amount)],
            ['Voided', money(totals.voided_total)],
            ['Voided quantity', totals.voided_quantity],
            ['Production voided items', totals.production_voided_items],
            ['Production voided quantity', totals.production_voided_quantity],
            ['Production voided total', money(totals.production_voided_total)],
            ['COGS', money(totals.cogs)],
            ['Gross profit', money(totals.gross_profit)],
            ['Inventory consumption', money(totals.consumption_value)],
            ['Waste', money(totals.waste)],
            ['Partially paid credits', money(totals.partially_paid_credit_amount)],
            ['Settled credits', money(totals.settled_credit_amount)],
            ['Outstanding credits', money(totals.outstanding_credit_balance)],
          ],
        },
        {
          title: 'Main departments',
          columns: ['Department', 'Orders', 'Sales', 'Comp qty', 'Fully waived qty', 'Partially waived qty', 'Comp waived', 'Comp payable', 'Comp collected', 'Comp outstanding', 'Voided', 'Voided quantity', 'Collected', 'Outstanding', 'Partial credits', 'Settled credits', 'Credit balance'],
          rows: [
            ...departments.map(department => [department.label, department.total_orders, money(department.total_sales), department.complimentary_quantity || 0, department.fully_waived_quantity || 0, department.partially_waived_quantity || 0, money(department.complimentary_waived_amount), money(department.complimentary_payable_amount), money(department.complimentary_collected_amount), money(department.complimentary_outstanding_amount), money(department.voided_total), department.voided_quantity || 0, money(department.amount_collected), money(department.outstanding_balance), money(department.partially_paid_credit_amount), money(department.settled_credit_amount), money(department.outstanding_credit_balance)]),
            ['Total main departments', totals.total_orders, money(totals.total_sales), totals.complimentary_quantity, totals.fully_waived_quantity, totals.partially_waived_quantity, money(totals.complimentary_waived_amount), money(totals.complimentary_payable_amount), money(totals.complimentary_collected_amount), money(totals.complimentary_outstanding_amount), money(totals.voided_total), totals.voided_quantity, money(totals.amount_collected), money(totals.outstanding_balance), money(totals.partially_paid_credit_amount), money(totals.settled_credit_amount), money(totals.outstanding_credit_balance)],
          ],
        },
        {
          title: 'Menu items by department',
          columns: ['Department', 'Menu item', 'Quantity', 'Sales', 'Comp qty', 'Fully waived qty', 'Partially waived qty', 'Comp waived', 'Voided quantity', 'Voided total'],
          rows: departments.flatMap(department => (department.menu_items || []).map(item => [
            department.label, item.menu_item, item.quantity, money(item.sales), item.complimentary_quantity || 0, item.fully_waived_quantity || 0,
            item.partially_waived_quantity || 0, money(item.complimentary_waived_amount),
            item.voided_quantity || 0, money(item.voided_total),
          ])),
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
        {
          title: 'Claimed production and voided items',
          columns: ['Department', 'Role', 'Claimed by', 'Items claimed', 'Completed', 'Production value', 'Voided items', 'Voided quantity', 'Voided total'],
          rows: productionPerformance,
        },
        ],
      });
    } catch (downloadError) {
      setError(downloadError.message || 'Could not download department report.');
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function downloadConsolidatedExcel() {
    if (!report || report.from !== from || report.to !== to) return;
    setDownloadingExcel(true);
    setError('');
    try {
      const query = new URLSearchParams({ from, to });
      const fullReport = await request(`/api/departments/reports/consolidated?${query}`, session.token);
      const departmentRows = fullReport.departments || [];
      const summarySheet = [
        ['KURAX DEPARTMENT SALES REPORT'],
        ['Period', fullReport.from, 'to', fullReport.to],
        [],
        ['Department', 'Orders', 'Sales (UGX)', 'Comp qty', 'Fully waived qty', 'Partially waived qty', 'Comp waived (UGX)', 'Comp payable (UGX)', 'Comp collected (UGX)', 'Comp outstanding (UGX)', 'Voided (UGX)', 'Voided quantity', 'Collected (UGX)', 'Outstanding (UGX)', 'Partial credits (UGX)', 'Settled credits (UGX)', 'Credit balance (UGX)'],
        ...departmentRows.map(row => [
          row.label,
          Number(row.total_orders || 0),
          Number(row.total_sales || 0),
          Number(row.complimentary_quantity || 0),
          Number(row.fully_waived_quantity || 0),
          Number(row.partially_waived_quantity || 0),
          Number(row.complimentary_waived_amount || 0),
          Number(row.complimentary_payable_amount || 0),
          Number(row.complimentary_collected_amount || 0),
          Number(row.complimentary_outstanding_amount || 0),
          Number(row.voided_total || 0),
          Number(row.voided_quantity || 0),
          Number(row.amount_collected || 0),
          Number(row.outstanding_balance || 0),
          Number(row.partially_paid_credit_amount || 0),
          Number(row.settled_credit_amount || 0),
          Number(row.outstanding_credit_balance || 0),
        ]),
      ];
      const menuSheet = [
        ['Department', 'Menu item', 'Quantity', 'Sales (UGX)', 'Comp qty', 'Fully waived qty', 'Partially waived qty', 'Comp waived (UGX)', 'Voided quantity', 'Voided total (UGX)'],
        ...departmentRows.flatMap(department => (department.menu_items || []).map(item => [
          department.label,
          item.menu_item,
          Number(item.quantity || 0),
          Number(item.sales || 0),
          Number(item.complimentary_quantity || 0),
          Number(item.fully_waived_quantity || 0),
          Number(item.partially_waived_quantity || 0),
          Number(item.complimentary_waived_amount || 0),
          Number(item.voided_quantity || 0),
          Number(item.voided_total || 0),
        ])),
      ];
      const staffSheet = [
        ['Department', 'Role', 'Staff member', 'Handled', 'Completed', 'Sales (UGX)'],
        ...departmentRows.flatMap(department => (department.staff_performance || []).map(person => [
          department.label,
          String(person.worker_role || '').replaceAll('_', ' '),
          person.staff_name,
          Number(person.items_assigned || 0),
          Number(person.completed_items || 0),
          Number(person.total_sales || 0),
        ])),
      ];
      const productionSheet = [
        ['Department', 'Role', 'Claimed by', 'Items claimed', 'Completed', 'Production value (UGX)', 'Voided items', 'Voided quantity', 'Voided total (UGX)'],
        ...departmentRows.flatMap(department => (department.production_performance || []).map(person => [
          department.label,
          String(person.worker_role || '').replaceAll('_', ' '),
          person.claimed_by,
          Number(person.items_claimed || 0),
          Number(person.completed_items || 0),
          Number(person.production_value || 0),
          Number(person.voided_items || 0),
          Number(person.voided_quantity || 0),
          Number(person.voided_total || 0),
        ])),
      ];
      const inventorySheet = [
        ['Department', 'Ingredient', 'Quantity', 'Unit', 'Value (UGX)'],
        ...departmentRows.flatMap(department => (department.inventory_usage || []).map(item => [
          department.label,
          item.item_name,
          Number(item.quantity || 0),
          item.unit || '',
          Number(item.value || 0),
        ])),
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summarySheet), 'Departments');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(menuSheet), 'Menu Items');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(staffSheet), 'Staff Sales');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(productionSheet), 'Production');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(inventorySheet), 'Inventory');
      XLSX.writeFile(workbook, `department-report-${from}-to-${to}.xlsx`);
    } catch (downloadError) {
      setError(downloadError.message || 'Could not download department Excel report.');
    } finally {
      setDownloadingExcel(false);
    }
  }

  function signOut() {
    setShowLogoutDialog(true);
  }

  function confirmLogout() {
    setShowLogoutDialog(false);
    localStorage.removeItem('kurax_user');
    navigate('/staff/login');
  }

  if (!session?.token) return <><LogoutConfirmDialog open={showLogoutDialog} onConfirm={confirmLogout} onCancel={() => setShowLogoutDialog(false)} /><main className="min-h-screen bg-white p-8 text-black">Sign in to continue.</main></>;
  if (!allowed) return <><LogoutConfirmDialog open={showLogoutDialog} onConfirm={confirmLogout} onCancel={() => setShowLogoutDialog(false)} /><main className="min-h-screen bg-white p-8 text-black">This account cannot access this department.</main></>;

  const departments = report?.departments || [];
  const summary = report?.summary || {};
  const activeTickets = tickets.filter(ticket => !isCompletedTicket(ticket));
  const visibleTickets = ticketView === 'completed'
    ? tickets.filter(isCompletedTicket)
    : activeTickets;
  const searchedTickets = visibleTickets.filter(ticket =>
    String(ticket.table_name || 'Walk-in').toLowerCase().includes(tableSearch.trim().toLowerCase())
  );
  const voidedProductionItems = tickets.flatMap(ticket =>
    (ticket.items || []).filter(isVoidedProductionItem)
  );
  const voidedProductionQuantity = voidedProductionItems.reduce(
    (total, item) => total + Number(item.quantity || 1), 0
  );
  const voidedProductionValue = voidedProductionItems.reduce(
    (total, item) => total + productionItemValue(item), 0
  );
  const tabs = isManagement ? [['reports', 'Department reports', CircleDollarSign]] : [
    ['orders', 'My Production', ClipboardList], ['inventory', 'Inventory', Boxes], ['reports', 'Reports', CircleDollarSign],
  ];

  return (
    <main className={`min-h-screen ${isManagement ? 'bg-white text-black' : 'bg-[#f4f3ef] text-zinc-900'}`}>
      <LogoutConfirmDialog
        open={showLogoutDialog}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutDialog(false)}
      />
      {showStationQueue && config && (
        <ProductionPanel
          station={config.productionStation}
          user={session}
          onClose={() => setShowStationQueue(false)}
        />
      )}
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
        {error && <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</div>}
        {isManagement && reportLoading && <p role="status" className="mb-4 text-sm font-semibold text-zinc-600">Loading department report…</p>}

        {tab === 'orders' && !isManagement && <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-black">My Production</h2><p className="text-sm text-zinc-500">Claim unassigned items with a staff PIN and follow production progress. Updates automatically.</p></div><div className="flex flex-wrap items-center gap-2"><label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" /><input aria-label="Search tables" type="search" placeholder="Search table..." value={tableSearch} onChange={event => setTableSearch(event.target.value)} className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm sm:w-48" /></label><button onClick={() => setTicketView('active')} className={`rounded-lg px-3 py-2 text-xs font-bold ${ticketView === 'active' ? 'bg-zinc-900 text-white' : 'border border-zinc-200 bg-white text-zinc-600'}`}>Active</button><button onClick={() => setTicketView('completed')} className={`rounded-lg px-3 py-2 text-xs font-bold ${ticketView === 'completed' ? 'bg-zinc-900 text-white' : 'border border-zinc-200 bg-white text-zinc-600'}`}>Completed</button><button onClick={() => setShowStationQueue(true)} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-300">Open station <ArrowRight size={16} /></button></div></div>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{[
            ['Open', activeTickets.length], ['Pending', activeTickets.filter(ticket => String(ticket.status || '').toLowerCase() === 'pending').length], ['Preparing', activeTickets.filter(ticket => String(ticket.status || '').toLowerCase() === 'preparing').length], ['Completed today', tickets.filter(isCompletedTicket).length],
            ['Voided items', voidedProductionItems.length], ['Voided quantity / total', `${voidedProductionQuantity} · ${money(voidedProductionValue)}`],
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}</div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {searchedTickets.map(ticket => {
              const workers = Array.isArray(ticket.workers) && ticket.workers.length
                ? ticket.workers
                : [...new Set((ticket.items || []).map(item => item.assignedTo || item.assigned_to).filter(Boolean))];
              return (
                <article key={ticket.id} className="flex min-h-[360px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                  <header className="shrink-0 border-b border-zinc-100 bg-zinc-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-amber-800">Order #{ticket.order_id} · Table {ticket.table_name || 'Walk-in'}</p>
                        <p className="mt-1 text-xl font-black">{money(ticket.total)}</p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-900">{ticket.status}</span>
                    </div>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500">{ticket.staff_role || 'Waiter'} · {ticket.staff_name || 'Staff'}</p>
                  </header>
                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {(ticket.items || []).map((item, index) => {
                      const senderNotified = Boolean(item.production_notified_at)
                        || String(item.production_notification_status || '').toLowerCase() === 'sent';
                      const notificationSending = String(item.production_notification_status || '').toLowerCase() === 'sending';
                      const canNotify = ['claimed', 'preparing', 'completed'].includes(String(item.production_status || '').toLowerCase());
                      return (
                        <div key={`${item.name}-${index}`} className="border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                        {String(item.production_status || '').toLowerCase() === 'unclaimed' && item.production_work_id ? (
                          <button type="button" onClick={() => {
                            setClaimingWorkId(current => current === item.production_work_id ? null : item.production_work_id);
                            setClaimPin('');
                            setError('');
                          }} className="cursor-pointer rounded px-1 text-left font-black text-zinc-900 underline decoration-dotted underline-offset-2 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600">
                            {item.quantity || 1} × {item.name}
                          </button>
                        ) : (
                          <span className="font-black text-zinc-900">{item.quantity || 1} × {item.name}</span>
                        )}
                        <span className="mt-1 block text-[10px] font-bold uppercase text-zinc-500">
                          {isVoidedProductionItem(item) ? 'Voided' : item.production_status === 'Completed' ? 'Ready' : item.production_status || 'Unclaimed'}
                          {' · Claimed by '}{item.claimed_by || (isAssignedItem(item) ? item.production_staff_name || item.assignedTo || item.assigned_to : 'Unclaimed')}
                        </span>
                        {isVoidedProductionItem(item) && <small className="mt-1 block font-bold text-rose-700">Voided total: {money(productionItemValue(item))}</small>}
                        {item.note && <small className="mt-1 block rounded bg-amber-50 p-2 text-zinc-600">{item.note}</small>}
                        {item.production_work_id && (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {canNotify && !senderNotified && (
                              <button type="button" disabled={claimingBusy || notificationSending}
                                onClick={() => notifyProductionSender(item.production_work_id, item.production_status)}
                                className="inline-flex items-center gap-1.5 rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                                <BellRing size={13} />{notificationSending ? 'Sending…' : 'Notify waiter'}
                              </button>
                            )}
                            {senderNotified && <span className="text-xs font-semibold text-emerald-700">Sent to {ticket.staff_name || 'original sender'} to serve</span>}
                          </div>
                        )}
                        {claimingWorkId === item.production_work_id && (
                          <form onSubmit={event => claimProductionItem(event, item.production_work_id)}
                            className="mt-2 flex flex-wrap items-center gap-2">
                            <input aria-label={`Staff PIN to claim ${item.name}`} type="password" inputMode="numeric"
                              autoComplete="one-time-code" pattern="[0-9]{4,8}" minLength={4} maxLength={8}
                              required autoFocus value={claimPin} onChange={event => setClaimPin(event.target.value)}
                              placeholder="Enter staff PIN" disabled={claimingBusy}
                              className="w-36 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs tracking-widest disabled:opacity-50" />
                            <button type="submit" disabled={claimingBusy}
                              className="rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                              {claimingBusy ? 'Checking…' : 'Confirm'}
                            </button>
                            <button type="button" disabled={claimingBusy} onClick={() => {
                              setClaimingWorkId(null);
                              setClaimPin('');
                            }} className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-bold disabled:opacity-50">
                              Cancel
                            </button>
                          </form>
                        )}
                        </div>
                      );
                    })}
                  </div>
                  <footer className="shrink-0 border-t border-zinc-100 bg-zinc-50 px-4 py-3 text-[10px] font-semibold text-zinc-500">
                    {workers.length ? `Worked by ${workers.join(', ')}` : 'No staff have claimed work'}
                  </footer>
                </article>
              );
            })}
            {!searchedTickets.length && <p className="col-span-full rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">{tableSearch.trim() ? `No ${ticketView} orders found for table "${tableSearch.trim()}".` : `No ${ticketView} department orders today.`}</p>}
          </div>
        </section>}

  {tab === 'inventory' && !isManagement && <DepartmentInventory department={departmentKey} embedded />}

        {tab === 'reports' && <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-black">{isManagement ? 'Sales by department' : `${config.label} report`}</h2><p className="mt-1 text-sm text-stone-600">{from} to {to}</p></div><div className="flex flex-wrap gap-2" role="group" aria-label="Report date range">
            {PRESETS.map(option => <button key={option} onClick={() => choosePreset(option)} className={`rounded-lg px-3 py-2 text-xs font-bold ${preset === option ? (isManagement ? 'bg-yellow-500 text-black' : 'bg-zinc-900 text-white') : 'border border-zinc-200 bg-white text-zinc-600'}`}>{option}</button>)}
            {preset === 'Select Month' && <input aria-label="Report month" type="month" value={reportMonth} onChange={event => { if (!event.target.value) return; setReportMonth(event.target.value); setRange(datesForMonth(event.target.value)); }} className="rounded-md border border-stone-300 bg-white px-2 py-2 text-sm" />}
            {preset === 'Custom' && <><input aria-label="From date" type="date" value={from} onChange={event => setRange([event.target.value, to])} className="rounded-md border border-stone-300 bg-white px-2 py-2 text-sm" /><input aria-label="To date" type="date" value={to} onChange={event => setRange([from, event.target.value])} className="rounded-md border border-stone-300 bg-white px-2 py-2 text-sm" /></>}
            <button type="button" onClick={isManagement ? downloadConsolidatedExcel : downloadDepartmentExcel} disabled={!report || report.from !== from || report.to !== to || downloadingExcel} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
              <FileSpreadsheet size={15} /> {downloadingExcel ? 'Preparing Excel...' : 'Download Excel'}
            </button>
            <button type="button" onClick={isManagement ? downloadConsolidatedReport : downloadDepartmentReport} disabled={!report || report.from !== from || report.to !== to || downloadingPdf} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 ${isManagement ? 'bg-yellow-500 hover:bg-yellow-400' : 'bg-amber-400 hover:bg-amber-300'}`}><Download size={15} /> {downloadingPdf ? 'Preparing PDF...' : 'Download PDF'}</button>
          </div></div>
          {isManagement ? <div className="overflow-x-auto border border-stone-300 bg-white"><table className="w-full min-w-[1720px] text-left text-sm">
            <thead className="bg-stone-100 text-xs uppercase tracking-wider text-stone-600"><tr>
              <th className="p-3">Department</th><th className="p-3">Orders</th><th className="p-3">Sales</th>
              <th className="p-3">Comp qty</th><th className="p-3">Fully waived qty</th>
              <th className="p-3">Partially waived qty</th><th className="p-3">Comp waived</th><th className="p-3">Comp payable</th>
              <th className="p-3">Comp collected</th><th className="p-3">Comp outstanding</th><th className="p-3">Voided</th>
              <th className="p-3">Collected</th><th className="p-3">Unpaid balance</th><th className="p-3">Partial credits</th>
              <th className="p-3">Settled credits</th><th className="p-3">Outstanding credits</th>
            </tr></thead>
            <tbody>{departments.map(row => <tr key={row.department} className="border-t border-stone-200">
              <td className="p-3 font-bold">{row.label}</td><td className="p-3">{row.total_orders}</td><td className="p-3">{money(row.total_sales)}</td>
              <td className="p-3">{row.complimentary_quantity || 0}</td>
              <td className="p-3">{row.fully_waived_quantity || 0}</td><td className="p-3">{row.partially_waived_quantity || 0}</td>
              <td className="p-3">{money(row.complimentary_waived_amount)}</td>
              <td className="p-3">{money(row.complimentary_payable_amount)}</td>
              <td className="p-3">{money(row.complimentary_collected_amount)}</td>
              <td className="p-3">{money(row.complimentary_outstanding_amount)}</td>
              <td className="p-3">{money(row.voided_total)}</td>
              <td className="p-3">{money(row.amount_collected)}</td><td className="p-3">{money(row.outstanding_balance)}</td>
              <td className="p-3">{money(row.partially_paid_credit_amount)}</td><td className="p-3">{money(row.settled_credit_amount)}</td>
              <td className="p-3">{money(row.outstanding_credit_balance)}</td>
            </tr>)}</tbody>
            <tfoot className="border-t-2 border-stone-400 bg-stone-100 font-black"><tr>
              <td className="p-3">All departments</td><td className="p-3">{departments.reduce((total, row) => total + Number(row.total_orders || 0), 0)}</td>
              <td className="p-3">{money(departments.reduce((total, row) => total + Number(row.total_sales || 0), 0))}</td>
              <td className="p-3">{departments.reduce((total, row) => total + Number(row.complimentary_quantity || 0), 0)}</td>
              <td className="p-3">{departments.reduce((total, row) => total + Number(row.fully_waived_quantity || 0), 0)}</td>
              <td className="p-3">{departments.reduce((total, row) => total + Number(row.partially_waived_quantity || 0), 0)}</td>
              <td className="p-3">{money(departments.reduce((total, row) => total + Number(row.complimentary_waived_amount || 0), 0))}</td>
              <td className="p-3">{money(departments.reduce((total, row) => total + Number(row.complimentary_payable_amount || 0), 0))}</td>
              <td className="p-3">{money(departments.reduce((total, row) => total + Number(row.complimentary_collected_amount || 0), 0))}</td>
              <td className="p-3">{money(departments.reduce((total, row) => total + Number(row.complimentary_outstanding_amount || 0), 0))}</td>
              <td className="p-3">{money(departments.reduce((total, row) => total + Number(row.voided_total || 0), 0))}</td>
              <td className="p-3">{money(departments.reduce((total, row) => total + Number(row.amount_collected || 0), 0))}</td>
              <td className="p-3">{money(departments.reduce((total, row) => total + Number(row.outstanding_balance || 0), 0))}</td>
              <td className="p-3">{money(departments.reduce((total, row) => total + Number(row.partially_paid_credit_amount || 0), 0))}</td>
              <td className="p-3">{money(departments.reduce((total, row) => total + Number(row.settled_credit_amount || 0), 0))}</td>
              <td className="p-3">{money(departments.reduce((total, row) => total + Number(row.outstanding_credit_balance || 0), 0))}</td>
            </tr></tfoot>
          </table></div> : <>
            <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
              ['Orders', summary.total_orders],
              ['Sales', money(summary.total_sales)],
              ['Complimentary quantity', summary.complimentary_quantity || 0],
              ['Fully waived quantity', summary.fully_waived_quantity || 0],
              ['Partially waived quantity', summary.partially_waived_quantity || 0],
              ['Complimentary waived value', money(summary.complimentary_waived_amount)],
              ['Complimentary amount payable', money(summary.complimentary_payable_amount)],
              ['Complimentary amount collected', money(summary.complimentary_collected_amount)],
              ['Complimentary outstanding', money(summary.complimentary_outstanding_amount)],
              ['Voided quantity', summary.voided_quantity || 0],
              ['Voided total', money(summary.voided_total)],
              ['Production voided items', summary.production_voided_items || 0],
              ['Production voided quantity / total', `${summary.production_voided_quantity || 0} · ${money(summary.production_voided_total)}`],
              ['Collected', money(summary.amount_collected)],
              ['Outstanding', money(summary.outstanding_balance)],
              ['Partially paid credits', money(summary.partially_paid_credit_amount)],
              ['Settled credits', money(summary.settled_credit_amount)],
              ['Outstanding credits', money(summary.outstanding_credit_balance)],
            ].map(([label, value]) => <article key={label} className="rounded-xl border border-zinc-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-3 text-2xl font-black">{value}</p></article>)}</div>
            <h3 className="mb-3 text-lg font-black">Claimed production and voided items</h3>
            <div className="mb-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="p-3">Claimed by</th><th className="p-3">Items claimed</th><th className="p-3">Completed</th><th className="p-3">Production value</th><th className="p-3">Voided items</th><th className="p-3">Voided quantity</th><th className="p-3">Voided total</th></tr></thead>
                <tbody>{(report?.production_performance || []).map((person, index) => <tr key={`${person.claimed_by}-${index}`} className="border-t border-zinc-100"><td className="p-3 font-bold">{person.claimed_by}</td><td className="p-3">{person.items_claimed}</td><td className="p-3">{person.completed_items}</td><td className="p-3">{money(person.production_value)}</td><td className="p-3">{person.voided_items}</td><td className="p-3">{person.voided_quantity}</td><td className="p-3">{money(person.voided_total)}</td></tr>)}
                  {!report?.production_performance?.length && <tr><td colSpan="7" className="p-5 text-center text-zinc-400">No production records in this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </>}
        </section>}
        {tab === 'reports' && isManagement && <section className="mt-8">
          <h3 className="mb-2 mt-8 text-lg font-black">Claimed production and voided items by department</h3>
          <div className="overflow-x-auto border border-stone-300 bg-white"><table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-stone-100 text-xs uppercase tracking-wider text-stone-600"><tr><th className="p-3">Department</th><th className="p-3">Claimed by</th><th className="p-3">Items claimed</th><th className="p-3">Completed</th><th className="p-3">Production value</th><th className="p-3">Voided items</th><th className="p-3">Voided quantity</th><th className="p-3">Voided total</th></tr></thead>
            <tbody>{departments.flatMap(row => (row.production_performance || []).map((person, index) => <tr key={`${row.department}-${person.claimed_by}-${index}`} className="border-t border-stone-200"><td className="p-3">{row.label}</td><td className="p-3 font-bold">{person.claimed_by}</td><td className="p-3">{person.items_claimed}</td><td className="p-3">{person.completed_items}</td><td className="p-3">{money(person.production_value)}</td><td className="p-3">{person.voided_items}</td><td className="p-3">{person.voided_quantity}</td><td className="p-3">{money(person.voided_total)}</td></tr>))}
              {!departments.some(row => row.production_performance?.length) && <tr><td colSpan="8" className="p-5 text-center text-stone-500">No production records in this period.</td></tr>}
            </tbody>
          </table></div>
        </section>}
      </div>
    </main>
  );
}