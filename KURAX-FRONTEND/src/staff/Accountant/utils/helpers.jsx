export function toLocalDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
}

export function kampalaDate(d = new Date()) {
  return new Date(d.toLocaleString("en-US", { timeZone: "Africa/Nairobi" }))
    .toISOString().split("T")[0];
}

export function fmt(n) { 
  return Number(n || 0).toLocaleString(); 
}

export function formatCurrencyCompact(n) {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `UGX ${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `UGX ${(num / 1_000).toFixed(0)}K`;
  return `UGX ${num.toLocaleString()}`;
}

export function getCreditStatus(credit) {
  const status = credit.status;
  if (status === "FullySettled") return "settled";
  if (status === "PartiallySettled") return "settled";
  if (status === "Approved") return "approved";
  if (status === "PendingManager") return "pendingManager";
  if (status === "PendingCashier") return "pendingCashier";
  if (status === "Rejected") return "rejected";
  if (credit.paid === true || credit.paid === "t" || credit.paid === "true") return "settled";
  return "outstanding";
}

export const forceHardRefresh = () => {
  console.log("Performing hard refresh to clear all totals...");
  
  const userData = localStorage.getItem("kurax_user");
  localStorage.clear();
  if (userData) localStorage.setItem("kurax_user", userData);
  
  sessionStorage.clear();
  
  document.cookie.split(";").forEach(function(c) {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
  
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
  
  window.location.href = window.location.pathname + '?refresh=' + Date.now();
};