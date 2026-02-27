import React, { useState } from 'react'
import Sidebar from '../../content-creator/components/Sidebar'
import { useData } from "../../../customer/components/context/DataContext";
import { Plus, Utensils, Edit2, Trash2, X, CheckCircle2, AlertCircle, ImageIcon, Coffee, Wine } from 'lucide-react'
import Footer from "../../../customer/components/common/Foooter";
import { getImageSrc } from "../../../utils/imageHelper";
import API_URL from "../../../config/api";

const formatUGX = (amount) =>
  `UGX ${Number(amount || 0).toLocaleString('en-UG')}`

const CATEGORIES = ["Starters", "Local Foods", "Drinks & Cocktails"];

// NEW: Station routing options
const STATIONS = [
  { id: 'Kitchen', label: 'Kitchen', icon: <Utensils className="w-3 h-3" /> },
  { id: 'Barista', label: 'Barista', icon: <Coffee className="w-3 h-3" /> },
  { id: 'Barman', label: 'Bar', icon: <Wine className="w-3 h-3" /> }
];

export default function Menus() {
  const { menus, setMenus } = useData()
  const [formVisible, setFormVisible] = useState(false)
  const [editingMenu, setEditingMenu] = useState(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Starters', 
    station: 'Kitchen', // Default station
    image_file: null,
    published: false
  })

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target
    if (type === 'file') {
      setFormData(prev => ({ ...prev, image_file: files[0] || null }))
    } else if (name === 'price') {
      const cleanValue = value.replace(/\D/g, '')
      setFormData(prev => ({ ...prev, [name]: cleanValue }))
    } else {
      setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    }
  }

  const resetForm = () => {
    setFormVisible(false);
    setEditingMenu(null);
    setFormData({ 
      name: '', 
      description: '', 
      price: '', 
      category: 'Starters', 
      station: 'Kitchen', 
      image_file: null, 
      published: false 
    });
  };

 const handleSubmit = async (e) => {
  e.preventDefault();

  // 1. Create FormData (Crucial for file uploads)
  const data = new FormData();
  data.append('name', formData.name);
  data.append('description', formData.description);
  data.append('price', Number(formData.price));
  data.append('category', formData.category);
  data.append('station', formData.station);
  data.append('published', formData.published);

  // 2. Only append a file if the manager actually picked a new one
  if (formData.image_file) {
    data.append('image', formData.image_file);
  }

  try {
    const url = editingMenu 
  ? `${API_URL}/api/menus/${editingMenu.id}` 
  : `${API_URL}/api/menus`;

    const response = await fetch(url, {
      method: editingMenu ? 'PUT' : 'POST',
      // Do NOT set Content-Type header when sending FormData
      body: data 
    });

    if (response.ok) {
      const updatedItem = await response.json();
      
      // Update the global list so waiters see it immediately
      if (editingMenu) {
        setMenus(prev => prev.map(m => (m.id === editingMenu.id ? updatedItem : m)));
      } else {
        setMenus(prev => [...prev, updatedItem]);
      }
      resetForm();
    }
  } catch (err) {
    console.error("Database sync failed:", err);
  }
};

  const handleEdit = (menu) => {
  setEditingMenu(menu); // This tells the app we are in "Update Mode"
  setFormData({
    name: menu.name,
    description: menu.description,
    price: menu.price,
    category: menu.category,
    station: menu.station,
    published: menu.published,
    image_file: null, // Keep null until a NEW file is picked
    current_image_url: menu.image_url // Store the old URL so we don't lose it
  });
  setFormVisible(true);
  document.getElementById('content-area')?.scrollTo({ top: 0, behavior: 'smooth' });
};

  const handleDelete = async (id) => {
  if (!window.confirm('Are you sure? This will remove the item for all waiters.')) return;

  try {
    const response = await fetch(`${API_URL}/api/menus/${id}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      // This removes it from the Content Manager's screen immediately
      setMenus(prev => prev.filter(menu => menu.id !== id));
    }
  } catch (err) {
    console.error("Delete failed:", err);
  }
};

  return (
    <div className="flex h-screen font-[Outfit] bg-black-950 text-slate-100 overflow-hidden">
      <Sidebar />

      <div id="content-area" className="flex-1 flex flex-col overflow-y-auto">
        <main className="p-4 md:p-8 pt-20 lg:pt-8">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Menus</h1>
              <p className="text-slate-400 text-xs md:text-sm mt-1">Design and route your menu items to the correct stations.</p>
            </div>
            
            {!formVisible && (
              <button
                onClick={() => setFormVisible(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-yellow-500 text-black font-bold rounded-xl hover:bg-yellow-600 transition shadow-lg shadow-yellow-500/10 active:scale-95"
              >
                <Plus className="w-5 h-5" />
                Add Menu
              </button>
            )}
          </div>

          {formVisible && (
            <div className="mb-10 bg-zinc-900 border border-slate-800 p-5 md:p-8 rounded-2xl shadow-xl animate-in fade-in zoom-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg md:text-xl font-bold text-white">
                  {editingMenu ? 'Edit Menu' : 'Create New Menu'}
                </h2>
                <button onClick={resetForm} className="p-2 text-slate-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Menu Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-sm text-white"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Category</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      required
                      className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-sm text-white appearance-none cursor-pointer"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat} className="bg-zinc-900">{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* NEW: Station Selection logic */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Order Routing (Station Tag)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {STATIONS.map(station => (
                        <button
                          key={station.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, station: station.id }))}
                          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                            formData.station === station.id 
                              ? 'bg-yellow-500 text-black border-yellow-500' 
                              : 'bg-zinc-800 text-slate-400 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {station.icon} {station.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Price (UGX)</label>
                    <input
                      type="text"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      required
                      className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-sm text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</label>
                  <textarea
                    name="description"
                    rows="2"
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-sm text-white"
                  />
                </div>

                <div className="flex flex-col space-y-6 pt-2">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1 sm:flex-none">
                      <input type="file" accept="image/*" onChange={handleChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                      <div className="bg-zinc-800 border border-slate-700 px-4 py-3 rounded-xl text-xs font-bold text-slate-300 flex items-center justify-center gap-2 group-hover:bg-zinc-700 transition">
                        <ImageIcon className="w-4 h-4 text-yellow-500" />
                        {formData.image_file ? 'Change Image' : 'Upload Image'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-t border-slate-800 pt-6">
                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <input type="checkbox" name="published" checked={formData.published} onChange={handleChange} className="w-5 h-5 accent-yellow-500 bg-zinc-800 border-slate-700 rounded" />
                      <span className="text-slate-300 text-sm font-medium">Publish Menu</span>
                    </label>
                    <div className="flex gap-3">
                      <button type="button" onClick={resetForm} className="px-6 py-3 text-slate-400 font-bold text-sm">Cancel</button>
                      <button type="submit" className="bg-yellow-500 px-8 py-3 rounded-xl text-black font-bold text-sm shadow-lg shadow-yellow-500/10">
                        {editingMenu ? 'Update' : 'Add Menu'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 pb-10">
            {(menus || []).map(item => (
              <div key={item.id} className="group bg-zinc-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-yellow-500/30 transition-all duration-300 flex flex-col shadow-sm">
                <div className="h-44 md:h-48 bg-zinc-800 flex items-center justify-center relative flex-shrink-0">
                  {item.image_url ? (
  <img 
     src={getImageSrc(item.image_url)}
    alt={item.name} 
    className="w-full h-full object-cover" 
    onError={(e) => { e.target.src = "https://via.placeholder.com/150?text=No+Image"; }}
  />
) : (
  <div className="flex flex-col items-center gap-2 text-slate-600">
    <Utensils className="w-10 h-10" />
    <span className="text-[10px] uppercase font-bold tracking-widest">No Cover</span>
  </div>
)}
                  
                  {/* NEW: TOP LEFT STATION TAG */}
                  <div className="absolute top-3 left-3">
                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border backdrop-blur-md ${
                      item.station === 'Barista' ? 'bg-amber-900/40 text-amber-400 border-amber-500/30' : 
                      item.station === 'Barman' ? 'bg-blue-900/40 text-blue-400 border-blue-500/30' : 
                      'bg-emerald-900/40 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {item.station === 'Barista' && <Coffee className="w-3 h-3" />}
                      {item.station === 'Barman' && <Wine className="w-3 h-3" />}
                      {item.station === 'Kitchen' && <Utensils className="w-3 h-3" />}
                      {item.station}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-tighter backdrop-blur-md border ${
    item.published 
      ? "bg-green-500/20 text-green-400 border-green-500/30" 
      : "bg-zinc-800/80 text-slate-500 border-slate-700"
  }`}>
    {item.published ? "Live" : "Draft"}
  </span>
                  </div>
                </div>

                <div className="p-5 md:p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h2 className="text-lg font-bold text-white truncate">{item.name}</h2>
                    <span className="text-yellow-500 font-bold text-sm whitespace-nowrap">{formatUGX(item.price)}</span>
                  </div>
                  <p className="text-slate-400 text-xs md:text-sm line-clamp-2 mb-6 h-9 md:h-10">{item.description}</p>

                  <div className="flex gap-2.5 pt-4 border-t border-slate-800 mt-auto">
                    <button onClick={() => handleEdit(item)} className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-xl transition text-[13px] font-bold text-slate-200">
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="px-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}