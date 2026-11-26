export function getDrinkStationLabel(item) {
  if (String(item?.category || '').trim().toLowerCase() !== 'drinks & cocktails') return '';

  const station = String(item?.station || '').trim().toLowerCase();
  if (station === 'barista') return 'BARISTA';
  if (station === 'bar' || station === 'barman') return 'BAR';
  return '';
}
