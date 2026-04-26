import React, { useState } from "react";
import { Sparkles, Loader2, XCircle as XCircleIcon } from "lucide-react";

export default function StartNewDayModal({ isOpen, onClose, onStart, starting }) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  
  if (!isOpen) return null;
  
  const today = new Date().toISOString().split('T')[0];
  const minDate = today;
  
  return (
    <div className="fixed inset-0 z-[600] bg-white/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100">
              <Sparkles size={20} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Start New Day</h3>
              <p className="text-[9px] text-gray-500 mt-0.5">Initialize a brand new business day</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all">
            <XCircleIcon size={18} className="text-gray-500" />
          </button>
        </div>
        
        <div className="mb-4">
          <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 block">
            Select Date for New Day
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={minDate}
            className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-gray-900 font-bold outline-none focus:border-emerald-500/50 transition-all"
          />
          <p className={`text-[8px] mt-2 ${selectedDate === today ? "text-yellow-600" : "text-gray-400"}`}>
            {selectedDate === today 
              ? "⚠️ Starting today will reset current day's data" 
              : "✅ This will create a fresh day with zero totals"}
          </p>
        </div>
        
        <div className="mb-6">
          <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 block">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., New financial period, System reset, etc."
            className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-gray-700 text-sm outline-none focus:border-emerald-500/50 resize-none h-20"
          />
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6">
          <p className="text-[8px] font-black text-yellow-600 uppercase tracking-widest text-center">
            ⚠️ This will create a brand new day with ALL totals set to ZERO
          </p>
          <p className="text-[7px] text-gray-500 text-center mt-2">
            Previous days will remain archived in the system
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl border border-gray-200 text-gray-500 font-black text-[10px] uppercase hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onStart(selectedDate, notes)}
            disabled={starting}
            className={`flex-[2] py-4 rounded-2xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2
              ${starting
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]"
              }`}
          >
            {starting ? (
              <><Loader2 size={14} className="animate-spin" /> Starting...</>
            ) : (
              <><Sparkles size={14} /> Start New Day</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}