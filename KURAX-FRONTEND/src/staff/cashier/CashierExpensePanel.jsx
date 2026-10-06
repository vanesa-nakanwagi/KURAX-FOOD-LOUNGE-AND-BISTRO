import { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, RefreshCw, RotateCcw, X } from 'lucide-react';
import API_URL from '../../config/api';

const CATEGORIES = [
  'Rent', 'Staff Wages', 'Stock / Supplies', 'Utilities',
  'Marketing', 'Equipment', 'Transport', 'Other',
];

const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Counter Cash' },
  { value: 'Momo-MTN', label: 'MTN Mobile Money' },
  { value: 'Momo-Airtel', label: 'Airtel Mobile Money' },
  { value: 'Card', label: 'Card' },
];

function formatDate(value) {
  return value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString() : '';
}

export default function CashierExpensePanel({ user }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [description, setDescription] = useState('');
  const [reverseTarget, setReverseTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_URL}/api/cashier-expenses${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user?.token || ''}`,
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Expense request failed.');
    return data;
  }, [user?.token]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request('');
      setEntries(data.entries || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await request('', {
        method: 'POST',
        body: JSON.stringify({ category, amount: Number(amount), payment_method: paymentMethod, description }),
      });
      setAmount('');
      setDescription('');
      setShowForm(false);
      setNotice('Expense recorded and added to the audit trail.');
      await loadEntries();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReverse = async (event) => {
    event.preventDefault();
    if (!reverseTarget) return;
    setReversing(true);
    setError('');
    setNotice('');
    try {
      await request(`/${reverseTarget.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      setReverseTarget(null);
      setReason('');
      setNotice('Expense reversed. The original transaction remains in the audit trail.');
      await loadEntries();
    } catch (reverseError) {
      setError(reverseError.message);
    } finally {
      setReversing(false);
    }
  };

  return (
    <section className="min-h-full bg-zinc-950 px-4 py-5 pb-28 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-yellow-500 text-zinc-950"><FileText size={19} /></span>
            <div>
              <h2 className="text-base font-black uppercase tracking-tight">Expense Transactions</h2>
              <p className="mt-1 text-[10px] font-medium text-zinc-500">Logged by {user?.name || 'Cashier'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={loadEntries} disabled={loading} title="Refresh expenses" className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5 disabled:opacity-50">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button type="button" onClick={() => { setShowForm(value => !value); setError(''); }} className="flex h-10 items-center gap-2 rounded-lg bg-yellow-500 px-3 text-xs font-black text-zinc-950 hover:bg-yellow-400">
              {showForm ? <X size={15} /> : <Plus size={15} />}{showForm ? 'Cancel' : 'Add expense'}
            </button>
          </div>
        </header>

        {error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">{notice}</p>}

        {showForm && (
          <form onSubmit={handleSave} className="grid gap-4 rounded-xl border border-white/10 bg-zinc-900 p-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-[10px] font-bold uppercase text-zinc-400">
              Category
              <select value={category} onChange={event => setCategory(event.target.value)} className="w-full rounded-lg border border-white/10 bg-zinc-950 p-3 text-sm normal-case text-white outline-none focus:border-yellow-500">
                {CATEGORIES.map(item => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-[10px] font-bold uppercase text-zinc-400">
              Amount (UGX)
              <input required min="0.01" step="0.01" type="number" value={amount} onChange={event => setAmount(event.target.value)} className="w-full rounded-lg border border-white/10 bg-zinc-950 p-3 text-sm normal-case text-white outline-none focus:border-yellow-500" />
            </label>
            <label className="space-y-1.5 text-[10px] font-bold uppercase text-zinc-400">
              Paid from
              <select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)} className="w-full rounded-lg border border-white/10 bg-zinc-950 p-3 text-sm normal-case text-white outline-none focus:border-yellow-500">
                {PAYMENT_METHODS.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-[10px] font-bold uppercase text-zinc-400 sm:col-span-2">
              Description
              <input required maxLength="500" value={description} onChange={event => setDescription(event.target.value)} className="w-full rounded-lg border border-white/10 bg-zinc-950 p-3 text-sm normal-case text-white outline-none focus:border-yellow-500" />
            </label>
            <button disabled={saving} className="rounded-lg bg-yellow-500 px-4 py-3 text-xs font-black uppercase text-zinc-950 hover:bg-yellow-400 disabled:opacity-50 sm:col-span-2">
              {saving ? 'Recording…' : 'Record expense'}
            </button>
          </form>
        )}

        {reverseTarget && (
          <form onSubmit={handleReverse} className="grid gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 sm:grid-cols-[1fr_auto]">
            <label className="space-y-1.5 text-[10px] font-bold uppercase text-rose-200 sm:col-span-2">
              Reason for reversing {reverseTarget.reference}
              <input required maxLength="1000" value={reason} onChange={event => setReason(event.target.value)} className="w-full rounded-lg border border-rose-500/20 bg-zinc-950 p-3 text-sm normal-case text-white outline-none focus:border-rose-400" />
            </label>
            <button disabled={reversing} className="rounded-lg bg-rose-500 px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-50">{reversing ? 'Reversing…' : 'Confirm reversal'}</button>
            <button type="button" onClick={() => { setReverseTarget(null); setReason(''); }} className="rounded-lg border border-white/10 px-4 py-3 text-xs font-bold text-zinc-300">Cancel</button>
          </form>
        )}

        <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h3 className="text-xs font-black uppercase tracking-wide">Recent expenses</h3>
            <span className="text-[10px] text-zinc-500">{entries.length} entries</span>
          </div>
          {loading ? <p className="p-6 text-center text-xs text-zinc-500">Loading expenses…</p> : entries.length === 0 ? <p className="p-6 text-center text-xs text-zinc-500">No expense transactions yet.</p> : (
            <div className="divide-y divide-white/5">
              {entries.map(entry => (
                <article key={entry.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold">{entry.description}</p>
                      <span className={`rounded px-2 py-0.5 text-[9px] font-black uppercase ${entry.status === 'Reversed' ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{entry.status}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-500">{entry.reference} · {formatDate(entry.entry_date)} · {entry.posted_by}</p>
                    {entry.reversal_reason && <p className="mt-1 text-[10px] text-rose-300">Reversal: {entry.reversal_reason} · {entry.reversed_by}</p>}
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                    <span className="text-sm font-black text-yellow-400">UGX {Number(entry.amount).toLocaleString()}</span>
                    {entry.status === 'Posted' && !entry.reversal_id && <button type="button" onClick={() => { setReverseTarget(entry); setError(''); }} className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 px-3 py-2 text-[10px] font-bold text-rose-300 hover:bg-rose-500/10"><RotateCcw size={13} />Reverse</button>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
