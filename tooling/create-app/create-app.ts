import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CREATE_APP_PRESETS = {
  utility: { profile: 'minimal', navigation: 'stack' },
  standard: { profile: 'local-first', navigation: 'tabs' },
} as const;

export type CreateAppPreset = keyof typeof CREATE_APP_PRESETS;
export type CreateAppNavigation = 'stack' | 'tabs';

export type CreateAppOptions = {
  slug: string;
  appName: string;
  preset: CreateAppPreset;
  navigation: CreateAppNavigation;
  dryRun: boolean;
};

export type CreateAppPlan = CreateAppOptions & {
  profile: (typeof CREATE_APP_PRESETS)[CreateAppPreset]['profile'];
  packageName: string;
  workspacePath: string;
};

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function usage() {
  return [
    'Usage: bun run create-app -- <slug> [options]',
    '',
    'Options:',
    '  --name <name>               Human-readable app name',
    '  --preset <utility|standard> Preset (default: utility)',
    '  --navigation <stack|tabs>   Override the preset navigation shape',
    '  --dry-run                   Print the deterministic plan without writing files',
  ].join('\n');
}

function defaultAppName(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

function readValue(args: string[], index: number, flag: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

export function parseCreateAppArgs(args: string[]): CreateAppOptions {
  let slug: string | undefined;
  let appName: string | undefined;
  let preset: CreateAppPreset = 'utility';
  let navigation: CreateAppNavigation | undefined;
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') {
      throw new Error(usage());
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--name') {
      appName = readValue(args, index, '--name');
      index += 1;
      continue;
    }
    if (arg === '--preset') {
      const value = readValue(args, index, '--preset');
      if (!(value in CREATE_APP_PRESETS)) {
        throw new Error(`Unsupported preset "${value}". Use utility or standard.`);
      }
      preset = value as CreateAppPreset;
      index += 1;
      continue;
    }
    if (arg === '--navigation') {
      const value = readValue(args, index, '--navigation');
      if (value !== 'stack' && value !== 'tabs') {
        throw new Error(`Unsupported navigation "${value}". Use stack or tabs.`);
      }
      navigation = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--')) {
      throw new Error(`Unknown option "${arg}".\n\n${usage()}`);
    }
    if (slug) {
      throw new Error(`Unexpected positional argument "${arg}".\n\n${usage()}`);
    }
    slug = arg;
  }

  if (!slug) {
    throw new Error(`Missing app slug.\n\n${usage()}`);
  }
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      `Invalid app slug "${slug}". Use lowercase letters, digits, and single hyphens.`,
    );
  }

  return {
    slug,
    appName: appName?.trim() || defaultAppName(slug),
    preset,
    navigation: navigation ?? CREATE_APP_PRESETS[preset].navigation,
    dryRun,
  };
}

export function createAppPlan(options: CreateAppOptions): CreateAppPlan {
  return {
    ...options,
    profile: CREATE_APP_PRESETS[options.preset].profile,
    packageName: `@expo-template/${options.slug}`,
    workspacePath: `apps/${options.slug}`,
  };
}

export function buildCopierArgs(plan: CreateAppPlan, source: string, destination: string) {
  return [
    'copy',
    '--trust',
    '--defaults',
    '--data',
    `app_name=${plan.appName}`,
    '--data',
    `app_slug=${plan.slug}`,
    '--data',
    `package_name=${plan.packageName}`,
    '--data',
    `profile=${plan.profile}`,
    '--data',
    `navigation=${plan.navigation}`,
    source,
    destination,
  ];
}

export function registerWorkspace(packageJsonText: string, workspacePath: string) {
  const packageJson = JSON.parse(packageJsonText) as { workspaces?: unknown } & Record<
    string,
    unknown
  >;
  const workspaces = Array.isArray(packageJson.workspaces)
    ? packageJson.workspaces.filter((candidate): candidate is string => typeof candidate === 'string')
    : [];

  packageJson.workspaces = [...new Set([...workspaces, workspacePath])].sort((left, right) =>
    left.localeCompare(right),
  );
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

function run(command: string, args: string[], cwd: string, missingHint?: string) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === 'ENOENT' && missingHint) {
      throw new Error(missingHint);
    }
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}.`);
  }
}

function restoreFile(path: string, original: Buffer | null) {
  if (original === null) {
    if (existsSync(path)) unlinkSync(path);
    return;
  }
  writeFileSync(path, original);
}

export function createApp(options: CreateAppOptions, repoRoot = REPO_ROOT) {
  const plan = createAppPlan(options);
  const destination = join(repoRoot, plan.workspacePath);
  const appsDirectory = join(repoRoot, 'apps');
  const rootPackagePath = join(repoRoot, 'package.json');
  const rootLockPath = join(repoRoot, 'bun.lock');

  if (options.dryRun) {
    console.log(JSON.stringify(plan, null, 2));
    return plan;
  }
  if (existsSync(destination)) {
    throw new Error(`${plan.workspacePath} already exists; create-app never overwrites apps.`);
  }
  if (!existsSync(rootPackagePath)) {
    throw new Error('create-app must run from the expo-template repository layout.');
  }

  mkdirSync(appsDirectory, { recursive: true });
  const temporaryDestination = mkdtempSync(join(appsDirectory, `.create-${plan.slug}-`));
  const originalPackage = readFileSync(rootPackagePath);
  const originalLock = existsSync(rootLockPath) ? readFileSync(rootLockPath) : null;
  let destinationMoved = false;

  try {
    run(
      'copier',
      buildCopierArgs(plan, repoRoot, temporaryDestination),
      repoRoot,
      "Copier is required. Install Copier 9.x before running create-app.",
    );

    const generatedPackagePath = join(temporaryDestination, 'package.json');
    const generatedPackage = JSON.parse(readFileSync(generatedPackagePath, 'utf8')) as {
      name?: unknown;
      private?: unknown;
    };
    if (generatedPackage.name !== plan.packageName || generatedPackage.private !== true) {
      throw new Error('Generated package identity does not match the requested workspace app.');
    }

    renameSync(temporaryDestination, destination);
    destinationMoved = true;
    writeFileSync(
      rootPackagePath,
      registerWorkspace(originalPackage.toString('utf8'), plan.workspacePath),
    );

    run('bun', ['install'], repoRoot, 'Bun is required to register the workspace lockfile.');
    console.log(
      `Created ${relative(repoRoot, destination)} with ${plan.preset} (${plan.profile}) preset.`,
    );
    return plan;
  } catch (error) {
    if (destinationMoved && existsSync(destination)) {
      rmSync(destination, { recursive: true, force: true });
    }
    restoreFile(rootPackagePath, originalPackage);
    restoreFile(rootLockPath, originalLock);
    throw error;
  } finally {
    if (existsSync(temporaryDestination)) {
      rmSync(temporaryDestination, { recursive: true, force: true });
    }
  }
}

function main() {
  try {
    createApp(parseCreateAppArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

const entrypoint = process.argv[1] ? resolve(process.argv[1]) : '';
if (entrypoint === fileURLToPath(import.meta.url)) {
  main();
}
