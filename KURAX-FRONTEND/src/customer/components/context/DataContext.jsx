import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  // --- STATE ---
  const [staffList, setStaffList] = useState([]); 
  const [orders, setOrders] = useState([]);       
  const [menus, setMenus] = useState([]);         
  const [events, setEvents] = useState([]);       
  const [dailyGoal, setDailyGoal] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('kurax_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // --- 1. THE "LIVE SYNC" ENGINE ---
  const refreshData = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setIsLoading(true);
    
    try {
      // Promise.allSettled ensures one crashed route doesn't break the whole app
      const [staffRes, orderRes, menuRes, eventRes] = await Promise.allSettled([
        fetch('http://localhost:5000/api/staff'),
        fetch('http://localhost:5000/api/orders'),
        fetch('http://localhost:5000/api/menus'),
        fetch('http://localhost:5000/api/events')
      ]);

      // Update Staff (Director's view)
      if (staffRes.status === 'fulfilled' && staffRes.value.ok) {
        setStaffList(await staffRes.value.json());
      }

      // Update Orders (Real-time Table Management)
      if (orderRes.status === 'fulfilled' && orderRes.value.ok) {
        setOrders(await orderRes.value.json());
      }

      // Update Menus
      if (menuRes.status === 'fulfilled' && menuRes.value.ok) {
        setMenus(await menuRes.value.json());
      }

      // Update Events with Tag Sanitization
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
  }, []);

  // --- 2. THE POLLING EFFECT ---
  useEffect(() => {
    // Initial fetch
    refreshData(true);

    // Live polling every 5 seconds for snappy table management
    const interval = setInterval(() => {
      refreshData(false);
    }, 5000); 

    return () => clearInterval(interval);
  }, [refreshData]);

  // --- 3. STAFF PERFORMANCE LOGIC ---
  // Memoized so it only recalculates if orders or staffList change
  const getStaffStats = useCallback((staffId) => {
    if (!orders.length) return { totalOrders: 0, totalRevenue: 0, CASH: 0, MOMO: 0, CARD: 0 };

    const staffOrders = orders.filter(o => Number(o.staff_id) === Number(staffId));
    
    return staffOrders.reduce((acc, o) => {
      const amt = Number(o.total || 0);
      acc.totalOrders += 1;
      acc.totalRevenue += amt;
      
      const method = (o.payment_method || 'CASH').toUpperCase();
      if (acc[method] !== undefined) {
        acc[method] += amt;
      } else {
        acc[method] = amt;
      }
      
      return acc;
    }, { totalOrders: 0, totalRevenue: 0, CASH: 0, MOMO: 0, CARD: 0 });
  }, [orders]);

  // --- 4. EXPORTED VALUE ---
  const value = { 
    staffList, setStaffList,
    orders, setOrders,
    menus, setMenus,     
    events, setEvents,  
    currentUser, setCurrentUser,
    getStaffStats, 
    refreshData,   
    dailyGoal, setDailyGoal,
    isLoading
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};