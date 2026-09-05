export const BABY_CLOTHING_ENTRY_TYPES = ['single', 'group'] as const;

export const BABY_CLOTHING_CATEGORIES = [
  'bodysuit',
  'sleeper',
  'top',
  'bottom',
  'one-piece',
  'outerwear',
  'dress',
  'socks-tights',
  'hat',
  'bib',
  'shoes',
  'other',
] as const;

export const BABY_CLOTHING_STATUSES = [
  'too-large',
  'in-use',
  'dirty',
  'stored',
  'too-small',
  'donated-sold',
] as const;

export const BABY_CLOTHING_SIZE_PRESETS = [
  { id: '44-50', label: '44–50 cm', minCm: 44, maxCm: 50 },
  { id: '50-56', label: '50–56 cm', minCm: 50, maxCm: 56 },
  { id: '56-62', label: '56–62 cm', minCm: 56, maxCm: 62 },
  { id: '62-68', label: '62–68 cm', minCm: 62, maxCm: 68 },
  { id: '68-74', label: '68–74 cm', minCm: 68, maxCm: 74 },
  { id: '74-80', label: '74–80 cm', minCm: 74, maxCm: 80 },
  { id: '80-86', label: '80–86 cm', minCm: 80, maxCm: 86 },
  { id: '86-92', label: '86–92 cm', minCm: 86, maxCm: 92 },
  { id: '92-98', label: '92–98 cm', minCm: 92, maxCm: 98 },
  { id: '98-104', label: '98–104 cm', minCm: 98, maxCm: 104 },
] as const;

export type BabyClothingEntryType = (typeof BABY_CLOTHING_ENTRY_TYPES)[number];
export type BabyClothingCategory = (typeof BABY_CLOTHING_CATEGORIES)[number];
export type BabyClothingStatus = (typeof BABY_CLOTHING_STATUSES)[number];
export type BabyClothingSizePreset = (typeof BABY_CLOTHING_SIZE_PRESETS)[number];

export type BabyClothingSizeRange = {
  minCm: number;
  maxCm: number;
};

export type BabyClothingPhoto = {
  id: string;
  uri: string;
  kind: 'managed-file' | 'inline-data';
  createdAt: string;
};

export type BabyClothingEntry = {
  id: string;
  name: string;
  category: BabyClothingCategory;
  brand: string;
  color: string;
  originalSizeLabel: string;
  normalizedSize: BabyClothingSizeRange | null;
  entryType: BabyClothingEntryType;
  quantity: number;
  status: BabyClothingStatus;
  photos: BabyClothingPhoto[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type BabyClothingDraft = Pick<
  BabyClothingEntry,
  | 'name'
  | 'category'
  | 'brand'
  | 'originalSizeLabel'
  | 'normalizedSize'
  | 'entryType'
  | 'quantity'
  | 'status'
  | 'notes'
> & {
  color?: string;
  photos: readonly BabyClothingPhoto[];
};

export type BabyClothingPatch = Partial<BabyClothingDraft>;
export type BabyClothingStatusFilter = BabyClothingStatus | 'all';

type StoredBabyClothingEntry = Omit<BabyClothingEntry, 'color'> & { color?: string };

export function normalizeBabyClothingText(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

function normalizeOptionalText(value: string) {
  return normalizeBabyClothingText(value);
}

function normalizeSizeRange(value: BabyClothingSizeRange | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isFinite(value.minCm) || !Number.isFinite(value.maxCm)) {
    throw new Error('Normalized baby clothing size must use finite centimetre values.');
  }

  const minCm = Math.round(value.minCm);
  const maxCm = Math.round(value.maxCm);

  if (minCm < 30 || maxCm > 160 || minCm > maxCm) {
    throw new Error('Normalized baby clothing size range is invalid.');
  }

  return { minCm, maxCm };
}

function normalizeQuantity(entryType: BabyClothingEntryType, quantity: number) {
  if (entryType === 'single') {
    return 1;
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error('Grouped baby clothing quantity must be a positive whole number.');
  }
  return quantity;
}

function isEntryType(value: unknown): value is BabyClothingEntryType {
  return (
    typeof value === 'string' &&
    BABY_CLOTHING_ENTRY_TYPES.includes(value as BabyClothingEntryType)
  );
}

function isCategory(value: unknown): value is BabyClothingCategory {
  return (
    typeof value === 'string' &&
    BABY_CLOTHING_CATEGORIES.includes(value as BabyClothingCategory)
  );
}

function isStatus(value: unknown): value is BabyClothingStatus {
  return (
    typeof value === 'string' && BABY_CLOTHING_STATUSES.includes(value as BabyClothingStatus)
  );
}

function isSizeRange(value: unknown): value is BabyClothingSizeRange {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const range = value as Partial<BabyClothingSizeRange>;
  return (
    typeof range.minCm === 'number' &&
    typeof range.maxCm === 'number' &&
    Number.isFinite(range.minCm) &&
    Number.isFinite(range.maxCm) &&
    range.minCm >= 30 &&
    range.maxCm <= 160 &&
    range.minCm <= range.maxCm
  );
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isPhoto(value: unknown): value is BabyClothingPhoto {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const photo = value as Partial<BabyClothingPhoto>;
  const uriIsValid =
    (photo.kind === 'managed-file' &&
      typeof photo.uri === 'string' &&
      photo.uri.startsWith('file://')) ||
    (photo.kind === 'inline-data' &&
      typeof photo.uri === 'string' &&
      photo.uri.startsWith('data:image/'));

  return (
    typeof photo.id === 'string' &&
    normalizeBabyClothingText(photo.id).length > 0 &&
    uriIsValid &&
    isIsoTimestamp(photo.createdAt)
  );
}

function normalizePhotos(values: readonly BabyClothingPhoto[]) {
  const seen = new Set<string>();
  const photos: BabyClothingPhoto[] = [];

  for (const photo of values) {
    if (!isPhoto(photo)) {
      throw new Error('Baby clothing photo reference is invalid.');
    }
    const id = normalizeBabyClothingText(photo.id);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    photos.push({ ...photo, id });
  }

  return photos;
}

export function createBabyClothingEntry(
  draft: BabyClothingDraft,
  id: string,
  now = new Date(),
): BabyClothingEntry {
  const normalizedId = normalizeBabyClothingText(id);
  const name = normalizeBabyClothingText(draft.name);

  if (!normalizedId) {
    throw new Error('Baby clothing id cannot be empty.');
  }
  if (!name) {
    throw new Error('Baby clothing name cannot be empty.');
  }
  if (!isCategory(draft.category)) {
    throw new Error('Baby clothing category is invalid.');
  }
  if (!isEntryType(draft.entryType)) {
    throw new Error('Baby clothing entry type is invalid.');
  }
  if (!isStatus(draft.status)) {
    throw new Error('Baby clothing lifecycle state is invalid.');
  }

  const timestamp = now.toISOString();
  return {
    id: normalizedId,
    name,
    category: draft.category,
    brand: normalizeOptionalText(draft.brand),
    color: normalizeOptionalText(draft.color ?? ''),
    originalSizeLabel: normalizeOptionalText(draft.originalSizeLabel),
    normalizedSize: normalizeSizeRange(draft.normalizedSize),
    entryType: draft.entryType,
    quantity: normalizeQuantity(draft.entryType, draft.quantity),
    status: draft.status,
    photos: normalizePhotos(draft.photos),
    notes: draft.notes.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateBabyClothingEntry(
  entry: BabyClothingEntry,
  patch: BabyClothingPatch,
  now = new Date(),
) {
  const updated = createBabyClothingEntry(
    {
      name: patch.name ?? entry.name,
      category: patch.category ?? entry.category,
      brand: patch.brand ?? entry.brand,
      color: patch.color === undefined ? entry.color : patch.color,
      originalSizeLabel: patch.originalSizeLabel ?? entry.originalSizeLabel,
      normalizedSize:
        patch.normalizedSize === undefined ? entry.normalizedSize : patch.normalizedSize,
      entryType: patch.entryType ?? entry.entryType,
      quantity: patch.quantity ?? entry.quantity,
      status: patch.status ?? entry.status,
      photos: patch.photos ?? entry.photos,
      notes: patch.notes ?? entry.notes,
    },
    entry.id,
    now,
  );

  return { ...updated, createdAt: entry.createdAt };
}

function isStoredEntry(value: unknown): value is StoredBabyClothingEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const entry = value as Partial<StoredBabyClothingEntry>;

  return (
    typeof entry.id === 'string' &&
    normalizeBabyClothingText(entry.id).length > 0 &&
    typeof entry.name === 'string' &&
    normalizeBabyClothingText(entry.name).length > 0 &&
    isCategory(entry.category) &&
    typeof entry.brand === 'string' &&
    (entry.color === undefined || typeof entry.color === 'string') &&
    typeof entry.originalSizeLabel === 'string' &&
    (entry.normalizedSize === null || isSizeRange(entry.normalizedSize)) &&
    isEntryType(entry.entryType) &&
    typeof entry.quantity === 'number' &&
    Number.isSafeInteger(entry.quantity) &&
    entry.quantity >= 1 &&
    isStatus(entry.status) &&
    Array.isArray(entry.photos) &&
    entry.photos.every(isPhoto) &&
    typeof entry.notes === 'string' &&
    isIsoTimestamp(entry.createdAt) &&
    isIsoTimestamp(entry.updatedAt)
  );
}

export function deserializeBabyClothingEntries(value: string | null): BabyClothingEntry[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isStoredEntry).map((entry) => ({
      ...entry,
      id: normalizeBabyClothingText(entry.id),
      name: normalizeBabyClothingText(entry.name),
      brand: normalizeOptionalText(entry.brand),
      color: normalizeOptionalText(entry.color ?? ''),
      originalSizeLabel: normalizeOptionalText(entry.originalSizeLabel),
      normalizedSize: normalizeSizeRange(entry.normalizedSize),
      quantity: normalizeQuantity(entry.entryType, entry.quantity),
      photos: normalizePhotos(entry.photos),
      notes: entry.notes.trim(),
    }));
  } catch {
    return [];
  }
}

export function formatBabyClothingSize(range: BabyClothingSizeRange | null) {
  if (!range) {
    return 'Size not normalized';
  }
  if (range.minCm === range.maxCm) {
    return `${range.minCm} cm`;
  }
  return `${range.minCm}–${range.maxCm} cm`;
}

export function sizeRangesOverlap(
  left: BabyClothingSizeRange | null,
  right: BabyClothingSizeRange | null,
) {
  if (!left || !right) {
    return false;
  }
  return left.minCm <= right.maxCm && right.minCm <= left.maxCm;
}

export function babyClothingSizePreset(id: string) {
  return BABY_CLOTHING_SIZE_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function filterBabyClothingEntries(
  entries: readonly BabyClothingEntry[],
  query: string,
  status: BabyClothingStatusFilter,
  normalizedSize: BabyClothingSizeRange | null,
) {
  const normalizedQuery = normalizeBabyClothingText(query).toLocaleLowerCase();

  return entries
    .filter((entry) => {
      if (status !== 'all' && entry.status !== status) {
        return false;
      }
      if (normalizedSize && !sizeRangesOverlap(entry.normalizedSize, normalizedSize)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      return [
        entry.name,
        entry.category,
        entry.brand,
        entry.color,
        entry.originalSizeLabel,
        entry.status,
        entry.notes,
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    })
    .sort((left, right) => {
      const leftSize = left.normalizedSize?.minCm ?? Number.POSITIVE_INFINITY;
      const rightSize = right.normalizedSize?.minCm ?? Number.POSITIVE_INFINITY;
      if (leftSize !== rightSize) {
        return leftSize - rightSize;
      }
      return left.name.localeCompare(right.name);
    });
}
