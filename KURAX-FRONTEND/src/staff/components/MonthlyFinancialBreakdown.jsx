import React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

function formatAmount(value) {
  return `UGX ${Number(value || 0).toLocaleString()}`;
}

export default function MonthlyFinancialBreakdown({
  month,
  target,
  grossSales,
  creditSettlements,
  expenses,
  currentCash,
  remaining,
  percentage,
  isDark = false,
}) {
  const progress = Math.max(0, Math.min(Number(percentage) || 0, 100));
  const textClass = isDark ? "text-zinc-400" : "text-zinc-500";
  const salesProgress = Math.min(Number(grossSales) || 0, Number(target) || 0);
  const targetData = [
    { name: "Gross Sales", value: salesProgress },
    { name: "Remaining", value: Math.max(Number(remaining) || 0, 0) },
  ];
  const collectionData = [
    { name: "Gross Sales", value: Number(grossSales) || 0 },
    { name: "Credit Settlements", value: Number(creditSettlements) || 0 },
  ];
  const cashData = [
    { name: "Expenses", value: Number(expenses) || 0 },
    { name: "Current Cash", value: Math.max(Number(currentCash) || 0, 0) },
  ];
  const legendGroups = [
    { title: "Target", items: [["Target", target, "#eab308"]] },
    { title: "Target Progress", items: [["Gross Sales", grossSales, "#eab308"], ["Remaining", remaining, isDark ? "#52525b" : "#a1a1aa"]] },
    { title: "Collections", items: [["Gross Sales", grossSales, "#10b981"], ["Credit Settlements", creditSettlements, "#8b5cf6"]] },
    { title: "After Expenses", items: [["Expenses", expenses, "#f43f5e"], ["Current Cash", currentCash, "#f97316"]] },
  ];

  return (
    <section className={`h-full min-w-0 rounded-2xl border p-5 sm:p-6 ${isDark ? "border-white/5 bg-zinc-900/40 shadow-2xl" : "border-black/5 bg-white shadow-xl"}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className={`text-[11px] font-black uppercase tracking-widest ${textClass}`}>Monthly Financial Breakdown</p>
          <p className="mt-1 text-base font-black">{month}</p>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-wider ${textClass}`}>UGX</span>
      </div>
      <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(190px,0.9fr)]">
        <div className="relative h-[300px] min-w-0" aria-label={`Monthly target and cash breakdown for ${month}`}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                formatter={value => formatAmount(value)}
                contentStyle={{
                  borderRadius: "8px",
                  border: isDark ? "1px solid #3f3f46" : "1px solid #e4e4e7",
                  backgroundColor: isDark ? "#18181b" : "#ffffff",
                  color: isDark ? "#ffffff" : "#18181b",
                  fontSize: "13px",
                }}
              />
              <Pie data={targetData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={104} outerRadius={127} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                <Cell fill="#eab308" />
                <Cell fill={isDark ? "#3f3f46" : "#e4e4e7"} />
              </Pie>
              <Pie data={collectionData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={77} outerRadius={99} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                <Cell fill="#10b981" />
                <Cell fill="#8b5cf6" />
              </Pie>
              <Pie data={cashData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={49} outerRadius={72} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                <Cell fill="#f43f5e" />
                <Cell fill="#f97316" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-black italic ${progress >= 75 ? "text-emerald-500" : progress >= 50 ? "text-yellow-500" : progress >= 25 ? "text-orange-500" : "text-red-500"}`}>{progress.toFixed(1)}%</span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${textClass}`}>of target</span>
          </div>
        </div>
        <div className="space-y-3">
          {legendGroups.map(group => (
            <div key={group.title}>
              <p className={`mb-1 text-[10px] font-black uppercase tracking-widest ${textClass}`}>{group.title}</p>
              {group.items.map(([label, value, color]) => (
                <div key={label} className="flex items-center justify-between gap-2 py-0.5">
                  <span className="flex min-w-0 items-center gap-2 text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-black">{formatAmount(value)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
