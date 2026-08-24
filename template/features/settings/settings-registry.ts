import type { AppFeatures } from '../../app.features';
import type { TranslationKey } from '../../core/i18n';

export type SettingsEntry = {
  id: 'appearance' | 'language' | 'account';
  titleKey: TranslationKey;
  route?: string;
};

export function createSettingsRegistry(features: AppFeatures): SettingsEntry[] {
  const entries: SettingsEntry[] = [
    { id: 'appearance', titleKey: 'appearance' },
    { id: 'language', titleKey: 'language' },
  ];

  if (features.authentication) {
    entries.push({ id: 'account', titleKey: 'account', route: '/sign-in' });
  }

  return entries;
}
