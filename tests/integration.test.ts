import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { appManifest } from '../app.manifest';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('navigation surface only exposes the supported tabs and keeps the profile stack route', () => {
  const tabsSource = readFileSync(path.join(projectRoot, 'app/(tabs)/_layout.tsx'), 'utf8');
  const stackSource = readFileSync(path.join(projectRoot, 'app/_layout.tsx'), 'utf8');

  assert.match(tabsSource, /name="index"/);
  assert.match(tabsSource, /name="explore"/);
  assert.match(tabsSource, /name="communication"/);
  assert.match(tabsSource, /name="settings"/);
  assert.doesNotMatch(tabsSource, /name="uploads"/);
  assert.doesNotMatch(tabsSource, /name="three"/);
  assert.doesNotMatch(tabsSource, /name="react-hook-form"/);
  assert.match(stackSource, /name="profile\/\[profile\]"/);
});

test('manifest metadata only advertises the current template surface', () => {
  assert.deepEqual(appManifest.featureFlags, ['tabs', 'auth', 'profiles', 'theme']);
  assert.ok(!('entryWorkspace' in appManifest));
  assert.ok(!('sharedPackages' in appManifest));
});

test('communication and profile routes use auth-api user ids instead of seeded profile handles', () => {
  const communicationSource = readFileSync(
    path.join(projectRoot, 'app/(tabs)/communication.tsx'),
    'utf8',
  );
  const profileSource = readFileSync(path.join(projectRoot, 'app/profile/[profile].tsx'), 'utf8');

  assert.match(communicationSource, /fetchUsersRequest/);
  assert.match(communicationSource, /router\.push\(`\/profile\/\$\{user\.id\}`\)/);
  assert.doesNotMatch(communicationSource, /fetchProfilesRequest/);
  assert.match(profileSource, /fetchUserRequest/);
  assert.match(profileSource, /error\.status === 404/);
  assert.match(profileSource, /\/profile\/1234abcd/);
  assert.doesNotMatch(profileSource, /getProfileFromSegment/);
  assert.doesNotMatch(profileSource, /@username/);
});

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        reject(new Error('Failed to allocate a test port.'));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });

    server.on('error', reject);
  });
}

async function waitForHealthcheck(baseUrl: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);

      if (response.ok) {
        return;
      }
    } catch {}

    await delay(100);
  }

  throw new Error(`Server at ${baseUrl} did not become ready in time.`);
}

test('auth API exposes public user data for the mobile app', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'expo-template-auth-api-'));
  const dataFile = path.join(tempDir, 'users.json');
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const authApiDirectory = path.join(projectRoot, 'services/auth-api');

  const users = [
    {
      id: 'user-alex',
      name: 'Alex Mercer',
      email: 'alex@example.test',
      createdAt: '2026-04-16T10:00:00.000Z',
      passwordHash: 'salt:secret',
    },
    {
      id: 'user-jules',
      name: 'Jules Costa',
      email: 'jules@example.test',
      createdAt: '2026-04-16T11:00:00.000Z',
      passwordHash: 'salt:secret',
    },
  ];

  await writeFile(dataFile, JSON.stringify(users, null, 2), 'utf8');

  const serverProcess = spawn(process.execPath, ['run', 'start'], {
    cwd: authApiDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_FILE: dataFile,
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: '2525',
    },
    stdio: 'ignore',
  });

  try {
    await waitForHealthcheck(baseUrl);

    const usersResponse = await fetch(`${baseUrl}/users`);
    assert.equal(usersResponse.status, 200);

    const usersPayload = await usersResponse.json();
    assert.deepEqual(usersPayload, {
      users: users.map(({ passwordHash: _passwordHash, ...user }) => user),
    });

    const userResponse = await fetch(`${baseUrl}/users/user-jules`);
    assert.equal(userResponse.status, 200);

    const userPayload = await userResponse.json();
    assert.deepEqual(userPayload, {
      user: {
        id: 'user-jules',
        name: 'Jules Costa',
        email: 'jules@example.test',
        createdAt: '2026-04-16T11:00:00.000Z',
      },
    });

    const missingUserResponse = await fetch(`${baseUrl}/users/does-not-exist`);
    assert.equal(missingUserResponse.status, 404);
  } finally {
    serverProcess.kill('SIGTERM');
    await delay(100);
    await rm(tempDir, { recursive: true, force: true });
  }
});
