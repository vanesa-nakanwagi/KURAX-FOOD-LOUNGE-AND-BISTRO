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

// Station routing options
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
    station: 'Kitchen',
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

    const data = new FormData();
    data.append('name', formData.name);
    data.append('description', formData.description);
    data.append('price', Number(formData.price));
    data.append('category', formData.category);
    data.append('station', formData.station);
    data.append('published', formData.published);

    if (formData.image_file) {
      data.append('image', formData.image_file);
    }

    try {
      const url = editingMenu
        ? `${API_URL}/api/menus/${editingMenu.id}`
        : `${API_URL}/api/menus`;

      const response = await fetch(url, {
        method: editingMenu ? 'PUT' : 'POST',
        body: data
      });

      if (response.ok) {
        const updatedItem = await response.json();
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
    setEditingMenu(menu);
    setFormData({
      name: menu.name,
      description: menu.description,
      price: menu.price,
      category: menu.category,
      station: menu.station,
      published: menu.published,
      image_file: null,
      current_image_url: menu.image_url
    });
    setFormVisible(true);
    document.getElementById('content-area')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure? This will remove the item for all waiters.')) return;
    try {
      const response = await fetch(`${API_URL}/api/menus/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setMenus(prev => prev.filter(menu => menu.id !== id));
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <div className="flex h-screen font-[Outfit] bg-gray-50 text-gray-900 overflow-hidden">
      <Sidebar />

      <div id="content-area" className="flex-1 flex flex-col overflow-y-auto">
        <main className="p-4 md:p-8 pt-20 lg:pt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Menus</h1>
              <p className="text-gray-500 text-xs md:text-sm mt-1">Design and route your menu items to the correct stations.</p>
            </div>

            {!formVisible && (
              <button
                onClick={() => setFormVisible(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-yellow-500 text-black font-bold rounded-xl hover:bg-yellow-600 transition shadow-md active:scale-95"
              >
                <Plus className="w-5 h-5" />
                Add Menu
              </button>
            )}
          </div>

          {formVisible && (
            <div className="mb-10 bg-white border border-gray-200 p-5 md:p-8 rounded-2xl shadow-sm animate-in fade-in zoom-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg md:text-xl font-bold text-gray-900">
                  {editingMenu ? 'Edit Menu' : 'Create New Menu'}
                </h2>
                <button onClick={resetForm} className="p-2 text-gray-400 hover:text-gray-700 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Menu Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full bg-white border border-gray-300 p-3 rounded-xl focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 outline-none text-sm text-gray-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Category</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      required
                      className="w-full bg-white border border-gray-300 p-3 rounded-xl focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 outline-none text-sm text-gray-900 appearance-none cursor-pointer"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Order Routing (Station Tag)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {STATIONS.map(station => (
                        <button
                          key={station.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, station: station.id }))}
                          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                            formData.station === station.id
                              ? 'bg-yellow-500 text-black border-yellow-500'
                              : 'bg-gray-100 text-gray-500 border-gray-200 hover:border-yellow-300 hover:bg-yellow-50'
                          }`}
                        >
                          {station.icon} {station.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Price (UGX)</label>
                    <input
                      type="text"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      required
                      className="w-full bg-white border border-gray-300 p-3 rounded-xl focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 outline-none text-sm text-gray-900"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Description</label>
                  <textarea
                    name="description"
                    rows="2"
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full bg-white border border-gray-300 p-3 rounded-xl focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 outline-none text-sm text-gray-900"
                  />
                </div>

                <div className="flex flex-col space-y-6 pt-2">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1 sm:flex-none">
                      <input type="file" accept="image/*" onChange={handleChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                      <div className="bg-gray-100 border border-gray-200 px-4 py-3 rounded-xl text-xs font-bold text-gray-600 flex items-center justify-center gap-2 hover:bg-gray-200 transition">
                        <ImageIcon className="w-4 h-4 text-yellow-600" />
                        {formData.image_file ? 'Change Image' : 'Upload Image'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-t border-gray-200 pt-6">
                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <input type="checkbox" name="published" checked={formData.published} onChange={handleChange} className="w-5 h-5 accent-yellow-500 rounded" />
                      <span className="text-gray-700 text-sm font-medium">Publish Menu</span>
                    </label>
                    <div className="flex gap-3">
                      <button type="button" onClick={resetForm} className="px-6 py-3 text-gray-500 font-bold text-sm hover:text-gray-700">Cancel</button>
                      <button type="submit" className="bg-yellow-500 px-8 py-3 rounded-xl text-black font-bold text-sm shadow-sm hover:bg-yellow-600 transition">
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
              const isNew = item.created_at && (new Date() - new Date(item.created_at)) / (1000 * 60 * 60) <= 48;
              return (
                <div
                  key={item.id}
                  className="group relative rounded-2xl overflow-hidden flex flex-col h-full transition-all duration-300 border shadow-sm hover:shadow-md hover:-translate-y-1 bg-white border-gray-200 hover:border-yellow-300"
                >
                  <div className="h-44 md:h-48 bg-gray-100 relative overflow-hidden shrink-0">
                    {/* TOP LEFT: Station Tag */}
                    <div className="absolute top-3 left-3 z-10">
                      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border backdrop-blur-sm shadow-sm ${
                        item.station === 'Barista' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                        item.station === 'Barman' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        'bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}>
                        {item.station === 'Barista' && <Coffee size={10} />}
                        {item.station === 'Barman' && <Wine size={10} />}
                        {(item.station === 'Kitchen' || !item.station) && <Utensils size={10} />}
                        {item.station || 'Kitchen'}
                      </span>
                    </div>

                    {/* TOP RIGHT: Live/Draft Status */}
                    <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 items-end">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border backdrop-blur-sm ${
                        item.published
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : "bg-gray-200 text-gray-600 border-gray-300"
                      }`}>
                        {item.published ? "Live" : "Draft"}
                      </span>
                      {isNew && (
                        <div className="bg-yellow-500 text-black text-[8px] font-black px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 uppercase tracking-widest border border-white/10">
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
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
                        <ImageIcon className="w-8 h-8 opacity-30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-30" />
                  </div>

                  <div className="p-4 md:p-5 flex-1 flex flex-col items-start text-left">
                    <div className="w-full flex justify-between items-start gap-2 mb-2 min-h-[2.5rem]">
                      <h4 className="text-sm md:text-base font-bold uppercase tracking-tight leading-tight flex-1 text-gray-900">
                        {item.name}
                      </h4>
                      <div className="text-right shrink-0">
                        <span className="text-sm md:text-base text-yellow-700 font-black tracking-tighter">
                          {Number(item.price).toLocaleString()}
                        </span>
                        <div className="text-[7px] font-bold text-gray-500 uppercase -mt-1">UGX</div>
                      </div>
                    </div>

                    <p className="text-[11px] md:text-xs line-clamp-2 mb-6 leading-snug font-normal h-8 overflow-hidden text-gray-500">
                      {item.description || `Signature dish prepared fresh at Kurax.`}
                    </p>

                    <div className="mt-auto w-full flex gap-2 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => handleEdit(item)}
                        className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 py-2.5 rounded-xl transition text-[11px] font-black uppercase tracking-widest text-gray-700"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-yellow-600" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition flex items-center justify-center border border-red-100"
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