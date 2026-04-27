import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
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
  emailVerificationTokens: Array<{ token: string; userId: string }>;
  follows: Array<{ followeeId: string; followerId: string }>;
  passwordResetTokens: Array<{ token: string; userId: string }>;
  sessions: Array<{ id: string; token: string; userId: string }>;
  uploadIntents: Array<{ uploadToken: string; userId: string }>;
  users: Array<{ deactivatedAt: string | null; email: string; id: string; username: string }>;
};

test('navigation surface exposes the app shell and username profile route', () => {
  const navigationSource = readFileSync(path.join(projectRoot, 'lib/navigation.ts'), 'utf8');
  const stackSource = readFileSync(path.join(projectRoot, 'app/_layout.tsx'), 'utf8');

  assert.match(navigationSource, /name: 'index'/);
  assert.match(navigationSource, /name: 'discover'/);
  assert.match(navigationSource, /name: 'activity'/);
  assert.match(navigationSource, /name: 'me'/);
  assert.doesNotMatch(navigationSource, /settings\/admin/);
  assert.match(stackSource, /name="\(public\)"/);
  assert.match(stackSource, /name="\(app\)"/);
  assert.ok(readFileSync(path.join(projectRoot, 'app/(public)/u/[username].tsx'), 'utf8').includes('profile-follow-button'));
});

test('manifest metadata advertises the minimal social linkage surface', () => {
  assert.equal(appManifest.entryWorkspace, '.');
  assert.deepEqual(appManifest.sharedPackages, []);
  assert.deepEqual(appManifest.featureFlags, ['navigation', 'tabs', 'auth', 'social', 'profiles', 'theme']);
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

test('auth API supports the minimal lifecycle, profile, follow, activity, and ops contract', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'expo-template-auth-api-'));
  const dataFile = path.join(tempDir, 'users.json');
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = createAuthApiServer({
    dataFile,
    enableTestEndpoints: true,
    smtpHost: '127.0.0.1',
    smtpPort: 2525,
  });

  try {
    await startServer(server, port);

    const health = await jsonRequest(baseUrl, '/health');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);

    const ready = await jsonRequest(baseUrl, '/ready');
    assert.equal(ready.status, 200);
    assert.equal((await ready.json()).ok, true);

    const publicProfiles = await jsonRequest(baseUrl, '/profiles');
    assert.equal(publicProfiles.status, 200);
    const publicProfilesPayload = (await publicProfiles.json()) as {
      nextCursor: string | null;
      profiles: Array<{ username: string }>;
    };
    assert.equal(publicProfilesPayload.profiles.length, 3);
    assert.equal(publicProfilesPayload.nextCursor, null);

    const alexProfile = await jsonRequest(baseUrl, '/profiles/alex');
    assert.equal(alexProfile.status, 200);
    assert.equal((await alexProfile.json()).profile.username, 'alex');

    const signup = await jsonRequest(baseUrl, '/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Member User',
        username: 'member_user',
        email: 'member@example.test',
        password: 'password123',
      }),
    });
    assert.equal(signup.status, 201);

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
        email: 'member@example.test',
        password: 'password123',
      }),
    });
    assert.equal(preVerifySignin.status, 403);
    assert.equal((await preVerifySignin.json()).code, 'EMAIL_NOT_VERIFIED');

    const memberUserId = getUserIdByEmail(dataFile, 'member@example.test');
    const memberVerificationToken = getVerificationToken(dataFile, memberUserId);

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
    assert.equal(passwordResetRequest.status, 200);

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

    const memberSignin = await jsonRequest(baseUrl, '/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'member@example.test',
        password: 'password456',
      }),
    });
    assert.equal(memberSignin.status, 200);
    const memberSession = (await memberSignin.json()) as {
      token: string;
      user: { avatarUrl: string | null; username: string };
    };
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

    const meProfile = await jsonRequest(baseUrl, '/me/profile', {
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(meProfile.status, 200);
    assert.equal((await meProfile.json()).profile.isSelf, true);

    const updateProfile = await jsonRequest(baseUrl, '/me/profile', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayName: 'Member User Updated',
        username: 'member_user_updated',
        bio: 'I follow people.',
      }),
    });
    assert.equal(updateProfile.status, 200);
    const updateProfilePayload = (await updateProfile.json()) as {
      profile: { bio: string; username: string };
      user: { username: string };
    };
    assert.equal(updateProfilePayload.profile.username, 'member_user_updated');
    assert.equal(updateProfilePayload.profile.bio, 'I follow people.');
    assert.equal(updateProfilePayload.user.username, 'member_user_updated');

    const updatedPublicProfile = await jsonRequest(baseUrl, '/profiles/member_user_updated');
    assert.equal(updatedPublicProfile.status, 200);

    const invalidAvatarComplete = await jsonRequest(baseUrl, '/me/avatar/complete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadToken: 'invalid-token',
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
    assert.equal(avatarUploadIntent.status, 200);
    const avatarIntentPayload = (await avatarUploadIntent.json()) as {
      uploadIntent: { assetUrl: string; uploadToken: string };
    };

    const avatarComplete = await jsonRequest(baseUrl, '/me/avatar/complete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${memberSession.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadToken: avatarIntentPayload.uploadIntent.uploadToken,
      }),
    });
    assert.equal(avatarComplete.status, 200);
    assert.equal((await avatarComplete.json()).profile.avatarUrl, avatarIntentPayload.uploadIntent.assetUrl);

    const seedFollowerSignin = await jsonRequest(baseUrl, '/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex@example.test',
        password: 'password123',
      }),
    });
    assert.equal(seedFollowerSignin.status, 200);
    const seedFollowerSession = (await seedFollowerSignin.json()) as { token: string };

    const followMember = await jsonRequest(baseUrl, '/profiles/member_user_updated/follow', {
      method: 'POST',
      headers: { Authorization: `Bearer ${seedFollowerSession.token}` },
    });
    assert.equal(followMember.status, 201);

    const followAlex = await jsonRequest(baseUrl, '/profiles/alex/follow', {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(followAlex.status, 201);
    assert.equal((await followAlex.json()).profile.relationship.isFollowing, true);

    const followers = await jsonRequest(baseUrl, '/profiles/member_user_updated/followers');
    assert.equal(followers.status, 200);
    assert.equal((await followers.json()).profiles.length, 1);

    const following = await jsonRequest(baseUrl, '/profiles/member_user_updated/following');
    assert.equal(following.status, 200);
    assert.equal((await following.json()).profiles.some((profile: { username: string }) => profile.username === 'alex'), true);

    const activity = await jsonRequest(baseUrl, '/me/activity', {
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(activity.status, 200);
    const activityPayload = (await activity.json()) as {
      activity: Array<{ profile: { username: string }; type: string }>;
    };
    assert.equal(activityPayload.activity.some((item) => item.type === 'followed_you' && item.profile.username === 'alex'), true);
    assert.equal(activityPayload.activity.some((item) => item.type === 'you_followed' && item.profile.username === 'alex'), true);

    const unfollowAlex = await jsonRequest(baseUrl, '/profiles/alex/follow', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(unfollowAlex.status, 204);

    const accountDelete = await jsonRequest(baseUrl, '/me/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(accountDelete.status, 204);

    const deletedAccountSession = await jsonRequest(baseUrl, '/auth/session', {
      headers: { Authorization: `Bearer ${memberSession.token}` },
    });
    assert.equal(deletedAccountSession.status, 401);

    const deletedPublicProfile = await jsonRequest(baseUrl, '/profiles/member_user_updated');
    assert.equal(deletedPublicProfile.status, 404);

    const persistedStore = readPersistedStore(dataFile);
    const deletedUser = persistedStore.users.find((entry) => entry.email === 'member@example.test');
    assert.ok(deletedUser);
    assert.notEqual(deletedUser.deactivatedAt, null);
    assert.equal(persistedStore.follows.some((follow) => follow.followeeId === deletedUser.id || follow.followerId === deletedUser.id), false);
    assert.equal(persistedStore.sessions.some((session) => session.userId === deletedUser.id), false);

    let rateLimitedStatus = 0;

    for (let attempt = 0; attempt < 9; attempt += 1) {
      const response = await jsonRequest(baseUrl, '/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'alex@example.test' }),
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
