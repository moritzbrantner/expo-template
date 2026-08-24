import { getLocales } from 'expo-localization';

export {
  supportedLocales,
  translate,
  type AppLocale,
  type TranslationKey,
} from './messages';

import { supportedLocales, type AppLocale } from './messages';

export function resolveDeviceLocale(): AppLocale {
  const language = getLocales()[0]?.languageCode;
  return supportedLocales.includes(language as AppLocale) ? (language as AppLocale) : 'en';
}
