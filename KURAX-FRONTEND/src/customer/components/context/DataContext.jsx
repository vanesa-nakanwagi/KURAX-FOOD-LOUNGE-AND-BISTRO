import React, { createContext, useState, useContext, useEffect, useCallback, useRef, useMemo } from 'react';
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

// ─── Create fallback weekly data (empty chart) ──────────────────────────────
function createFallbackWeeklyData() {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  return days.map((day, index) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - index));
    return {
      date: day,
      fullDate: d.toISOString().split('T')[0],
      total_cash: 0, total_card: 0, total_mtn: 0,
      total_airtel: 0, total_settled_credits: 0, total_gross: 0,
    };
  });
}

export const DataProvider = ({ children }) => {
  // ─── Raw data from APIs ───────────────────────────────────────────────────
  const [staffList, setStaffList]     = useState([]);
  const [allOrders, setAllOrders]     = useState([]); // unfiltered (includes archived)
  const [menus, setMenus]             = useState([]);
  const [events, setEvents]           = useState([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [globalResetKey, setGlobalResetKey] = useState(0);

  // ─── Financial summaries ──────────────────────────────────────────────────
  const [todaySummary, setTodaySummary] = useState({
    summary_date: null,
    total_gross: 0, total_cash: 0, total_card: 0,
    total_mtn: 0, total_airtel: 0, total_credit: 0,
    total_mixed: 0, order_count: 0,
  });
  const [weeklyRevenue, setWeeklyRevenue] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState({ totals: {}, daily: [] });
  const [pettyCash, setPettyCash] = useState({ total_in: 0, total_out: 0, net: 0, entries: [] });

  // ─── Targets and user state ───────────────────────────────────────────────
  const [dailyGoal, setDailyGoal] = useState(20);
  const [monthlyTargets, setMonthlyTargets] = useState({});
  const [isGranted, setIsGranted] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('kurax_user');
    return saved ? JSON.parse(saved) : null;
  });

  // ─── Day closure state ────────────────────────────────────────────────────
  const [dayClosed, setDayClosed]           = useState(false);
  const [lastClosedDate, setLastClosedDate] = useState(null);
  const [dayClosureInfo, setDayClosureInfo] = useState(null);

  // ─── Refs for polling / SSE / timers ──────────────────────────────────────
  const refreshIntervalRef = useRef(null);
  const sseRef             = useRef(null);
  const currentUserRef     = useRef(currentUser);
  const lastClosedDateRef  = useRef(lastClosedDate);
  const dayClosedRef       = useRef(dayClosed);

  useEffect(() => { currentUserRef.current   = currentUser;    }, [currentUser]);
  useEffect(() => { lastClosedDateRef.current = lastClosedDate; }, [lastClosedDate]);
  useEffect(() => { dayClosedRef.current      = dayClosed;      }, [dayClosed]);

  // ─── FILTERED ORDERS (respects day closure & user role) ──────────────────
  const orders = useMemo(() => {
    if (!dayClosed) return allOrders;
    const role = currentUser?.role?.toUpperCase();
    const canSeeArchived = role === 'ACCOUNTANT';
    if (canSeeArchived) return allOrders;
    return allOrders.filter(order => !order.is_archived);
  }, [allOrders, dayClosed, currentUser]);

  // ─── DATA FETCHERS ────────────────────────────────────────────────────────
  const fetchTodaySummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/summaries/today?t=${Date.now()}`);
      if (res.ok) setTodaySummary(await res.json());
    } catch (err) { console.error("fetchTodaySummary error:", err); }
  }, []);

  const fetchWeeklyRevenue = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/overview/weekly-revenue?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) setWeeklyRevenue(data);
        else setWeeklyRevenue(createFallbackWeeklyData());
      } else setWeeklyRevenue(createFallbackWeeklyData());
    } catch (err) {
      console.error("fetchWeeklyRevenue error:", err);
      setWeeklyRevenue(createFallbackWeeklyData());
    }
  }, []);

  const fetchMonthlySummary = useCallback(async (month) => {
    const targetMonth = month || new Date().toISOString().substring(0, 7);
    try {
      const res = await fetch(`${API_URL}/api/accountant/monthly-profit?month=${targetMonth}&t=${Date.now()}`);
      if (res.ok) setMonthlySummary(await res.json());
    } catch (err) { console.error("fetchMonthlySummary error:", err); }
  }, []);

  const fetchPettyCash = useCallback(async (date) => {
    const d = date || kampalaDateStr();
    try {
      const res = await fetch(`${API_URL}/api/summaries/petty-cash?date=${d}`);
      if (res.ok) setPettyCash(await res.json());
    } catch (err) { console.error("fetchPettyCash error:", err); }
  }, []);

  const fetchTargets = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/manager/target-progress`);
      if (res.ok) {
        const data = await res.json();
        const currentMonth = new Date().toISOString().substring(0, 7);
        setMonthlyTargets(prev => ({
          ...prev,
          [currentMonth]: { revenue: data.target },
        }));
      }
    } catch (err) { console.error("fetchTargets error:", err); }
  }, []);

  // ─── REFRESH ALL DATA (full sync) ─────────────────────────────────────────
  const refreshAllData = useCallback(async () => {
    try {
      const user = currentUserRef.current;
      const permissionUrl = user ? `${API_URL}/api/staff/permission/${user.id}` : null;

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
        setAllOrders(await orderRes.value.json());
      if (menuRes.status === 'fulfilled' && menuRes.value.ok)
        setMenus(await menuRes.value.json());

      if (permRes.status === 'fulfilled' && permRes.value.ok) {
        const data = await permRes.value.json();
        setIsGranted(user?.role === 'DIRECTOR' ? true : data.is_granted);
      } else {
        setIsGranted(user?.role === 'DIRECTOR');
      }

      if (eventRes.status === 'fulfilled' && eventRes.value.ok) {
        const rawEvents = await eventRes.value.json();
        setEvents(rawEvents.map(event => ({
          ...event,
          tags: typeof event.tags === 'string' ? JSON.parse(event.tags) : (event.tags || []),
        })));
      }

      await Promise.allSettled([
        fetchTodaySummary(),
        fetchWeeklyRevenue(),
        fetchTargets(),
      ]);
      if (currentUserRef.current?.role === 'CASHIER') fetchPettyCash();
    } catch (err) {
      console.error("refreshAllData error:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchTodaySummary, fetchWeeklyRevenue, fetchTargets, fetchPettyCash]);

  // ─── RESET DAY DATA (called after day closure) ────────────────────────────
  const resetDayData = useCallback(async () => {
    console.log("Resetting day‑specific data after closure...");
    setTodaySummary({
      summary_date: null,
      total_gross: 0, total_cash: 0, total_card: 0,
      total_mtn: 0, total_airtel: 0, total_credit: 0,
      total_mixed: 0, order_count: 0,
    });
    setPettyCash({ total_in: 0, total_out: 0, net: 0, entries: [] });
    setGlobalResetKey(prev => prev + 1);

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('payment_sent') || key.includes('day_closed') || key.includes('pending_payment'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    await refreshAllData();

    window.dispatchEvent(new CustomEvent('dayClosed', {
      detail: { date: lastClosedDateRef.current, message: 'Business day closed. Daily totals reset.' },
    }));
  }, [refreshAllData]);

  // ─── CLOSE DAY (called by Accountant) ─────────────────────────────────────
  const closeDayAndReset = useCallback(async () => {
    const user = currentUserRef.current;
    const res = await fetch(`${API_URL}/api/day-closure/close-day`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        closed_by: user?.name || user?.username || 'Accountant',
        closed_by_id: user?.id,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to close day. Please try again.');
    }

    const data = await res.json();
    setDayClosed(true);
    setLastClosedDate(data.closing_date || kampalaDateStr());
    setDayClosureInfo(data);
    await resetDayData();
    return data;
  }, [resetDayData]);

  // ─── POLL DAY STATUS (fallback for SSE) ──────────────────────────────────
  const checkDayClosure = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/day-closure/day-status`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.is_closed && lastClosedDateRef.current !== data.date) {
        console.log(`Day ${data.date} was closed by ${data.closed_by}`);
        setDayClosed(true);
        setLastClosedDate(data.date);
        setDayClosureInfo(data);
        await resetDayData();
        const div = document.createElement('div');
        div.innerHTML = `<div style="position:fixed;bottom:20px;right:20px;z-index:9999;background:#10B981;color:white;padding:16px 24px;border-radius:16px;font-weight:bold;box-shadow:0 4px 6px rgba(0,0,0,0.1);animation:slideIn 0.3s;">✅ Day closed! Totals reset.</div>`;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 5000);
      } else if (!data.is_closed && dayClosedRef.current) {
        setDayClosed(false);
        setDayClosureInfo(null);
      }
    } catch (e) {
      console.error("checkDayClosure error:", e);
    }
  }, [resetDayData]);

  // ─── SSE SETUP (real‑time events) ─────────────────────────────────────────
  const setupSSE = useCallback(() => {
    if (sseRef.current) sseRef.current.close();
    try {
      const es = new EventSource(`${API_URL}/api/overview/stream`);
      sseRef.current = es;
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'DAY_CLOSED') {
            setDayClosed(true);
            setLastClosedDate(data.date || kampalaDateStr());
            setDayClosureInfo(data);
            resetDayData();
          }
          if (['ORDER_CONFIRMED', 'PAYMENT_CONFIRMED', 'SUMMARY_UPDATE',
               'CASHIER_CONFIRMED', 'CREDIT_SETTLED'].includes(data.type)) {
            fetchTodaySummary();
            fetchWeeklyRevenue();
          }
          if (['CREDIT_CREATED', 'CREDIT_APPROVED', 'CREDIT_SETTLED',
               'CREDIT_REJECTED'].includes(data.type)) {
            refreshAllData();
            fetchWeeklyRevenue();
          }
        } catch (e) {
          console.error("SSE message parse error:", e);
        }
      };
      es.onerror = () => {
        console.error("SSE connection error, reconnecting in 30s");
        es.close();
        setTimeout(setupSSE, 30000);
      };
    } catch (e) {
      console.error("Failed to establish SSE connection:", e);
    }
  }, [fetchTodaySummary, fetchWeeklyRevenue, refreshAllData, resetDayData]);

  // ─── STAFF STATS (helper) ─────────────────────────────────────────────────
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
      if (norm === 'mtn')         acc.MTN    += amt;
      else if (norm === 'airtel') acc.AIRTEL += amt;
      else if (norm === 'card')   acc.CARD   += amt;
      else if (norm === 'cash')   acc.CASH   += amt;
      return acc;
    }, { totalOrders: 0, totalRevenue: 0, CASH: 0, MTN: 0, AIRTEL: 0, CARD: 0 });
  }, [orders]);

  // ─── INITIAL BOOTSTRAP ────────────────────────────────────────────────────
  useEffect(() => {
    refreshAllData();
    setupSSE();
    refreshIntervalRef.current = setInterval(() => {
      refreshAllData();
      fetchTodaySummary();
      fetchWeeklyRevenue();
    }, 10000);
    const closureInterval = setInterval(checkDayClosure, 30000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      clearInterval(closureInterval);
      if (sseRef.current) sseRef.current.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── CONTEXT VALUE (includes allOrders) ───────────────────────────────────
  const value = {
    // Data
    staffList, setStaffList,
    allOrders,                    // ← raw orders (includes archived)
    orders,                       // filtered orders (respects day closure)
    setOrders: (newOrders) => setAllOrders(newOrders),
    menus, setMenus,
    events, setEvents,
    isLoading,
    globalResetKey,

    // Auth
    currentUser, setCurrentUser,
    isGranted,

    // Financials
    todaySummary,
    weeklyRevenue,
    monthlySummary,
    pettyCash,
    dailyGoal, setDailyGoal,
    monthlyTargets,

    // Fetchers
    fetchTodaySummary,
    fetchWeeklyRevenue,
    fetchMonthlySummary,
    fetchPettyCash,
    fetchTargets,

    // Refresh / reset
    refreshData: refreshAllData,
    forceRefresh: refreshAllData,
    resetDayData,
    closeDayAndReset,

    // Staff
    getStaffStats,

    // Day closure state
    dayClosed,
    lastClosedDate,
    dayClosureInfo,
    checkDayClosure,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};

export default DataContext;