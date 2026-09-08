import { createHash } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { checkDirectAndroidRelease, checkStoreRelease } from './check-store-release';

type StorePlatform = 'android' | 'ios' | 'all';

type EasBuild = {
  id?: string;
  platform?: string;
  status?: string;
  gitCommitHash?: string | null;
  appVersion?: string | null;
  appBuildVersion?: string | null;
  artifacts?: { buildUrl?: string | null } | null;
};

type ReleaseConfig = {
  release: { buildProfile: string };
};

const easCliVersion = process.env.EAS_CLI_VERSION ?? '23.2.0';
const releaseBuildToken = process.env.RELEASE_BUILD_TOKEN;

function requireToken(token: string | undefined): asserts token is string {
  if (!token) {
    throw new Error('RELEASE_BUILD_TOKEN is required for the credentialed EAS build step');
  }
}

async function runText(command: string[], env: Record<string, string | undefined> = {}) {
  const child = Bun.spawn(command, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'inherit',
  });
  const stdout = await new Response(child.stdout).text();
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`${command.join(' ')} failed with exit code ${exitCode}`);
  }
  return stdout.trim();
}

function parseJson<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`${label} did not return valid JSON`, { cause: error });
  }
}

function normalizePlatform(value: string | undefined) {
  return value?.toLowerCase();
}

function targets(platform: StorePlatform) {
  return platform === 'all' ? (['ios', 'android'] as const) : ([platform] as const);
}

function requireFinishedBuild(build: EasBuild, platform: 'ios' | 'android', sourceSha: string) {
  if (!build.id) {
    throw new Error(`${platform} build is missing an EAS Build ID`);
  }
  if (normalizePlatform(build.platform) !== platform) {
    throw new Error(`expected ${platform} build metadata but received ${build.platform ?? 'unknown'}`);
  }
  if (build.status?.toLowerCase() !== 'finished') {
    throw new Error(`${platform} EAS build ${build.id} is not finished: ${build.status ?? 'unknown'}`);
  }
  if (build.gitCommitHash?.toLowerCase() !== sourceSha) {
    throw new Error(`${platform} EAS build ${build.id} is not bound to source ${sourceSha}`);
  }
  const buildUrl = build.artifacts?.buildUrl;
  if (!buildUrl || new URL(buildUrl).protocol !== 'https:') {
    throw new Error(`${platform} EAS build ${build.id} has no HTTPS application artifact URL`);
  }
  return { id: build.id, buildUrl };
}

async function download(url: string, destination: string) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`failed to download EAS artifact: HTTP ${response.status}`);
  }
  await Bun.write(destination, await response.arrayBuffer());
  if (Bun.file(destination).size === 0) {
    throw new Error(`downloaded EAS artifact is empty: ${destination}`);
  }
}

async function sha256(filePath: string) {
  const bytes = await Bun.file(filePath).arrayBuffer();
  return createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
}

async function main() {
  requireToken(releaseBuildToken);
  const requested = process.argv[2] ?? 'all';
  const direct = requested === 'direct-android';
  if (!direct && requested !== 'android' && requested !== 'ios' && requested !== 'all') {
    throw new Error('usage: build-store-release.ts [android|ios|all|direct-android]');
  }

  const release = (await Bun.file('release.config.json').json()) as ReleaseConfig;
  const platform = direct ? 'android' : (requested as StorePlatform);
  const buildProfile = direct ? 'direct' : release.release.buildProfile;
  if (direct) {
    await checkDirectAndroidRelease();
  } else {
    await checkStoreRelease(platform);
  }

  if (!/^\d+\.\d+\.\d+$/.test(easCliVersion)) {
    throw new Error('EAS_CLI_VERSION must be an exact semantic version');
  }

  const sourceSha = (await runText(['git', 'rev-parse', 'HEAD'])).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) {
    throw new Error('release build must start from an exact Git commit');
  }

  const versionOutput = await runText(['eas', '--version']);
  const versionMatch = versionOutput.match(/eas-cli\/(\d+\.\d+\.\d+)/);
  if (versionMatch?.[1] !== easCliVersion) {
    throw new Error(`expected eas-cli ${easCliVersion}, received ${versionOutput}`);
  }

  const buildOutput = await runText(
    [
      'eas',
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
    { EXPO_TOKEN: releaseBuildToken },
  );
  const parsed = parseJson<EasBuild[] | EasBuild>(buildOutput, 'eas build');
  const createdBuilds = Array.isArray(parsed) ? parsed : [parsed];
  const expectedTargets = direct ? (['android'] as const) : targets(platform);
  if (createdBuilds.length !== expectedTargets.length) {
    throw new Error(`expected ${expectedTargets.length} EAS build(s), received ${createdBuilds.length}`);
  }

  const initialByPlatform = new Map(
    createdBuilds.map((build) => [normalizePlatform(build.platform), build]),
  );
  const resolvedBuilds = new Map<'ios' | 'android', EasBuild>();
  for (const target of expectedTargets) {
    const initial = initialByPlatform.get(target);
    if (!initial?.id) {
      throw new Error(`EAS build response must contain a ${target} build ID`);
    }
    const build = parseJson<EasBuild>(
      await runText(['eas', 'build:view', initial.id, '--json'], { EXPO_TOKEN: releaseBuildToken }),
      `eas build:view ${initial.id}`,
    );
    requireFinishedBuild(build, target, sourceSha);
    resolvedBuilds.set(target, build);
  }

  if (direct) {
    const androidBuild = resolvedBuilds.get('android');
    if (!androidBuild) throw new Error('direct Android build metadata is missing');
    const android = requireFinishedBuild(androidBuild, 'android', sourceSha);
    const root = path.resolve('.artifacts/android-direct');
    await rm(root, { recursive: true, force: true });
    await mkdir(root, { recursive: true });
    const apkPath = path.join(root, 'app.apk');
    await download(android.buildUrl, apkPath);
    const digest = await sha256(apkPath);
    await Bun.write(
      path.join(root, 'android-direct.json'),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          sourceSha,
          buildProfile,
          easCliVersion,
          android: {
            buildId: android.id,
            path: 'app.apk',
            sha256: digest,
            appVersion: androidBuild.appVersion ?? null,
            appBuildVersion: androidBuild.appBuildVersion ?? null,
          },
        },
        null,
        2,
      )}\n`,
    );
    console.log(`Qualified direct Android APK ${android.id}: sha256:${digest}`);
    return;
  }

  const root = path.resolve('.artifacts/mobile-release');
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  const manifest: Record<string, unknown> = {
    schemaVersion: 1,
    sourceSha,
    buildProfile,
    easCliVersion,
  };

  for (const target of expectedTargets) {
    const build = resolvedBuilds.get(target);
    if (!build) throw new Error(`${target} build metadata is missing`);
    const finished = requireFinishedBuild(build, target, sourceSha);
    const directory = path.join(root, target);
    await mkdir(directory, { recursive: true });
    const filename = target === 'android' ? 'app.aab' : 'app.ipa';
    const filePath = path.join(directory, filename);
    await download(finished.buildUrl, filePath);
    const digest = await sha256(filePath);
    manifest[target] = {
      buildId: finished.id,
      path: `${target}/${filename}`,
      sha256: digest,
      appVersion: build.appVersion ?? null,
      appBuildVersion: build.appBuildVersion ?? null,
    };
    console.log(`${target} build ${finished.id}: sha256:${digest}`);
  }

  await Bun.write(
    path.join(root, 'mobile-release.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(`Qualified ${platform} EAS binaries for ${sourceSha}`);
}

await main();
