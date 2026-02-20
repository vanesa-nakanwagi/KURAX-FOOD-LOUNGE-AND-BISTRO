import React from 'react';
import { X, Smartphone, CheckCircle } from 'lucide-react';

export default function MomoPaymentModal({ isOpen, onClose, totalAmount, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-sm bg-white rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header Section - Reduced padding from p-8 to p-6 */}
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter text-zinc-900 leading-none">MOMO PAYMENT</h2>
            <p className="text-[9px] font-bold text-yellow-600 uppercase tracking-[0.2em] mt-1">Merchant Selection</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {/* Amount Display - Optimized for the narrower width */}
        <div className="px-6 pt-6 pb-2 text-center">
          <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest mb-1">Total to Pay</p>
          <h3 className="text-3xl font-black text-zinc-900 tracking-tighter">
            UGX {Number(totalAmount).toLocaleString()}
          </h3>
        </div>

        {/* Merchant Codes Section - Using smaller padding (p-6) */}
        <div className="p-6 space-y-3">
          
          {/* MTN Box */}
          <div className="group relative p-4 rounded-[1.5rem] border-2 border-yellow-400 bg-yellow-50/30 transition-all">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center font-black text-[10px] text-black shadow-md">MTN</div>
                <div>
                  <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Merchant Code</p>
                  <p className="text-xl font-black text-zinc-900 tracking-tight">151902</p>
                </div>
              </div>
              <Smartphone className="text-yellow-600 opacity-30" size={20} />
            </div>
          </div>

          {/* Airtel Box */}
          <div className="group relative p-4 rounded-[1.5rem] border-2 border-rose-500 bg-rose-50/30 transition-all">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-rose-600 rounded-xl flex items-center justify-center font-black text-[10px] text-white shadow-md">AIRTEL</div>
                <div>
                  <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Merchant Code</p>
                  <p className="text-xl font-black text-zinc-900 tracking-tight">628831</p>
                </div>
              </div>
              <Smartphone className="text-rose-600 opacity-30" size={20} />
            </div>
          </div>

        </div>

        {/* Footer - Solid dark theme */}
        <div className="p-6 bg-zinc-900 text-center">
          <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mb-4 leading-relaxed">
            Instruct customer to dial USSD <br/>and enter the code above
          </p>
          <button 
            onClick={onConfirm || onClose}
            className="w-full py-4 bg-yellow-500 text-black rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-yellow-400 active:scale-95 transition-all shadow-lg shadow-yellow-500/10"
          >
            <CheckCircle size={16} strokeWidth={3} />
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
}