import React from "react";
import { Banknote, CreditCard, Smartphone, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrencyCompact, fmt } from "../utils/helpers";

const iconMap = {
  cash: <Banknote size={18} className="text-emerald-600" />,
  card: <CreditCard size={18} className="text-blue-600" />,
  mobile: <Smartphone size={18} className="text-purple-600" />
};

// Map label to icon background color
const getIconBgColor = (icon) => {
  if (icon === 'cash') return 'bg-emerald-50';
  if (icon === 'card') return 'bg-blue-50';
  if (icon === 'mobile') return 'bg-purple-50';
  return 'bg-gray-100';
};

export default function StatCard({ icon, label, value, color, gradient, note, trend, isCompact = true }) {
  const formattedValue = isCompact ? formatCurrencyCompact(value) : `UGX ${fmt(value)}`;
  const trendIcon = trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : null;
  const trendColor = trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-600" : "text-gray-500";
  const trendValue = trend ? `${Math.abs(trend)}%` : "";
  const IconComponent = typeof icon === 'string' ? iconMap[icon] : icon;
  const iconBgClass = getIconBgColor(icon);

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 hover:border-yellow-500/30">
      <div className="relative z-10">
        {/* Icon with colored background */}
        <div className={`p-2.5 rounded-xl ${iconBgClass} w-fit mb-3`}>
          {IconComponent}
        </div>
        
        {/* Label */}
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1 truncate">
          {label}
        </p>
        
        {/* Value and optional note */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className={`text-2xl font-black ${color || "text-gray-900"}`}>
            {formattedValue}
          </h3>
          {note && (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase tracking-wider">
              {note}
            </span>
          )}
        </div>
        
        {/* Optional trend indicator */}
        {trend && (
          <div className={`flex items-center gap-1 mt-2 ${trendColor}`}>
            {trendIcon}
            <span className="text-[9px] font-black">{trendValue}</span>
            <span className="text-[8px] text-gray-400 ml-0.5">vs yesterday</span>
          </div>
        )}
      </div>
    </div>
  );
}