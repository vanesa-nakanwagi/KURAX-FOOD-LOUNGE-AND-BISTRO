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
  const { menus, events, orders } = useData();
  const navigate = useNavigate();
  
  // Get logged in user from localStorage
  const loggedInUser = useMemo(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing user data:", e);
        return null;
      }
    }
    return null;
  }, []);

  // Also check for kurax_user (in case that's where the data is stored)
  const kuraxUser = useMemo(() => {
    const saved = localStorage.getItem('kurax_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing kurax_user data:", e);
        return null;
      }
    }
    return null;
  }, []);

  // Get the user name from whichever storage has it
  const userName = useMemo(() => {
    const user = loggedInUser || kuraxUser;
    if (user?.name) {
      return user.name;
    }
    if (user?.fullName) {
      return user.fullName;
    }
    if (user?.username) {
      return user.username;
    }
    return "Administrator";
  }, [loggedInUser, kuraxUser]);

  // Get first name for welcome message
  const firstName = userName.split(" ")[0];

  // States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [dailyVisits, setDailyVisits] = useState(0);

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('kurax_user');
    navigate('/staff/login');
  };

  // Fetch live stats
  useEffect(() => {
    const fetchLiveStats = async () => {
      try {
        const response = await axios.get("http://localhost:5010/api/visits/today");
        setDailyVisits(response.data.totalVisits || 0);
      } catch (err) {
        console.error("Dashboard Stats Error:", err);
      }
    };

    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 60000); 
    return () => clearInterval(interval);
  }, []);

  // Activity logic
  const allActivity = [...(menus || []), ...(events || [])].sort((a, b) => {
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);
    return dateB - dateA;
  });

  const filteredActivity = allActivity.filter(item => 
    item.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Dynamic stats configuration
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
    <div className="flex h-screen bg-gray-50 text-gray-900 font-[Outfit] overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-y-auto">
        <main className="p-4 md:p-8 pt-20 lg:pt-8 max-w-5xl mx-auto w-full"> 
          
          {/* Header Section */}
          <div className="mb-10 flex justify-between items-end">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1 h-6 bg-yellow-500 rounded-full" />
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-yellow-600">
                  Management Overview
                </h4>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                Welcome back,{" "}
                <span className="text-yellow-600 capitalize">
                  {firstName}
                </span>
              </h2>
            </div>
            {/* Optional logout button (already in sidebar) but adding for symmetry */}
            <button 
              onClick={handleLogout}
              className="p-3 bg-white border border-gray-200 rounded-2xl text-gray-500 hover:text-red-600 hover:border-red-200 transition-all shadow-sm"
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
              <div className="p-2 bg-yellow-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-yellow-600" />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight">
                Recent Activity
              </h3>
            </div>

            <div className="relative group w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-yellow-500 transition-colors" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border border-gray-200 rounded-2xl pl-12 pr-4 py-3 outline-none text-sm text-gray-900 placeholder:text-gray-400 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 w-full transition-all shadow-sm"
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
                  className="group relative flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl hover:shadow-md hover:border-yellow-300 transition-all duration-300 cursor-pointer overflow-hidden"
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
                    item.price 
                      ? 'bg-blue-50 border-blue-200 text-blue-600 group-hover:border-blue-300' 
                      : 'bg-yellow-50 border-yellow-200 text-yellow-600 group-hover:border-yellow-300'
                  }`}>
                    {item.price ? <Utensils className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-gray-900 group-hover:text-yellow-600 transition-colors truncate">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-500">
                      <span className={item.price ? 'text-blue-600' : 'text-yellow-600'}>
                        {item.price ? 'Menu Item' : 'Lounge Event'}
                      </span>
                      <span className="w-1 h-1 bg-gray-300 rounded-full" />
                      <span className="flex items-center gap-1">
                        📅 {new Date(item.created_at || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  <div className="text-right hidden sm:block pr-2">
                    {item.price ? (
                      <p className="text-sm font-black text-gray-900 tracking-tight">
                        {Number(item.price).toLocaleString()} <span className="text-[10px] text-gray-400">UGX</span>
                      </p>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                        <MapPin className="w-3 h-3 text-yellow-600" />
                        <span className="truncate max-w-[100px]">{item.location || 'Main Lounge'}</span>
                      </div>
                    )}
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-200 group-hover:border-yellow-300 transition-all">
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-yellow-600 transition-all" />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                <Search className="w-10 h-10 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 font-medium tracking-tight">No activity found.</p>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>

      {/* DETAIL MODAL - Light Theme */}
      {selectedItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-white/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white border border-gray-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-56 bg-gray-100 relative">
              <img 
                src={`http://localhost:5010${selectedItem.image_url}`} 
                className="w-full h-full object-cover" 
                alt={selectedItem.name} 
                crossOrigin="anonymous"
              />
              <button 
                onClick={() => setSelectedItem(null)} 
                className="absolute top-4 right-4 p-2 bg-white/80 text-gray-700 rounded-full hover:bg-white transition-colors shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedItem.name}</h2>
              <p className="text-gray-500 text-sm mb-6 italic">
                {selectedItem.description || 'No description available.'}
              </p>

              <div className="flex gap-4 mb-8 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                {selectedItem.price ? (
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Price</span>
                    <span className="text-lg font-black text-gray-900">{Number(selectedItem.price).toLocaleString()} UGX</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div>
                      <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Time</span>
                      <div className="text-sm font-bold text-gray-900">{selectedItem.time || 'TBD'}</div>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Location</span>
                      <div className="text-sm font-bold text-gray-900">{selectedItem.location || 'Lounge'}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setSelectedItem(null)} className="flex-1 py-4 bg-gray-100 text-gray-700 text-xs font-black rounded-xl border border-gray-200 hover:bg-gray-200 transition-all">
                  Close
                </button>
                <button 
                  onClick={() => handleEditRedirect(selectedItem)}
                  className="flex-1 py-4 bg-yellow-500 text-black text-xs font-black uppercase rounded-xl hover:bg-yellow-600 transition-all flex items-center justify-center gap-2 shadow-sm"
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