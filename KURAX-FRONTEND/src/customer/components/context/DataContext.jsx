import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import API_URL from "../../../config/api";

const DataContext = createContext();

// ── Kampala date helper (reused by getStaffStats + fetchPettyCash) ────────────
// new Date().toISOString() gives UTC — in Kampala (UTC+3) that's yesterday
// for any timestamp before 3 am. Always convert via Africa/Nairobi first.
function kampalaDateStr(d = new Date()) {
  return new Date(
    d.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })
  ).toISOString().split('T')[0];
}

// ── Normalise payment method strings ─────────────────────────────────────────
// DB can contain: "Cash" "MTN" "Airtel" "Momo-MTN" "Momo-Airtel" "Momo"
//                 "Card" "Visa" "Credit" "Mixed"
// Returns one of: 'cash' | 'mtn' | 'airtel' | 'card' | 'credit' | 'mixed' | 'unknown'
function normMethod(raw = '') {
  const m = raw.toLowerCase().trim();
  if (m === 'cash')                              return 'cash';
  if (m === 'mtn'  || m === 'momo-mtn')         return 'mtn';
  if (m === 'airtel' || m === 'momo-airtel')    return 'airtel';
  if (m === 'momo')                              return 'mtn'; // treat bare momo as MTN
  if (m === 'card' || m === 'visa' || m === 'pos' || m === 'debit') return 'card';
  if (m === 'credit')                            return 'credit';
  if (m === 'mixed')                             return 'mixed';
  return 'unknown';
}

export const DataProvider = ({ children }) => {
  const [staffList,      setStaffList]      = useState([]);
  const [orders,         setOrders]         = useState([]);
  const [menus,          setMenus]          = useState([]);
  const [events,         setEvents]         = useState([]);
  const [isLoading,      setIsLoading]      = useState(true);

  // ── Summaries (single source of truth for all roles) ─────────────────────
  const [todaySummary,   setTodaySummary]   = useState({
    summary_date: null,
    total_gross:  0,
    total_cash:   0,
    total_card:   0,
    total_mtn:    0,
    total_airtel: 0,
    total_credit: 0,
    total_mixed:  0,
    order_count:  0,
  });
  const [monthlySummary, setMonthlySummary] = useState({ totals: {}, daily: [] });

  // ── Petty cash (cashier only) ─────────────────────────────────────────────
  const [pettyCash, setPettyCash] = useState({ total_in: 0, total_out: 0, net: 0, entries: [] });

  // ── Management targets ────────────────────────────────────────────────────
  const [dailyGoal,      setDailyGoal]      = useState(20);
  const [monthlyTargets, setMonthlyTargets] = useState({});

  const [isGranted,   setIsGranted]   = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('kurax_user');
    return saved ? JSON.parse(saved) : null;
  });

  // ── fetchTodaySummary ─────────────────────────────────────────────────────
  const fetchTodaySummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/summaries/today`);
      if (res.ok) setTodaySummary(await res.json());
    } catch (err) {
      console.error("Failed to fetch today's summary:", err);
    }
  }, []);

  // ── fetchMonthlySummary ───────────────────────────────────────────────────
  const fetchMonthlySummary = useCallback(async (month) => {
    const m = month || new Date().toISOString().substring(0, 7);
    try {
      const res = await fetch(`${API_URL}/api/summaries/monthly?month=${m}`);
      if (res.ok) setMonthlySummary(await res.json());
    } catch (err) {
      console.error("Failed to fetch monthly summary:", err);
    }
  }, []);

  // ── fetchPettyCash ────────────────────────────────────────────────────────
  // BUG FIX: was using new Date().toISOString() (UTC) → gave yesterday's date
  // in Kampala before 3 am, so cashier saw an empty petty-cash list at shift start.
  const fetchPettyCash = useCallback(async (date) => {
    const d = date || kampalaDateStr();  // ← Kampala-aware, not UTC
    try {
      const res = await fetch(`${API_URL}/api/summaries/petty-cash?date=${d}`);
      if (res.ok) setPettyCash(await res.json());
    } catch (err) {
      console.error("Failed to fetch petty cash:", err);
    }
  }, []);

  // ── fetchTargets ──────────────────────────────────────────────────────────
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

  // ── refreshData ───────────────────────────────────────────────────────────
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

  useEffect(() => {
    refreshData(true);
    const interval = setInterval(() => {
      refreshData(false);
      fetchTodaySummary();
    }, 10000);
    return () => clearInterval(interval);
  }, [refreshData, fetchTodaySummary]);

  // ── getStaffStats ─────────────────────────────────────────────────────────
  // Used by Director staff-grid cards to show per-staff revenue breakdown.
  //
  // BUG FIX 1: date comparison now uses Kampala timezone — was using UTC
  //   which caused orders placed before 3 am to be dated yesterday.
  //
  // BUG FIX 2: payment method normalised via normMethod() — was using raw
  //   .toUpperCase() and then falling through to CASH for anything unrecognised
  //   (e.g. bare "MOMO", empty string on unpaid orders that slipped through).
  //
  // BUG FIX 3: only paid orders contribute to revenue buckets. The paid guard
  //   already existed but the MIXED/CREDIT early-return was inside the loop
  //   after the paid check — reorganised to be explicit.
  const getStaffStats = useCallback((staffId, targetDate) => {
    const date = targetDate || kampalaDateStr();

    const staffOrders = orders.filter(o => {
      // BUG FIX 1: Kampala-aware date comparison
      const oDate = kampalaDateStr(new Date(o.timestamp || o.created_at));
      return Number(o.staff_id) === Number(staffId) && oDate === date;
    });

    return staffOrders.reduce((acc, o) => {
      acc.totalOrders += 1;

      const paid = o.status === 'Paid'   || o.status === 'Mixed'
                || o.status === 'Credit' || o.is_paid || o.isPaid;
      if (!paid) return acc;

      const amt  = Number(o.total || 0);
      const norm = normMethod(o.payment_method);

      // Mixed and Credit don't add to individual payment buckets
      // (mixed is split across methods; credit is not yet collected)
      if (norm === 'mixed' || norm === 'credit') {
        acc.totalRevenue += norm === 'mixed' ? amt : 0; // mixed is real money, credit isn't
        return acc;
      }

      acc.totalRevenue += amt;

      // BUG FIX 2 & 3: explicit bucket assignment, nothing leaks into CASH
      if      (norm === 'mtn')    acc.MTN    += amt;
      else if (norm === 'airtel') acc.AIRTEL += amt;
      else if (norm === 'card')   acc.CARD   += amt;
      else if (norm === 'cash')   acc.CASH   += amt;
      // 'unknown' — don't add to any bucket, already added to totalRevenue above

      return acc;
    }, { totalOrders: 0, totalRevenue: 0, CASH: 0, MTN: 0, AIRTEL: 0, CARD: 0 });
  }, [orders]);

  const value = {
    // Core data
    staffList,  setStaffList,
    orders,     setOrders,
    menus,      setMenus,
    events,     setEvents,
    currentUser, setCurrentUser,
    isGranted,
    isLoading,

    // Summaries — use these for ALL revenue/total displays across every role
    todaySummary,      // { total_gross, total_cash, total_card, total_mtn, total_airtel, total_credit, total_mixed, order_count }
    monthlySummary,    // { totals: {...}, daily: [...] }
    pettyCash,         // { total_in, total_out, net, entries } — cashier only
    fetchTodaySummary, // call immediately after any payment to force refresh
    fetchMonthlySummary,
    fetchPettyCash,

    // Per-staff breakdown (computed from orders — daily_summaries is restaurant-wide)
    getStaffStats,

    // Targets & refresh
    refreshData,
    dailyGoal,  setDailyGoal,
    monthlyTargets,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => useContext(DataContext);