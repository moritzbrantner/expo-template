import {
  createLocalJsonStore,
  type LocalStorageAdapter,
} from '@expo-template/local-storage';

import { deserializeBabyClothingEntries, type BabyClothingEntry } from './clothing';

export const BABY_CLOTHES_STORAGE_KEY = 'baby-clothes.entries-v1';

/**
 * Raised when a stored catalog exists but cannot be read completely (truncated JSON or
 * records from an incompatible schema). Callers must not write over the stored value.
 */
export class UnreadableBabyClothesCatalogError extends Error {
  constructor() {
    super('The saved baby-clothes catalog could not be read completely.');
    this.name = 'UnreadableBabyClothesCatalogError';
  }
}

function storedRecordCount(value: string): number | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.length : null;
  } catch {
    return null;
  }
}

/** Deserializes a stored catalog, throwing instead of silently dropping any stored record. */
export function deserializeCompleteBabyClothingCatalog(value: string | null): BabyClothingEntry[] {
  if (value === null) {
    return [];
  }
  const recordCount = storedRecordCount(value);
  const entries = deserializeBabyClothingEntries(value);
  if (recordCount === null || entries.length !== recordCount) {
    throw new UnreadableBabyClothesCatalogError();
  }
  return entries;
}

export function createBabyClothesStore(storage?: LocalStorageAdapter) {
  return createLocalJsonStore<BabyClothingEntry[]>({
    key: BABY_CLOTHES_STORAGE_KEY,
    deserialize: deserializeCompleteBabyClothingCatalog,
    // The shared store falls back when deserialization throws; refuse instead so the
    // unreadable stored catalog is never replaced by an empty or reduced one.
    fallback: () => {
      throw new UnreadableBabyClothesCatalogError();
    },
    ...(storage ? { storage } : {}),
  });
}
