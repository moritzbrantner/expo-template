import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('root image picker only declares the photo-library capability it uses', () => {
  const appConfig = JSON.parse(readFileSync(path.join(repoRoot, 'app.json'), 'utf8')) as {
    expo?: { plugins?: unknown[] };
  };
  const imagePickerPlugin = appConfig.expo?.plugins?.find(
    (plugin): plugin is [string, Record<string, unknown>] =>
      Array.isArray(plugin) && plugin[0] === 'expo-image-picker',
  );

  assert.ok(imagePickerPlugin, 'expo-image-picker must have an explicit config-plugin contract');
  assert.equal(
    imagePickerPlugin[1].photosPermission,
    'Allow $(PRODUCT_NAME) to choose a profile photo from your library.',
  );
  assert.equal(imagePickerPlugin[1].cameraPermission, false);
  assert.equal(imagePickerPlugin[1].microphonePermission, false);
});

test('root avatar flow stays on photo-library selection rather than camera capture', () => {
  const accountScreen = readFileSync(
    path.join(repoRoot, 'app', '(app)', 'settings', 'account.tsx'),
    'utf8',
  );

  assert.match(accountScreen, /ImagePicker\.launchImageLibraryAsync\(/);
  assert.doesNotMatch(accountScreen, /ImagePicker\.launchCameraAsync\(/);
});
