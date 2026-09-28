import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createLocalJsonStore,
  type LocalStorageAdapter,
} from './index';

test('propagates transport read failures instead of treating them as empty state', async () => {
  const storage: LocalStorageAdapter = {
    async getItem() {
      throw new Error('storage unavailable');
    },
    async setItem() {},
  };
  const store = createLocalJsonStore<string[]>({
    key: 'items',
    deserialize: () => [],
    fallback: () => [],
    storage,
  });

  await assert.rejects(() => store.load(), /storage unavailable/);
});

test('uses the fallback for decode failures after a successful read', async () => {
  const storage: LocalStorageAdapter = {
    async getItem() {
      return '{broken';
    },
    async setItem() {},
  };
  const store = createLocalJsonStore<string[]>({
    key: 'items',
    deserialize: (stored) => JSON.parse(stored ?? '[]') as string[],
    fallback: () => ['fallback'],
    storage,
  });

  assert.deepEqual(await store.load(), ['fallback']);
});
