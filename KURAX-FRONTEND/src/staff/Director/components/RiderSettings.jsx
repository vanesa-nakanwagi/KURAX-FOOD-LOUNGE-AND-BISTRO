import React, { useState, useEffect, useCallback } from "react";
import { Bike, Plus, Trash2, Edit2, Phone, Check, X, UserCheck, UserX } from "lucide-react";
import API_URL from "../../../config/api";

export default function RidersSettings() {
  const [riders,   setRiders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [name,     setName]     = useState("");
  const [phone,    setPhone]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  const fetchRiders = useCallback(async () => {
    try {
      const res  = await fetch(`${API_URL}/api/delivery/riders?includeInactive=1`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRiders(data);
      } else {
        console.error("Expected array from API, got:", data);
        setRiders([]);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setRiders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRiders(); }, [fetchRiders]);

  const resetForm = () => { setName(""); setPhone(""); setEditId(null); setShowForm(false); setError(""); };

  const handleEdit = (rider) => {
    setEditId(rider.id);
    setName(rider.name);
    setPhone(rider.phone || "");
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      if (editId) {
        const res = await fetch(`${API_URL}/api/delivery/riders/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
        });
        if (!res.ok) { const d = await res.json(); setError(d.error || "Update failed"); setSaving(false); return; }
      } else {
        const res = await fetch(`${API_URL}/api/delivery/riders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
        });
        if (!res.ok) { const d = await res.json(); setError(d.error || "Create failed"); setSaving(false); return; }
      }
      await fetchRiders();
      resetForm();
    } catch { setError("Network error"); }
    setSaving(false);
  };

  const handleToggleActive = async (rider) => {
    try {
      await fetch(`${API_URL}/api/delivery/riders/${rider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !rider.active }),
      });
      fetchRiders();
    } catch { /* silent */ }
  };

  const safeRiders = Array.isArray(riders) ? riders : [];
  const activeRiders   = safeRiders.filter(r => r.active);
  const inactiveRiders = safeRiders.filter(r => !r.active);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-0.5">Delivery</p>
          <h3 className="text-base font-black uppercase italic text-gray-900">Rider Registry</h3>
        </div>
        {!showForm && (
          <button 
            onClick={() => { setShowForm(true); setEditId(null); setName(""); setPhone(""); }}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-yellow-400 active:scale-[0.98] transition-all"
          >
            <Plus size={13}/> Add Rider
          </button>
        )}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">
            {editId ? "Edit Rider" : "New Rider"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Okello James"
                className="w-full border border-gray-300 rounded-xl py-2.5 px-3 text-sm font-bold outline-none transition-all bg-white text-gray-800 focus:border-yellow-500 placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1.5">
                Phone (optional)
              </label>
              <div className="relative">
                <Phone size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                  type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="0771 000 000"
                  className="w-full border border-gray-300 rounded-xl py-2.5 pl-9 pr-3 text-sm font-bold outline-none transition-all bg-white text-gray-800 focus:border-yellow-500 placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>
          {error && <p className="text-[11px] text-red-500 font-bold">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button 
              onClick={resetForm} 
              className="flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              disabled={saving || !name.trim()}
              className={`flex-[2] py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2
                ${name.trim() && !saving ? "bg-yellow-500 text-black hover:bg-yellow-400 active:scale-[0.98]" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
            >
              <Check size={13}/> {saving ? "Saving…" : editId ? "Save Changes" : "Add Rider"}
            </button>
          </div>
        </div>
      )}

      {/* Active riders */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse"/>)}
        </div>
      ) : activeRiders.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl py-10 text-center">
          <Bike size={28} className="mx-auto text-gray-400 mb-3 opacity-40"/>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 opacity-60">No riders yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeRiders.map(rider => (
            <div key={rider.id} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <Bike size={16} className="text-orange-600"/>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black uppercase italic text-gray-900 truncate">{rider.name}</p>
                  {rider.phone && (
                    <p className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                      <Phone size={9}/> {rider.phone}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-black uppercase">Active</span>
                <button 
                  onClick={() => handleEdit(rider)}
                  className="p-2 rounded-lg transition-all hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                >
                  <Edit2 size={13}/>
                </button>
                <button 
                  onClick={() => handleToggleActive(rider)}
                  title="Deactivate rider"
                  className="p-2 rounded-lg transition-all hover:bg-red-50 text-gray-500 hover:text-red-600"
                >
                  <UserX size={13}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inactive riders */}
      {inactiveRiders.length > 0 && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">
            Inactive Riders ({inactiveRiders.length})
          </p>
          <div className="space-y-2">
            {inactiveRiders.map(rider => (
              <div key={rider.id} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 opacity-60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-200 flex items-center justify-center shrink-0">
                    <Bike size={16} className="text-gray-500"/>
                  </div>
                  <p className="text-sm font-black uppercase italic text-gray-500">{rider.name}</p>
                </div>
                <button 
                  onClick={() => handleToggleActive(rider)}
                  title="Reactivate rider"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <UserCheck size={12}/> Reactivate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}