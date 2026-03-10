import React, { useState, useEffect } from "react";
import { 
  Banknote, Smartphone, CreditCard, Receipt, 
  Share2, Menu, Search, Calculator, Wallet, 
  CheckCircle2, PlusCircle, RotateCcw, AlertCircle, Trash2, XCircle,
  BookOpen, User, Phone, Calendar, RefreshCw
} from "lucide-react";
import { useData } from "../../customer/components/context/DataContext"; 
import SideBar from "./SideBar"; 
import logo from "../../customer/assets/images/logo.jpeg";
import Footer from "../../customer/components/common/Foooter";
import API_URL from "../../config/api";

// ── helpers ──────────────────────────────────────────────────────────────────
function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
}

export default function AccountantDashboard() {
  const { orders = [], setOrders } = useData() || {}; 
  const [activeSection, setActiveSection] = useState("FINANCIAL_HISTORY");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPettyModal, setShowPettyModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Credits ledger state
  const [creditsLedger, setCreditsLedger]   = useState([]);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditFilter, setCreditFilter]     = useState("all"); // all | outstanding | settled

  // --- PERSISTENCE LOGIC ---
  const [isShiftClosed, setIsShiftClosed] = useState(() => {
    return localStorage.getItem("kurax_shift_closed") === "true";
  });

  const [physicalCounts, setPhysicalCounts] = useState(() => {
    const saved = localStorage.getItem("kurax_physical_counts");
    return saved ? JSON.parse(saved) : { cash: 0, momo: 0, card: 0 };
  });

  useEffect(() => {
    localStorage.setItem("kurax_physical_counts", JSON.stringify(physicalCounts));
  }, [physicalCounts]);

  useEffect(() => {
    localStorage.setItem("kurax_shift_closed", isShiftClosed);
  }, [isShiftClosed]);

  // Fetch credits whenever Credits tab is active
  useEffect(() => {
    if (activeSection !== "CREDITS") return;
    const load = async () => {
      setCreditsLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/orders/credits`);
        if (res.ok) setCreditsLedger(await res.json());
      } catch (e) { console.error("Credits fetch failed:", e); }
      setCreditsLoading(false);
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [activeSection]);

  // --- CALCULATIONS ---
  const voidRequests = orders.filter(order => 
    order.items?.some(item => item.voidRequested)
  );

  const validPaidOrders = orders.filter(o => o.isPaid && !o.voidRequested);
  
  const systemTotals = {
    cash: validPaidOrders.filter(o => o.paymentMethod === "Cash").reduce((sum, o) => sum + (o.total || 0), 0),
    momo: validPaidOrders.filter(o => o.paymentMethod === "Momo").reduce((sum, o) => sum + (o.total || 0), 0),
    card: validPaidOrders.filter(o => o.paymentMethod === "Card").reduce((sum, o) => sum + (o.total || 0), 0),
  };
  const totalRevenue = systemTotals.cash + systemTotals.momo + systemTotals.card;

  // Credits summary
  const outstanding     = creditsLedger.filter(c => !c.paid);
  const settled         = creditsLedger.filter(c => c.paid);
  const totalOutstanding = outstanding.reduce((s, c) => s + Number(c.amount), 0);
  const totalSettled    = settled.reduce((s, c) => s + Number(c.amount_paid || c.amount), 0);

  const filteredCredits = creditsLedger.filter(c => {
    if (creditFilter === "outstanding") return !c.paid;
    if (creditFilter === "settled")     return c.paid;
    return true;
  });

  // --- HANDLERS ---
  const approveItemVoid = (orderId, itemIndex) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const updatedItems = [...order.items];
        updatedItems[itemIndex] = {
          ...updatedItems[itemIndex],
          voidRequested: false, voidProcessed: true, status: "VOIDED", price: 0 
        };
        const newTotal = updatedItems.reduce((sum, i) => sum + (Number(i.price) * (i.quantity || 1)), 0);
        return { ...order, items: updatedItems, total: newTotal };
      }
      return order;
    }));
  };

  const rejectItemVoid = (orderId, itemIndex) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const updatedItems = [...order.items];
        updatedItems[itemIndex] = { ...updatedItems[itemIndex], voidRequested: false };
        return { ...order, items: updatedItems };
      }
      return order;
    }));
  };

  const handleCloseShift = () => {
    setIsShiftClosed(true);
    generateWhatsAppReport();
  };

  const resetDashboard = () => {
    if (window.confirm("This will clear all physical counts for a new shift. Continue?")) {
      setPhysicalCounts({ cash: 0, momo: 0, card: 0 });
      setIsShiftClosed(false);
      localStorage.removeItem("kurax_physical_counts");
      localStorage.removeItem("kurax_shift_closed");
    }
  };

  const generateWhatsAppReport = () => {
    const date   = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const report = `*KURAX BISTRO - DAILY AUDIT* 📅 *Date:* ${date}\n----------------------------------\n💰 *REVENUE SUMMARY*\n• Cash Sales: UGX ${systemTotals.cash.toLocaleString()}\n• Momo Sales: UGX ${systemTotals.momo.toLocaleString()}\n• Card Sales: UGX ${systemTotals.card.toLocaleString()}\n*TOTAL REVENUE: UGX ${totalRevenue.toLocaleString()}*`;
    navigator.clipboard.writeText(report);
    alert("Report copied to clipboard!");
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#0a0a0a] font-[Outfit] text-slate-200">
      <SideBar activeSection={activeSection} setActiveSection={setActiveSection} isOpen={mobileMenuOpen} setIsOpen={setMobileMenuOpen} />

      <div className="flex-1 flex flex-col">
        {/* HEADER */}
        <header className="flex justify-between items-center p-6 border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <div className="lg:hidden p-2 bg-zinc-900 rounded-lg cursor-pointer" onClick={() => setMobileMenuOpen(true)}>
              <Menu size={20}/>
            </div>
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">
              {activeSection.replace("_", " ")}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center bg-zinc-900 border border-white/5 rounded-xl px-4 py-2">
              <Search size={16} className="text-zinc-500 mr-2" />
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Orders..."
                className="bg-transparent border-none outline-none text-xs text-white w-48" />
            </div>
            <button onClick={resetDashboard}
              className="p-3 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/10 hover:bg-rose-500 hover:text-white transition-all">
              <RotateCcw size={18}/>
            </button>
          </div>
        </header>

        <main className="p-4 md:p-10 space-y-10">
          {/* VOID ALERT */}
          {voidRequests.length > 0 && (
            <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <AlertCircle className="text-rose-500 animate-pulse" />
                <p className="text-[10px] font-black uppercase text-zinc-400">{voidRequests.length} Pending Void Requests</p>
              </div>
              <button onClick={() => setActiveSection("LIVE AUDIT")}
                className="bg-rose-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase">Review</button>
            </div>
          )}

          {/* ── FINANCIAL HISTORY ── */}
          {activeSection === "FINANCIAL_HISTORY" && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <AccountantStatCard label="Cash" value={systemTotals.cash} icon={<Banknote size={16}/>} color="text-emerald-500" />
              <AccountantStatCard label="Momo" value={systemTotals.momo} icon={<Smartphone size={16}/>} color="text-blue-400" />
              <AccountantStatCard label="Card" value={systemTotals.card} icon={<CreditCard size={16}/>} color="text-purple-500" />
              <AccountantStatCard label="Gross" value={totalRevenue} icon={<Receipt size={16}/>} color="text-black" bgColor="bg-yellow-400" isDarkText />
            </div>
          )}

          {/* ── PHYSICAL COUNT ── */}
          {activeSection === "PHYSICAL COUNT" && (
            <DailyReconciliation systemTotals={systemTotals} counts={physicalCounts} setCounts={setPhysicalCounts} />
          )}

          {/* ── LIVE AUDIT / VOID REQUESTS ── */}
          {activeSection === "LIVE AUDIT" && (
            <section className="space-y-6 animate-in fade-in duration-500">
              {voidRequests.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-white/10 rounded-[3rem]">
                  <CheckCircle2 size={40} className="mx-auto text-zinc-800 mb-4" />
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest italic">No pending item void requests</p>
                </div>
              ) : (
                voidRequests.map(order => (
                  <div key={order?.id || Math.random()} className="bg-zinc-900/30 border border-white/5 p-8 rounded-[2.5rem]">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <p className="text-white font-black uppercase text-sm italic">Table {order?.tableName ?? "N/A"}</p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                          ORD#{order?.id ? order.id.slice(-6) : "000000"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-zinc-500 font-black uppercase">Current Order Total</p>
                        <p className="text-lg text-yellow-500 italic font-black">UGX {(order?.total ?? 0).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {order?.items?.map((item, idx) => {
                        if (!item?.voidRequested) return null;
                        const stationLower = item?.station?.toLowerCase() ?? "";
                        let staffLabel = "Chef";
                        let badgeColor = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
                        if (stationLower === "barman") { staffLabel = "Barman"; badgeColor = "bg-blue-500/10 text-blue-500 border-blue-500/20"; }
                        else if (stationLower === "barista" || stationLower === "coffee") { staffLabel = "Barista"; badgeColor = "bg-orange-500/10 text-orange-500 border-orange-500/20"; }
                        return (
                          <div key={idx} className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 bg-rose-500/5 border border-rose-500/10 rounded-2xl gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center text-rose-500 font-black italic text-xs">
                                {item?.quantity ?? 1}x
                              </div>
                              <div>
                                <p className="text-xs font-black text-white uppercase">{item?.name ?? "Unknown Item"}</p>
                                <div className="flex flex-wrap gap-2 mt-1.5 mb-2">
                                  <span className="text-[10px] font-black bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-white/5 uppercase">
                                    Waiter: {item?.requestedBy || order?.waiterName || "Staff"}
                                  </span>
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase ${badgeColor}`}>
                                    {staffLabel}: {item?.assignedTo || "Unassigned"}
                                  </span>
                                </div>
                                <p className="text-[10px] text-zinc-400 font-bold uppercase">
                                  Reason: <span className="text-rose-400 italic">"{item?.voidReason || "No reason provided"}"</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                              <button onClick={() => approveItemVoid(order.id, idx)}
                                className="flex-1 md:flex-none bg-rose-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase italic hover:bg-rose-500 active:scale-95">
                                Approve Void
                              </button>
                              <button onClick={() => rejectItemVoid(order.id, idx)}
                                className="flex-1 md:flex-none bg-zinc-800 text-zinc-400 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase italic border border-white/5 hover:bg-zinc-700">
                                Reject Request
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </section>
          )}

          {/* ── CREDITS LEDGER ── */}
          {activeSection === "CREDITS" && (
            <section className="space-y-6 animate-in fade-in duration-500">
              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-zinc-900/30 border border-white/5 p-5 rounded-[2rem]">
                  <div className="p-2.5 w-fit bg-purple-500/10 rounded-xl text-purple-400 mb-3"><BookOpen size={16}/></div>
                  <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Outstanding</p>
                  <h3 className="text-xl font-black text-purple-400 italic">UGX {totalOutstanding.toLocaleString()}</h3>
                  <p className="text-[9px] text-zinc-600 mt-0.5">{outstanding.length} clients</p>
                </div>
                <div className="bg-zinc-900/30 border border-white/5 p-5 rounded-[2rem]">
                  <div className="p-2.5 w-fit bg-emerald-500/10 rounded-xl text-emerald-400 mb-3"><CheckCircle2 size={16}/></div>
                  <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1">Settled (Total)</p>
                  <h3 className="text-xl font-black text-emerald-400 italic">UGX {totalSettled.toLocaleString()}</h3>
                  <p className="text-[9px] text-zinc-600 mt-0.5">{settled.length} records</p>
                </div>
                <div className="bg-yellow-500 border border-yellow-400 p-5 rounded-[2rem] col-span-2 md:col-span-1">
                  <div className="p-2.5 w-fit bg-black/20 rounded-xl text-black mb-3"><Receipt size={16}/></div>
                  <p className="text-[8px] font-black uppercase text-black/60 tracking-widest mb-1">All Time Credits</p>
                  <h3 className="text-xl font-black text-black italic">UGX {(totalOutstanding + totalSettled).toLocaleString()}</h3>
                  <p className="text-[9px] text-black/50 mt-0.5">{creditsLedger.length} total entries</p>
                </div>
              </div>

              {/* Filter tabs */}
              <div className="flex gap-1 p-1 bg-zinc-900 rounded-2xl w-fit">
                {[
                  { key: "all",         label: "All" },
                  { key: "outstanding", label: "Outstanding" },
                  { key: "settled",     label: "Settled" },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setCreditFilter(key)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                      ${creditFilter === key ? "bg-yellow-500 text-black" : "text-zinc-500 hover:text-zinc-300"}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Credits table */}
              {creditsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_,i) => (
                    <div key={i} className="h-24 rounded-[2rem] bg-zinc-900/30 animate-pulse border border-white/5" />
                  ))}
                </div>
              ) : filteredCredits.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                  <BookOpen size={32} className="mx-auto text-zinc-700 mb-3" />
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">No {creditFilter} credits</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCredits.map(credit => (
                    <AccountantCreditRow key={credit.id} credit={credit} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── END OF SHIFT ── */}
          {activeSection === "END OF SHIFT" && (
            <div className="max-w-2xl mx-auto bg-zinc-900 border border-white/10 p-10 rounded-[3rem] text-center">
              {!isShiftClosed ? (
                <button onClick={handleCloseShift}
                  className="w-full bg-yellow-400 text-black py-5 rounded-2xl font-black uppercase italic">
                  Finalize Shift
                </button>
              ) : (
                <div className="text-emerald-500 font-black uppercase italic">Shift Successfully Audited</div>
              )}
            </div>
          )}
        </main>
        <Footer />
      </div>

      {showPettyModal && (
        <PettyCashModal onClose={() => setShowPettyModal(false)} onSave={(amt, reason) => {
          console.log(`Expense: ${reason} — UGX ${amt}`);
          setShowPettyModal(false);
        }} />
      )}
    </div>
  );
}

// ─── ACCOUNTANT CREDIT ROW ────────────────────────────────────────────────────
function AccountantCreditRow({ credit }) {
  return (
    <div className={`bg-zinc-900/20 border rounded-[2rem] p-5 flex items-start justify-between gap-3 flex-wrap
      ${credit.paid ? "border-emerald-500/20 opacity-70" : "border-purple-500/30"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="font-black text-white uppercase italic tracking-tighter">
            {credit.table_name || "Table"}
          </span>
          {credit.paid
            ? <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase">Settled</span>
            : <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[9px] font-black uppercase">Outstanding</span>
          }
        </div>
        <div className="flex items-center gap-3 flex-wrap text-[10px]">
          <div className="flex items-center gap-1">
            <User size={10} className="text-zinc-600" />
            <span className="text-zinc-300 font-bold">{credit.client_name || "—"}</span>
          </div>
          {credit.client_phone && (
            <div className="flex items-center gap-1">
              <Phone size={10} className="text-zinc-600" />
              <span className="text-zinc-400">{credit.client_phone}</span>
            </div>
          )}
          {credit.pay_by && (
            <div className="flex items-center gap-1">
              <Calendar size={10} className="text-zinc-600" />
              <span className="text-zinc-400">Pays: {credit.pay_by}</span>
            </div>
          )}
        </div>
        {credit.paid && credit.settle_method && (
          <p className="text-[9px] text-zinc-600 mt-1.5 font-mono">
            Settled {credit.settle_method}{credit.settle_txn ? ` · TXN: ${credit.settle_txn}` : ""}
            {credit.settle_notes ? ` · ${credit.settle_notes}` : ""}
            {credit.paid_at ? ` · ${toLocalDateStr(new Date(credit.paid_at))}` : ""}
          </p>
        )}
        <p className="text-[9px] text-zinc-700 mt-1">
          Approved by {credit.approved_by} · {toLocalDateStr(new Date(credit.created_at))}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xl font-black text-purple-400 italic">
          UGX {Number(credit.amount).toLocaleString()}
        </p>
        {credit.paid && credit.amount_paid && Number(credit.amount_paid) !== Number(credit.amount) && (
          <p className="text-[9px] text-emerald-400 font-bold mt-0.5">
            Paid: UGX {Number(credit.amount_paid).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── OTHER COMPONENTS (unchanged) ─────────────────────────────────────────────
function DailyReconciliation({ systemTotals, counts, setCounts }) {
  const variances = {
    cash: (counts.cash || 0) - systemTotals.cash,
    momo: (counts.momo || 0) - systemTotals.momo,
    card: (counts.card || 0) - systemTotals.card,
  };
  const totalVariance = variances.cash + variances.momo + variances.card;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-zinc-900/30 border border-white/5 p-6 md:p-8 rounded-[2rem]">
        <h3 className="text-[10px] font-black uppercase italic text-yellow-500 mb-6 flex items-center gap-2">
          <Calculator size={14} /> Physical Input
        </h3>
        <div className="space-y-4">
          <ReconcileInput label="Cash" value={counts.cash} onChange={(v) => setCounts({...counts, cash: v})} />
          <ReconcileInput label="Momo" value={counts.momo} onChange={(v) => setCounts({...counts, momo: v})} />
          <ReconcileInput label="Card" value={counts.card} onChange={(v) => setCounts({...counts, card: v})} />
        </div>
      </div>
      <div className="bg-zinc-900/30 border border-white/5 p-6 md:p-8 rounded-[2rem]">
        <div className="space-y-3">
          <VarianceRow label="Cash Gap" amount={variances.cash} />
          <VarianceRow label="Momo Gap" amount={variances.momo} />
          <VarianceRow label="Card Gap" amount={variances.card} />
        </div>
        <div className={`mt-6 p-6 rounded-2xl border transition-colors ${totalVariance === 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}`}>
          <p className="text-[9px] font-black uppercase text-zinc-500 mb-1">Total Variance</p>
          <h4 className={`text-xl font-black italic ${totalVariance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            UGX {totalVariance.toLocaleString()}
          </h4>
        </div>
      </div>
    </div>
  );
}

function AccountantStatCard({ label, value, icon, color, bgColor = "bg-zinc-900/30", isDarkText = false }) {
  return (
    <div className={`${bgColor} border border-white/5 p-4 md:p-6 rounded-2xl md:rounded-3xl transition-all duration-300`}>
      <div className={`p-2 md:p-3 w-fit bg-black/20 rounded-xl mb-3 border border-white/5 ${color}`}>{icon}</div>
      <p className={`text-[7px] md:text-[10px] font-black uppercase mb-1 tracking-widest leading-none ${isDarkText ? "text-black/60" : "text-zinc-500"}`}>{label}</p>
      <h4 className={`text-[11px] md:text-xl font-black italic truncate leading-none ${isDarkText ? "text-black" : "text-white"}`}>
        UGX {value.toLocaleString()}
      </h4>
    </div>
  );
}

function ReconcileInput({ label, value, onChange }) {
  return (
    <div>
      <label className="text-[9px] font-black text-zinc-600 uppercase mb-1 block">{label}</label>
      <input type="number" className="w-full bg-black border border-white/5 p-3 rounded-xl text-sm font-black text-white outline-none focus:border-yellow-500"
        value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function VarianceRow({ label, amount }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 text-[10px] font-black uppercase">
      <span className="text-zinc-500">{label}</span>
      <span className={amount < 0 ? "text-rose-500" : "text-emerald-500"}>{amount.toLocaleString()}</span>
    </div>
  );
}

function PettyCashModal({ onClose, onSave }) {
  const [amt, setAmt]       = useState(0);
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8">
        <h3 className="text-sm font-black italic uppercase text-yellow-500 mb-6 text-center">Log New Expense</h3>
        <input type="text" placeholder="Description"
          className="w-full bg-black border border-white/5 p-4 rounded-xl text-xs font-bold text-white mb-4 outline-none placeholder:text-zinc-500"
          onChange={(e) => setReason(e.target.value)} />
        <input type="number" placeholder="Amount"
          className="w-full bg-black border border-white/5 p-4 rounded-xl text-xs font-bold text-white mb-6 outline-none placeholder:text-zinc-500"
          onChange={(e) => setAmt(Number(e.target.value))} />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-4 text-zinc-500 font-black uppercase text-[10px]">Cancel</button>
          <button onClick={() => onSave(amt, reason)} className="flex-[2] py-4 bg-yellow-400 text-black rounded-2xl font-black uppercase text-xs">Confirm</button>
        </div>
      </div>
    </div>
  );
}