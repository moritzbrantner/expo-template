import { expect, test } from 'bun:test';

import { appFeatures } from '../app.features';
import { translate } from '../core/i18n';
import { createSettingsRegistry } from '../features/settings/settings-registry';

test('ships complete translations for the supported settings surface', () => {
  expect(translate('en', 'settings')).toBe('Settings');
  expect(translate('de', 'settings')).toBe('Einstellungen');
  expect(translate('es', 'settings')).toBe('Ajustes');
});

test('only exposes account settings when authentication is enabled', () => {
  const entries = createSettingsRegistry(appFeatures);
  expect(entries.some((entry) => entry.id === 'account')).toBe(appFeatures.authentication);
});
