export function isShishaInventoryItem(item = {}) {
  const station = String(item.station || '').trim().toLowerCase();
  const category = String(item.category || '').trim().toLowerCase();
  return station === 'shisha' || category === 'shisha';
}

export function shishaInventoryFilterSql(alias = 'ii') {
  return `
    LOWER(COALESCE(${alias}.station, '')) <> 'shisha'
    AND LOWER(COALESCE(${alias}.category, '')) <> 'shisha'
  `;
}
