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
  assert.match(source, /Server users/);
  assert.match(source, /GET \/users/);
  assert.match(source, /Reload users/);
  assert.match(source, /Websockets/);
  assert.match(source, /CRDTs/);
  assert.match(source, /Communication topic/);
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
