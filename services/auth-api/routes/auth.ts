import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

import { json, noContent, parseBody } from '../http';
import { createSession, readSessionToken, resolveSession, revokeSession } from '../session';
import {
  isValidEmail,
  isValidUsername,
  normalizeUsername,
  toSessionUser,
  type StoredUser,
} from '../store';
import type { RouteHandlerContext } from './types';

function hashPassword(password: string): string {
  const saltHex = randomBytes(16).toString('hex');
  const hash = scryptSync(password, saltHex, 64).toString('hex');
  return `${saltHex}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHash] = storedHash.split(':');

  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  return actualHash.length === expected.length && timingSafeEqual(actualHash, expected);
}

export async function handleAuthRoutes(context: RouteHandlerContext): Promise<boolean> {
  const { corsOrigin, request, requestUrl, response, sendWelcomeEmail, store } = context;

  if (request.method === 'POST' && requestUrl.pathname === '/auth/signup') {
    const body = await parseBody(request);
    const displayName = String(body.displayName ?? '').trim();
    const username = normalizeUsername(String(body.username ?? ''));
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!displayName) {
      json(response, 400, { error: 'Display name is required.' }, corsOrigin);
      return true;
    }

    if (!isValidUsername(username)) {
      json(
        response,
        400,
        { error: 'Username must be 3-24 characters using lowercase letters, numbers, or underscores.' },
        corsOrigin,
      );
      return true;
    }

    if (!isValidEmail(email)) {
      json(response, 400, { error: 'A valid email address is required.' }, corsOrigin);
      return true;
    }

    if (password.length < 8) {
      json(response, 400, { error: 'Password must be at least 8 characters long.' }, corsOrigin);
      return true;
    }

    const user = await store.mutate<StoredUser | { duplicate: 'email' | 'username' }>((document) => {
      if (document.users.some((entry) => entry.email === email)) {
        return { duplicate: 'email' };
      }

      if (document.users.some((entry) => entry.username === username)) {
        return { duplicate: 'username' };
      }

      const now = new Date().toISOString();
      const nextUser: StoredUser = {
        id: randomUUID(),
        email,
        username,
        displayName,
        bio: '',
        avatarUrl: null,
        role: store.adminEmails.has(email) ? 'admin' : 'member',
        status: 'active',
        createdAt: now,
        updatedAt: now,
        passwordHash: hashPassword(password),
      };

      document.users.push(nextUser);
      return nextUser;
    });

    if ('duplicate' in user) {
      json(
        response,
        409,
        {
          error:
            user.duplicate === 'email'
              ? 'An account already exists for this email address.'
              : 'That username is already taken.',
        },
        corsOrigin,
      );
      return true;
    }

    try {
      await sendWelcomeEmail(user);
    } catch (error) {
      console.warn('Failed to send welcome email.', error);
    }

    json(
      response,
      201,
      {
        message: 'Account created. Check Mailpit for the welcome email.',
        user: toSessionUser(user),
      },
      corsOrigin,
    );
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/auth/signin') {
    const body = await parseBody(request);
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const document = await store.read();
    const user = document.users.find((entry) => entry.email === email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      json(response, 401, { error: 'Invalid email or password.' }, corsOrigin);
      return true;
    }

    const session = await createSession(store, user.id);

    json(
      response,
      200,
      {
        token: session.token,
        user: toSessionUser(user),
      },
      corsOrigin,
    );
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/auth/signout') {
    await revokeSession(store, readSessionToken(request));
    noContent(response, corsOrigin);
    return true;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/auth/session') {
    const user = await resolveSession(store, readSessionToken(request));

    if (!user) {
      json(response, 401, { error: 'Session not found.' }, corsOrigin);
      return true;
    }

    json(
      response,
      200,
      {
        user: toSessionUser(user),
      },
      corsOrigin,
    );
    return true;
  }

  return false;
}
