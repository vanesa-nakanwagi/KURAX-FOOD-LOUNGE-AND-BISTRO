const STATION_ALIASES = {
  KITCHEN: 'KITCHEN',
  CHEF: 'KITCHEN',
  BAR: 'BAR',
  BARMAN: 'BAR',
  BARISTA: 'BARISTA',
};

export function itemAssignedToStation(assignments, targetStation) {
  const target = STATION_ALIASES[String(targetStation || '').trim().toUpperCase()];
  if (!target) return false;

  return String(assignments || '')
    .split(/[,;|/]+/)
    .some((assignment) => STATION_ALIASES[assignment.trim().toUpperCase()] === target);
}
