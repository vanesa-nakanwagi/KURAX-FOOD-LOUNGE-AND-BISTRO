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
    <div className="rounded-2xl bg-zinc-900 border border-slate-800 p-6 h-fit shadow-xl">
      <div className="flex items-center gap-2 mb-6">
        <span className="w-5 h-5 rounded-full border-2 border-yellow-400 flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
        </span>
        <h3 className="text-lg font-bold text-white">Quick Actions</h3>
      </div>

      <div className="space-y-4">
        <button 
          onClick={() => onActionClick('menu')}
          className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl transition-all duration-300 ${
            activeAction === 'menu' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'border border-slate-700 text-white hover:border-yellow-500 hover:bg-yellow-500/5'
          }`}
        >
          <Upload className="w-4 h-4" /> Add Menu
        </button>

        <button 
          onClick={() => onActionClick('event')}
          className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl transition-all duration-300 ${
            activeAction === 'event' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'border border-slate-700 text-white hover:border-yellow-500 hover:bg-yellow-500/5'
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

  // Form State for Modal
  const [formData, setFormData] = useState({
    name: '', description: '', price: '', location: '', date: '', time: '', published: true, image_file: null
  });

  const handleActionClick = (type) => {
    // Reset form when opening
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
    const payload = { 
      ...formData, 
      id: Date.now(),
      createdAt: new Date().toISOString() // Added for sorting
    };

    if (activeAction === 'menu') {
      setMenus(prev => [...prev, { ...payload, price: Number(payload.price) }]);
    } else {
      setEvents(prev => [...prev, payload]);
    }
    setActiveAction(null); // Close modal
  };

  // Logic for Recent Activity: Combine, Sort by ID (latest first), and Filter
  const allActivity = [...menus, ...events]
    .sort((a, b) => b.id - a.id) // Sort by ID as proxy for time
    .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const stats = [
    { title: "Menus Uploaded", value: menus.length, change: "+2", trend: "up", icon: "Utensils", description: "This month" },
    { title: "Scheduled Events", value: events.length, change: "+1", trend: "up", icon: "Calendar", description: "Upcoming" },
    { title: "Menu Views", value: "3,240", change: "+18%", trend: "up", icon: "Eye", description: "Last 30 days" },
    { title: "Bookings", value: 127, change: "+22%", trend: "up", icon: "Heart", description: "From your uploads" }
  ];

  return (
    <div className="relative flex h-screen bg-black-950 text-slate-100 font-[Outfit] overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-auto">
        <main className="p-8">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-white">
              Welcome back, <span className="text-yellow-400">Essah</span>
            </h2>
          </div>

          <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/20">
            <p className="text-sm text-slate-400 flex items-center gap-2">
              <Utensils className="w-4 h-4 text-yellow-500" />
              Manage menus and events. Your uploads increased bookings by 22% this month.
            </p>
          </div>

          <div className="flex items-center justify-end mb-6">
            <div className="flex items-center gap-2 bg-zinc-900 border border-slate-800 rounded-full px-4 py-2 focus-within:border-yellow-500/50 transition-colors">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search activity..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent outline-none text-sm text-slate-200 placeholder-slate-500 w-64"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => (
              <StatsCard key={index} {...stat} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Activity Section */}
            <div className="lg:col-span-2 rounded-2xl bg-zinc-900 border border-slate-800 p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-yellow-400" />
                Recent Activity
              </h3>

              <div className="space-y-3">
                {allActivity.length > 0 ? (
                  allActivity.slice(0, 5).map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-4 bg-zinc-800/30 hover:bg-zinc-800/60 rounded-xl border border-slate-800/50 transition shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-900 rounded-lg">
                           {item.price ? <Utensils className="w-4 h-4 text-yellow-500" /> : <Calendar className="w-4 h-4 text-yellow-500" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{item.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                            {item.price ? 'Menu Item' : 'Event'} • {item.published ? 'Live' : 'Draft'}
                          </p>
                        </div>
                      </div>
                      <span className="text-yellow-400 text-xs font-bold px-3 py-1 bg-yellow-400/10 rounded-full">
                        Latest
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm py-8 text-center border-2 border-dashed border-slate-800 rounded-xl">No recent activity found</p>
                )}
              </div>
            </div>

            <QuickActions activeAction={activeAction} onActionClick={handleActionClick} />
          </div>
        </main>
      </div>

      {/* MODAL OVERLAY */}
      {activeAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-zinc-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden scale-in-center">
            <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-zinc-900/50">
              <h3 className="text-xl font-bold text-white">
                {activeAction === 'menu' ? 'New Menu Item' : 'New Event'}
              </h3>
              <button onClick={() => setActiveAction(null)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Image Upload Area */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Media Cover</label>
                <div className="relative group flex items-center justify-center w-full h-36 border-2 border-dashed border-slate-700 rounded-2xl hover:border-yellow-500/50 transition-all bg-zinc-800/30 overflow-hidden">
                  {formData.image_file ? (
                    <>
                      <img src={URL.createObjectURL(formData.image_file)} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-xs font-bold">Click to Change</p>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-slate-500">
                      <Plus className="w-6 h-6 mb-1" />
                      <span className="text-xs font-semibold">Upload Image</span>
                    </div>
                  )}
                  <input type="file" name="image_file" accept="image/*" onChange={handleInputChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Title</label>
                <input required name="name" value={formData.name} onChange={handleInputChange} className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-white transition-all" placeholder="Enter name..." />
              </div>

              {activeAction === 'menu' ? (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Price (UGX)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3.5 w-4 h-4 text-yellow-500/50" />
                    <input required name="price" type="number" value={formData.price} onChange={handleInputChange} className="w-full bg-zinc-800 border border-slate-700 p-3 pl-10 rounded-xl focus:border-yellow-500 outline-none" placeholder="0" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date</label>
                    <input required type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Venue</label>
                    <input required name="location" value={formData.location} onChange={handleInputChange} className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none" placeholder="Lounge location..." />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} rows="3" className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none" placeholder="Quick description..." />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setActiveAction(null)} className="flex-1 py-3 border border-slate-700 rounded-xl font-bold text-slate-400 hover:text-white transition">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-yellow-500 text-black rounded-xl font-bold hover:bg-yellow-600 transition shadow-lg shadow-yellow-500/20">Confirm & Post</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}