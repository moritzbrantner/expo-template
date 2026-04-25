export type UserPreferenceTheme = 'light' | 'dark';

export type UserAccessibilityPreferences = {
  grayscaleEnabled: boolean;
  invertColorsEnabled: boolean;
  highTextContrastEnabled: boolean;
  darkerSystemColorsEnabled: boolean;
};

export type UserPreferenceSnapshot = {
  preferredTheme: UserPreferenceTheme;
  colorBlindModeEnabled: boolean;
  language: string;
};

export const DEFAULT_LANGUAGE = 'en-US';

export function normalizeLanguageTag(language: string | null | undefined) {
  if (typeof language !== 'string') {
    return null;
  }

  const normalized = language.trim().replace(/_/g, '-');
  return normalized ? normalized : null;
}

export function resolveColorBlindModePreference(preferences: UserAccessibilityPreferences) {
  return (
    preferences.grayscaleEnabled ||
    preferences.invertColorsEnabled ||
    preferences.highTextContrastEnabled ||
    preferences.darkerSystemColorsEnabled
  );
}

export function readPreferredLanguageFromInput({
  browserLanguages,
  browserLanguage,
  localeIdentifier,
  intlLanguage,
}: {
  browserLanguages?: readonly string[] | null;
  browserLanguage?: string | null;
  localeIdentifier?: string | null;
  intlLanguage?: string | null;
}) {
  if (browserLanguages) {
    for (const language of browserLanguages) {
      const normalized = normalizeLanguageTag(language);

      if (normalized) {
        return normalized;
      }
    }
  }

  const normalizedBrowserLanguage = normalizeLanguageTag(browserLanguage);

  if (normalizedBrowserLanguage) {
    return normalizedBrowserLanguage;
  }

  return normalizeLanguageTag(localeIdentifier) ?? normalizeLanguageTag(intlLanguage) ?? DEFAULT_LANGUAGE;
}
