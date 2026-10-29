import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { LocalStorageAdapter } from '@expo-template/local-storage';

import type { BabyClothingEntry } from './clothing';
import {
  BABY_CLOTHES_STORAGE_KEY,
  UnreadableBabyClothesCatalogError,
  createBabyClothesStore,
} from './storage';

function memoryStorage(initial: string | null = null) {
  let value = initial;
  const writes: string[] = [];
  const storage: LocalStorageAdapter = {
    async getItem(key) {
      assert.equal(key, BABY_CLOTHES_STORAGE_KEY);
      return value;
    },
    async setItem(key, next) {
      assert.equal(key, BABY_CLOTHES_STORAGE_KEY);
      writes.push(next);
      value = next;
    },
  };
  return { storage, writes };
}

const entry: BabyClothingEntry = {
  id: 'clothes-1',
  name: 'Striped bodysuit',
  category: 'bodysuit',
  color: '',
  brand: '',
  originalSizeLabel: '62',
  normalizedSize: { minCm: 62, maxCm: 62 },
  entryType: 'single',
  quantity: 1,
  status: 'in-use',
  photos: [],
  notes: '',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

describe('baby clothes storage', () => {
  test('round-trips a catalog through the shared local store', async () => {
    const { storage, writes } = memoryStorage();
    const store = createBabyClothesStore(storage);
    assert.deepEqual(await store.load(), []);
    await store.save([entry]);
    assert.equal(writes.length, 1);
    assert.deepEqual(await store.load(), [entry]);
  });

  test('refuses truncated or partially incompatible catalogs instead of reducing them', async () => {
    for (const stored of ['[{"id":', JSON.stringify([entry, { id: 'future', schema: 2 }]), '{}']) {
      const { storage, writes } = memoryStorage(stored);
      await assert.rejects(createBabyClothesStore(storage).load(), UnreadableBabyClothesCatalogError);
      assert.equal(writes.length, 0);
    }
  });
});

test('the synthetic web preview catalog loads as a complete stored catalog', async () => {
  const { BABY_CLOTHING_PREVIEW_ENTRIES } = await import('./preview-catalog.web');
  const { storage } = memoryStorage(JSON.stringify(BABY_CLOTHING_PREVIEW_ENTRIES));
  const loaded = await createBabyClothesStore(storage).load();
  assert.equal(loaded.length, BABY_CLOTHING_PREVIEW_ENTRIES.length);
});
