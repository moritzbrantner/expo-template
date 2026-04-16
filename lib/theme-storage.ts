import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

export const THEME_MODE_STORAGE_KEY = 'theme.mode';

export function normalizeThemeMode(value: string | null | undefined): ThemeMode | null {
  if (value === 'light' || value === 'dark') {
    return value;
  }

  return null;
}

export async function loadPersistedThemeMode() {
  try {
    const rawValue = await AsyncStorage.getItem(THEME_MODE_STORAGE_KEY);
    return normalizeThemeMode(rawValue);
  } catch (error) {
    console.warn('Failed to restore theme mode.', error);
    return null;
  }
}

export async function persistThemeMode(themeMode: ThemeMode) {
  try {
    await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode);
  } catch (error) {
    console.warn('Failed to persist theme mode.', error);
  }
}
