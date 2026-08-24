import { expect, test } from 'bun:test';

import { appFeatures } from '../app.features';
import { translate } from '../core/i18n/messages';
import {
  createStopwatch,
  elapsedAt,
  formatElapsed,
  pauseStopwatch,
  resumeStopwatchAfterSuspension,
  startStopwatch,
  suspendStopwatch,
} from '../core/time/stopwatch';
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

test('stopwatch derives elapsed time from monotonic transitions', () => {
  const started = startStopwatch(createStopwatch(), 1_000);
  expect(elapsedAt(started, 2_250)).toBe(1_250);

  const paused = pauseStopwatch(started, 2_250);
  expect(elapsedAt(paused, 9_000)).toBe(1_250);

  const resumed = startStopwatch(paused, 10_000);
  expect(elapsedAt(resumed, 10_750)).toBe(2_000);
  expect(formatElapsed(62_340)).toBe('01:02:34');
});

test('stopwatch includes time spent suspended', () => {
  const started = startStopwatch(createStopwatch(), 1_000);
  const suspended = suspendStopwatch(started, 2_250, 5_000);
  expect(elapsedAt(suspended, 9_000)).toBe(1_250);

  const resumed = resumeStopwatchAfterSuspension(suspended, 2_300, 15_000);
  expect(elapsedAt(resumed, 2_800)).toBe(11_750);
});
