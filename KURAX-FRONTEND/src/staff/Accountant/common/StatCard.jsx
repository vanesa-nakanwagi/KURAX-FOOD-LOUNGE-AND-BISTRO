import React from "react";
import { Banknote, CreditCard, Smartphone, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrencyCompact, fmt } from "../utils/helpers";

const iconMap = {
  cash:   <Banknote   size={18} className="text-emerald-600" />,
  card:   <CreditCard size={18} className="text-blue-600"    />,
  mobile: <Smartphone size={18} className="text-purple-600"  />,
};

const iconBgMap = {
  cash:   "bg-emerald-50",
  card:   "bg-blue-50",
  mobile: "bg-purple-50",
};

export default function StatCard({ icon, label, value, color, note, trend, isCompact = true }) {
  const formattedValue = isCompact ? formatCurrencyCompact(value) : `UGX ${fmt(value)}`;
  const trendColor = trend > 0 ? "text-emerald-500" : trend < 0 ? "text-red-500" : "text-gray-500";
  const IconComponent = typeof icon === "string" ? iconMap[icon] : icon;
  const iconBg = typeof icon === "string" ? (iconBgMap[icon] || "bg-gray-100") : "bg-gray-100";

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 hover:border-yellow-500/30">
      <div className="relative z-10">

        {/* Icon + Today badge */}
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${iconBg}`}>
            {IconComponent}
          </div>
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Today</span>
        </div>

        {/* Label */}
        <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1 truncate">
          {label}
        </p>

        {/* Value */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className={`text-2xl font-black ${color || "text-gray-900"} break-words`}>
            {formattedValue}
          </h3>
          {note && (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase tracking-wider">
              {note}
            </span>
          )}
        </div>

        {/* Trend */}
        {trend && (
          <div className={`flex items-center gap-1 mt-1.5 ${trendColor}`}>
            {trend > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span className="text-[9px] font-black">{Math.abs(trend)}%</span>
            <span className="text-[8px] text-gray-400 ml-1">vs yesterday</span>
          </div>
        )}

      </div>
    </div>
  );
}