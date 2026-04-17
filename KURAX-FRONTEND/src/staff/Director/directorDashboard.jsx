import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, BarChart3,
  History, Target, Bell, Sun, Moon, Menu, X, LogOut, Bike,
  BookOpen, CheckCircle2, XCircle, Clock, Hourglass
} from "lucide-react";

// ── Local components ──────────────────────────────────────────────────────────
import { ThemeContext, buildTheme }  from "./components/shared/ThemeContext";
import OverviewSection               from "./components/OverviewSection";
import StaffSection                  from "./components/StaffSection";
import FinancesSection               from "./components/FinancesSection";
import HistorySection                from "./components/HistorySection";
import CreateStaffModal              from "./components/CreateStaffModal";
import StaffAnalyticsModal           from "./components/StaffAnalyticsModal";
import DirectorTargetView            from "./DirectorTargetView";
import RidersSettings from "./components/RiderSettings";
import RiderLedger   from "./components/RiderLedger";

// ── Shared app context ────────────────────────────────────────────────────────
import { useData }  from "../../customer/components/context/DataContext";
import Logo         from "../../customer/assets/images/logo.jpeg";
import Footer       from "../../customer/components/common/Foooter";
import API_URL      from "../../config/api";

// ── THEME TOGGLE COMPONENT ────────────────────────────────────────────────────
function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="relative w-12 h-6 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 p-0.5 transition-all duration-300 hover:scale-105 focus:outline-none"
    >
      <div className={`absolute inset-0 rounded-full bg-black/20 transition-opacity duration-300 ${isDark ? 'opacity-0' : 'opacity-100'}`} />
      <div className={`relative w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 flex items-center justify-center ${isDark ? 'translate-x-6' : 'translate-x-0'}`}>
        {isDark ? <Moon size={10} className="text-zinc-800" /> : <Sun size={10} className="text-yellow-500" />}
      </div>
    </button>
  );
}

// ── CREDIT STATUS BADGE COMPONENT - FIXED to handle all possible statuses ────
function CreditStatusBadge({ status }) {
  // Normalize status string (handle case variations)
  const normalizedStatus = String(status || '').toLowerCase();
  
  // Map backend statuses to display (case-insensitive)
  const statusMap = {
    'pendingcashier': { label: 'Wait for Cashier', icon: <Hourglass size={10} />, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    'pendingmanagerapproval': { label: 'Wait for Manager', icon: <Clock size={10} />, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    'approved': { label: 'Approved', icon: <CheckCircle2 size={10} />, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    'fullysettled': { label: 'Settled', icon: <CheckCircle2 size={10} />, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    'partiallysettled': { label: 'Partially Settled', icon: <CheckCircle2 size={10} />, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    'rejected': { label: 'Rejected', icon: <XCircle size={10} />, color: 'bg-red-500/20 text-red-400 border-red-500/30' }
  };
  
  const config = statusMap[normalizedStatus] || { 
    label: status || 'Unknown', 
    icon: <BookOpen size={10} />, 
    color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' 
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase ${config.color}`}>
      {config.icon} {config.label}
    </span>
  );
}

const NAV = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard",  tab: "OVERVIEW"  },
  { icon: <Users size={18} />,           label: "Staff",      tab: "STAFF"     },
  { icon: <BarChart3 size={18} />,       label: "Finances & Credits",  tab: "FINANCES"  },
  { icon: <History size={18} />,         label: "History",    tab: "HISTORY"   },
  { icon: <Target size={18} />,          label: "Targets",    tab: "TARGETS"   },
  { icon: <Bike size={18} />,            label: "Riders",     tab: "RIDERS"    },
];

export default function DirectorDashboard() {
  const navigate = useNavigate();
  const [dark,            setDark]        = useState(true);
  const [activeTab,       setActiveTab]   = useState("OVERVIEW");
  const [isSidebarOpen,   setSidebarOpen] = useState(false);
  const [currentUser,     setCurrentUser] = useState(null);
  const [editingStaff,    setEditingStaff]   = useState(null);
  const [showCreateModal, setShowCreate]     = useState(false);
  const [staffModalData,  setStaffModal]     = useState(null);
  const [creditsData,     setCreditsData]    = useState([]);
  const [creditsLoading,  setCreditsLoading] = useState(false);

  const { staffList, setStaffList, orders = [] } = useData();
  const t = buildTheme(dark);

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("kurax_user");
    if (!saved) { navigate("/staff/login"); return; }
    try {
      const p = JSON.parse(saved);
      if (p.role?.toUpperCase() !== "DIRECTOR") navigate("/staff/login");
      else setCurrentUser(p);
    } catch { navigate("/staff/login"); }
  }, [navigate]);

  // ── Fetch staff ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/staff`);
        if (res.ok) {
          const data = await res.json();
          setStaffList(Array.isArray(data) ? data : []);
        }
      } catch (e) { console.error("Staff pull failed:", e); }
    })();
  }, [setStaffList]);

  // ── Fetch credits data with debug ─────────────────────────────────────────
  const fetchCredits = useCallback(async () => {
    setCreditsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/cashier-ops/credits`);
      if (res.ok) {
        const data = await res.json();
        // Debug: Log all statuses
        console.log("=== CREDIT STATUS DEBUG ===");
        console.log("Total credits:", data.length);
        const statuses = [...new Set(data.map(c => c.status))];
        console.log("Unique statuses found:", statuses);
        data.forEach(c => {
          console.log(`Credit ${c.id}: status="${c.status}", paid=${c.paid}, amount=${c.amount}`);
        });
        setCreditsData(data);
      }
    } catch (e) { console.error("Credits fetch failed:", e); }
    setCreditsLoading(false);
  }, []);

  useEffect(() => {
    fetchCredits();
    const interval = setInterval(fetchCredits, 30000);
    return () => clearInterval(interval);
  }, [fetchCredits]);

  // ── Credit statistics - FIXED to correctly identify statuses ───────────────
  const creditStats = useMemo(() => {
    // Normalize status function
    const getNormalizedStatus = (status) => {
      if (!status) return 'unknown';
      const s = String(status).toLowerCase();
      if (s === 'pendingcashier') return 'pendingCashier';
      if (s === 'pendingmanagerapproval') return 'pendingManager';
      if (s === 'approved') return 'approved';
      if (s === 'fullysettled') return 'settled';
      if (s === 'partiallysettled') return 'settled';
      if (s === 'rejected') return 'rejected';
      // Also check by paid flag
      return s;
    };
    
    const pendingCashier = creditsData.filter(c => getNormalizedStatus(c.status) === 'pendingCashier');
    const pendingManager = creditsData.filter(c => getNormalizedStatus(c.status) === 'pendingManager');
    const approved = creditsData.filter(c => getNormalizedStatus(c.status) === 'approved');
    // Also check if paid flag is true but status is not settled
    const settled = creditsData.filter(c => getNormalizedStatus(c.status) === 'settled' || c.paid === true);
    const rejected = creditsData.filter(c => getNormalizedStatus(c.status) === 'rejected');
    
    // Outstanding = not yet paid (pending cashier, pending manager, approved, and NOT settled/rejected)
    const outstanding = creditsData.filter(c => {
      const status = getNormalizedStatus(c.status);
      return status === 'pendingCashier' || status === 'pendingManager' || status === 'approved';
    });
    
    console.log("Credit Stats Debug:", {
      total: creditsData.length,
      pendingCashier: pendingCashier.length,
      pendingManager: pendingManager.length,
      approved: approved.length,
      settled: settled.length,
      rejected: rejected.length,
      outstanding: outstanding.length
    });
    
    return {
      pendingCashier: pendingCashier.length,
      pendingManager: pendingManager.length,
      approved: approved.length,
      settled: settled.length,
      rejected: rejected.length,
      totalOutstanding: outstanding.reduce((s, c) => s + Number(c.amount || 0), 0),
      totalSettled: settled.reduce((s, c) => s + Number(c.amount_paid || c.amount || 0), 0),
      totalRejected: rejected.reduce((s, c) => s + Number(c.amount || 0), 0),
      allCredits: creditsData
    };
  }, [creditsData]);

  // ── Staff actions ──────────────────────────────────────────────────────────
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

  const handleTerminate = async (id, name) => {
    if (!window.confirm(`Terminate ${name}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/staff/terminate/${id}`, { method: "DELETE" });
      if (res.ok) setStaffList(prev => prev.filter(s => s.id !== id));
      else alert("Could not terminate account.");
    } catch { alert("Network error."); }
  };

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

  const handleLogout   = () => { localStorage.removeItem("kurax_user"); navigate("/staff/login"); };
  const handleCardClick = useCallback((staff, stats) => setStaffModal({ staff, stats }), []);

  // ── Theme toggle handler ───────────────────────────────────────────────────
  const toggleTheme = () => setDark(prev => !prev);

  // ── Loading spinner ────────────────────────────────────────────────────────
  if (!currentUser) return (
    <div className="h-[100dvh] bg-black flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <ThemeContext.Provider value={{ dark, t }}>
      <div className={`flex h-[100dvh] ${t.bg} ${t.text} font-[Outfit] overflow-hidden transition-colors duration-300`}>

        {/* Sidebar overlay (mobile) */}
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
               onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 ${t.sidebar} border-r p-5 flex flex-col
          transition-transform duration-300
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0
        `}>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 min-w-0">
              <img src={Logo} alt="" className="w-10 h-10 rounded-xl object-cover border border-yellow-500/20 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-tighter leading-none truncate">KURAX FOOD LOUNGE</p>
                <p className="text-yellow-500 text-[8px] font-bold uppercase tracking-widest">DIRECTOR PANEL</p>
              </div>
            </div>
            <button className="md:hidden p-1.5" onClick={() => setSidebarOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <nav className="flex flex-col gap-1.5">
            {NAV.map(({ icon, label, tab }) => (
              <button key={tab}
                onClick={() => { setActiveTab(tab); setSidebarOpen(false); }}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all w-full text-left
                  ${activeTab === tab ? t.navActive : t.navIdle}`}>
                {icon} {label}
              </button>
            ))}
          </nav>

          <div className={`mt-auto pt-5 border-t ${t.divider}`}>
            <button onClick={handleLogout}
              className="flex items-center gap-3 text-zinc-500 hover:text-rose-500 transition-colors text-sm font-bold w-full px-3 py-2.5 rounded-xl hover:bg-white/5">
              <LogOut size={15} /> Logout
            </button>
          </div>
        </aside>

        {/* ── MAIN ────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Header with Theme Toggle */}
          <header className={`px-4 py-3 border-b flex justify-between items-center sticky top-0 z-30 backdrop-blur-md shrink-0 ${t.header}`}>
            <div className="flex items-center gap-3 min-w-0">
              <button className={`md:hidden p-2 rounded-xl shrink-0 ${dark ? "bg-zinc-900" : "bg-zinc-100"}`}
                      onClick={() => setSidebarOpen(true)}>
                <Menu size={17} />
              </button>
              <div className="min-w-0">
                <h2 className="text-md font-black uppercase">
                  Welcome Back, <span className="text-yellow-500">{currentUser?.name}</span>
                </h2>
                <p className={`hidden sm:block text-[9px] font-bold uppercase tracking-widest ${t.subtext}`}>
                  {new Date().toDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {/* Theme Toggle */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${dark ? "bg-white/5 border border-white/10" : "bg-gray-100 border border-gray-200"}`}>
                <span className={`text-[9px] font-black uppercase tracking-widest ${dark ? "text-zinc-500" : "text-gray-500"}`}>Theme</span>
                <ThemeToggle isDark={dark} onToggle={toggleTheme} />
              </div>
              {/* Notification Bell with Credit Count */}
              {(creditStats.pendingCashier > 0 || creditStats.pendingManager > 0) && (
                <div className={`relative p-1.5 rounded-full border cursor-pointer ${dark ? "border-white/5 hover:bg-white/5" : "border-gray-200 hover:bg-gray-100"}`}>
                  <Bell size={15} />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px] font-black text-white">{creditStats.pendingCashier + creditStats.pendingManager}</span>
                  </div>
                </div>
              )}
            </div>
          </header>

          

          {/* Scrollable body */}
          <main className="flex-1 overflow-y-auto overscroll-contain">
            <div className="p-3 sm:p-5 md:p-8 max-w-[1600px] mx-auto w-full pb-24 md:pb-8">

              {activeTab === "OVERVIEW" && (
                <OverviewSection onViewRegistry={() => setActiveTab("HISTORY")} />
              )}

              {activeTab === "TARGETS" && (
                <div className="animate-in fade-in duration-500">
                  <DirectorTargetView />
                </div>
              )}

              {activeTab === "STAFF" && (
                <StaffSection
                  currentUser={currentUser}
                  onAdd={() => { setEditingStaff(null); setShowCreate(true); }}
                  onEdit={staff => { setEditingStaff(staff); setShowCreate(true); }}
                  staffList={staffList}
                  orders={orders}
                  onTogglePermission={handleToggle}
                  onTerminate={handleTerminate}
                  onCardClick={handleCardClick}
                />
              )}

              {activeTab === "FINANCES" && (
                <FinancesSection 
                  creditsData={creditsData}
                  creditStats={creditStats}
                  CreditStatusBadge={CreditStatusBadge}
                />
              )}
              
              {activeTab === "HISTORY"  && <HistorySection />}

              {activeTab === "RIDERS" && (
                <div className="animate-in fade-in duration-500 space-y-10">
                  <RiderLedger dark={dark} t={t} />
                  <div className={`border-t pt-8 ${dark ? "border-white/5" : "border-zinc-100"}`}>
                    <RidersSettings dark={dark} t={t} />
                  </div>
                </div>
              )}
            </div>
            <Footer />
          </main>

          {/* Mobile bottom nav */}
          <nav className={`md:hidden fixed bottom-0 inset-x-0 z-30 border-t flex items-center justify-around px-1 py-1.5 ${t.mobileNav}`}
               style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
            {NAV.map(({ icon, label, tab }) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all flex-1
                  ${activeTab === tab ? "text-yellow-500" : dark ? "text-zinc-600" : "text-zinc-400"}`}>
                <span className={`transition-transform ${activeTab === tab ? "scale-110" : ""}`}>{icon}</span>
                <span className="text-[8px] font-black uppercase tracking-wide">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* ── MODALS ──────────────────────────────────────────────────────── */}
        {showCreateModal && (
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