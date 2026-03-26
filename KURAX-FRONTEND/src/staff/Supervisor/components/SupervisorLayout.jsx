import React, { useState, useEffect } from "react";
import { Lock, ShieldCheck, RefreshCcw, Menu as MenuIcon, Zap, Bell } from "lucide-react";
import { ClipboardList, Clock, History, Target } from "lucide-react";

import NewOrder from "./NewOrder";
import OrderHistory from "./OrderHistory";
import LiveOrderStatus from "./LiveOrderStatus";
import Sidebar from "./Sidebar";
import StaffTargets from "./StaffTargets";

import { useTheme } from "../../../customer/components/context/ThemeContext";
import { useData } from "../../../customer/components/context/DataContext";
import API_URL from "../../../config/api";

// ── MENU CONFIGURATION (Shift Removed) ──────────────────────────────────────
const SUPERVISOR_MENU = [
  { id: "order",   label: "TAKE ORDER",         icon: <ClipboardList size={20} /> },
  { id: "manage", label: "MANAGE ORDER",       icon: <History size={20} /> },
  { id: "status",  label: "VIEW ORDER STATUS",   icon: <Clock size={20} /> },
  { id: "targets", label: "STAFF TARGETS",       icon: <Target size={20} /> },
];

export default function SupervisorLayout() {
  const [activeTab, setActiveTab] = useState("order");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { theme } = useTheme();
  const { currentUser, isGranted } = useData();
  const isDark = theme === "dark";

  const savedUser = (() => { 
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}"); } 
    catch { return {}; } 
  })();
  
  const currentStaffName = currentUser?.name || savedUser?.name || "Supervisor";

  // ── Tab → content map ─────────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case "order":
        if (!isGranted) return <LockedView name={currentStaffName} role="Supervisor" />;
        return <NewOrder />;
      case "status":
        return <LiveOrderStatus />;
      case "targets":
        return <StaffTargets />;
      case "manage":
        return <OrderHistory />;
      default:
        return <NewOrder />;
    }
  };

  return (
    <div className={`flex h-[100dvh] w-full font-[Outfit] overflow-hidden transition-colors duration-500 ${
      isDark ? "bg-black text-slate-100" : "bg-zinc-50 text-zinc-900"
    }`}>

      {/* ── Mobile hamburger ───────────────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 flex items-center px-6 z-[60] bg-transparent">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2.5 bg-yellow-500 text-black rounded-xl shadow-lg active:scale-90 transition-all"
        >
          <MenuIcon size={20} strokeWidth={3} />
        </button>
      </div>

      {/* ── Mobile backdrop ────────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[65] lg:hidden transition-opacity duration-500 ${
          isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className={`fixed inset-y-0 left-0 z-[70] w-64 transform lg:relative lg:translate-x-0 transition-all duration-500 ease-in-out ${
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tabId) => {
            setActiveTab(tabId);
            setIsMobileMenuOpen(false);
          }}
          menuItems={SUPERVISOR_MENU}
        />
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="flex-1 h-full overflow-y-auto relative flex flex-col min-w-0">

        {/* Status Badge */}
        <div className="absolute top-6 right-6 z-50">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 backdrop-blur-md shadow-xl transition-all ${
            isGranted
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
              : "bg-rose-500/10 border-rose-500/20 text-rose-500 animate-pulse"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isGranted ? "bg-emerald-500 animate-ping" : "bg-rose-500"}`} />
            <span className="text-[9px] font-black uppercase tracking-widest leading-none">
              {isGranted ? "Online" : "Restricted"}
            </span>
          </div>
        </div>

        <div className="flex-1 pb-10">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

// ── LockedView ───────────────────────────────────────────────────────────────
function LockedView({ name, role }) {
  const { currentUser } = useData();
  const [requestSent, setRequestSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(`perm_req_${currentUser?.id}`)) setRequestSent(true);
  }, [currentUser?.id]);

  const handleRequest = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/staff/request-permission`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: currentUser.id, staffName: currentUser.name }),
      });
      if (res.ok) {
        setRequestSent(true);
        localStorage.setItem(`perm_req_${currentUser?.id}`, "true");
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[75vh] p-8 text-center animate-in fade-in duration-700">
      <div className="relative mb-8">
        <div className={`w-28 h-28 rounded-[2.5rem] flex items-center justify-center border-2 transition-all duration-700 rotate-6 ${
          requestSent ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-yellow-500/10 border-yellow-500/20 text-yellow-500"
        }`}>
          {requestSent ? <ShieldCheck size={48} className="animate-pulse" /> : <Lock size={48} />}
        </div>
        <div className="absolute -top-1 -right-1 p-2.5 rounded-2xl bg-black border border-white/10">
          <Zap className={requestSent ? "text-emerald-500" : "text-yellow-500"} size={20} />
        </div>
      </div>
      <div className="space-y-2 mb-10">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter">
          {requestSent ? "Signal Sent" : "Access Locked"}
        </h2>
        <p className="text-zinc-500 max-w-[300px] mx-auto text-[10px] font-bold uppercase tracking-[0.2em] leading-relaxed opacity-60">
          {requestSent
            ? "Your request is live. Wait for the Director to grant ordering power."
            : `Hey ${name?.split(" ")[0]}, authorization is required for ${role}s to take orders.`}
        </p>
      </div>
      <div className="flex flex-col gap-4 w-full max-w-[280px]">
        {!requestSent ? (
          <button
            onClick={handleRequest} disabled={loading}
            className="px-6 py-5 bg-yellow-500 text-black rounded-3xl text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {loading ? <RefreshCcw size={16} className="animate-spin" /> : <Bell size={16} />}
            Request Power
          </button>
        ) : (
          <div className="px-6 py-5 bg-emerald-500/10 text-emerald-500 border-2 border-emerald-500/20 rounded-3xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
            <RefreshCcw size={14} className="animate-spin" /> Awaiting Sync
          </div>
        )}
      </div>
    </div>
  );
}