import React, { useState } from 'react'
import Sidebar from '../../content-creator/components/Sidebar'
import { useData } from "../../../customer/components/context/DataContext";
import { Plus, Calendar, MapPin, Clock, Edit2, Trash2, X, CheckCircle2, AlertCircle, ImageIcon } from 'lucide-react'
import Footer from "../../../customer/components/common/Foooter";

export default function Events() {
  const { events, setEvents } = useData()
  const [formVisible, setFormVisible] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [tagInput, setTagInput] = useState('')

  const [formData, setFormData] = useState({
    name: '', description: '', date: '', time: '', location: '', image_file: null, published: false, tags: []
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleFileChange = (e) => {
    setFormData(prev => ({ ...prev, image_file: e.target.files[0] || null }))
  }

  const addTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      if (!formData.tags.includes(tagInput.trim())) {
        setFormData(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }))
      }
      setTagInput('')
    }
  }

  const removeTag = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, index) => index !== indexToRemove)
    }))
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
    setTagInput('')
    setFormData({ name: '', description: '', date: '', time: '', location: '', image_file: null, published: false, tags: [] })
  }

  const handleEdit = (event) => {
    setEditingEvent(event)
    setFormData({ ...event, tags: event.tags || [] })
    setFormVisible(true)
    document.getElementById('events-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleDelete = (id) => {
    if (!window.confirm('Delete this event?')) return
    setEvents(prev => prev.filter(event => event.id !== id))
  }

  return (
    <div className="flex h-screen bg-black-950 text-slate-100 font-[Outfit] overflow-hidden">
      <Sidebar />

      <div id="events-content" className="flex-1 flex flex-col overflow-y-auto">
        <main className="p-4 md:p-8 pt-20 lg:pt-8">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Events</h1>
              <p className="text-slate-400 text-xs md:text-sm mt-1">Schedule and manage your lounge highlights.</p>
            </div>
            
            {!formVisible && (
              <button onClick={() => setFormVisible(true)} className="flex items-center justify-center gap-2 px-6 py-3 bg-yellow-500 text-black font-bold rounded-xl hover:bg-yellow-600 transition shadow-lg shadow-yellow-500/10 active:scale-95">
                <Plus className="w-5 h-5" /> Add Event
              </button>
            )}
          </div>

          {formVisible && (
            <div className="mb-10 bg-zinc-900 border border-slate-800 p-5 md:p-8 rounded-2xl shadow-xl animate-in fade-in zoom-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg md:text-xl font-bold text-white">{editingEvent ? 'Edit Event' : 'Create New Event'}</h2>
                <button onClick={resetForm} className="p-2 text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Event Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-sm text-white" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Location</label>
                    <input type="text" name="location" value={formData.location} onChange={handleChange} required className="w-full bg-zinc-800 border border-slate-700 p-3 rounded-xl focus:border-yellow-500 outline-none text-sm text-white" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Event Tags (Press Enter)</label>
                  <div className="flex flex-wrap gap-2 p-2 bg-zinc-800 border border-slate-700 rounded-xl min-h-[50px] focus-within:border-yellow-500">
                    {formData.tags.map((tag, index) => (
                      <span key={index} className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-lg text-xs font-bold">
                        {tag}
                        <button type="button" onClick={() => removeTag(index)}><X size={12} /></button>
                      </span>
                    ))}
                    <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={addTag} placeholder="Add tag..." className="bg-transparent outline-none text-sm text-white flex-1 p-1" />
                  </div>
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
                    <input type="file" accept="image/*" onChange={handleFileChange} className="w-full bg-zinc-800 border border-slate-700 p-2.5 rounded-xl text-xs text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-yellow-500 file:text-black file:font-bold" />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={resetForm} className="px-6 py-3 text-slate-400 font-bold hover:text-white text-sm">Cancel</button>
                  <button type="submit" className="bg-yellow-500 px-8 py-3 rounded-xl text-black font-bold hover:bg-yellow-600 transition-all text-sm shadow-lg shadow-yellow-500/10">
                    {editingEvent ? 'Save Changes' : 'Confirm Event'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 pb-10">
            {events.map(event => (
              <div key={event.id} className="group bg-zinc-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-yellow-500/30 transition-all duration-300 flex flex-col">
                <div className="h-44 md:h-48 bg-zinc-800 flex items-center justify-center relative flex-shrink-0">
                  {event.image_file && event.image_file instanceof Blob ? (
                    <img src={URL.createObjectURL(event.image_file)} alt={event.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-600">
                      <ImageIcon className="w-10 h-10" />
                      <span className="text-[10px] uppercase font-bold tracking-widest">No Image</span>
                    </div>
                  )}
                  
                  {/* TAGS MOVED TO TOP LEFT */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                    {(event.tags || []).map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-yellow-400 backdrop-blur-md text-black text-[9px] font-black uppercase tracking-widest rounded-full border border-white/10">
                        {tag}
                      </span>
                    ))}
                  </div>

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
            ))}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}