import React, { createContext, useState, useContext, useEffect } from 'react';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  // 1. Initialize state by trying to load from LocalStorage
  const [menus, setMenus] = useState(() => {
    const savedMenus = localStorage.getItem('kurax_menus');
    return savedMenus ? JSON.parse(savedMenus) : [
      { id: 1, name: 'Spring Menu 2024', price: 25000, published: true }
    ];
  });

  const [events, setEvents] = useState(() => {
    const savedEvents = localStorage.getItem('kurax_events');
    return savedEvents ? JSON.parse(savedEvents) : [
      { id: 1, name: 'Live Jazz Night', date: '2026-02-14', published: true }
    ];
  });

  // 2. Save to LocalStorage whenever 'menus' changes
  useEffect(() => {
    localStorage.setItem('kurax_menus', JSON.stringify(menus));
  }, [menus]);

  // 3. Save to LocalStorage whenever 'events' changes
  useEffect(() => {
    localStorage.setItem('kurax_events', JSON.stringify(events));
  }, [events]);

  return (
    <DataContext.Provider value={{ menus, setMenus, events, setEvents }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);