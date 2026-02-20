import React, { useState, useEffect } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { 
  Users, Receipt, CheckCircle2, Timer, Search, 
  RotateCcw, LayoutDashboard, X 
} from "lucide-react";

export default function LiveTableGrid() {
  const { orders = [], setOrders } = useData();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Refresh time labels every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // --- Helper: Format duration (45m ago or 1h 15m ago) ---
  const getReadableTime = (startTime) => {
    const diffInMinutes = Math.floor((new Date() - new Date(startTime)) / 60000);
    if (diffInMinutes < 0) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const hours = Math.floor(diffInMinutes / 60);
    const mins = diffInMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m ago` : `${hours}h ago`;
  };

  // --- IMPROVED GROUPING LOGIC (The Fix for Multiple Orders) ---
  const activeOrders = orders.filter(o => !o.isArchived);
  
  const tableGroups = activeOrders.reduce((acc, order) => {
    // Unique key by Table Name (e.g., "TABLE 3")
    const key = order.tableName?.trim().toUpperCase() || "WALK-IN";
    
    if (!acc[key]) {
      acc[key] = {
        name: key.replace("TABLE", "").trim(),
        fullName: key,
        total: Number(order.total) || 0,
        count: order.items?.length || 0,
        start: order.timestamp, // Earliest order time
        waiter: order.waiterName || "Staff",
        ids: [order.id] // Store all docket IDs for this table
      };
    } else {
      // If table exists, ADD to it instead of creating a new card
      acc[key].total += (Number(order.total) || 0);
      acc[key].count += (order.items?.length || 0);
      acc[key].ids.push(order.id);
      // Keep the oldest timestamp so the "Time Active" is accurate
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
      // Maps through all orders and archives every ID linked to this table
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
    <div className="p-4 md:p-10 space-y-6 md:space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className={`text-3xl md:text-4xl font-black italic tracking-tighter uppercase ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
            Floor Management
          </h2>
          <div className="flex items-center gap-2 mt-1">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
               {tables.length} Active Sessions
             </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-yellow-500" size={16} />
            <input 
              type="text" 
              placeholder="Search Table..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-12 pr-4 py-3 rounded-2xl text-xs font-bold uppercase outline-none border transition-all ${
                theme === 'dark' ? 'bg-zinc-900 border-white/5 focus:border-yellow-500' : 'bg-white border-black/5 focus:border-yellow-500'
              }`}
            />
          </div>
          <button onClick={handleResetAll} className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all">
            <RotateCcw size={20} />
          </button>
        </div>
      </div>

      {/* GRID SECTION */}
      {tables.length === 0 ? (
        <div className="py-40 text-center opacity-20">
          <LayoutDashboard size={64} className="mx-auto mb-4" />
          <p className="font-black uppercase italic tracking-widest text-sm text-zinc-500">Floor is Clear</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
          {tables.map((table) => (
            <TableCard 
                key={table.fullName} 
                table={table} 
                theme={theme} 
                onClear={handleClearTable} 
                timeLabel={getReadableTime(table.start)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TableCard({ table, theme, onClear, timeLabel }) {
  return (
    <div className={`group relative rounded-[2.5rem] p-1 transition-all duration-300 ${
      theme === 'dark' ? 'bg-white/5 hover:bg-yellow-500' : 'bg-zinc-100 hover:bg-yellow-500'
    }`}>
      <div className={`h-full w-full rounded-[2.3rem] p-6 flex flex-col transition-colors duration-300 ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
      }`}>
        <div className="flex justify-between items-start mb-6">
          <div className="w-12 h-12 rounded-2xl bg-yellow-500 flex items-center justify-center text-black font-black text-xl italic shadow-lg shadow-yellow-500/20">
            {table.name}
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-[10px] font-black text-rose-500 uppercase tracking-tighter whitespace-nowrap italic">
              <Timer size={12} /> {timeLabel}
            </div>
            <p className="text-[8px] font-bold text-zinc-500 uppercase mt-0.5">Waiter: {table.waiter}</p>
          </div>
        </div>

        <div className="space-y-4 mb-8">
           <div className="flex justify-between items-center border-b border-dashed border-zinc-500/20 pb-2">
              <span className="text-[10px] font-black text-zinc-500 uppercase">Total Items</span>
              <span className="text-xs font-black italic">{table.count} Units</span>
           </div>
           <div>
              <span className="text-[9px] font-black text-yellow-600 uppercase tracking-widest">Total Bill</span>
              <div className="text-2xl font-black italic tracking-tighter text-yellow-500">
                UGX {table.total.toLocaleString()}
              </div>
           </div>
        </div>

        <button 
          onClick={() => onClear(table.fullName, table.ids)}
          className={`w-full py-4 rounded-2xl font-black uppercase italic text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${
            theme === 'dark' 
              ? 'bg-white/5 hover:bg-emerald-500 hover:text-white' 
              : 'bg-zinc-100 hover:bg-emerald-500 hover:text-white'
          }`}
        >
          <CheckCircle2 size={14} /> Close & Clear Table
        </button>
      </div>
    </div>
  );
}