function parseItems(items) {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function itemKey(item) {
  const station = String(item.station || '').trim().toLowerCase();
  return [
    item.id ?? '',
    item.type ?? '',
    item.name ?? '',
    station === 'bar' ? 'barman' : station,
    item.assignedTo ?? item.assigned_to ?? '',
    item.note ?? item.instructions ?? '',
  ].map((value) => String(value).trim().toLowerCase()).join('|');
}

export function getRoutableStationItems(ticketItems, orderItems) {
  const sourceItems = parseItems(orderItems);
  const routableItems = sourceItems
    .map((item, index) => ({ item, index, used: false }))
    .filter(({ item }) => item.payment_confirmed === true || item.station_routing_requested === true);

  return parseItems(ticketItems).filter((ticketItem) => {
    const sourceIndex = ticketItem._orderItemIndex;
    if (Number.isInteger(sourceIndex) && sourceIndex >= 0 && sourceItems[sourceIndex]) {
      const match = routableItems.find(({ index, used }) => index === sourceIndex && !used);
      if (!match) return false;
      match.used = true;
      return true;
    }

    const key = itemKey(ticketItem);
    const match = routableItems.find(({ item, used }) => !used && itemKey(item) === key);
    if (!match) return false;
    match.used = true;
    return true;
  });
}

export function getAssignedStationItems(ticketItems) {
  return parseItems(ticketItems).filter((item) => (
    Boolean(String(item.assignedTo ?? item.assigned_to ?? '').trim())
  ));
}

export function getStationItemsTotal(items) {
  return items.reduce((total, item) => (
    total + (Number(item.price || item.unit_price) || 0) * (Number(item.quantity) || 1)
  ), 0);
}
