import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, BarChart3,
  History, Target, Bell, Sun, Moon, Menu, X, LogOut,
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

// ── Shared app context ────────────────────────────────────────────────────────
import { useData }  from "../../customer/components/context/DataContext";
import Logo         from "../../customer/assets/images/logo.jpeg";
import Footer       from "../../customer/components/common/Foooter";
import API_URL      from "../../config/api";

const NAV = [
  { icon: <LayoutDashboard size={18} />, label: "Overview",  tab: "OVERVIEW"  },
  { icon: <Users size={18} />,           label: "Staff",     tab: "STAFF"     },
  { icon: <BarChart3 size={18} />,       label: "Finances",  tab: "FINANCES"  },
  { icon: <History size={18} />,         label: "History",   tab: "HISTORY"   },
  { icon: <Target size={18} />,          label: "Targets",   tab: "TARGETS"   },
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
        if (res.ok) setStaffList(Array.isArray(await res.json()) ? await (await fetch(`${API_URL}/api/staff`)).json() : []);
      } catch (e) { console.error("Staff pull failed:", e); }
    })();
  }, [setStaffList]);

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
            <button className="md:hidden p-1.5" onClick={() => setSidebarOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <nav className="flex flex-col gap-1.5">
            {NAV.map(({ icon, label, tab }) => (
              <button key={tab}
                onClick={() => { setActiveTab(tab); setSidebarOpen(false); }}
                className={`flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-bold transition-all w-full text-left
                  ${activeTab === tab ? t.navActive : t.navIdle}`}>
                {icon} {label}
              </button>
            ))}
          </nav>

          <div className={`mt-auto pt-5 border-t ${t.divider} space-y-1.5`}>
            <button onClick={() => setDark(p => !p)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-2xl text-sm font-bold transition-all
                ${dark ? "text-zinc-400 hover:text-yellow-500 hover:bg-white/5" : "text-zinc-500 hover:text-yellow-600 hover:bg-zinc-100"}`}>
              {dark ? <Sun size={15} /> : <Moon size={15} />}
              {dark ? "Light Mode" : "Dark Mode"}
            </button>
            <button onClick={handleLogout}
              className="flex items-center gap-3 text-zinc-500 hover:text-rose-500 transition-colors text-sm font-bold w-full px-3 py-2.5">
              <LogOut size={15} /> Logout
            </button>
          </div>
        </aside>

        {/* ── MAIN ────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Header */}
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
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setDark(p => !p)}
                className={`p-1.5 rounded-full border transition-all
                  ${dark ? "bg-zinc-900 border-white/5 text-zinc-400 hover:text-yellow-500" : "bg-white border-zinc-200 text-zinc-500 hover:text-yellow-600"}`}>
                {dark ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              <div className={`relative p-1.5 rounded-full border cursor-pointer ${dark ? "border-white/5" : "border-zinc-200"}`}>
                <Bell size={15} />
                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full" />
              </div>
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

              {activeTab === "FINANCES" && <FinancesSection />}
              {activeTab === "HISTORY"  && <HistorySection />}
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