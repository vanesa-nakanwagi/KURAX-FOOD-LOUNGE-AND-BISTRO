import React from "react";
import { Hourglass, Clock, CheckCircle2, XCircle, BookOpen, User, Phone, Calendar, AlertTriangle } from "lucide-react";
import { fmt, toLocalDateStr, getCreditStatus } from "../utils/helpers";

export default function AccountantCreditRow({ credit }) {
  const status = getCreditStatus(credit);
  const statusConfig = {
    pendingCashier: { label: "Wait for Cashier", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", icon: <Hourglass size={12}/> },
    pendingManager: { label: "Wait for Manager", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", icon: <Clock size={12}/> },
    approved:       { label: "Approved",         color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", icon: <CheckCircle2 size={12}/> },
    settled:        { label: "Settled",          color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 size={12}/> },
    rejected:       { label: "Rejected",         color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",       icon: <XCircle size={12}/> },
    outstanding:    { label: "Outstanding",      color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", icon: <BookOpen size={12}/> },
  };
  const config = statusConfig[status] || statusConfig.outstanding;
  const isSettled = status === "settled";
  const isRejected = status === "rejected";
  const isPartiallySettled = credit.status === "PartiallySettled";
  const remainingBalance = isPartiallySettled ? (Number(credit.amount || 0) - Number(credit.amount_paid || 0)) : 0;

  return (
    <div className={`rounded-2xl border p-5 flex items-start justify-between gap-3 flex-wrap transition-all duration-300 hover:shadow-lg hover:scale-[1.01] ${config.bg}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className=" text-yellow-900 uppercase  tracking-tighter text-lg">{credit.table_name || "Table"}</span>
          <span className={`px-2 py-0.5 rounded-full border ${config.bg} ${config.color} text-[9px] font-black uppercase flex items-center gap-1`}>
            {config.icon} {config.label}
          </span>
          {isPartiallySettled && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[8px] font-black uppercase">
              Partial Payment
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap text-[10px] mb-1">
          {credit.client_name && (
            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
              <User size={10} className="text-zinc-500"/>
              <span className="text-yellow-900 font-bold">{credit.client_name}</span>
            </div>
          )}
          {credit.client_phone && (
            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
              <Phone size={10} className="text-zinc-500"/>
              <span className="text-yellow-900">{credit.client_phone}</span>
            </div>
          )}
          {!isSettled && !isRejected && credit.pay_by && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
              <Calendar size={10} className="text-amber-400"/>
              <span className="text-yellow-00 font-black">Pay by: {credit.pay_by}</span>
            </div>
          )}
          {isRejected && credit.reject_reason && (
            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg">
              <AlertTriangle size={10} className="text-red-400"/>
              <span className="text-red-400 font-black text-[9px]">Reason: {credit.reject_reason}</span>
            </div>
          )}
        </div>
        {(isSettled || isPartiallySettled) && credit.settle_method && (
          <p className="text-[9px] text-zinc-600 mt-1 font-mono">
            {isPartiallySettled ? "Partially settled" : "Settled"} via {credit.settle_method}
            {credit.settle_txn ? ` · TXN: ${credit.settle_txn}` : ""}
            {credit.paid_at    ? ` · ${toLocalDateStr(new Date(credit.paid_at))}` : ""}
          </p>
        )}
        <p className="text-[9px] text-zinc-700 mt-1">
          {credit.approved_by ? `Approved by ${credit.approved_by} · ` : ""}
          {toLocalDateStr(new Date(credit.created_at))}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-2xl font-black  ${config.color}`}>UGX {fmt(credit.amount)}</p>
        {isPartiallySettled && (
          <>
            <p className="text-[9px] text-emerald-400 font-bold mt-0.5">Paid: UGX {fmt(credit.amount_paid)}</p>
            <p className="text-[9px] text-yellow-400 font-bold">Remaining: UGX {fmt(remainingBalance)}</p>
          </>
        )}
        {isSettled && credit.amount_paid && Number(credit.amount_paid) !== Number(credit.amount) && (
          <p className="text-[9px] text-emerald-400 font-bold mt-0.5">Paid: UGX {fmt(credit.amount_paid)}</p>
        )}
      </div>
    </div>
  );
}