import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SessionUser } from '@/shared/social';

export const AUTH_SESSION_STORAGE_KEY = 'auth.session';

export type PersistedSession = {
  token: string;
  user: SessionUser | null;
};

function isPersistedSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SessionUser>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.username === 'string' &&
    typeof candidate.displayName === 'string' &&
    (candidate.avatarUrl === null || typeof candidate.avatarUrl === 'string')
  );
}

function normalizePersistedSession(rawValue: string | null): PersistedSession | null {
  if (!rawValue?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as { token?: unknown; user?: unknown };

    if (typeof parsed.token !== 'string' || !parsed.token.trim()) {
      return null;
    }

    return {
      token: parsed.token,
      user: isPersistedSessionUser(parsed.user) ? parsed.user : null,
    };
  } catch {
    return {
      token: rawValue,
      user: null,
    };
  }
}

export async function loadPersistedSession() {
  try {
    const rawValue = await AsyncStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    return normalizePersistedSession(rawValue);
  } catch (error) {
    console.warn('Failed to restore auth session.', error);
    return null;
  }
}

export async function loadPersistedSessionToken() {
  const session = await loadPersistedSession();
  return session?.token ?? null;
}

export async function persistSession(session: PersistedSession) {
  try {
    await AsyncStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn('Failed to persist auth session.', error);
  }
}

export async function persistSessionToken(token: string) {
  await persistSession({ token, user: null });
}

export async function persistSessionUser(token: string, user: SessionUser) {
  await persistSession({ token, user });
}

export async function clearPersistedSession() {
  try {
    await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear auth session token.', error);
  }
}
