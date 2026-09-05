import { spawn } from 'node:child_process';

import { ensureStarterAccount, readStarterAuthConfig, waitForAuthApi } from './local-auth';

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}.`));
    });
  });
}

async function main() {
  const config = readStarterAuthConfig();

  await run('docker', ['compose', 'up', '-d', 'auth-api', 'mailpit']);
  await waitForAuthApi(config.apiUrl);
  const result = await ensureStarterAccount(config);

  console.log(`Local auth is ready at ${config.apiUrl}.`);
  console.log(`Starter account ${result === 'created' ? 'created' : 'already ready'}: ${config.account.email}`);
  console.log('Use AUTH_STARTER_PASSWORD from .env to sign in.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
