export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type StarterAuthAccount = {
  displayName: string;
  username: string;
  email: string;
  password: string;
};

export type StarterAuthConfig = {
  apiUrl: string;
  account: StarterAuthAccount;
};

export type StarterAuthResult = 'created' | 'existing';

const DEFAULT_API_URL = 'http://localhost:4401';
const DEFAULT_EMAIL = 'admin@example.test';
const DEFAULT_PASSWORD = 'expo-template-local';
const DEFAULT_USERNAME = 'starter_admin';
const DEFAULT_DISPLAY_NAME = 'Expo Template Admin';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

async function readError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;

  if (payload && typeof payload.error === 'string') {
    return payload.error;
  }

  return `HTTP ${response.status}`;
}

async function signIn(
  apiUrl: string,
  account: StarterAuthAccount,
  fetchImpl: FetchLike,
): Promise<Response> {
  return fetchImpl(`${apiUrl}/auth/signin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: account.email,
      password: account.password,
    }),
  });
}

export function readStarterAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): StarterAuthConfig {
  return {
    apiUrl: trimTrailingSlash(env.EXPO_PUBLIC_AUTH_API_URL?.trim() || DEFAULT_API_URL),
    account: {
      email: env.AUTH_STARTER_EMAIL?.trim() || DEFAULT_EMAIL,
      password: env.AUTH_STARTER_PASSWORD || DEFAULT_PASSWORD,
      username: env.AUTH_STARTER_USERNAME?.trim() || DEFAULT_USERNAME,
      displayName: env.AUTH_STARTER_DISPLAY_NAME?.trim() || DEFAULT_DISPLAY_NAME,
    },
  };
}

export async function ensureStarterAccount(
  config: StarterAuthConfig,
  fetchImpl: FetchLike = globalThis.fetch,
): Promise<StarterAuthResult> {
  const initialSignIn = await signIn(config.apiUrl, config.account, fetchImpl);

  if (initialSignIn.ok) {
    return 'existing';
  }

  if (initialSignIn.status !== 401) {
    throw new Error(`Unable to check starter login: ${await readError(initialSignIn)}`);
  }

  const signUpResponse = await fetchImpl(`${config.apiUrl}/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config.account),
  });

  if (!signUpResponse.ok) {
    if (signUpResponse.status === 409) {
      throw new Error(
        'A starter email or username already exists with different credentials. Reset the local auth volume or update AUTH_STARTER_* in .env.',
      );
    }

    throw new Error(`Unable to create starter login: ${await readError(signUpResponse)}`);
  }

  const verifiedSignIn = await signIn(config.apiUrl, config.account, fetchImpl);

  if (!verifiedSignIn.ok) {
    throw new Error(`Starter login was created but verification failed: ${await readError(verifiedSignIn)}`);
  }

  return 'created';
}

export async function waitForAuthApi(
  apiUrl: string,
  {
    attempts = 40,
    delayMs = 250,
    fetchImpl = globalThis.fetch,
    sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  }: {
    attempts?: number;
    delayMs?: number;
    fetchImpl?: FetchLike;
    sleep?: (milliseconds: number) => Promise<void>;
  } = {},
): Promise<void> {
  const normalizedApiUrl = trimTrailingSlash(apiUrl);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(`${normalizedApiUrl}/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // The container may still be starting.
    }

    if (attempt < attempts) {
      await sleep(delayMs);
    }
  }

  throw new Error(`Auth API did not become healthy at ${normalizedApiUrl}.`);
}
