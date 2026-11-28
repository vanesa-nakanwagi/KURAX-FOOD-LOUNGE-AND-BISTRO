const COMPLETED_TICKET_STATUSES = new Set(["ready", "served", "paid", "closed"]);

function kampalaDateOf(value) {
  if (!value) return null;

  const dateOnly = typeof value === "string" && value.trim().match(/^\d{4}-\d{2}-\d{2}$/);
  if (dateOnly) return dateOnly[0];

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" }).format(date);
}

export function isCompletedTicket(ticket) {
  return COMPLETED_TICKET_STATUSES.has(String(ticket?.status || "").trim().toLowerCase());
}

export function isCompletedTodayTicket(ticket, today) {
  if (!isCompletedTicket(ticket)) return false;

  const status = String(ticket.status || "").trim().toLowerCase();
  const completedAt = ticket.ready_at || (status === "ready" ? null : ticket.updated_at);
  const completedDate = kampalaDateOf(completedAt) || kampalaDateOf(ticket.ticket_date);

  return completedDate === today;
}
