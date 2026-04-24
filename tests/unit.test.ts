import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test, { afterEach } from 'node:test';
import { fileURLToPath } from 'node:url';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { appManifest } from '../app.manifest';
import {
  ApiRequestError,
  configureApiClient,
  fetchProfileRequest,
  fetchSessionRequest,
  searchProfilesRequest,
  signInRequest,
  signOutRequest,
  updateMyAvatarRequest,
} from '../lib/auth';
import {
  AUTH_SESSION_STORAGE_KEY,
  clearPersistedSession,
  loadPersistedSessionToken,
  persistSessionToken,
} from '../lib/auth-storage';
import {
  getDevelopmentSessionCredentials,
  shouldEnableDevelopmentSessionBootstrap,
} from '../lib/dev-auth';
import {
  THEME_MODE_STORAGE_KEY,
  loadPersistedThemeMode,
  normalizeThemeMode,
  persistThemeMode,
} from '../lib/theme-storage';

const originalFetch = global.fetch;
const originalGetItem = AsyncStorage.getItem;
const originalSetItem = AsyncStorage.setItem;
const originalRemoveItem = AsyncStorage.removeItem;
const originalAuthMode = process.env.EXPO_PUBLIC_AUTH_MODE;

afterEach(() => {
  global.fetch = originalFetch;
  AsyncStorage.getItem = originalGetItem;
  AsyncStorage.setItem = originalSetItem;
  AsyncStorage.removeItem = originalRemoveItem;
  if (originalAuthMode === undefined) {
    delete process.env.EXPO_PUBLIC_AUTH_MODE;
  } else {
    process.env.EXPO_PUBLIC_AUTH_MODE = originalAuthMode;
  }
  configureApiClient({
    getToken: () => null,
    onUnauthorized: () => undefined,
  });
});

test('app manifest exposes the full scaffold-v2 contract keys for the standalone repo', () => {
  assert.equal(appManifest.entryWorkspace, '.');
  assert.deepEqual(appManifest.sharedPackages, []);
  assert.equal(appManifest.releaseCadence, 'independent');
  assert.equal(appManifest.deployment.runtime, 'expo');
});

test('smoke e2e suite is explicitly named and the old example suite is removed', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const smokeSuitePath = path.join(repoRoot, 'e2e', 'smoke-auth-contract.spec.ts');

  assert.equal(existsSync(smokeSuitePath), true);
  assert.equal(existsSync(path.join(repoRoot, 'e2e', 'example.spec.ts')), false);
  assert.match(readFileSync(smokeSuitePath, 'utf8'), /scaffold smoke\/auth contract/);
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

test('auth storage persists only the bearer token', async () => {
  let writtenValue: { key: string; value: string } | null = null;
  let removedKey: string | null = null;

  AsyncStorage.getItem = async (key) => {
    assert.equal(key, AUTH_SESSION_STORAGE_KEY);
    return 'token-123';
  };

  AsyncStorage.setItem = async (key, value) => {
    writtenValue = { key, value };
  };

  AsyncStorage.removeItem = async (key) => {
    removedKey = key;
  };

  assert.equal(await loadPersistedSessionToken(), 'token-123');
  await persistSessionToken('token-456');
  await clearPersistedSession();

  assert.deepEqual(writtenValue, {
    key: AUTH_SESSION_STORAGE_KEY,
    value: 'token-456',
  });
  assert.equal(removedKey, AUTH_SESSION_STORAGE_KEY);
});

test('development session bootstrap helpers respect overrides', () => {
  assert.equal(
    shouldEnableDevelopmentSessionBootstrap({
      ...process.env,
      EXPO_PUBLIC_DEV_AUTH_AUTO_SIGN_IN: 'false',
    }),
    false,
  );
  assert.equal(
    shouldEnableDevelopmentSessionBootstrap({
      ...process.env,
      EXPO_PUBLIC_DEV_AUTH_AUTO_SIGN_IN: 'true',
    }),
    true,
  );

  assert.deepEqual(
    getDevelopmentSessionCredentials({
      ...process.env,
      EXPO_PUBLIC_DEV_AUTH_DISPLAY_NAME: 'Local Admin',
      EXPO_PUBLIC_DEV_AUTH_USERNAME: 'local_admin',
      EXPO_PUBLIC_DEV_AUTH_EMAIL: 'LOCAL.ADMIN@EXAMPLE.TEST',
      EXPO_PUBLIC_DEV_AUTH_PASSWORD: 'secret-123',
    }),
    {
      displayName: 'Local Admin',
      username: 'local_admin',
      email: 'local.admin@example.test',
      password: 'secret-123',
    },
  );
});

test('mock auth service signs in and serves scaffold data without network requests', async () => {
  const storage = new Map<string, string>();
  let token: string | null = null;

  process.env.EXPO_PUBLIC_AUTH_MODE = 'mock';
  AsyncStorage.getItem = async (key) => storage.get(key) ?? null;
  AsyncStorage.setItem = async (key, value) => {
    storage.set(key, value);
  };
  AsyncStorage.removeItem = async (key) => {
    storage.delete(key);
  };

  configureApiClient({
    getToken: () => token,
    onUnauthorized: () => undefined,
  });

  const signIn = await signInRequest({
    email: 'admin@example.test',
    password: 'password123',
  });
  token = signIn.token;

  const session = await fetchSessionRequest();
  assert.equal(session.user.email, 'admin@example.test');

  const profiles = await searchProfilesRequest({ query: 'alex' });
  assert.equal(profiles.profiles.some((profile) => profile.username === 'alex'), true);

  await signOutRequest();

  await assert.rejects(
    () => fetchSessionRequest(),
    (error: unknown) => {
      assert.ok(error instanceof ApiRequestError);
      assert.equal(error.status, 401);
      return true;
    },
  );
});

test('searchProfilesRequest injects the bearer token', async () => {
  configureApiClient({
    getToken: () => 'session-token',
    onUnauthorized: () => undefined,
  });

  global.fetch = async (input, init) => {
    assert.equal(String(input), 'http://localhost:4401/profiles?query=ada');
    assert.equal(init?.headers instanceof Headers, true);
    assert.equal((init?.headers as Headers).get('Authorization'), 'Bearer session-token');

    return new Response(
      JSON.stringify({
        profiles: [],
        nextCursor: null,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  };

  const payload = await searchProfilesRequest({ query: 'ada' });
  assert.deepEqual(payload, { profiles: [], nextCursor: null });
});

test('fetchProfileRequest surfaces auth-api errors with status information', async () => {
  global.fetch = async (input) => {
    assert.equal(String(input), 'http://localhost:4401/profiles/missing-user');

    return new Response(JSON.stringify({ error: 'Profile not found.' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };

  await assert.rejects(
    () => fetchProfileRequest('missing-user'),
    (error: unknown) => {
      assert.ok(error instanceof ApiRequestError);
      assert.equal(error.status, 404);
      assert.equal(error.message, 'Profile not found.');
      return true;
    },
  );
});

test('updateMyAvatarRequest posts the cropped avatar payload to /me/avatar', async () => {
  configureApiClient({
    getToken: () => 'session-token',
    onUnauthorized: () => undefined,
  });

  global.fetch = async (input, init) => {
    assert.equal(String(input), 'http://localhost:4401/me/avatar');
    assert.equal(init?.method, 'POST');
    assert.equal((init?.headers as Headers).get('Authorization'), 'Bearer session-token');
    assert.equal(
      init?.body,
      JSON.stringify({ avatarDataUrl: 'data:image/jpeg;base64,avatar' }),
    );

    return new Response(
      JSON.stringify({
        user: {
          id: 'user-1',
          email: 'ada@example.test',
          username: 'ada',
          displayName: 'Ada Lovelace',
          avatarUrl: 'data:image/jpeg;base64,avatar',
          role: 'member',
          status: 'active',
        },
        profile: {
          id: 'user-1',
          username: 'ada',
          displayName: 'Ada Lovelace',
          bio: '',
          avatarUrl: 'data:image/jpeg;base64,avatar',
          role: 'member',
          status: 'active',
          createdAt: '2026-04-16T10:00:00.000Z',
          updatedAt: '2026-04-16T10:00:00.000Z',
          followerCount: 0,
          followingCount: 0,
          relationship: null,
          isSelf: true,
          canEdit: true,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  };

  const payload = await updateMyAvatarRequest('data:image/jpeg;base64,avatar');
  assert.equal(payload.profile.avatarUrl, 'data:image/jpeg;base64,avatar');
});

test('fetchSessionRequest triggers the unauthorized handler on 401', async () => {
  let unauthorizedCalls = 0;

  configureApiClient({
    getToken: () => 'expired-token',
    onUnauthorized: () => {
      unauthorizedCalls += 1;
    },
  });

  global.fetch = async () =>
    new Response(JSON.stringify({ error: 'Session not found.' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  await assert.rejects(() => fetchSessionRequest(), ApiRequestError);
  assert.equal(unauthorizedCalls, 1);
});
