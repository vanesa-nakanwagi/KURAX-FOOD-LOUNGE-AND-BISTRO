const VOLUME_PATTERN = /(\d+(?:[.,]\d+)?)\s*(millilit(?:er|re)s?|ml|lit(?:er|re)s?|l)\b/i;
const VOLUME_TOKEN_PATTERN = /(?:^|[\s([{/-])\d+(?:[.,]\d+)?\s*(?:millilit(?:er|re)s?|ml|lit(?:er|re)s?|l)\b[)\]}]?/gi;

export function extractVolumeMl(value) {
  const match = String(value || '').match(VOLUME_PATTERN);
  if (!match) return 0;
  const amount = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * (/^(?:ml|millilit)/i.test(match[2]) ? 1 : 1000));
}

export function normalizeInventoryProductName(value) {
  return String(value || '')
    .replace(VOLUME_TOKEN_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[([{]+|[)\]}]+$/g, '')
    .replace(/[\s()[\]{}.,;:–—-]+$/g, '')
    .trim()
    .toLowerCase();
}

function isActive(item) {
  return item.is_active === true || item.is_active === 'true';
}

function result(status, candidates = [], inventoryItem = null) {
  return {
    status,
    matchCount: candidates.length,
    inventoryItem,
    inventoryVolumeMl: inventoryItem ? extractVolumeMl(inventoryItem.item_name) : 0,
  };
}

export function matchMenuInventory(menu, inventoryItems) {
  const productName = normalizeInventoryProductName(menu?.name);
  if (!productName) return result('MISSING');

  const candidates = (Array.isArray(inventoryItems) ? inventoryItems : []).filter((item) => (
    isActive(item)
    && normalizeInventoryProductName(item.item_name) === productName
  ));
  if (!candidates.length) return result('MISSING');

  const menuVolumeMl = extractVolumeMl(menu.name);
  let relevantCandidates = candidates;
  if (menuVolumeMl > 0) {
    const sameVolumeCandidates = candidates.filter(
      (item) => extractVolumeMl(item.item_name) === menuVolumeMl
    );
    if (sameVolumeCandidates.length) {
      relevantCandidates = sameVolumeCandidates;
    } else if (candidates.length === 1 && extractVolumeMl(candidates[0].item_name) === 0) {
      relevantCandidates = candidates;
    } else if (candidates.length === 1) {
      return result('VOLUME_MISMATCH', candidates);
    }
  }

  if (relevantCandidates.length > 1) return result('AMBIGUOUS', relevantCandidates);
  return result('MATCHED', relevantCandidates, relevantCandidates[0]);
}

export function getMenuInventoryMatchFields(menu, inventoryItems) {
  const match = matchMenuInventory(menu, inventoryItems);
  const inventoryItem = match.inventoryItem;
  return {
    linked_inventory_item_id: inventoryItem?.id ?? null,
    linked_inventory_item_name: inventoryItem?.item_name ?? null,
    linked_inventory_bottle_volume_ml: match.inventoryVolumeMl || null,
    inventory_match_status: match.status,
    inventory_match_count: match.matchCount,
    stock_available: Boolean(
      inventoryItem
      && isActive(inventoryItem)
      && Number(inventoryItem.current_quantity) > 0
    ),
  };
}
