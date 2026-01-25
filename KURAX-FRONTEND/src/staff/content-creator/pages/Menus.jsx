import React, { useState } from 'react'
import Sidebar from '../components/Sidebar'
import { useData } from "../../../components/context/DataContext";
import { Plus, Utensils, Edit2, Trash2, X, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react'

const formatUGX = (amount) =>
  `UGX ${Number(amount || 0).toLocaleString('en-UG')}`

export default function Menus() {
  const { menus, setMenus } = useData()
  const [formVisible, setFormVisible] = useState(false)
  const [editingMenu, setEditingMenu] = useState(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
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

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { 
      ...formData, 
      price: Number(formData.price),
      id: editingMenu ? editingMenu.id : Date.now() 
    }

    if (editingMenu) {
      setMenus(prev => prev.map(menu => (menu.id === editingMenu.id ? payload : menu)))
    } else {
      setMenus(prev => [...prev, payload])
    }
    resetForm()
  }

  const resetForm = () => {
    setFormVisible(false)
    setEditingMenu(null)
    setFormData({ name: '', description: '', price: '', image_file: null, published: false })
  }

  const handleEdit = (menu) => {
    setEditingMenu(menu)
    setFormData({
      ...menu,
      // Critical: Don't try to pass a broken object from localStorage into the file input state
      image_file: menu.image_file instanceof Blob ? menu.image_file : null 
    })
    setFormVisible(true)
  }

  const handleDelete = (id) => {
    if (!window.confirm('Delete this menu?')) return
    setMenus(prev => prev.filter(menu => menu.id !== id))
  }

  return (
    <div className="flex h-screen font-[Outfit] bg-black-950 text-slate-100 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-auto">
        <main className="p-8">
          
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Menus</h1>
              <p className="text-slate-400 text-sm mt-1">Design and manage your seasonal flavors.</p>
            </div>
            
            {!formVisible && (
              <button
                onClick={() => setFormVisible(true)}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-500 text-black font-bold rounded-xl hover:bg-yellow-600 transition shadow-lg shadow-yellow-500/10"
              >
                <Plus className="w-5 h-5" />
                Add Menu
              </button>
            )}
          </div>

          {formVisible && (
            <div className="mb-10 bg-zinc-900 border border-slate-800 p-8 rounded-2xl shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">
                  {editingMenu ? 'Edit Menu' : 'Create New Menu'}
                </h2>
                <button onClick={resetForm} className="text-slate-500 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Menu Name</label>
                    <input
                      type="text"
                      name="name"
                      placeholder="e.g. Summer Specials"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Price (UGX)</label>
                    <div className="relative">
                      <input
                        type="text"
                        name="price"
                        placeholder="0"
                        value={formData.price}
                        onChange={handleChange}
                        required
                        className="w-full bg-zinc-800 border border-slate-700 p-3 pl-10 rounded-xl focus:border-yellow-500 outline-none text-white"
                      />
                      <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-4" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Description</label>
                  <textarea
                    name="description"
                    rows="3"
                    placeholder="Describe the dishes..."
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-6 pt-4">
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleChange} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="bg-zinc-800 border border-slate-700 px-4 py-2 rounded-lg text-sm text-slate-400 group-hover:bg-zinc-700 transition">
                        {formData.image_file ? 'Change Image' : 'Upload Image'}
                      </div>
                    </div>
                    {/* FIXED: Check for Blob here too to prevent line 163 crash */}
                    {formData.image_file && formData.image_file instanceof Blob && (
                      <div className="relative w-12 h-12">
                        <img src={URL.createObjectURL(formData.image_file)} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-6">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        name="published" 
                        checked={formData.published} 
                        onChange={handleChange} 
                        className="w-5 h-5 accent-yellow-500 bg-zinc-800 border-slate-700" 
                      />
                      <span className="text-slate-300 text-sm">Publish Menu</span>
                    </label>
                    
                    <div className="flex gap-3">
                      <button type="button" onClick={resetForm} className="px-6 py-3 text-slate-400 font-semibold hover:text-white transition">Cancel</button>
                      <button type="submit" className="bg-yellow-500 px-8 py-3 rounded-xl text-black font-bold hover:bg-yellow-600 transition">
                        {editingMenu ? 'Update Menu' : 'Add Menu'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {menus.map(menu => (
              <div key={menu.id} className="group bg-zinc-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-yellow-500/30 transition-all duration-300">
                <div className="h-48 bg-zinc-800 flex items-center justify-center relative">
                  {/* FIXED: Instanceof Blob check ensures only valid files are processed */}
                  {menu.image_file && menu.image_file instanceof Blob ? (
                    <img 
                      src={URL.createObjectURL(menu.image_file)} 
                      alt={menu.name} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <Utensils className="w-12 h-12 text-slate-700" />
                  )}
                  <div className="absolute top-4 right-4">
                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      menu.published ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-zinc-800 text-slate-500 border border-slate-700'
                    }`}>
                      {menu.published ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {menu.published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h2 className="text-xl font-bold text-white">{menu.name}</h2>
                    <span className="text-yellow-500 font-bold">{formatUGX(menu.price)}</span>
                  </div>
                  <p className="text-slate-400 text-sm line-clamp-2 mb-6">{menu.description}</p>

                  <div className="flex gap-3 pt-4 border-t border-slate-800">
                    <button 
                      onClick={() => handleEdit(menu)} 
                      className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-xl transition text-sm font-semibold text-slate-200"
                    >
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(menu.id)} 
                      className="px-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}