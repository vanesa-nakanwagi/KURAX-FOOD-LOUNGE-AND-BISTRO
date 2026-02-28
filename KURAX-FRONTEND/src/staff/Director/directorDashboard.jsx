import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, BarChart3, Bell, Plus,
  ArrowDownRight, TrendingUp, Settings,
  LogOut, LayoutDashboard, History, Banknote, Smartphone, Target,
  CreditCard, Clock, Menu, X, Eye, EyeOff, Flame, RefreshCcw, Search,
  ShieldAlert, Mail, Trash2, Sun, Moon, ChevronRight, AlertTriangle,
  Package, Coffee, Wine,
  FileText, CalendarDays, BarChart2, BookOpen
} from "lucide-react";

import Logo from "../../customer/assets/images/logo.jpeg";
import Footer from "../../customer/components/common/Foooter";
import { RevenueChart } from "./charts";
import { useData } from "../../customer/components/context/DataContext";
import DirectorTargetView from "./DirectorTargetView";
import API_URL from "../../config/api";

// ─────────────────────────────────────────────
// THEME CONTEXT
// ─────────────────────────────────────────────
const ThemeContext = React.createContext({ dark: true, t: {} });
function useTheme() { return React.useContext(ThemeContext); }

function buildTheme(dark) {
  return {
    bg:        dark ? "bg-[#0a0a0a]"                : "bg-[#f4f0e8]",
    sidebar:   dark ? "bg-[#050505] border-white/5"  : "bg-white border-zinc-200",
    header:    dark ? "bg-[#050505]/90 border-white/5" : "bg-white/90 border-zinc-200",
    card:      dark ? "bg-zinc-900/40 border-white/5"  : "bg-white border-zinc-200",
    text:      dark ? "text-slate-200"   : "text-zinc-900",
    subtext:   dark ? "text-zinc-500"    : "text-zinc-500",
    input:     dark ? "bg-black border-white/10 text-white placeholder-zinc-600"
                    : "bg-zinc-100 border-zinc-300 text-zinc-900 placeholder-zinc-400",
    divider:   dark ? "border-white/5"   : "border-zinc-200",
    rowHover:  dark ? "hover:bg-white/5" : "hover:bg-zinc-50",
    navActive: "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20",
    navIdle:   dark ? "text-zinc-500 hover:text-white hover:bg-white/5"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100",
    mobileNav: dark ? "bg-[#050505]/95 border-white/5" : "bg-white/95 border-zinc-200",
  };
}

// ─────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────
export default function DirectorDashboard() {
  const navigate = useNavigate();
  const [dark, setDark]                   = useState(true);
  const [activeTab, setActiveTab]         = useState("OVERVIEW");
  const [showCreateAccount, setShowCreate] = useState(false);
  const [isSidebarOpen, setSidebarOpen]   = useState(false);
  const [currentUser, setCurrentUser]     = useState(null);
  const [editingStaff, setEditingStaff]   = useState(null);
  const [staffModalData, setStaffModal]   = useState(null);

  const { staffList, setStaffList, orders = [] } = useData();
  const t = buildTheme(dark);

  // ── Auth ────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (!saved) { navigate("/staff/login"); return; }
    try {
      const p = JSON.parse(saved);
      if (p.role.toUpperCase() !== "DIRECTOR") navigate("/staff/login");
      else setCurrentUser(p);
    } catch { navigate("/staff/login"); }
  }, [navigate]);

  // ── Fetch staff ─────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${API_URL}/api/staff`);
        if (res.ok) {
          const data = await res.json();
          setStaffList(Array.isArray(data) ? data : []);
        }
      } catch (e) { console.error("Staff pull failed:", e); }
    })();
  }, [setStaffList]);

  // ── Save staff (create + edit) ───────────────
  const handleSaveStaff = async (payload) => {
    const isEdit = !!payload.id;
    const url    = isEdit ? `${API_URL}/api/staff/update/${payload.id}` : `${API_URL}/api/staff/activate`;
    try {
      const res    = await fetch(url, { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (res.ok && result.staff) {
        setStaffList(prev => isEdit ? prev.map(s => s.id === result.staff.id ? result.staff : s) : [...prev, result.staff]);
        setShowCreate(false);
        setEditingStaff(null);
      } else { alert(result.error || "Failed to save."); }
    } catch (e) { console.error("Save error:", e); }
  };

  // ── Terminate ────────────────────────────────
  const handleTerminate = async (id, name) => {
    if (!window.confirm(`Terminate ${name}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/staff/terminate/${id}`, { method: "DELETE" });
      if (res.ok) setStaffList(prev => prev.filter(s => s.id !== id));
      else alert("Could not terminate account.");
    } catch { alert("Network error."); }
  };

  // ── Toggle permission ────────────────────────
  const handleToggle = async (id, current) => {
    try {
      const res = await fetch(`${API_URL}/api/staff/toggle-permission/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_permitted: !current }),
      });
      if (res.ok) setStaffList(prev => prev.map(s => s.id === id ? { ...s, is_permitted: !current } : s));
      else { const e = await res.json(); alert(e.error || "Permission update failed."); }
    } catch { alert("Connection error."); }
  };

  const handleLogout = () => { localStorage.removeItem("user"); navigate("/staff/login"); };

  const handleCardClick = useCallback((staff, stats) => setStaffModal({ staff, stats }), []);

  if (!currentUser) return (
    <div className="h-[100dvh] bg-black flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const NAV = [
    { icon: <LayoutDashboard size={18}/>, label: "Overview",   tab: "OVERVIEW"  },
    { icon: <Users size={18}/>,           label: "Staff",      tab: "STAFF"     },
    { icon: <BarChart3 size={18}/>,       label: "Finances",   tab: "FINANCES"  },
    { icon: <History size={18}/>,         label: "History",    tab: "HISTORY"   },
    { icon: <Target size={18}/>,          label: "Targets",    tab: "TARGETS"   },
  ];

  return (
    <ThemeContext.Provider value={{ dark, t }}>
      <div className={`flex h-[100dvh] ${t.bg} ${t.text} font-[Outfit] overflow-hidden transition-colors duration-300`}>

        {/* Sidebar overlay */}
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── SIDEBAR ─────────────────────────── */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-60 ${t.sidebar} border-r p-5 flex flex-col
          transition-transform duration-300
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0
        `}>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 min-w-0">
              <img src={Logo} alt="" className="w-8 h-8 rounded-xl object-cover border border-yellow-500/20 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-tighter leading-none truncate">KURAX FOOD LOUNGE</p>
                <p className="text-yellow-500 text-[8px] font-bold uppercase tracking-widest">ADMIN PANEL</p>
              </div>
            </div>
            <button className="md:hidden p-1.5" onClick={() => setSidebarOpen(false)}><X size={16}/></button>
          </div>

          <nav className="flex flex-col gap-1.5">
            {NAV.map(({ icon, label, tab }) => (
              <button key={tab} onClick={() => { setActiveTab(tab); setSidebarOpen(false); }}
                className={`flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-bold transition-all w-full text-left ${activeTab === tab ? t.navActive : t.navIdle}`}>
                {icon} {label}
              </button>
            ))}
          </nav>

          <div className={`mt-auto pt-5 border-t ${t.divider} space-y-1.5`}>
            <button onClick={() => setDark(p => !p)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-2xl text-sm font-bold transition-all ${dark ? "text-zinc-400 hover:text-yellow-500 hover:bg-white/5" : "text-zinc-500 hover:text-yellow-600 hover:bg-zinc-100"}`}>
              {dark ? <Sun size={15}/> : <Moon size={15}/>}
              {dark ? "Light Mode" : "Dark Mode"}
            </button>
            <button onClick={handleLogout}
              className="flex items-center gap-3 text-zinc-500 hover:text-rose-500 transition-colors text-sm font-bold w-full px-3 py-2.5">
              <LogOut size={15}/> Logout
            </button>
          </div>
        </aside>

        {/* ── MAIN ────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Header */}
          <header className={`px-4 py-3 border-b flex justify-between items-center sticky top-0 z-30 backdrop-blur-md shrink-0 ${t.header}`}>
            <div className="flex items-center gap-3 min-w-0">
              <button className={`md:hidden p-2 rounded-xl shrink-0 ${dark ? "bg-zinc-900" : "bg-zinc-100"}`} onClick={() => setSidebarOpen(true)}>
                <Menu size={17}/>
              </button>
              <div className="min-w-0">
                <h2 className="text-md font-black uppercase ">
                  Welcome Back, <span className="text-yellow-500">{currentUser?.name}</span>
                </h2>
                <p className={`hidden sm:block text-[9px] font-bold uppercase tracking-widest ${t.subtext}`}>{new Date().toDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setDark(p => !p)}
                className={`p-1.5 rounded-full border transition-all ${dark ? "bg-zinc-900 border-white/5 text-zinc-400 hover:text-yellow-500" : "bg-white border-zinc-200 text-zinc-500 hover:text-yellow-600"}`}>
                {dark ? <Sun size={14}/> : <Moon size={14}/>}
              </button>
              <div className={`relative p-1.5 rounded-full border cursor-pointer ${dark ? "border-white/5" : "border-zinc-200"}`}>
                <Bell size={15}/>
                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full"/>
              </div>
            </div>
          </header>

          {/* Scrollable body */}
          <main className="flex-1 overflow-y-auto overscroll-contain">
            <div className="p-3 sm:p-5 md:p-8 max-w-[1600px] mx-auto w-full pb-24 md:pb-8">
              {activeTab === "OVERVIEW" && <OverviewSection onViewRegistry={() => setActiveTab("HISTORY")}/>}
              {activeTab === "TARGETS"  && <div className="animate-in fade-in duration-500"><DirectorTargetView/></div>}
              {activeTab === "STAFF"    && (
                <StaffSection
                  currentUser={currentUser}
                  onAdd={() => { setEditingStaff(null); setShowCreate(true); }}
                  onEdit={staff => { setEditingStaff(staff); setShowCreate(true); }}
                  staffList={staffList}
                  setStaffList={setStaffList}
                  orders={orders}
                  onTogglePermission={handleToggle}
                  onTerminate={handleTerminate}
                  onCardClick={handleCardClick}
                />
              )}
              {activeTab === "FINANCES" && <FinancesSection/>}
              {activeTab === "HISTORY"  && <HistorySection/>}
            </div>
            <Footer/>
          </main>

          {/* ── MOBILE BOTTOM NAV ────────────── */}
          <nav className={`md:hidden fixed bottom-0 inset-x-0 z-30 border-t flex items-center justify-around px-1 py-1.5 ${t.mobileNav}`}
               style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
            {NAV.map(({ icon, label, tab }) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all flex-1 ${activeTab === tab ? "text-yellow-500" : dark ? "text-zinc-600" : "text-zinc-400"}`}>
                <span className={`transition-transform ${activeTab === tab ? "scale-110" : ""}`}>{icon}</span>
                <span className="text-[8px] font-black uppercase tracking-wide">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* ── MODALS ──────────────────────────── */}
        {showCreateAccount && (
          <CreateStaffModal
            onClose={() => { setShowCreate(false); setEditingStaff(null); }}
            onSave={handleSaveStaff}
            initialData={editingStaff}
            staffList={staffList}
          />
        )}
        {staffModalData && (
          <StaffAnalyticsModal
            staff={staffModalData.staff}
            stats={staffModalData.stats}
            orders={orders}
            onClose={() => setStaffModal(null)}
          />
        )}
      </div>
    </ThemeContext.Provider>
  );
}

// ─────────────────────────────────────────────
// STAFF ANALYTICS MODAL
// ─────────────────────────────────────────────
function StaffAnalyticsModal({ staff, stats, orders, onClose }) {
  const { dark, t } = useTheme();
  const role  = staff.role?.toUpperCase();
  const today = new Date().toISOString().split("T")[0];

  const todayOrders = (orders || []).filter(o => {
    const d = new Date(o.created_at || o.timestamp || 0).toISOString().split("T")[0];
    return d === today;
  });

  let content = null;

  if (["WAITER","MANAGER","SUPERVISOR"].includes(role)) {
    const my   = todayOrders.filter(o => o.staff_id === staff.id || o.waiter_id === staff.id);
    const cash = my.filter(o => o.payment_method === "CASH").reduce((s,o) => s+Number(o.total||0), 0);
    const momo = my.filter(o => o.payment_method === "MOMO").reduce((s,o) => s+Number(o.total||0), 0);
    const card = my.filter(o => o.payment_method === "CARD").reduce((s,o) => s+Number(o.total||0), 0);
    content = (
      <div className="space-y-3">
        <MRow label="Total Orders Taken"   value={my.length} color="text-white"/>
        <MRow label="Total Transactions"   value={my.filter(o => o.status==="PAID"||o.status==="CLOSED").length} color="text-emerald-400"/>
        <div className={`border-t ${t.divider} pt-3 space-y-3`}>
          <MRow label="Total Cash"  value={`UGX ${cash.toLocaleString()}`} color="text-emerald-400"/>
          <MRow label="Total MoMo"  value={`UGX ${momo.toLocaleString()}`} color="text-yellow-400"/>
          <MRow label="Total Card"  value={`UGX ${card.toLocaleString()}`} color="text-blue-400"/>
        </div>
        <div className="border-t border-yellow-500/20 pt-3">
          <MRow label="Total Gross Income (Today)" value={`UGX ${(cash+momo+card).toLocaleString()}`} color="text-yellow-500" large/>
        </div>
      </div>
    );

  } else if (["CHEF","BARISTA","BARMAN"].includes(role)) {
    const sm  = { CHEF:"kitchen", BARISTA:"barista", BARMAN:"bar" };
    const ic  = { CHEF:<Package size={22}/>, BARISTA:<Coffee size={22}/>, BARMAN:<Wine size={22}/> };
    const stn = sm[role];
    const cnt = todayOrders.filter(o =>
      (o.station||o.department||"").toLowerCase()===stn ||
      (Array.isArray(o.items) && o.items.some(i=>(i.station||"").toLowerCase()===stn))
    ).length;
    content = (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <div className={`p-4 rounded-2xl ${dark?"bg-blue-500/10 text-blue-400":"bg-blue-50 text-blue-600"}`}>{ic[role]}</div>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${t.subtext}`}>Orders from {stn}</p>
        <p className={`text-6xl font-black italic ${dark?"text-white":"text-zinc-900"}`}>{cnt}</p>
        <p className={`text-xs ${t.subtext}`}>orders completed today</p>
      </div>
    );

  } else if (role === "CASHIER") {
    const confirmed = todayOrders.filter(o => o.cashier_id===staff.id||o.confirmed_by===staff.id);
    const allPaid   = todayOrders.filter(o => o.status==="PAID"||o.status==="CLOSED");
    const petty  = confirmed.filter(o=>o.payment_method==="PETTY").reduce((s,o)=>s+Number(o.total||0),0);
    const cash   = allPaid.filter(o=>o.payment_method==="CASH").reduce((s,o)=>s+Number(o.total||0),0);
    const momo   = allPaid.filter(o=>o.payment_method==="MOMO").reduce((s,o)=>s+Number(o.total||0),0);
    const card   = allPaid.filter(o=>o.payment_method==="CARD").reduce((s,o)=>s+Number(o.total||0),0);
    const credit = allPaid.filter(o=>o.payment_method==="CREDIT").reduce((s,o)=>s+Number(o.total||0),0);
    content = (
      <div className="space-y-3">
        <MRow label="Orders Confirmed & Closed"   value={confirmed.length}              color="text-emerald-400"/>
        <MRow label="Total Petty Cash"             value={`UGX ${petty.toLocaleString()}`} color="text-zinc-300"/>
        <div className={`border-t ${t.divider} pt-3 space-y-3`}>
          <MRow label="Cash at Hand" value={`UGX ${cash.toLocaleString()}`}  color="text-emerald-400"/>
          <MRow label="Total MoMo"   value={`UGX ${momo.toLocaleString()}`}  color="text-yellow-400"/>
          <MRow label="Total Card"   value={`UGX ${card.toLocaleString()}`}  color="text-blue-400"/>
        </div>
        <div className={`border-t ${t.divider} pt-3 space-y-3`}>
          <MRow label="Total Gross"              value={`UGX ${(cash+momo+card).toLocaleString()}`} color="text-white"/>
          <MRow label="Total Credit (On-Account)" value={`UGX ${credit.toLocaleString()}`}          color="text-rose-400"/>
        </div>
      </div>
    );

  } else if (role === "ACCOUNTANT") {
    const paid = todayOrders.filter(o=>o.status==="PAID"||o.status==="CLOSED");
    const cash = paid.filter(o=>o.payment_method==="CASH").reduce((s,o)=>s+Number(o.total||0),0);
    const momo = paid.filter(o=>o.payment_method==="MOMO").reduce((s,o)=>s+Number(o.total||0),0);
    const card = paid.filter(o=>o.payment_method==="CARD").reduce((s,o)=>s+Number(o.total||0),0);
    const exp  = cash+momo+card;
    const rep  = staff.reported_cash || cash;
    const v    = rep - exp;
    content = (
      <div className="space-y-3">
        <MRow label="Total Cash at Hand"  value={`UGX ${cash.toLocaleString()}`} color="text-emerald-400"/>
        <MRow label="Total MoMo"          value={`UGX ${momo.toLocaleString()}`} color="text-yellow-400"/>
        <MRow label="Total Card"          value={`UGX ${card.toLocaleString()}`} color="text-blue-400"/>
        <div className={`border-t ${t.divider} pt-3`}>
          <MRow label="System Expected" value={`UGX ${exp.toLocaleString()}`} color="text-white"/>
        </div>
        <div className={`border-t pt-3 ${v===0?"border-emerald-500/20":"border-rose-500/20"}`}>
          <MRow label={`Variance (${v>=0?"Surplus":"Shortage"})`} value={`UGX ${Math.abs(v).toLocaleString()}`}
            color={v===0?"text-emerald-400":v>0?"text-yellow-400":"text-rose-400"} large/>
          {v!==0 && (
            <div className="flex items-center gap-1.5 mt-2 text-[9px] font-bold uppercase text-rose-400/70">
              <AlertTriangle size={9}/> Discrepancy — investigation required
            </div>
          )}
        </div>
      </div>
    );

  } else if (role === "CONTENT-MANAGER") {
    content = <ContentManagerStats staffId={staff.id} today={today}/>;

  } else {
    content = (
      <div className="py-12 text-center">
        <ShieldAlert size={28} className="mx-auto text-zinc-600 mb-3"/>
        <p className={`text-[10px] font-bold uppercase ${t.subtext}`}>No analytics for this role</p>
      </div>
    );
  }

  const roleColors = {
    WAITER:"text-emerald-400", MANAGER:"text-yellow-500", SUPERVISOR:"text-yellow-400",
    CHEF:"text-blue-400", BARISTA:"text-purple-400", BARMAN:"text-orange-400",
    CASHIER:"text-emerald-400", ACCOUNTANT:"text-rose-400", "CONTENT-MANAGER":"text-fuchsia-400",
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-xl flex items-end sm:items-center justify-center">
      <div className={`
        w-full sm:max-w-md sm:mx-4 rounded-t-[2rem] sm:rounded-[2rem] p-5 sm:p-8 shadow-2xl border
        max-h-[90dvh] flex flex-col
        ${dark?"bg-zinc-900 border-white/10":"bg-white border-zinc-200"}
      `}>
        {/* Drag handle */}
        <div className="sm:hidden flex justify-center mb-3 shrink-0">
          <div className="w-10 h-1 rounded-full bg-zinc-600"/>
        </div>

        {/* Header */}
        <div className="flex justify-between items-start mb-5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border shrink-0 ${dark?"bg-zinc-800 border-white/5":"bg-zinc-100 border-zinc-200"}`}>
              {staff.name?.[0]?.toUpperCase()||"?"}
            </div>
            <div className="min-w-0">
              <p className="font-black uppercase text-sm truncate">{staff.name}</p>
              <p className={`text-[9px] font-bold uppercase tracking-widest ${roleColors[role]||"text-zinc-400"}`}>{role}</p>
              <p className={`text-[8px] ${t.subtext}`}>{new Date().toDateString()} — Daily</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-xl shrink-0 ml-2 ${dark?"hover:bg-white/5 text-zinc-500":"hover:bg-zinc-100 text-zinc-400"}`}>
            <X size={15}/>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 min-h-0">{content}</div>

        <button onClick={onClose}
          className="mt-5 w-full py-3.5 bg-yellow-500 text-black font-black uppercase italic text-sm rounded-2xl hover:bg-yellow-400 transition-colors shrink-0">
          Close
        </button>
      </div>
    </div>
  );
}

function MRow({ label, value, color, large }) {
  const { t } = useTheme();
  return (
    <div className="flex justify-between items-center gap-3">
      <span className={`text-[10px] font-bold uppercase tracking-wide shrink-0 ${t.subtext}`}>{label}</span>
      <span className={`${color} font-black text-right ${large?"text-base italic":"text-sm"}`}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// CONTENT MANAGER STATS
// ─────────────────────────────────────────────
function ContentManagerStats({ staffId, today }) {
  const { dark, t } = useTheme();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/content-manager/daily-stats?staffId=${staffId}&date=${today}`);
        if (!res.ok) throw new Error("Failed");
        setData(await res.json());
      } catch { setError("Could not load stats."); }
      finally { setLoading(false); }
    })();
  }, [staffId, today]);

  if (loading) return (
    <div className="flex flex-col items-center py-10 gap-3">
      <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"/>
      <p className={`text-[9px] font-bold uppercase tracking-widest ${t.subtext}`}>Loading…</p>
    </div>
  );
  if (error) return (
    <div className="flex flex-col items-center py-8 gap-2">
      <AlertTriangle size={22} className="text-rose-400"/>
      <p className="text-[10px] font-bold uppercase text-rose-400">{error}</p>
    </div>
  );

  const items = [
    { label:"Total Menus",    value: data?.totalMenus   ?? 0, color:"text-fuchsia-400", bg: dark?"bg-fuchsia-500/10":"bg-fuchsia-50", icon:<FileText size={14}/> },
    { label:"Total Events",   value: data?.totalEvents  ?? 0, color:"text-yellow-400",  bg: dark?"bg-yellow-500/10" :"bg-yellow-50",  icon:<CalendarDays size={14}/> },
    { label:"Total Views",    value:(data?.totalViews   ?? 0).toLocaleString(), color:"text-blue-400", bg: dark?"bg-blue-500/10":"bg-blue-50", icon:<BarChart2 size={14}/> },
    { label:"Total Bookings", value: data?.totalBookings ?? 0, color:"text-emerald-400", bg: dark?"bg-emerald-500/10":"bg-emerald-50", icon:<BookOpen size={14}/> },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(({ label, value, color, bg, icon }) => (
        <div key={label} className={`${dark?"bg-zinc-800/50 border-white/5":"bg-zinc-50 border-zinc-200"} border rounded-2xl p-4 flex flex-col gap-2`}>
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${bg} ${color}`}>{icon}</div>
          <p className={`text-[8px] font-black uppercase tracking-widest ${t.subtext}`}>{label}</p>
          <p className={`text-2xl font-black italic ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// STAFF SECTION
// ─────────────────────────────────────────────
function StaffSection({ onAdd, staffList, setStaffList, orders, onEdit, currentUser, onTogglePermission, onTerminate, onCardClick }) {
  const { dark, t } = useTheme();
  const [search, setSearch] = useState("");
  const today = new Date().toISOString().split("T")[0];

  const filtered = (staffList || []).filter(s => {
    if (!s?.id) return false;
    const term = search.toLowerCase();
    return ((s.name||"").toLowerCase().includes(term) || (s.role||"").toLowerCase().includes(term)) && s.id !== currentUser?.id;
  });

  const getTodayStats = (staff) => {
    const my = (orders||[]).filter(o => {
      const d = new Date(o.created_at||o.timestamp||0).toISOString().split("T")[0];
      return (o.staff_id===staff.id||o.waiter_id===staff.id) && d===today;
    });
    return {
      my,
      allPaid: (orders||[]).filter(o => {
        const d = new Date(o.created_at||o.timestamp||0).toISOString().split("T")[0];
        return d===today && (o.status==="PAID"||o.status==="CLOSED");
      }),
      totalOrders:  my.length,
      totalRevenue: my.reduce((s,o)=>s+Number(o.total||0),0),
      CASH: my.filter(o=>o.payment_method==="CASH").reduce((s,o)=>s+Number(o.total||0),0),
      MOMO: my.filter(o=>o.payment_method==="MOMO").reduce((s,o)=>s+Number(o.total||0),0),
      CARD: my.filter(o=>o.payment_method==="CARD").reduce((s,o)=>s+Number(o.total||0),0),
    };
  };

  return (
    <div className={`${t.card} border rounded-2xl md:rounded-[2.5rem] p-4 md:p-8`}>
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base md:text-xl font-black uppercase italic">Staff Ecosystem</h3>
            <p className={`text-[9px] font-bold uppercase tracking-widest ${t.subtext}`}>Access Control & Roles</p>
          </div>
          <button onClick={onAdd}
            className="bg-yellow-500 text-black px-4 py-2.5 rounded-xl font-black uppercase italic text-[10px] flex items-center gap-1.5 hover:bg-yellow-400 transition-colors shrink-0">
            <Plus size={13}/> New
          </button>
        </div>
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.subtext}`} size={14}/>
          <input type="text" placeholder="Search name or role…" value={search} onChange={e=>setSearch(e.target.value)}
            className={`w-full ${t.input} border p-3 pl-9 rounded-xl text-sm font-bold focus:border-yellow-500/50 outline-none`}/>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
        {filtered.map(staff => (
          <StaffCard key={staff.id} staff={staff}
            onEdit={() => onEdit(staff)}
            onDelete={() => onTerminate(staff.id, staff.name)}
            onTogglePermission={() => onTogglePermission(staff.id, staff.is_permitted)}
            onCardClick={() => onCardClick(staff, getTodayStats(staff))}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center border border-dashed border-white/5 rounded-2xl mt-4">
          <p className="text-zinc-600 font-black uppercase italic text-[9px] tracking-[0.2em]">No Staff Members Found</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// STAFF CARD
// ─────────────────────────────────────────────
function StaffCard({ staff, onTogglePermission, onDelete, onEdit, onCardClick }) {
  const { dark, t } = useTheme();
  const role         = staff.role?.toUpperCase() || "";
  const isDirector   = role === "DIRECTOR";
  const isManagement = ["MANAGER","SUPERVISOR"].includes(role);
  const isClickable  = ["WAITER","MANAGER","SUPERVISOR","CHEF","BARISTA","BARMAN","CASHIER","ACCOUNTANT","CONTENT-MANAGER"].includes(role);

  const roleColor = ({
    DIRECTOR:"text-rose-500", MANAGER:"text-yellow-500", SUPERVISOR:"text-yellow-400",
    WAITER:"text-emerald-400", CASHIER:"text-blue-400", CHEF:"text-indigo-400",
    BARISTA:"text-purple-400", BARMAN:"text-orange-400", ACCOUNTANT:"text-pink-400",
    "CONTENT-MANAGER":"text-fuchsia-400",
  })[role] || "text-zinc-400";

  return (
    <div className={`border rounded-2xl p-4 flex flex-col gap-3 transition-all ${dark?"bg-black/50 border-white/5 hover:border-white/10":"bg-white border-zinc-200 hover:border-zinc-300"}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          onClick={isClickable ? onCardClick : undefined}
          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border shrink-0 transition-colors
            ${isDirector ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" : dark?"bg-zinc-800 text-white border-white/5":"bg-zinc-100 text-zinc-700 border-zinc-200"}
            ${isClickable?"cursor-pointer":""}`}>
          {staff.name?.[0]?.toUpperCase()||"?"}
        </div>

        {/* Info */}
        <div onClick={isClickable ? onCardClick : undefined} className={`flex-1 min-w-0 ${isClickable?"cursor-pointer":""}`}>
          <p className="text-sm font-black uppercase italic leading-tight truncate flex items-center gap-1">
            {staff.name}
            {isClickable && <ChevronRight size={11} className={`shrink-0 ${t.subtext}`}/>}
          </p>
          <p className={`text-[9px] font-bold uppercase tracking-widest ${roleColor}`}>{staff.role}</p>
          <p className={`text-[9px] flex items-center gap-1 mt-0.5 ${dark?"text-zinc-600":"text-zinc-400"}`}>
            <Mail size={8} className="shrink-0"/>
            <span className="truncate">{staff.email}</span>
          </p>
        </div>

        {/* Toggle (managers/supervisors only) */}
        {!isDirector && isManagement && (
          <button onClick={onTogglePermission}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-xl border transition-all shrink-0 text-[8px] font-black uppercase
              ${staff.is_permitted
                ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500"
                : dark?"bg-zinc-800 border-zinc-700 text-zinc-500":"bg-zinc-100 border-zinc-200 text-zinc-400"}`}>
            {staff.is_permitted ? <Flame size={10}/> : <EyeOff size={10}/>}
            <span className="hidden xs:inline">{staff.is_permitted?"Busy":"Std"}</span>
          </button>
        )}
      </div>

      {/* Footer */}
      <div className={`flex items-center justify-between pt-3 border-t ${t.divider}`}>
        <button onClick={onEdit}
          className={`flex items-center gap-1.5 text-[9px] font-black uppercase transition-colors ${dark?"text-zinc-500 hover:text-white":"text-zinc-400 hover:text-zinc-800"}`}>
          <Settings size={11}/> Edit
        </button>
        {!isDirector && (
          <button onClick={onDelete}
            className="flex items-center gap-1.5 text-[9px] font-black uppercase text-zinc-600 hover:text-rose-500 transition-colors">
            <Trash2 size={11}/> Terminate
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// OVERVIEW
// ─────────────────────────────────────────────
function OverviewSection({ onViewRegistry }) {
  const { dark, t } = useTheme();

  // ── Daily revenue summary ─────────────────
  const [summary, setSummary]       = useState(null);
  const [summaryLoading, setSumLoad] = useState(true);

  // ── Recent system logs ────────────────────
  const [logs, setLogs]             = useState([]);
  const [logsLoading, setLogsLoad]  = useState(true);

  // ── Shift liquidations ────────────────────
  const [shifts, setShifts]         = useState([]);
  const [shiftsLoading, setShiftsLoad] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    // 1. Revenue summary for today
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/overview/summary?date=${today}`);
        if (res.ok) setSummary(await res.json());
      } catch (e) { console.error("Summary fetch failed:", e); }
      finally { setSumLoad(false); }
    })();

    // 2. Live activity logs (last 10 events)
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/overview/logs?limit=5`);
        if (res.ok) setLogs(await res.json());
      } catch (e) { console.error("Logs fetch failed:", e); }
      finally { setLogsLoad(false); }
    })();

    // 3. Shift liquidations for today
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/overview/shifts?date=${today}`);
        if (res.ok) setShifts(await res.json());
      } catch (e) { console.error("Shifts fetch failed:", e); }
      finally { setShiftsLoad(false); }
    })();
  }, [today]);

  // Derive trend vs yesterday if backend returns yesterday_revenue
  const todayRevenue    = summary?.total_revenue    ?? 0;
  const yesterdayRev    = summary?.yesterday_revenue ?? null;
  const revenueTrend    = yesterdayRev && yesterdayRev > 0
    ? `${todayRevenue >= yesterdayRev ? "+" : ""}${(((todayRevenue - yesterdayRev) / yesterdayRev) * 100).toFixed(1)}%`
    : null;

  // Map log type → color
  const logColor = (type) => ({
    SHIFT: "bg-yellow-500",
    SALE:  "bg-emerald-500",
    STAFF: "bg-blue-500",
    ORDER: "bg-emerald-500",
    ERROR: "bg-rose-500",
  })[type?.toUpperCase()] || "bg-zinc-500";

  // Format time since log
  const timeAgo = (ts) => {
    if (!ts) return "";
    const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="space-y-4">

      {/* ── STAT CARDS ─────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Revenue"
          value={summaryLoading ? null : todayRevenue}
          trend={revenueTrend}
          color="text-emerald-500"
          icon={<TrendingUp size={12}/>}
          loading={summaryLoading}
        />
        <StatCard
          label="Cash"
          value={summaryLoading ? null : (summary?.total_cash ?? 0)}
          color="text-white"
          icon={<Banknote size={12}/>}
          loading={summaryLoading}
        />
        <StatCard
          label="MoMo"
          value={summaryLoading ? null : (summary?.total_momo ?? 0)}
          color="text-yellow-500"
          icon={<Smartphone size={12}/>}
          loading={summaryLoading}
        />
        <StatCard
          label="Card"
          value={summaryLoading ? null : (summary?.total_card ?? 0)}
          color="text-blue-500"
          icon={<CreditCard size={12}/>}
          loading={summaryLoading}
        />
      </div>

      {/* ── CHART + LIVE LOGS ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`lg:col-span-2 ${t.card} border rounded-2xl p-4 md:p-8`}>
          <h3 className={`text-xs font-black uppercase italic mb-3 tracking-widest ${t.subtext}`}>Revenue Flow</h3>
          <div className="w-full overflow-hidden"><RevenueChart/></div>
        </div>

        <div className={`${t.card} border rounded-2xl p-4 md:p-8`}>
          <h3 className="text-xs font-black uppercase italic mb-4 tracking-widest">Live Logs</h3>
          {logsLoading ? (
            <div className="flex flex-col gap-3">
              {[1,2,3].map(i => (
                <div key={i} className={`h-10 rounded-xl animate-pulse ${dark?"bg-zinc-800":"bg-zinc-100"}`}/>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className={`text-[10px] font-bold uppercase ${t.subtext} text-center py-6`}>No activity yet today</p>
          ) : (
            <div className="space-y-4">
              {logs.map((log, i) => (
                <ActivityItem
                  key={log.id ?? i}
                  type={log.type}
                  msg={log.message}
                  time={timeAgo(log.created_at)}
                  color={logColor(log.type)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── SHIFT LIQUIDATIONS ─────────────── */}
      <div className={`${t.card} border rounded-2xl p-4 md:p-8`}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className={`text-xs font-black uppercase italic tracking-widest ${t.subtext}`}>Shift Liquidations</h3>
            <p className={`text-[8px] font-bold uppercase ${dark?"text-zinc-600":"text-zinc-400"}`}>Final tallies</p>
          </div>
          <button onClick={onViewRegistry}
            className="text-[9px] font-black text-yellow-500 border border-yellow-500/20 px-3 py-1.5 rounded-xl hover:bg-yellow-500 hover:text-black transition-all shrink-0">
            REGISTRY
          </button>
        </div>

        {shiftsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1,2,3].map(i => (
              <div key={i} className={`h-16 rounded-xl animate-pulse ${dark?"bg-zinc-800":"bg-zinc-100"}`}/>
            ))}
          </div>
        ) : shifts.length === 0 ? (
          <div className={`py-10 text-center border border-dashed rounded-2xl ${dark?"border-white/5":"border-zinc-200"}`}>
            <p className={`text-[9px] font-black uppercase italic tracking-widest ${dark?"text-zinc-600":"text-zinc-400"}`}>
              No shifts ended today
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {shifts.map((shift, i) => {
              const isServiceRole = ["CHEF","BARISTA","BARMAN"].includes(shift.role?.toUpperCase());
              return (
                <ShiftMiniCard
                  key={shift.id ?? i}
                  staff={`${shift.staff_name} (${shift.role})`}
                  time={shift.clock_out ? new Date(shift.clock_out).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "--:--"}
                  type={isServiceRole ? "service" : "cashier"}
                  status={isServiceRole ? shift.status ?? "" : undefined}
                  cash={isServiceRole ? undefined : fmtK(shift.total_cash)}
                  momo={isServiceRole ? undefined : fmtK(shift.total_momo)}
                  card={isServiceRole ? undefined : fmtK(shift.total_card)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Format large numbers as compact strings e.g. 1200000 → "1.2M"
function fmtK(val) {
  const n = Number(val || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ─────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────
function HistorySection() {
  const { dark, t } = useTheme();
  const [sub, setSub]           = useState("ORDERS");
  const [orders, setOrders]     = useState([]);
  const [shifts, setShifts]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const PER_PAGE = 20;

  useEffect(() => {
    setLoading(true);
    setPage(1);
    if (sub === "ORDERS") {
      (async () => {
        try {
          const res = await fetch(`${API_URL}/api/history/orders?limit=100`);
          if (res.ok) setOrders(await res.json());
        } catch (e) { console.error("Orders history fetch failed:", e); }
        finally { setLoading(false); }
      })();
    } else {
      (async () => {
        try {
          const res = await fetch(`${API_URL}/api/history/shifts?limit=100`);
          if (res.ok) setShifts(await res.json());
        } catch (e) { console.error("Shifts history fetch failed:", e); }
        finally { setLoading(false); }
      })();
    }
  }, [sub]);

  const paginated = (arr) => arr.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = (arr) => Math.max(1, Math.ceil(arr.length / PER_PAGE));

  const Skeleton = () => (
    <tr>
      {[1,2,3,4,5,6].map(i => (
        <td key={i} className="p-3 md:p-5">
          <div className={`h-4 rounded-lg animate-pulse ${dark?"bg-zinc-800":"bg-zinc-100"}`}/>
        </td>
      ))}
    </tr>
  );

  return (
    <div className="space-y-4">
      <div className={`flex gap-4 border-b pb-3 overflow-x-auto ${t.divider}`}>
        {["ORDERS","SHIFTS"].map(tab => (
          <button key={tab} onClick={() => setSub(tab)}
            className={`whitespace-nowrap text-xs font-black uppercase italic transition-colors ${sub===tab?"text-yellow-500":t.subtext}`}>
            {tab==="ORDERS" ? "Global Orders" : "Shift Registry"}
          </button>
        ))}
      </div>

      <div className={`${t.card} border rounded-2xl overflow-hidden overflow-x-auto`}>
        {sub === "ORDERS" ? (
          <>
            <table className="w-full text-left min-w-[480px]">
              <thead className={dark?"bg-white/5":"bg-zinc-50"}>
                <tr className={`text-[9px] font-black uppercase ${t.subtext}`}>
                  {["ID","Staff","Method","Amount","Time","Status"].map(h=><th key={h} className="p-3 md:p-5">{h}</th>)}
                </tr>
              </thead>
              <tbody className={`divide-y ${dark?"divide-white/5":"divide-zinc-100"}`}>
                {loading
                  ? [1,2,3,4,5].map(i => <Skeleton key={i}/>)
                  : paginated(orders).map(order => (
                      <OrderRow
                        key={order.id}
                        id={`#${order.id}`}
                        waiter={order.staff_name || order.waiter_name || "—"}
                        method={order.payment_method || "—"}
                        amount={Number(order.total || 0)}
                        time={order.created_at ? new Date(order.created_at).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}) : "—"}
                        status={order.status || "—"}
                      />
                    ))
                }
              </tbody>
            </table>
            {!loading && orders.length === 0 && (
              <p className={`text-center py-8 text-[10px] font-black uppercase ${t.subtext}`}>No orders found</p>
            )}
          </>
        ) : (
          <>
            <table className="w-full text-left min-w-[440px]">
              <thead className={dark?"bg-white/5":"bg-zinc-50"}>
                <tr className={`text-[9px] font-black uppercase ${t.subtext}`}>
                  {["Staff","Role","Shift End","Cash Reported","Digital Total"].map(h=><th key={h} className="p-3 md:p-5">{h}</th>)}
                </tr>
              </thead>
              <tbody className={`divide-y text-xs font-bold uppercase italic ${dark?"divide-white/5":"divide-zinc-100"}`}>
                {loading
                  ? [1,2,3,4,5].map(i => <Skeleton key={i}/>)
                  : paginated(shifts).map((shift, i) => (
                      <tr key={shift.id ?? i} className={t.rowHover}>
                        <td className="p-3 md:p-5">{shift.staff_name || "—"}</td>
                        <td className={`p-3 md:p-5 ${t.subtext}`}>{shift.role || "—"}</td>
                        <td className={`p-3 md:p-5 ${t.subtext}`}>
                          {shift.clock_out ? new Date(shift.clock_out).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}) : "—"}
                        </td>
                        <td className="p-3 md:p-5 text-emerald-500">
                          {Number(shift.total_cash || 0).toLocaleString()}
                        </td>
                        <td className="p-3 md:p-5 text-blue-500">
                          {(Number(shift.total_momo || 0) + Number(shift.total_card || 0)).toLocaleString()}
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
            {!loading && shifts.length === 0 && (
              <p className={`text-center py-8 text-[10px] font-black uppercase ${t.subtext}`}>No shifts on record</p>
            )}
          </>
        )}
      </div>

      {/* Pagination */}
      {!loading && (() => {
        const arr   = sub === "ORDERS" ? orders : shifts;
        const total = totalPages(arr);
        if (total <= 1) return null;
        return (
          <div className="flex items-center justify-between">
            <p className={`text-[9px] font-bold uppercase ${t.subtext}`}>
              Page {page} of {total} — {arr.length} records
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${page===1 ? "opacity-30 cursor-not-allowed" : "bg-yellow-500 text-black hover:bg-yellow-400"}`}>
                Prev
              </button>
              <button onClick={() => setPage(p => Math.min(total, p+1))} disabled={page===total}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${page===total ? "opacity-30 cursor-not-allowed" : "bg-yellow-500 text-black hover:bg-yellow-400"}`}>
                Next
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────
// FINANCES
// ─────────────────────────────────────────────
function FinancesSection() {
  const { dark, t } = useTheme();
  const [revenue, setRevenue]   = useState({ cash: 0, momo: 0, card: 0 });
  const [revLoading, setRevLoad] = useState(true);
  const [expenses, setExpenses] = useState(0);
  const [expSaving, setExpSaving] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/overview/summary?date=${today}`);
        if (res.ok) {
          const data = await res.json();
          setRevenue({
            cash: Number(data.total_cash || 0),
            momo: Number(data.total_momo || 0),
            card: Number(data.total_card || 0),
          });
          // Pre-fill saved daily expenses if the backend stores them
          if (data.daily_expenses != null) setExpenses(Number(data.daily_expenses));
        }
      } catch (e) { console.error("Finance summary failed:", e); }
      finally { setRevLoad(false); }
    })();
  }, [today]);

  // Save expenses to backend when director changes them
  const saveExpenses = async (value) => {
    setExpSaving(true);
    try {
      await fetch(`${API_URL}/api/overview/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, amount: value }),
      });
    } catch (e) { console.error("Expense save failed:", e); }
    finally { setExpSaving(false); }
  };

  const total  = revenue.cash + revenue.momo + revenue.card;
  const net    = total - expenses;
  const margin = total > 0 ? ((net / total) * 100).toFixed(1) : 0;

  const Pulse = () => <div className={`h-6 w-24 rounded-lg animate-pulse ${dark?"bg-zinc-800":"bg-zinc-200"}`}/>;

  return (
    <div className="space-y-4">
      <div className={`flex justify-between items-center ${t.card} border p-4 rounded-2xl gap-3`}>
        <div>
          <h3 className="text-sm font-black uppercase italic">Financial Controller</h3>
          <p className={`text-[9px] font-bold uppercase ${t.subtext}`}>Revenue vs. Expenditure — {today}</p>
        </div>
        <button
          onClick={async () => {
            try {
              const res = await fetch(`${API_URL}/api/overview/export?date=${today}`);
              if (res.ok) {
                const blob = await res.blob();
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement("a");
                a.href = url; a.download = `finances_${today}.csv`; a.click();
                URL.revokeObjectURL(url);
              } else { alert("Export not available yet."); }
            } catch { alert("Export failed — check server."); }
          }}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black uppercase italic text-[10px] transition-colors shrink-0 ${dark?"bg-white text-black hover:bg-yellow-500":"bg-zinc-900 text-white hover:bg-yellow-500 hover:text-black"}`}>
          <ArrowDownRight size={13}/> Export
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Expense input */}
        <div className={`${t.card} border p-5 rounded-2xl flex flex-col gap-4`}>
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">Daily Expenses</p>
            {expSaving && <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"/>}
          </div>
          <div className="relative">
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs ${t.subtext}`}>UGX</span>
            <input
              type="number"
              value={expenses}
              onChange={e => setExpenses(Number(e.target.value))}
              onBlur={e => saveExpenses(Number(e.target.value))}
              className={`w-full ${t.input} border p-3.5 pl-12 rounded-xl text-lg font-black focus:border-yellow-500 outline-none`}
            />
          </div>
          <p className={`text-[8px] font-bold uppercase italic ${t.subtext}`}>*rent, stock, wages — auto-saved on blur</p>
        </div>

        {/* Profit margin */}
        <div className={`${t.card} border p-5 rounded-2xl flex flex-col justify-center relative overflow-hidden`}>
          <div className={`absolute -right-4 -top-4 w-20 h-20 blur-3xl rounded-full ${Number(margin)>0?"bg-emerald-500/20":"bg-rose-500/20"}`}/>
          <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${t.subtext}`}>Net Profit Margin</p>
          {revLoading
            ? <Pulse/>
            : <h4 className={`text-5xl font-black italic ${Number(margin)>20?"text-emerald-500":"text-rose-500"}`}>{margin}%</h4>
          }
          <p className={`text-[10px] font-bold uppercase mt-2 ${t.subtext}`}>
            {revLoading ? "—" : `UGX ${net.toLocaleString()} take-home`}
          </p>
        </div>

        {/* Breakdown */}
        <div className={`${t.card} border p-5 rounded-2xl space-y-3`}>
          <p className={`text-[9px] font-black uppercase tracking-widest ${t.subtext}`}>Breakdown</p>
          {revLoading ? (
            <div className="space-y-3">{[1,2,3].map(i=><Pulse key={i}/>)}</div>
          ) : (
            <>
              <FinanceRow label="Cash Sales"  value={revenue.cash} color="text-emerald-400"/>
              <FinanceRow label="MoMo Sales"  value={revenue.momo} color="text-yellow-400"/>
              <FinanceRow label="Card Sales"  value={revenue.card} color="text-blue-400"/>
              <FinanceRow label="Total Sales" value={total}        color="text-white"/>
              <FinanceRow label="Total Costs" value={expenses}     color="text-rose-500"/>
              <div className={`pt-2 border-t ${t.divider}`}>
                <FinanceRow label="Net Balance" value={net} color="text-emerald-500" bold/>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CREATE / EDIT MODAL
// ─────────────────────────────────────────────
function CreateStaffModal({ onClose, onSave, initialData, staffList }) {
  const { dark, t } = useTheme();
  const [showPin, setShowPin]           = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm]                 = useState({ id:null, name:"", email:"", role:"SELECT ROLE", pin:"" });

  useEffect(() => {
    if (initialData) setForm({ id:initialData.id, name:initialData.name, email:initialData.email||"", role:initialData.role, pin:initialData.pin });
    else setForm({ id:null, name:"", email:"", role:"SELECT ROLE", pin:"" });
  }, [initialData]);

  const genPin = () => { setForm(p=>({...p,pin:Math.floor(1000+Math.random()*9000).toString()})); setShowPin(true); };

  const submit = async () => {
    setIsSubmitting(true);
    if (!form.name||!form.email||form.role==="SELECT ROLE"||!form.pin) { alert("Fill in all fields!"); setIsSubmitting(false); return; }
    if (form.pin.length!==4) { alert("PIN must be 4 digits."); setIsSubmitting(false); return; }
    const taken = (staffList||[]).find(s=>String(s.pin)===String(form.pin)&&s.id!==form.id);
    if (taken) { alert(`PIN ${form.pin} taken by ${taken.name}.`); setIsSubmitting(false); return; }
    try { await onSave({...form}); } catch { alert("Something went wrong."); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex items-end sm:items-center justify-center">
      <div className={`
        w-full sm:max-w-md sm:mx-4 rounded-t-[2rem] sm:rounded-[2rem] p-5 sm:p-10 shadow-2xl border
        max-h-[95dvh] overflow-y-auto
        ${dark?"bg-zinc-900 border-white/10":"bg-white border-zinc-200"}
      `}>
        <div className="sm:hidden flex justify-center mb-4"><div className="w-10 h-1 rounded-full bg-zinc-600"/></div>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-black italic uppercase text-yellow-500">
            {initialData?"Edit Account":"Create Account"}
          </h2>
          <button onClick={onClose} className={`p-2 rounded-xl ${dark?"hover:bg-white/5 text-zinc-500":"hover:bg-zinc-100 text-zinc-400"}`}><X size={15}/></button>
        </div>
        <div className="space-y-3">
          <input type="text" placeholder="FULL NAME" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
            className={`w-full ${t.input} border p-3.5 rounded-xl text-sm font-bold focus:border-yellow-500 outline-none`}/>
          <div className="relative">
            <input type="email" placeholder="EMAIL ADDRESS" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}
              className={`w-full ${t.input} border p-3.5 pl-10 rounded-xl text-sm font-bold focus:border-yellow-500 outline-none`}/>
            <Mail size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.subtext}`}/>
          </div>
          <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}
            className={`w-full ${t.input} border p-3.5 rounded-xl text-sm font-bold focus:border-yellow-500 outline-none`}>
            <option disabled value="SELECT ROLE">SELECT ROLE</option>
            {["WAITER","CASHIER","CHEF","MANAGER","DIRECTOR","CONTENT-MANAGER","ACCOUNTANT","BARISTA","BARMAN","SUPERVISOR"].map(r=>(
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div className="relative">
            <input type={showPin?"text":"password"} placeholder="ACCESS PIN (4 digits)" value={form.pin} maxLength={4}
              onChange={e=>setForm(p=>({...p,pin:e.target.value}))}
              className={`w-full ${t.input} border p-3.5 pr-20 rounded-xl text-sm font-bold focus:border-yellow-500 outline-none`}/>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <button type="button" onClick={genPin} className={`p-2 ${t.subtext} hover:text-yellow-500 transition-colors`}><RefreshCcw size={14}/></button>
              <button type="button" onClick={()=>setShowPin(p=>!p)} className={`p-2 ${t.subtext} hover:text-yellow-500 transition-colors`}>
                {showPin?<EyeOff size={14}/>:<Eye size={14}/>}
              </button>
            </div>
          </div>
          {!initialData && <p className={`text-[9px] italic px-1 ${t.subtext}`}>* Login details emailed on activation.</p>}
          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className={`flex-1 py-3.5 font-black uppercase italic text-xs ${t.subtext}`}>Cancel</button>
            <button type="button" disabled={isSubmitting} onClick={submit}
              className={`flex-[2] py-3.5 rounded-2xl font-black uppercase italic text-sm transition-all active:scale-95 ${isSubmitting?"bg-zinc-800 text-zinc-500 cursor-not-allowed":"bg-yellow-500 text-black"}`}>
              {isSubmitting?"Processing…":(initialData?"Update Profile":"Activate Account")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────
function StatCard({ label, value, trend, color, icon, loading }) {
  const { dark, t } = useTheme();
  return (
    <div className={`${t.card} border p-3.5 rounded-2xl transition-all active:scale-[0.98]`}>
      <div className="flex justify-between items-start mb-2.5">
        <div className={`p-1.5 rounded-lg border ${dark?"border-white/5 bg-black":"border-zinc-200 bg-zinc-50"} ${color}`}>{icon}</div>
        {trend && !loading && <span className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-lg">{trend}</span>}
      </div>
      <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${t.subtext}`}>{label}</p>
      {loading
        ? <div className={`h-6 w-20 rounded-lg animate-pulse mt-1 ${dark?"bg-zinc-800":"bg-zinc-200"}`}/>
        : <h4 className={`text-base md:text-xl font-black italic tracking-tight ${dark?"text-white":"text-zinc-900"}`}>
            <span className="text-[8px] mr-1 not-italic opacity-30">UGX</span>{(value ?? 0).toLocaleString()}
          </h4>
      }
    </div>
  );
}

function FinanceRow({ label, value, color, bold }) {
  const { dark } = useTheme();
  return (
    <div className="flex justify-between items-center text-[10px] font-bold uppercase">
      <span className={dark?"text-zinc-500":"text-zinc-400"}>{label}</span>
      <span className={`${color} ${bold?"text-sm font-black italic":""}`}>
        {value<0?"-":""}UGX {Math.abs(value).toLocaleString()}
      </span>
    </div>
  );
}

function OrderRow({ id, waiter, method, amount, time, status }) {
  const { t } = useTheme();
  const mc = { MOMO:"text-yellow-500", CASH:"text-emerald-500", CARD:"text-blue-500" };
  return (
    <tr className={`transition-colors ${t.rowHover}`}>
      <td className="p-3 md:p-5 font-black italic text-sm">{id}</td>
      <td className={`p-3 md:p-5 text-xs font-bold uppercase ${t.subtext}`}>{waiter}</td>
      <td className={`p-3 md:p-5 text-[9px] font-black tracking-widest ${mc[method]||""}`}>{method}</td>
      <td className="p-3 md:p-5 font-black text-sm"><span className="text-[8px] mr-1 opacity-30">UGX</span>{amount.toLocaleString()}</td>
      <td className={`p-3 md:p-5 text-[9px] font-bold ${t.subtext}`}>{time}</td>
      <td className="p-3 md:p-5"><span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black px-2 py-0.5 rounded uppercase border border-emerald-500/20">{status}</span></td>
    </tr>
  );
}

function ActivityItem({ type, msg, time, color }) {
  const { t } = useTheme();
  return (
    <div className="flex gap-3 items-start">
      <div className={`w-1 h-8 rounded-full shrink-0 mt-0.5 ${color||"bg-yellow-500/20"}`}/>
      <div>
        <p className="text-xs font-bold leading-snug">{msg}</p>
        <p className={`text-[8px] font-black uppercase mt-0.5 ${t.subtext}`}>{time} • {type}</p>
      </div>
    </div>
  );
}

function ShiftMiniCard({ staff, cash, momo, card, time, type, status }) {
  const { dark, t } = useTheme();
  return (
    <div className={`border p-3 rounded-xl flex justify-between items-center gap-3 ${dark?"bg-black/40 border-white/5":"bg-zinc-50 border-zinc-200"}`}>
      <div className="flex gap-2.5 items-center min-w-0">
        <div className={`p-1.5 rounded-lg shrink-0 ${dark?"bg-zinc-800":"bg-zinc-100"}`}><Clock size={11} className="text-zinc-400"/></div>
        <div className="min-w-0">
          <p className="text-xs font-black italic truncate">{staff}</p>
          <p className={`text-[8px] font-bold uppercase ${t.subtext}`}>{time}</p>
          {status && <p className="text-[8px] text-emerald-500 font-black">{status}</p>}
        </div>
      </div>
      {type !== "service" && (
        <div className="flex gap-1.5 text-[8px] font-black uppercase shrink-0">
          <span className={t.subtext}>C:{cash}</span>
          <span className="text-yellow-500">M:{momo}</span>
          <span className="text-blue-500">D:{card}</span>
        </div>
      )}
    </div>
  );
}