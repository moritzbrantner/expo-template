import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readSource(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('mobile settings screen has explicit light and dark theme controls', () => {
  const source = readSource('app/(tabs)/settings.tsx');

  assert.match(source, /ThemeModeToggle/);
  assert.match(source, /useThemeColor/);
  assert.match(source, /lightColor=\{Colors\.light\.surface\}/);
  assert.match(source, /Settings/);
  assert.match(source, /applied immediately/);
});

test('mobile theme colors follow the app theme mode context', () => {
  const source = readSource('hooks/use-theme-color.ts');

  assert.match(source, /useThemeMode/);
  assert.match(source, /activeTheme/);
});

test('mobile has a dedicated Three.js screen', () => {
  const source = readSource('app/(tabs)/three.tsx');

  assert.match(source, /Three\.js/);
  assert.match(source, /dedicated mobile destination/);
  assert.match(source, /navigation menu/);
});

test('mobile has a dedicated React Hook Form overview screen', () => {
  const source = readSource('app/(tabs)/react-hook-form.tsx');

  assert.match(source, /React Hook Form/);
  assert.match(source, /required validation/);
  assert.match(source, /dirty state/);
  assert.match(source, /reset\(newValues\)/);
});

test('mobile has a dedicated communication screen with Websockets and CRDTs sections', () => {
  const source = readSource('app/(tabs)/communication.tsx');

  assert.match(source, /Communication/);
  assert.match(source, /Example profiles/);
  assert.match(source, /GET \/profiles/);
  assert.match(source, /Reload profiles/);
  assert.match(source, /folder-backed dev API/);
  assert.match(source, /Websockets/);
  assert.match(source, /CRDTs/);
  assert.match(source, /Communication topic/);
});

test('dev REST fixture is backed by folder-server and seeded example profiles', () => {
  const composeSource = readSource('docker-compose.yml');
  const dockerfileSource = readSource('services/dev-api/Dockerfile');
  const profilesSource = readSource('services/dev-api/data/profiles.json');
  const schemaSource = readSource('services/dev-api/data/schema.json');
  const apiSource = readSource('lib/dev-api.ts');

  assert.match(composeSource, /dev-api:/);
  assert.match(composeSource, /4402:4002/);
  assert.match(dockerfileSource, /moritzbrantner\/folder-server\.git/);
  assert.match(dockerfileSource, /--readonly/);
  assert.match(profilesSource, /"username": "alex"/);
  assert.match(profilesSource, /"username": "jules"/);
  assert.match(schemaSource, /"primary_key": "username"/);
  assert.match(apiSource, /http:\/\/localhost:4402/);
  assert.match(apiSource, /fetch\(`\$\{DEV_API_URL\}\/profiles`\)/);
});

test('mobile home delegates to the controls showcase and exposes auth session actions', () => {
  const screenSource = readSource('app/(tabs)/index.tsx');
  const nativeShowcaseSource = readSource('components/controls-showcase.tsx');
  const webShowcaseSource = readSource('components/controls-showcase.web.tsx');

  assert.match(screenSource, /ControlsShowcase/);
  assert.match(nativeShowcaseSource, /Authentication/);
  assert.match(nativeShowcaseSource, /Session status/);
  assert.match(nativeShowcaseSource, /testID="session-status"/);
  assert.match(nativeShowcaseSource, /router\.push\('\/auth\/sign-in'\)/);
  assert.match(webShowcaseSource, /Authentication/);
  assert.match(webShowcaseSource, /Session status/);
  assert.match(webShowcaseSource, /data-testid="session-status"/);
  assert.match(webShowcaseSource, /router\.push\('\/auth\/sign-in'\)/);
});

test('mobile has a dedicated profile screen for @username routes', () => {
  const source = readSource('app/profile/[profile].tsx');

  assert.match(source, /getProfileFromSegment/);
  assert.match(source, /@\/data\/profiles/);
  assert.match(source, /Profile not found/);
  assert.match(source, /Mobile profile/);
  assert.match(source, /\/profile\/@username/);
});
