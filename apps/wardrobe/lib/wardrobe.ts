export const WARDROBE_CATEGORIES = [
  'tops',
  'bottoms',
  'outerwear',
  'one-piece',
  'footwear',
  'accessories',
] as const;

export type WardrobeCategory = (typeof WARDROBE_CATEGORIES)[number];

export type WardrobeItem = {
  id: string;
  name: string;
  category: WardrobeCategory;
  color: string;
  tags: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type WardrobeDraft = Pick<WardrobeItem, 'name' | 'category' | 'color' | 'notes'> & {
  tags: readonly string[];
};

export type WardrobeFilterCategory = WardrobeCategory | 'all';

export function normalizeWardrobeText(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

export function normalizeTags(values: readonly string[]) {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const tag = normalizeWardrobeText(value).toLocaleLowerCase();
    if (!tag || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    normalized.push(tag);
  }

  return normalized;
}

export function parseTags(value: string) {
  return normalizeTags(value.split(','));
}

export function createWardrobeItem(
  draft: WardrobeDraft,
  id: string,
  now = new Date(),
): WardrobeItem {
  const name = normalizeWardrobeText(draft.name);
  const color = normalizeWardrobeText(draft.color).toLocaleLowerCase();
  const notes = draft.notes.trim();
  const normalizedId = normalizeWardrobeText(id);

  if (!name) {
    throw new Error('Wardrobe item name cannot be empty.');
  }
  if (!normalizedId) {
    throw new Error('Wardrobe item id cannot be empty.');
  }
  if (!WARDROBE_CATEGORIES.includes(draft.category)) {
    throw new Error('Wardrobe item category is invalid.');
  }
  if (!color) {
    throw new Error('Wardrobe item color cannot be empty.');
  }

  const timestamp = now.toISOString();
  return {
    id: normalizedId,
    name,
    category: draft.category,
    color,
    tags: normalizeTags(draft.tags),
    notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function isWardrobeCategory(value: unknown): value is WardrobeCategory {
  return typeof value === 'string' &&
    WARDROBE_CATEGORIES.includes(value as WardrobeCategory);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isWardrobeItem(value: unknown): value is WardrobeItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<WardrobeItem>;
  return (
    typeof item.id === 'string' &&
    normalizeWardrobeText(item.id).length > 0 &&
    typeof item.name === 'string' &&
    normalizeWardrobeText(item.name).length > 0 &&
    isWardrobeCategory(item.category) &&
    typeof item.color === 'string' &&
    normalizeWardrobeText(item.color).length > 0 &&
    Array.isArray(item.tags) &&
    item.tags.every((tag) => typeof tag === 'string') &&
    typeof item.notes === 'string' &&
    isIsoTimestamp(item.createdAt) &&
    isIsoTimestamp(item.updatedAt)
  );
}

export function deserializeWardrobeItems(value: string | null): WardrobeItem[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isWardrobeItem).map((item) => ({
      ...item,
      id: normalizeWardrobeText(item.id),
      name: normalizeWardrobeText(item.name),
      color: normalizeWardrobeText(item.color).toLocaleLowerCase(),
      tags: normalizeTags(item.tags),
      notes: item.notes.trim(),
    }));
  } catch {
    return [];
  }
}

export function filterWardrobeItems(
  items: readonly WardrobeItem[],
  query: string,
  category: WardrobeFilterCategory,
) {
  const normalizedQuery = normalizeWardrobeText(query).toLocaleLowerCase();

  return items.filter((item) => {
    if (category !== 'all' && item.category !== category) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }

    return [item.name, item.category, item.color, item.tags.join(' '), item.notes]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
}
