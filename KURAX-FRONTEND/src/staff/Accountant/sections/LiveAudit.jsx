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
  isDark = false
}) {
  const textClass = "text-gray-900";
  const subTextClass = "text-gray-500";
  
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
     <div className="flex items-center justify-between w-full gap-4">
        <div>
          <h2 className={`text-2xl font-medium text-yellow-900 uppercase leading-none ${textClass}`}>
            Live Audit
          </h2>
          <p className="text-zinc-600 text-[13px] font-medium mt-1 italic">
            Void requests from waiters, approve or reject
          </p>
        </div>
        <button onClick={() => { loadVoidRequests(); loadVoidHistory(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase transition-all duration-300
            bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-200`}>
          <RefreshCw size={12} className={voidRequestsLoading ? "animate-spin" : ""}/> Refresh
        </button>
      </div>

      <div>
        <p className="text-[9px] font-black uppercase text-yellow-900 tracking-[0.2em] mb-3 flex items-center gap-2">
          <AlertTriangle size={10} className="text-rose-500"/>
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
              <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse border border-gray-200"/>
            ))}
          </div>
        ) : voidRequests.length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50">
            <CheckCircle2 size={28} className="mx-auto text-gray-400 mb-3"/>
            <p className="text-gray-500 font-black uppercase text-[10px] tracking-widest italic">No pending void requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {voidRequests.map(vr => (
              <div key={vr.id}
                className="bg-rose-50 border border-rose-200 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-300 hover:shadow-md">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center text-rose-500 shrink-0">
                    <AlertTriangle size={18}/>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-black text-gray-900 uppercase text-sm italic">{vr.item_name}</p>
                      {vr.table_name && (
                        <span className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600 text-[9px] font-black uppercase border border-gray-200">
                          {vr.table_name}
                        </span>
                      )}
                      {vr.chef_name && vr.chef_name !== 'Not assigned' && (
                        <span className="px-2 py-0.5 rounded-lg bg-orange-100 text-orange-600 text-[8px] font-black uppercase border border-orange-200">
                          Chef: {vr.chef_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-[10px] text-gray-500">
                      <span>Waiter: <span className="text-gray-900 font-bold">{vr.waiter_name || vr.requested_by}</span></span>
                      {vr.chef_name && vr.chef_name !== 'Not assigned' && (
                        <span>· Chef: <span className="text-yellow-600 font-bold">{vr.chef_name}</span></span>
                      )}
                      <span className="text-gray-400">
                        {new Date(vr.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                      </span>
                    </div>
                    <p className="text-[10px] text-rose-600 italic mt-0.5">"{vr.reason}"</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => approveVoid(vr.id)}
                    className="bg-rose-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase hover:bg-rose-700 transition-all duration-300 hover:scale-105 shadow-sm">
                    Approve
                  </button>
                  <button onClick={() => rejectVoid(vr.id)}
                    className="bg-gray-100 text-gray-600 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase border border-gray-200 hover:bg-gray-200 transition-all duration-300">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-gray-200">
        <p className="text-[9px] font-black uppercase text-yellow-900 tracking-[0.2em] mb-3 flex items-center gap-2">
          <ClipboardList size={10} className="text-gray-500"/>
          Today's Resolved Voids
          {voidHistory.length > 0 && (
            <span className="bg-gray-200 text-gray-700 text-[8px] font-black px-1.5 py-0.5 rounded-full">
              {voidHistory.length}
            </span>
          )}
        </p>

        {voidHistoryLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_,i) => (
              <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse border border-gray-200"/>
            ))}
          </div>
        ) : voidHistory.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-gray-200 rounded-2xl bg-gray-50">
            <p className="text-gray-500 font-black uppercase text-[9px] tracking-widest">No resolved voids today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {voidHistory.map(vr => (
              <div key={vr.id}
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 flex-wrap transition-all duration-300
                  ${vr.status === 'Approved'
                    ? 'bg-rose-50 border-rose-200'
                    : vr.status === 'Rejected'
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[11px] font-black
                    ${vr.status === 'Approved' ? 'bg-rose-100 text-rose-600' : 'bg-gray-200 text-gray-500'}`}>
                    {vr.status === 'Approved' ? '✓' : '✕'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[11px] font-black text-gray-900 uppercase">{vr.item_name}</p>
                      {vr.table_name && (
                        <span className="text-[8px] font-black text-gray-500 uppercase">{vr.table_name}</span>
                      )}
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg uppercase
                        ${vr.status === 'Approved'
                          ? 'bg-rose-100 text-rose-600'
                          : vr.status === 'Rejected'
                          ? 'bg-gray-200 text-gray-600'
                          : 'bg-gray-100 text-gray-500'}`}>
                        {vr.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[9px] text-gray-500 mt-0.5">
                      <span>Waiter: <span className="text-gray-700">{vr.waiter_name || vr.requested_by}</span></span>
                      {vr.chef_name && (
                        <span>· Chef: <span className="text-yellow-600">{vr.chef_name}</span></span>
                      )}
                    </div>
                    <p className="text-[8px] text-gray-500 italic mt-0.5">"{vr.reason}"</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {vr.resolved_by && (
                    <p className="text-[9px] font-black text-gray-500 uppercase">by {vr.resolved_by}</p>
                  )}
                  <p className="text-[8px] text-gray-400">
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