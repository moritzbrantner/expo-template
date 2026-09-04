export const WARDROBE_CATEGORIES = [
  'tops',
  'bottoms',
  'outerwear',
  'one-piece',
  'footwear',
  'accessories',
] as const;

export const WARDROBE_SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

export const WARDROBE_OCCASIONS = [
  'everyday',
  'work',
  'formal',
  'sport',
  'outdoor',
  'home',
  'travel',
] as const;

export const WARDROBE_FORMALITY_LEVELS = [
  'casual',
  'smart-casual',
  'business',
  'formal',
] as const;

export const WARDROBE_FITS = ['slim', 'regular', 'relaxed', 'oversized'] as const;

export type WardrobeCategory = (typeof WARDROBE_CATEGORIES)[number];
export type WardrobeSeason = (typeof WARDROBE_SEASONS)[number];
export type WardrobeOccasion = (typeof WARDROBE_OCCASIONS)[number];
export type WardrobeFormality = (typeof WARDROBE_FORMALITY_LEVELS)[number];
export type WardrobeFit = (typeof WARDROBE_FITS)[number];

export type WardrobePhoto = {
  uri: string;
  kind: 'managed-file' | 'inline-data';
};

export type WardrobeItem = {
  id: string;
  name: string;
  category: WardrobeCategory;
  color: string;
  photo: WardrobePhoto | null;
  materials: string[];
  seasons: WardrobeSeason[];
  occasions: WardrobeOccasion[];
  formality: WardrobeFormality | null;
  fit: WardrobeFit | null;
  tags: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type WardrobeDraft = Pick<WardrobeItem, 'name' | 'category' | 'color' | 'notes'> & {
  photo?: WardrobePhoto | null;
  materials?: readonly string[];
  seasons?: readonly WardrobeSeason[];
  occasions?: readonly WardrobeOccasion[];
  formality?: WardrobeFormality | null;
  fit?: WardrobeFit | null;
  tags: readonly string[];
};

export type WardrobePatch = Partial<WardrobeDraft>;
export type WardrobeFilterCategory = WardrobeCategory | 'all';

type StoredWardrobeItem = Omit<
  WardrobeItem,
  'photo' | 'materials' | 'seasons' | 'occasions' | 'formality' | 'fit'
> &
  Partial<
    Pick<WardrobeItem, 'photo' | 'materials' | 'seasons' | 'occasions' | 'formality' | 'fit'>
  >;

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

export function parseList(value: string) {
  return normalizeTags(value.split(','));
}

export function parseTags(value: string) {
  return parseList(value);
}

function normalizeEnumList<T extends string>(values: readonly T[] | undefined, allowed: readonly T[]) {
  const normalized: T[] = [];
  const seen = new Set<T>();

  for (const value of values ?? []) {
    if (!allowed.includes(value) || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

function normalizeOptionalEnum<T extends string>(value: T | null | undefined, allowed: readonly T[]) {
  if (value === null || value === undefined) {
    return null;
  }
  if (!allowed.includes(value)) {
    throw new Error(`Wardrobe attribute value is invalid: ${value}`);
  }
  return value;
}

function isWardrobePhoto(value: unknown): value is WardrobePhoto {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const photo = value as Partial<WardrobePhoto>;
  if (photo.kind === 'managed-file') {
    return typeof photo.uri === 'string' && photo.uri.startsWith('file://');
  }
  if (photo.kind === 'inline-data') {
    return typeof photo.uri === 'string' && photo.uri.startsWith('data:image/');
  }
  return false;
}

function normalizePhoto(value: WardrobePhoto | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isWardrobePhoto(value)) {
    throw new Error('Wardrobe photo reference is invalid.');
  }
  return { ...value };
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
    photo: normalizePhoto(draft.photo),
    materials: normalizeTags(draft.materials ?? []),
    seasons: normalizeEnumList(draft.seasons, WARDROBE_SEASONS),
    occasions: normalizeEnumList(draft.occasions, WARDROBE_OCCASIONS),
    formality: normalizeOptionalEnum(draft.formality, WARDROBE_FORMALITY_LEVELS),
    fit: normalizeOptionalEnum(draft.fit, WARDROBE_FITS),
    tags: normalizeTags(draft.tags),
    notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateWardrobeItem(
  item: WardrobeItem,
  patch: WardrobePatch,
  now = new Date(),
): WardrobeItem {
  const updated = createWardrobeItem(
    {
      name: patch.name ?? item.name,
      category: patch.category ?? item.category,
      color: patch.color ?? item.color,
      photo: patch.photo === undefined ? item.photo : patch.photo,
      materials: patch.materials ?? item.materials,
      seasons: patch.seasons ?? item.seasons,
      occasions: patch.occasions ?? item.occasions,
      formality: patch.formality === undefined ? item.formality : patch.formality,
      fit: patch.fit === undefined ? item.fit : patch.fit,
      tags: patch.tags ?? item.tags,
      notes: patch.notes ?? item.notes,
    },
    item.id,
    now,
  );

  return {
    ...updated,
    createdAt: item.createdAt,
  };
}

function isWardrobeCategory(value: unknown): value is WardrobeCategory {
  return (
    typeof value === 'string' && WARDROBE_CATEGORIES.includes(value as WardrobeCategory)
  );
}

function isEnumList<T extends string>(value: unknown, allowed: readonly T[]) {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every((entry) => typeof entry === 'string' && allowed.includes(entry as T)))
  );
}

function isOptionalEnum<T extends string>(value: unknown, allowed: readonly T[]) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && allowed.includes(value as T))
  );
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isStoredWardrobeItem(value: unknown): value is StoredWardrobeItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<StoredWardrobeItem>;
  return (
    typeof item.id === 'string' &&
    normalizeWardrobeText(item.id).length > 0 &&
    typeof item.name === 'string' &&
    normalizeWardrobeText(item.name).length > 0 &&
    isWardrobeCategory(item.category) &&
    typeof item.color === 'string' &&
    normalizeWardrobeText(item.color).length > 0 &&
    (item.photo === undefined || item.photo === null || isWardrobePhoto(item.photo)) &&
    (item.materials === undefined ||
      (Array.isArray(item.materials) && item.materials.every((material) => typeof material === 'string'))) &&
    isEnumList(item.seasons, WARDROBE_SEASONS) &&
    isEnumList(item.occasions, WARDROBE_OCCASIONS) &&
    isOptionalEnum(item.formality, WARDROBE_FORMALITY_LEVELS) &&
    isOptionalEnum(item.fit, WARDROBE_FITS) &&
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

    return parsed.filter(isStoredWardrobeItem).map((item) => ({
      ...item,
      id: normalizeWardrobeText(item.id),
      name: normalizeWardrobeText(item.name),
      color: normalizeWardrobeText(item.color).toLocaleLowerCase(),
      photo: item.photo ? { ...item.photo } : null,
      materials: normalizeTags(item.materials ?? []),
      seasons: normalizeEnumList(item.seasons, WARDROBE_SEASONS),
      occasions: normalizeEnumList(item.occasions, WARDROBE_OCCASIONS),
      formality: item.formality ?? null,
      fit: item.fit ?? null,
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

    return [
      item.name,
      item.category,
      item.color,
      item.materials.join(' '),
      item.seasons.join(' '),
      item.occasions.join(' '),
      item.formality ?? '',
      item.fit ?? '',
      item.tags.join(' '),
      item.notes,
    ]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
}
