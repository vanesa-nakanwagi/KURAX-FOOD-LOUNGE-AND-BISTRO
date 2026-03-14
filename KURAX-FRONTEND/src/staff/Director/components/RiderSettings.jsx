import React, { useState, useEffect, useCallback } from "react";
import { Bike, Plus, Trash2, Edit2, Phone, Check, X, UserCheck, UserX } from "lucide-react";
import API_URL from "../../../config/api";

export default function RidersSettings({ dark = true, t = {} }) {
  const [riders,   setRiders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [name,     setName]     = useState("");
  const [phone,    setPhone]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  const bg    = dark ? "bg-[#111]"                : "bg-white";
  const card  = dark ? "bg-white/3 border-white/8" : "bg-zinc-50 border-zinc-100";
  const sub   = dark ? "text-zinc-500"             : "text-zinc-400";
  const text  = dark ? "text-white"                : "text-zinc-800";
  const input = dark
    ? "bg-black border-white/10 text-white focus:border-yellow-500/40 placeholder:text-zinc-700"
    : "bg-white border-zinc-200 text-zinc-800 focus:border-yellow-500 placeholder:text-zinc-400";

  const fetchRiders = useCallback(async () => {
    try {
      const res  = await fetch(`${API_URL}/api/delivery/riders?includeInactive=1`);
      const data = await res.json();
      setRiders(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
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
        // Update existing
        const res = await fetch(`${API_URL}/api/delivery/riders/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
        });
        if (!res.ok) { const d = await res.json(); setError(d.error || "Update failed"); setSaving(false); return; }
      } else {
        // Create new
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

  const activeRiders   = riders.filter(r => r.active);
  const inactiveRiders = riders.filter(r => !r.active);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${sub} mb-0.5`}>Delivery</p>
          <h3 className={`text-base font-black uppercase italic ${text}`}>Rider Registry</h3>
        </div>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setEditId(null); setName(""); setPhone(""); }}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-yellow-400 active:scale-[0.98] transition-all">
            <Plus size={13}/> Add Rider
          </button>
        )}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className={`${card} border rounded-2xl p-4 space-y-3`}>
          <p className={`text-[9px] font-black uppercase tracking-widest ${sub}`}>
            {editId ? "Edit Rider" : "New Rider"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`text-[9px] font-black uppercase tracking-widest ${sub} block mb-1.5`}>
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Okello James"
                className={`w-full border rounded-xl py-2.5 px-3 text-sm font-bold outline-none transition-all ${input}`}
              />
            </div>
            <div>
              <label className={`text-[9px] font-black uppercase tracking-widest ${sub} block mb-1.5`}>
                Phone (optional)
              </label>
              <div className="relative">
                <Phone size={12} className={`absolute left-3 top-1/2 -translate-y-1/2 ${sub}`}/>
                <input
                  type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="0771 000 000"
                  className={`w-full border rounded-xl py-2.5 pl-9 pr-3 text-sm font-bold outline-none transition-all ${input}`}
                />
              </div>
            </div>
          </div>
          {error && <p className="text-[11px] text-red-400 font-bold">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={resetForm} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${dark ? "bg-white/5 text-zinc-400 hover:bg-white/10" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !name.trim()}
              className={`flex-[2] py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2
                ${name.trim() && !saving ? "bg-yellow-500 text-black hover:bg-yellow-400 active:scale-[0.98]" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}>
              <Check size={13}/> {saving ? "Saving…" : editId ? "Save Changes" : "Add Rider"}
            </button>
          </div>
        </div>
      )}

      {/* Active riders */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className={`h-14 rounded-xl ${dark ? "bg-white/5" : "bg-zinc-100"} animate-pulse`}/>)}
        </div>
      ) : activeRiders.length === 0 ? (
        <div className={`${card} border rounded-2xl py-10 text-center`}>
          <Bike size={28} className={`mx-auto ${sub} mb-3 opacity-40`}/>
          <p className={`text-[10px] font-black uppercase tracking-widest ${sub} opacity-60`}>No riders yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeRiders.map(rider => (
            <div key={rider.id} className={`${card} border rounded-xl px-4 py-3 flex items-center justify-between gap-3`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl ${dark ? "bg-orange-500/15" : "bg-orange-50"} flex items-center justify-center shrink-0`}>
                  <Bike size={16} className="text-orange-400"/>
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-black uppercase italic ${text} truncate`}>{rider.name}</p>
                  {rider.phone && (
                    <p className={`text-[10px] font-bold ${sub} flex items-center gap-1`}>
                      <Phone size={9}/> {rider.phone}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase">Active</span>
                <button onClick={() => handleEdit(rider)}
                  className={`p-2 rounded-lg transition-all ${dark ? "hover:bg-white/10 text-zinc-500 hover:text-white" : "hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700"}`}>
                  <Edit2 size={13}/>
                </button>
                <button onClick={() => handleToggleActive(rider)}
                  title="Deactivate rider"
                  className={`p-2 rounded-lg transition-all ${dark ? "hover:bg-red-500/10 text-zinc-500 hover:text-red-400" : "hover:bg-red-50 text-zinc-400 hover:text-red-500"}`}>
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
          <p className={`text-[9px] font-black uppercase tracking-widest ${sub} mb-2`}>
            Inactive Riders ({inactiveRiders.length})
          </p>
          <div className="space-y-2">
            {inactiveRiders.map(rider => (
              <div key={rider.id} className={`${card} border rounded-xl px-4 py-3 flex items-center justify-between gap-3 opacity-50`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${dark ? "bg-zinc-800" : "bg-zinc-100"} flex items-center justify-center shrink-0`}>
                    <Bike size={16} className={sub}/>
                  </div>
                  <p className={`text-sm font-black uppercase italic ${sub}`}>{rider.name}</p>
                </div>
                <button onClick={() => handleToggleActive(rider)}
                  title="Reactivate rider"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all
                    ${dark ? "bg-white/5 text-zinc-400 hover:bg-emerald-500/10 hover:text-emerald-400" : "bg-zinc-100 text-zinc-500 hover:bg-emerald-50 hover:text-emerald-600"}`}>
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