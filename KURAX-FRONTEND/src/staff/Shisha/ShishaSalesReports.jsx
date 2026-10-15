import { useEffect, useState } from 'react';
import { CalendarDays, CircleDollarSign, Download, FileSpreadsheet, Flame, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import API_URL from '../../config/api';
import { downloadReportPdf } from '../reportExport';

function todayInKampala() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
}

function rangeForPreset(preset) {
  const today = todayInKampala();
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

function readSession() {
  try { return JSON.parse(localStorage.getItem('kurax_user') || 'null'); }
  catch { return null; }
}

function currency(value) {
  return `UGX ${Number(value || 0).toLocaleString()}`;
}

function reportSections(report) {
  const summary = report?.summary || {};
  return [
    {
      title: 'Summary',
      columns: ['Metric', 'Value'],
      rows: [
        ['Orders', summary.total_orders ?? 0],
        ['Total sales', currency(summary.total_sales)],
        ['Collected', currency(summary.amount_collected)],
        ['Outstanding', currency(summary.total_outstanding)],
        ['Partially paid orders', summary.partially_paid_orders ?? 0],
        ['Partially paid amount', currency(summary.partially_paid_amount)],
        ['Fully settled orders', summary.fully_settled_orders ?? 0],
        ['Outstanding orders', summary.outstanding_orders ?? 0],
      ],
    },
    {
      title: 'Sales by Shisha waiter',
      columns: ['Waiter', 'Orders', 'Sales', 'Collected', 'Outstanding'],
      rows: (report?.by_waiter || []).map(row => [row.waiter_name, row.total_orders, currency(row.total_sales), currency(row.amount_collected), currency(row.outstanding)]),
    },
    {
      title: 'Sales by Shisha mixer',
      columns: ['Mixer', 'Orders', 'Sales'],
      rows: (report?.by_mixer || []).map(row => [row.mixer_name, row.total_orders, currency(row.total_sales)]),
    },
    {
      title: 'Collected by payment method',
      columns: ['Payment method', 'Confirmed payments', 'Amount'],
      rows: (report?.by_payment_method || []).map(row => [row.payment_method, row.payment_count, currency(row.amount)]),
    },
  ];
}

function DataTable({ title, columns, rows, dark }) {
  const heading = dark ? 'text-white' : 'text-zinc-900';
  const muted = dark ? 'text-zinc-400' : 'text-zinc-500';
  const border = dark ? 'border-white/10' : 'border-zinc-100';
  return (
    <section className={`overflow-hidden rounded-lg border ${dark ? 'border-white/10 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
      <h2 className={`border-b px-4 py-3 text-sm font-black ${heading} ${border}`}>{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className={dark ? 'bg-white/5 text-zinc-400' : 'bg-zinc-50 text-zinc-500'}>
            <tr>{columns.map(column => <th key={column} className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wide">{column}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, index) => (
              <tr key={`${row[0]}-${index}`} className={`border-t ${border}`}>
                {row.map((value, cellIndex) => <td key={`${cellIndex}`} className={`px-4 py-3 ${cellIndex === 0 ? `font-semibold ${heading}` : muted}`}>{value}</td>)}
              </tr>
            )) : <tr><td colSpan={columns.length} className={`px-4 py-7 text-center ${muted}`}>No records for this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ShishaSalesReports({ dark = false }) {
  const [session] = useState(readSession);
  const [[from, to], setRange] = useState(() => rangeForPreset('Today'));
  const [preset, setPreset] = useState('Today');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const heading = dark ? 'text-white' : 'text-zinc-900';
  const muted = dark ? 'text-zinc-400' : 'text-zinc-500';
  const control = dark
    ? 'border-white/10 bg-zinc-900 text-zinc-100 hover:bg-white/10'
    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50';

  useEffect(() => {
    if (!session?.token) {
      setError('Sign in again to view Shisha sales.');
      setLoading(false);
      return undefined;
    }
    if (!from || !to || from > to) {
      setReport(null);
      setError('Choose a valid date range.');
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);
    setError('');
    setReport(null);
    const query = new URLSearchParams({ from, to });
    fetch(`${API_URL}/api/shisha/reports?${query}`, {
      headers: { Authorization: `Bearer ${session.token}` },
      signal: controller.signal,
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Unable to load Shisha sales.');
        return data;
      })
      .then(setReport)
      .catch(fetchError => {
        if (fetchError.name !== 'AbortError') setError(fetchError.message || 'Unable to load Shisha sales.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [from, to, session?.token]);

  function selectPreset(value) {
    setPreset(value);
    if (value !== 'Custom') setRange(rangeForPreset(value));
  }

  function downloadPdf() {
    if (!report) return;
    downloadReportPdf({
      filename: `shisha-sales-${from}-to-${to}.pdf`,
      title: 'Shisha Sales Report',
      from,
      to,
      sections: reportSections(report),
      footerLabel: 'Shisha Sales Report',
    });
  }

  function downloadExcel() {
    if (!report) return;
    const workbook = XLSX.utils.book_new();
    const summary = report.summary || {};
    const sheets = [
      ['Summary', [
        ['Shisha Sales Report', `${from} to ${to}`],
        ['Metric', 'Value'],
        ['Orders', Number(summary.total_orders || 0)],
        ['Total sales (UGX)', Number(summary.total_sales || 0)],
        ['Collected (UGX)', Number(summary.amount_collected || 0)],
        ['Outstanding (UGX)', Number(summary.total_outstanding || 0)],
        ['Partially paid orders', Number(summary.partially_paid_orders || 0)],
        ['Partially paid amount (UGX)', Number(summary.partially_paid_amount || 0)],
        ['Fully settled orders', Number(summary.fully_settled_orders || 0)],
        ['Outstanding orders', Number(summary.outstanding_orders || 0)],
      ]],
      ['Waiter Sales', [
        ['Waiter', 'Orders', 'Sales (UGX)', 'Collected (UGX)', 'Outstanding (UGX)'],
        ...(report.by_waiter || []).map(row => [row.waiter_name, Number(row.total_orders || 0), Number(row.total_sales || 0), Number(row.amount_collected || 0), Number(row.outstanding || 0)]),
      ]],
      ['Mixer Sales', [
        ['Mixer', 'Orders', 'Sales (UGX)'],
        ...(report.by_mixer || []).map(row => [row.mixer_name, Number(row.total_orders || 0), Number(row.total_sales || 0)]),
      ]],
      ['Payment Methods', [
        ['Payment method', 'Confirmed payments', 'Amount (UGX)'],
        ...(report.by_payment_method || []).map(row => [row.payment_method, Number(row.payment_count || 0), Number(row.amount || 0)]),
      ]],
    ];
    sheets.forEach(([name, rows]) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name));
    XLSX.writeFile(workbook, `shisha-sales-${from}-to-${to}.xlsx`);
  }

  const summary = report?.summary || {};
  const cards = [
    ['Sales', currency(summary.total_sales), CircleDollarSign],
    ['Collected', currency(summary.amount_collected), Download],
    ['Outstanding', currency(summary.total_outstanding), CalendarDays],
    ['Orders', Number(summary.total_orders || 0).toLocaleString(), Flame],
  ];
  const sections = reportSections(report);

  return (
    <section className={`space-y-5 ${dark ? 'text-zinc-100' : 'text-zinc-900'}`}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-amber-600"><Flame size={14} /> Shisha reports</p>
          <h1 className={`mt-1 text-2xl font-black ${heading}`}>Shisha sales</h1>
          <p className={`mt-1 text-sm ${muted}`}>{from} to {to}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {['Today', 'Yesterday', 'This Week', 'This Month', 'Custom'].map(value => (
            <button key={value} type="button" onClick={() => selectPreset(value)} aria-pressed={preset === value}
              className={`rounded-md border px-3 py-2 text-xs font-bold transition ${preset === value ? 'border-amber-500 bg-amber-400 text-zinc-950' : control}`}>
              {value}
            </button>
          ))}
          <button type="button" onClick={downloadPdf} disabled={!report || loading}
            className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
            <Download size={15} /> PDF
          </button>
          <button type="button" onClick={downloadExcel} disabled={!report || loading}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
            <FileSpreadsheet size={15} /> Excel
          </button>
        </div>
      </header>

      {preset === 'Custom' && <div className="flex flex-wrap items-end gap-3">
        <label className={`grid gap-1 text-xs font-bold ${muted}`}>From<input aria-label="From date" type="date" value={from} onChange={event => setRange(([currentFrom, currentTo]) => [event.target.value, currentTo])} className={`rounded-md border px-3 py-2 text-sm ${control}`} /></label>
        <label className={`grid gap-1 text-xs font-bold ${muted}`}>To<input aria-label="To date" type="date" value={to} onChange={event => setRange(([currentFrom, currentTo]) => [currentFrom, event.target.value])} className={`rounded-md border px-3 py-2 text-sm ${control}`} /></label>
      </div>}

      {error && <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}
      {loading && <p role="status" className={`flex items-center gap-2 text-sm font-semibold ${muted}`}><RefreshCw size={15} className="animate-spin" /> Loading Shisha sales…</p>}

      {!loading && report && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([label, value, Icon]) => <article key={label} className={`flex items-center gap-3 rounded-lg border p-4 ${dark ? 'border-white/10 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-amber-100 text-amber-800"><Icon size={18} /></span>
            <div className="min-w-0"><p className={`text-xs font-bold uppercase ${muted}`}>{label}</p><p className={`mt-1 truncate text-lg font-black ${heading}`}>{value}</p></div>
          </article>)}
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <DataTable title="Sales by waiter" columns={sections[1].columns} rows={sections[1].rows} dark={dark} />
          <DataTable title="Sales by mixer" columns={sections[2].columns} rows={sections[2].rows} dark={dark} />
          <DataTable title="Collected by payment method" columns={sections[3].columns} rows={sections[3].rows} dark={dark} />
          <DataTable title="Payment status" columns={['Metric', 'Value']} rows={[
            ['Partially paid orders', Number(summary.partially_paid_orders || 0).toLocaleString()],
            ['Partially paid amount', currency(summary.partially_paid_amount)],
            ['Fully settled orders', Number(summary.fully_settled_orders || 0).toLocaleString()],
            ['Outstanding orders', Number(summary.outstanding_orders || 0).toLocaleString()],
          ]} dark={dark} />
        </div>
      </>}
    </section>
  );
}