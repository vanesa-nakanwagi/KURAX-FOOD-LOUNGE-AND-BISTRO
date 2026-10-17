export default function LogoutConfirmDialog({ open, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[1px] px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-confirm-title"
        className="w-full max-w-md rounded-[26px] border border-white/10 bg-[#2d1d1e] px-6 py-5 shadow-2xl"
      >
        <p id="logout-confirm-title" className="text-xl font-black tracking-tight text-white">
          ARE YOU SURE YOU WANT TO LOGOUT?
        </p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full border border-rose-200 bg-rose-200 px-6 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-[#2d1d1e] transition hover:bg-rose-100"
          >
            YES
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/20 bg-transparent px-6 py-2.5 text-sm font-bold uppercase tracking-[0.12em] text-white transition hover:bg-white/5"
          >
            NO
          </button>
        </div>
      </div>
    </div>
  );
}
