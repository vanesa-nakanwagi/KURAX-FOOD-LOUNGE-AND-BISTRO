import React from "react";
import { Banknote, CreditCard, Smartphone, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrencyCompact, fmt } from "../utils/helpers";

const iconMap = {
  cash: <Banknote size={20} className="text-emerald-600" />,
  card: <CreditCard size={20} className="text-blue-600" />,
  mobile: <Smartphone size={20} className="text-purple-600" />
};

export default function StatCard({ icon, label, value, color, gradient, note, trend, isCompact = true }) {
  const formattedValue = isCompact ? formatCurrencyCompact(value) : `UGX ${fmt(value)}`;
  const trendIcon = trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : null;
  const trendColor = trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-600" : "text-gray-500";
  const trendValue = trend ? `${Math.abs(trend)}%` : "";
  const IconComponent = typeof icon === 'string' ? iconMap[icon] : icon;

  // Light theme colors - remove dark gradients, use white/light backgrounds
  const cardBg = gradient ? `bg-gradient-to-br ${gradient}` : "bg-white";
  
  return (
    <div className={`group relative overflow-hidden rounded-2xl ${cardBg} p-4 sm:p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-yellow-300 transition-all duration-300 hover:scale-[1.02]`}>
      <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-gradient-to-br from-yellow-500/5 to-transparent rounded-full -mr-12 sm:-mr-16 -mt-12 sm:-mt-16 group-hover:scale-150 transition-transform duration-700" />
      <div className="absolute bottom-0 left-0 w-20 sm:w-24 h-20 sm:w-24 bg-gradient-to-tr from-gray-100 to-transparent rounded-full -ml-10 sm:-ml-12 -mb-10 sm:-mb-12 group-hover:scale-150 transition-transform duration-700" />
      
      <div className="relative z-10">
        <div className={`p-2 sm:p-3 w-fit rounded-xl bg-gray-100 border border-gray-200 ${color} group-hover:scale-110 transition-all duration-300 group-hover:border-yellow-300`}>
          {IconComponent}
        </div>
        
        <div className="mt-3 sm:mt-4 mb-1 sm:mb-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-1 h-3 sm:h-4 bg-yellow-500 rounded-full group-hover:h-4 sm:group-hover:h-5 transition-all duration-300" />
            <p className="text-[8px] sm:text-[9px] font-black uppercase text-gray-500 tracking-[0.15em] sm:tracking-[0.2em] group-hover:text-yellow-600 transition-colors">
              {label}
            </p>
          </div>
        </div>
        
        <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
          <h3 className={`text-base sm:text-2xl lg:text-3xl font-black tracking-tighter group-hover:tracking-tight transition-all ${color || "text-gray-900"}`}>
            {formattedValue}
          </h3>
          {note && (
            <span className="text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase tracking-wider">
              {note}
            </span>
          )}
        </div>
        
        {trend && (
          <div className={`flex items-center gap-1 mt-1 sm:mt-2 ${trendColor}`}>
            {trendIcon}
            <span className="text-[8px] sm:text-[9px] font-black">{trendValue}</span>
            <span className="text-[6px] sm:text-[8px] text-gray-400 ml-0.5 sm:ml-1">vs yesterday</span>
          </div>
        )}
      </div>
    </div>
  );
}