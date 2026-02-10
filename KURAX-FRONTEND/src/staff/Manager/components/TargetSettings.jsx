
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { Target, TrendingUp, Users, Award } from "lucide-react";

export default function TargetSettings() {
  const { dailyGoal, setDailyGoal, staffList = [] } = useData() || {};
  const { theme } = useTheme();

  // Handle slider change
  const handleGoalChange = (e) => {
    setDailyGoal(Number(e.target.value));
  };

  return (
    <div className={`p-8 min-h-screen font-[Outfit] transition-colors duration-300 ${
      theme === 'dark' ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'
    }`}>
      <div className="max-w-2xl">
        <div className="mb-10">
          <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3">
            <Target className="text-yellow-500" size={32} />
            Performance Targets
          </h1>
          <p className="text-zinc-500 text-sm font-bold uppercase mt-2">
            Define the daily order goal for all floor staff
          </p>
        </div>

        {/* Main Control Card */}
        <div className={`p-8 rounded-[2.5rem] border mb-8 transition-all ${
          theme === 'dark' ? 'bg-zinc-900 border-white/5 shadow-2xl' : 'bg-white border-black/5 shadow-xl'
        }`}>
          <div className="flex justify-between items-end mb-8">
            <div>
              <p className="text-[10px] font-black uppercase text-yellow-500 tracking-widest mb-1">Current Daily Target</p>
              <h2 className="text-6xl font-black tracking-tighter">
                {dailyGoal || 20}<span className="text-sm text-zinc-500 ml-2 uppercase">Orders</span>
              </h2>
            </div>
            <TrendingUp className="text-emerald-500 mb-2" size={40} />
          </div>

          <div className="space-y-6">
            <input 
              type="range" 
              min="5" 
              max="100" 
              step="5"
              value={dailyGoal || 20}
              onChange={handleGoalChange}
              className="w-full h-3 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
            />
            
            <div className="flex justify-between text-[10px] font-black uppercase text-zinc-500">
              <span>Minimum: 5</span>
              <span>Maximum: 100</span>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-zinc-900/50 border-white/5' : 'bg-white border-black/5'}`}>
            <Users className="text-blue-500 mb-3" size={24} />
            <h4 className="text-xs font-black uppercase mb-1">Active Staff</h4>
            <p className="text-2xl font-black">{staffList.length}</p>
            <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">Personnel on floor</p>
          </div>

          <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-zinc-900/50 border-white/5' : 'bg-white border-black/5'}`}>
            <Award className="text-orange-500 mb-3" size={24} />
            <h4 className="text-xs font-black uppercase mb-1">Global Impact</h4>
            <p className="text-[9px] text-zinc-500 font-bold leading-relaxed uppercase">
              Updating this value changes the progress bars for all Waiters and Supervisors in real-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}