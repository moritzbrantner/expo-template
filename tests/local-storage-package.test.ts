import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  createLocalJsonStore,
  type LocalStorageAdapter,
} from '../packages/local-storage/src/index';

function memoryStorage(initial: Record<string, string> = {}): LocalStorageAdapter & {
  values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
  };
}

describe('local storage package', () => {
  test('preserves consumer-owned serialization', async () => {
    const storage = memoryStorage();
    const store = createLocalJsonStore({
      key: '@example/list-v1',
      deserialize: (stored) => (stored ? (JSON.parse(stored) as string[]) : []),
      fallback: () => [],
      storage,
    });

    await store.save(['one', 'two']);

    assert.equal(storage.values.get('@example/list-v1'), '["one","two"]');
    assert.deepEqual(await store.load(), ['one', 'two']);
  });

  test('fails closed to the consumer fallback when storage is unavailable', async () => {
    const storage: LocalStorageAdapter = {
      async getItem() {
        throw new Error('unavailable');
      },
      async setItem() {
        throw new Error('unavailable');
      },
    };
    const store = createLocalJsonStore({
      key: '@example/list-v1',
      deserialize: () => ['unexpected'],
      fallback: () => ['fallback'],
      storage,
    });

    assert.deepEqual(await store.load(), ['fallback']);
  });

  test('applies an explicit migration boundary before domain deserialization', async () => {
    const storage = memoryStorage({ '@example/list-v1': '{"items":["old"]}' });
    const store = createLocalJsonStore({
      key: '@example/list-v1',
      migrate: (stored) => {
        if (!stored) return stored;
        const legacy = JSON.parse(stored) as { items: string[] };
        return JSON.stringify(legacy.items);
      },
      deserialize: (stored) => (stored ? (JSON.parse(stored) as string[]) : []),
      fallback: () => [],
      storage,
    });

    assert.deepEqual(await store.load(), ['old']);
  });
});
