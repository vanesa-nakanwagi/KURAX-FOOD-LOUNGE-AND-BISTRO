import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import StatsCard from "../components/StatsCard";
import { useData } from "../../../components/context/DataContext";
import {
  BarChart3, Upload, Clock, Utensils, Search, Heart, Eye, 
  Calendar, X, DollarSign, MapPin, ImageIcon, Plus
} from "lucide-react";

/* ---------------- Quick Actions Component ---------------- */
function QuickActions({ activeAction, onActionClick }) {
  return (
    <div className="rounded-2xl bg-zinc-900 border border-slate-800 p-4 md:p-6 h-fit shadow-xl">
      <div className="flex items-center gap-2 mb-4 md:mb-6">
        <span className="w-4 h-4 md:w-5 md:h-5 rounded-full border-2 border-yellow-400 flex items-center justify-center">
          <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-yellow-400"></span>
        </span>
        <h3 className="text-base md:text-lg font-bold text-white">Quick Actions</h3>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 md:gap-4">
        <button 
          onClick={() => onActionClick('menu')}
          className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl transition-all duration-300 text-sm md:text-base ${
            activeAction === 'menu' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'border border-slate-700 text-white hover:border-yellow-500 bg-zinc-800/50'
          }`}
        >
          <Upload className="w-4 h-4" /> Add Menu
        </button>

        <button 
          onClick={() => onActionClick('event')}
          className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl transition-all duration-300 text-sm md:text-base ${
            activeAction === 'event' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'border border-slate-700 text-white hover:border-yellow-500 bg-zinc-800/50'
          }`}
        >
          <Clock className="w-4 h-4" /> Create Event
        </button>
      </div>
    </div>
  );
}

/* ---------------- Dashboard Main ---------------- */
export default function Dashboard() {
  const { menus, setMenus, events, setEvents } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeAction, setActiveAction] = useState(null);

  const [formData, setFormData] = useState({
    name: '', description: '', price: '', location: '', date: '', time: '', published: true, image_file: null
  });

  const handleActionClick = (type) => {
    setFormData({ name: '', description: '', price: '', location: '', date: '', time: '', published: true, image_file: null });
    setActiveAction(type);
  };

  const handleInputChange = (e) => {
    const { name, value, type, files } = e.target;
    if (type === 'file') {
      setFormData(prev => ({ ...prev, image_file: files[0] || null }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...formData, id: Date.now() };
    if (activeAction === 'menu') {
      setMenus(prev => [...prev, { ...payload, price: Number(payload.price) }]);
    } else {
      setEvents(prev => [...prev, payload]);
    }
    setActiveAction(null);
  };

  const allActivity = [...menus, ...events]
    .sort((a, b) => b.id - a.id)
    .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const stats = [
    { title: "Total Menus", value: menus.length, change: "+2", trend: "up", icon: "Utensils", description: "Total" },
    { title: "Total Events", value: events.length, change: "+1", trend: "up", icon: "Calendar", description: "Upcoming" },
    { title: "Toal Views", value: "3.2k", change: "+18%", trend: "up", icon: "Eye", description: "30 days" },
    { title: "Total Bookings", value: 127, change: "+22%", trend: "up", icon: "Heart", description: "Total" }
  ];

  return (
    <div className="relative flex flex-col md:flex-row min-h-screen bg-black-950 text-slate-100 font-[Outfit]">
      <Sidebar />

      <div className="flex-1 flex flex-col w-full">
        <main className="p-4 md:p-8 pt-20 md:pt-8"> {/* pt-20 for mobile header clearance */}
          
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-white">
              Welcome back, <span className="text-yellow-400">Essah</span>
            </h2>
            <div className="mt-4 p-3 md:p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
              <p className="text-xs md:text-sm text-slate-400 flex items-center gap-2">
                <Utensils className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" />
                Your uploads increased bookings by 22% this month.
              </p>
            </div>
          </div>

          {/* Search - Full width on mobile */}
          <div className="mb-6">
            <div className="flex items-center gap-2 bg-zinc-900 border border-slate-800 rounded-xl px-4 py-3 focus-within:border-yellow-500/50 transition-colors w-full md:w-fit md:ml-auto">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search activity..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent outline-none text-sm text-slate-200 placeholder-slate-500 w-full md:w-64"
              />
            </div>
          </div>

          {/* Stats - 2 cols on mobile, 4 on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-8">
            {stats.map((stat, index) => (
              <StatsCard key={index} {...stat} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 order-2 lg:order-1 rounded-2xl bg-zinc-900 border border-slate-800 p-4 md:p-6">
              <h3 className="text-base md:text-lg font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-yellow-400" />
                Recent Activity
              </h3>

              <div className="space-y-2 md:space-y-3">
                {allActivity.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 md:p-4 bg-zinc-800/30 rounded-xl border border-slate-800/50">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="p-1.5 md:p-2 bg-zinc-900 rounded-lg">
                         {item.price ? <Utensils className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" /> : <Calendar className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" />}
                      </div>
                      <div className="max-w-[120px] md:max-w-none">
                        <p className="text-xs md:text-sm font-semibold text-white truncate">{item.name}</p>
                        <p className="text-[9px] md:text-[10px] text-slate-500 uppercase font-bold">{item.price ? 'Menu' : 'Event'}</p>
                      </div>
                    </div>
                    <span className="hidden sm:block text-yellow-400 text-[10px] font-bold px-2 py-1 bg-yellow-400/10 rounded-full italic">Latest</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <QuickActions activeAction={activeAction} onActionClick={handleActionClick} />
            </div>
          </div>
        </main>
      </div>

      {/* MODAL - Mobile Optimized */}
      {activeAction && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/90 backdrop-blur-md p-0 md:p-4">
          <div className="bg-zinc-900 border-t md:border border-slate-800 w-full max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            
            <div className="flex justify-between items-center p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {activeAction === 'menu' ? 'New Menu Item' : 'New Event'}
              </h3>
              <button onClick={() => setActiveAction(null)} className="p-2 bg-zinc-800 rounded-full text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Media Cover</label>
                <div className="relative group flex items-center justify-center w-full h-28 md:h-36 border-2 border-dashed border-slate-700 rounded-2xl bg-zinc-800/30 overflow-hidden">
                  {formData.image_file ? (
                    <img src={URL.createObjectURL(formData.image_file)} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-slate-500 text-xs">
                      <Plus className="w-5 h-5 mb-1" />
                      <span>Upload Image</span>
                    </div>
                  )}
                  <input type="file" name="image_file" accept="image/*" onChange={handleInputChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
              </div>

              <input required name="name" value={formData.name} onChange={handleInputChange} className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-sm" placeholder="Title..." />

              {activeAction === 'menu' ? (
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3.5 w-4 h-4 text-yellow-500/50" />
                  <input required name="price" type="number" value={formData.price} onChange={handleInputChange} className="w-full bg-zinc-800 border border-slate-700 p-3 pl-10 rounded-xl focus:border-yellow-500 outline-none text-sm" placeholder="Price (UGX)" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <input required type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-sm text-white" />
                  <input required name="location" value={formData.location} onChange={handleInputChange} className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-sm" placeholder="Venue..." />
                </div>
              )}

              <textarea name="description" value={formData.description} onChange={handleInputChange} rows="2" className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-sm" placeholder="Description..." />

              <div className="pt-2 flex gap-3">
                <button type="submit" className="flex-1 py-4 bg-yellow-500 text-black rounded-xl font-bold text-sm shadow-lg shadow-yellow-500/20 active:scale-95 transition-transform">
                  Confirm & Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}