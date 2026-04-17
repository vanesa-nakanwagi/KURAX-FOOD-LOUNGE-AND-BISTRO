import React, { useState, useEffect } from "react";
import { PlusCircle, RefreshCw, Trash2, ShieldCheck, Sun, Moon } from "lucide-react";

const DEFAULT_CATEGORIES = [
  "Rent", "Staff Wages", "Stock / Supplies", "Utilities",
  "Marketing", "Equipment", "Transport", "Other",
];

export default function MonthlyCosts({ 
  month, 
  monthLabel, 
  fixedItems = [],
  profitLoad, 
  onRefresh, 
  dark, 
  t, 
  API_URL 
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setShowSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [isDark, setIsDark] = useState(dark !== undefined ? dark : true);

  // Sync with parent dark mode prop
  useEffect(() => {
    if (dark !== undefined) {
      setIsDark(dark);
    }
  }, [dark]);

  // Form State
  const [newCategory, setNewCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [customCat, setCustomCat] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Get name from storage
  const userObj = JSON.parse(localStorage.getItem("kurax_user") || "{}");
  const userName = userObj.name || "Accountant";

  const handleSave = async () => {
    const cat = newCategory === "__custom__" ? customCat.trim() : newCategory;
    const amt = Number(newAmount);
    
    if (!cat || !amt || amt <= 0) {
      alert("Please enter a valid category and amount");
      return;
    }

    setShowSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/summaries/monthly-expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          category: cat,
          amount: amt,
          description: newDesc.trim() || null,
          entered_by: userName,
        }),
      });

      if (res.ok) {
        setNewAmount(""); 
        setNewDesc(""); 
        setCustomCat(""); 
        setShowForm(false);
        onRefresh();
      }
    } catch (e) {
      console.error("Expense save failed:", e);
    } finally {
      setShowSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Are you sure you want to delete this expense?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_URL}/api/summaries/monthly-expenses/${id}`, { 
        method: "DELETE" 
      });
      if(res.ok) onRefresh();
    } catch (e) {
      console.error("Expense delete failed:", e);
    } finally {
      setDeletingId(null);
    }
  };

  // Dynamic classes based on theme
  const cardBgClass = isDark ? "bg-zinc-900/40 border-white/5" : "bg-white/80 border-gray-200 shadow-sm";
  const dividerClass = isDark ? "border-white/5" : "border-gray-200";
  const textClass = isDark ? "text-white" : "text-gray-900";
  const subtextClass = isDark ? "text-zinc-500" : "text-gray-500";
  const inputBgClass = isDark ? "bg-black border-white/10 text-white focus:border-yellow-500" : "bg-white border-gray-200 text-gray-900 focus:border-yellow-500";
  const itemBgClass = isDark ? "bg-zinc-900/40 border-white/5" : "bg-gray-50 border-gray-200";
  const skeletonBgClass = isDark ? "bg-white/5" : "bg-gray-100";
  const dashedBorderClass = isDark ? "border-white/5" : "border-gray-200";

  return (
    <div className={`rounded-2xl overflow-hidden shadow-xl transition-all duration-300 ${cardBgClass}`}>
      {/* HEADER */}
      <div className={`flex items-center justify-between px-6 py-5 border-b ${dividerClass} ${isDark ? 'bg-black/5' : 'bg-gray-50'}`}>
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-tighter text-yellow-500 italic">Expense Ledger</h3>
          <p className={`text-[9px] font-bold uppercase ${subtextClass}`}>{monthLabel}</p>
        </div>
        <button 
          onClick={() => setShowForm(v => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase transition-all duration-300 active:scale-95 ${
            showForm 
              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20" 
              : "bg-gradient-to-r from-yellow-500 to-yellow-600 text-black hover:shadow-lg hover:shadow-yellow-500/20"
          }`}
        >
          <PlusCircle size={14}/> {showForm ? "Cancel" : "Add New Cost"}
        </button>
      </div>

      {/* ADD EXPENSE FORM */}
      {showForm && (
        <div className={`px-6 py-6 border-b ${dividerClass} space-y-4 bg-yellow-500/5 animate-in slide-in-from-top duration-300`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={`text-[9px] font-black uppercase ${subtextClass} ml-1`}>Category Type</label>
              <select 
                value={newCategory} 
                onChange={e => setNewCategory(e.target.value)}
                className={`w-full rounded-2xl p-4 text-xs font-bold outline-none border transition-all duration-200 focus:ring-1 focus:ring-yellow-500/30 ${inputBgClass}`}
              >
                {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__custom__" className="text-yellow-500 font-black">+ ADD CUSTOM CATEGORY</option>
              </select>
              
              {newCategory === "__custom__" && (
                <input 
                  value={customCat} 
                  onChange={e => setCustomCat(e.target.value)}
                  placeholder="e.g. Garbage Collection"
                  className={`mt-2 w-full rounded-2xl p-4 text-xs font-bold outline-none border transition-all duration-200 animate-in fade-in zoom-in-95 focus:ring-1 focus:ring-yellow-500/30 ${
                    isDark ? "bg-zinc-900 border-yellow-500/50 text-white" : "bg-white border-yellow-500 text-gray-900"
                  }`}
                />
              )}
            </div>

            <div className="space-y-2">
              <label className={`text-[9px] font-black uppercase ${subtextClass} ml-1`}>Amount (UGX)</label>
              <input 
                type="number" 
                value={newAmount} 
                onChange={e => setNewAmount(e.target.value)}
                placeholder="Enter amount..."
                className={`w-full rounded-2xl p-4 text-xs font-black outline-none border transition-all duration-200 focus:ring-1 focus:ring-yellow-500/30 ${inputBgClass}`}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className={`text-[9px] font-black uppercase ${subtextClass} ml-1`}>Expense Description</label>
            <input 
              value={newDesc} 
              onChange={e => setNewDesc(e.target.value)}
              placeholder="What is this for? (Optional)"
              className={`w-full rounded-2xl p-4 text-xs font-bold outline-none border transition-all duration-200 focus:ring-1 focus:ring-yellow-500/30 ${inputBgClass}`}
            />
          </div>

          <button 
            onClick={handleSave}
            disabled={saving || !newAmount}
            className={`w-full py-4 rounded-2xl font-black text-xs uppercase italic tracking-widest transition-all duration-300 ${
              !saving && newAmount 
                ? "bg-gradient-to-r from-yellow-500 to-yellow-600 text-black hover:shadow-lg hover:shadow-yellow-500/20 hover:scale-[1.02]" 
                : `${isDark ? "bg-zinc-800 text-zinc-600" : "bg-gray-200 text-gray-400"} cursor-not-allowed`
            }`}
          >
            {saving ? <RefreshCw className="animate-spin mx-auto" size={16}/> : "Confirm & Record Cost"}
          </button>
        </div>
      )}

      {/* EXPENSE LIST */}
      <div className="p-6">
        {profitLoad ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className={`h-16 rounded-2xl animate-pulse ${skeletonBgClass}`}/>)}
          </div>
        ) : fixedItems.length === 0 ? (
          <div className={`py-12 text-center border-2 border-dashed rounded-2xl transition-all duration-300 ${dashedBorderClass}`}>
            <p className={`text-[10px] font-black uppercase tracking-tighter italic ${subtextClass}`}>No expenses recorded for this period</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {fixedItems.map(item => (
              <div key={item.id} className={`flex items-center justify-between p-4 rounded-2xl border group transition-all duration-300 hover:border-yellow-500/30 hover:shadow-md ${itemBgClass}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-xs font-black uppercase italic ${textClass}`}>{item.category}</p>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <ShieldCheck size={8} className="text-emerald-500" />
                      <span className="text-[7px] font-black text-emerald-500 uppercase">Logged</span>
                    </div>
                  </div>
                  {item.description && <p className={`text-[9px] font-medium mt-0.5 truncate ${subtextClass}`}>{item.description}</p>}
                  <p className={`text-[7px] mt-1 uppercase font-black tracking-widest ${subtextClass}`}>Entry by: {item.entered_by || "System"}</p>
                </div>

                <div className="flex items-center gap-4 ml-4">
                  <p className="text-sm font-black text-rose-500 italic shrink-0">UGX {Number(item.amount).toLocaleString()}</p>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-2 bg-rose-500/10 text-rose-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-rose-500 hover:text-white hover:scale-110"
                  >
                    {deletingId === item.id ? <RefreshCw size={12} className="animate-spin"/> : <Trash2 size={12}/>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER TOTAL */}
      {!profitLoad && fixedItems.length > 0 && (
        <div className={`px-6 py-4 ${isDark ? 'bg-black/20' : 'bg-gray-100'} border-t ${dividerClass} flex justify-between items-center`}>
          <span className={`text-[9px] font-black uppercase italic ${subtextClass}`}>Total Logged Expenses</span>
          <span className="text-lg font-black text-rose-500 italic tracking-tighter">
            UGZ {fixedItems.reduce((sum, item) => sum + Number(item.amount), 0).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}