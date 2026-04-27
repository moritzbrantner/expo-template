export const appManifest = {
  appId: 'mobile',
  slug: 'mobile',
  displayName: 'Mobile',
  platform: 'mobile',
  packageName: 'mobile',
  entryWorkspace: '.',
  releaseCadence: 'independent',
  sharedPackages: [],
  featureFlags: ['navigation', 'tabs', 'auth', 'social', 'profiles', 'theme'],
  deployment: {
    runtime: 'expo',
    scheme: 'mobile',
  },
} as const;
