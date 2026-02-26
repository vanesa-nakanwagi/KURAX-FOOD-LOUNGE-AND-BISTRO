import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  // --- STATE ---
  const [staffList, setStaffList] = useState([]); 
  const [orders, setOrders] = useState([]);       
  const [menus, setMenus] = useState([]);         
  const [events, setEvents] = useState([]);       
  const [dailyGoal, setDailyGoal] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  
  // NEW: Permission state for the Manager Gate
  const [isGranted, setIsGranted] = useState(false);

  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('kurax_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // --- 1. THE "LIVE SYNC" ENGINE ---
  const refreshData = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setIsLoading(true);
    
    try {
      // Add the permission check to the parallel fetch
      // We pass the currentUser.id to check if THIS specific manager is allowed
      const permissionUrl = currentUser 
        ? `http://localhost:5000/api/permissions/${currentUser.id}`
        : null;

      const [staffRes, orderRes, menuRes, eventRes, permRes] = await Promise.allSettled([
        fetch('http://localhost:5000/api/staff'),
        fetch('http://localhost:5000/api/orders'),
        fetch('http://localhost:5000/api/menus'),
        fetch('http://localhost:5000/api/events'),
        permissionUrl ? fetch(permissionUrl) : Promise.reject('No User')
      ]);

      // Update Staff
      if (staffRes.status === 'fulfilled' && staffRes.value.ok) {
        setStaffList(await staffRes.value.json());
      }

      // Update Orders
      if (orderRes.status === 'fulfilled' && orderRes.value.ok) {
        setOrders(await orderRes.value.json());
      }

      // Update Menus
      if (menuRes.status === 'fulfilled' && menuRes.value.ok) {
        setMenus(await menuRes.value.json());
      }

      // Update Permissions (The Gatekeeper)
      if (permRes.status === 'fulfilled' && permRes.value.ok) {
        const data = await permRes.value.json();
        setIsGranted(data.is_granted); // Expecting { is_granted: true/false }
      } else {
        // If the request fails or no user, default to locked for safety
        setIsGranted(false);
      }

      // Update Events
      if (eventRes.status === 'fulfilled' && eventRes.value.ok) {
        const rawEvents = await eventRes.value.json();
        const sanitizedEvents = rawEvents.map(event => ({
          ...event,
          tags: typeof event.tags === 'string' ? JSON.parse(event.tags) : (event.tags || [])
        }));
        setEvents(sanitizedEvents);
      }
      
    } catch (err) {
      console.error("Sync Error:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]); // Re-run if user changes (logout/login)

  useEffect(() => {
    refreshData(true);
    const interval = setInterval(() => {
      refreshData(false);
    }, 5000); 

    return () => clearInterval(interval);
  }, [refreshData]);

  // Performance stats logic remains the same...
  const getStaffStats = useCallback((staffId) => {
    if (!orders.length) return { totalOrders: 0, totalRevenue: 0, CASH: 0, MOMO: 0, CARD: 0 };
    const staffOrders = orders.filter(o => Number(o.staff_id) === Number(staffId));
    return staffOrders.reduce((acc, o) => {
      const amt = Number(o.total || 0);
      acc.totalOrders += 1;
      acc.totalRevenue += amt;
      const method = (o.payment_method || 'CASH').toUpperCase();
      if (acc[method] !== undefined) acc[method] += amt;
      else acc[method] = amt;
      return acc;
    }, { totalOrders: 0, totalRevenue: 0, CASH: 0, MOMO: 0, CARD: 0 });
  }, [orders]);

  const value = { 
    staffList, setStaffList,
    orders, setOrders,
    menus, setMenus,     
    events, setEvents,  
    currentUser, setCurrentUser,
    isGranted, // Export this so Layout can see it
    getStaffStats, 
    refreshData,   
    dailyGoal, setDailyGoal,
    isLoading
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within a DataProvider");
  return context;
};