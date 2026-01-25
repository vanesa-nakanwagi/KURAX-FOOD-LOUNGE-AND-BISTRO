import React from "react";
import {
  TrendingUp,
  Eye,
  Heart,
  MessageSquare,
  UtensilsCrossed,
  Calendar
} from "lucide-react";

// Icon map
const iconComponents = {
  Utensils: UtensilsCrossed,
  Calendar: Calendar,
  Eye: Eye,
  Heart: Heart,
  MessageSquare: MessageSquare
};

export default function StatsCard({
  title = "Menus Uploaded",
  value = 0,
  change = "+12%",
  trend = "up",
  icon = "Utensils",
  description = "This month"
}) {
  const Icon = iconComponents[icon] || UtensilsCrossed;
  const isPositive = trend === "up";

  return (
    <div className="group relative overflow-hidden font-[Outfit] rounded-2xl bg-zinc-900 p-4 md:p-6 border border-slate-800 hover:border-yellow-500/50 transition-all duration-300">
      {/* Background glow - smaller on mobile */}
      <div className="absolute top-0 right-0 w-16 h-16 md:w-24 md:h-24 bg-yellow-500/5 rounded-full blur-2xl group-hover:bg-yellow-500/10 transition-colors" />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-3 md:mb-6">
          {/* Responsive Icon Container */}
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors">
            <Icon className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
          </div>

          {/* Change Badge - smaller on mobile */}
          {change && (
            <div
              className={`flex items-center gap-0.5 md:gap-1 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md md:rounded-lg text-[10px] md:text-xs font-bold ${
                isPositive
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              <TrendingUp
                className={`w-2.5 h-2.5 md:w-3 md:h-3 ${!isPositive ? "rotate-180" : ""}`}
              />
              {change}
            </div>
          )}
        </div>

        {/* Title - Responsive text size */}
        <h3 className="text-[11px] md:text-sm font-medium text-slate-400 mb-0.5 md:mb-2 uppercase tracking-wider">
          {title}
        </h3>

        {/* Value - Responsive font size (2xl to 4xl) */}
        <div className="flex items-baseline gap-1">
          <p className="text-2xl md:text-4xl font-bold text-white tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>

        {/* Description - Hidden on very small screens if needed, or just kept tiny */}
        <p className="text-[10px] md:text-xs text-slate-500 mt-1 md:mt-2 truncate">
          {description}
        </p>
      </div>
    </div>
  );
}