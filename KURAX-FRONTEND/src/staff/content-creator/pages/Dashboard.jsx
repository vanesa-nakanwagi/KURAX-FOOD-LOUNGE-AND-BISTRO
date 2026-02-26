import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import StatsCard from "../components/StatsCard";
import { useData } from "../../../customer/components/context/DataContext";
import Footer from "../../../customer/components/common/Foooter";
import {
  BarChart3, Utensils, Search, Heart, Eye, 
  Calendar, Clock, X, MapPin, Edit3, ArrowRight, Power
} from "lucide-react";

export default function Dashboard() {
  const { menus, events, orders } = useData(); // Removed currentUser from context if it's not syncing
  const navigate = useNavigate();
  
  // --- FIX: FETCH LOGGED IN USER FROM LOCAL STORAGE ---
  const loggedInUser = useMemo(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  }, []);

  const userName = loggedInUser?.name || "Administrator";

  // States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [dailyVisits, setDailyVisits] = useState(0);

  // --- LOGOUT HANDLER ---
  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/staff/login');
  };

  /**
   * 1. FETCH LIVE STATS
   */
  useEffect(() => {
    const fetchLiveStats = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/visits/today");
        setDailyVisits(response.data.totalVisits || 0);
      } catch (err) {
        console.error("Dashboard Stats Error:", err);
      }
    };

    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 60000); 
    return () => clearInterval(interval);
  }, []);

  /**
   * 2. ACTIVITY LOGIC
   */
  const allActivity = [...(menus || []), ...(events || [])].sort((a, b) => {
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);
    return dateB - dateA;
  });

  const filteredActivity = allActivity.filter(item => 
    item.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /**
   * 3. DYNAMIC STATS CONFIGURATION
   */
  const stats = [
    { 
      title: "Total Menus", 
      value: (menus || []).length, 
      trend: "up", 
      icon: "Utensils" 
    },
    { 
      title: "Total Events", 
      value: (events || []).length, 
      trend: "up", 
      icon: "Calendar" 
    },
    { 
      title: "Daily Views", 
      value: dailyVisits.toLocaleString(), 
      trend: "up", 
      icon: "Eye" 
    },
    { 
      title: "Total Bookings", 
      value: (orders || []).length, 
      trend: "up", 
      icon: "Heart" 
    }
  ];

  const handleEditRedirect = (item) => {
    const path = item.price ? "/content-creator/menus" : "/content-creator/events";
    navigate(path, { state: { editItem: item } });
  };

  return (
    <div className="flex h-screen bg-black-950 text-slate-100 font-[Outfit] overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-y-auto">
        <main className="p-4 md:p-8 pt-20 lg:pt-8 max-w-5xl mx-auto w-full"> 
          
          {/* Header Section */}
          <div className="mb-10 flex justify-between items-end">
            <div>
              <div className="flex items-center gap-3 mb-2">
                  <div className="w-1 h-6 bg-yellow-500 rounded-full" />
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-yellow-500/80">Management Overview</h4>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Welcome back, <span className="text-yellow-400 capitalize">{userName}</span>
              </h2>
            </div>

            {/* Added a quick logout for the creator side too */}
            <button 
              onClick={handleLogout}
              className="p-3 bg-zinc-900 border border-slate-800 rounded-2xl text-slate-500 hover:text-rose-500 hover:border-rose-500/30 transition-all"
              title="Logout"
            >
              <Power size={20} />
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
            {stats.map((stat, index) => <StatsCard key={index} {...stat} />)}
          </div>

          {/* Activity Header & Search */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <BarChart3 className="w-5 h-5 text-yellow-500" />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-white tracking-tight">
                Recent Activity
              </h3>
            </div>

            <div className="relative group w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-yellow-500 transition-colors" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-zinc-900/50 border border-slate-800 rounded-2xl pl-12 pr-4 py-3 outline-none text-sm text-slate-200 focus:border-yellow-500/40 w-full transition-all backdrop-blur-md"
              />
            </div>
          </div>

          {/* Activity List */}
          <div className="space-y-4 mb-12">
            {filteredActivity.length > 0 ? (
              filteredActivity.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedItem(item)}
                  className="group relative flex items-center gap-4 p-4 bg-zinc-900/40 border border-slate-800/60 rounded-[2rem] hover:bg-zinc-800/60 hover:border-yellow-500/30 transition-all duration-300 cursor-pointer overflow-hidden"
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
                    item.price 
                        ? 'bg-blue-500/5 border-blue-500/20 text-blue-400 group-hover:border-blue-500/40' 
                        : 'bg-yellow-500/5 border-yellow-500/20 text-yellow-500 group-hover:border-yellow-500/40'
                  }`}>
                    {item.price ? <Utensils className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-white group-hover:text-yellow-400 transition-colors truncate">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <span className={item.price ? 'text-blue-400/80' : 'text-yellow-500/80'}>
                        {item.price ? 'Menu Item' : 'Lounge Event'}
                      </span>
                      <span className="w-1 h-1 bg-slate-700 rounded-full" />
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.created_at || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  <div className="text-right hidden sm:block pr-2">
                    {item.price ? (
                      <p className="text-sm font-black text-white tracking-tight">
                        {Number(item.price).toLocaleString()} <span className="text-[10px] text-slate-500">UGX</span>
                      </p>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                        <MapPin className="w-3 h-3 text-yellow-500" />
                        <span className="truncate max-w-[100px]">{item.location || 'Main Lounge'}</span>
                      </div>
                    )}
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center border border-slate-800 group-hover:border-yellow-500/50 transition-all">
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-yellow-500 transition-all" />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center rounded-[2rem] border border-dashed border-slate-800 bg-zinc-900/20">
                <Search className="w-10 h-10 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-500 font-medium tracking-tight">No activity found.</p>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>

      {/* DETAIL MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-slate-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="h-56 bg-zinc-800 relative">
              <img 
                src={`http://localhost:5000${selectedItem.image_url}`} 
                className="w-full h-full object-cover" 
                alt={selectedItem.name} 
                crossOrigin="anonymous"
              />
              <button 
                onClick={() => setSelectedItem(null)} 
                className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8">
              <h2 className="text-2xl font-bold text-white mb-2">{selectedItem.name}</h2>
              <p className="text-slate-400 text-sm mb-6 italic">
                {selectedItem.description || 'No description available.'}
              </p>

              <div className="flex gap-4 mb-8 p-5 bg-zinc-800/40 rounded-3xl border border-slate-800/50">
                {selectedItem.price ? (
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Price</span>
                    <span className="text-lg font-black text-white">{Number(selectedItem.price).toLocaleString()} UGX</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Time</span>
                        <div className="text-sm font-bold text-white">{selectedItem.time || 'TBD'}</div>
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Location</span>
                        <div className="text-sm font-bold text-white">{selectedItem.location || 'Lounge'}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setSelectedItem(null)} className="flex-1 py-4 bg-zinc-800/50 text-white text-xs font-black rounded-2xl border border-slate-800">Close</button>
                <button 
                   onClick={() => handleEditRedirect(selectedItem)}
                   className="flex-1 py-4 bg-yellow-500 text-black text-xs font-black uppercase rounded-2xl hover:bg-yellow-600 transition-all flex items-center justify-center gap-2"
                >
                  <Edit3 size={16} /> Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}