import React, { useState } from 'react'
import Sidebar from '../../content-creator/components/Sidebar'
import { useData } from "../../../customer/components/context/DataContext";
import { Plus, Utensils, Edit2, Trash2, X, CheckCircle2, AlertCircle, ImageIcon, Coffee, Wine, Sparkles } from 'lucide-react'
import Footer from "../../../customer/components/common/Foooter";
import { getImageSrc } from "../../../utils/imageHelper";
import API_URL from "../../../config/api";
import { useTheme } from "../../../customer/components/context/ThemeContext";

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
  const { theme } = useTheme();

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
  {(menus || []).map((item) => {
    // Logic for "NEW" badge (less than 48 hours old)
    const isNew = item.created_at && (new Date() - new Date(item.created_at)) / (1000 * 60 * 60) <= 48;

    return (
      <div 
        key={item.id} 
        className={`group relative rounded-[2rem] overflow-hidden flex flex-col h-full transition-all duration-300 border shadow-sm hover:shadow-xl hover:-translate-y-1
          ${theme === 'dark' 
            ? 'bg-[#111111] border-zinc-800 hover:border-yellow-500/30' 
            : 'bg-zinc-900 border-slate-800 hover:border-yellow-500/30'}`}
      >
        {/* Image Section - Slimmer height consistent with Staff View */}
        <div className="h-44 md:h-48 bg-zinc-800 relative overflow-hidden shrink-0">
          
          {/* TOP LEFT: Station Tag */}
          <div className="absolute top-3 left-3 z-10">
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border backdrop-blur-md shadow-sm ${
              item.station === 'Barista' ? 'bg-amber-900/60 text-amber-200 border-amber-500/30' : 
              item.station === 'Barman' ? 'bg-blue-900/60 text-blue-200 border-blue-500/30' : 
              'bg-emerald-900/60 text-emerald-200 border-emerald-500/30'
            }`}>
              {item.station === 'Barista' && <Coffee size={10} />}
              {item.station === 'Barman' && <Wine size={10} />}
              {(item.station === 'Kitchen' || !item.station) && <Utensils size={10} />}
              {item.station || 'Kitchen'}
            </span>
          </div>

          {/* TOP RIGHT: Live/Draft Status */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 items-end">
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border backdrop-blur-md ${
              item.published 
                ? "bg-green-500/20 text-green-400 border-green-500/30" 
                : "bg-zinc-800/80 text-slate-500 border-slate-700"
            }`}>
              {item.published ? "Live" : "Draft"}
            </span>
            {isNew && (
              <div className="bg-yellow-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 uppercase tracking-widest border border-white/10">
                <Sparkles size={8} fill="black" /> NEW
              </div>
            )}
          </div>

          {item.image_url ? (
            <img 
              src={getImageSrc(item.image_url)} 
              alt={item.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              onError={(e) => { e.target.src = "https://via.placeholder.com/300?text=No+Image"; }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
              <ImageIcon className="w-8 h-8 opacity-20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
        </div>

        {/* Details Section - Left Aligned to match Staff/Manager View */}
        <div className="p-4 md:p-5 flex-1 flex flex-col items-start text-left">
          
          {/* Title & Price Row - Fixed min-height for alignment */}
          <div className="w-full flex justify-between items-start gap-2 mb-2 min-h-[2.5rem]">
            <h4 className="text-sm md:text-base font-medium uppercase tracking-tight leading-tight flex-1 text-white">
              {item.name}
            </h4>
            <div className="text-right shrink-0">
              <span className="text-sm md:text-base text-yellow-500 font-black tracking-tighter">
                {Number(item.price).toLocaleString()}
              </span>
              <div className="text-[7px] font-bold text-slate-500 uppercase -mt-1">UGX</div>
            </div>
          </div>
          
          {/* Description - Fixed height and left aligned */}
          <p className="text-[11px] md:text-xs line-clamp-2 mb-6 leading-snug font-normal h-8 overflow-hidden text-slate-400">
            {item.description || `Signature dish prepared fresh at Kurax.`}
          </p>

          {/* Action Buttons */}
          <div className="mt-auto w-full flex gap-2 pt-4 border-t border-slate-800/50">
            <button 
              onClick={() => handleEdit(item)} 
              className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-xl transition text-[11px] font-black uppercase tracking-widest text-slate-200"
            >
              <Edit2 className="w-3.5 h-3.5 text-yellow-500" /> Edit
            </button>
            <button 
              onClick={() => handleDelete(item.id)} 
              className="px-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition flex items-center justify-center border border-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  })}
</div>
        </main>
        <Footer />
      </div>
    </div>
  )
}