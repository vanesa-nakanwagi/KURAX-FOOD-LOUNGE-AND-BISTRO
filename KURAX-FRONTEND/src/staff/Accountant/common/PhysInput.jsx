import React from "react";

export default function PhysInput({ label, value, onChange, color }) {
  return (
    <div className="group">
      <p className={`text-[9px] font-black uppercase tracking-widest mb-2 transition-colors duration-200 ${color}`}>{label}</p>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-gray-900 font-black text-lg outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 transition-all duration-200 text-right hover:border-gray-300 shadow-sm"
      />
    </div>
  );
}