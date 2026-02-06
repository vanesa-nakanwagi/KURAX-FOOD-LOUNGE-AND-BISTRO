import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Logo from "../../customer/assets/images/logo.jpeg";

import { 
  Users, BarChart3, Wallet, Bell, Plus, ShieldCheck, 
  ArrowUpRight, ArrowDownRight, TrendingUp, Settings, 
  LogOut, LayoutDashboard, History, Banknote, Smartphone, CreditCard, Clock
} from "lucide-react";

// --- MAIN DASHBOARD COMPONENT ---
export default function DirectorDashboard() {
  const [activeTab, setActiveTab] = useState("OVERVIEW"); 
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  
  // Dynamic user state - Can be set via login later
  const [user] = useState({ name: "Essah", role: "Director" });

  return (
    <div className="flex h-screen bg-black text-slate-200 font-[Outfit] overflow-hidden">
      
                 <aside className="hidden md:flex w-72 flex-col bg-[#050505] border-r border-white/5 p-6">
                  <div className="flex items-center gap-3">

                     <img src={Logo} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-yellow-500/20" />
                    <div className="flex flex-col justify-center leading-tight">
       {/* Main Brand Name */}
       <h1 className="text-sm md:text-lg font-black text-white uppercase tracking-tighter leading-none">
         KURAX FOOD LOUNGE & BISTRO
       </h1>
       
       <p className="text-yellow-500 text-xs font-bold uppercase tracking-widest mb-6">
  ADMIN PANEL
</p>
     </div>
      </div>
  <nav className="flex flex-col gap-2">
    <NavBtn icon={<LayoutDashboard size={18}/>} label="Overview" active={activeTab === "OVERVIEW"} onClick={() => setActiveTab("OVERVIEW")} />
    <NavBtn icon={<Users size={18}/>} label="Staff Management" active={activeTab === "STAFF"} onClick={() => setActiveTab("STAFF")} />
    <NavBtn icon={<BarChart3 size={18}/>} label="Financials" active={activeTab === "FINANCES"} onClick={() => setActiveTab("FINANCES")} />
    <NavBtn icon={<History size={18}/>} label="System History" active={activeTab === "HISTORY"} onClick={() => setActiveTab("HISTORY")} />
  </nav>

  <div className="mt-auto border-t border-white/5 pt-6">
    <button className="flex items-center gap-3 text-zinc-500 hover:text-rose-500 transition-colors font-bold text-sm">
      <LogOut size={18} /> Logout Session
    </button>
  </div>
</aside>



      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-[#0a0a0a]">
        
        {/* HEADER */}
        <header className="p-8 border-b border-white/5 flex justify-between items-center bg-[#050505]/50 sticky top-0 z-10 backdrop-blur-md">
          <div>
            <h2 className="text-xl font-black uppercase italic tracking-tight">
                Welcome, <span className="text-yellow-500">{user.name}</span>
            </h2>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
  {new Date().toDateString()}
</p>

          </div>
          <div className="flex items-center gap-4">
            <div className="relative p-2 bg-zinc-900 rounded-full border border-white/5 cursor-pointer">
              <Bell size={20} />
              <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-black"></div>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <div className="text-right">
                <p className="text-[10px] font-black text-white uppercase">{user.name}</p>
                <p className="text-[9px] font-bold text-yellow-500 uppercase tracking-widest">{user.role}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-500 to-amber-200 border border-white/10" />
            </div>
          </div>
        </header>

        {/* CONTENT SWITCHER */}
        <div className="p-8">
          {activeTab === "OVERVIEW" && <OverviewSection />}
          {activeTab === "STAFF" && <StaffSection onAdd={() => setShowCreateAccount(true)} />}
          {activeTab === "FINANCES" && <FinancesSection />}
          {activeTab === "HISTORY" && <HistorySection />}
        </div>
      </main>

      {/* MODAL */}
      {showCreateAccount && <CreateStaffModal onClose={() => setShowCreateAccount(false)} />}
    </div>
  );
}

// --- 1. OVERVIEW SECTION ---
function OverviewSection() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Revenue" value={4850000} trend="+12%" color="text-emerald-500" icon={<TrendingUp size={16}/>} />
        <StatCard label="Cash" value={1250000} color="text-white" icon={<Banknote size={16}/>}/>
        <StatCard label="Momo" value={2100000} color="text-yellow-500" icon={<Smartphone size={16}/>}/>
        <StatCard label="Card" value={1500000} color="text-blue-500" icon={<CreditCard size={16}/>}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-zinc-900/30 border border-white/5 rounded-[2.5rem] p-8">
          <h3 className="text-lg font-black uppercase italic mb-8 text-white/50">Shift End Activity</h3>
          <div className="space-y-4">
             <ShiftMiniCard staff="John (Cashier)" cash="1.2M" momo="2.1M" card="1.5M" time="10:45 PM" />
             <ShiftMiniCard staff="Chef Brian (Kitchen)" status="CLEANED & CLOSED" time="11:15 PM" type="service" />
             <ShiftMiniCard staff="Alex (Waiter)" sales="450k" time="11:30 PM" type="service" />
          </div>
        </div>

        <div className="bg-zinc-900/30 border border-white/5 rounded-[2.5rem] p-8">
          <h3 className="text-lg font-black uppercase italic mb-6">Live Logs</h3>
          <div className="space-y-6">
            <ActivityItem type="SHIFT" msg="Cashier John Doe ended shift" time="2m ago" color="bg-yellow-500" />
            <ActivityItem type="STAFF" msg="Chef Mike logged in" time="15m ago" />
            <ActivityItem type="SALE" msg="Order #8241 closed - UGX 120,000" time="1h ago" />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- 2. STAFF SECTION ---
function StaffSection({ onAdd }) {
    return (
        <div className="bg-zinc-900/30 border border-white/5 rounded-[2.5rem] p-8">
            <div className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black uppercase italic">Staff Ecosystem</h3>
                <button onClick={onAdd} className="bg-yellow-500 text-black px-6 py-3 rounded-2xl font-black uppercase italic text-xs flex items-center gap-2 transition-transform active:scale-95">
                    <Plus size={16}/> Create Account
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StaffCard name="Sarah K." role="MANAGER" status="ACTIVE" />
                <StaffCard name="John Doe" role="CASHIER" status="OFF-DUTY" />
                <StaffCard name="Chef Mike" role="CHEF" status="ACTIVE" />
            </div>
        </div>
    );
}

// --- 3. FINANCES SECTION ---
function FinancesSection() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-zinc-900/30 border border-white/5 p-6 rounded-[2rem]">
                <div>
                    <h3 className="text-sm font-black uppercase italic text-white">Financial Statement</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">Consolidated Data</p>
                </div>
                <button className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-2xl font-black uppercase italic text-xs hover:bg-yellow-500 transition-colors">
                    <ArrowDownRight size={16} /> Export PDF Report
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-900/30 border border-white/5 p-8 rounded-[2rem]">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Net Profit Margin</p>
                    <h4 className="text-4xl font-black text-emerald-500 italic tracking-tighter">64.2%</h4>
                </div>

                {/* LIQUIDATION CARD */}
                <div className="bg-zinc-900/30 border border-white/5 p-8 rounded-[2rem] border-l-4 border-l-yellow-500">
                    <div className="flex justify-between items-start mb-4">
                        <h4 className="font-black uppercase italic text-lg text-yellow-500">Latest Liquidation</h4>
                        <ShieldCheck size={20} className="text-yellow-500" />
                    </div>
                    <p className="text-[10px] font-bold text-zinc-400 mb-6 uppercase">Cashier: John Doe • 10:45 PM</p>
                    
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-black rounded-xl border border-white/5">
                            <p className="text-[7px] font-black text-zinc-500 uppercase">Cash</p>
                            <p className="font-black text-[10px] italic">1,250,000</p>
                        </div>
                        <div className="p-3 bg-black rounded-xl border border-white/5">
                            <p className="text-[7px] font-black text-zinc-500 uppercase">Momo</p>
                            <p className="font-black text-[10px] italic">2,100,000</p>
                        </div>
                        <div className="p-3 bg-black rounded-xl border border-white/5">
                            <p className="text-[7px] font-black text-zinc-500 uppercase">Card</p>
                            <p className="font-black text-[10px] italic">1,500,000</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- 4. HISTORY SECTION ---
function HistorySection() {
    const [subTab, setSubTab] = useState("ORDERS"); // ORDERS or SHIFTS

    return (
        <div className="space-y-6">
            <div className="flex gap-4 border-b border-white/5 pb-4">
                <button onClick={() => setSubTab("ORDERS")} className={`text-xs font-black uppercase italic transition-colors ${subTab === 'ORDERS' ? 'text-yellow-500' : 'text-zinc-500'}`}>Global Orders</button>
                <button onClick={() => setSubTab("SHIFTS")} className={`text-xs font-black uppercase italic transition-colors ${subTab === 'SHIFTS' ? 'text-yellow-500' : 'text-zinc-500'}`}>Shift Registry</button>
            </div>

            <div className="bg-zinc-900/30 border border-white/5 rounded-2xl overflow-hidden">
                {subTab === "ORDERS" ? (
                    <table className="w-full text-left">
                        <thead className="bg-white/5">
                            <tr className="text-[10px] font-black uppercase text-zinc-500">
                                <th className="p-6">ID</th>
                                <th className="p-6">Waitstaff</th>
                                <th className="p-6">Method</th>
                                <th className="p-6">Amount</th>
                                <th className="p-6">Time</th>
                                <th className="p-6">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            <OrderRow id="#8245" waiter="Alex" method="MOMO" amount={45000} time="14:20" status="PAID" />
                            <OrderRow id="#8244" waiter="Sarah" method="CASH" amount={120000} time="13:55" status="PAID" />
                            <OrderRow id="#8243" waiter="Alex" method="CARD" amount={35000} time="13:10" status="PAID" />
                        </tbody>
                    </table>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-white/5">
                            <tr className="text-[10px] font-black uppercase text-zinc-500">
                                <th className="p-6">Staff Member</th>
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
                            <tr className="hover:bg-white/5">
                                <td className="p-6 text-white">Chef Mike</td>
                                <td className="p-6 text-zinc-500">CHEF</td>
                                <td className="p-6 text-zinc-500">11:05 PM</td>
                                <td className="p-6 text-zinc-700">N/A</td>
                                <td className="p-6 text-zinc-700">N/A</td>
                            </tr>
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// --- UI HELPERS ---

function StatCard({ label, value, trend, color, icon }) {
  return (
    <div className="bg-zinc-900/30 border border-white/5 p-6 rounded-[2rem] hover:bg-zinc-900/50 transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 bg-black rounded-xl border border-white/5 ${color}`}>{icon}</div>
        {trend && <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg">{trend}</span>}
      </div>
      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
      <h4 className="text-2xl font-black text-white italic tracking-tight">
        <span className="text-sm mr-1 not-italic opacity-30">UGX</span>{value.toLocaleString()}
      </h4>
    </div>
  );
}

function ShiftMiniCard({ staff, cash, momo, card, time, type, status }) {
    return (
        <div className="bg-black/40 border border-white/5 p-4 rounded-xl flex justify-between items-center">
            <div className="flex gap-4 items-center">
                <div className="p-2 bg-zinc-800 rounded-lg"><Clock size={14} className="text-zinc-400"/></div>
                <div>
                    <p className="text-xs font-black text-white italic">{staff}</p>
                    <p className="text-[9px] font-bold text-zinc-600 uppercase">Clock-out at {time}</p>
                    {status && <p className="text-[8px] text-emerald-500 font-black">{status}</p>}
                </div>
            </div>
            {type !== 'service' && (
                <div className="flex gap-3 text-[9px] font-black uppercase">
                    <span className="text-zinc-500">C: {cash}</span>
                    <span className="text-yellow-500">M: {momo}</span>
                    <span className="text-blue-500">CD: {card}</span>
                </div>
            )}
        </div>
    );
}

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm w-full ${active ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
      {icon} {label}
    </button>
  );
}

function ActivityItem({ type, msg, time, color }) {
    return (
        <div className="flex gap-4 items-start">
            <div className={`w-1.5 h-10 rounded-full ${color || 'bg-yellow-500/20'}`} />
            <div>
                <p className="text-xs font-bold text-white tracking-tight">{msg}</p>
                <p className="text-[9px] font-black text-zinc-600 uppercase mt-1">{time} • {type}</p>
            </div>
        </div>
    );
}

function OrderRow({ id, waiter, method, amount, time, status }) {
    const methodColors = { MOMO: "text-yellow-500", CASH: "text-emerald-500", CARD: "text-blue-500" };
    return (
        <tr className="hover:bg-white/5 transition-colors group">
            <td className="p-6 font-black italic text-sm">{id}</td>
            <td className="p-6 text-xs font-bold text-zinc-400">{waiter}</td>
            <td className={`p-6 text-[10px] font-black tracking-widest ${methodColors[method]}`}>{method}</td>
            <td className="p-6 font-black text-sm">UGX {amount.toLocaleString()}</td>
            <td className="p-6 text-[10px] font-bold text-zinc-500">{time}</td>
            <td className="p-6">
                <span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black px-2 py-1 rounded uppercase">{status}</span>
            </td>
        </tr>
    );
}

function StaffCard({ name, role, status }) {
    return (
        <div className="bg-black/40 border border-white/5 p-5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center font-black text-white">{name[0]}</div>
                <div>
                    <p className="text-sm font-black text-white">{name}</p>
                    <p className="text-[10px] font-bold text-zinc-500">{role}</p>
                </div>
            </div>
            <span className={`text-[8px] font-black px-2 py-1 rounded-md ${status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}>{status}</span>
        </div>
    );
}

function CreateStaffModal({ onClose }) {
    const [showPin, setShowPin] = useState(false);

    return (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-[3rem] p-10 shadow-2xl">
                <h2 className="text-2xl font-black italic uppercase text-yellow-500 mb-8">Create Staff Account</h2>
                
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
                        <option>ACCOUNTANT</option>
                        <option>CONTENT-MANAGER</option>
                        <option>MANAGER</option>
                        <option>SUPERVISOR</option>
                    </select>

                    {/* PIN INPUT WITH EYE TOGGLE */}
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
                            className="flex-1 py-4 text-zinc-500 font-black uppercase italic text-xs hover:text-white"
                        >
                            Cancel
                        </button>
                        <button className="flex-[2] py-4 bg-yellow-500 text-black rounded-2xl font-black uppercase italic text-sm transition-transform active:scale-95 shadow-xl shadow-yellow-500/10">
                            Activate User
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}