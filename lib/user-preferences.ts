import { I18nManager } from 'react-native';

export {
  DEFAULT_LANGUAGE,
  normalizeLanguageTag,
  readPreferredLanguageFromInput,
  resolveColorBlindModePreference,
  type UserAccessibilityPreferences,
  type UserPreferenceSnapshot,
  type UserPreferenceTheme,
} from '@/lib/user-preferences-helpers';

import { readPreferredLanguageFromInput } from '@/lib/user-preferences-helpers';

function readIntlLanguage() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return null;
  }
}

export function readPreferredLanguage() {
  return readPreferredLanguageFromInput({
    browserLanguages: typeof navigator !== 'undefined' && Array.isArray(navigator.languages) ? navigator.languages : null,
    browserLanguage: typeof navigator !== 'undefined' ? navigator.language : null,
    localeIdentifier: I18nManager.getConstants().localeIdentifier,
    intlLanguage: readIntlLanguage(),
  });
}
