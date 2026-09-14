import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createVersionedJsonStorage, versionedStorageKey } from './index';

class MemoryStorage {
  readonly values = new Map<string, string>();
  readonly writes: Array<{ key: string; value: string }> = [];

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.values.set(key, value);
    this.writes.push({ key, value });
  }

  async removeItem(key: string) {
    this.values.delete(key);
  }
}

function decodeStrings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((candidate) => typeof candidate === 'string')
    ? value
    : null;
}

describe('versionedStorageKey', () => {
  test('keeps the schema version in the storage key', () => {
    assert.equal(
      versionedStorageKey('@expo-template/tasks/list', 2),
      '@expo-template/tasks/list-v2',
    );
  });
});

describe('createVersionedJsonStorage', () => {
  test('loads and saves the current version without changing its JSON shape', async () => {
    const storage = new MemoryStorage();
    storage.values.set('@example/items-v1', JSON.stringify(['one']));
    const store = createVersionedJsonStorage({
      storage,
      keyPrefix: '@example/items',
      version: 1,
      decode: decodeStrings,
      fallback: () => [],
    });

    assert.deepEqual(await store.load(), ['one']);
    await store.save(['one', 'two']);
    assert.equal(storage.values.get('@example/items-v1'), JSON.stringify(['one', 'two']));
  });

  test('fails closed on malformed current data instead of resurrecting an older version', async () => {
    const storage = new MemoryStorage();
    storage.values.set('@example/items-v1', JSON.stringify(['old']));
    storage.values.set('@example/items-v2', '{');
    const store = createVersionedJsonStorage({
      storage,
      keyPrefix: '@example/items',
      version: 2,
      decode: decodeStrings,
      fallback: () => ['fallback'],
      migrations: { 1: (value) => value },
    });

    assert.deepEqual(await store.load(), ['fallback']);
    assert.deepEqual(storage.writes, []);
  });

  test('migrates the nearest older version through every declared step and persists it once', async () => {
    const storage = new MemoryStorage();
    storage.values.set('@example/items-v1', JSON.stringify({ items: ['one'] }));
    const store = createVersionedJsonStorage({
      storage,
      keyPrefix: '@example/items',
      version: 3,
      decode: decodeStrings,
      fallback: () => [],
      migrations: {
        1: (value) => {
          if (!value || typeof value !== 'object' || !('items' in value)) return value;
          return (value as { items: unknown }).items;
        },
        2: (value) => value,
      },
    });

    assert.deepEqual(await store.load(), ['one']);
    assert.deepEqual(storage.writes, [
      { key: '@example/items-v3', value: JSON.stringify(['one']) },
    ]);
  });

  test('does not partially migrate when a required migration step is missing', async () => {
    const storage = new MemoryStorage();
    storage.values.set('@example/items-v1', JSON.stringify(['one']));
    const store = createVersionedJsonStorage({
      storage,
      keyPrefix: '@example/items',
      version: 3,
      decode: decodeStrings,
      fallback: () => ['fallback'],
      migrations: { 2: (value) => value },
    });

    assert.deepEqual(await store.load(), ['fallback']);
    assert.deepEqual(storage.writes, []);
  });

  test('uses the app-owned encoder before writing generic JSON', async () => {
    const storage = new MemoryStorage();
    const store = createVersionedJsonStorage({
      storage,
      keyPrefix: '@example/items',
      version: 1,
      decode: decodeStrings,
      encode: (value: string[]) => [...value].sort(),
      fallback: () => [],
    });

    await store.save(['two', 'one']);
    assert.equal(storage.values.get('@example/items-v1'), JSON.stringify(['one', 'two']));
  });
});
