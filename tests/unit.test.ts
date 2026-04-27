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
  loadPersistedSession,
  loadPersistedSessionToken,
  persistSessionUser,
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
import {
  normalizeLanguageTag,
  readPreferredLanguageFromInput,
  resolveColorBlindModePreference,
} from '../lib/user-preferences-helpers';

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

test('app manifest exposes the standalone social template contract', () => {
  assert.equal(appManifest.entryWorkspace, '.');
  assert.deepEqual(appManifest.sharedPackages, []);
  assert.deepEqual(appManifest.featureFlags, ['navigation', 'tabs', 'auth', 'social', 'profiles', 'theme']);
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

test('user preference helpers normalize language tags and infer color-blind mode', () => {
  assert.equal(normalizeLanguageTag('en_US'), 'en-US');
  assert.equal(normalizeLanguageTag(' de-DE '), 'de-DE');
  assert.equal(normalizeLanguageTag(''), null);
  assert.equal(
    resolveColorBlindModePreference({
      grayscaleEnabled: false,
      invertColorsEnabled: false,
      highTextContrastEnabled: false,
      darkerSystemColorsEnabled: false,
    }),
    false,
  );
  assert.equal(
    resolveColorBlindModePreference({
      grayscaleEnabled: false,
      invertColorsEnabled: true,
      highTextContrastEnabled: false,
      darkerSystemColorsEnabled: false,
    }),
    true,
  );
});

test('preferred language input prefers browser languages before locale fallbacks', () => {
  assert.equal(
    readPreferredLanguageFromInput({
      browserLanguages: ['fr_FR', 'en-GB'],
      browserLanguage: 'en-US',
      localeIdentifier: 'de_DE',
      intlLanguage: 'it-IT',
    }),
    'fr-FR',
  );
  assert.equal(
    readPreferredLanguageFromInput({
      browserLanguages: [],
      browserLanguage: null,
      localeIdentifier: 'de_DE',
      intlLanguage: 'it-IT',
    }),
    'de-DE',
  );
});

test('auth storage restores legacy tokens and persists the signed-in user snapshot', async () => {
  let writtenValue: { key: string; value: string } | null = null;
  let removedKey: string | null = null;
  let getItemCalls = 0;

  AsyncStorage.getItem = async (key) => {
    assert.equal(key, AUTH_SESSION_STORAGE_KEY);
    getItemCalls += 1;
    return getItemCalls === 1
      ? 'token-123'
      : JSON.stringify({
          token: 'token-456',
          user: {
            id: 'user-1',
            email: 'ada@example.test',
            username: 'ada',
            displayName: 'Ada Lovelace',
            avatarUrl: null,
          },
        });
  };

  AsyncStorage.setItem = async (key, value) => {
    writtenValue = { key, value };
  };

  AsyncStorage.removeItem = async (key) => {
    removedKey = key;
  };

  assert.equal(await loadPersistedSessionToken(), 'token-123');
  assert.deepEqual(await loadPersistedSession(), {
    token: 'token-456',
    user: {
      id: 'user-1',
      email: 'ada@example.test',
      username: 'ada',
      displayName: 'Ada Lovelace',
      avatarUrl: null,
    },
  });

  await persistSessionToken('token-456');
  await persistSessionUser('token-789', {
    id: 'user-2',
    email: 'grace@example.test',
    username: 'grace',
    displayName: 'Grace Hopper',
    avatarUrl: null,
  });
  await clearPersistedSession();

  assert.deepEqual(writtenValue, {
    key: AUTH_SESSION_STORAGE_KEY,
    value: JSON.stringify({
      token: 'token-789',
      user: {
        id: 'user-2',
        email: 'grace@example.test',
        username: 'grace',
        displayName: 'Grace Hopper',
        avatarUrl: null,
      },
    }),
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
      EXPO_PUBLIC_DEV_AUTH_DISPLAY_NAME: 'Local Member',
      EXPO_PUBLIC_DEV_AUTH_USERNAME: 'local_member',
      EXPO_PUBLIC_DEV_AUTH_EMAIL: 'LOCAL.MEMBER@EXAMPLE.TEST',
      EXPO_PUBLIC_DEV_AUTH_PASSWORD: 'secret-123',
    }),
    {
      displayName: 'Local Member',
      username: 'local_member',
      email: 'local.member@example.test',
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
    email: 'alex@example.test',
    password: 'password123',
  });
  token = signIn.token;

  const session = await fetchSessionRequest();
  assert.equal(session.user.email, 'alex@example.test');

  const profiles = await searchProfilesRequest({ query: 'sam' });
  assert.equal(profiles.profiles.some((profile) => profile.username === 'sam'), true);

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

test('updateMyAvatarRequest uses upload intent and completion endpoints', async () => {
  configureApiClient({
    getToken: () => 'session-token',
    onUnauthorized: () => undefined,
  });

  const calls: Array<{ body: string | null; method: string | undefined; url: string }> = [];

  global.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: typeof init?.body === 'string' ? init.body : null,
    });

    if (calls.length === 1) {
      return new Response(
        JSON.stringify({
          uploadIntent: {
            uploadToken: 'upload-token-1',
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        user: {
          id: 'user-1',
          email: 'ada@example.test',
          username: 'ada',
          displayName: 'Ada Lovelace',
          avatarUrl: 'https://assets.example.test/avatar/user-1/upload-token-1',
        },
        profile: {
          id: 'user-1',
          username: 'ada',
          displayName: 'Ada Lovelace',
          bio: '',
          avatarUrl: 'https://assets.example.test/avatar/user-1/upload-token-1',
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
  assert.equal(payload.profile.avatarUrl, 'https://assets.example.test/avatar/user-1/upload-token-1');
  assert.deepEqual(calls, [
    {
      url: 'http://localhost:4401/me/avatar/upload-intent',
      method: 'POST',
      body: JSON.stringify({ contentType: 'image/jpeg' }),
    },
    {
      url: 'http://localhost:4401/me/avatar/complete',
      method: 'POST',
      body: JSON.stringify({ uploadToken: 'upload-token-1' }),
    },
  ]);
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
