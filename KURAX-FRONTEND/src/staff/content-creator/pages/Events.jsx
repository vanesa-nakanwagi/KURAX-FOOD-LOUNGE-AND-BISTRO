import React, { useState, useEffect } from 'react'
import Sidebar from '../../content-creator/components/Sidebar'
import { useData } from "../../../customer/components/context/DataContext";
import { Plus, Calendar, MapPin, Clock, Edit2, Trash2, X, CheckCircle2, AlertCircle, ImageIcon, Loader2 } from 'lucide-react'
import Footer from "../../../customer/components/common/Foooter";
import API_URL from "../../../config/api";

export default function Events() {
  const { events = [], setEvents } = useData()
  const [formVisible, setFormVisible] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [tagInput, setTagInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  const [formData, setFormData] = useState({
    name: '', description: '', date: '', time: '', location: '', image_file: null, published: true, tags: []
  })

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast({ ...toast, show: false }), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
  }

  const getParsedTags = (tags) => {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags;
    try { return JSON.parse(tags); } catch (e) { return []; }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleFileChange = (e) => {
    setFormData(prev => ({ ...prev, image_file: e.target.files[0] || null }))
  }

  const addTag = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = tagInput.trim();
      if (value) {
        if (!formData.tags.includes(value)) {
          setFormData(prev => ({ ...prev, tags: [...prev.tags, value] }));
        }
        setTagInput('');
      }
    }
  };

  const removeTag = (indexToRemove) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter((_, index) => index !== indexToRemove) }))
  }

  const resetForm = () => {
    setFormVisible(false);
    setEditingEvent(null);
    setTagInput('');
    setFormData({
      name: '',
      description: '',
      date: '',
      time: '',
      location: '',
      image_file: null,
      published: true,
      tags: []
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    let currentTags = [...formData.tags];
    const pendingTag = tagInput.trim();
    if (pendingTag && !currentTags.includes(pendingTag)) {
      currentTags.push(pendingTag);
    }

    const data = new FormData();
    data.append('name', formData.name);
    data.append('description', formData.description || '');
    data.append('date', formData.date);
    data.append('time', formData.time);
    data.append('location', formData.location);
    data.append('published', formData.published);
    data.append('tags', JSON.stringify(currentTags));

    if (formData.image_file) {
      data.append('image', formData.image_file);
    } else if (editingEvent) {
      data.append('image_url', editingEvent.image_url);
    }

    const url = editingEvent ? `${API_URL}/api/events/${editingEvent.id}` : `${API_URL}/api/events`;
    const method = editingEvent ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, { method, body: data });
      if (response.ok) {
        const result = await response.json();
        const sanitizedEvent = {
          ...result,
          description: result.description || formData.description,
          tags: typeof result.tags === 'string' ? JSON.parse(result.tags) : (result.tags || [])
        };
        if (editingEvent) {
          setEvents(prev => prev.map(event => event.id === editingEvent.id ? sanitizedEvent : event));
          showToast("Event updated successfully!");
        } else {
          setEvents(prev => [sanitizedEvent, ...prev]);
          showToast("Event created successfully!");
        }
        resetForm();
      } else {
        showToast("Server error occurred.", "error");
      }
    } catch (err) {
      console.error("Save failed:", err);
      showToast("Connection error.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event? This will also remove the image from the server.')) return;
    try {
      const response = await fetch(`${API_URL}/api/events/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setEvents(prev => prev.filter(event => event.id !== id));
        showToast("Event and image deleted.", "success");
      } else {
        showToast("Could not delete from server.", "error");
      }
    } catch (err) {
      console.error("Delete failed:", err);
      showToast("Network error during deletion.", "error");
    }
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    const cleanDate = event.date ? new Date(event.date).toISOString().split('T')[0] : '';
    setFormData({
      ...event,
      date: cleanDate,
      description: event.description || '',
      tags: getParsedTags(event.tags),
      image_file: null
    });
    setFormVisible(true);
    document.getElementById('events-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-[Outfit] overflow-hidden relative">
      <Sidebar />

      {toast.show && (
        <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-top-full duration-300 ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-bold text-sm tracking-wide">{toast.message}</span>
        </div>
      )}

      <div id="events-content" className="flex-1 flex flex-col overflow-y-auto">
        <main className="p-4 md:p-8 pt-20 lg:pt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Events</h1>
              <p className="text-gray-500 text-xs md:text-sm mt-1">Schedule and manage your lounge highlights.</p>
            </div>
            {!formVisible && (
              <button onClick={() => setFormVisible(true)} className="flex items-center justify-center gap-2 px-6 py-3 bg-yellow-500 text-black font-bold rounded-xl hover:bg-yellow-600 transition shadow-md active:scale-95">
                <Plus className="w-5 h-5" /> Add Event
              </button>
            )}
          </div>

          {formVisible && (
            <div className="mb-10 bg-white border border-gray-200 p-5 md:p-8 rounded-2xl shadow-sm animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg md:text-xl font-bold text-gray-900">{editingEvent ? 'Edit Event' : 'Create New Event'}</h2>
                <button onClick={resetForm} className="p-2 text-gray-400 hover:text-gray-700"><X className="w-6 h-6" /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">Event Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full bg-white border border-gray-300 p-3 rounded-xl focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 outline-none text-gray-900" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase">Location</label>
                    <input type="text" name="location" value={formData.location} onChange={handleChange} required className="w-full bg-white border border-gray-300 p-3 rounded-xl focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 outline-none text-gray-900" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Event Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Describe the vibe, special offers, or guest performers..."
                    rows="3"
                    className="w-full bg-white border border-gray-300 p-3 rounded-xl focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 outline-none text-gray-900 resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Tags (Press Enter)</label>
                  <div className="flex flex-wrap gap-2 p-2 bg-gray-50 border border-gray-300 rounded-xl min-h-[50px] focus-within:border-yellow-500 focus-within:ring-1 focus-within:ring-yellow-500/30 transition-colors">
                    {formData.tags.map((tag, index) => (
                      <span key={index} className="flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-800 border border-yellow-200 rounded-lg text-xs font-bold">
                        {tag} <button type="button" onClick={() => removeTag(index)}><X size={12} /></button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag(e);
                        }
                      }}
                      placeholder="Add tag..."
                      className="bg-transparent outline-none text-sm text-gray-900 flex-1 p-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <input type="date" name="date" value={formData.date} onChange={handleChange} required className="bg-white border border-gray-300 p-3 rounded-xl text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30" />
                  <input type="time" name="time" value={formData.time} onChange={handleChange} required className="bg-white border border-gray-300 p-3 rounded-xl text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30" />
                  <input type="file" accept="image/*" onChange={handleFileChange} className="bg-white border border-gray-300 p-2.5 rounded-xl text-xs text-gray-500 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-yellow-500 file:text-black file:font-bold hover:file:bg-yellow-600" />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 mt-4 border-t border-gray-200">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" name="published" id="published" checked={formData.published} onChange={handleChange} className="w-5 h-5 accent-yellow-500 cursor-pointer" />
                    <label htmlFor="published" className="text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700">Make this event live</label>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button type="button" onClick={resetForm} disabled={isSaving} className="flex-1 sm:flex-none px-6 py-3 text-gray-500 font-bold hover:text-gray-700 text-sm">Cancel</button>
                    <button type="submit" disabled={isSaving} className={`flex-1 sm:flex-none px-8 py-3 rounded-xl text-black font-bold transition-all text-sm shadow-md flex items-center justify-center gap-2 ${
                      isSaving ? 'bg-yellow-400 opacity-70 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-600 active:scale-95'
                    }`}>
                      {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : (editingEvent ? 'Save Changes' : 'Confirm Event')}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 pb-10">
            {events.map(event => (
              <div key={event.id} className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-yellow-300 hover:shadow-md transition-all flex flex-col shadow-sm">
                <div className="h-44 md:h-48 bg-gray-100 flex items-center justify-center relative flex-shrink-0">
                  {event.image_url ? (
                    <img src={`${API_URL}${event.image_url}`} alt={event.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400"><ImageIcon className="w-10 h-10" /></div>
                  )}

                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[75%]">
                    {getParsedTags(event.tags).map((tag, i) => (
                      <span key={i} className="px-2.5 py-1 bg-yellow-500/90 backdrop-blur-sm text-black text-[9px] font-black uppercase tracking-widest rounded-full shadow-sm">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="absolute top-3 right-3">
                    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${event.published ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-gray-200 text-gray-600 border border-gray-300'}`}>
                      {event.published ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {event.published ? 'Live' : 'Draft'}
                    </span>
                  </div>
                </div>

                <div className="p-5 md:p-6 flex-1 flex flex-col">
                  <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-1.5 truncate group-hover:text-yellow-600 transition-colors">{event.name}</h2>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed">
                    {event.description || "No description provided."}
                  </p>
                  <div className="space-y-2 mb-6 text-sm text-gray-600">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-3.5 h-3.5 text-yellow-600" />
                      {event.date ? new Date(event.date).toISOString().split('T')[0] : 'No Date'}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-3.5 h-3.5 text-yellow-600" />
                      {event.time ? event.time.substring(0, 5) : 'No Time'}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-3.5 h-3.5 text-yellow-600" />
                      {event.location}
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-4 border-t border-gray-100 mt-auto">
                    <button onClick={() => handleEdit(event)} className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 py-2.5 rounded-xl font-bold text-gray-700 active:scale-95 transition">
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => handleDelete(event.id)} className="px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl active:scale-95 transition">
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