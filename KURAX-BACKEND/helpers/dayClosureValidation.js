function isNonNegativeCount(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return false;
  if (typeof value === 'string' && !value.trim()) return false;
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}

export function hasValidRetrospectiveCounts({ final_cash, final_card, final_mtn, final_airtel, notes } = {}) {
  return [final_cash, final_card, final_mtn, final_airtel].every(isNonNegativeCount)
    && typeof notes === 'string'
    && Boolean(notes.trim());
}
