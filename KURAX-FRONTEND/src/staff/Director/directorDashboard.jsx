import React, { useState } from "react";
import { Edit3, Trash2 } from "lucide-react";
import { 
  Users, BarChart3, Wallet, Bell, Plus, ShieldCheck, 
  ArrowUpRight, ArrowDownRight, TrendingUp, Settings, 
  LogOut, LayoutDashboard, History, Banknote, Smartphone, 
  CreditCard, Clock, Menu, X, Eye, EyeOff 
} from "lucide-react";
import Logo from "../../customer/assets/images/logo.jpeg";
import Footer from "../../customer/components/common/Foooter";
import { RevenueChart } from "./charts";

export default function DirectorDashboard() {
  const [activeTab, setActiveTab] = useState("OVERVIEW"); 
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state
 
  const [user] = useState({ name: "Essah", role: "Director" });
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex h-screen bg-black text-slate-200 font-[Outfit] overflow-hidden">
      
      {/* SIDEBAR OVERLAY FOR MOBILE */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" 
          onClick={toggleSidebar}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#050505] border-r border-white/5 p-6 transition-transform duration-300 transform
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 md:flex md:flex-col
      `}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img src={Logo} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-yellow-500/20" />
            <div className="flex flex-col justify-center leading-tight">
              <h1 className="text-sm md:text-lg font-black text-white uppercase tracking-tighter leading-none">
                KURAX FOOD LOUNGE & BISTRO
              </h1>
              <p className="text-yellow-500 text-[10px] font-bold uppercase tracking-widest">ADMIN PANEL</p>
            </div>
          </div>
          <button className="md:hidden text-zinc-500" onClick={toggleSidebar}><X /></button>
        </div>

        <nav className="flex flex-col gap-2">
          <NavBtn icon={<LayoutDashboard size={18}/>} label="Overview" active={activeTab === "OVERVIEW"} onClick={() => {setActiveTab("OVERVIEW"); setIsSidebarOpen(false);}} />
          <NavBtn icon={<Users size={18}/>} label="Staff Management" active={activeTab === "STAFF"} onClick={() => {setActiveTab("STAFF"); setIsSidebarOpen(false);}} />
          <NavBtn icon={<BarChart3 size={18}/>} label="Financials" active={activeTab === "FINANCES"} onClick={() => {setActiveTab("FINANCES"); setIsSidebarOpen(false);}} />
          <NavBtn icon={<History size={18}/>} label="System History" active={activeTab === "HISTORY"} onClick={() => {setActiveTab("HISTORY"); setIsSidebarOpen(false);}} />
        </nav>

        <div className="mt-auto border-t border-white/5 pt-6">
          <button className="flex items-center gap-3 text-zinc-500 hover:text-rose-500 transition-colors font-bold text-sm w-full">
            <LogOut size={18} /> Logout Session
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-[#0a0a0a]">
        
        {/* HEADER */}
        <header className="p-4 md:p-8 border-b border-white/5 flex justify-between items-center bg-[#050505]/50 sticky top-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 bg-zinc-900 rounded-lg" onClick={toggleSidebar}>
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-lg md:text-xl font-black uppercase italic tracking-tight">
                Welcome, <span className="text-yellow-500">{user.name}</span>
              </h2>
              <p className="hidden md:block text-xs text-zinc-500 font-bold uppercase tracking-widest">
                {new Date().toDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="relative p-2 bg-zinc-900 rounded-full border border-white/5 cursor-pointer">
              <Bell size={18} />
              <div className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border-2 border-black"></div>
            </div>
            <div className="flex items-center gap-3 ml-2 md:ml-4">
            </div>
          </div>
        </header>

        {/* CONTENT SWITCHER */}
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto w-full">
          {/* Inside DirectorDashboard.jsx */}
{activeTab === "OVERVIEW" && (
  <OverviewSection 
    onViewRegistry={() => setActiveTab("HISTORY")} 
  />
)}
          {activeTab === "STAFF" && <StaffSection onAdd={() => setShowCreateAccount(true)} />}
          {activeTab === "FINANCES" && <FinancesSection />}
          {activeTab === "HISTORY" && <HistorySection />}
        </div>

         <Footer />
      </main>

      {showCreateAccount && <CreateStaffModal onClose={() => setShowCreateAccount(false)} />}
    </div>
  );
}

function OverviewSection({ onViewRegistry }){
  return (
    <div className="space-y-6 md:space-y-8">
      {/* 1. STATS GRID (Revenue, Cash, Momo, Card) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard label="Total Revenue" value={4850000} trend="+12%" color="text-emerald-500" icon={<TrendingUp size={14}/>} />
        <StatCard label="Cash" value={1250000} color="text-white" icon={<Banknote size={14}/>}/>
        <StatCard label="Momo" value={2100000} color="text-yellow-500" icon={<Smartphone size={14}/>}/>
        <StatCard label="Card" value={1500000} color="text-blue-500" icon={<CreditCard size={14}/>}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* 2. REVENUE CHART */}
        <div className="lg:col-span-2 bg-zinc-900/30 border border-white/5 rounded-3xl md:rounded-[2.5rem] p-5 md:p-8">
          <h3 className="text-sm md:text-lg font-black uppercase italic mb-2 text-white/50 tracking-widest">Revenue Flow</h3>
          <RevenueChart />
        </div>

        {/* 3. LIVE LOGS (Quick feed) */}
        <div className="bg-zinc-900/30 border border-white/5 rounded-3xl md:rounded-[2.5rem] p-5 md:p-8">
          <h3 className="text-sm md:text-lg font-black uppercase italic mb-6 tracking-widest">LIve System Logs</h3>
          <div className="space-y-5 md:space-y-6">
            <ActivityItem type="SHIFT" msg="Cashier John Doe ended shift" time="2m ago" color="bg-yellow-500" />
            <ActivityItem type="SALE" msg="Order #8241 closed - UGX 120,000" time="1h ago" color="bg-emerald-500" />
            <ActivityItem type="STAFF" msg="Chef Mike logged in" time="15m ago" color="bg-blue-500" />
          </div>
        </div>
      </div>

      {/* 4. SHIFT END ACTIVITY (Full Width Row) */}
      <div className="bg-zinc-900/30 border border-white/5 rounded-3xl md:rounded-[2.5rem] p-6 md:p-8">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="text-sm md:text-lg font-black uppercase italic text-white/50 tracking-widest">Recent Shift Liquidations</h3>
                <p className="text-[10px] text-zinc-600 font-bold uppercase">Final tallies from floor staff</p>
            </div>
            {/* Inside OverviewSection component */}
<button 
    onClick={onViewRegistry}
    className="text-[10px] font-black text-yellow-500 border border-yellow-500/20 px-4 py-2 rounded-xl hover:bg-yellow-500 hover:text-black transition-all"
>
    VIEW REGISTRY
</button>
        </div>
        
        {/* Grid for shift cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <ShiftMiniCard staff="John (Cashier)" cash="1.2M" momo="2.1M" card="1.5M" time="10:45 PM" />
            <ShiftMiniCard staff="Chef Brian (Kitchen)" status="CLEANED & CLOSED" time="11:15 PM" type="service" />
            <ShiftMiniCard staff="Alex (Waiter)" sales="450k" time="11:30 PM" type="service" />
        </div>
      </div>
    </div>
  );
}



function StaffSection({ onAdd }) {
    // Local state for demonstration - in production this comes from your DB
    const [staffList, setStaffList] = useState([
        { id: 1, name: "Sarah K.", role: "MANAGER", status: "ACTIVE" },
        { id: 2, name: "John Doe", role: "CASHIER", status: "OFF-DUTY" },
        { id: 3, name: "Chef Mike", role: "CHEF", status: "ACTIVE" }
    ]);

    const deleteStaff = (id) => {
        if(window.confirm("Are you sure you want to remove this staff member?")) {
            setStaffList(staffList.filter(s => s.id !== id));
        }
    };

    return (
        <div className="bg-zinc-900/30 border border-white/5 rounded-3xl md:rounded-[2.5rem] p-5 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 md:mb-10">
                <div>
                    <h3 className="text-lg md:text-xl font-black uppercase italic">Staff Ecosystem</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Manage access & permissions</p>
                </div>
                <button onClick={onAdd} className="w-full sm:w-auto bg-yellow-500 text-black px-6 py-3 rounded-2xl font-black uppercase italic text-xs flex justify-center items-center gap-2 transition-transform active:scale-95">
                    <Plus size={16}/> Create Account
                </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {staffList.map(staff => (
                    <StaffCard 
                        key={staff.id} 
                        name={staff.name} 
                        role={staff.role} 
                        status={staff.status} 
                        onDelete={() => deleteStaff(staff.id)}
                        onEdit={() => alert(`Editing ${staff.name}...`)}
                    />
                ))}
            </div>
        </div>
    );
}

// --- 4. HISTORY SECTION (Scrollable Table for Mobile) ---
function HistorySection() {
    const [subTab, setSubTab] = useState("ORDERS");

    return (
        <div className="space-y-6">
            <div className="flex gap-4 border-b border-white/5 pb-4 overflow-x-auto no-scrollbar">
                <button onClick={() => setSubTab("ORDERS")} className={`whitespace-nowrap text-xs font-black uppercase italic transition-colors ${subTab === 'ORDERS' ? 'text-yellow-500' : 'text-zinc-500'}`}>Global Orders</button>
                <button onClick={() => setSubTab("SHIFTS")} className={`whitespace-nowrap text-xs font-black uppercase italic transition-colors ${subTab === 'SHIFTS' ? 'text-yellow-500' : 'text-zinc-500'}`}>Shift Registry</button>
            </div>

            <div className="bg-zinc-900/30 border border-white/5 rounded-2xl overflow-hidden overflow-x-auto">
                {subTab === "ORDERS" ? (
                    <table className="w-full text-left min-w-[600px]">
                        <thead className="bg-white/5">
                            <tr className="text-[10px] font-black uppercase text-zinc-500">
                                <th className="p-4 md:p-6">ID</th>
                                <th className="p-4 md:p-6">Waitstaff</th>
                                <th className="p-4 md:p-6">Method</th>
                                <th className="p-4 md:p-6">Amount</th>
                                <th className="p-4 md:p-6">Time</th>
                                <th className="p-4 md:p-6">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            <OrderRow id="#8245" waiter="Alex" method="MOMO" amount={45000} time="14:20" status="PAID" />
                            <OrderRow id="#8244" waiter="Sarah" method="CASH" amount={120000} time="13:55" status="PAID" />
                            <OrderRow id="#8243" waiter="Alex" method="CARD" amount={35000} time="13:10" status="PAID" />
                        </tbody>
                    </table>
                ) : (
                    <table className="w-full text-left min-w-[600px]">
                        <thead className="bg-white/5">
                            <tr className="text-[10px] font-black uppercase text-zinc-500">
                                <th className="p-4 md:p-6">Staff Member</th>
                                <th className="p-6">Role</th>
                                <th className="p-6">Shift End</th>
                                <th className="p-6">Cash Reported</th>
                                <th className="p-6">Digital Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs font-bold uppercase italic">
                            <tr className="hover:bg-white/5">
                                <td className="p-6 text-white">John Doe</td>
                                <td className="p-6 text-zinc-500">CASHIER</td>
                                <td className="p-6 text-zinc-500">10:45 PM</td>
                                <td className="p-6 text-emerald-500">1,250,000</td>
                                <td className="p-6 text-blue-500">3,600,000</td>
                            </tr>
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// --- HELPERS (With slight responsive tweaks) ---

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm w-full ${active ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
      {icon} {label}
    </button>
  );
}

function StatCard({ label, value, trend, color, icon }) {
    return (
      <div className="bg-zinc-900/30 border border-white/5 p-5 md:p-6 rounded-3xl hover:bg-zinc-900/50 transition-all">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2 bg-black rounded-xl border border-white/5 ${color}`}>{icon}</div>
          {trend && <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg">{trend}</span>}
        </div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
        <h4 className="text-xl md:text-2xl font-black text-white italic tracking-tight">
          <span className="text-xs mr-1 not-italic opacity-30">UGX</span>{value.toLocaleString()}
        </h4>
      </div>
    );
}

function FinancesSection() {
    // Current Revenue (Fixed for this example)
    const revenue = {
        cash: 1250000,
        momo: 2100000,
        card: 1500000
    };

    // State for Expenses
    const [expenses, setExpenses] = useState(1800000);

    const totalRevenue = revenue.cash + revenue.momo + revenue.card;
    const netProfit = totalRevenue - expenses;
    
    // Formula: ((Revenue - Expenses) / Revenue) * 100
    const margin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

    return (
        <div className="space-y-6">
            {/* TOP BAR */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-zinc-900/30 border border-white/5 p-6 rounded-[2rem] gap-4">
                <div>
                    <h3 className="text-sm font-black uppercase italic text-white tracking-widest">Financial Controller</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">Revenue vs. Expenditure</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                     <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white text-black px-6 py-3 rounded-2xl font-black uppercase italic text-xs hover:bg-yellow-500 transition-colors">
                        <ArrowDownRight size={16} /> Export
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* EXPENSE INPUT CARD */}
                <div className="bg-zinc-900/30 border border-white/5 p-8 rounded-[2rem] flex flex-col justify-between">
                    <div>
                        <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-4">Set Daily Expenses</p>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold text-xs">UGX</span>
                            <input 
                                type="number" 
                                value={expenses}
                                onChange={(e) => setExpenses(Number(e.target.value))}
                                className="w-full bg-black border border-white/10 p-4 pl-12 rounded-2xl text-xl font-black text-white focus:border-yellow-500 outline-none transition-all"
                                placeholder="0"
                            />
                        </div>
                    </div>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase mt-4 italic">
                        *Include rent, stock, and wages
                    </p>
                </div>

                {/* DYNAMIC PROFIT MARGIN CARD */}
                <div className="bg-zinc-900/30 border border-white/5 p-8 rounded-[2rem] flex flex-col justify-center relative overflow-hidden">
                    {/* Background Glow based on profit */}
                    <div className={`absolute -right-4 -top-4 w-24 h-24 blur-3xl rounded-full ${Number(margin) > 0 ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`} />
                    
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Net Profit Margin</p>
                    <h4 className={`text-6xl font-black italic tracking-tighter transition-colors ${Number(margin) > 20 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {margin}%
                    </h4>
                    <div className="flex items-center gap-2 mt-2">
                        <TrendingUp size={14} className={Number(margin) > 0 ? "text-emerald-500" : "text-rose-500"} />
                        <p className="text-[10px] text-zinc-400 font-bold uppercase">
                            UGX {netProfit.toLocaleString()} Take-home
                        </p>
                    </div>
                </div>

                {/* SUMMARY MINI-LIST */}
                <div className="bg-zinc-900/30 border border-white/5 p-8 rounded-[2rem] space-y-4">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Revenue Breakdown</p>
                    <div className="space-y-3">
                        <FinanceRow label="Total Sales" value={totalRevenue} color="text-white" />
                        <FinanceRow label="Total Costs" value={expenses} color="text-rose-500" />
                        <div className="pt-2 border-t border-white/5">
                            <FinanceRow label="Net Balance" value={netProfit} color="text-emerald-500" bold />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Small helper for the list
function FinanceRow({ label, value, color, bold }) {
    return (
        <div className="flex justify-between items-center text-[11px] font-bold uppercase">
            <span className="text-zinc-500">{label}</span>
            <span className={`${color} ${bold ? 'text-sm font-black italic' : ''}`}>
                {value < 0 ? "-" : ""}UGX {Math.abs(value).toLocaleString()}
            </span>
        </div>
    );
}

function OrderRow({ id, waiter, method, amount, time, status }) {
  const methodColors = { 
    MOMO: "text-yellow-500", 
    CASH: "text-emerald-500", 
    CARD: "text-blue-500" 
  };

  return (
    <tr className="hover:bg-white/5 transition-colors group">
      <td className="p-4 md:p-6 font-black italic text-sm text-white">{id}</td>
      <td className="p-4 md:p-6 text-xs font-bold text-zinc-400 uppercase">{waiter}</td>
      <td className={`p-4 md:p-6 text-[10px] font-black tracking-widest ${methodColors[method] || "text-white"}`}>
        {method}
      </td>
      <td className="p-4 md:p-6 font-black text-sm">
        <span className="text-[10px] mr-1 opacity-30 not-italic">UGX</span>
        {amount.toLocaleString()}
      </td>
      <td className="p-4 md:p-6 text-[10px] font-bold text-zinc-500">{time}</td>
      <td className="p-4 md:p-6">
        <span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black px-2 py-1 rounded uppercase border border-emerald-500/20">
          {status}
        </span>
      </td>
    </tr>
  );
}

function StaffCard({ name, role, status, onEdit, onDelete }) {
    return (
        <div className="bg-black/40 border border-white/5 p-5 rounded-2xl flex flex-col gap-4 hover:border-yellow-500/30 transition-all group">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center font-black text-white border border-white/5">
                        {name[0]}
                    </div>
                    <div>
                        <p className="text-sm font-black text-white italic tracking-tight">{name}</p>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{role}</p>
                    </div>
                </div>
                <span className={`text-[8px] font-black px-2 py-1 rounded-md tracking-tighter ${
                    status === 'ACTIVE' 
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                        : 'bg-zinc-800 text-zinc-500'
                }`}>
                    {status}
                </span>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex gap-2 border-t border-white/5 pt-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={onEdit}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[9px] font-black uppercase italic transition-colors"
                >
                    <Edit3 size={12} className="text-yellow-500" /> Edit
                </button>
                <button 
                    onClick={onDelete}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg text-[9px] font-black uppercase italic text-rose-500 transition-colors"
                >
                    <Trash2 size={12} /> Delete
                </button>
            </div>
        </div>
    );
}

function ActivityItem({ type, msg, time, color }) {
  return (
    <div className="flex gap-4 items-start">
      {/* Visual indicator line */}
      <div className={`w-1.5 h-10 rounded-full shrink-0 ${color || 'bg-yellow-500/20'}`} />
      <div>
        <p className="text-xs font-bold text-white tracking-tight leading-snug">{msg}</p>
        <p className="text-[9px] font-black text-zinc-600 uppercase mt-1">
          {time} • <span className="text-zinc-500">{type}</span>
        </p>
      </div>
    </div>
  );
}

function ShiftMiniCard({ staff, cash, momo, card, time, type, status }) {
    return (
        <div className="bg-black/40 border border-white/5 p-4 rounded-xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="flex gap-4 items-center">
                <div className="p-2 bg-zinc-800 rounded-lg shrink-0"><Clock size={14} className="text-zinc-400"/></div>
                <div>
                    <p className="text-xs font-black text-white italic">{staff}</p>
                    <p className="text-[9px] font-bold text-zinc-600 uppercase">Clock-out {time}</p>
                    {status && <p className="text-[8px] text-emerald-500 font-black mt-1">{status}</p>}
                </div>
            </div>
            {type !== 'service' && (
                <div className="flex gap-3 text-[9px] font-black uppercase border-t border-white/5 sm:border-0 pt-2 sm:pt-0">
                    <span className="text-zinc-500">C: {cash}</span>
                    <span className="text-yellow-500">M: {momo}</span>
                    <span className="text-blue-500">CD: {card}</span>
                </div>
            )}
        </div>
    );
}

function CreateStaffModal({ onClose }) {
    // 1. Add state to toggle visibility
    const [showPin, setShowPin] = useState(false);

    return (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-[2.5rem] p-6 md:p-10 shadow-2xl">
                <h2 className="text-xl md:text-2xl font-black italic uppercase text-yellow-500 mb-6 md:mb-8">Staff Account</h2>
                
                <div className="space-y-4">
                    <input 
                        type="text" 
                        placeholder="FULL NAME" 
                        className="w-full bg-black border border-white/5 p-4 rounded-xl text-sm font-bold text-white focus:border-yellow-500 outline-none" 
                    />
                    
                    <select className="w-full bg-black border border-white/5 p-4 rounded-xl text-sm font-bold text-zinc-400 focus:border-yellow-500 outline-none">
                        <option>SELECT ROLE</option>
                        <option>WAITER</option>
                        <option>CASHIER</option>
                        <option>CHEF</option>
                    </select>

                    {/* 2. PIN INPUT WITH EYE TOGGLE */}
                    <div className="relative">
                        <input 
                            type={showPin ? "text" : "password"} 
                            placeholder="ASSIGN ACCESS PIN" 
                            className="w-full bg-black border border-white/5 p-4 rounded-xl text-sm font-bold text-white focus:border-yellow-500 outline-none pr-12" 
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPin(!showPin)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-yellow-500 transition-colors"
                        >
                            {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    <div className="flex gap-3 pt-6">
                        <button 
                            onClick={onClose} 
                            className="flex-1 py-4 text-zinc-500 font-black uppercase italic text-xs"
                        >
                            Cancel
                        </button>
                        <button className="flex-[2] py-4 bg-yellow-500 text-black rounded-2xl font-black uppercase italic text-sm transition-transform active:scale-95">
                            Activate
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}