import React, { createContext, useState, useContext, useEffect } from 'react';
import burger from "../../assets/images/hero4.jpg";

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);

  // --- TARGETS STATE ---
  const [monthlyTargets, setMonthlyTargets] = useState(() => {
    const saved = localStorage.getItem('kurax_monthly_targets');
    // Default structure: { "2026-05": { revenue: 50000000, waiterQuota: 1000000 } }
    return saved ? JSON.parse(saved) : {};
  });

  const [dailyGoal, setDailyGoal] = useState(() => {
    return Number(localStorage.getItem('kurax_daily_goal')) || 20;
  });

  const [menus, setMenus] = useState(() => {
    const savedMenus = localStorage.getItem('kurax_menus');
    return savedMenus ? JSON.parse(savedMenus) : [
      { id: 1, name: 'Spring Menu 2024', price: 25000, image: burger, published: true, category: "Starters" }
    ];
  });

  const [events, setEvents] = useState(() => {
    const savedEvents = localStorage.getItem('kurax_events');
    return savedEvents ? JSON.parse(savedEvents) : [
      { id: 1, name: 'Live Jazz Night', date: '2026-02-14', published: true }
    ];
  });

  const [orders, setOrders] = useState(() => {
    const savedOrders = localStorage.getItem('kurax_orders');
    return savedOrders ? JSON.parse(savedOrders) : [];
  });

  const [staffList, setStaffList] = useState(() => {
    const savedStaff = localStorage.getItem('kurax_staff');
    return savedStaff ? JSON.parse(savedStaff) : [
        { id: 101, name: "Essah", role: "MANAGER", status: "ACTIVE", isPermitted: true, totalSales: 0, lastShiftTotal: 0 }
    ];
  });

  // --- NEW: REPORTING LOGIC ---
  const getDailyReport = (dateString) => {
    // Expects dateString format "YYYY-MM-DD"
    const filtered = orders.filter(order => {
      // Ensure your orders have a 'date' property like "2026-05-05"
      return order.date === dateString && order.status === "CLOSED";
    });

    const totalSales = filtered.reduce((sum, order) => sum + (order.total || 0), 0);
    
    // Grouping by Waiter Name found in the order logs
    const waiterPerformance = filtered.reduce((acc, order) => {
      const name = order.waiter || "Unknown";
      acc[name] = (acc[name] || 0) + (order.total || 0);
      return acc;
    }, {});

    return {
      orders: filtered,
      totalSales,
      waiterPerformance
    };
  };

  // --- NEW: TARGET SETTING LOGIC ---
  const updateMonthlyTarget = (monthKey, revenue, waiterQuota) => {
    setMonthlyTargets(prev => ({
      ...prev,
      [monthKey]: { revenue, waiterQuota }
    }));
  };

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
    localStorage.setItem('kurax_monthly_targets', JSON.stringify(monthlyTargets));
  }, [monthlyTargets]);

  useEffect(() => {
    localStorage.setItem('kurax_menus', JSON.stringify(menus));
    localStorage.setItem('kurax_events', JSON.stringify(events));
    localStorage.setItem('kurax_orders', JSON.stringify(orders));
  }, [menus, events, orders]);

  // --- SYNC ACROSS TABS ---
  useEffect(() => {
    const handleStorageChange = (e) => {
      try {
        if (!e.newValue) return;
        if (e.key === 'kurax_orders') {
          const newOrders = JSON.parse(e.newValue);
          setOrders(current => {
            if (JSON.stringify(current) === e.newValue) return current;
            return newOrders;
          });
        }
        if (e.key === 'kurax_monthly_targets') {
            setMonthlyTargets(JSON.parse(e.newValue));
        }
      } catch (err) {
        console.error("Sync Error:", err);
      }
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
      monthlyTargets, updateMonthlyTarget,
      getDailyReport,                      
      updateStaffPerformance 
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);