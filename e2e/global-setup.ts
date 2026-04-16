import { execFileSync } from 'node:child_process';

const PROJECT_ROOT = process.cwd();
const AUTH_API_URL = 'http://127.0.0.1:4401/health';
const MAILPIT_URL = 'http://127.0.0.1:8825/api/v1/messages';

async function waitFor(url: string, label: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 90_000) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for ${label}.`);
}

export default async function globalSetup() {
  const composeArgs =
    process.env.E2E_FORCE_BUILD === '1'
      ? ['compose', 'up', '-d', '--build']
      : ['compose', 'up', '-d'];

  execFileSync('docker', composeArgs, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });

  await waitFor(AUTH_API_URL, 'auth-api');
  await waitFor(MAILPIT_URL, 'mailpit');
}
