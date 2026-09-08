import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, '../..');
const EAS_CLI_VERSION = '23.2.0';
const BUN_VERSION = '1.3.12';
const PLATFORMS = new Set(['android', 'ios', 'all']);
const STORE_PROFILES = new Set(['internal', 'production']);

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const action = argv[2];
  const options = { app: undefined, platform: 'all', profile: 'internal' };
  for (let index = 3; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--app' || argument === '--platform' || argument === '--profile') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) fail(`${argument} requires a value`);
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    fail(`unknown argument: ${argument}`);
  }
  return { action, ...options };
}

function resolveAppDirectory(app) {
  if (!app) fail('--app is required (for example: --app apps/tasks)');
  const resolved = path.resolve(REPO_ROOT, app);
  const appsRoot = path.resolve(REPO_ROOT, 'apps');
  if (resolved === appsRoot || !resolved.startsWith(`${appsRoot}${path.sep}`)) {
    fail('--app must point to a project below apps/');
  }
  return resolved;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function run(command, args, { cwd = REPO_ROOT, env = {} } = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  let stdout = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  if (exitCode !== 0) fail(`${command} ${args.join(' ')} failed with exit code ${exitCode}`);
  return stdout.trim();
}

function requireValue(value, label) {
  if (value === undefined || value === null || value === '') fail(`${label} must be configured`);
  return value;
}

function requireHttps(value, label) {
  requireValue(value, label);
  const url = new URL(value);
  if (url.protocol !== 'https:') fail(`${label} must use https`);
}

function requirePermanentIdentifier(value, label) {
  requireValue(value, label);
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(value)) {
    fail(`${label} must be a reverse-DNS native identifier`);
  }
  if (value.startsWith('com.example.') || value.includes('.example.')) {
    fail(`${label} must not use an example namespace`);
  }
}

function platformList(platform) {
  if (!PLATFORMS.has(platform)) fail(`--platform must be one of: ${[...PLATFORMS].join(', ')}`);
  return platform === 'all' ? ['ios', 'android'] : [platform];
}

function requirePinnedBuildProfile(eas, profile, label) {
  const build = eas.build?.[profile];
  if (!build) fail(`${label} build profile is missing`);
  if (build.bun !== BUN_VERSION) fail(`${label} build profile must pin Bun ${BUN_VERSION}`);
  return build;
}

async function resolvedExpoConfig(appDirectory) {
  const output = await run('bunx', ['expo', 'config', '--json'], { cwd: appDirectory });
  return JSON.parse(output);
}

async function loadReleaseState(appDirectory) {
  const [expo, eas, release] = await Promise.all([
    resolvedExpoConfig(appDirectory),
    readJson(path.join(appDirectory, 'eas.json')),
    readJson(path.join(appDirectory, 'release.config.json')),
  ]);
  return { expo, eas, release };
}

function checkCommon({ expo, eas, release }) {
  if (release.schemaVersion !== 1) fail('release.config.json must use schemaVersion 1');
  if (release.appSlug !== expo.slug) fail('release.config.json appSlug must match the Expo slug');
  if (eas.cli?.version !== EAS_CLI_VERSION) fail(`eas.json must pin eas-cli ${EAS_CLI_VERSION}`);
  if (eas.cli?.requireCommit !== true) fail('eas.json must require a committed source revision');
  const projectId = expo.extra?.eas?.projectId;
  if (
    typeof projectId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
  ) {
    fail('link the app to EAS and commit extra.eas.projectId before a remote release');
  }
}

function checkAndroidStore({ expo, eas, release }) {
  requirePermanentIdentifier(expo.android?.package, 'Android package');
  const buildProfile = release.release?.buildProfile;
  if (buildProfile !== 'production') fail('the store build profile must be production');
  const productionBuild = requirePinnedBuildProfile(eas, buildProfile, 'production');
  if (productionBuild.autoIncrement !== true) {
    fail('the production Android build profile must autoIncrement native versions');
  }
  const internal = eas.submit?.[release.release?.internalSubmitProfile]?.android;
  if (internal?.track !== 'internal' || internal.releaseStatus !== 'completed') {
    fail('the internal Android submit profile must target the completed internal track');
  }
  const production = eas.submit?.[release.release?.productionSubmitProfile]?.android;
  if (production?.track !== 'production' || production.releaseStatus !== 'draft') {
    fail('the production Android submit profile must target the production track as a draft');
  }
}

function checkIosStore({ expo, eas, release }) {
  requirePermanentIdentifier(expo.ios?.bundleIdentifier, 'iOS bundleIdentifier');
  const buildProfile = release.release?.buildProfile;
  if (buildProfile !== 'production') fail('the store build profile must be production');
  const productionBuild = requirePinnedBuildProfile(eas, buildProfile, 'production');
  if (productionBuild.autoIncrement !== true) {
    fail('the production iOS build profile must autoIncrement native versions');
  }
  const internalId = eas.submit?.[release.release?.internalSubmitProfile]?.ios?.ascAppId;
  requireValue(internalId, 'submit.internal.ios.ascAppId');
  if (!/^\d+$/.test(internalId)) fail('submit.internal.ios.ascAppId must be numeric');
  const productionId = eas.submit?.[release.release?.productionSubmitProfile]?.ios?.ascAppId;
  requireValue(productionId, 'submit.production.ios.ascAppId');
  if (productionId !== internalId) {
    fail('internal and production iOS profiles must target the same App Store Connect app');
  }
}

async function checkStoreReadiness({ expo, release }, appDirectory) {
  if (!Array.isArray(release.supportedLocales) || release.supportedLocales.length === 0) {
    fail('release.config.json must declare at least one supported locale');
  }
  requireHttps(release.supportUrl, 'supportUrl');
  requireHttps(release.privacyUrl, 'privacyUrl');

  const icon = requireValue(expo.icon, 'Expo icon');
  if (/^https?:\/\//i.test(icon)) {
    fail('Expo icon must be a committed local file for store qualification');
  }
  try {
    await access(path.resolve(appDirectory, icon));
  } catch {
    fail(`Expo icon does not exist: ${icon}`);
  }

  if (release.storeReadiness?.listingAssetsReady !== true) {
    fail('storeReadiness.listingAssetsReady must be true after icons/screenshots/listing assets are reviewed');
  }
  if (release.storeReadiness?.privacyDeclarationReady !== true) {
    fail('storeReadiness.privacyDeclarationReady must be true after store privacy/data declarations are reviewed');
  }
}

async function preflight(appDirectory, platform) {
  const state = await loadReleaseState(appDirectory);
  checkCommon(state);
  await checkStoreReadiness(state, appDirectory);
  for (const target of platformList(platform)) {
    if (target === 'android') checkAndroidStore(state);
    if (target === 'ios') checkIosStore(state);
  }
  return state;
}

async function directPreflight(appDirectory) {
  const state = await loadReleaseState(appDirectory);
  checkCommon(state);
  requirePermanentIdentifier(state.expo.android?.package, 'Android package');
  const direct = requirePinnedBuildProfile(state.eas, 'direct', 'direct');
  if (direct.distribution !== 'internal' || direct.android?.buildType !== 'apk') {
    fail('eas.json build.direct must produce an internally distributed Android APK');
  }
  return state;
}

async function exactSourceSha() {
  const sourceSha = (await run('git', ['rev-parse', 'HEAD'])).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) fail('release must start from an exact Git commit');
  const status = await run('git', ['status', '--porcelain']);
  if (status) fail('release must start from a clean Git worktree');
  return sourceSha;
}

async function requireEasCli(appDirectory) {
  const version = await run('eas', ['--version'], { cwd: appDirectory });
  const match = version.match(/eas-cli\/(\d+\.\d+\.\d+)/);
  if (match?.[1] !== EAS_CLI_VERSION) fail(`expected eas-cli ${EAS_CLI_VERSION}, received ${version}`);
}

function releaseToken() {
  const token = process.env.RELEASE_BUILD_TOKEN ?? process.env.EXPO_TOKEN;
  if (!token) fail('RELEASE_BUILD_TOKEN or EXPO_TOKEN is required for a credentialed EAS operation');
  return token;
}

function parseBuilds(output) {
  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function normalizePlatform(value) {
  return value?.toLowerCase();
}

async function buildView(appDirectory, id, token) {
  return JSON.parse(
    await run('eas', ['build:view', id, '--json'], {
      cwd: appDirectory,
      env: { EXPO_TOKEN: token },
    }),
  );
}

function validateFinishedBuild(build, platform, sourceSha) {
  if (!build.id) fail(`${platform} build is missing an EAS Build ID`);
  if (normalizePlatform(build.platform) !== platform) fail(`expected ${platform} build metadata`);
  if (build.status?.toLowerCase() !== 'finished') fail(`${platform} build ${build.id} is not finished`);
  if (build.gitCommitHash?.toLowerCase() !== sourceSha) {
    fail(`${platform} build ${build.id} is not bound to source ${sourceSha}`);
  }
  const buildUrl = build.artifacts?.buildUrl;
  if (!buildUrl || new URL(buildUrl).protocol !== 'https:') {
    fail(`${platform} build ${build.id} has no HTTPS artifact URL`);
  }
  return buildUrl;
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) fail(`failed to download EAS artifact: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) fail(`downloaded EAS artifact is empty: ${destination}`);
  await writeFile(destination, bytes);
  return createHash('sha256').update(bytes).digest('hex');
}

async function buildStore(appDirectory, platform) {
  const state = await preflight(appDirectory, platform);
  const token = releaseToken();
  await requireEasCli(appDirectory);
  const sourceSha = await exactSourceSha();
  const buildProfile = state.release.release.buildProfile;
  const buildOutput = await run(
    'eas',
    [
      'build',
      '--platform',
      platform,
      '--profile',
      buildProfile,
      '--freeze-credentials',
      '--non-interactive',
      '--wait',
      '--json',
    ],
    { cwd: appDirectory, env: { EXPO_TOKEN: token } },
  );
  const created = parseBuilds(buildOutput);
  const targets = platformList(platform);
  if (created.length !== targets.length) {
    fail(`expected ${targets.length} EAS build(s), received ${created.length}`);
  }

  const byPlatform = new Map(created.map((build) => [normalizePlatform(build.platform), build]));
  const artifactRoot = path.join(appDirectory, '.artifacts/mobile-release');
  await rm(artifactRoot, { recursive: true, force: true });
  await mkdir(artifactRoot, { recursive: true });

  const manifest = {
    schemaVersion: 1,
    appSlug: state.expo.slug,
    sourceSha,
    buildProfile,
    easCliVersion: EAS_CLI_VERSION,
    bunVersion: BUN_VERSION,
  };

  for (const target of targets) {
    const initial = byPlatform.get(target);
    if (!initial?.id) fail(`EAS build response must contain a ${target} build ID`);
    const build = await buildView(appDirectory, initial.id, token);
    const url = validateFinishedBuild(build, target, sourceSha);
    const directory = path.join(artifactRoot, target);
    await mkdir(directory, { recursive: true });
    const filename = target === 'android' ? 'app.aab' : 'app.ipa';
    const relativePath = `${target}/${filename}`;
    const digest = await download(url, path.join(directory, filename));
    manifest[target] = {
      buildId: build.id,
      path: relativePath,
      sha256: digest,
      appVersion: build.appVersion ?? null,
      appBuildVersion: build.appBuildVersion ?? null,
    };
  }

  await writeFile(
    path.join(artifactRoot, 'mobile-release.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(`Qualified ${state.expo.slug} ${platform} release for ${sourceSha}`);
}

async function buildDirectAndroid(appDirectory) {
  const state = await directPreflight(appDirectory);
  const token = releaseToken();
  await requireEasCli(appDirectory);
  const sourceSha = await exactSourceSha();
  const output = await run(
    'eas',
    [
      'build',
      '--platform',
      'android',
      '--profile',
      'direct',
      '--freeze-credentials',
      '--non-interactive',
      '--wait',
      '--json',
    ],
    { cwd: appDirectory, env: { EXPO_TOKEN: token } },
  );
  const created = parseBuilds(output);
  if (created.length !== 1 || !created[0]?.id) fail('expected exactly one Android direct build');
  const build = await buildView(appDirectory, created[0].id, token);
  const url = validateFinishedBuild(build, 'android', sourceSha);
  const artifactRoot = path.join(appDirectory, '.artifacts/android-direct');
  await rm(artifactRoot, { recursive: true, force: true });
  await mkdir(artifactRoot, { recursive: true });
  const apkPath = path.join(artifactRoot, 'app.apk');
  const digest = await download(url, apkPath);
  await writeFile(
    path.join(artifactRoot, 'android-direct.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        appSlug: state.expo.slug,
        sourceSha,
        buildProfile: 'direct',
        easCliVersion: EAS_CLI_VERSION,
        bunVersion: BUN_VERSION,
        android: {
          buildId: build.id,
          path: 'app.apk',
          sha256: digest,
          appVersion: build.appVersion ?? null,
          appBuildVersion: build.appBuildVersion ?? null,
        },
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Qualified direct Android APK for ${state.expo.slug} at ${sourceSha}`);
}

async function submitStore(appDirectory, platform, profile) {
  if (!STORE_PROFILES.has(profile)) {
    fail(`--profile must be one of: ${[...STORE_PROFILES].join(', ')}`);
  }
  await preflight(appDirectory, platform);
  const token = releaseToken();
  await requireEasCli(appDirectory);
  const sourceSha = await exactSourceSha();
  const manifest = await readJson(path.join(appDirectory, '.artifacts/mobile-release/mobile-release.json'));
  if (manifest.schemaVersion !== 1 || manifest.sourceSha !== sourceSha) {
    fail('mobile-release.json must describe the current exact source commit');
  }
  for (const target of platformList(platform)) {
    const buildId = manifest[target]?.buildId;
    requireValue(buildId, `${target} qualified build ID`);
    await run(
      'eas',
      ['submit', '--platform', target, '--id', buildId, '--profile', profile, '--non-interactive'],
      { cwd: appDirectory, env: { EXPO_TOKEN: token } },
    );
  }
}

async function fleetCheck() {
  const appsRoot = path.join(REPO_ROOT, 'apps');
  const entries = await readdir(appsRoot, { withFileTypes: true });
  const failures = [];
  let appCount = 0;

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) continue;
    const appDirectory = path.join(appsRoot, entry.name);
    let app;
    try {
      app = await readJson(path.join(appDirectory, 'app.json'));
    } catch {
      continue;
    }
    if (!app.expo?.slug) continue;
    appCount += 1;

    try {
      const [eas, release, expo] = await Promise.all([
        readJson(path.join(appDirectory, 'eas.json')),
        readJson(path.join(appDirectory, 'release.config.json')),
        resolvedExpoConfig(appDirectory),
      ]);
      if (release.schemaVersion !== 1 || release.appSlug !== expo.slug) {
        fail('release config does not match app slug');
      }
      if (eas.cli?.version !== EAS_CLI_VERSION || eas.cli?.requireCommit !== true) {
        fail('EAS CLI/source policy is not pinned');
      }
      const production = requirePinnedBuildProfile(eas, 'production', 'production');
      if (production.autoIncrement !== true) fail('production build must autoIncrement');
      const direct = requirePinnedBuildProfile(eas, 'direct', 'direct');
      if (direct.distribution !== 'internal' || direct.android?.buildType !== 'apk') {
        fail('direct Android APK profile is missing');
      }
      requirePermanentIdentifier(expo.ios?.bundleIdentifier, 'iOS bundleIdentifier');
      requirePermanentIdentifier(expo.android?.package, 'Android package');
      if (!Array.isArray(release.supportedLocales) || release.supportedLocales.length === 0) {
        fail('supportedLocales is empty');
      }
      if (
        typeof release.storeReadiness?.listingAssetsReady !== 'boolean' ||
        typeof release.storeReadiness?.privacyDeclarationReady !== 'boolean'
      ) {
        fail('store readiness gates are missing');
      }
    } catch (error) {
      failures.push(`${entry.name}: ${error.message}`);
    }
  }

  if (appCount === 0) fail('no Expo apps found below apps/');
  if (failures.length) fail(`mobile release scaffold drift:\n${failures.join('\n')}`);
  console.log(`Mobile release scaffold is present for ${appCount} Expo apps.`);
}

const { action, app, platform, profile } = parseArgs(process.argv);
if (action === 'fleet-check') {
  await fleetCheck();
} else {
  const appDirectory = resolveAppDirectory(app);
  if (action === 'preflight') {
    await preflight(appDirectory, platform);
    console.log(`Store release preflight passed for ${app} (${platform}).`);
  } else if (action === 'preflight-direct') {
    await directPreflight(appDirectory);
    console.log(`Direct Android preflight passed for ${app}.`);
  } else if (action === 'build') {
    await buildStore(appDirectory, platform);
  } else if (action === 'submit') {
    await submitStore(appDirectory, platform, profile);
  } else if (action === 'direct-android') {
    await buildDirectAndroid(appDirectory);
  } else {
    fail(
      'usage: mobile-release.mjs <fleet-check|preflight|preflight-direct|build|submit|direct-android> [--app apps/<name>] [--platform android|ios|all] [--profile internal|production]',
    );
  }
}
