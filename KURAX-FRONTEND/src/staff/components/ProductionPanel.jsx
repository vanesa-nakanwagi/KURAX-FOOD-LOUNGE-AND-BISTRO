import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, RefreshCw, X } from 'lucide-react';
import jsPDF from 'jspdf';
import API_URL from '../../config/api';

const STATION_LABELS = { kitchen: 'Kitchen', bar: 'Bar', barista: 'Barista' };

function kampalaDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(date);
}

function periodDates(period, from, to) {
  const today = kampalaDate();
  const date = new Date(`${today}T12:00:00Z`);
  if (period === 'yesterday') {
    date.setUTCDate(date.getUTCDate() - 1);
    const value = date.toISOString().slice(0, 10);
    return [value, value];
  }
  if (period === 'week') {
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return [date.toISOString().slice(0, 10), today];
  }
  if (period === 'month') return [`${today.slice(0, 7)}-01`, today];
  if (period === 'custom') return [from, to];
  return [today, today];
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

async function request(path, token, options = {}) {
  const response = await fetch(`${API_URL}/api/production${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Production request failed.');
  return data;
}

export default function ProductionPanel({ station, user, onClose }) {
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState({ records: [], totals: {} });
  const isStationWorker = ['CHEF', 'BARMAN', 'BARISTA'].includes(String(user?.role || '').toUpperCase());
  const [tab, setTab] = useState('queue');
  const [period, setPeriod] = useState('today');
  const [from, setFrom] = useState(kampalaDate());
  const [to, setTo] = useState(kampalaDate());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const stationName = STATION_LABELS[station];

  const loadQueue = useCallback(async () => {
    if (!user?.token) return;
    const rows = await request(`/${station}/queue`, user.token);
    setQueue(rows);
  }, [station, user?.token, refreshKey]);

  const loadHistory = useCallback(async () => {
    if (!user?.token) return;
    const [start, end] = periodDates(period, from, to);
    const query = new URLSearchParams({ from: start, to: end, station });
    const result = await request(`/history?${query}`, user.token);
    setHistory(result);
  }, [user?.token, period, from, to, station]);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        await loadQueue();
      } catch (err) {
        if (mounted) setError(err.message);
      }
    };
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [loadQueue]);

  useEffect(() => {
    if (tab !== 'history') return;
    loadHistory().catch(err => setError(err.message));
  }, [tab, loadHistory, refreshKey]);

  const ownHistory = useMemo(() => history.records || [], [history.records]);

  async function updateStatus(item, status) {
    setBusy(true);
    setError('');
    try {
      await request(`/work/${item.work_id}/status`, user.token, {
        method: 'PATCH',
        body: { status },
      });
      setRefreshKey(value => value + 1);
      await loadQueue();
      if (tab === 'history') await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    const headers = ['Order', 'Table', 'Station', 'Item', 'Notes', 'Quantity', 'Completed quantity', 'Status', 'Claimed at', 'Started at', 'Completed at'];
    const rows = ownHistory.map(item => [
      item.order_id, item.table_name, item.station, item.item_name, item.item_notes, item.quantity,
      item.completed_quantity, item.status, item.claimed_at, item.started_at, item.completed_at,
    ]);
    const content = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    link.download = `${station}-production-${periodDates(period, from, to).join('-to-')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadPdf() {
    const documentPdf = new jsPDF();
    documentPdf.setFontSize(16);
    documentPdf.text(`${stationName} production history`, 14, 18);
    documentPdf.setFontSize(9);
    documentPdf.text(`${periodDates(period, from, to).join(' to ')} · ${user?.name || 'Staff'}`, 14, 25);
    let y = 34;
    ownHistory.forEach(item => {
      const detail = `Order #${item.order_id} · Table ${item.table_name || '-'} · ${item.item_name} × ${item.quantity} · ${item.completed_quantity} completed · ${item.status}${item.item_notes ? ` · Notes: ${item.item_notes}` : ''}`;
      const lines = documentPdf.splitTextToSize(detail, 180);
      if (y + lines.length * 5 > 280) {
        documentPdf.addPage();
        y = 18;
      }
      documentPdf.text(lines, 14, y);
      y += lines.length * 5 + 3;
    });
    documentPdf.save(`${station}-production-${periodDates(period, from, to).join('-to-')}.pdf`);
  }

  return (
    <div className="fixed inset-0 z-[500] overflow-y-auto bg-zinc-100 p-4 text-zinc-900 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-800">{stationName} station</p>
            <h2 className="text-2xl font-black">Production · {user?.name || 'Staff'}</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setRefreshKey(value => value + 1)} className="rounded-lg border bg-white px-3 py-2 text-sm font-bold"><RefreshCw size={15} className="mr-1 inline" />Refresh</button>
            <button onClick={onClose} className="rounded-lg border bg-white px-3 py-2 text-sm font-bold"><X size={15} className="mr-1 inline" />Close</button>
          </div>
        </header>

        {error && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}

        <nav className="mb-4 flex gap-2">
          <button onClick={() => setTab('queue')} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === 'queue' ? 'bg-zinc-900 text-white' : 'bg-white'}`}>{isStationWorker ? 'My assigned production' : 'Station queue'}</button>
          <button onClick={() => setTab('history')} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === 'history' ? 'bg-zinc-900 text-white' : 'bg-white'}`}>My production history</button>
        </nav>

        {tab === 'queue' ? (
          <>
          {isStationWorker && <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-zinc-600">My assigned items</h3>}
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {queue.map(item => {
              const details = typeof item.item_details === 'string' ? JSON.parse(item.item_details) : item.item_details || {};
              const isOwner = Number(item.staff_id) === Number(user?.id);
              return (
                <article key={item.work_id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex justify-between gap-3">
                    <div><p className="text-xs font-black uppercase tracking-wide text-amber-800">Order #{item.order_id} · Table {item.table_name || '-'}</p><h3 className="mt-1 text-lg font-black">{item.item_name} × {item.quantity}</h3></div>
                    <span className="h-fit rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-black uppercase">{item.status}</span>
                  </div>
                  {details.note && <p className="mt-2 rounded bg-amber-50 p-2 text-sm italic">{details.note}</p>}
                  <p className="mt-2 text-xs text-zinc-500">Claimed by {item.staff_name || 'Unclaimed'}{item.claimed_at ? ` · ${new Date(item.claimed_at).toLocaleString()}` : ''}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {isOwner && item.status === 'Claimed' && <button disabled={busy} onClick={() => updateStatus(item, 'Preparing')} className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-black disabled:opacity-50">Start preparation</button>}
                    {isOwner && item.status === 'Preparing' && <button disabled={busy} onClick={() => updateStatus(item, 'Completed')} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-black text-white disabled:opacity-50">Record completed quantity</button>}
                  </div>
                </article>
              );
            })}
            {queue.length === 0 && <p className="rounded-xl border bg-white p-6 text-sm text-zinc-500">{isStationWorker ? 'You have no assigned station work.' : 'No active station work.'}</p>}
          </section>
          </>
        ) : (
          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-xs font-bold">Period<select value={period} onChange={event => setPeriod(event.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">This week</option><option value="month">This month</option><option value="custom">Custom range</option></select></label>
              {period === 'custom' && <><label className="grid gap-1 text-xs font-bold">From<input type="date" value={from} onChange={event => setFrom(event.target.value)} className="rounded-lg border px-3 py-2 text-sm" /></label><label className="grid gap-1 text-xs font-bold">To<input type="date" value={to} onChange={event => setTo(event.target.value)} className="rounded-lg border px-3 py-2 text-sm" /></label></>}
              <button onClick={() => { loadHistory().catch(err => setError(err.message)); }} className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-bold text-white">Apply</button>
              <button onClick={downloadPdf} disabled={!ownHistory.length} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50"><FileText size={15} className="mr-1 inline" />PDF</button>
              <button onClick={downloadCsv} disabled={!ownHistory.length} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50"><FileSpreadsheet size={15} className="mr-1 inline" />CSV</button>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              <p className="rounded-lg bg-zinc-50 p-3 text-xs">Orders handled <b className="block text-lg">{history.totals?.orders_handled || 0}</b></p>
              <p className="rounded-lg bg-zinc-50 p-3 text-xs">Items claimed <b className="block text-lg">{history.totals?.items_claimed || 0}</b></p>
              <p className="rounded-lg bg-zinc-50 p-3 text-xs">Items started <b className="block text-lg">{history.totals?.items_started || 0}</b></p>
              <p className="rounded-lg bg-zinc-50 p-3 text-xs">Items completed <b className="block text-lg">{history.totals?.items_completed || 0}</b></p>
              <p className="rounded-lg bg-zinc-50 p-3 text-xs">Quantity claimed <b className="block text-lg">{history.totals?.quantity_claimed || 0}</b></p>
              <p className="rounded-lg bg-zinc-50 p-3 text-xs">Quantity completed <b className="block text-lg">{history.totals?.quantity_completed || 0}</b></p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead><tr className="border-b text-xs uppercase text-zinc-500"><th className="p-2">Order / table</th><th className="p-2">Item / notes</th><th className="p-2">Qty</th><th className="p-2">Completed</th><th className="p-2">Status</th><th className="p-2">Claimed</th><th className="p-2">Started</th><th className="p-2">Completed</th></tr></thead>
                <tbody>{ownHistory.map(item => <tr key={item.work_id} className="border-b last:border-0"><td className="p-2">#{item.order_id} · {item.table_name || '-'}</td><td className="p-2">{item.item_name}{item.item_notes && <small className="block text-zinc-500">{item.item_notes}</small>}</td><td className="p-2">{item.quantity}</td><td className="p-2">{item.completed_quantity}</td><td className="p-2">{item.status}</td><td className="p-2">{item.claimed_at ? new Date(item.claimed_at).toLocaleString() : '-'}</td><td className="p-2">{item.started_at ? new Date(item.started_at).toLocaleString() : '-'}</td><td className="p-2">{item.completed_at ? new Date(item.completed_at).toLocaleString() : '-'}</td></tr>)}</tbody>
              </table>
              {ownHistory.length === 0 && <p className="py-6 text-sm text-zinc-500">No claimed work for this period.</p>}
            </div>
          </section>
        )}
      </div>

    </div>
  );
}
