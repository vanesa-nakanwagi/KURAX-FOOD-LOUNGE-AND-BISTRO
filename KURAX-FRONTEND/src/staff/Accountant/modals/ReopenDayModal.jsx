import React, { useState } from "react";
import { RotateCcw, Calendar, Loader2, XCircle as XCircleIcon } from "lucide-react";

export default function ReopenDayModal({ isOpen, onClose, closedDays, loading, onReopen, reopening }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [reason, setReason] = useState('');
  
  if (!isOpen) return null;
  
  const selectedDayData = closedDays.find(d => d.closing_date === selectedDate);
  
  // Format date to YYYY-MM-DD for display
  const formatDisplayDate = (dateString) => {
    if (!dateString) return '';
    // If date is already in YYYY-MM-DD format
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateString;
    }
    // Try to parse and format
    try {
      const date = new Date(dateString);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    } catch {
      return dateString;
    }
  };
  
  return (
    <div className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10">
              <RotateCcw size={20} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Reopen Day</h3>
              <p className="text-[9px] text-zinc-500 mt-0.5">Restore a previously closed day</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-all">
            <XCircleIcon size={18} className="text-zinc-400" />
          </button>
        </div>
        
        {loading ? (
          <div className="py-12 text-center">
            <Loader2 size={32} className="animate-spin mx-auto text-purple-400" />
            <p className="text-[10px] text-zinc-500 mt-3">Loading closed days...</p>
          </div>
        ) : closedDays.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <Calendar size={28} className="text-purple-400" />
            </div>
            <p className="text-zinc-500 font-black text-[10px] uppercase">No closed days found</p>
            <p className="text-[8px] text-zinc-600 mt-1">Only previously closed days can be reopened</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">
                Select Date to Reopen (YYYY-MM-DD)
              </label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-purple-500/50 transition-all font-mono"
              >
                <option value="">-- Select a closed day --</option>
                {closedDays.map(day => {
                  const formattedDate = formatDisplayDate(day.closing_date);
                  return (
                    <option key={day.closing_date} value={formattedDate}>
                      {formattedDate} - UGX {Number(day.gross).toLocaleString()} revenue
                    </option>
                  );
                })}
              </select>
              <p className="text-[7px] text-zinc-600 mt-2 font-mono">
                Format: YYYY-MM-DD (e.g., 2026-04-23)
              </p>
            </div>
            
            {selectedDayData && (
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 mb-4">
                <p className="text-[8px] font-black text-purple-400 uppercase tracking-widest mb-2">Day Snapshot</p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <p className="text-zinc-500">Date</p>
                    <p className="text-white font-black font-mono text-[11px]">{formatDisplayDate(selectedDayData.closing_date)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Cash Revenue</p>
                    <p className="text-white font-black">UGX {Number(selectedDayData.cash).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Card Revenue</p>
                    <p className="text-white font-black">UGX {Number(selectedDayData.card).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Mobile Money</p>
                    <p className="text-white font-black">UGX {(Number(selectedDayData.mtn) + Number(selectedDayData.airtel)).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Orders</p>
                    <p className="text-white font-black">{selectedDayData.order_count}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Gross Revenue</p>
                    <p className="text-yellow-400 font-black">UGX {Number(selectedDayData.gross).toLocaleString()}</p>
                  </div>
                </div>
                <p className="text-[7px] text-zinc-600 mt-2">
                  Closed by: {selectedDayData.recorded_by} · {selectedDayData.closed_at ? new Date(selectedDayData.closed_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            )}
            
            <div className="mb-6">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">
                Reason (Optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you reopening this day?"
                className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-purple-500/50 resize-none h-20"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-4 rounded-2xl border border-white/10 text-zinc-400 font-black text-[10px] uppercase hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => onReopen(selectedDate, reason)}
                disabled={!selectedDate || reopening}
                className={`flex-[2] py-4 rounded-2xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2
                  ${!selectedDate || reopening
                    ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                    : "bg-purple-500 text-white hover:bg-purple-400 active:scale-[0.98]"
                  }`}
              >
                {reopening ? (
                  <><Loader2 size={14} className="animate-spin" /> Reopening...</>
                ) : (
                  <><RotateCcw size={14} /> Reopen Day</>
                )}
              </button>
            </div>
            
            <div className="mt-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-[8px] font-black text-yellow-400 uppercase tracking-widest text-center">
                ⚠️ Reopening will restore all data from that day. Staff can continue working.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}