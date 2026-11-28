function getCreditOwnerName(credit) {
  return String(credit?.owner_name || credit?.waiter_name || credit?.requested_by || "").trim().toLowerCase();
}

export function filterCreditsForStaff(credits = [], staffName, staffId) {
  const ownerName = String(staffName || "").trim().toLowerCase();
  const ownerId = staffId == null || staffId === "" ? "" : String(staffId);
  if ((!ownerName && !ownerId) || !Array.isArray(credits)) return [];
  return credits.filter(credit => {
    const creditOwnerId = credit?.owner_staff_id;
    if (ownerId !== "" && creditOwnerId != null && creditOwnerId !== "") {
      return String(creditOwnerId) === ownerId;
    }
    return ownerName !== "" && getCreditOwnerName(credit) === ownerName;
  });
}

export function summarizeCredits(credits = []) {
  const summary = {
    settled: { count: 0, amount: 0 },
    outstanding: { count: 0, amount: 0 },
    total: credits.length,
    totalAmount: 0,
  };

  credits.forEach(credit => {
    const amount = Math.max(0, Number(credit?.amount) || 0);
    const amountPaid = Math.max(0, Number(credit?.amount_paid) || 0);
    const parsedBalance = Number(credit?.balance);
    const balance = Math.max(
      0,
      credit?.balance != null && Number.isFinite(parsedBalance)
        ? parsedBalance
        : amount - amountPaid
    );
    const status = String(credit?.status || "").trim().toLowerCase();

    summary.totalAmount += amount;

    if (status === "rejected") return;

    if (status === "fullysettled" || status === "fully_settled") {
      summary.settled.count += 1;
      summary.settled.amount += amountPaid || amount;
    } else {
      summary.outstanding.count += 1;
      summary.outstanding.amount += balance;
      if (status === "partiallysettled" || status === "partially_settled") {
        summary.settled.count += 1;
        summary.settled.amount += amountPaid;
      }
    }
  });

  return summary;
}

function formatBusinessDate(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function buildCreditChartData(credits = [], selectedBusinessDate) {
  const baseDate = new Date(`${selectedBusinessDate}T12:00:00Z`);
  if (Number.isNaN(baseDate.getTime()) || !Array.isArray(credits)) return [];

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(baseDate);
    date.setUTCDate(baseDate.getUTCDate() - (6 - index));
    const dateString = date.toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Kampala",
      day: "2-digit",
      month: "short",
    }).format(date);
    let Settled = 0;
    let Approved = 0;
    let Rejected = 0;
    let Outstanding = 0;

    credits.forEach(credit => {
      const creditDate = formatBusinessDate(credit.business_date || credit.created_at);
      const amount = Math.max(0, Number(credit.amount) || 0);
      const amountPaid = Math.max(0, Number(credit.amount_paid) || 0);
      const balanceValue = Number(credit.balance);
      const balance = Math.max(
        0,
        credit.balance != null && Number.isFinite(balanceValue)
          ? balanceValue
          : amount - amountPaid
      );
      const status = String(credit.status || "").toLowerCase().replace(/[_\s]/g, "");
      const settlements = Array.isArray(credit.settlements) ? credit.settlements : [];

      if (settlements.length > 0) {
        settlements.forEach(settlement => {
          if (formatBusinessDate(settlement.business_date || settlement.created_at) === dateString) {
            Settled += Math.max(0, Number(settlement.amount_paid) || 0);
          }
        });
      } else if (creditDate === dateString && (status === "fullysettled" || status === "partiallysettled")) {
        Settled += amountPaid || (status === "fullysettled" ? amount : 0);
      }

      if (creditDate !== dateString) return;
      if (status === "fullysettled") return;
      if (status === "partiallysettled") {
        Outstanding += balance;
      } else if (status === "approved") {
        Approved += balance;
        Outstanding += balance;
      } else if (status === "rejected") {
        Rejected += amount;
      } else {
        Outstanding += balance || amount;
      }
    });

    return { date: label, Settled, Approved, Rejected, Outstanding };
  });
}
