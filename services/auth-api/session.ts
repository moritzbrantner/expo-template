import type { IncomingMessage } from 'node:http';
import { randomBytes } from 'node:crypto';

import { getBearerToken } from './http';
import type { Store, StoredSession, StoredUser } from './store';

const SESSION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function createSessionTimestamps() {
  const now = new Date();
  return {
    createdAt: now.toISOString(),
    lastUsedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_WINDOW_MS).toISOString(),
  };
}

function isExpired(session: StoredSession): boolean {
  return new Date(session.expiresAt).getTime() <= Date.now();
}

export async function createSession(store: Store, userId: string): Promise<StoredSession> {
  return store.mutate((document) => {
    document.sessions = document.sessions.filter((session) => !isExpired(session));
    const timestamps = createSessionTimestamps();
    const session: StoredSession = {
      token: randomBytes(24).toString('hex'),
      userId,
      ...timestamps,
    };

    document.sessions.push(session);
    return session;
  });
}

export async function revokeSession(store: Store, token: string | null): Promise<void> {
  if (!token) {
    return;
  }

  await store.mutate((document) => {
    document.sessions = document.sessions.filter((session) => session.token !== token);
  });
}

export async function resolveSession(store: Store, token: string | null): Promise<StoredUser | null> {
  if (!token) {
    return null;
  }

  return store.mutate((document) => {
    document.sessions = document.sessions.filter((session) => !isExpired(session));

    const session = document.sessions.find((entry) => entry.token === token);

    if (!session) {
      return null;
    }

    const user = document.users.find((entry) => entry.id === session.userId) ?? null;

    if (!user) {
      document.sessions = document.sessions.filter((entry) => entry.token !== token);
      return null;
    }

    const timestamps = createSessionTimestamps();
    session.lastUsedAt = timestamps.lastUsedAt;
    session.expiresAt = timestamps.expiresAt;

    return user;
  });
}

export function readSessionToken(request: IncomingMessage): string | null {
  return getBearerToken(request);
}
