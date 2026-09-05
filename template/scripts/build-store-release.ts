import { createHash } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { checkStoreRelease } from './check-store-release';

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
  await checkStoreRelease();

  if (!/^\d+\.\d+\.\d+$/.test(easCliVersion)) {
    throw new Error('EAS_CLI_VERSION must be an exact semantic version');
  }

  const release = (await Bun.file('release.config.json').json()) as ReleaseConfig;
  const buildProfile = release.release.buildProfile;
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
      'all',
      '--profile',
      buildProfile,
      '--freeze-credentials',
      '--non-interactive',
      '--wait',
      '--json',
    ],
    { EXPO_TOKEN: releaseBuildToken },
  );
  const createdBuilds = parseJson<EasBuild[]>(buildOutput, 'eas build');
  if (!Array.isArray(createdBuilds) || createdBuilds.length !== 2) {
    throw new Error(`expected exactly two EAS builds, received ${createdBuilds.length}`);
  }

  const initialByPlatform = new Map(
    createdBuilds.map((build) => [normalizePlatform(build.platform), build]),
  );
  const iosInitial = initialByPlatform.get('ios');
  const androidInitial = initialByPlatform.get('android');
  if (!iosInitial?.id || !androidInitial?.id) {
    throw new Error('EAS build response must contain one iOS and one Android build ID');
  }

  const [iosBuild, androidBuild] = await Promise.all(
    [iosInitial.id, androidInitial.id].map(async (id) =>
      parseJson<EasBuild>(
        await runText(['eas', 'build:view', id, '--json'], { EXPO_TOKEN: releaseBuildToken }),
        `eas build:view ${id}`,
      ),
    ),
  );

  const ios = requireFinishedBuild(iosBuild, 'ios', sourceSha);
  const android = requireFinishedBuild(androidBuild, 'android', sourceSha);

  const root = path.resolve('.artifacts/mobile-release');
  const iosDirectory = path.join(root, 'ios');
  const androidDirectory = path.join(root, 'android');
  await rm(root, { recursive: true, force: true });
  await mkdir(iosDirectory, { recursive: true });
  await mkdir(androidDirectory, { recursive: true });

  const iosPath = path.join(iosDirectory, 'app.ipa');
  const androidPath = path.join(androidDirectory, 'app.aab');
  await Promise.all([
    download(ios.buildUrl, iosPath),
    download(android.buildUrl, androidPath),
  ]);

  const [iosDigest, androidDigest] = await Promise.all([
    sha256(iosPath),
    sha256(androidPath),
  ]);

  const manifest = {
    schemaVersion: 1,
    sourceSha,
    buildProfile,
    easCliVersion,
    ios: {
      buildId: ios.id,
      path: 'ios/app.ipa',
      sha256: iosDigest,
      appVersion: iosBuild.appVersion ?? null,
      appBuildVersion: iosBuild.appBuildVersion ?? null,
    },
    android: {
      buildId: android.id,
      path: 'android/app.aab',
      sha256: androidDigest,
      appVersion: androidBuild.appVersion ?? null,
      appBuildVersion: androidBuild.appBuildVersion ?? null,
    },
  };

  await Bun.write(
    path.join(root, 'mobile-release.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  console.log(`Qualified EAS binaries for ${sourceSha}`);
  console.log(`iOS build ${ios.id}: sha256:${iosDigest}`);
  console.log(`Android build ${android.id}: sha256:${androidDigest}`);
}

await main();
