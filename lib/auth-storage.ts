import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTH_SESSION_STORAGE_KEY = 'auth.session';

export async function loadPersistedSessionToken() {
  try {
    const rawValue = await AsyncStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    return rawValue?.trim() ? rawValue : null;
  } catch (error) {
    console.warn('Failed to restore auth session token.', error);
    return null;
  }
}

export async function persistSessionToken(token: string) {
  try {
    await AsyncStorage.setItem(AUTH_SESSION_STORAGE_KEY, token);
  } catch (error) {
    console.warn('Failed to persist auth session token.', error);
  }
}

export async function clearPersistedSession() {
  try {
    await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear auth session token.', error);
  }
}
