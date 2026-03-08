import React, { useState, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { 
  Timer, Search, LayoutDashboard, 
  AlertCircle, MessageSquare, Clock, CheckCircle
} from "lucide-react";

export default function LiveTableGrid() {
  const { orders = [] } = useData();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const isDark = theme === 'dark';
  
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const getMinutesElapsed = (startTime) => {
    return Math.floor((new Date() - new Date(startTime)) / 60000);
  };

  // Logic to show both Active and recently Archived (Closed) tables for monitoring
  const tableGroups = orders.reduce((acc, order) => {
    const key = order.tableName?.trim().toUpperCase() || "WALK-IN";
    const isRecentlyClosed = order.isArchived && 
      (new Date() - new Date(order.timestamp)) < 3600000; // Show closed for 1hr

    if (!order.isArchived || isRecentlyClosed) {
      if (!acc[key]) {
        acc[key] = {
          name: key.replace("TABLE", "").trim(),
          fullName: key,
          total: Number(order.total) || 0,
          count: order.items?.length || 0,
          start: order.timestamp,
          waiter: order.waiterName || "Staff",
          isClosed: order.isArchived
        };
      } else {
        acc[key].total += Number(order.total);
        acc[key].count += order.items?.length;
      }
    }
    return acc;
  }, {});

  const tables = Object.values(tableGroups).filter(t => 
    t.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-10 space-y-6 animate-in fade-in duration-700 pb-32">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className={`text-4xl font-[900] italic tracking-tighter uppercase ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Floor <span className="text-yellow-500">Overview</span>
          </h2>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mt-1">
            Managerial Oversight & Service Tracking
          </p>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
          <input 
            type="text" 
            placeholder="Search Floor..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-12 pr-4 py-4 rounded-[1.5rem] text-[10px] font-black uppercase outline-none border transition-all ${
              isDark ? 'bg-zinc-900 border-white/5 focus:border-yellow-500 text-white' : 'bg-white border-black/5 focus:border-yellow-500 shadow-sm'
            }`}
          />
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tables.map((table) => {
          const minutes = getMinutesElapsed(table.start);
          const isDelayed = !table.isClosed && minutes > 45;

          return (
            <div key={table.fullName} className={`rounded-[2.5rem] p-6 border-2 transition-all duration-500 ${
              table.isClosed 
                ? 'opacity-60 bg-zinc-500/5 border-zinc-500/10' 
                : isDelayed ? 'border-rose-500/30 bg-rose-500/5 shadow-rose-500/5' : 'bg-zinc-900/40 border-white/5 shadow-2xl'
            }`}>
              
              {/* STATUS INDICATOR */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-[900] text-2xl italic tracking-tighter uppercase text-white">
                    {table.fullName}
                  </h3>
                  <StatusBadge isClosed={table.isClosed} isDelayed={isDelayed} />
                </div>
                {!table.isClosed && (
                  <div className={`p-3 rounded-2xl font-black text-xs ${isDelayed ? 'bg-rose-500 text-white' : 'bg-white/5 text-zinc-400'}`}>
                    {minutes}m
                  </div>
                )}
              </div>

              {/* DATA POINTS */}
              <div className="space-y-3 mb-8">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <span>Assigned To</span>
                  <span className="text-white">{table.waiter}</span>
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <span>Current Bill</span>
                  <span className="text-yellow-500">UGX {table.total.toLocaleString()}</span>
                </div>
              </div>

              {/* MANAGER ACTION (Approaching Staff) */}
              {isDelayed ? (
                <div className="animate-bounce mt-auto flex items-center gap-2 text-rose-500 bg-rose-500/10 p-4 rounded-2xl">
                  <AlertCircle size={18} />
                  <span className="text-[10px] font-[900] uppercase italic tracking-widest">
                    Approach {table.waiter}
                  </span>
                </div>
              ) : table.isClosed ? (
                <div className="mt-auto flex items-center gap-2 text-zinc-500 bg-zinc-500/10 p-4 rounded-2xl">
                  <CheckCircle size={18} />
                  <span className="text-[10px] font-[900] uppercase tracking-widest">Cleared</span>
                </div>
              ) : (
                <div className="mt-auto flex items-center gap-2 text-emerald-500 bg-emerald-500/10 p-4 rounded-2xl">
                  <Clock size={18} />
                  <span className="text-[10px] font-[900] uppercase tracking-widest">Service Healthy</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ isClosed, isDelayed }) {
  if (isClosed) return <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Closed Session</span>;
  if (isDelayed) return <span className="text-[8px] font-black uppercase tracking-widest text-rose-500 animate-pulse">Delayed - Check Waiter</span>;
  return <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Open & Active</span>;
}