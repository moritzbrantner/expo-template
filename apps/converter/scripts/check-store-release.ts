type AppJson = {
  expo?: {
    slug?: string;
    ios?: { bundleIdentifier?: string };
    android?: { package?: string };
    extra?: { eas?: { projectId?: string } };
  };
};

type EasConfig = {
  cli?: { requireCommit?: boolean; version?: string };
  build?: Record<string, { autoIncrement?: boolean }>;
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
  release: {
    buildProfile: string;
    internalSubmitProfile: string;
    productionSubmitProfile: string;
  };
};

function requireValue(value: unknown, label: string): asserts value {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${label} must be configured before a store release`);
  }
}

function requireHttps(value: string, label: string) {
  requireValue(value, label);
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error(`${label} must use https`);
  }
}

export async function checkStoreRelease() {
  const app = (await Bun.file('app.json').json()) as AppJson;
  const config = app.expo ?? {};
  const eas = (await Bun.file('eas.json').json()) as EasConfig;
  const release = (await Bun.file('release.config.json').json()) as ReleaseConfig;

  if (release.schemaVersion !== 1) {
    throw new Error('release.config.json must use schemaVersion 1');
  }
  if (release.appSlug !== config.slug) {
    throw new Error('release.config.json appSlug must match the Expo slug');
  }
  if (!config.ios?.bundleIdentifier || config.ios.bundleIdentifier.startsWith('com.example.')) {
    throw new Error('configure a permanent iOS bundleIdentifier before a store release');
  }
  if (!config.android?.package || config.android.package.startsWith('com.example.')) {
    throw new Error('configure a permanent Android package before a store release');
  }

  const projectId = config.extra?.eas?.projectId;
  if (
    typeof projectId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
  ) {
    throw new Error('link the app to EAS and commit extra.eas.projectId before a store release');
  }

  if (eas.cli?.version !== '23.2.0') {
    throw new Error('eas.json must pin eas-cli 23.2.0 for the converter canary');
  }
  if (eas.cli?.requireCommit !== true) {
    throw new Error('eas.json must require a committed source revision');
  }
  if (release.release.buildProfile !== 'production') {
    throw new Error('release.config.json buildProfile must be production for immutable store qualification');
  }
  if (eas.build?.[release.release.buildProfile]?.autoIncrement !== true) {
    throw new Error('the production EAS build profile must autoIncrement native build versions');
  }

  const internal = eas.submit?.[release.release.internalSubmitProfile];
  const internalAndroid = internal?.android;
  if (internalAndroid?.track !== 'internal' || internalAndroid.releaseStatus !== 'completed') {
    throw new Error('the internal Android submit profile must target the completed internal track');
  }
  const internalIosAscAppId = internal?.ios?.ascAppId;
  requireValue(internalIosAscAppId, 'submit.internal.ios.ascAppId');
  if (!/^\d+$/.test(internalIosAscAppId)) {
    throw new Error('submit.internal.ios.ascAppId must be the numeric App Store Connect app ID');
  }

  const production = eas.submit?.[release.release.productionSubmitProfile];
  const productionAndroid = production?.android;
  if (productionAndroid?.track !== 'production') {
    throw new Error('the production Android submit profile must target the production track');
  }
  if (productionAndroid.releaseStatus !== 'draft') {
    throw new Error(
      'the converter production Android submit profile must remain draft until rollout is explicitly authorized',
    );
  }
  const productionIosAscAppId = production?.ios?.ascAppId;
  requireValue(productionIosAscAppId, 'submit.production.ios.ascAppId');
  if (productionIosAscAppId !== internalIosAscAppId) {
    throw new Error('internal and production iOS submit profiles must target the same App Store Connect app');
  }

  if (!Array.isArray(release.supportedLocales) || release.supportedLocales.length === 0) {
    throw new Error('release.config.json must declare at least one supported locale');
  }
  requireHttps(release.supportUrl, 'supportUrl');
  requireHttps(release.privacyUrl, 'privacyUrl');
}

if (import.meta.main) {
  await checkStoreRelease();
  console.log('Store release configuration is complete and internally consistent.');
}
