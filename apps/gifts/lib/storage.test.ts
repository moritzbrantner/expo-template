import assert from 'node:assert/strict';
import test from 'node:test';

import type { LocalStorageAdapter } from '@expo-template/local-storage';

import { emptyGiftState, type GiftState, serializeGiftState } from './gifts';
import { createGiftStateStore, GIFTS_STORAGE_KEY } from './storage';

function memoryStorage(initial: string | null = null) {
  let value = initial;
  const writes: Array<{ key: string; value: string }> = [];
  const storage: LocalStorageAdapter = {
    async getItem(key) {
      assert.equal(key, GIFTS_STORAGE_KEY);
      return value;
    },
    async setItem(key, next) {
      writes.push({ key, value: next });
      value = next;
    },
  };

  return { storage, writes };
}

test('gift storage preserves the existing state key and serializer', async () => {
  const state: GiftState = {
    people: [{ id: 'person-1', name: 'Ada' }],
    gifts: [
      {
        id: 'gift-1',
        direction: 'given',
        personId: 'person-1',
        title: 'Book',
        date: '2026-09-28',
        occasion: 'Birthday',
        notes: '',
        sourceGiftId: null,
        createdAt: 1,
      },
    ],
  };
  const memory = memoryStorage(serializeGiftState(state));
  const store = createGiftStateStore(memory.storage);

  assert.deepEqual(await store.load(), state);
  await store.save(state);

  assert.deepEqual(memory.writes, [
    { key: GIFTS_STORAGE_KEY, value: serializeGiftState(state) },
  ]);
});

test('gift storage propagates transport read failures so writes stay disabled', async () => {
  const storage: LocalStorageAdapter = {
    async getItem() {
      throw new Error('storage unavailable');
    },
    async setItem() {},
  };

  const store = createGiftStateStore(storage);
  await assert.rejects(() => store.load(), /storage unavailable/);
});

test('gift storage still treats malformed persisted state as empty domain data', async () => {
  const memory = memoryStorage('{broken');
  const store = createGiftStateStore(memory.storage);

  assert.deepEqual(await store.load(), emptyGiftState());
});
