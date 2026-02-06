import React, { createContext, useState, useContext, useEffect } from 'react';
import burger from "../../assets/images/hero4.jpg";

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  // --- MENUS STATE ---
  const [menus, setMenus] = useState(() => {
    const savedMenus = localStorage.getItem('kurax_menus');
    return savedMenus ? JSON.parse(savedMenus) : [
      { id: 1, name: 'Spring Menu 2024', price: 25000, image: burger, published: true }
    ];
  });

  // --- EVENTS STATE ---
  const [events, setEvents] = useState(() => {
    const savedEvents = localStorage.getItem('kurax_events');
    return savedEvents ? JSON.parse(savedEvents) : [
      { id: 1, name: 'Live Jazz Night', date: '2026-02-14', published: true }
    ];
  });

  // --- ORDERS STATE (The Kitchen Sync) ---
  const [orders, setOrders] = useState(() => {
    const savedOrders = localStorage.getItem('kurax_orders');
    return savedOrders ? JSON.parse(savedOrders) : [];
  });

  // 1. Save Menus/Events to LocalStorage
  useEffect(() => {
    localStorage.setItem('kurax_menus', JSON.stringify(menus));
  }, [menus]);

  useEffect(() => {
    localStorage.setItem('kurax_events', JSON.stringify(events));
  }, [events]);

  // 2. Save Orders to LocalStorage
  useEffect(() => {
    localStorage.setItem('kurax_orders', JSON.stringify(orders));
  }, [orders]);

  // 3. THE MAGIC LINK: Listen for changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'kurax_orders' && e.newValue) {
        setOrders(JSON.parse(e.newValue));
      }
      // Optional: sync menus/events across tabs too
      if (e.key === 'kurax_menus' && e.newValue) setMenus(JSON.parse(e.newValue));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <DataContext.Provider value={{ 
      menus, setMenus, 
      events, setEvents, 
      orders, setOrders // Make sure these are exported!
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);