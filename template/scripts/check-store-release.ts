import config from '../app.config';

type StorePlatform = 'android' | 'ios' | 'all';

type EasConfig = {
  cli?: { requireCommit?: boolean; version?: string };
  build?: Record<
    string,
    {
      autoIncrement?: boolean;
      bun?: string;
      distribution?: string;
      android?: { buildType?: string };
    }
  >;
  submit?: Record<
    string,
    {
      ios?: { ascAppId?: string };
      android?: { track?: string; releaseStatus?: string; rollout?: number };
    }
  >;
};

type ReleaseConfig = {
  schemaVersion: number;
  appSlug: string;
  supportedLocales: string[];
  supportUrl: string;
  privacyUrl: string;
  storeReadiness?: {
    listingAssetsReady?: boolean;
    privacyDeclarationReady?: boolean;
  };
  release: {
    buildProfile: string;
    internalSubmitProfile: string;
    productionSubmitProfile: string;
  };
};

const BUN_VERSION = '1.3.12';

function requireValue(value: unknown, label: string): asserts value {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${label} must be configured before a release`);
  }
}

function requireHttps(value: string, label: string) {
  requireValue(value, label);
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error(`${label} must use https`);
  }
}

function requireProjectId() {
  const projectId = config.extra?.eas?.projectId;
  if (
    typeof projectId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
  ) {
    throw new Error('link the app to EAS and commit extra.eas.projectId before a remote release');
  }
}

function platforms(platform: StorePlatform) {
  if (platform === 'all') return ['ios', 'android'] as const;
  if (platform === 'ios' || platform === 'android') return [platform] as const;
  throw new Error('release platform must be android, ios, or all');
}

function requirePinnedBuildProfile(eas: EasConfig, profile: string, label: string) {
  const build = eas.build?.[profile];
  if (!build) throw new Error(`${label} build profile is missing`);
  if (build.bun !== BUN_VERSION) throw new Error(`${label} build profile must pin Bun ${BUN_VERSION}`);
  return build;
}

function checkCommon(eas: EasConfig, release: ReleaseConfig) {
  if (release.schemaVersion !== 1) {
    throw new Error('release.config.json must use schemaVersion 1');
  }
  if (release.appSlug !== config.slug) {
    throw new Error('release.config.json appSlug must match the Expo slug');
  }
  requireProjectId();
  if (eas.cli?.version !== '23.2.0') {
    throw new Error('eas.json must pin eas-cli 23.2.0');
  }
  if (eas.cli?.requireCommit !== true) {
    throw new Error('eas.json must require a committed source revision');
  }
}

async function checkStoreReadiness(release: ReleaseConfig) {
  if (!Array.isArray(release.supportedLocales) || release.supportedLocales.length === 0) {
    throw new Error('release.config.json must declare at least one supported locale');
  }
  requireHttps(release.supportUrl, 'supportUrl');
  requireHttps(release.privacyUrl, 'privacyUrl');

  const icon = config.icon;
  requireValue(icon, 'Expo icon');
  if (/^https?:\/\//i.test(icon)) {
    throw new Error('Expo icon must be a committed local file for store qualification');
  }
  if (!(await Bun.file(icon).exists())) {
    throw new Error(`Expo icon does not exist: ${icon}`);
  }

  if (release.storeReadiness?.listingAssetsReady !== true) {
    throw new Error('storeReadiness.listingAssetsReady must be true after listing assets are reviewed');
  }
  if (release.storeReadiness?.privacyDeclarationReady !== true) {
    throw new Error('storeReadiness.privacyDeclarationReady must be true after store privacy declarations are reviewed');
  }
}

function checkAndroid(eas: EasConfig, release: ReleaseConfig) {
  if (!config.android?.package || config.android.package.startsWith('com.example.')) {
    throw new Error('configure a permanent Android package before an Android store release');
  }
  const build = requirePinnedBuildProfile(eas, release.release.buildProfile, 'production');
  if (build.autoIncrement !== true) {
    throw new Error('the production EAS build profile must autoIncrement native build versions');
  }
  const internal = eas.submit?.[release.release.internalSubmitProfile]?.android;
  if (internal?.track !== 'internal' || internal.releaseStatus !== 'completed') {
    throw new Error('the internal Android submit profile must target the completed internal track');
  }
  const production = eas.submit?.[release.release.productionSubmitProfile]?.android;
  if (production?.track !== 'production' || production.releaseStatus !== 'draft') {
    throw new Error('the production Android submit profile must target the production track as a draft');
  }
}

function checkIos(eas: EasConfig, release: ReleaseConfig) {
  if (!config.ios?.bundleIdentifier || config.ios.bundleIdentifier.startsWith('com.example.')) {
    throw new Error('configure a permanent iOS bundleIdentifier before an iOS store release');
  }
  const build = requirePinnedBuildProfile(eas, release.release.buildProfile, 'production');
  if (build.autoIncrement !== true) {
    throw new Error('the production EAS build profile must autoIncrement native build versions');
  }
  const internalId = eas.submit?.[release.release.internalSubmitProfile]?.ios?.ascAppId;
  requireValue(internalId, 'submit.internal.ios.ascAppId');
  if (!/^\d+$/.test(internalId)) {
    throw new Error('submit.internal.ios.ascAppId must be the numeric App Store Connect app ID');
  }
  const productionId = eas.submit?.[release.release.productionSubmitProfile]?.ios?.ascAppId;
  requireValue(productionId, 'submit.production.ios.ascAppId');
  if (productionId !== internalId) {
    throw new Error('internal and production iOS submit profiles must target the same App Store Connect app');
  }
}

export async function checkStoreRelease(platform: StorePlatform = 'all') {
  const eas = (await Bun.file('eas.json').json()) as EasConfig;
  const release = (await Bun.file('release.config.json').json()) as ReleaseConfig;

  checkCommon(eas, release);
  await checkStoreReadiness(release);
  if (release.release.buildProfile !== 'production') {
    throw new Error('release.config.json buildProfile must be production for immutable store qualification');
  }

  for (const target of platforms(platform)) {
    if (target === 'android') checkAndroid(eas, release);
    if (target === 'ios') checkIos(eas, release);
  }
}

export async function checkDirectAndroidRelease() {
  const eas = (await Bun.file('eas.json').json()) as EasConfig;
  const release = (await Bun.file('release.config.json').json()) as ReleaseConfig;

  checkCommon(eas, release);
  if (!config.android?.package || config.android.package.startsWith('com.example.')) {
    throw new Error('configure a permanent Android package before a direct APK release');
  }
  const direct = requirePinnedBuildProfile(eas, 'direct', 'direct');
  if (direct.distribution !== 'internal' || direct.android?.buildType !== 'apk') {
    throw new Error('eas.json build.direct must produce an internally distributed Android APK');
  }
}

if (import.meta.main) {
  const target = process.argv[2] ?? 'all';
  if (target === 'direct-android') {
    await checkDirectAndroidRelease();
    console.log('Direct Android release configuration is complete and internally consistent.');
  } else if (target === 'android' || target === 'ios' || target === 'all') {
    await checkStoreRelease(target);
    console.log(`Store release configuration is complete for ${target}.`);
  } else {
    throw new Error('usage: check-store-release.ts [android|ios|all|direct-android]');
  }
}
