import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import API_URL from "../../../config/api";

const DataContext = createContext();

// ── Kampala date helper ──────────────────────────────────────────────────────
function kampalaDateStr(d = new Date()) {
  return new Date(
    d.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })
  ).toISOString().split('T')[0];
}

// ── Normalise payment method strings ─────────────────────────────────────────
function normMethod(raw = '') {
  const m = raw.toLowerCase().trim();
  if (m === 'cash') return 'cash';
  if (m === 'mtn' || m === 'momo-mtn') return 'mtn';
  if (m === 'airtel' || m === 'momo-airtel') return 'airtel';
  if (m === 'momo') return 'mtn';
  if (m === 'card' || m === 'visa' || m === 'pos' || m === 'debit') return 'card';
  if (m === 'credit') return 'credit';
  if (m === 'mixed') return 'mixed';
  return 'unknown';
}

export const DataProvider = ({ children }) => {
  const [staffList, setStaffList] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menus, setMenus] = useState([]);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [todaySummary, setTodaySummary] = useState({
    summary_date: null,
    total_gross: 0,
    total_cash: 0,
    total_card: 0,
    total_mtn: 0,
    total_airtel: 0,
    total_credit: 0,
    total_mixed: 0,
    order_count: 0,
  });
  const [monthlySummary, setMonthlySummary] = useState({ totals: {}, daily: [] });
  const [pettyCash, setPettyCash] = useState({ total_in: 0, total_out: 0, net: 0, entries: [] });
  const [dailyGoal, setDailyGoal] = useState(20);
  const [monthlyTargets, setMonthlyTargets] = useState({});
  const [isGranted, setIsGranted] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('kurax_user');
    return saved ? JSON.parse(saved) : null;
  });

  // ── Day closure state ─────────────────────────────────────────────────────
  const [dayClosed, setDayClosed] = useState(false);
  const [lastClosedDate, setLastClosedDate] = useState(null);
  const [dayClosureInfo, setDayClosureInfo] = useState(null);
  const refreshIntervalRef = useRef(null);
  const sseRef = useRef(null);

  // ─── DEFINE ALL FETCH FUNCTIONS FIRST ─────────────────────────────────────
  const fetchTodaySummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/summaries/today?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setTodaySummary(data);
        return data;
      }
    } catch (err) {
      console.error("Failed to fetch today's summary:", err);
    }
    return null;
  }, []);

  const fetchMonthlySummary = useCallback(async (month) => {
    const m = month || new Date().toISOString().substring(0, 7);
    try {
      //const res = await fetch(`${API_URL}/api/summaries/monthly?month=${m}`);
      const res = await fetch(`${API_URL}/api/accountant/today?t=${Date.now()}`);
      if (res.ok) setMonthlySummary(await res.json());
    } catch (err) {
      console.error("Failed to fetch monthly summary:", err);
    }
  }, []);

  const fetchPettyCash = useCallback(async (date) => {
    const d = date || kampalaDateStr();
    try {
      const res = await fetch(`${API_URL}/api/summaries/petty-cash?date=${d}`);
      if (res.ok) setPettyCash(await res.json());
    } catch (err) {
      console.error("Failed to fetch petty cash:", err);
    }
  }, []);

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

  // ─── REFRESH DATA FUNCTION (DEFINED BEFORE IT'S USED) ─────────────────────
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
        permissionUrl ? fetch(permissionUrl) : Promise.reject('No User'),
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

      await Promise.allSettled([
        fetchTodaySummary(),
        fetchTargets(),
      ]);

      if (currentUser?.role === 'CASHIER') {
        fetchPettyCash();
      }

    } catch (err) {
      console.error("Sync Error:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, fetchTargets, fetchTodaySummary, fetchPettyCash]);

  // ─── FORCE REFRESH ────────────────────────────────────────────────────────
  const forceRefresh = useCallback(async () => {
    console.log("Force refresh requested");
    await refreshData(true);
    await fetchTodaySummary();
  }, [refreshData, fetchTodaySummary]);

  // ─── RESET ALL DATA AFTER DAY CLOSURE ─────────────────────────────────────
  const resetAllData = useCallback(async () => {
    console.log("Resetting all data after day closure...");
    
    setTodaySummary({
      summary_date: null,
      total_gross: 0,
      total_cash: 0,
      total_card: 0,
      total_mtn: 0,
      total_airtel: 0,
      total_credit: 0,
      total_mixed: 0,
      order_count: 0,
    });
    
    setPettyCash({ total_in: 0, total_out: 0, net: 0, entries: [] });
    setMonthlySummary({ totals: {}, daily: [] });
    setOrders([]);
    setStaffList([]);
    
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('payment_sent') || key.includes('day_closed') || key.includes('pending_payment'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    await refreshData(true);
    
    window.dispatchEvent(new CustomEvent('dataReset', { 
      detail: { message: 'All data has been reset after day closure', timestamp: new Date().toISOString() }
    }));
  }, [refreshData]);

  // ─── CHECK DAY CLOSURE ────────────────────────────────────────────────────
  const checkDayClosure = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/day-closure/day-status`);
      if (res.ok) {
        const data = await res.json();
        const today = kampalaDateStr();
        
        if (data.is_closed && lastClosedDate !== data.date) {
          console.log(`Day ${data.date} was closed by ${data.closed_by}`);
          setDayClosed(true);
          setLastClosedDate(data.date);
          setDayClosureInfo(data);
          await resetAllData();
          
          const notification = document.createElement('div');
          notification.innerHTML = `
            <div style="position: fixed; bottom: 20px; right: 20px; z-index: 9999; background: #10B981; color: white; padding: 16px 24px; border-radius: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); animation: slideIn 0.3s ease-out; font-family: system-ui;">
              ✅ Day has been closed! All totals have been reset for the new day.
            </div>
            <style>
              @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
            </style>
          `;
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 5000);
        } else if (!data.is_closed && dayClosed) {
          setDayClosed(false);
          setDayClosureInfo(null);
        }
      }
    } catch (e) {
      console.error("Check day closure error:", e);
    }
  }, [lastClosedDate, resetAllData, dayClosed]);

  // ─── SETUP SSE CONNECTION ─────────────────────────────────────────────────
  const setupSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
    }
    
    try {
      const eventSource = new EventSource(`${API_URL}/api/overview/stream`);
      sseRef.current = eventSource;
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'DAY_CLOSED') {
            console.log("Day closure event received via SSE");
            resetAllData();
          }
          
          if (['ORDER_CONFIRMED', 'PAYMENT_CONFIRMED', 'SUMMARY_UPDATE', 'CASHIER_CONFIRMED', 'CREDIT_SETTLED'].includes(data.type)) {
            fetchTodaySummary();
          }
          
          if (['CREDIT_CREATED', 'CREDIT_APPROVED', 'CREDIT_SETTLED', 'CREDIT_REJECTED'].includes(data.type)) {
            refreshData(false);
          }
        } catch (e) {
          console.error("Error parsing SSE message:", e);
        }
      };
      
      eventSource.onerror = () => {
        console.error("SSE connection error, will reconnect in 30 seconds");
        if (sseRef.current) {
          sseRef.current.close();
          sseRef.current = null;
        }
        setTimeout(() => setupSSE(), 30000);
      };
      
    } catch (e) {
      console.error("Failed to establish SSE connection:", e);
    }
  }, [fetchTodaySummary, refreshData, resetAllData]);

  // ─── GET STAFF STATS ──────────────────────────────────────────────────────
  const getStaffStats = useCallback((staffId, targetDate) => {
    const date = targetDate || kampalaDateStr();
    const staffOrders = orders.filter(o => {
      const oDate = kampalaDateStr(new Date(o.timestamp || o.created_at));
      return Number(o.staff_id) === Number(staffId) && oDate === date;
    });
    return staffOrders.reduce((acc, o) => {
      acc.totalOrders += 1;
      const paid = o.status === 'Paid' || o.status === 'Mixed' || o.status === 'Credit' || o.is_paid || o.isPaid;
      if (!paid) return acc;
      const amt = Number(o.total || 0);
      const norm = normMethod(o.payment_method);
      if (norm === 'mixed' || norm === 'credit') {
        acc.totalRevenue += norm === 'mixed' ? amt : 0;
        return acc;
      }
      acc.totalRevenue += amt;
      if (norm === 'mtn') acc.MTN += amt;
      else if (norm === 'airtel') acc.AIRTEL += amt;
      else if (norm === 'card') acc.CARD += amt;
      else if (norm === 'cash') acc.CASH += amt;
      return acc;
    }, { totalOrders: 0, totalRevenue: 0, CASH: 0, MTN: 0, AIRTEL: 0, CARD: 0 });
  }, [orders]);

  // ─── USE EFFECTS (AFTER ALL FUNCTIONS ARE DEFINED) ────────────────────────
  useEffect(() => {
    refreshData(true);
    setupSSE();
    
    refreshIntervalRef.current = setInterval(() => {
      refreshData(false);
      fetchTodaySummary();
    }, 10000);
    
    const closureInterval = setInterval(checkDayClosure, 30000);
    
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      clearInterval(closureInterval);
      if (sseRef.current) sseRef.current.close();
    };
  }, [refreshData, fetchTodaySummary, checkDayClosure, setupSSE]);

  // ─── VALUE PROVIDER ───────────────────────────────────────────────────────
  const value = {
    staffList, setStaffList,
    orders, setOrders,
    menus, setMenus,
    events, setEvents,
    currentUser, setCurrentUser,
    isGranted,
    isLoading,
    todaySummary,
    monthlySummary,
    pettyCash,
    fetchTodaySummary,
    fetchMonthlySummary,
    fetchPettyCash,
    getStaffStats,
    refreshData,
    forceRefresh,
    dailyGoal, setDailyGoal,
    monthlyTargets,
    dayClosed,
    lastClosedDate,
    dayClosureInfo,
    resetAllData,
    checkDayClosure,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};