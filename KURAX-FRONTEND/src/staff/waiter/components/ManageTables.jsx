import React, { useState, useEffect } from "react";
import axios from "axios";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { 
  Plus, Clock, Coffee, LayoutGrid, ChevronRight, User, CheckCircle2, AlertCircle 
} from "lucide-react";

export default function ManageTables({ onEditTable }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

 const fetchTables = async () => {
  try {
    const response = await axios.get('/api/orders/tables/all');
    
    // Safety Check: Ensure the data is actually an array
    if (Array.isArray(response.data)) {
      setTables(response.data);
    } else {
      console.error("API did not return an array:", response.data);
      setTables([]); // Fallback to empty array
    }
  } catch (err) {
    console.error("Error fetching live tables:", err);
    setTables([]); // Fallback on error
  } finally {
    setLoading(false);
  }
};
  return (
    <div className="p-6 h-full overflow-y-auto no-scrollbar">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter">Floor Management</h2>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
  Real-time Status • {(Array.isArray(tables) ? tables : []).filter(t => t.status === 'Occupied').length} Occupied
</p>
        </div>
        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-900 border-white/5' : 'bg-white border-black/5'}`}>
          <LayoutGrid size={24} className="text-yellow-500" />
        </div>
      </div>

      {tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-20 italic">
          <Coffee size={64} className="mb-4" />
          <p className="font-black uppercase tracking-widest text-sm">No tables configured</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {tables.map((table) => {
            const isOccupied = table.status === 'Occupied';
            
            return (
              <div 
                key={table.id || table.name}
                className={`group relative rounded-[2.5rem] p-8 border-2 transition-all duration-500 ${
                  isOccupied 
                    ? isDark ? "bg-zinc-900 border-yellow-500/20 shadow-xl shadow-yellow-500/5" : "bg-white border-yellow-500 shadow-xl shadow-yellow-500/10"
                    : isDark ? "bg-zinc-900/40 border-white/5 opacity-70" : "bg-zinc-50 border-black/5 opacity-80"
                }`}
              >
                {/* Header: Table ID & Status */}
                <div className="flex justify-between items-start mb-8">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-black shadow-lg transition-transform group-hover:scale-110 ${isOccupied ? 'bg-yellow-500 shadow-yellow-500/20' : 'bg-zinc-400 shadow-black/10'}`}>
                    <span className="font-black text-lg">{table.name.replace(/\D/g, '') || table.name.charAt(0)}</span>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-1">Status</p>
                    <div className={`flex items-center gap-1.5 justify-end font-black text-[10px] uppercase tracking-tighter ${isOccupied ? 'text-yellow-500' : 'text-zinc-500'}`}>
                      {isOccupied ? <AlertCircle size={10}/> : <CheckCircle2 size={10}/>}
                      {table.status}
                    </div>
                  </div>
                </div>

                {/* Identity */}
                <h3 className="text-3xl font-black uppercase tracking-tighter mb-1">{table.name}</h3>
                <div className="flex items-center gap-2 mb-8">
                  <User size={10} className="text-zinc-500" />
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                    {isOccupied ? `Assigned: ${table.waiter_name || 'Staff'}` : 'Unassigned'}
                  </p>
                </div>

                {/* Order Meta Section */}
                <div className={`rounded-3xl p-5 mb-8 transition-colors ${isDark ? 'bg-black/40' : 'bg-white/60'}`}>
                  {isOccupied ? (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <Clock size={12} className="text-zinc-500" />
                          <span className="text-[9px] font-black uppercase text-zinc-500">Order Age</span>
                        </div>
                        <span className="text-xs font-black">
                          {table.order_start ? new Date(table.order_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-white/5">
                        <span className="text-[9px] font-black uppercase text-zinc-500">Subtotal</span>
                        <span className="text-lg font-black text-yellow-500">
                          UGX {Number(table.current_total || 0).toLocaleString()}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="py-2 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      Ready for New Guests
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <button
                  onClick={() => onEditTable({ ...table, id: table.last_order_id })}
                  className={`w-full py-5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 ${
                    isOccupied 
                      ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/10 hover:bg-yellow-400" 
                      : "bg-zinc-800 text-white hover:bg-zinc-700"
                  }`}
                >
                  <Plus size={16} />
                  {isOccupied ? "Manage Order" : "Open New Bill"}
                  <ChevronRight size={14} className="ml-auto" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}