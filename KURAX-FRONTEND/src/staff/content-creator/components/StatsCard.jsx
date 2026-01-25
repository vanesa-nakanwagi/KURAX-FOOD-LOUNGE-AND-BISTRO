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
    <div className="group relative overflow-hidden font-[Outfit] rounded-2xl bg-gradient-to-br bg-zinc-900 p-6 border border-slate-700 hover:border-yellow-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-yellow-500/10">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-3xl group-hover:bg-yellow-500/10 transition-colors" />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400/20 to-yellow-500/20 flex items-center justify-center group-hover:from-yellow-400/30 group-hover:to-yellow-500/30 transition-colors">
            <Icon className="w-6 h-6 text-yellow-400" />
          </div>

          {change && (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                isPositive
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              <TrendingUp
                className={`w-3 h-3 ${!isPositive ? "rotate-180" : ""}`}
              />
              {change}
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium text-slate-400 mb-2">
          {title}
        </h3>

        {/* Value */}
        <p className="text-4xl font-bold text-white mb-2 tracking-tight">
          {value.toLocaleString()}
        </p>

        {/* Description */}
        <p className="text-xs text-slate-500">{description}</p>
      </div>

      {/* Hover border */}
      <div className="absolute inset-0 rounded-2xl border border-yellow-500/0 group-hover:border-yellow-500/30 transition-colors pointer-events-none" />
    </div>
  );
}
