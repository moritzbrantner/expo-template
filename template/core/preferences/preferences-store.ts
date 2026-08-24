import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppLocale } from '../i18n';

export type ThemeMode = 'system' | 'light' | 'dark';

export type Preferences = {
  themeMode: ThemeMode;
  locale: AppLocale;
};

const STORAGE_KEY = 'app.preferences.v1';

export async function loadPreferences(fallback: Preferences): Promise<Preferences> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value) as Partial<Preferences>;
    return {
      themeMode:
        parsed.themeMode === 'light' || parsed.themeMode === 'dark' ? parsed.themeMode : 'system',
      locale: parsed.locale === 'de' || parsed.locale === 'es' ? parsed.locale : 'en',
    };
  } catch {
    return fallback;
  }
}

export async function savePreferences(preferences: Preferences) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
