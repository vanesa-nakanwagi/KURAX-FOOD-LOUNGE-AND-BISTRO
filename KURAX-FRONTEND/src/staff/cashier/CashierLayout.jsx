import React, { useState, useEffect, useCallback } from "react";
import CashierDashboard from "./cashierDashboard";
import PettyCashPanel from "./PettyCashPanel"; 
import { Receipt, Wallet, LogOut, CheckCircle2, CircleDollarSign } from "lucide-react";
import logo from "../../../assets/images/logo.jpeg";
import API_URL from "../../../config/api";

// ─── Kampala date helper ──────────────────────────────────────────────────────
function getKampalaDate() {
  const k = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" }));
  return [
    k.getFullYear(),
    String(k.getMonth() + 1).padStart(2, "0"),
    String(k.getDate()).padStart(2, "0"),
  ].join("-");
}

function getCashierShiftKey(staffId) {
  return `cashier_shift_ended_${staffId}_${getKampalaDate()}`;
}

export default function CashierLayout() {
  // ── User State ──────────────────────────────────────────────────────────────
  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem("kurax_user") || "{}"); }
    catch { return {}; }
  });
  const staffId   = user?.id   || user?.staff_id  || "unknown";
  const staffName = user?.name || "Cashier";

  // ── Shift & Totals State ────────────────────────────────────────────────────
  const [shiftEnded, setShiftEnded] = useState(() => {
    return localStorage.getItem(getCashierShiftKey(staffId)) === "true";
  });
  const [grossCash, setGrossCash] = useState(0);    // Total from sales
  const [pettyOut, setPettyOut] = useState(0);      // Total from expenses
  const [activeTab, setActiveTab] = useState("cashier");
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endingShift, setEndingShift] = useState(false);

 const fetchGrossCash = useCallback(async () => {
  try {
    const res = await fetch(`${API_URL}/api/cashier-ops/cashier-queue`);
    if (!res.ok) return;

    const rows = await res.json();
    const total = rows
      .filter(r => r.method === 'Cash')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    setGrossCash(total);
  } catch (err) {
    console.error("Gross fetch error:", err);
  }
}, []);

  // ── End Shift Handler ───────────────────────────────────────────────────────
  const handleEndShift = async () => {
    setEndingShift(true);
    try {
      await fetch(`${API_URL}/api/staff/end-shift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: staffId, staff_name: staffName }),
      });
    } catch (e) { console.error("Shift end sync failed"); }
    
    localStorage.setItem(getCashierShiftKey(staffId), "true");
    setShiftEnded(true);
    setEndingShift(false);
    setShowEndConfirm(false);
  };

  // ── Shift Ended View ────────────────────────────────────────────────────────
  if (shiftEnded) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black font-[Outfit] gap-6 px-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-emerald-400" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-black text-white uppercase tracking-tight">Shift Completed</h1>
          <p className="text-zinc-500 text-sm mt-1">Excellent work, {staffName}! Your session is closed.</p>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem(getCashierShiftKey(staffId));
            setShiftEnded(false);
          }}
          className="px-6 py-3 bg-zinc-900 border border-white/10 rounded-2xl text-zinc-400 text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition-all"
        >
          Resume Shift
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-slate-100 font-[Outfit] overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 bg-zinc-950 border-b border-white/5 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-yellow-500/20" />
          <div className="flex flex-col leading-tight">
            <h1 className="text-sm md:text-lg font-black text-white uppercase tracking-tighter leading-none">
              KURAX LOUNGE
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] font-black bg-yellow-500 text-black px-1.5 py-0.5 rounded uppercase">Cashier</span>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{staffName}</p>
            </div>
          </div>
        </div>

        {/* Real-time Net Balance Display in Header */}
        <div className="hidden md:flex flex-col items-end mr-4">
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Net Cash on Counter</p>
          <p className="text-sm font-black text-yellow-500">
            UGX {(grossCash - pettyOut).toLocaleString()}
          </p>
        </div>

        <button
          onClick={() => setShowEndConfirm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
        >
          <LogOut size={13} />
          <span className="hidden sm:inline">End Shift</span>
        </button>
      </header>

      {/* ── Main Content Area ───────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pb-24 relative">
        {activeTab === "cashier" && (
          <CashierDashboard 
            grossCash={grossCash} 
            pettyOut={pettyOut} 
          />
        )}
        
        {activeTab === "petty" && (
          <PettyCashPanel
            role="CASHIER"
            staffName={staffName}
            grossCash={grossCash}
            theme="dark"
            onTotalChange={(val) => setPettyOut(val)} 
          />
        )}
      </main>

      {/* ── Bottom Navigation ───────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur-2xl border-t border-white/5 px-8 py-3 pb-8 flex justify-around items-center z-[100]">
        <NavButton
          active={activeTab === "cashier"}
          onClick={() => setActiveTab("cashier")}
          icon={<Receipt size={22} />}
          label="Sales"
        />
        
        {/* Floating Indicator for Net Cash (Mobile friendly) */}
        <div className="flex flex-col items-center justify-center -mt-8">
           <div className="bg-yellow-500 text-black p-3 rounded-full shadow-lg shadow-yellow-500/20 border-4 border-black">
              <CircleDollarSign size={24} />
           </div>
           <span className="text-[9px] font-black text-yellow-500 mt-1 uppercase">
             {(grossCash - pettyOut).toLocaleString()}
           </span>
        </div>

        <NavButton
          active={activeTab === "petty"}
          onClick={() => setActiveTab("petty")}
          icon={<Wallet size={22} />}
          label="Petty"
        />
      </nav>

      {/* ── Confirmation Modal ──────────────────────────────────────────────── */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 space-y-6 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
              <LogOut size={28} className="text-rose-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Close Shift?</h2>
              <p className="text-zinc-500 text-sm mt-2 px-2">
                Ensure your cash balance matches <strong>UGX {(grossCash - pettyOut).toLocaleString()}</strong> before closing.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowEndConfirm(false)} className="py-4 rounded-2xl border border-white/10 text-zinc-400 font-black text-[10px] uppercase tracking-widest hover:bg-white/5 transition-all">
                Stay
              </button>
              <button onClick={handleEndShift} disabled={endingShift} className="py-4 rounded-2xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-all disabled:opacity-50">
                {endingShift ? "Closing..." : "Close Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavButton({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
        active ? "text-yellow-500 scale-105" : "text-zinc-600 hover:text-zinc-400"
      }`}
    >
      <div className={`${active ? "drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]" : ""}`}>
        {icon}
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}