import React, { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import NewOrder from "./NewOrder";
import PerformanceDashboard from "./PerformanceDashboard";
import ManageTables from "./ManageTables";
import Sidebar from "./Sidebar";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { useData } from "../../../customer/components/context/DataContext";
import LogoutConfirmDialog from "../../components/LogoutConfirmDialog";


export default function WaiterLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { currentUser } = useData() || {};
  const orderToOpen = new URLSearchParams(location.search).get("order");

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
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [selectedTableData, setSelectedTableData] = useState(null);

  useEffect(() => {
    if (orderToOpen) setActiveTab("tables");
  }, [orderToOpen]);

  useEffect(() => {
    if (!location.state?.tableName) return;

    setSelectedTableData({ name: location.state.tableName, items: [] });
    setActiveTab("order");
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: { ...location.state, tableName: undefined },
    });
  }, [location.key, location.pathname, location.search, location.state, navigate]);

  // 3. HANDLERS
  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = () => {
    setShowLogoutDialog(false);
    localStorage.removeItem("kurax_user");
    navigate("/staff/login");
  };

  // This function bridges ManageTables / OrderHistory -> NewOrder
  const handleEditTable = (tableInfo) => {
    setSelectedTableData(tableInfo); // Pass the table name and existing items
    setActiveTab("order");           // Switch view
  };

  return (
    <>
      <LogoutConfirmDialog open={showLogoutDialog} onConfirm={confirmLogout} onCancel={() => setShowLogoutDialog(false)} />
      <div className={`flex h-dvh min-h-0 w-full font-[Outfit] overflow-hidden ${
        theme === "dark" ? "bg-black text-slate-100" : "bg-zinc-50 text-zinc-900"
      }`}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onLogout={handleLogout}
          openMenuRequest={location.state?.openSidebar ? 1 : 0}
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <main className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            {activeTab === "order" && (
              <NewOrder 
                preSelectedTable={selectedTableData} 
                onClearSelection={() => setSelectedTableData(null)} 
              /> 
            )}

            {activeTab === "performance" && (
              <PerformanceDashboard onAddItems={handleEditTable} />
            )}

            {activeTab === "tables" && (
              <ManageTables onEditTable={handleEditTable} focusOrderId={orderToOpen} />
            )}
          </main>
        </div>
      </div>
    </>
  );
}