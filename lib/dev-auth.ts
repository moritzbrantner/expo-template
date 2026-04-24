import { ApiRequestError, signInRequest, signUpRequest, type SessionUser } from '@/lib/auth';

type DevelopmentSessionCredentials = {
  displayName: string;
  username: string;
  email: string;
  password: string;
};

type BootstrapDevelopmentSessionResult = {
  token: string;
  user: SessionUser;
};

const DEFAULT_DEVELOPMENT_SESSION_CREDENTIALS: DevelopmentSessionCredentials = {
  displayName: 'Dev Admin',
  username: 'dev_admin',
  email: 'admin@example.test',
  password: 'password123',
};

const RETRYABLE_NETWORK_ERROR_MESSAGES = ['fetch failed', 'network request failed', 'load failed'];

function normalizeFlag(value: string | undefined): boolean | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }

  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false;
  }

  return null;
}

function isRetryableNetworkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.trim().toLowerCase();
  return RETRYABLE_NETWORK_ERROR_MESSAGES.includes(message);
}

function sleep(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

export function shouldEnableDevelopmentSessionBootstrap(environment: NodeJS.ProcessEnv = process.env) {
  const explicitFlag = normalizeFlag(environment.EXPO_PUBLIC_DEV_AUTH_AUTO_SIGN_IN);

  if (explicitFlag !== null) {
    return explicitFlag;
  }

  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function getDevelopmentSessionCredentials(
  environment: NodeJS.ProcessEnv = process.env,
): DevelopmentSessionCredentials {
  return {
    displayName:
      environment.EXPO_PUBLIC_DEV_AUTH_DISPLAY_NAME?.trim() ||
      DEFAULT_DEVELOPMENT_SESSION_CREDENTIALS.displayName,
    username:
      environment.EXPO_PUBLIC_DEV_AUTH_USERNAME?.trim() ||
      DEFAULT_DEVELOPMENT_SESSION_CREDENTIALS.username,
    email:
      environment.EXPO_PUBLIC_DEV_AUTH_EMAIL?.trim().toLowerCase() ||
      DEFAULT_DEVELOPMENT_SESSION_CREDENTIALS.email,
    password:
      environment.EXPO_PUBLIC_DEV_AUTH_PASSWORD ?? DEFAULT_DEVELOPMENT_SESSION_CREDENTIALS.password,
  };
}

async function signInOrCreateDevelopmentUser(
  credentials: DevelopmentSessionCredentials,
): Promise<BootstrapDevelopmentSessionResult> {
  try {
    return await signInRequest({
      email: credentials.email,
      password: credentials.password,
    });
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401) {
      throw error;
    }
  }

  try {
    await signUpRequest(credentials);
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 409) {
      throw error;
    }
  }

  return signInRequest({
    email: credentials.email,
    password: credentials.password,
  });
}

export async function bootstrapDevelopmentSession(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<BootstrapDevelopmentSessionResult> {
  const credentials = getDevelopmentSessionCredentials(environment);
  const maxAttempts = 6;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await signInOrCreateDevelopmentUser(credentials);
    } catch (error) {
      const shouldRetry = isRetryableNetworkError(error) && attempt < maxAttempts - 1;

      if (!shouldRetry) {
        throw error;
      }

      await sleep(500 * (attempt + 1));
    }
  }

  throw new Error('Unable to bootstrap a development session.');
}
