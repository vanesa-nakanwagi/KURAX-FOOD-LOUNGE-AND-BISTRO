import React from "react";
import { Banknote, CreditCard, Smartphone, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrencyCompact, fmt } from "../utils/helpers";

const iconMap = {
  cash: <Banknote size={20} className="text-emerald-400" />,
  card: <CreditCard size={20} className="text-blue-400" />,
  mobile: <Smartphone size={20} className="text-purple-400" />
};

export default function StatCard({ icon, label, value, color, gradient, note, trend, isCompact = true }) {
  const formattedValue = isCompact ? formatCurrencyCompact(value) : `UGX ${fmt(value)}`;
  const trendIcon = trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : null;
  const trendColor = trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-zinc-500";
  const trendValue = trend ? `${Math.abs(trend)}%` : "";
  const IconComponent = typeof icon === 'string' ? iconMap[icon] : icon;

  return (
    <div className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient || 'from-zinc-900/50 to-zinc-900/30'} p-5 border border-white/5 hover:border-yellow-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/10 hover:scale-[1.02]`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-500/10 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-white/5 to-transparent rounded-full -ml-12 -mb-12 group-hover:scale-150 transition-transform duration-700" />
      <div className="relative z-10">
        <div className={`p-3 w-fit rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 ${color} group-hover:scale-110 transition-all duration-300 group-hover:shadow-lg`}>
          {IconComponent}
        </div>
        <div className="mt-4 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-yellow-500/50 rounded-full group-hover:h-5 transition-all duration-300" />
            <p className="text-[9px] font-black uppercase text-zinc-400 tracking-[0.2em] group-hover:text-yellow-400/80 transition-colors">
              {label}
            </p>
          </div>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tighter group-hover:tracking-tight transition-all">
            {formattedValue}
          </h3>
          {note && (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-white/10 text-zinc-400 uppercase tracking-wider">
              {note}
            </span>
          )}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 ${trendColor}`}>
            {trendIcon}
            <span className="text-[9px] font-black">{trendValue}</span>
            <span className="text-[8px] text-zinc-600 ml-1">vs yesterday</span>
          </div>
        )}
      </div>
    </div>
  );
}