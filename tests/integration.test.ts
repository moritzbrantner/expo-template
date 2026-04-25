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

type PersistedStore = {
  auditEvents: Array<{ action: string }>;
  emailVerificationTokens: Array<{ token: string; userId: string }>;
  passwordResetTokens: Array<{ token: string; userId: string }>;
  users: Array<{ email: string; id: string; username: string }>;
};

test('navigation surface exposes the social app shell and username profile route', () => {
  const navigationSource = readFileSync(path.join(projectRoot, 'lib/navigation.ts'), 'utf8');
  const stackSource = readFileSync(path.join(projectRoot, 'app/_layout.tsx'), 'utf8');

  assert.match(navigationSource, /name: 'index'/);
  assert.match(navigationSource, /name: 'discover'/);
  assert.match(navigationSource, /name: 'activity'/);
  assert.match(navigationSource, /name: 'me'/);
  assert.doesNotMatch(navigationSource, /name: 'explore'/);
  assert.doesNotMatch(navigationSource, /name: 'communication'/);
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

async function jsonRequest(baseUrl: string, pathName: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${pathName}`, init);
}

function readPersistedStore(dataFile: string): PersistedStore {
  return JSON.parse(readFileSync(dataFile, 'utf8')) as PersistedStore;
}

function getUserIdByEmail(dataFile: string, email: string): string {
  const store = readPersistedStore(dataFile);
  const user = store.users.find((entry) => entry.email === email);
  assert.ok(user);
  return user.id;
}

function getVerificationToken(dataFile: string, userId: string): string {
  const store = readPersistedStore(dataFile);
  const token = store.emailVerificationTokens.find((entry) => entry.userId === userId);
  assert.ok(token);
  return token.token;
}

function getPasswordResetToken(dataFile: string, userId: string): string {
  const store = readPersistedStore(dataFile);
  const token = store.passwordResetTokens.find((entry) => entry.userId === userId);
  assert.ok(token);
  return token.token;
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
      posts: unknown[];
      reports: unknown[];
    };
    assert.deepEqual(migratedDocument.sessions, []);
    assert.deepEqual(migratedDocument.follows, []);
    assert.deepEqual(migratedDocument.posts, []);
    assert.deepEqual(migratedDocument.reports, []);
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

test('auth API supports verification, recovery, content, notifications, moderation, and ops endpoints', async () => {
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Another User',
        username: 'another_user',
        email: 'member@example.test',
        password: 'password123',
      }),
    });
    assert.equal(duplicateEmail.status, 409);

    const usernameAvailability = await jsonRequest(baseUrl, '/usernames/member_user/availability');
    assert.equal(usernameAvailability.status, 200);
    assert.equal((await usernameAvailability.json()).available, false);

    const preVerifySignin = await jsonRequest(baseUrl, '/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.test',
        password: 'password123',
      }),
    });
    assert.equal(preVerifySignin.status, 403);
    assert.equal((await preVerifySignin.json()).code, 'EMAIL_NOT_VERIFIED');

    const adminUserId = getUserIdByEmail(dataFile, 'admin@example.test');
    const memberUserId = getUserIdByEmail(dataFile, 'member@example.test');
    const adminVerificationToken = getVerificationToken(dataFile, adminUserId);
    const memberVerificationToken = getVerificationToken(dataFile, memberUserId);

    const verifyAdmin = await jsonRequest(baseUrl, '/auth/verify-email/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: adminVerificationToken }),
    });
    assert.equal(verifyAdmin.status, 200);

    const verifyMember = await jsonRequest(baseUrl, '/auth/verify-email/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: memberVerificationToken }),
    });
    assert.equal(verifyMember.status, 200);

    const passwordResetRequest = await jsonRequest(baseUrl, '/auth/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'member@example.test' }),
    });
    assert.equal(passwordResetRequest.status, 202);

    const memberPasswordResetToken = getPasswordResetToken(dataFile, memberUserId);
    const passwordResetConfirm = await jsonRequest(baseUrl, '/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: memberPasswordResetToken,
        password: 'password456',
      }),
    });
    assert.equal(passwordResetConfirm.status, 200);

    const adminSignin = await jsonRequest(baseUrl, '/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'member@example.test',
        password: 'password456',
      }),
    });
    assert.equal(memberSignin.status, 200);
    const memberSession = (await memberSignin.json()) as { token: string; user: { username: string } };
    assert.equal(memberSession.user.username, 'member_user');

    const secondMemberSignin = await jsonRequest(baseUrl, '/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'member@example.test',
        password: 'password456',
      }),
    });
    assert.equal(secondMemberSignin.status, 200);
    const secondMemberSession = (await secondMemberSignin.json()) as { token: string };

    const sessionsResponse = await jsonRequest(baseUrl, '/me/sessions', {
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(sessionsResponse.status, 200);
    const sessionsPayload = (await sessionsResponse.json()) as {
      sessions: Array<{ current: boolean; id: string }>;
    };
    assert.equal(sessionsPayload.sessions.length, 2);
    const remoteSession = sessionsPayload.sessions.find((session) => !session.current);
    assert.ok(remoteSession);

    const revokeRemoteSession = await jsonRequest(baseUrl, `/me/sessions/${remoteSession.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(revokeRemoteSession.status, 204);

    const remoteSessionCheck = await jsonRequest(baseUrl, '/auth/session', {
      headers: { Authorization: `Bearer ${secondMemberSession.token}` },
    });
    assert.equal(remoteSessionCheck.status, 401);

    const updateProfile = await jsonRequest(baseUrl, '/me/profile', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayName: 'Member User Updated',
        username: 'member_user',
        bio: 'I follow people.',
        discoverable: false,
      }),
    });
    assert.equal(updateProfile.status, 200);
    assert.equal((await updateProfile.json()).profile.discoverable, false);

    const invalidAvatarComplete = await jsonRequest(baseUrl, '/me/avatar/complete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadToken: 'invalid-token',
        assetUrl: 'https://cdn.example.test/avatar.jpg',
      }),
    });
    assert.equal(invalidAvatarComplete.status, 400);

    const avatarUploadIntent = await jsonRequest(baseUrl, '/me/avatar/upload-intent', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contentType: 'image/jpeg' }),
    });
    assert.equal(avatarUploadIntent.status, 201);
    const avatarIntent = (await avatarUploadIntent.json()) as { upload: { uploadToken: string } };

    const avatarComplete = await jsonRequest(baseUrl, '/me/avatar/complete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadToken: avatarIntent.upload.uploadToken,
        assetUrl: 'https://cdn.example.test/member-avatar.jpg',
      }),
    });
    assert.equal(avatarComplete.status, 200);
    assert.equal((await avatarComplete.json()).profile.avatarUrl, 'https://cdn.example.test/member-avatar.jpg');

    const memberPostResponse = await jsonRequest(baseUrl, '/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: 'Hello from the member timeline.' }),
    });
    assert.equal(memberPostResponse.status, 201);
    const memberPost = (await memberPostResponse.json()) as { post: { id: string } };

    const adminCommentResponse = await jsonRequest(baseUrl, `/posts/${memberPost.post.id}/comments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: 'Moderator note on your post.' }),
    });
    assert.equal(adminCommentResponse.status, 201);

    const adminReactionResponse = await jsonRequest(baseUrl, `/posts/${memberPost.post.id}/reactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'like' }),
    });
    assert.equal(adminReactionResponse.status, 200);

    const memberNotifications = await jsonRequest(baseUrl, '/me/notifications', {
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(memberNotifications.status, 200);
    const memberNotificationsPayload = (await memberNotifications.json()) as {
      notifications: Array<{ type: string }>;
    };
    assert.deepEqual(
      memberNotificationsPayload.notifications.map((notification) => notification.type).sort(),
      ['comment', 'reaction'],
    );

    const unreadCount = await jsonRequest(baseUrl, '/me/notifications/unread-count', {
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(unreadCount.status, 200);
    assert.equal((await unreadCount.json()).unreadCount, 2);

    const readAllNotifications = await jsonRequest(baseUrl, '/me/notifications/read-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(readAllNotifications.status, 200);

    const adminPostResponse = await jsonRequest(baseUrl, '/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: 'Admin-only announcement.' }),
    });
    assert.equal(adminPostResponse.status, 201);
    const adminPost = (await adminPostResponse.json()) as { post: { id: string } };

    const followAdminResponse = await jsonRequest(baseUrl, '/profiles/admin_user/follow', {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(followAdminResponse.status, 201);

    const adminActivity = await jsonRequest(baseUrl, '/me/activity', {
      headers: { Authorization: `Bearer ${adminSession.token}` },
    });
    assert.equal(adminActivity.status, 200);
    assert.deepEqual(
      (await adminActivity.json()).activity.map((item: { type: string }) => item.type),
      ['followed_you'],
    );

    const homeFeed = await jsonRequest(baseUrl, '/feed/home', {
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(homeFeed.status, 200);
    assert.equal((await homeFeed.json()).posts[0].id, adminPost.post.id);

    const muteAdmin = await jsonRequest(baseUrl, '/profiles/admin_user/mute', {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(muteAdmin.status, 201);

    const mutedHomeFeed = await jsonRequest(baseUrl, '/feed/home', {
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(mutedHomeFeed.status, 200);
    assert.equal(
      (await mutedHomeFeed.json()).posts.some((post: { id: string }) => post.id === adminPost.post.id),
      false,
    );

    const blockAdmin = await jsonRequest(baseUrl, '/profiles/admin_user/block', {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(blockAdmin.status, 201);

    const blockedProfile = await jsonRequest(baseUrl, '/profiles/admin_user', {
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(blockedProfile.status, 404);

    const reportResponse = await jsonRequest(baseUrl, '/reports', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetType: 'post',
        targetId: adminPost.post.id,
        reason: 'spam',
        description: 'Unwanted announcement.',
      }),
    });
    assert.equal(reportResponse.status, 201);
    const report = (await reportResponse.json()) as { report: { id: string } };

    const listReports = await jsonRequest(baseUrl, '/admin/reports', {
      headers: { Authorization: `Bearer ${adminSession.token}` },
    });
    assert.equal(listReports.status, 200);
    assert.equal((await listReports.json()).reports.length, 1);

    const resolveReport = await jsonRequest(baseUrl, `/admin/reports/${report.report.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'resolved',
        resolutionNote: 'Handled by moderation.',
      }),
    });
    assert.equal(resolveReport.status, 200);

    const hidePost = await jsonRequest(baseUrl, `/admin/posts/${adminPost.post.id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'hidden' }),
    });
    assert.equal(hidePost.status, 200);

    const discoverFeed = await jsonRequest(baseUrl, '/feed/discover');
    assert.equal(discoverFeed.status, 200);
    assert.equal((await discoverFeed.json()).posts.some((post: { id: string }) => post.id === adminPost.post.id), false);

    const suspendMember = await jsonRequest(baseUrl, `/admin/users/${memberUserId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert.equal(suspendMember.status, 200);

    const suspendedSession = await jsonRequest(baseUrl, '/auth/session', {
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(suspendedSession.status, 401);

    const auditLog = await jsonRequest(baseUrl, '/admin/audit-log', {
      headers: { Authorization: `Bearer ${adminSession.token}` },
    });
    assert.equal(auditLog.status, 200);
    assert.equal((await auditLog.json()).events.length >= 3, true);
    assert.equal(readPersistedStore(dataFile).auditEvents.length >= 3, true);

    const health = await jsonRequest(baseUrl, '/health');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);

    const ready = await jsonRequest(baseUrl, '/ready');
    assert.equal(ready.status, 200);
    assert.equal((await ready.json()).ok, true);

    let rateLimitedStatus = 0;

    for (let attempt = 0; attempt < 9; attempt += 1) {
      const response = await jsonRequest(baseUrl, '/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.test' }),
      });

      rateLimitedStatus = response.status;
      if (response.status === 429) {
        break;
      }
    }

    assert.equal(rateLimitedStatus, 429);
  } finally {
    await stopServer(server);
    await rm(tempDir, { recursive: true, force: true });
  }
});
