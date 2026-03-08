import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import API_URL from "../../../config/api";
const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [staffList, setStaffList] = useState([]); 
  const [orders, setOrders] = useState([]);       
  const [menus, setMenus] = useState([]);         
  const [events, setEvents] = useState([]);       
  const [isLoading, setIsLoading] = useState(true);
  
  // --- MANAGEMENT TARGETS (Synced with DB) ---
  const [dailyGoal, setDailyGoal] = useState(20); 
  const [monthlyTargets, setMonthlyTargets] = useState({}); // Stores { "2026-03": { revenue: 6000000 } }
  
  const [isGranted, setIsGranted] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('kurax_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // --- NEW: Function to fetch Targets from Database ---
  const fetchTargets = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/manager/target-progress`); // Using your existing analytics route
      if (res.ok) {
        const data = await res.json();
        // Assuming your backend returns current month data
        const currentMonth = new Date().toISOString().substring(0, 7);
        setMonthlyTargets(prev => ({
          ...prev,
          [currentMonth]: { revenue: data.target }
        }));
      }
    } catch (err) {
      console.error("Failed to fetch targets:", err);
    }
  }, []);

  const refreshData = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setIsLoading(true);
    
    try {
      const permissionUrl = currentUser 
        ? `${API_URL}/api/staff/permission/${currentUser.id}`
        : null;

      // Added fetchTargets to the parallel load
      const [staffRes, orderRes, menuRes, eventRes, permRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/staff`),
        fetch(`${API_URL}/api/orders`),
        fetch(`${API_URL}/api/menus`),
        fetch(`${API_URL}/api/events`),
        permissionUrl ? fetch(permissionUrl) : Promise.reject('No User')
      ]);

      if (staffRes.status === 'fulfilled' && staffRes.value.ok) setStaffList(await staffRes.value.json());
      if (orderRes.status === 'fulfilled' && orderRes.value.ok) setOrders(await orderRes.value.json());
      if (menuRes.status === 'fulfilled' && menuRes.value.ok) setMenus(await menuRes.value.json());

      if (permRes.status === 'fulfilled' && permRes.value.ok) {
        const data = await permRes.value.json();
        setIsGranted(currentUser?.role === 'DIRECTOR' ? true : data.is_granted);
      } else {
        setIsGranted(currentUser?.role === 'DIRECTOR'); 
      }

      if (eventRes.status === 'fulfilled' && eventRes.value.ok) {
        const rawEvents = await eventRes.value.json();
        setEvents(rawEvents.map(event => ({
          ...event,
          tags: typeof event.tags === 'string' ? JSON.parse(event.tags) : (event.tags || [])
        })));
      }
      
      // Also fetch targets
      fetchTargets();

    } catch (err) {
      console.error("Sync Error:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, fetchTargets]);

  useEffect(() => {
    refreshData(true);
    const interval = setInterval(() => refreshData(false), 10000); // 10s is plenty for background sync
    return () => clearInterval(interval);
  }, [refreshData]);

  // --- Target Stats Helpers ---
  const getStaffStats = useCallback((staffId, targetDate = new Date().toISOString().split('T')[0]) => {
    const staffOrders = orders.filter(o => {
      const oDate = new Date(o.timestamp || o.created_at).toISOString().split('T')[0];
      return (Number(o.staff_id) === Number(staffId)) && oDate === targetDate;
    });
    // ... rest of your reduce logic remains the same
    return staffOrders.reduce((acc, o) => {
        const amt = Number(o.total || 0);
        acc.totalOrders += 1;
        acc.totalRevenue += amt;
        const method = (o.payment_method || 'CASH').toUpperCase();
        if (method.includes('MTN')) acc.MTN += amt;
        else if (method.includes('AIRTEL')) acc.AIRTEL += amt;
        else if (method.includes('CARD')) acc.CARD += amt;
        else acc.CASH += amt;
        return acc;
      }, { totalOrders: 0, totalRevenue: 0, CASH: 0, MTN: 0, AIRTEL: 0, CARD: 0 });
  }, [orders]);

  const value = { 
    staffList, setStaffList,
    orders, setOrders,
    menus, setMenus,     
    events, setEvents,  
    currentUser, setCurrentUser,
    isGranted,
    getStaffStats, 
    refreshData,   
    dailyGoal, setDailyGoal,
    monthlyTargets, // Use this object instead of a single number
    isLoading
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => useContext(DataContext);