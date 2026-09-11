import type { ConfigContext, ExpoConfig } from 'expo/config';

const githubPagesBaseUrl = process.env.EXPO_PUBLIC_GITHUB_PAGES_BASE_URL;

export default ({ config }: ConfigContext): ExpoConfig => {
  if (!config.name || !config.slug) {
    throw new Error('Expo app config requires name and slug');
  }

  return {
    ...config,
    name: config.name,
    slug: config.slug,
    plugins: [
      ...(config.plugins ?? []),
      ...(githubPagesBaseUrl ? [] : ['@reactvision/react-viro']),
    ],
    experiments: {
      ...config.experiments,
      ...(githubPagesBaseUrl ? { baseUrl: githubPagesBaseUrl } : {}),
    },
  };
};
