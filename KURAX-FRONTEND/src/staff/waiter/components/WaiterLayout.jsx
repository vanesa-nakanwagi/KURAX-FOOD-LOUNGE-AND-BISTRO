import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NewOrder from "./NewOrder";
import OrderHistory from "./OrderHistory";
import {
  PlusCircle, Receipt, Clock, Printer,
  Power, X, TrendingUp, Banknote,
  Smartphone, CreditCard, AlertCircle
} from "lucide-react";
import logo from "../../../customer/assets/images/logo.jpeg";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { useData } from "../../../customer/components/context/DataContext";
import API_URL from "../../../config/api";

// ── Kampala-aware today string ────────────────────────────────────────────────
function kampalaToday() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" })
  ).toISOString().split("T")[0];
}

export default function WaiterLayout() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { orders = [], currentUser, refreshData } = useData() || {};

  // 1. INITIALIZE IDENTITY AND DATE FIRST
  // These must be at the top because other states and hooks depend on them.
  const savedUser  = useMemo(() => JSON.parse(localStorage.getItem("kurax_user") || "{}"), []);
  const waiterName = currentUser?.name || savedUser?.name || "Staff Member";
  const waiterId   = currentUser?.id   || savedUser?.id;
  const waiterRole = (currentUser?.role || savedUser?.role || "WAITER").toUpperCase();
  const firstName  = waiterName.split(" ")[0];
  const today      = useMemo(() => kampalaToday(), []);


  useEffect(() => {
    if (!waiterId && !savedUser?.id) {
      console.warn("No waiter identity found. Redirecting to login...");
      navigate("/staff/login");
    }
  }, [waiterId, navigate, savedUser]);

  // 2. DEFINE STATE
  const [activeTab,      setActiveTab]      = useState("order");
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [isArchiving,    setIsArchiving]    = useState(false);
  const [confirmedQueue, setConfirmedQueue] = useState([]);

  // Now waiterId and today are guaranteed to be initialized here:
  const shiftEndedKey = `kurax_shift_ended_${waiterId}_${today}`;
  
  const [shiftEnded, setShiftEnded] = useState(() =>
    sessionStorage.getItem(shiftEndedKey) === "true"
  );

  // 3. EFFECTS
  useEffect(() => {
    const poll = async () => {
      if (shiftEnded) return; 
      try {
        const res = await fetch(`${API_URL}/api/orders/cashier-history`);
        if (res.ok) setConfirmedQueue(await res.json());
      } catch {}
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [shiftEnded]);

  // 4. MEMOS
  const dailyOrders = useMemo(() =>
    (orders || []).filter(o => {
      const ts = o.timestamp || o.created_at;
      if (!ts) return false;
      const orderDate = new Date(
        new Date(ts).toLocaleString("en-US", { timeZone: "Africa/Nairobi" })
      ).toISOString().split("T")[0];
      const oStaffId  = o.staff_id || o.staffId;
      const isMyOrder = String(oStaffId) === String(waiterId) || o.staff_name === waiterName;
      const cleared   = o.shift_cleared === true || o.shift_cleared === "t" || o.shift_cleared === "true";
      return isMyOrder && orderDate === today && !cleared;
    }),
  [orders, waiterId, waiterName, today]);

  const shiftTotals = useMemo(() => {
    const acc = { Cash: 0, MTN: 0, Airtel: 0, Card: 0, all: 0 };
    confirmedQueue.forEach(row => {
      if (row.status !== "Confirmed") return;
      if (row.requested_by !== waiterName && String(row.staff_id) !== String(waiterId)) return;
      
      const confirmedOn = new Date(
        new Date(row.confirmed_at || row.created_at)
          .toLocaleString("en-US", { timeZone: "Africa/Nairobi" })
      ).toISOString().split("T")[0];
      
      if (confirmedOn !== today) return;
      const amt = Number(row.amount || 0);
      switch (row.method) {
        case "Cash":        acc.Cash   += amt; acc.all += amt; break;
        case "Momo-MTN":    acc.MTN    += amt; acc.all += amt; break;
        case "Momo-Airtel": acc.Airtel += amt; acc.all += amt; break;
        case "Card":        acc.Card   += amt; acc.all += amt; break;
        default: acc.all += amt; break;
      }
    });
    return acc;
  }, [confirmedQueue, waiterName, waiterId, today]);

  // 5. HANDLERS
  const handleLogout = () => {
    localStorage.removeItem("kurax_user");
    navigate("/staff/login");
  };

  const handleFinalizeShift = async () => {
    if (dailyOrders.length === 0) {
      alert("No active orders to clear.");
      return;
    }
    const confirmEnd = window.confirm("Finalize shift? This will archive today's records.");
    if (!confirmEnd) return;

    setIsArchiving(true);
    try {
      const response = await fetch(`${API_URL}/api/waiter/end-shift`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waiter_id:   waiterId,
          waiter_name: waiterName,
          role:        waiterRole,
          orderCount:  dailyOrders.length,
          totals: {
            Cash:   shiftTotals.Cash,
            MTN:    shiftTotals.MTN,
            Airtel: shiftTotals.Airtel,
            Card:   shiftTotals.Card,
            all:    shiftTotals.all,
          },
        }),
      });

      if (response.ok) {
        alert("Shift finalized successfully!");
        setShowShiftModal(false);
        setConfirmedQueue([]);
        setShiftEnded(true);
        sessionStorage.setItem(shiftEndedKey, "true");
        if (typeof refreshData === "function") {
          await refreshData();
        } else {
          window.location.reload();
        }
      } else {
        const err = await response.json();
        alert(`Failed: ${err.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Shift end failed:", error);
      alert("Network error — please try again.");
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className={`flex flex-col h-screen font-[Outfit] overflow-hidden ${
      theme === "dark" ? "bg-black text-slate-100" : "bg-zinc-50 text-zinc-900"
    }`}>

      <EndShiftModal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
        onConfirm={handleFinalizeShift}
        totals={shiftTotals}
        orderCount={dailyOrders.length}
        waiterName={waiterName}
        theme={theme}
        isArchiving={isArchiving}
      />

      {/* HEADER */}
      <header className={`flex items-center justify-between px-4 py-3.5 border-b ${
        theme === "dark" ? "bg-zinc-950 border-white/5" : "bg-white border-black/5"
      }`}>
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="w-9 h-9 rounded-xl object-cover border border-yellow-500/30" />
          <h1 className="text-sm font-black uppercase tracking-tighter">KURAX BISTRO</h1>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
          theme === "dark" ? "bg-zinc-900 border-white/5" : "bg-zinc-50 border-black/5"
        }`}>
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[11px] font-black text-yellow-500 uppercase">{firstName}</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {activeTab === "order" ? <NewOrder /> : <OrderHistory shiftEnded={shiftEnded} />}
      </main>

      {/* NAVIGATION */}
      <nav className={`fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t z-[100] ${
        theme === "dark" ? "bg-zinc-950/90 border-white/5" : "bg-white/90 border-black/5"
      }`}>
        <div className="flex justify-around items-center py-2">
          <NavButton active={activeTab === "order"}   onClick={() => setActiveTab("order")}        icon={<PlusCircle size={20}/>} label="Order"   theme={theme} />
          <NavButton active={activeTab === "history"} onClick={() => setActiveTab("history")}      icon={<Receipt size={20}/>}    label="History" theme={theme} />
          <NavButton active={false}                   onClick={() => setShowShiftModal(true)}       icon={<Clock size={20}/>}      label="Shift"   theme={theme} />
          <NavButton active={false}                   onClick={handleLogout}                        icon={<Power size={20}/>}      label="Logout"  theme={theme} isDanger />
        </div>
      </nav>
    </div>
  );
}

// ── End Shift Modal ───────────────────────────────────────────────────────────
function EndShiftModal({ isOpen, onClose, onConfirm, totals, orderCount, waiterName, theme, isArchiving }) {
  if (!isOpen) return null;
  const isDark  = theme === "dark";
  const cardBg  = isDark ? "bg-zinc-800/60 border-white/5" : "bg-zinc-50 border-black/5";
  const totalMomo = totals.MTN + totals.Airtel;

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md">
      <div className={`w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2.5rem] p-7 border ${
        isDark ? "bg-zinc-900 border-white/10 text-white" : "bg-white border-black/5 text-zinc-900"
      }`}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock className="text-yellow-500" />
            <div>
              <h2 className="text-lg font-black uppercase italic">Shift Summary</h2>
              <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                {waiterName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X size={15}/></button>
        </div>

        {/* Order count */}
        <div className={`flex justify-between items-center p-4 rounded-2xl border mb-4 ${cardBg}`}>
          <span className="text-[10px] font-black uppercase opacity-50">Total Orders</span>
          <span className="text-2xl font-black">{orderCount}</span>
        </div>

        {/* Payment breakdown */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <PaymentPill label="Cash"        value={totals.Cash}   color="text-emerald-400" icon={<Banknote size={12}/>}    bg={cardBg} />
          <PaymentPill label="MTN Momo"    value={totals.MTN}    color="text-yellow-400"  icon={<Smartphone size={12}/>}  bg={cardBg} />
          <PaymentPill label="Airtel Momo" value={totals.Airtel} color="text-red-400"     icon={<Smartphone size={12}/>}  bg={cardBg} />
          <PaymentPill label="Card"        value={totals.Card}   color="text-blue-400"    icon={<CreditCard size={12}/>}  bg={cardBg} />
        </div>

        {/* Total Momo sub-total */}
        {totalMomo > 0 && (
          <div className={`flex justify-between items-center px-4 py-2.5 rounded-xl border mb-3 ${cardBg}`}>
            <span className="text-[9px] font-black uppercase opacity-50">Total Momo (MTN + Airtel)</span>
            <span className="text-sm font-black text-orange-400">UGX {totalMomo.toLocaleString()}</span>
          </div>
        )}

        {/* Gross */}
        <div className="bg-yellow-500 p-5 rounded-2xl text-black text-center mb-5">
          <p className="text-[9px] font-black uppercase opacity-60">Gross Revenue</p>
          <p className="text-3xl font-black">UGX {totals.all.toLocaleString()}</p>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={onConfirm}
            disabled={isArchiving}
            className={`w-full py-4 rounded-2xl font-black uppercase text-[11px] transition-all flex items-center justify-center gap-2
              ${isArchiving
                ? "bg-rose-900 cursor-not-allowed opacity-80"
                : "bg-rose-600 hover:bg-rose-700 text-white active:scale-95"
              }`}
          >
            {isArchiving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Processing…</span></>
            ) : "End Shift & Archive"}
          </button>

          <button
            onClick={onClose}
            disabled={isArchiving}
            className={`w-full py-3.5 rounded-2xl font-black uppercase text-[11px] border transition-all
              ${isDark ? "border-white/10 hover:bg-white/5" : "border-black/10 hover:bg-black/5"}
              ${isArchiving ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Printer size={14} className="inline mr-2"/> Print Summary
          </button>
        </div>

      </div>
    </div>
  );
}

function PaymentPill({ label, value, color, icon, bg }) {
  return (
    <div className={`p-3 rounded-2xl border ${bg}`}>
      <div className={`flex items-center gap-1 mb-1 ${color}`}>
        {icon}
        <span className="text-[8px] font-black uppercase">{label}</span>
      </div>
      <p className="text-[11px] font-black italic">UGX {Number(value || 0).toLocaleString()}</p>
    </div>
  );
}

function NavButton({ icon, label, active, onClick, theme, isDanger }) {
  const activeStyle   = "bg-yellow-500/10 text-yellow-500";
  const inactiveStyle = theme === "dark" ? "text-zinc-500" : "text-zinc-400";
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all
      ${active ? activeStyle : isDanger ? "text-rose-500" : inactiveStyle}`}>
      {icon}
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}