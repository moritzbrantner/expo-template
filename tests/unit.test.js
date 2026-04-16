const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('mobile settings screen has explicit light and dark theme controls', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../app/(tabs)/settings.tsx'),
    'utf8',
  );

  assert.match(source, /ThemeModeToggle/);
  assert.match(source, /useThemeColor/);
  assert.match(source, /lightColor=\{Colors\.light\.surface\}/);
  assert.match(source, /Settings/);
  assert.match(source, /applied immediately/);
});

test('mobile theme colors follow the app theme mode context', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../hooks/use-theme-color.ts'),
    'utf8',
  );

  assert.match(source, /useThemeMode/);
  assert.match(source, /activeTheme/);
});

test('mobile has a dedicated Three.js screen', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../app/(tabs)/three.tsx'),
    'utf8',
  );

  assert.match(source, /Three\.js/);
  assert.match(source, /dedicated mobile destination/);
  assert.match(source, /navigation menu/);
});

test('mobile has a dedicated React Hook Form overview screen', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../app/(tabs)/react-hook-form.tsx'),
    'utf8',
  );

  assert.match(source, /React Hook Form/);
  assert.match(source, /required validation/);
  assert.match(source, /dirty state/);
  assert.match(source, /reset\(newValues\)/);
});

test('mobile has a dedicated communication screen with Websockets and CRDTs sections', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../app/(tabs)/communication.tsx'),
    'utf8',
  );

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
  const composeSource = fs.readFileSync(
    path.resolve(__dirname, '../docker-compose.yml'),
    'utf8',
  );
  const dockerfileSource = fs.readFileSync(
    path.resolve(__dirname, '../services/dev-api/Dockerfile'),
    'utf8',
  );
  const profilesSource = fs.readFileSync(
    path.resolve(__dirname, '../services/dev-api/data/profiles.json'),
    'utf8',
  );
  const schemaSource = fs.readFileSync(
    path.resolve(__dirname, '../services/dev-api/data/schema.json'),
    'utf8',
  );
  const apiSource = fs.readFileSync(
    path.resolve(__dirname, '../lib/dev-api.ts'),
    'utf8',
  );

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

test('mobile home exposes the local auth playground actions', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../app/(tabs)/index.tsx'),
    'utf8',
  );

  assert.match(source, /Authentication playground/);
  assert.match(source, /Create account/);
  assert.match(source, /Sign in/);
  assert.match(source, /Session state/);
  assert.match(source, /router\.push\('\/auth\/sign-up'\)/);
  assert.match(source, /router\.push\('\/auth\/sign-in'\)/);
});

test('mobile has a dedicated profile screen for @username routes', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../app/profile/[profile].tsx'),
    'utf8',
  );

  assert.match(source, /getProfileFromSegment/);
  assert.match(source, /@\/data\/profiles/);
  assert.match(source, /Profile not found/);
  assert.match(source, /Mobile profile/);
  assert.match(source, /\/profile\/@username/);
});
