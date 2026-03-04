import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import NewOrder from "./NewOrder";
import OrderHistory from "./OrderHistory";
import { PlusCircle, Receipt, LogOut, Clock, Printer, Power, X, TrendingUp, Banknote, Smartphone, CreditCard } from "lucide-react";
import logo from "../../../customer/assets/images/logo.jpeg";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { useData } from "../../../customer/components/context/DataContext";

export default function WaiterLayout() {
  const [activeTab, setActiveTab] = useState("order");
  const [showShiftModal, setShowShiftModal] = useState(false);
  const { theme } = useTheme();
  const { orders = [], currentUser } = useData() || {};
  const navigate = useNavigate();

  // ✅ Correct localStorage key
  const savedUser = useMemo(() => JSON.parse(localStorage.getItem("kurax_user") || "{}"), []);
  const waiterName = currentUser?.name || savedUser?.name || "Staff Member";
  const waiterId = currentUser?.id || savedUser?.id;
  const firstName = waiterName.split(" ")[0];

  const today = new Date().toISOString().split("T")[0];

  // ✅ Fixed logout key
  const handleLogout = () => {
    localStorage.removeItem("kurax_user");
    navigate("/staff/login");
  };

  // ✅ Fixed filter — matches snake_case from DB
  const dailyOrders = useMemo(() => {
    return orders.filter(order => {
      const ts = order.timestamp || order.created_at;
      if (!ts) return false;
      const orderDate = new Date(ts).toISOString().split("T")[0];
      const oStaffId = order.staff_id || order.staffId;
      const oStaffName = order.staff_name || order.waiterName;
      return (oStaffId === waiterId || oStaffName === waiterName) && orderDate === today;
    });
  }, [orders, waiterId, waiterName, today]);

  // ✅ Normalized payment method matching
  const shiftTotals = useMemo(() => {
    return dailyOrders.reduce((acc, order) => {
      const isPaid = order.status === "Paid" || order.is_paid || order.isPaid;
      if (isPaid) {
        const raw = (order.payment_method || order.paymentMethod || "Cash").toLowerCase();
        let method = "Cash";
        if (raw.includes("momo") || raw.includes("mtn") || raw.includes("airtel")) method = "Momo";
        else if (raw.includes("card")) method = "Card";
        acc[method] = (acc[method] || 0) + Number(order.total || 0);
        acc.all += Number(order.total || 0);
      }
      return acc;
    }, { Cash: 0, Card: 0, Momo: 0, all: 0 });
  }, [dailyOrders]);

  const renderContent = () => {
    switch (activeTab) {
      case "order": return <NewOrder />;
      case "history": return <OrderHistory />;
      default: return <NewOrder />;
    }
  };

  return (
    <div className={`flex flex-col h-screen font-[Outfit] overflow-hidden transition-colors duration-300 ${
      theme === "dark" ? "bg-black text-slate-100" : "bg-zinc-50 text-zinc-900"
    }`}>

      {/* End Shift Modal */}
      <EndShiftModal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
        totals={shiftTotals}
        orderCount={dailyOrders.length}
        waiterName={waiterName}
        theme={theme}
      />

      {/* ── TOP HEADER ── */}
      <header className={`flex items-center justify-between px-4 md:px-8 lg:px-12 py-3.5 border-b transition-colors duration-300 shrink-0 ${
        theme === "dark" ? "bg-zinc-950 border-white/5" : "bg-white border-black/5 shadow-sm"
      }`}>
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="w-9 h-9 rounded-xl object-cover border border-yellow-500/30 shrink-0" />
          <div className="hidden sm:flex flex-col justify-center leading-tight">
            <h1 className={`text-sm font-black uppercase tracking-tighter leading-none ${
              theme === "dark" ? "text-white" : "text-zinc-900"
            }`}>
              KURAX FOOD LOUNGE & BISTRO
            </h1>
            <p className="text-[10px] font-bold text-yellow-500 lowercase mt-0.5">
              luxury dining, signature drinks & rooftop vibes
            </p>
          </div>
        </div>

        {/* Desktop: waiter identity + quick stats */}
        <div className="hidden lg:flex items-center gap-6">
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border ${
            theme === "dark" ? "bg-zinc-900 border-white/5" : "bg-zinc-50 border-black/5"
          }`}>
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Live Session</span>
            <span className="text-[11px] font-black text-yellow-500 uppercase">{firstName}</span>
          </div>
          
        </div>

        {/* Mobile: session pill */}
        <div className={`lg:hidden flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
          theme === "dark" ? "bg-zinc-900 border-white/5" : "bg-zinc-50 border-black/5"
        }`}>
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[10px] font-black text-yellow-500 uppercase">{firstName}</span>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto pb-24">
        {renderContent()}
      </main>

      {/* ── BOTTOM NAVIGATION ── */}
      <nav className={`fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t z-[100] transition-colors duration-300 ${
        theme === "dark" ? "bg-zinc-950/90 border-white/5" : "bg-white/90 border-black/5"
      }`}>
        <div className="flex justify-around items-center px-2 py-2 pb-safe">
          <NavButton
            active={activeTab === "order"}
            onClick={() => setActiveTab("order")}
            icon={<PlusCircle size={20} />}
            label="Order"
            theme={theme}
          />
          <NavButton
            active={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            icon={<Receipt size={20} />}
            label="History"
            theme={theme}
          />
          <NavButton
            active={false}
            onClick={() => setShowShiftModal(true)}
            icon={<Clock size={20} />}
            label="Shift"
            theme={theme}
          />
          <NavButton
            active={false}
            onClick={handleLogout}
            icon={<Power size={20} />}
            label="Logout"
            theme={theme}
            isDanger
          />
        </div>
      </nav>
    </div>
  );
}

// ─── QUICK STAT (header) ──────────────────────────────────────────────────────
function QuickStat({ label, value, accent }) {
  return (
    <div className="text-center">
      <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{label}</p>
      <p className={`text-sm font-black leading-tight ${accent ? "text-yellow-500" : ""}`}>{value}</p>
    </div>
  );
}

// ─── END SHIFT MODAL ─────────────────────────────────────────────────────────
function EndShiftModal({ isOpen, onClose, totals, orderCount, waiterName, theme }) {
  if (!isOpen) return null;

  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-zinc-800/60 border-white/5" : "bg-zinc-50 border-black/5";

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className={`w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2.5rem] p-7 border ${
        isDark ? "bg-zinc-900 border-white/10 text-white" : "bg-white border-black/5 text-zinc-900"
      }`}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-yellow-500/10 rounded-2xl flex items-center justify-center">
              <Clock size={22} className="text-yellow-500" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase italic tracking-tighter leading-none">Shift Summary</h2>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">{waiterName}</p>
            </div>
          </div>
          <button onClick={onClose}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isDark ? "bg-white/5 hover:bg-white/10" : "bg-zinc-100 hover:bg-zinc-200"
            }`}>
            <X size={15} className="text-zinc-400" />
          </button>
        </div>

        {/* Orders count banner */}
        <div className={`flex items-center justify-between p-4 rounded-2xl border mb-4 ${cardBg}`}>
          <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Total Orders Today</span>
          <span className="text-2xl font-black">{orderCount}</span>
        </div>

        {/* Payment breakdown */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Cash", value: totals.Cash, icon: <Banknote size={14} />, color: "text-emerald-500" },
            { label: "Momo", value: totals.Momo, icon: <Smartphone size={14} />, color: "text-yellow-500" },
            { label: "Card", value: totals.Card, icon: <CreditCard size={14} />, color: "text-blue-400" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className={`p-3 rounded-2xl border ${cardBg}`}>
              <div className={`flex items-center gap-1 mb-1 ${color}`}>{icon}
                <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
              </div>
              <p className="text-xs font-black">UGX {value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Gross total */}
        <div className="bg-yellow-500 p-5 rounded-2xl text-black text-center mb-5">
          <div className="flex items-center justify-center gap-2 mb-1">
            <TrendingUp size={14} className="opacity-60" />
            <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Gross Total</p>
          </div>
          <p className="text-3xl font-black tracking-tight">UGX {totals.all.toLocaleString()}</p>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button className={`w-full py-3.5 rounded-2xl font-black uppercase text-[11px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
            isDark ? "bg-white text-black hover:bg-zinc-100" : "bg-zinc-900 text-white hover:bg-zinc-800"
          }`}>
            <Printer size={15} /> Print Shift Report
          </button>
          <button onClick={onClose}
            className="w-full text-zinc-500 font-black uppercase text-[10px] py-2.5 hover:text-zinc-300 transition-colors tracking-widest">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NAV BUTTON ───────────────────────────────────────────────────────────────
function NavButton({ icon, label, active, onClick, theme, isDanger }) {
  const base = "flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-200 min-w-[64px]";
  const activeStyle = "bg-yellow-500/10 text-yellow-500 scale-105";
  const inactiveStyle = theme === "dark" ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600";
  const dangerStyle = "text-rose-500 hover:text-rose-400";

  return (
    <button
      onClick={onClick}
      className={`${base} ${isDanger ? dangerStyle : active ? activeStyle : inactiveStyle}`}
    >
      {icon}
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}