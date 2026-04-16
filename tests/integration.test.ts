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

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('mobile navigation exposes settings, libraries, and profile routes', () => {
  const source = readFileSync(path.join(projectRoot, 'app/(tabs)/_layout.tsx'), 'utf8');
  const stackSource = readFileSync(path.join(projectRoot, 'app/_layout.tsx'), 'utf8');
  const iconSource = readFileSync(
    path.join(projectRoot, 'components/ui/icon-symbol.tsx'),
    'utf8',
  );

  assert.match(source, /name="communication"/);
  assert.match(source, /title: 'Communication'/);
  assert.match(source, /bubble\.left\.and\.bubble\.right\.fill/);
  assert.match(source, /name="uploads"/);
  assert.match(source, /title: 'Uploads'/);
  assert.match(source, /square\.and\.arrow\.up\.fill/);
  assert.match(source, /name="settings"/);
  assert.match(source, /title: 'Settings'/);
  assert.match(source, /gearshape\.fill/);
  assert.match(source, /name="three"/);
  assert.match(source, /title: 'Three\.js'/);
  assert.match(source, /cube\.fill/);
  assert.match(source, /name="react-hook-form"/);
  assert.match(source, /title: 'Form'/);
  assert.match(source, /list\.bullet\.clipboard\.fill/);
  assert.match(iconSource, /'bubble\.left\.and\.bubble\.right\.fill': 'forum'/);
  assert.match(iconSource, /'square\.and\.arrow\.up\.fill': 'upload'/);
  assert.match(stackSource, /name="profile\/\[profile\]"/);
  assert.match(stackSource, /title: 'Profile'/);
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
