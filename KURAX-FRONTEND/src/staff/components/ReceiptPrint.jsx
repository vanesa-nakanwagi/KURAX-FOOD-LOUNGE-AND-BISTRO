import { useEffect } from 'react';

function formatAmount(value) {
  return `UGX ${Number(value || 0).toLocaleString()}`;
}

export default function ReceiptPrint({ receipt, onClose }) {
  useEffect(() => {
    if (!receipt) return undefined;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [receipt]);

  if (!receipt) return null;

  return (
    <>
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 3mm; }
          body * { visibility: hidden !important; }
          .receipt-print-backdrop,
          .receipt-print-document,
          .receipt-print-document * { visibility: visible !important; }
          .receipt-print-backdrop {
            position: absolute !important;
            inset: 0 !important;
            display: block !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .receipt-print-document {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 74mm !important;
            max-width: 74mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            color: #000 !important;
            font: 10px/1.35 monospace !important;
          }
          .receipt-print-actions { display: none !important; }
        }
      `}</style>
      <div className="receipt-print-backdrop fixed inset-0 z-[1000] grid place-items-center overflow-y-auto bg-black/50 p-4">
        <section className="receipt-print-document w-full max-w-sm rounded-xl bg-white p-5 font-mono text-xs text-black shadow-2xl">
          <header className="text-center">
            <h1 className="text-base font-black">KURAX FOOD LOUNGE &amp; BISTRO</h1>
            <p className="mt-1 font-bold uppercase">Sales receipt</p>
          </header>
          <div className="my-3 border-y border-dashed border-zinc-400 py-2">
            <p>Receipt: {receipt.reference || '-'}</p>
            <p>Date: {receipt.date ? new Date(receipt.date).toLocaleString() : new Date().toLocaleString()}</p>
            {receipt.table && <p>Table: {receipt.table}</p>}
            {receipt.customer && <p>Customer: {receipt.customer}</p>}
            {receipt.staff && <p>Served by: {receipt.staff}</p>}
          </div>
          <div className="space-y-2">
            {(receipt.items || []).map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex justify-between gap-3">
                <span className="min-w-0 break-words">{item.quantity || 1} × {item.name}</span>
                <span className="shrink-0">{formatAmount(item.total)}</span>
              </div>
            ))}
          </div>
          <div className="my-3 space-y-1 border-t border-dashed border-zinc-400 pt-2">
            <div className="flex justify-between gap-3 font-black">
              <span>Total</span><span>{formatAmount(receipt.total)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Paid now ({receipt.paymentMethod || 'Payment'})</span>
              <span>{formatAmount(receipt.amountReceived)}</span>
            </div>
            {receipt.amountPaid !== undefined && (
              <div className="flex justify-between gap-3">
                <span>Total paid</span><span>{formatAmount(receipt.amountPaid)}</span>
              </div>
            )}
            {receipt.balance !== undefined && (
              <div className="flex justify-between gap-3">
                <span>Balance</span><span>{formatAmount(receipt.balance)}</span>
              </div>
            )}
            {receipt.transactionId && <p className="break-all">Transaction: {receipt.transactionId}</p>}
            {receipt.confirmedBy && <p>Confirmed by: {receipt.confirmedBy}</p>}
          </div>
          <p className="text-center font-bold">Thank you. Please come again.</p>
        </section>
        <div className="receipt-print-actions fixed bottom-5 flex gap-3">
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-amber-400 px-5 py-3 text-sm font-bold text-black">
            Print receipt
          </button>
          <button type="button" onClick={onClose} className="rounded-lg bg-white px-5 py-3 text-sm font-bold text-zinc-900">
            Close
          </button>
        </div>
      </div>
    </>
  );
}
