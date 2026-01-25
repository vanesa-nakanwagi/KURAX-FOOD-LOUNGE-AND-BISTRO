import React, { useState } from 'react'
import Sidebar from '../components/Sidebar'
// 1. Import the global hook
import { useData } from "../../../components/context/DataContext";
import { Plus, Calendar, MapPin, Clock, Edit2, Trash2, X, CheckCircle2, AlertCircle } from 'lucide-react'

export default function Events() {
  // 2. Pull events from Context. Remove local useState([ ... ])
  const { events, setEvents } = useData()

  const [formVisible, setFormVisible] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    date: '',
    time: '',
    location: '',
    image_file: null,
    published: false
  })

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target
    if (type === 'file') {
      setFormData(prev => ({ ...prev, image_file: files[0] || null }))
    } else {
      setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...formData, id: editingEvent ? editingEvent.id : Date.now() }
    
    // 3. Updates the global state so Dashboard sees the change
    if (editingEvent) {
      setEvents(prev => prev.map(event => event.id === editingEvent.id ? payload : event))
    } else {
      setEvents(prev => [...prev, payload])
    }
    resetForm()
  }

  const resetForm = () => {
    setFormVisible(false)
    setEditingEvent(null)
    setFormData({ name: '', description: '', date: '', time: '', location: '', image_file: null, published: false })
  }

  const handleEdit = (event) => {
    setEditingEvent(event)
    setFormData(event)
    setFormVisible(true)
  }

  const handleDelete = (id) => {
    if (!window.confirm('Delete this event?')) return
    setEvents(prev => prev.filter(event => event.id !== id))
  }

  return (
    <div className="flex h-screen bg-black-950 text-slate-100 font-[Outfit] overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-auto">
        <main className="p-8">
          
          {/* Header Section */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Events</h1>
              <p className="text-slate-400 text-sm mt-1">Schedule and manage your lounge highlights.</p>
            </div>
            
            {!formVisible && (
              <button
                onClick={() => setFormVisible(true)}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-500 text-black font-bold rounded-xl hover:bg-yellow-600 transition shadow-lg shadow-yellow-500/10"
              >
                <Plus className="w-5 h-5" />
                Add Event
              </button>
            )}
          </div>

          {/* Add / Edit Form */}
          {formVisible && (
            <div className="mb-10 bg-zinc-900 border border-slate-800 p-8 rounded-2xl shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">
                  {editingEvent ? 'Edit Event' : 'Create New Event'}
                </h2>
                <button onClick={resetForm} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Event Name</label>
                    <input
                      type="text"
                      name="name"
                      placeholder="e.g. Jazz Night"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-white transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Location</label>
                    <input
                      type="text"
                      name="location"
                      placeholder="e.g. Main Hall"
                      value={formData.location}
                      onChange={handleChange}
                      required
                      className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-white transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Description</label>
                  <textarea
                    name="description"
                    rows="3"
                    placeholder="What's happening?"
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-white transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Date</label>
                    <input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl text-white outline-none focus:border-yellow-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Time</label>
                    <input type="time" name="time" value={formData.time} onChange={handleChange} required className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl text-white outline-none focus:border-yellow-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Cover Image</label>
                    <input type="file" accept="image/*" onChange={handleChange} className="w-full bg-zinc-800 border border-slate-700 p-2.5 rounded-xl text-sm text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-yellow-500 file:text-black file:font-bold" />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <input type="checkbox" name="published" checked={formData.published} onChange={handleChange} className="w-5 h-5 accent-yellow-500 bg-zinc-800 border-slate-700 rounded" />
                    <span className="text-slate-300 group-hover:text-white transition-colors">Publish immediately</span>
                  </label>

                  <div className="flex gap-4">
                    <button type="button" onClick={resetForm} className="px-6 py-3 text-slate-400 font-semibold hover:text-white transition-colors">Cancel</button>
                    <button type="submit" className="bg-yellow-500 px-8 py-3 rounded-xl text-black font-bold hover:bg-yellow-600 transition-all shadow-lg shadow-yellow-500/10">
                      {editingEvent ? 'Save Changes' : 'Confirm Event'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Events Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {events.map(event => (
              <div key={event.id} className="group bg-zinc-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-yellow-500/30 transition-all duration-300">
                <div className="h-48 bg-zinc-800 flex items-center justify-center relative">
                  {event.image_file && event.image_file instanceof Blob ? (
    <img 
      src={URL.createObjectURL(event.image_file)} 
      alt={event.name} 
      className="w-full h-full object-cover" 
    />
  ) : (
    <Calendar className="w-12 h-12 text-slate-700" />
  )}
                  <div className="absolute top-4 right-4">
                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      event.published ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-zinc-800 text-slate-500 border border-slate-700'
                    }`}>
                      {event.published ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {event.published ? 'Live' : 'Draft'}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <h2 className="text-xl font-bold text-white mb-2">{event.name}</h2>
                  <p className="text-slate-400 text-sm line-clamp-2 mb-4">{event.description}</p>
                  
                  <div className="space-y-2 mb-6 text-sm text-slate-300">
                    <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-yellow-500" /> {event.date}</div>
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-yellow-500" /> {event.time}</div>
                    <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-yellow-500" /> {event.location}</div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-800">
                    <button onClick={() => handleEdit(event)} className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-xl transition text-sm font-semibold text-slate-200">
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                    <button onClick={() => handleDelete(event.id)} className="px-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition">
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