import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import API_URL from "../../../config/api";
const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [staffList,       setStaffList]       = useState([]);
  const [orders,          setOrders]          = useState([]);
  const [menus,           setMenus]           = useState([]);
  const [events,          setEvents]          = useState([]);
  const [isLoading,       setIsLoading]       = useState(true);

  // --- MANAGEMENT TARGETS (Synced with DB) ---
  const [dailyGoal,        setDailyGoal]        = useState(20);
  const [monthlyTargets,   setMonthlyTargets]   = useState({});

  const [isGranted,    setIsGranted]    = useState(false);
  const [currentUser,  setCurrentUser]  = useState(() => {
    const savedUser = localStorage.getItem('kurax_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const fetchTargets = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/manager/target-progress`);
      if (res.ok) {
        const data = await res.json();
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

      const [staffRes, orderRes, menuRes, eventRes, permRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/staff`),
        fetch(`${API_URL}/api/orders`),
        fetch(`${API_URL}/api/menus`),
        fetch(`${API_URL}/api/events`),
        permissionUrl ? fetch(permissionUrl) : Promise.reject('No User')
      ]);

      if (staffRes.status === 'fulfilled' && staffRes.value.ok)
        setStaffList(await staffRes.value.json());
      if (orderRes.status === 'fulfilled' && orderRes.value.ok)
        setOrders(await orderRes.value.json());
      if (menuRes.status === 'fulfilled' && menuRes.value.ok)
        setMenus(await menuRes.value.json());

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

      fetchTargets();

    } catch (err) {
      console.error("Sync Error:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, fetchTargets]);

  useEffect(() => {
    refreshData(true);
    const interval = setInterval(() => refreshData(false), 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // ── getStaffStats ──────────────────────────────────────────────────────────
  // Returns order counts and revenue breakdown for a given staff member on a
  // given date. Used by manager/director dashboards for target tracking.
  //
  // FIX 1: Only counts PAID orders for revenue (was counting all orders).
  // FIX 2: payment_method='Mixed' (per-item paid tables) is correctly excluded
  //        from CASH/MTN/AIRTEL/CARD splits — it falls into totalRevenue only.
  //        Accurate per-method splits for Mixed tables live in cashier_queue
  //        and are read separately by OrderHistory for the waiter's own view.
  // FIX 3: Credits are counted in totalRevenue but NOT in method buckets.
  const getStaffStats = useCallback((staffId, targetDate = new Date().toISOString().split('T')[0]) => {
    const staffOrders = orders.filter(o => {
      const oDate = new Date(o.timestamp || o.created_at).toISOString().split('T')[0];
      return (Number(o.staff_id) === Number(staffId)) && oDate === targetDate;
    });

    return staffOrders.reduce((acc, o) => {
      acc.totalOrders += 1;

      // Only count revenue from paid/settled orders
      const paid = o.status === "Paid"   || o.status === "Mixed"
                || o.status === "Credit" || o.is_paid || o.isPaid;
      if (!paid) return acc;

      const amt    = Number(o.total || 0);
      acc.totalRevenue += amt;

      const method = (o.payment_method || '').toUpperCase();

      // Mixed = per-item paid with different methods — we can't split accurately
      // here because the orders row only has payment_method='Mixed'. The detailed
      // breakdown lives in cashier_queue. Add to totalRevenue only.
      if (method === 'MIXED' || method === 'CREDIT') return acc;

      if      (method.includes('MTN'))    acc.MTN    += amt;
      else if (method.includes('AIRTEL')) acc.AIRTEL += amt;
      else if (method.includes('CARD'))   acc.CARD   += amt;
      else                                acc.CASH   += amt;

      return acc;
    }, { totalOrders: 0, totalRevenue: 0, CASH: 0, MTN: 0, AIRTEL: 0, CARD: 0 });
  }, [orders]);

  const value = {
    staffList,  setStaffList,
    orders,     setOrders,
    menus,      setMenus,
    events,     setEvents,
    currentUser, setCurrentUser,
    isGranted,
    getStaffStats,
    refreshData,
    dailyGoal,  setDailyGoal,
    monthlyTargets,
    isLoading
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => useContext(DataContext);