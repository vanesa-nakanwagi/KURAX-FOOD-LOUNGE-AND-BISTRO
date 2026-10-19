const MAX_ITEM_QUANTITY = 50;

export function normalizePublicCustomer(customer = {}) {
  if (!customer || typeof customer !== 'object' || Array.isArray(customer)) customer = {};
  const firstName = String(customer.firstName || '').trim();
  const lastName = String(customer.lastName || '').trim();
  const name = `${firstName} ${lastName}`.trim();
  const email = String(customer.email || '').trim().toLowerCase();
  const mobileMoneyNumber = String(customer.mobileMoneyNumber || '').trim();
  const provider = String(customer.paymentProvider || '').trim().toUpperCase();
  const deliveryType = String(customer.deliveryType || '').trim();
  const city = String(customer.city || '').trim();
  const locationDesc = String(customer.locationDesc || '').trim();

  if (!firstName || !lastName || name.length > 120) {
    throw Object.assign(new Error('First and last name are required.'), { statusCode: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw Object.assign(new Error('A valid email address is required.'), { statusCode: 400 });
  }
  if (!/^\+?[0-9][0-9\s()-]{6,18}$/.test(mobileMoneyNumber)) {
    throw Object.assign(new Error('Enter a valid mobile money number.'), { statusCode: 400 });
  }
  if (!['MTN', 'AIRTEL'].includes(provider)) {
    throw Object.assign(new Error('Select MTN or Airtel Mobile Money.'), { statusCode: 400 });
  }
  if (!['Home', 'Store'].includes(deliveryType)) {
    throw Object.assign(new Error('Select home delivery or store pickup.'), { statusCode: 400 });
  }
  if (!city || city.length > 120) {
    throw Object.assign(new Error('A valid city or town is required.'), { statusCode: 400 });
  }
  if (!locationDesc || locationDesc.length > 500) {
    throw Object.assign(new Error('An exact delivery location is required (maximum 500 characters).'), { statusCode: 400 });
  }

  return {
    customerName: name,
    customerEmail: email,
    mobileMoneyNumber,
    paymentProvider: provider,
    deliveryType,
    city,
    locationDesc,
  };
}

export async function buildPublicOrderItems(items, findCatalogItem) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
    throw Object.assign(new Error('Add between 1 and 30 items to your order.'), { statusCode: 400 });
  }

  const pricedItems = [];
  for (const item of items) {
    const type = item?.type === 'combo' || item?.combo_id ? 'combo' : 'menu';
    const rawId = type === 'combo' ? item?.combo_id ?? item?.id : item?.id;
    const idText = String(rawId ?? '').replace(/^combo-/, '');
    const quantity = Number(item?.quantity);

    if (!/^\d+$/.test(idText) || Number(idText) <= 0) {
      throw Object.assign(new Error('An item in the order is invalid.'), { statusCode: 400 });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      throw Object.assign(new Error('Item quantities must be whole numbers from 1 to 50.'), { statusCode: 400 });
    }

    const isCombo = type === 'combo';
    const catalogItem = await findCatalogItem(type, Number(idText));
    if (!catalogItem) {
      throw Object.assign(new Error('An item in your order is no longer available.'), { statusCode: 400 });
    }

    const price = Number(catalogItem.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw Object.assign(new Error(`The price for ${catalogItem.name} is invalid.`), { statusCode: 400 });
    }

    pricedItems.push({
      id: Number(catalogItem.id),
      ...(isCombo ? { combo_id: Number(catalogItem.id), type: 'combo' } : { type: 'menu' }),
      name: catalogItem.name,
      price,
      quantity,
      station: catalogItem.station || 'Kitchen',
      category: catalogItem.category || '',
      instructions: String(item?.instructions || '').trim().slice(0, 500),
      status: 'Pending',
    });
  }

  return pricedItems;
}

export function calculatePublicOrderTotal(items) {
  return Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
}

export function markPublicOrderItemsPaid(items, paymentMethod, paidAt = new Date()) {
  return items.map((item) => ({
    ...item,
    _rowPaid: true,
    payment_confirmed: true,
    payment_method: paymentMethod,
    paid_at: paidAt.toISOString(),
  }));
}

export function groupPublicOrderItemsByStation(items) {
  const grouped = { kitchen: [], barman: [], barista: [] };
  for (const item of items) {
    const station = String(item.station || 'Kitchen').trim().toLowerCase();
    if (station === 'shisha') {
      throw Object.assign(new Error('Website orders cannot currently be sent to the shisha station.'), { statusCode: 400 });
    }
    const target = station === 'barman' || station === 'bar'
      ? 'barman'
      : station === 'barista'
        ? 'barista'
        : 'kitchen';
    grouped[target].push({
      ...item,
      station: target === 'barman' ? 'Barman' : target === 'barista' ? 'Barista' : 'Kitchen',
      note: item.instructions || item.note || '',
    });
  }
  return grouped;
}
