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
    <div className="group relative overflow-hidden font-[Outfit] rounded-2xl bg-white p-4 md:p-6 border border-gray-200 shadow-sm hover:shadow-md hover:border-yellow-300 transition-all duration-300">
      {/* Background glow - subtle yellow on light background */}
      <div className="absolute top-0 right-0 w-16 h-16 md:w-24 md:h-24 bg-yellow-500/5 rounded-full blur-2xl group-hover:bg-yellow-500/10 transition-colors" />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-3 md:mb-6">
          {/* Responsive Icon Container */}
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-yellow-100 flex items-center justify-center group-hover:bg-yellow-200 transition-colors">
            <Icon className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
          </div>

          {/* Change Badge - smaller on mobile */}
          {change && (
            <div
              className={`flex items-center gap-0.5 md:gap-1 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md md:rounded-lg text-[10px] md:text-xs font-bold ${
                isPositive
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
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
        <h3 className="text-[11px] md:text-sm font-bold text-gray-500 mb-0.5 md:mb-2 uppercase tracking-wider">
          {title}
        </h3>

        {/* Value - Responsive font size */}
        <div className="flex items-baseline gap-1">
          <p className="text-2xl md:text-4xl font-bold text-gray-900 tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>

        {/* Description */}
        <p className="text-[10px] md:text-xs text-gray-400 mt-1 md:mt-2 truncate">
          {description}
        </p>
      </div>
    </div>
  );
}