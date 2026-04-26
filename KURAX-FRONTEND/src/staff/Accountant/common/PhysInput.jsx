import React from "react";

export default function PhysInput({ label, value, onChange, color }) {
  return (
    <div className="group">
      <p className={`text-[9px] font-black uppercase tracking-widest mb-2 transition-colors duration-200 ${color}`}>{label}</p>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-white font-black text-lg outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 transition-all duration-200 text-right hover:border-white/20"
      />
    </div>
  );
}