import { useState } from 'react';
import { CheckCircle, Flame } from 'lucide-react';

export default function ProductionItemActions({ work, onClaim, onUpdateStatus, busy }) {
  const [claimOpen, setClaimOpen] = useState(false);
  const [pin, setPin] = useState('');
  if (!work) return null;

  const claimItem = async (event) => {
    event.preventDefault();
    const result = await onClaim(work, pin);
    if (result) {
      setPin('');
      setClaimOpen(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-bold uppercase text-zinc-500">{work.status === 'Preparing' ? 'In preparation' : work.status}</span>
      {work.status === 'Unclaimed' && (
        <button type="button" disabled={busy} onClick={() => setClaimOpen(value => !value)}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-2.5 py-1.5 text-[10px] font-black uppercase text-white disabled:opacity-50">
          Claim item
        </button>
      )}
      {work.status === 'Unclaimed' && claimOpen && (
        <form onSubmit={claimItem} className="flex items-center gap-2">
          <input aria-label={`PIN to claim ${work.item_name}`} type="password" inputMode="numeric"
            autoComplete="one-time-code" pattern="[0-9]{4,8}" minLength={4} maxLength={8}
            required value={pin} onChange={event => setPin(event.target.value)}
            placeholder="4-8 digit PIN" disabled={busy}
            className="w-28 rounded-md border border-zinc-300 px-2 py-1.5 text-xs tracking-widest disabled:opacity-50" />
          <button type="submit" disabled={busy}
            className="rounded-md bg-amber-400 px-2.5 py-1.5 text-[10px] font-black uppercase text-zinc-950 disabled:opacity-50">
            Verify PIN
          </button>
        </form>
      )}
      {work.status === 'Claimed' && (
        <button type="button" disabled={busy} onClick={() => onUpdateStatus(work, 'Preparing')}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-400 px-2.5 py-1.5 text-[10px] font-black uppercase text-zinc-950 disabled:opacity-50">
          <Flame size={13} /> Start preparing
        </button>
      )}
      {work.status === 'Preparing' && (
        <button type="button" disabled={busy} onClick={() => onUpdateStatus(work, 'Completed')}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-2.5 py-1.5 text-[10px] font-black uppercase text-white disabled:opacity-50">
          <CheckCircle size={13} /> {Number(work.remaining_items) <= 1 ? 'Done — notify waiter' : 'Complete item'}
        </button>
      )}
    </div>
  );
}
