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

test('navigation surface exposes the social app shell and username profile route', () => {
  const tabsSource = readFileSync(path.join(projectRoot, 'app/(app)/(tabs)/_layout.tsx'), 'utf8');
  const stackSource = readFileSync(path.join(projectRoot, 'app/_layout.tsx'), 'utf8');

  assert.match(tabsSource, /name="index"/);
  assert.match(tabsSource, /name="discover"/);
  assert.match(tabsSource, /name="activity"/);
  assert.match(tabsSource, /name="me"/);
  assert.doesNotMatch(tabsSource, /name="explore"/);
  assert.doesNotMatch(tabsSource, /name="communication"/);
  assert.doesNotMatch(tabsSource, /name="settings"/);
  assert.match(stackSource, /name="\(public\)"/);
  assert.match(stackSource, /name="\(app\)"/);
  assert.ok(readFileSync(path.join(projectRoot, 'app/(public)/u/[username].tsx'), 'utf8').includes('profile-follow-button'));
});

test('manifest metadata advertises the expanded navigation and authz surface', () => {
  assert.equal(appManifest.entryWorkspace, '.');
  assert.deepEqual(appManifest.sharedPackages, []);
  assert.deepEqual(appManifest.featureFlags, [
    'navigation',
    'tabs',
    'auth',
    'authz',
    'social',
    'profiles',
    'theme',
  ]);
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

async function jsonRequest(
  baseUrl: string,
  pathName: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${baseUrl}${pathName}`, init);
}

test('auth API migrates legacy users, resolves public profiles by username, and protects avatar updates', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'expo-template-auth-api-'));
  const dataFile = path.join(tempDir, 'users.json');
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  await writeFile(
    dataFile,
    JSON.stringify(
      [
        {
          id: 'legacy-1',
          name: 'Alex Mercer',
          email: 'alex@example.test',
          createdAt: '2026-04-16T10:00:00.000Z',
          avatarUrl: null,
          passwordHash: 'legacy-hash',
        },
        {
          id: 'legacy-2',
          name: 'Alex Mercer',
          email: 'alex+2@example.test',
          createdAt: '2026-04-16T11:00:00.000Z',
          avatarUrl: 'data:image/jpeg;base64,seeded-avatar',
          passwordHash: 'legacy-hash',
        },
      ],
      null,
      2,
    ),
    'utf8',
  );

  const server = createAuthApiServer({
    dataFile,
    smtpHost: '127.0.0.1',
    smtpPort: 2525,
  });

  try {
    await startServer(server, port);

    const profilesResponse = await jsonRequest(baseUrl, '/profiles');
    assert.equal(profilesResponse.status, 200);
    const profilesPayload = await profilesResponse.json();
    assert.equal(profilesPayload.profiles.length, 2);
    assert.equal(profilesPayload.profiles[0].username, 'alex_mercer');
    assert.equal(profilesPayload.profiles[1].username, 'alex_mercer1');

    const publicProfileResponse = await jsonRequest(baseUrl, '/profiles/alex_mercer');
    assert.equal(publicProfileResponse.status, 200);
    assert.equal((await publicProfileResponse.json()).profile.displayName, 'Alex Mercer');

    const avatarWithoutAuth = await jsonRequest(baseUrl, '/me/avatar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatarDataUrl: 'data:image/jpeg;base64,avatar',
      }),
    });
    assert.equal(avatarWithoutAuth.status, 401);

    const migratedDocument = JSON.parse(readFileSync(dataFile, 'utf8')) as {
      users: Array<{ username: string; role: string; status: string; bio: string }>;
      sessions: unknown[];
      follows: unknown[];
    };
    assert.deepEqual(migratedDocument.sessions, []);
    assert.deepEqual(migratedDocument.follows, []);
    assert.deepEqual(
      migratedDocument.users.map((user) => ({
        username: user.username,
        role: user.role,
        status: user.status,
        bio: user.bio,
      })),
      [
        { username: 'alex_mercer', role: 'member', status: 'active', bio: '' },
        { username: 'alex_mercer1', role: 'member', status: 'active', bio: '' },
      ],
    );
  } finally {
    await stopServer(server);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('auth API enforces signup uniqueness, persists sessions, follow edges, activity, and admin role changes', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'expo-template-auth-api-'));
  const dataFile = path.join(tempDir, 'users.json');
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const server = createAuthApiServer({
    adminEmails: ['admin@example.test'],
    dataFile,
    smtpHost: '127.0.0.1',
    smtpPort: 2525,
  });

  try {
    await startServer(server, port);

    const adminSignup = await jsonRequest(baseUrl, '/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayName: 'Admin User',
        username: 'admin_user',
        email: 'admin@example.test',
        password: 'password123',
      }),
    });
    assert.equal(adminSignup.status, 201);

    const memberSignup = await jsonRequest(baseUrl, '/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayName: 'Member User',
        username: 'member_user',
        email: 'member@example.test',
        password: 'password123',
      }),
    });
    assert.equal(memberSignup.status, 201);

    const duplicateEmail = await jsonRequest(baseUrl, '/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayName: 'Another User',
        username: 'another_user',
        email: 'member@example.test',
        password: 'password123',
      }),
    });
    assert.equal(duplicateEmail.status, 409);

    const duplicateUsername = await jsonRequest(baseUrl, '/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayName: 'Another User',
        username: 'member_user',
        email: 'another@example.test',
        password: 'password123',
      }),
    });
    assert.equal(duplicateUsername.status, 409);

    const adminSignin = await jsonRequest(baseUrl, '/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@example.test',
        password: 'password123',
      }),
    });
    assert.equal(adminSignin.status, 200);
    const adminSession = (await adminSignin.json()) as { token: string; user: { role: string } };
    assert.equal(adminSession.user.role, 'admin');

    const memberSignin = await jsonRequest(baseUrl, '/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'member@example.test',
        password: 'password123',
      }),
    });
    assert.equal(memberSignin.status, 200);
    const memberSession = (await memberSignin.json()) as { token: string; user: { username: string } };

    const sessionResponse = await jsonRequest(baseUrl, '/auth/session', {
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
      },
    });
    assert.equal(sessionResponse.status, 200);
    assert.equal((await sessionResponse.json()).user.username, 'member_user');

    const updateOwnProfile = await jsonRequest(baseUrl, '/me/profile', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayName: 'Member User Updated',
        username: 'member_user',
        bio: 'I follow people.',
      }),
    });
    assert.equal(updateOwnProfile.status, 200);
    assert.equal((await updateOwnProfile.json()).profile.bio, 'I follow people.');

    const memberAdminAttempt = await jsonRequest(baseUrl, '/admin/users', {
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
      },
    });
    assert.equal(memberAdminAttempt.status, 403);

    const followResponse = await jsonRequest(baseUrl, '/profiles/admin_user/follow', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
      },
    });
    assert.equal(followResponse.status, 201);
    assert.equal((await followResponse.json()).profile.followerCount, 1);

    const duplicateFollowResponse = await jsonRequest(baseUrl, '/profiles/admin_user/follow', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
      },
    });
    assert.equal(duplicateFollowResponse.status, 409);

    const memberProfile = await jsonRequest(baseUrl, '/profiles/member_user', {
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
      },
    });
    assert.equal(memberProfile.status, 200);
    assert.equal((await memberProfile.json()).profile.followingCount, 1);

    const adminFollowers = await jsonRequest(baseUrl, '/profiles/admin_user/followers', {
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
      },
    });
    assert.equal(adminFollowers.status, 200);
    assert.equal((await adminFollowers.json()).profiles[0].username, 'member_user');

    const memberActivity = await jsonRequest(baseUrl, '/me/activity', {
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
      },
    });
    assert.equal(memberActivity.status, 200);
    assert.deepEqual(
      (await memberActivity.json()).activity.map((item: { type: string }) => item.type),
      ['you_followed'],
    );

    const adminActivity = await jsonRequest(baseUrl, '/me/activity', {
      headers: {
        Authorization: `Bearer ${adminSession.token}`,
      },
    });
    assert.equal(adminActivity.status, 200);
    assert.deepEqual(
      (await adminActivity.json()).activity.map((item: { type: string }) => item.type),
      ['followed_you'],
    );

    const unfollowResponse = await jsonRequest(baseUrl, '/profiles/admin_user/follow', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
      },
    });
    assert.equal(unfollowResponse.status, 204);

    const secondUnfollowResponse = await jsonRequest(baseUrl, '/profiles/admin_user/follow', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
      },
    });
    assert.equal(secondUnfollowResponse.status, 204);

    const adminUsersResponse = await jsonRequest(baseUrl, '/admin/users', {
      headers: {
        Authorization: `Bearer ${adminSession.token}`,
      },
    });
    assert.equal(adminUsersResponse.status, 200);
    const adminUsersPayload = (await adminUsersResponse.json()) as {
      users: Array<{ id: string; email: string; role: string }>;
    };
    const memberUser = adminUsersPayload.users.find((user) => user.email === 'member@example.test');
    assert.ok(memberUser);

    const promoteMember = await jsonRequest(baseUrl, `/admin/users/${memberUser.id}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'moderator',
      }),
    });
    assert.equal(promoteMember.status, 200);
    assert.equal((await promoteMember.json()).user.role, 'moderator');
  } finally {
    await stopServer(server);
    await rm(tempDir, { recursive: true, force: true });
  }
});
