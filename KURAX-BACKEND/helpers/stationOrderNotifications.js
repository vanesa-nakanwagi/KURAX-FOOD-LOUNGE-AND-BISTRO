import { getRoutableItemsForStation } from './stationOrderTickets.js';

const STATION_NOTIFICATIONS = [
  {
    station: 'kitchen',
    roles: ['KITCHEN_HOD', 'CHEF'],
    type: 'KITCHEN_ORDER',
    title: 'New Kitchen Order',
    department: 'Kitchen',
    link: (orderId) => `/kitchen?order=${orderId}`,
  },
  {
    station: 'bar',
    roles: ['BAR_HOD', 'BARMAN'],
    type: 'BAR_ORDER',
    title: 'New Bar Order',
    department: 'Bar',
    link: (orderId) => `/barman?order=${orderId}`,
  },
  {
    station: 'barista',
    roles: ['BARISTA_HOD', 'BARISTA'],
    type: 'BARISTA_ORDER',
    title: 'New Barista Order',
    department: 'Barista',
    link: (orderId) => `/barista?order=${orderId}`,
  },
];

export function buildStationOrderNotifications(orderId, items, orderReference = null) {
  return STATION_NOTIFICATIONS
    .filter(({ station }) => getRoutableItemsForStation(items, station).length > 0)
    .map(({ station, roles, type, title, department, link }) => ({
      station,
      roles,
      event: {
        type,
        title,
        body: orderReference
          ? `Website order ${orderReference} requires preparation.`
          : `Order #${orderId} requires preparation.`,
        department,
        referenceId: orderId,
        link: link(orderId),
      },
    }));
}
