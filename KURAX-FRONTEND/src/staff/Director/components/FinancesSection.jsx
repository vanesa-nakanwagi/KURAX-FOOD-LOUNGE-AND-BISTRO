import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowDownRight, BookOpen, User, Phone, Calendar,
  RefreshCw, ChevronLeft, ChevronRight, FileText, CheckCircle2
} from "lucide-react";
import { useTheme } from "./shared/ThemeContext";
import { FinanceRow } from "./shared/UIHelpers";
import API_URL from "../../../config/api";

// ─── UTILS ──────────────────────────────────────────────────────────────────
function kampalaMonth(offset = 0) {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" }));
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().substring(0, 7);
}

function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString("en-US", { month: "long", year: "numeric" });
}

export default function FinancesSection() {
  const { dark, t } = useTheme();
  const [monthOffset, setMonthOffset] = useState(0);
  const month = kampalaMonth(monthOffset);

  const [profit, setProfit] = useState(null);
  const [profitLoad, setProfitLoad] = useState(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // ─── FETCH DATA ───────────────────────────────────────────────────────────
  const fetchProfit = useCallback(async () => {
    setProfitLoad(true);
    try {
      const res = await fetch(`${API_URL}/api/summaries/monthly-profit?month=${month}`);
      if (res.ok) setProfit(await res.json());
    } catch (e) { console.error("Profit fetch error:", e); }
    finally { setProfitLoad(false); }
  }, [month]);

  useEffect(() => { fetchProfit(); }, [fetchProfit]);

  // ─── EXPORT PDF ───────────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    setIsExportingPDF(true);
    try {
      const res = await fetch(`${API_URL}/api/summaries/export-pdf?month=${month}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Kurax_Report_${month}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else { alert("PDF route not configured on backend."); }
    } catch (e) { alert("Network error during PDF generation."); }
    finally { setIsExportingPDF(false); }
  };

  const costs = profit?.costs || {};
  const fixedItems = costs.fixed_items || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* ── CONTROL BAR ── */}
      <div className={`flex flex-wrap justify-between items-center ${t.card} border p-5 rounded-[2rem] gap-4`}>
        <div>
          <h3 className="text-sm font-black uppercase italic tracking-tighter text-yellow-500">Financial Audit Mode</h3>
          <p className={`text-[10px] font-bold uppercase ${t.subtext}`}>Monitoring Accountant Submissions</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-black/20 rounded-xl p-1 border border-white/5">
            <button onClick={() => setMonthOffset(o => o - 1)} className="p-2 hover:text-yellow-500 transition-colors"><ChevronLeft size={16}/></button>
            <span className="text-[10px] font-black uppercase px-4 min-w-[120px] text-center">{monthLabel(month)}</span>
            <button onClick={() => setMonthOffset(o => Math.min(o + 1, 0))} disabled={monthOffset >= 0} className="p-2 disabled:opacity-20 hover:text-yellow-500 transition-colors"><ChevronRight size={16}/></button>
          </div>
          
          <button 
            onClick={handleDownloadPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-2 px-5 py-3 bg-white text-black rounded-2xl font-black uppercase italic text-[10px] hover:bg-yellow-500 transition-all active:scale-95 disabled:opacity-50">
            {isExportingPDF ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
            {isExportingPDF ? "Generating PDF..." : "Download PDF Report"}
          </button>
        </div>
      </div>

      {/* ── P&L SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className={`${t.card} border p-6 rounded-[2rem] relative overflow-hidden`}>
          <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-1">Monthly Net Margin</p>
          <h4 className={`text-5xl font-black italic ${profit?.margin_pct >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {profitLoad ? "..." : `${profit?.margin_pct || 0}%`}
          </h4>
          <p className="text-[10px] font-bold text-zinc-400 mt-2 uppercase">UGX {Number(profit?.net_profit || 0).toLocaleString()} Profit</p>
        </div>

        <div className={`${t.card} border p-6 rounded-[2rem] space-y-3`}>
          <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Revenue Breakdown</p>
          <FinanceRow label="Gross Sales" value={profit?.sales?.total_gross} color="text-white" bold />
          <FinanceRow label="Total MoMo" value={profit?.sales?.total_momo} color="text-yellow-500" />
          <FinanceRow label="Total Cash" value={profit?.sales?.total_cash} color="text-emerald-500" />
        </div>

        <div className={`${t.card} border p-6 rounded-[2rem] space-y-3`}>
          <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Cost Summary</p>
          <FinanceRow label="Fixed Expenses" value={costs.fixed_total} color="text-rose-400" />
          <FinanceRow label="Petty Cash Out" value={costs.petty_out} color="text-orange-400" />
          <div className="pt-2 border-t border-white/5">
            <FinanceRow label="Total Expenses" value={costs.total} color="text-rose-500" bold />
          </div>
        </div>
      </div>

      {/* ── ACCOUNTANT'S COST LEDGER (The "Display" Section) ── */}
      <div className={`${t.card} border rounded-[2.5rem] overflow-hidden`}>
        <div className="px-8 py-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
          <div>
            <h3 className="text-xs font-black uppercase tracking-tighter">Verified Monthly Expenses</h3>
            <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">Audit trail of costs entered by accounting staff</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <span className="text-[8px] font-black text-emerald-500 uppercase">Live Records</span>
          </div>
        </div>

        <div className="p-6">
          {profitLoad ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />)}
            </div>
          ) : fixedItems.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
              <p className="text-[10px] font-black uppercase text-zinc-600 italic">No costs submitted for {monthLabel(month)}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fixedItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-5 bg-black/40 border border-white/5 rounded-2xl hover:bg-black/60 transition-colors">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">{item.category}</p>
                    <p className="text-xs font-bold text-white mt-0.5 truncate">{item.description || "No description provided"}</p>
                    <p className="text-[8px] text-zinc-600 mt-2 font-black uppercase">Staff: {item.entered_by || "System"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-rose-400 italic">UGX {Number(item.amount).toLocaleString()}</p>
                    <p className="text-[7px] text-zinc-700 uppercase font-black">Verified Cost</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals Footer */}
        {!profitLoad && fixedItems.length > 0 && (
          <div className="px-8 py-4 bg-zinc-900/50 border-t border-white/5 flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-zinc-500">Subtotal for {monthLabel(month)}</span>
            <span className="text-xl font-black text-rose-500 italic">UGX {Number(costs.fixed_total || 0).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}