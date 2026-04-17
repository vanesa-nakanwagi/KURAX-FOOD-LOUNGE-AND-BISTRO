import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NewOrder from "./NewOrder";
import PerformanceDashboard from "./PerformanceDashboard";
import ManageTables from "./ManageTables";
import Sidebar from "./Sidebar";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { useData } from "../../../customer/components/context/DataContext";


export default function WaiterLayout() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { currentUser } = useData() || {};

  // 1. IDENTITY & REDIRECT
  const savedUser = useMemo(() => JSON.parse(localStorage.getItem("kurax_user") || "{}"), []);
  const waiterName = currentUser?.name || savedUser?.name || "Staff Member";
  const waiterId = currentUser?.id || savedUser?.id;
  const firstName = waiterName.split(" ")[0];

  useEffect(() => {
    if (!waiterId && !savedUser?.id) {
      navigate("/staff/login");
    }
  }, [waiterId, navigate, savedUser]);

  // 2. NAVIGATION & SHARED STATE
  const [activeTab, setActiveTab] = useState("order");
  
  // These states allow ManageTables / OrderHistory to "push" data into NewOrder
  const [selectedTableData, setSelectedTableData] = useState(null);

  // 3. HANDLERS
  const handleLogout = () => {
    localStorage.removeItem("kurax_user");
    navigate("/staff/login");
  };

  // This function bridges ManageTables / OrderHistory -> NewOrder
  const handleEditTable = (tableInfo) => {
    setSelectedTableData(tableInfo); // Pass the table name and existing items
    setActiveTab("order");           // Switch view
  };

  return (
    <div className={`flex h-screen w-full font-[Outfit] overflow-hidden ${
      theme === "dark" ? "bg-black text-slate-100" : "bg-zinc-50 text-zinc-900"
    }`}>

      {/* ── SIDEBAR ── */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
      />

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* HEADER 
        <header className={`flex items-center justify-between px-6 py-4 border-b ${
          theme === "dark" ? "bg-zinc-950/50 border-white/5" : "bg-white border-black/5"
        }`}>
          <div>
             <h1 className="text-lg font-black uppercase tracking-tighter">
                {activeTab === 'order' && 'New Order'}
                {activeTab === 'manage' && 'Order History'}
                {activeTab === 'tables' && 'Table Management'}
             </h1>
          </div>
          
          <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${
            theme === "dark" ? "bg-zinc-900 border-white/5" : "bg-zinc-100 border-black/5"
          }`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest text-yellow-500">
                {firstName}
            </span>
          </div>
        </header>*/}

        {/* VIEW SWITCHER */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === "order" && (
             <NewOrder 
               preSelectedTable={selectedTableData} 
               onClearSelection={() => setSelectedTableData(null)} 
             /> 
          )}

          {activeTab === "manage" && (
            // ── FIXED: pass onAddItems so OrderHistory can bridge back to NewOrder ──
            <PerformanceDashboard onAddItems={handleEditTable} />
          )}

          {activeTab === "tables" && (
             <ManageTables onEditTable={handleEditTable} />
          )}
        </main>
      </div>
    </div>
  );
}