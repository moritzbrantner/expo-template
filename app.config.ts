import type { ConfigContext, ExpoConfig } from 'expo/config';

const githubPagesBaseUrl = process.env.EXPO_PUBLIC_GITHUB_PAGES_BASE_URL;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(githubPagesBaseUrl ? { baseUrl: githubPagesBaseUrl } : {}),
  },
});
