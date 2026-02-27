import React, { useState, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { 
  Receipt, CheckCircle2, Timer, Search, 
  RotateCcw, LayoutDashboard
} from "lucide-react";

export default function LiveTableGrid() {
  const { orders = [], setOrders } = useData();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const isDark = theme === 'dark';

  const getReadableTime = (startTime) => {
    const diffInMinutes = Math.floor((new Date() - new Date(startTime)) / 60000);
    if (diffInMinutes < 0) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    const hours = Math.floor(diffInMinutes / 60);
    const mins = diffInMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const activeOrders = orders.filter(o => !o.isArchived);
  
  const tableGroups = activeOrders.reduce((acc, order) => {
    const key = order.tableName?.trim().toUpperCase() || "WALK-IN";
    if (!acc[key]) {
      acc[key] = {
        name: key.replace("TABLE", "").trim(),
        fullName: key,
        total: Number(order.total) || 0,
        count: order.items?.length || 0,
        start: order.timestamp,
        waiter: order.waiterName || "Staff",
        ids: [order.id]
      };
    } else {
      acc[key].total += (Number(order.total) || 0);
      acc[key].count += (order.items?.length || 0);
      acc[key].ids.push(order.id);
      if (new Date(order.timestamp) < new Date(acc[key].start)) {
        acc[key].start = order.timestamp;
      }
    }
    return acc;
  }, {});

  const tables = Object.values(tableGroups).filter(t => 
    t.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleClearTable = (name, ids) => {
    if (window.confirm(`Finalize billing for ${name}? This will clear all linked orders.`)) {
      setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, isArchived: true } : o));
    }
  };

  const handleResetAll = () => {
    const code = Math.floor(1000 + Math.random() * 9000);
    const confirm = window.prompt(`CRITICAL: Type "${code}" to archive ALL active tables:`);
    if (confirm === code.toString()) {
      setOrders(prev => prev.map(o => ({ ...o, isArchived: true })));
      alert("Floor Cleared.");
    }
  };

  return (
    <div className="p-4 md:p-10 space-y-5 md:space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className={`text-3xl md:text-4xl font-black italic tracking-tighter uppercase ${
            isDark ? 'text-white' : 'text-zinc-900'
          }`}>
            Floor Management
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              {tables.length} Active {tables.length === 1 ? 'Session' : 'Sessions'}
            </p>
          </div>
        </div>

        {/* Search + Reset */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56 group">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-yellow-500 transition-colors" 
              size={15} 
            />
            <input 
              type="text" 
              placeholder="Search table..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-2xl text-xs font-bold uppercase outline-none border transition-all ${
                isDark 
                  ? 'bg-zinc-900 border-white/5 focus:border-yellow-500 text-white' 
                  : 'bg-white border-black/5 focus:border-yellow-500 text-zinc-900'
              }`}
            />
          </div>
          <button 
            onClick={handleResetAll} 
            className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shrink-0"
            title="Reset all tables"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* GRID */}
      {tables.length === 0 ? (
        <div className="py-24 md:py-40 text-center opacity-20">
          <LayoutDashboard size={48} className="mx-auto mb-4" />
          <p className="font-black uppercase italic tracking-widest text-sm text-zinc-500">
            Floor is Clear
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-6">
          {tables.map((table) => (
            <TableCard 
              key={table.fullName} 
              table={table} 
              isDark={isDark}
              onClear={handleClearTable} 
              timeLabel={getReadableTime(table.start)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TableCard({ table, isDark, onClear, timeLabel }) {
  const displayTitle = table.name.toUpperCase().includes('TABLE') 
    ? table.name.toUpperCase() 
    : `TABLE ${table.name}`;

  return (
    <div className={`rounded-[1.5rem] md:rounded-[2.3rem] p-4 md:p-7 flex flex-col border transition-colors duration-300 ${
      isDark 
        ? 'bg-zinc-900 border-white/5 shadow-xl' 
        : 'bg-white border-black/8 shadow-md'
    }`}>
      
      {/* CARD HEADER */}
      <div className="flex justify-between items-start mb-4 md:mb-6">
        <div>
          <h3 className={`font-black text-lg md:text-2xl italic tracking-tighter leading-none ${
            isDark ? 'text-white' : 'text-zinc-900'
          }`}>
            {displayTitle}
          </h3>
          <div className="flex items-center gap-1 mt-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-[7px] md:text-[8px] font-black text-emerald-500 uppercase tracking-widest">
              Active
            </span>
          </div>
        </div>

        {/* Timer badge */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-tight ${
          isDark ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-500'
        }`}>
          <Timer size={10} className="shrink-0" />
          {timeLabel}
        </div>
      </div>

      {/* STATS */}
      <div className="space-y-3 mb-4 md:mb-6 flex-1">
        {/* Waiter */}
        <div className={`flex justify-between items-center text-[9px] md:text-[10px] font-bold uppercase pb-2 border-b border-dashed ${
          isDark ? 'border-white/5' : 'border-black/5'
        }`}>
          <span className="text-zinc-500 tracking-widest">Waiter</span>
          <span className={`truncate max-w-[80px] md:max-w-none ${isDark ? 'text-white' : 'text-zinc-800'}`}>
            {table.waiter}
          </span>
        </div>

        {/* Items */}
        <div className={`flex justify-between items-center text-[9px] md:text-[10px] font-bold uppercase pb-2 border-b border-dashed ${
          isDark ? 'border-white/5' : 'border-black/5'
        }`}>
          <span className="text-zinc-500 tracking-widest">Items</span>
          <span className={isDark ? 'text-white' : 'text-zinc-800'}>
            {table.count} units
          </span>
        </div>

        {/* Bill */}
        <div>
          <span className="text-[8px] md:text-[9px] font-black text-yellow-600 uppercase tracking-widest block mb-1">
            Bill
          </span>
          <div className="text-xl md:text-3xl font-black italic tracking-tighter text-yellow-500 flex items-baseline gap-1">
            <span className="text-[9px] md:text-xs opacity-60">UGX</span>
            <span className="truncate">{table.total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ACTION BUTTON */}
      <button 
        onClick={() => onClear(table.fullName, table.ids)}
        className={`w-full py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase italic text-[9px] md:text-[10px] tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 border ${
          isDark 
            ? 'bg-white/5 text-white border-white/5 hover:bg-yellow-400 hover:text-black hover:border-yellow-400' 
            : 'bg-zinc-100 text-black border-black/5 hover:bg-yellow-400 hover:border-yellow-400'
        }`}
      >
        <CheckCircle2 size={12} /> Close Table
      </button>
    </div>
  );
}