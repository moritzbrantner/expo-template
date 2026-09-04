import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ensureStarterAccount,
  readStarterAuthConfig,
  type FetchLike,
  type StarterAuthConfig,
} from '../scripts/local-auth';

const config: StarterAuthConfig = {
  apiUrl: 'http://localhost:4401',
  account: {
    displayName: 'Expo Template Admin',
    username: 'starter_admin',
    email: 'admin@example.test',
    password: 'expo-template-local',
  },
};

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

test('starter bootstrap URL stays host-local when the Expo client uses an emulator URL', () => {
  const starterConfig = readStarterAuthConfig({
    EXPO_PUBLIC_AUTH_API_URL: 'http://10.0.2.2:4401',
    AUTH_STARTER_API_URL: 'http://localhost:4401/',
  });

  assert.equal(starterConfig.apiUrl, 'http://localhost:4401');
});

test('local auth starter reuses an existing login without signing up again', async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (input) => {
    calls.push(String(input));
    return jsonResponse(200, {
      token: 'existing-token',
      user: { email: config.account.email },
    });
  };

  assert.equal(await ensureStarterAccount(config, fetchImpl), 'existing');
  assert.deepEqual(calls, ['http://localhost:4401/auth/signin']);
});

test('local auth starter creates and verifies a missing login', async () => {
  const calls: string[] = [];
  let signInAttempt = 0;
  const fetchImpl: FetchLike = async (input) => {
    const url = String(input);
    calls.push(url);

    if (url.endsWith('/auth/signup')) {
      return jsonResponse(201, {
        message: 'created',
        user: { email: config.account.email },
      });
    }

    signInAttempt += 1;
    return signInAttempt === 1
      ? jsonResponse(401, { error: 'Invalid email or password.' })
      : jsonResponse(200, {
          token: 'created-token',
          user: { email: config.account.email },
        });
  };

  assert.equal(await ensureStarterAccount(config, fetchImpl), 'created');
  assert.deepEqual(calls, [
    'http://localhost:4401/auth/signin',
    'http://localhost:4401/auth/signup',
    'http://localhost:4401/auth/signin',
  ]);
});

test('local auth starter fails closed on conflicting credentials', async () => {
  const fetchImpl: FetchLike = async (input) => {
    const url = String(input);

    if (url.endsWith('/auth/signin')) {
      return jsonResponse(401, { error: 'Invalid email or password.' });
    }

    return jsonResponse(409, { error: 'An account already exists for this email address.' });
  };

  await assert.rejects(
    () => ensureStarterAccount(config, fetchImpl),
    /A starter email or username already exists with different credentials\./,
  );
});
