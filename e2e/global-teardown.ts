import { execFileSync } from 'node:child_process';

export default async function globalTeardown() {
  execFileSync('docker', ['compose', 'down', '-v', '--remove-orphans', '--timeout', '1'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      COMPOSE_PROJECT_NAME: process.env.E2E_COMPOSE_PROJECT_NAME ?? 'expo-template-e2e',
    },
    stdio: 'inherit',
  });
}
