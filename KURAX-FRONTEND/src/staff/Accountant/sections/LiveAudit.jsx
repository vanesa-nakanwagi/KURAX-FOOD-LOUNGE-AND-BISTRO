import React from "react";
import { RefreshCw, AlertTriangle, CheckCircle2, ClipboardList, XCircle } from "lucide-react";

export default function LiveAudit({ 
  voidRequests,
  voidRequestsLoading,
  voidHistory,
  voidHistoryLoading,
  approveVoid,
  rejectVoid,
  loadVoidRequests,
  loadVoidHistory,
  isDark
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className={`text-2xl font-black uppercase leading-none transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Live Audit
          </h2>
          <p className="text-yellow-600 text-[13px] font-medium mt-1 italic">
            Void requests from waiters — approve or reject
          </p>
        </div>
        <button onClick={() => { loadVoidRequests(); loadVoidHistory(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase transition-all duration-300
            ${isDark ? 'bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900'}`}>
          <RefreshCw size={12} className={voidRequestsLoading ? "animate-spin" : ""}/> Refresh
        </button>
      </div>

      <div>
        <p className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-3 flex items-center gap-2">
          <AlertTriangle size={10} className="text-rose-400"/>
          Pending Requests
          {voidRequests.length > 0 && (
            <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
              {voidRequests.length}
            </span>
          )}
        </p>

        {voidRequestsLoading && voidRequests.length === 0 ? (
          <div className="space-y-3">
            {[...Array(2)].map((_,i) => (
              <div key={i} className="h-28 rounded-2xl bg-zinc-900/30 animate-pulse border border-white/5"/>
            ))}
          </div>
        ) : voidRequests.length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-3xl bg-zinc-900/10">
            <CheckCircle2 size={28} className="mx-auto text-zinc-700 mb-3"/>
            <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest italic">No pending void requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {voidRequests.map(vr => (
              <div key={vr.id}
                className="bg-gradient-to-r from-rose-500/5 to-transparent border border-rose-500/20 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-rose-500/20 rounded-xl flex items-center justify-center text-rose-400 shrink-0">
                    <AlertTriangle size={18}/>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-black text-white uppercase text-sm italic">{vr.item_name}</p>
                      {vr.table_name && (
                        <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-400 text-[9px] font-black uppercase border border-white/5">
                          {vr.table_name}
                        </span>
                      )}
                      {vr.chef_name && vr.chef_name !== 'Not assigned' && (
                        <span className="px-2 py-0.5 rounded-lg bg-orange-500/20 text-orange-400 text-[8px] font-black uppercase border border-orange-500/20">
                          Chef: {vr.chef_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-[10px] text-zinc-500">
                      <span>Waiter: <span className="text-white font-bold">{vr.waiter_name || vr.requested_by}</span></span>
                      {vr.chef_name && vr.chef_name !== 'Not assigned' && (
                        <span>· Chef: <span className="text-yellow-400 font-bold">{vr.chef_name}</span></span>
                      )}
                      <span className="text-zinc-700">
                        {new Date(vr.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                      </span>
                    </div>
                    <p className="text-[10px] text-rose-400 italic mt-0.5">"{vr.reason}"</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => approveVoid(vr.id)}
                    className="bg-rose-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase hover:bg-rose-500 transition-all duration-300 hover:scale-105">
                    Approve
                  </button>
                  <button onClick={() => rejectVoid(vr.id)}
                    className="bg-zinc-800 text-zinc-400 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase border border-white/5 hover:bg-zinc-700 transition-all duration-300">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-white/5">
        <p className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-3 flex items-center gap-2">
          <ClipboardList size={10} className="text-zinc-400"/>
          Today's Resolved Voids
          {voidHistory.length > 0 && (
            <span className="bg-zinc-700 text-zinc-300 text-[8px] font-black px-1.5 py-0.5 rounded-full">
              {voidHistory.length}
            </span>
          )}
        </p>

        {voidHistoryLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_,i) => (
              <div key={i} className="h-16 rounded-2xl bg-zinc-900/30 animate-pulse border border-white/5"/>
            ))}
          </div>
        ) : voidHistory.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-white/5 rounded-2xl">
            <p className="text-zinc-700 font-black uppercase text-[9px] tracking-widest">No resolved voids today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {voidHistory.map(vr => (
              <div key={vr.id}
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 flex-wrap transition-all duration-300
                  ${vr.status === 'Approved'
                    ? 'bg-rose-500/5 border-rose-500/15'
                    : vr.status === 'Rejected'
                    ? 'bg-zinc-900/20 border-white/5'
                    : 'bg-zinc-900/10 border-white/5 opacity-50'}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[11px] font-black
                    ${vr.status === 'Approved' ? 'bg-rose-500/20 text-rose-400' : 'bg-zinc-800 text-zinc-500'}`}>
                    {vr.status === 'Approved' ? '✓' : '✕'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[11px] font-black text-white uppercase">{vr.item_name}</p>
                      {vr.table_name && (
                        <span className="text-[8px] font-black text-zinc-600 uppercase">{vr.table_name}</span>
                      )}
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg uppercase
                        ${vr.status === 'Approved'
                          ? 'bg-rose-500/10 text-rose-400'
                          : vr.status === 'Rejected'
                          ? 'bg-zinc-700/50 text-zinc-500'
                          : 'bg-zinc-800 text-zinc-600'}`}>
                        {vr.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[9px] text-zinc-600 mt-0.5">
                      <span>Waiter: <span className="text-zinc-400">{vr.waiter_name || vr.requested_by}</span></span>
                      {vr.chef_name && (
                        <span>· Chef: <span className="text-yellow-500/70">{vr.chef_name}</span></span>
                      )}
                    </div>
                    <p className="text-[8px] text-zinc-700 italic mt-0.5">"{vr.reason}"</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {vr.resolved_by && (
                    <p className="text-[9px] font-black text-zinc-500 uppercase">by {vr.resolved_by}</p>
                  )}
                  <p className="text-[8px] text-zinc-700">
                    {vr.resolved_at
                      ? new Date(vr.resolved_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})
                      : new Date(vr.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}