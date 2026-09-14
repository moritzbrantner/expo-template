import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const CREATE_APP_PRESETS = ['utility'] as const;
export type CreateAppPreset = (typeof CREATE_APP_PRESETS)[number];

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export type GenerateAppOptions = {
  slug: string;
  preset: CreateAppPreset;
  repositoryRoot?: string;
  outputRoot?: string;
};

const runtimeDependencies = [
  'expo',
  'expo-constants',
  'expo-linking',
  'expo-router',
  'expo-status-bar',
  'react',
  'react-dom',
  'react-native',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-web',
] as const;

const developmentDependencies = ['@types/node', '@types/react', 'typescript'] as const;

export function validateSlug(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      `Invalid app slug "${slug}". Use lower-case letters, numbers, and single hyphens only.`,
    );
  }
}

export function parsePreset(value: string | undefined): CreateAppPreset {
  const preset = value ?? 'utility';
  if (!CREATE_APP_PRESETS.includes(preset as CreateAppPreset)) {
    throw new Error(
      `Unsupported preset "${preset}". Available presets: ${CREATE_APP_PRESETS.join(', ')}.`,
    );
  }
  return preset as CreateAppPreset;
}

function titleFromSlug(slug: string) {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function requiredVersion(
  packageJson: PackageJson,
  section: 'dependencies' | 'devDependencies',
  dependency: string,
) {
  const version = packageJson[section]?.[dependency];
  if (!version) {
    throw new Error(`Canonical root package is missing ${section}.${dependency}.`);
  }
  return version;
}

export function buildUtilityAppFiles(slug: string, rootPackage: PackageJson): Map<string, string> {
  validateSlug(slug);
  const title = titleFromSlug(slug);
  const dependencies = Object.fromEntries(
    runtimeDependencies.map((dependency) => [
      dependency,
      requiredVersion(rootPackage, 'dependencies', dependency),
    ]),
  );
  const devDependencies = Object.fromEntries(
    developmentDependencies.map((dependency) => [
      dependency,
      requiredVersion(rootPackage, 'devDependencies', dependency),
    ]),
  );

  const packageJson = {
    name: `@expo-template/${slug}`,
    version: '0.1.0',
    private: true,
    main: 'expo-router/entry',
    scripts: {
      start: 'expo start',
      web: 'expo start --web',
      build: 'expo export --platform web',
      typecheck: 'tsc --noEmit',
      test: 'bun test',
    },
    dependencies,
    devDependencies,
  };

  const appJson = {
    expo: {
      name: title,
      slug,
      version: '0.1.0',
      orientation: 'portrait',
      scheme: slug,
      plugins: ['expo-router'],
      experiments: { typedRoutes: true },
      web: { bundler: 'metro' },
    },
  };

  const files: Array<readonly [string, string]> = [
    ['package.json', `${JSON.stringify(packageJson, null, 2)}\n`],
    ['app.json', `${JSON.stringify(appJson, null, 2)}\n`],
    [
      'tsconfig.json',
      `${JSON.stringify({ extends: 'expo/tsconfig.base', compilerOptions: { strict: true, types: ['node'] } }, null, 2)}\n`,
    ],
    [
      'app/_layout.tsx',
      `import { Stack } from 'expo-router';\n\nexport default function Layout() {\n  return <Stack screenOptions={{ headerBackTitle: 'Back' }} />;\n}\n`,
    ],
    [
      'lib/app-info.ts',
      `export const APP_INFO = {\n  name: ${JSON.stringify(title)},\n  slug: ${JSON.stringify(slug)},\n  privacy: 'Local-first by default. Add data collection only when the product requires it and document it explicitly.',\n} as const;\n`,
    ],
    [
      'app/index.tsx',
      `import { Link } from 'expo-router';\nimport { StatusBar } from 'expo-status-bar';\nimport { StyleSheet, Text, View } from 'react-native';\nimport { SafeAreaView } from 'react-native-safe-area-context';\n\nimport { APP_INFO } from '../lib/app-info';\n\nexport default function Home() {\n  return (\n    <SafeAreaView style={styles.safeArea}>\n      <StatusBar style="dark" />\n      <View style={styles.content}>\n        <Text style={styles.eyebrow}>UTILITY</Text>\n        <Text style={styles.title}>{APP_INFO.name}</Text>\n        <Text style={styles.body}>Replace this surface with one focused product job before promoting new shared capabilities.</Text>\n        <Link href="/settings" style={styles.link}>Settings</Link>\n        <Link href="/privacy" style={styles.link}>Privacy</Link>\n        <Link href="/about" style={styles.link}>About</Link>\n      </View>\n    </SafeAreaView>\n  );\n}\n\nconst styles = StyleSheet.create({\n  safeArea: { flex: 1, backgroundColor: '#f7f8f5' },\n  content: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },\n  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },\n  title: { fontSize: 32, fontWeight: '700' },\n  body: { fontSize: 17, lineHeight: 24 },\n  link: { fontSize: 17, textDecorationLine: 'underline' },\n});\n`,
    ],
    [
      'app/settings.tsx',
      `import { StyleSheet, Text, View } from 'react-native';\n\nexport default function Settings() {\n  return (\n    <View style={styles.page}>\n      <Text style={styles.title}>Settings</Text>\n      <Text style={styles.body}>Add only settings that correspond to real product behavior.</Text>\n    </View>\n  );\n}\n\nconst styles = StyleSheet.create({ page: { flex: 1, padding: 24, gap: 12 }, title: { fontSize: 28, fontWeight: '700' }, body: { fontSize: 17, lineHeight: 24 } });\n`,
    ],
    [
      'app/privacy.tsx',
      `import { StyleSheet, Text, View } from 'react-native';\n\nimport { APP_INFO } from '../lib/app-info';\n\nexport default function Privacy() {\n  return (\n    <View style={styles.page}>\n      <Text style={styles.title}>Privacy</Text>\n      <Text style={styles.body}>{APP_INFO.privacy}</Text>\n    </View>\n  );\n}\n\nconst styles = StyleSheet.create({ page: { flex: 1, padding: 24, gap: 12 }, title: { fontSize: 28, fontWeight: '700' }, body: { fontSize: 17, lineHeight: 24 } });\n`,
    ],
    [
      'app/about.tsx',
      `import { StyleSheet, Text, View } from 'react-native';\n\nimport { APP_INFO } from '../lib/app-info';\n\nexport default function About() {\n  return (\n    <View style={styles.page}>\n      <Text style={styles.title}>About {APP_INFO.name}</Text>\n      <Text style={styles.body}>Generated from expo-template's utility preset.</Text>\n    </View>\n  );\n}\n\nconst styles = StyleSheet.create({ page: { flex: 1, padding: 24, gap: 12 }, title: { fontSize: 28, fontWeight: '700' }, body: { fontSize: 17, lineHeight: 24 } });\n`,
    ],
    [
      'tests/app-info.test.ts',
      `import assert from 'node:assert/strict';\nimport test from 'node:test';\n\nimport { APP_INFO } from '../lib/app-info';\n\ntest('generated app identity is stable', () => {\n  assert.equal(APP_INFO.slug, ${JSON.stringify(slug)});\n  assert.equal(APP_INFO.name, ${JSON.stringify(title)});\n});\n`,
    ],
  ];

  files.sort(([left], [right]) => left.localeCompare(right));
  return new Map(files);
}

export function generateApp({
  slug,
  preset,
  repositoryRoot = process.cwd(),
  outputRoot = repositoryRoot,
}: GenerateAppOptions) {
  validateSlug(slug);
  if (preset !== 'utility') {
    throw new Error(`Preset ${preset} is not implemented.`);
  }

  const rootPackage = JSON.parse(
    readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
  ) as PackageJson;
  const files = buildUtilityAppFiles(slug, rootPackage);
  const target = join(outputRoot, 'apps', slug);

  if (existsSync(target)) {
    throw new Error(`Refusing to overwrite existing app directory: ${target}`);
  }

  for (const [relativePath, content] of files) {
    const path = join(target, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }

  return { target, files };
}
