import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ApiRequestError,
  fetchUserRequest,
  fetchUsersRequest,
} from '../lib/auth';
import {
  THEME_MODE_STORAGE_KEY,
  loadPersistedThemeMode,
  normalizeThemeMode,
  persistThemeMode,
} from '../lib/theme-storage';

const originalFetch = global.fetch;
const originalGetItem = AsyncStorage.getItem;
const originalSetItem = AsyncStorage.setItem;

afterEach(() => {
  global.fetch = originalFetch;
  AsyncStorage.getItem = originalGetItem;
  AsyncStorage.setItem = originalSetItem;
});

test('theme mode helpers normalize persisted values', () => {
  assert.equal(normalizeThemeMode('light'), 'light');
  assert.equal(normalizeThemeMode('dark'), 'dark');
  assert.equal(normalizeThemeMode('system'), null);
  assert.equal(normalizeThemeMode(null), null);
});

test('theme mode helpers load and persist saved preference', async () => {
  let writtenValue: { key: string; value: string } | null = null;

  AsyncStorage.getItem = async (key) => {
    assert.equal(key, THEME_MODE_STORAGE_KEY);
    return 'dark';
  };

  AsyncStorage.setItem = async (key, value) => {
    writtenValue = { key, value };
  };

  assert.equal(await loadPersistedThemeMode(), 'dark');

  await persistThemeMode('light');

  assert.deepEqual(writtenValue, {
    key: THEME_MODE_STORAGE_KEY,
    value: 'light',
  });
});

test('fetchUsersRequest returns auth-api users', async () => {
  global.fetch = async (input) => {
    assert.equal(String(input), 'http://localhost:4401/users');

    return new Response(
      JSON.stringify({
        users: [
          {
            id: 'user-1',
            name: 'Ada Lovelace',
            email: 'ada@example.test',
            createdAt: '2026-04-16T10:00:00.000Z',
          },
        ],
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  };

  const payload = await fetchUsersRequest();

  assert.deepEqual(payload, {
    users: [
      {
        id: 'user-1',
        name: 'Ada Lovelace',
        email: 'ada@example.test',
        createdAt: '2026-04-16T10:00:00.000Z',
      },
    ],
  });
});

test('fetchUserRequest surfaces auth-api errors with status information', async () => {
  global.fetch = async (input) => {
    assert.equal(String(input), 'http://localhost:4401/users/missing-user');

    return new Response(JSON.stringify({ error: 'User not found.' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };

  await assert.rejects(
    () => fetchUserRequest('missing-user'),
    (error: unknown) => {
      assert.ok(error instanceof ApiRequestError);
      assert.equal(error.status, 404);
      assert.equal(error.message, 'User not found.');
      return true;
    },
  );
});
