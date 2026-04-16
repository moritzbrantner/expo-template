export const appManifest = {
  appId: 'mobile',
  slug: 'mobile',
  displayName: 'Mobile',
  platform: 'mobile',
  packageName: 'mobile',
  releaseCadence: 'independent',
  featureFlags: ['tabs', 'auth', 'profiles', 'theme'],
  deployment: {
    runtime: 'expo',
    scheme: 'mobile',
  },
} as const;
