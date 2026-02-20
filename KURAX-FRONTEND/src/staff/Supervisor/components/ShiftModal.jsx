
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { 
  Flag, Banknote, CreditCard, Smartphone, 
  X, Send, ShieldCheck, TrendingUp 
} from "lucide-react";

export default function ShiftReportModal({ isOpen, onClose }) {
  const { orders = [], currentUser, updateStaffPerformance } = useData() || {};
  const { theme } = useTheme();
  
  if (!isOpen) return null;

  const today = new Date().toISOString().split('T')[0];
  const waiterName = currentUser?.name || "Staff";

  // Filter orders for the current user today
  const myShiftOrders = orders.filter(order => {
    const orderDate = order.timestamp ? new Date(order.timestamp).toISOString().split('T')[0] : "";
    return order.waiterName === waiterName && orderDate === today;
  });

  const totals = myShiftOrders.reduce((acc, order) => {
    const method = order.paymentMethod || 'Cash';
    acc[method] = (acc[method] || 0) + (order.total || 0);
    acc.all += (order.total || 0);
    return acc;
  }, { Cash: 0, Card: 0, Momo: 0, all: 0 });

  const handleCompleteShift = () => {
    // 1. Send data to the Director's staff list
    if(updateStaffPerformance) {
        updateStaffPerformance(waiterName, totals.all);
    }
    
    // 2. Alert success & Close
    alert(`Shift Finalized! UGX ${totals.all.toLocaleString()} sent to Director.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Card */}
      <div className={`relative w-full max-w-lg rounded-[2.5rem] border overflow-hidden shadow-2xl transition-all animate-in zoom-in-95 duration-300 ${
        theme === 'dark' ? 'bg-zinc-950 border-white/10' : 'bg-white border-black/5'
      }`}>
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-2">
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-500">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {/* Total Revenue Display */}
          <div className="text-center py-4">
            <p className="text-[10px] font-black uppercase text-zinc-500 mb-1">Grand Total Collected</p>
            <h3 className="text-4xl font-black tracking-tighter text-yellow-500 italic">
              UGX {totals.all.toLocaleString()}
            </h3>
          </div>

          {/* Mini Breakdown */}
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Cash" value={totals.Cash} color="text-emerald-500" theme={theme} />
            <MiniStat label="Momo" value={totals.Momo} color="text-yellow-600" theme={theme} />
            <MiniStat label="Card" value={totals.Card} color="text-blue-500" theme={theme} />
          </div>

          {/* Stats Bar */}
          <div className={`p-4 rounded-2xl flex justify-between items-center ${theme === 'dark' ? 'bg-white/5' : 'bg-zinc-100'}`}>
            <div className="flex items-center gap-2">
               <TrendingUp size={16} className="text-zinc-500" />
               <span className="text-[10px] font-black uppercase">Orders Processed</span>
            </div>
            <span className="font-black italic">{myShiftOrders.length}</span>
          </div>

          <div className="space-y-3">
            <p className="text-[9px] text-center font-bold text-zinc-500 uppercase leading-relaxed px-4">
              By clicking "Complete & Send", your total collections will be reported to the Director's staff dashboard.
            </p>
            
            <button 
              onClick={handleCompleteShift}
              className="w-full py-4 bg-emerald-500 text-black rounded-2xl text-[11px] font-black uppercase italic flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <Send size={16} /> Complete & Send to Director
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color, theme }) {
  return (
    <div className={`p-3 rounded-2xl border text-center ${theme === 'dark' ? 'bg-zinc-900 border-white/5' : 'bg-zinc-50 border-black/5'}`}>
      <p className="text-[8px] font-black uppercase text-zinc-500 mb-1">{label}</p>
      <p className={`text-[10px] font-black tracking-tighter ${color}`}>
        {value > 0 ? value.toLocaleString() : '0'}
      </p>
    </div>
  );
}