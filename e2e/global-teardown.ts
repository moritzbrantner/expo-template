import { execFileSync } from 'node:child_process';

export default async function globalTeardown() {
  execFileSync('docker', ['compose', 'down', '-v'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
}
