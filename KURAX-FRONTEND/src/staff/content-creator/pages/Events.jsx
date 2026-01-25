import React, { useState } from 'react'
import Sidebar from '../components/Sidebar'
import { useData } from "../../../components/context/DataContext";
import { Plus, Calendar, MapPin, Clock, Edit2, Trash2, X, CheckCircle2, AlertCircle, ImageIcon } from 'lucide-react'
import Footer from "../../../components/common/Foooter";
export default function Events() {
  const { events, setEvents } = useData()
  const [formVisible, setFormVisible] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)

  const [formData, setFormData] = useState({
    name: '', description: '', date: '', time: '', location: '', image_file: null, published: false
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
    // CORRECTION: Scroll the specific content div to top, not the whole window
    document.getElementById('events-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleDelete = (id) => {
    if (!window.confirm('Delete this event?')) return
    setEvents(prev => prev.filter(event => event.id !== id))
  }

  return (
    /* CORRECTION: Changed to h-screen and overflow-hidden to lock the layout */
    <div className="flex h-screen bg-black-950 text-slate-100 font-[Outfit] overflow-hidden">
      <Sidebar />

      {/* CORRECTION: Added id and overflow-y-auto to create the scrollable area */}
      <div id="events-content" className="flex-1 flex flex-col overflow-y-auto">
        <main className="p-4 md:p-8 pt-20 lg:pt-8">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Events</h1>
              <p className="text-slate-400 text-xs md:text-sm mt-1">Schedule and manage your lounge highlights.</p>
            </div>
            
            {!formVisible && (
              <button
                onClick={() => setFormVisible(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-yellow-500 text-black font-bold rounded-xl hover:bg-yellow-600 transition shadow-lg shadow-yellow-500/10 active:scale-95"
              >
                <Plus className="w-5 h-5" />
                Add Event
              </button>
            )}
          </div>

          {/* Add / Edit Form */}
          {formVisible && (
            <div className="mb-10 bg-zinc-900 border border-slate-800 p-5 md:p-8 rounded-2xl shadow-xl animate-in fade-in zoom-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg md:text-xl font-bold text-white">
                  {editingEvent ? 'Edit Event' : 'Create New Event'}
                </h2>
                <button onClick={resetForm} className="p-2 text-slate-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Event Name</label>
                    <input
                      type="text"
                      name="name"
                      placeholder="e.g. Jazz Night"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-sm text-white transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Location</label>
                    <input
                      type="text"
                      name="location"
                      placeholder="e.g. Main Hall"
                      value={formData.location}
                      onChange={handleChange}
                      required
                      className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-sm text-white transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
                  <textarea
                    name="description"
                    rows="3"
                    placeholder="What's happening?"
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-sm text-white transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date</label>
                    <input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl text-sm text-white outline-none focus:border-yellow-500" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Time</label>
                    <input type="time" name="time" value={formData.time} onChange={handleChange} required className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl text-sm text-white outline-none focus:border-yellow-500" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cover Image</label>
                    <div className="relative group">
                        <input type="file" accept="image/*" onChange={handleChange} className="w-full bg-zinc-800 border border-slate-700 p-2.5 rounded-xl text-xs text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:bg-yellow-500 file:text-black file:font-bold" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-4">
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <div className="relative flex items-center">
                        <input type="checkbox" name="published" checked={formData.published} onChange={handleChange} className="w-5 h-5 accent-yellow-500 bg-zinc-800 border-slate-700 rounded" />
                    </div>
                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Publish immediately</span>
                  </label>

                  <div className="flex gap-3">
                    <button type="button" onClick={resetForm} className="flex-1 sm:flex-none px-6 py-3 text-slate-400 font-bold hover:text-white transition-colors text-sm">Cancel</button>
                    <button type="submit" className="flex-1 sm:flex-none bg-yellow-500 px-8 py-3 rounded-xl text-black font-bold hover:bg-yellow-600 transition-all shadow-lg shadow-yellow-500/10 active:scale-95 text-sm">
                      {editingEvent ? 'Save Changes' : 'Confirm Event'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Events Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 pb-10">
            {events.length > 0 ? (
              events.map(event => (
                <div key={event.id} className="group bg-zinc-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-yellow-500/30 transition-all duration-300 flex flex-col">
                  <div className="h-44 md:h-48 bg-zinc-800 flex items-center justify-center relative flex-shrink-0">
                    {event.image_file && event.image_file instanceof Blob ? (
                      <img 
                        src={URL.createObjectURL(event.image_file)} 
                        alt={event.name} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-600">
                        <ImageIcon className="w-10 h-10" />
                        <span className="text-[10px] uppercase font-bold tracking-widest">No Image</span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                        event.published ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-zinc-800 text-slate-500 border border-slate-700'
                      }`}>
                        {event.published ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {event.published ? 'Live' : 'Draft'}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 md:p-6 flex-1 flex flex-col">
                    <h2 className="text-lg md:text-xl font-bold text-white mb-1.5 truncate">{event.name}</h2>
                    <p className="text-slate-400 text-xs md:text-sm line-clamp-2 mb-4 h-9 md:h-10 leading-relaxed">
                        {event.description || "No description provided for this event."}
                    </p>
                    
                    <div className="space-y-2 mb-6 text-[13px] text-slate-300">
                      <div className="flex items-center gap-2.5"><Calendar className="w-3.5 h-3.5 text-yellow-500" /> {event.date}</div>
                      <div className="flex items-center gap-2.5"><Clock className="w-3.5 h-3.5 text-yellow-500" /> {event.time}</div>
                      <div className="flex items-center gap-2.5"><MapPin className="w-3.5 h-3.5 text-yellow-500" /> {event.location}</div>
                    </div>

                    <div className="flex gap-2.5 pt-4 border-t border-slate-800 mt-auto">
                      <button onClick={() => handleEdit(event)} className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-xl transition text-[13px] font-bold text-slate-200 active:scale-95">
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button onClick={() => handleDelete(event.id)} className="px-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition active:scale-95">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
                <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl">
                    <Calendar className="w-12 h-12 text-slate-800 mb-4" />
                    <p className="text-slate-500 font-medium italic">No events scheduled yet.</p>
                </div>
            )}
          </div>
        </main>
          <Footer />
      </div>
    </div>
  )
}