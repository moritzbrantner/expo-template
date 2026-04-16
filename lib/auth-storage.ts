import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthUser } from '@/lib/auth';

const AUTH_SESSION_STORAGE_KEY = 'auth.session';

export type PersistedAuthSession = {
  token: string;
  user: AuthUser;
};

export async function loadPersistedSession() {
  try {
    const rawValue = await AsyncStorage.getItem(AUTH_SESSION_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as PersistedAuthSession;
  } catch (error) {
    console.warn('Failed to restore auth session.', error);
    return null;
  }
}

export async function persistSession(session: PersistedAuthSession) {
  try {
    await AsyncStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn('Failed to persist auth session.', error);
  }
}

export async function clearPersistedSession() {
  try {
    await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear auth session.', error);
  }
}
