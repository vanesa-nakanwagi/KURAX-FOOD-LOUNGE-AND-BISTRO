import React, { createContext, useState, useContext, useEffect } from 'react';
import burger from "../../assets/images/hero4.jpg";

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  // --- USER STATE ---
  const [currentUser, setCurrentUser] = useState(null);

  // --- DAILY GOAL STATE ---
  const [dailyGoal, setDailyGoal] = useState(() => {
    return Number(localStorage.getItem('kurax_daily_goal')) || 20;
  });

  // --- MENUS STATE ---
  const [menus, setMenus] = useState(() => {
    const savedMenus = localStorage.getItem('kurax_menus');
    return savedMenus ? JSON.parse(savedMenus) : [
      { id: 1, name: 'Spring Menu 2024', price: 25000, image: burger, published: true, category: "Starters" }
    ];
  });

  // --- EVENTS STATE ---
  const [events, setEvents] = useState(() => {
    const savedEvents = localStorage.getItem('kurax_events');
    return savedEvents ? JSON.parse(savedEvents) : [
      { id: 1, name: 'Live Jazz Night', date: '2026-02-14', published: true }
    ];
  });

  // --- ORDERS STATE ---
  const [orders, setOrders] = useState(() => {
    const savedOrders = localStorage.getItem('kurax_orders');
    return savedOrders ? JSON.parse(savedOrders) : [];
  });

  // --- STAFF STATE ---
  const [staffList, setStaffList] = useState(() => {
    const savedStaff = localStorage.getItem('kurax_staff');
    return savedStaff ? JSON.parse(savedStaff) : [
        { id: 101, name: "Essah", role: "MANAGER", status: "ACTIVE", isPermitted: true, totalSales: 0, lastShiftTotal: 0 }
    ];
  });

  // --- PERFORMANCE LOGIC ---
  const updateStaffPerformance = (staffName, shiftTotal) => {
    setStaffList(prev => {
      const updatedList = prev.map(staff => 
        staff.name === staffName 
          ? { 
              ...staff, 
              lastShiftTotal: shiftTotal, 
              totalSales: (Number(staff.totalSales) || 0) + shiftTotal,
              lastShiftDate: new Date().toISOString()
            } 
          : staff
      );
      return updatedList;
    });
  };

  // --- PERSISTENCE ---
  useEffect(() => {
    localStorage.setItem('kurax_staff', JSON.stringify(staffList));
  }, [staffList]);

  useEffect(() => {
    localStorage.setItem('kurax_daily_goal', dailyGoal.toString());
  }, [dailyGoal]);

  useEffect(() => {
    localStorage.setItem('kurax_menus', JSON.stringify(menus));
    localStorage.setItem('kurax_events', JSON.stringify(events));
    localStorage.setItem('kurax_orders', JSON.stringify(orders));
  }, [menus, events, orders]);

  // --- SYNC ACROSS TABS ---
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'kurax_orders' && e.newValue) setOrders(JSON.parse(e.newValue));
      if (e.key === 'kurax_staff' && e.newValue) setStaffList(JSON.parse(e.newValue));
      if (e.key === 'kurax_daily_goal' && e.newValue) setDailyGoal(Number(e.newValue));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <DataContext.Provider value={{ 
      menus, setMenus, 
      events, setEvents, 
      orders, setOrders,
      staffList, setStaffList,
      currentUser, setCurrentUser,
      dailyGoal, setDailyGoal,
      updateStaffPerformance 
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);