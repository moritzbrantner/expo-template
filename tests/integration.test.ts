import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { type Server } from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { appManifest } from '../app.manifest';
import { createAuthApiServer } from '../services/auth-api/app';

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

async function startServer(server: Server, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

async function stopServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

test('auth API exposes public user data for the mobile app', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'expo-template-auth-api-'));
  const dataFile = path.join(tempDir, 'users.json');
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const users = [
    {
      id: 'user-alex',
      name: 'Alex Mercer',
      email: 'alex@example.test',
      createdAt: '2026-04-16T10:00:00.000Z',
      avatarUrl: null,
      passwordHash: 'salt:secret',
    },
    {
      id: 'user-jules',
      name: 'Jules Costa',
      email: 'jules@example.test',
      createdAt: '2026-04-16T11:00:00.000Z',
      avatarUrl: 'data:image/jpeg;base64,seeded-avatar',
      passwordHash: 'salt:secret',
    },
  ];

  await writeFile(dataFile, JSON.stringify(users, null, 2), 'utf8');

  const server = createAuthApiServer({
    dataFile,
    smtpHost: '127.0.0.1',
    smtpPort: 2525,
  });

  try {
    await startServer(server, port);

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
        avatarUrl: 'data:image/jpeg;base64,seeded-avatar',
      },
    });

    const missingUserResponse = await fetch(`${baseUrl}/users/does-not-exist`);
    assert.equal(missingUserResponse.status, 404);

    const avatarResponse = await fetch(`${baseUrl}/users/user-alex/avatar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatarDataUrl: 'data:image/jpeg;base64,dXBkYXRlZC1hdmF0YXI=',
      }),
    });

    assert.equal(avatarResponse.status, 200);
    assert.deepEqual(await avatarResponse.json(), {
      user: {
        id: 'user-alex',
        name: 'Alex Mercer',
        email: 'alex@example.test',
        createdAt: '2026-04-16T10:00:00.000Z',
        avatarUrl: 'data:image/jpeg;base64,dXBkYXRlZC1hdmF0YXI=',
      },
    });

    const persistedUsers = JSON.parse(readFileSync(dataFile, 'utf8')) as Array<{
      id: string;
      avatarUrl: string | null;
    }>;
    assert.equal(
      persistedUsers.find((user) => user.id === 'user-alex')?.avatarUrl,
      'data:image/jpeg;base64,dXBkYXRlZC1hdmF0YXI=',
    );
  } finally {
    await stopServer(server);
    await rm(tempDir, { recursive: true, force: true });
  }
});
