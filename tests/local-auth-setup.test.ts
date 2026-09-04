import { describe, expect, test } from 'bun:test';

import {
  ensureStarterAccount,
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

describe('local auth starter bootstrap', () => {
  test('reuses an existing starter login without signing up again', async () => {
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (input) => {
      calls.push(String(input));
      return jsonResponse(200, {
        token: 'existing-token',
        user: { email: config.account.email },
      });
    };

    await expect(ensureStarterAccount(config, fetchImpl)).resolves.toBe('existing');
    expect(calls).toEqual(['http://localhost:4401/auth/signin']);
  });

  test('creates and verifies the starter login when it is missing', async () => {
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

    await expect(ensureStarterAccount(config, fetchImpl)).resolves.toBe('created');
    expect(calls).toEqual([
      'http://localhost:4401/auth/signin',
      'http://localhost:4401/auth/signup',
      'http://localhost:4401/auth/signin',
    ]);
  });

  test('fails closed when the configured identity already has different credentials', async () => {
    const fetchImpl: FetchLike = async (input) => {
      const url = String(input);

      if (url.endsWith('/auth/signin')) {
        return jsonResponse(401, { error: 'Invalid email or password.' });
      }

      return jsonResponse(409, { error: 'An account already exists for this email address.' });
    };

    await expect(ensureStarterAccount(config, fetchImpl)).rejects.toThrow(
      'A starter email or username already exists with different credentials.',
    );
  });
});
