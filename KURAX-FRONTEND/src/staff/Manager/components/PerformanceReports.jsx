import React, { useState, useMemo } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { 
  TrendingUp, Users, FileText, Smartphone, Wallet, CreditCard, Download
} from "lucide-react";

export default function PerformanceReports() {
  const { theme } = useTheme();
  const { orders = [], monthlyTargets = {} } = useData();
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const isDark = theme === 'dark';

  // --- ANALYTICS ENGINE ---
  const stats = useMemo(() => {
    const currentMonthKey = selectedDate.substring(0, 7);

    // 1. Filter Daily Orders
    const dailyOrders = orders.filter(order => {
      const orderDate = new Date(order.timestamp || order.date).toISOString().split('T')[0];
      return orderDate === selectedDate;
    });

    // 2. Monthly Accumulation (for the 6M Progress Bar)
    const monthlyRevenue = orders.reduce((sum, order) => {
      const orderDate = new Date(order.timestamp || order.date).toISOString().split('T')[0];
      if (orderDate.startsWith(currentMonthKey) && order.isArchived) {
        return sum + Number(order.total || 0);
      }
      return sum;
    }, 0);

    // 3. Payment Method Splits (MTN, Airtel, Cash, Card)
    const dailySplits = dailyOrders.reduce((acc, order) => {
      const method = (order.payment_method || "").toUpperCase();
      const amount = Number(order.total || 0);
      
      if (method.includes("MTN")) acc.mtn += amount;
      else if (method.includes("AIRTEL")) acc.airtel += amount;
      else if (method.includes("CARD") || method.includes("VISA") || method.includes("POS")) acc.card += amount;
      else acc.cash += amount;
      
      return acc;
    }, { mtn: 0, airtel: 0, cash: 0, card: 0 });

    // 4. Staff Performance
    const waiterStats = dailyOrders.reduce((acc, order) => {
      const name = (order.waiter_name || order.waiterName || order.waiter || "Staff").trim();
      acc[name] = (acc[name] || 0) + Number(order.total || 0);
      return acc;
    }, {});

    return { 
      dailyOrders, 
      dailyTotal: dailyOrders.reduce((sum, o) => sum + Number(o.total || 0), 0),
      monthlyRevenue, 
      dailySplits, 
      waiterStats,
      monthKey: currentMonthKey 
    };
  }, [orders, selectedDate]);

  const monthTarget = monthlyTargets[stats.monthKey] || { revenue: 6000000 };
  const progressPercent = Math.min((stats.monthlyRevenue / monthTarget.revenue) * 100, 100).toFixed(1);

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-700 pb-32">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-[900] italic uppercase tracking-tighter leading-none">
            Performance
          </h1>
          <p className="text-yellow-500 text-[10px] font-black tracking-widest uppercase mt-2 italic">
            Audit Date: {selectedDate}
          </p>
        </div>
        <input 
          type="date" 
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className={`px-4 py-2 rounded-xl font-black text-[10px] border uppercase ${
            isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-black/10'
          }`}
        />
      </div>

      {/* REVENUE SPLIT CARDS (Now 5 Columns on Desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Today's Total" value={`UGX ${stats.dailyTotal.toLocaleString()}`} icon={<TrendingUp />} isDark={isDark} />
        <StatCard label="MTN Momo" value={`UGX ${stats.dailySplits.mtn.toLocaleString()}`} icon={<Smartphone className="text-yellow-500" />} isDark={isDark} />
        <StatCard label="Airtel Money" value={`UGX ${stats.dailySplits.airtel.toLocaleString()}`} icon={<Smartphone className="text-rose-500" />} isDark={isDark} />
        <StatCard label="Card / POS" value={`UGX ${stats.dailySplits.card.toLocaleString()}`} icon={<CreditCard className="text-blue-500" />} isDark={isDark} />
        <StatCard label="Physical Cash" value={`UGX ${stats.dailySplits.cash.toLocaleString()}`} icon={<Wallet className="text-emerald-500" />} isDark={isDark} />
      </div>

      {/* MONTHLY PROGRESS BAR */}
      <div className={`rounded-[2.5rem] border p-6 md:p-8 ${isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-white'}`}>
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1">Monthly Target ({stats.monthKey})</p>
            <h3 className="text-2xl md:text-3xl font-[900] italic tracking-tighter">
              UGX {stats.monthlyRevenue.toLocaleString()} 
              <span className="text-xs text-zinc-500 ml-2">/ {monthTarget.revenue.toLocaleString()}</span>
            </h3>
          </div>
          <span className="text-2xl font-black italic text-yellow-500">{progressPercent}%</span>
        </div>
        <div className="w-full h-3 bg-black/20 rounded-full overflow-hidden border border-white/5">
          <div 
            className="h-full bg-yellow-500 transition-all duration-1000 shadow-[0_0_20px_rgba(234,179,8,0.3)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* LEADERBOARD SECTION */}
      <div className={`rounded-[2.5rem] border p-6 md:p-8 ${isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-white'}`}>
        <div className="flex justify-between items-center mb-8">
          <h2 className="font-[900] italic uppercase text-lg">Staff Performance</h2>
          <button className="hidden md:block bg-yellow-500 text-black px-6 py-3 rounded-xl font-black text-[10px] uppercase italic tracking-widest">
            Export Audit
          </button>
        </div>

        <div className="grid gap-3">
          {Object.entries(stats.waiterStats).length > 0 ? (
            Object.entries(stats.waiterStats)
              .sort(([, a], [, b]) => b - a)
              .map(([name, total], idx) => (
                <div key={name} className={`flex items-center justify-between p-4 rounded-2xl border ${isDark ? 'bg-black/20 border-white/5' : 'bg-zinc-50 border-black/5'}`}>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-zinc-600">#{idx + 1}</span>
                    <div className="w-10 h-10 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center font-black italic">{name.charAt(0)}</div>
                    <p className="font-black uppercase text-xs italic">{name}</p>
                  </div>
                  <p className="text-emerald-500 font-black italic">UGX {total.toLocaleString()}</p>
                </div>
              ))
          ) : (
            <p className="py-10 text-center opacity-30 font-black uppercase text-xs">No activity found</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, isDark }) {
  return (
    <div className={`p-6 rounded-[2rem] border transition-all hover:scale-[1.02] ${
      isDark ? 'bg-zinc-900 border-white/5' : 'bg-white border-black/5 shadow-sm'
    }`}>
      <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-500 w-fit mb-4">{icon}</div>
      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-lg font-[900] italic tracking-tighter truncate">{value}</p>
    </div>
  );
}