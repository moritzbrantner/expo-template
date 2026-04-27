import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  ActivityItem,
  FollowRelationship,
  ProfileDetail,
  PublicProfile,
  SessionInfo,
  SessionUser,
  UploadIntent,
} from '@/shared/social';

const MOCK_AUTH_STORAGE_KEY = 'mock.auth.db.v2';
const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const SESSION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_WINDOW_MS = 60 * 60 * 1000;
const UPLOAD_INTENT_WINDOW_MS = 15 * 60 * 1000;

type MockUserRecord = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  password: string;
  createdAt: string;
  updatedAt: string;
  emailVerifiedAt: string | null;
  deactivatedAt: string | null;
};

type MockSessionRecord = {
  id: string;
  token: string;
  userId: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
};

type MockVerificationToken = {
  id: string;
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

type MockUploadIntentRecord = UploadIntent & {
  userId: string;
  completedAt: string | null;
};

type MockAuthDatabase = {
  users: MockUserRecord[];
  follows: FollowRelationship[];
  sessions: MockSessionRecord[];
  emailVerificationTokens: MockVerificationToken[];
  passwordResetTokens: MockVerificationToken[];
  uploadIntents: MockUploadIntentRecord[];
};

type MockViewer = {
  session: MockSessionRecord;
  user: MockUserRecord;
};

type SignUpInput = {
  displayName: string;
  username: string;
  email: string;
  password: string;
};

type SignInInput = {
  email: string;
  password: string;
};

type UpdateProfileInput = {
  displayName: string;
  username: string;
  bio: string;
};

export class MockAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'MockAuthError';
    this.status = status;
  }
}

const SEEDED_USERS: MockUserRecord[] = [
  {
    id: 'user-alex',
    email: 'alex@example.test',
    username: 'alex',
    displayName: 'Alex Mercer',
    bio: 'Shipping calm product surfaces across web, mobile, and desktop.',
    avatarUrl: null,
    password: 'password123',
    createdAt: '2026-04-23T10:30:00.000Z',
    updatedAt: '2026-04-23T10:30:00.000Z',
    emailVerifiedAt: '2026-04-23T10:30:00.000Z',
    deactivatedAt: null,
  },
  {
    id: 'user-sam',
    email: 'sam@example.test',
    username: 'sam',
    displayName: 'Sam Rivera',
    bio: 'Curating design systems, onboarding flows, and launch checklists.',
    avatarUrl: null,
    password: 'password123',
    createdAt: '2026-04-22T14:15:00.000Z',
    updatedAt: '2026-04-22T14:15:00.000Z',
    emailVerifiedAt: '2026-04-22T14:15:00.000Z',
    deactivatedAt: null,
  },
  {
    id: 'user-jordan',
    email: 'jordan@example.test',
    username: 'jordan',
    displayName: 'Jordan Lee',
    bio: 'Testing auth handshakes, profile edits, and follow interactions.',
    avatarUrl: null,
    password: 'password123',
    createdAt: '2026-04-24T08:00:00.000Z',
    updatedAt: '2026-04-24T08:00:00.000Z',
    emailVerifiedAt: '2026-04-24T08:00:00.000Z',
    deactivatedAt: null,
  },
];

const SEEDED_DATABASE: MockAuthDatabase = {
  users: SEEDED_USERS,
  follows: [
    {
      followerId: 'user-alex',
      followeeId: 'user-sam',
      createdAt: '2026-04-24T07:15:00.000Z',
    },
    {
      followerId: 'user-jordan',
      followeeId: 'user-alex',
      createdAt: '2026-04-24T07:45:00.000Z',
    },
  ],
  sessions: [],
  emailVerificationTokens: [],
  passwordResetTokens: [],
  uploadIntents: [],
};

let cachedDatabase: MockAuthDatabase | null = null;
let mutationQueue = Promise.resolve();

function cloneDatabase(database: MockAuthDatabase): MockAuthDatabase {
  return {
    users: database.users.map((user) => ({ ...user })),
    follows: database.follows.map((follow) => ({ ...follow })),
    sessions: database.sessions.map((session) => ({ ...session })),
    emailVerificationTokens: database.emailVerificationTokens.map((token) => ({ ...token })),
    passwordResetTokens: database.passwordResetTokens.map((token) => ({ ...token })),
    uploadIntents: database.uploadIntents.map((intent) => ({ ...intent })),
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function isExpired(timestamp: string) {
  return new Date(timestamp).getTime() <= Date.now();
}

function isUserVisible(user: MockUserRecord) {
  return user.deactivatedAt === null && user.emailVerifiedAt !== null;
}

function toSessionUser(user: MockUserRecord): SessionUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

function getProfileMetrics(database: MockAuthDatabase, userId: string) {
  return {
    followerCount: database.follows.filter((follow) => follow.followeeId === userId).length,
    followingCount: database.follows.filter((follow) => follow.followerId === userId).length,
  };
}

function toPublicProfile(
  database: MockAuthDatabase,
  subject: MockUserRecord,
  viewer: MockUserRecord | null,
): PublicProfile {
  const metrics = getProfileMetrics(database, subject.id);

  return {
    id: subject.id,
    username: subject.username,
    displayName: subject.displayName,
    bio: subject.bio,
    avatarUrl: subject.avatarUrl,
    createdAt: subject.createdAt,
    updatedAt: subject.updatedAt,
    followerCount: metrics.followerCount,
    followingCount: metrics.followingCount,
    relationship: viewer
      ? {
          isFollowing: database.follows.some(
            (follow) => follow.followerId === viewer.id && follow.followeeId === subject.id,
          ),
          isFollowedBy: database.follows.some(
            (follow) => follow.followerId === subject.id && follow.followeeId === viewer.id,
          ),
        }
      : null,
  };
}

function toProfileDetail(
  database: MockAuthDatabase,
  subject: MockUserRecord,
  viewer: MockUserRecord | null,
): ProfileDetail {
  const profile = toPublicProfile(database, subject, viewer);
  const isSelf = viewer?.id === subject.id;

  return {
    ...profile,
    isSelf,
    canEdit: isSelf,
  };
}

function toSessionInfo(session: MockSessionRecord, currentToken: string | null | undefined): SessionInfo {
  return {
    id: session.id,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    current: currentToken === session.token,
  };
}

function pruneDatabase(database: MockAuthDatabase) {
  database.sessions = database.sessions.filter((session) => !isExpired(session.expiresAt));
  database.emailVerificationTokens = database.emailVerificationTokens.filter(
    (token) => !isExpired(token.expiresAt),
  );
  database.passwordResetTokens = database.passwordResetTokens.filter((token) => !isExpired(token.expiresAt));
  database.uploadIntents = database.uploadIntents.filter((intent) => !isExpired(intent.expiresAt));
  const activeUserIds = new Set(database.users.filter((user) => user.deactivatedAt === null).map((user) => user.id));
  database.follows = database.follows.filter(
    (follow) => activeUserIds.has(follow.followerId) && activeUserIds.has(follow.followeeId),
  );
}

async function loadDatabase(): Promise<MockAuthDatabase> {
  if (cachedDatabase) {
    return cloneDatabase(cachedDatabase);
  }

  try {
    const raw = await AsyncStorage.getItem(MOCK_AUTH_STORAGE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw) as MockAuthDatabase;
      cachedDatabase = cloneDatabase(parsed);
      pruneDatabase(cachedDatabase);
      return cloneDatabase(cachedDatabase);
    }
  } catch (error) {
    console.warn('Failed to restore mock auth database.', error);
  }

  cachedDatabase = cloneDatabase(SEEDED_DATABASE);
  await persistDatabase(cachedDatabase);
  return cloneDatabase(cachedDatabase);
}

async function persistDatabase(database: MockAuthDatabase) {
  pruneDatabase(database);
  cachedDatabase = cloneDatabase(database);

  try {
    await AsyncStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(database));
  } catch (error) {
    console.warn('Failed to persist mock auth database.', error);
  }
}

async function mutateDatabase<T>(mutator: (database: MockAuthDatabase) => Promise<T> | T): Promise<T> {
  const runMutation = async () => {
    const database = await loadDatabase();
    const result = await mutator(database);
    await persistDatabase(database);
    return result;
  };

  const pendingMutation = mutationQueue.catch(() => undefined).then(runMutation);
  mutationQueue = pendingMutation.then(
    () => undefined,
    () => undefined,
  );

  return pendingMutation;
}

function requireViewer(database: MockAuthDatabase, token: string | null | undefined): MockViewer {
  if (!token) {
    throw new MockAuthError('Authentication is required for this request.', 401);
  }

  const session = database.sessions.find((entry) => entry.token === token) ?? null;

  if (!session) {
    throw new MockAuthError('Authentication is required for this request.', 401);
  }

  const user = database.users.find((entry) => entry.id === session.userId) ?? null;

  if (!user || !isUserVisible(user)) {
    throw new MockAuthError('Authentication is required for this request.', 401);
  }

  session.lastUsedAt = new Date().toISOString();
  return { session, user };
}

function getViewer(database: MockAuthDatabase, token: string | null | undefined) {
  if (!token) {
    return null;
  }

  const session = database.sessions.find((entry) => entry.token === token) ?? null;

  if (!session) {
    return null;
  }

  const user = database.users.find((entry) => entry.id === session.userId) ?? null;

  if (!user || !isUserVisible(user)) {
    return null;
  }

  session.lastUsedAt = new Date().toISOString();
  return { session, user };
}

function validateSignUp(input: SignUpInput) {
  if (!input.displayName.trim()) {
    throw new MockAuthError('Display name is required.', 400);
  }

  if (!USERNAME_PATTERN.test(input.username)) {
    throw new MockAuthError(
      'Username must be 3-24 characters using lowercase letters, numbers, or underscores.',
      400,
    );
  }

  if (!EMAIL_PATTERN.test(input.email)) {
    throw new MockAuthError('A valid email address is required.', 400);
  }

  if (input.password.length < PASSWORD_MIN_LENGTH) {
    throw new MockAuthError('Password must be at least 8 characters long.', 400);
  }
}

function validateProfileUpdate(input: UpdateProfileInput) {
  if (!input.displayName.trim()) {
    throw new MockAuthError('Display name is required.', 400);
  }

  if (!USERNAME_PATTERN.test(input.username)) {
    throw new MockAuthError(
      'Username must be 3-24 characters using lowercase letters, numbers, or underscores.',
      400,
    );
  }

  if (input.bio.length > 280) {
    throw new MockAuthError('Bio must be 280 characters or fewer.', 400);
  }
}

export async function mockSignUp(input: SignUpInput) {
  return mutateDatabase(async (database) => {
    const normalizedInput = {
      ...input,
      displayName: input.displayName.trim(),
      username: normalizeUsername(input.username),
      email: normalizeEmail(input.email),
    };

    validateSignUp(normalizedInput);

    if (database.users.some((user) => user.email === normalizedInput.email)) {
      throw new MockAuthError('That email is already in use.', 409);
    }

    if (database.users.some((user) => user.username === normalizedInput.username)) {
      throw new MockAuthError('That username is already in use.', 409);
    }

    const now = new Date().toISOString();
    const user: MockUserRecord = {
      id: createId('user'),
      email: normalizedInput.email,
      username: normalizedInput.username,
      displayName: normalizedInput.displayName,
      bio: '',
      avatarUrl: null,
      password: normalizedInput.password,
      createdAt: now,
      updatedAt: now,
      emailVerifiedAt: null,
      deactivatedAt: null,
    };

    database.users.push(user);
    database.emailVerificationTokens.push({
      id: createId('verify'),
      token: createId('verify-token'),
      userId: user.id,
      createdAt: now,
      expiresAt: new Date(Date.now() + TOKEN_WINDOW_MS).toISOString(),
    });

    return {
      message: 'Account created. Verify your email before signing in.',
      user: toSessionUser(user),
    };
  });
}

export async function mockRequestEmailVerification(email: string) {
  return mutateDatabase(async (database) => {
    const user = database.users.find((entry) => entry.email === normalizeEmail(email));

    if (user && user.deactivatedAt === null && user.emailVerifiedAt === null) {
      const now = new Date().toISOString();
      database.emailVerificationTokens = database.emailVerificationTokens.filter((entry) => entry.userId !== user.id);
      database.emailVerificationTokens.push({
        id: createId('verify'),
        token: createId('verify-token'),
        userId: user.id,
        createdAt: now,
        expiresAt: new Date(Date.now() + TOKEN_WINDOW_MS).toISOString(),
      });
    }

    return { message: 'If that account exists, a verification email has been sent.' };
  });
}

export async function mockConfirmEmailVerification(token: string) {
  return mutateDatabase(async (database) => {
    const tokenEntry = database.emailVerificationTokens.find((entry) => entry.token === token) ?? null;

    if (!tokenEntry) {
      throw new MockAuthError('That verification token is invalid or expired.', 400);
    }

    const user = database.users.find((entry) => entry.id === tokenEntry.userId) ?? null;

    if (!user || user.deactivatedAt !== null) {
      throw new MockAuthError('That verification token is invalid or expired.', 400);
    }

    user.emailVerifiedAt = new Date().toISOString();
    user.updatedAt = user.emailVerifiedAt;
    database.emailVerificationTokens = database.emailVerificationTokens.filter((entry) => entry.userId !== user.id);

    return { message: 'Email verified.', user: toSessionUser(user) };
  });
}

export async function mockSignIn(input: SignInInput) {
  return mutateDatabase(async (database) => {
    const email = normalizeEmail(input.email);
    const user = database.users.find((entry) => entry.email === email) ?? null;

    if (!user || user.password !== input.password) {
      throw new MockAuthError('Email or password is incorrect.', 401);
    }

    if (!user.emailVerifiedAt) {
      throw new MockAuthError('Verify your email before signing in.', 403);
    }

    if (user.deactivatedAt !== null) {
      throw new MockAuthError('This account is not available.', 403);
    }

    const now = new Date();
    const token = createId('session-token');
    database.sessions.push({
      id: createId('session'),
      token,
      userId: user.id,
      createdAt: now.toISOString(),
      lastUsedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_WINDOW_MS).toISOString(),
    });

    return { token, user: toSessionUser(user) };
  });
}

export async function mockSignOut(token: string | null | undefined) {
  await mutateDatabase(async (database) => {
    if (!token) {
      return;
    }

    database.sessions = database.sessions.filter((entry) => entry.token !== token);
  });
}

export async function mockFetchSession(token: string | null | undefined) {
  return mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);
    return { user: toSessionUser(viewer.user) };
  });
}

export async function mockRequestPasswordReset(email: string) {
  return mutateDatabase(async (database) => {
    const user = database.users.find((entry) => entry.email === normalizeEmail(email));

    if (user && user.deactivatedAt === null && user.emailVerifiedAt !== null) {
      const now = new Date().toISOString();
      database.passwordResetTokens = database.passwordResetTokens.filter((entry) => entry.userId !== user.id);
      database.passwordResetTokens.push({
        id: createId('reset'),
        token: createId('reset-token'),
        userId: user.id,
        createdAt: now,
        expiresAt: new Date(Date.now() + TOKEN_WINDOW_MS).toISOString(),
      });
    }

    return { message: 'If that account exists, a password reset email has been sent.' };
  });
}

export async function mockConfirmPasswordReset(token: string, password: string) {
  return mutateDatabase(async (database) => {
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new MockAuthError('Password must be at least 8 characters long.', 400);
    }

    const tokenEntry = database.passwordResetTokens.find((entry) => entry.token === token) ?? null;

    if (!tokenEntry) {
      throw new MockAuthError('That password reset token is invalid or expired.', 400);
    }

    const user = database.users.find((entry) => entry.id === tokenEntry.userId) ?? null;

    if (!user || user.deactivatedAt !== null) {
      throw new MockAuthError('That password reset token is invalid or expired.', 400);
    }

    user.password = password;
    user.updatedAt = new Date().toISOString();
    database.passwordResetTokens = database.passwordResetTokens.filter((entry) => entry.userId !== user.id);
    database.sessions = database.sessions.filter((entry) => entry.userId !== user.id);

    return { message: 'Password updated.' };
  });
}

export async function mockListSessions(token: string | null | undefined) {
  return mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);
    return {
      sessions: database.sessions
        .filter((entry) => entry.userId === viewer.user.id)
        .map((entry) => toSessionInfo(entry, token)),
    };
  });
}

export async function mockDeleteSession(sessionId: string, token: string | null | undefined) {
  await mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);
    database.sessions = database.sessions.filter(
      (entry) => !(entry.userId === viewer.user.id && entry.id === sessionId),
    );
  });
}

export async function mockDeleteAccount(token: string | null | undefined) {
  await mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);
    const now = new Date().toISOString();

    viewer.user.deactivatedAt = now;
    viewer.user.updatedAt = now;
    database.sessions = database.sessions.filter((entry) => entry.userId !== viewer.user.id);
    database.follows = database.follows.filter(
      (follow) => follow.followerId !== viewer.user.id && follow.followeeId !== viewer.user.id,
    );
    database.emailVerificationTokens = database.emailVerificationTokens.filter(
      (entry) => entry.userId !== viewer.user.id,
    );
    database.passwordResetTokens = database.passwordResetTokens.filter(
      (entry) => entry.userId !== viewer.user.id,
    );
    database.uploadIntents = database.uploadIntents.filter((entry) => entry.userId !== viewer.user.id);
  });
}

export async function mockCheckUsernameAvailability(username: string) {
  return mutateDatabase(async (database) => ({
    username: normalizeUsername(username),
    available: !database.users.some((user) => user.username === normalizeUsername(username)),
  }));
}

export async function mockSearchProfiles(params: {
  query?: string;
  token?: string | null;
}) {
  return mutateDatabase(async (database) => {
    const viewer = getViewer(database, params.token);
    const query = params.query?.trim().toLowerCase() ?? '';
    const profiles = database.users
      .filter((user) => isUserVisible(user))
      .filter((user) => {
        if (!query) {
          return true;
        }

        return `${user.displayName} ${user.username} ${user.bio}`.toLowerCase().includes(query);
      })
      .sort((left, right) => left.username.localeCompare(right.username))
      .map((user) => toPublicProfile(database, user, viewer?.user ?? null));

    return { profiles, nextCursor: null };
  });
}

export async function mockFetchProfile(username: string, token: string | null | undefined) {
  return mutateDatabase(async (database) => {
    const viewer = getViewer(database, token);
    const subject = database.users.find((entry) => entry.username === username) ?? null;

    if (!subject || !isUserVisible(subject)) {
      throw new MockAuthError('Profile not found.', 404);
    }

    return { profile: toProfileDetail(database, subject, viewer?.user ?? null) };
  });
}

export async function mockFetchMyProfile(token: string | null | undefined) {
  return mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);
    return { profile: toProfileDetail(database, viewer.user, viewer.user) };
  });
}

export async function mockUpdateMyProfile(input: UpdateProfileInput, token: string | null | undefined) {
  return mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);
    const normalizedInput = {
      displayName: input.displayName.trim(),
      username: normalizeUsername(input.username),
      bio: input.bio.trim(),
    };

    validateProfileUpdate(normalizedInput);

    if (
      database.users.some(
        (user) => user.id !== viewer.user.id && user.username === normalizedInput.username,
      )
    ) {
      throw new MockAuthError('That username is already in use.', 409);
    }

    viewer.user.displayName = normalizedInput.displayName;
    viewer.user.username = normalizedInput.username;
    viewer.user.bio = normalizedInput.bio;
    viewer.user.updatedAt = new Date().toISOString();

    return {
      user: toSessionUser(viewer.user),
      profile: toProfileDetail(database, viewer.user, viewer.user),
    };
  });
}

export async function mockCreateAvatarUploadIntent(
  contentType: string,
  token: string | null | undefined,
) {
  return mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);
    const uploadToken = createId('upload-token');
    const intent: MockUploadIntentRecord = {
      uploadToken,
      uploadUrl: `https://uploads.example.test/mock/${uploadToken}`,
      assetUrl: `https://assets.example.test/avatar/${viewer.user.id}/${uploadToken}`,
      expiresAt: new Date(Date.now() + UPLOAD_INTENT_WINDOW_MS).toISOString(),
      contentType,
      userId: viewer.user.id,
      completedAt: null,
    };

    database.uploadIntents = database.uploadIntents.filter((entry) => entry.userId !== viewer.user.id);
    database.uploadIntents.push(intent);

    return { uploadIntent: intent as UploadIntent };
  });
}

export async function mockCompleteAvatarUpload(
  input: { clear?: boolean; uploadToken?: string | null },
  token: string | null | undefined,
) {
  return mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);

    if (input.clear) {
      viewer.user.avatarUrl = null;
      viewer.user.updatedAt = new Date().toISOString();
      return {
        user: toSessionUser(viewer.user),
        profile: toProfileDetail(database, viewer.user, viewer.user),
      };
    }

    const uploadToken = String(input.uploadToken ?? '').trim();
    const intent = database.uploadIntents.find((entry) => entry.uploadToken === uploadToken) ?? null;

    if (!intent || intent.userId !== viewer.user.id || intent.completedAt !== null || isExpired(intent.expiresAt)) {
      throw new MockAuthError('That upload intent is invalid or expired.', 400);
    }

    intent.completedAt = new Date().toISOString();
    viewer.user.avatarUrl = intent.assetUrl;
    viewer.user.updatedAt = intent.completedAt;

    return {
      user: toSessionUser(viewer.user),
      profile: toProfileDetail(database, viewer.user, viewer.user),
    };
  });
}

export async function mockUpdateMyAvatar(avatarDataUrl: string | null, token: string | null | undefined) {
  if (avatarDataUrl === null) {
    return mockCompleteAvatarUpload({ clear: true }, token);
  }

  const { uploadIntent } = await mockCreateAvatarUploadIntent('image/jpeg', token);
  return mockCompleteAvatarUpload({ uploadToken: uploadIntent.uploadToken }, token);
}

export async function mockFollowProfile(username: string, token: string | null | undefined) {
  return mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);
    const target = database.users.find((entry) => entry.username === username) ?? null;

    if (!target || !isUserVisible(target)) {
      throw new MockAuthError('Profile not found.', 404);
    }

    if (target.id === viewer.user.id) {
      throw new MockAuthError('You cannot follow yourself.', 400);
    }

    const existingFollow = database.follows.find(
      (follow) => follow.followerId === viewer.user.id && follow.followeeId === target.id,
    );

    if (!existingFollow) {
      database.follows.push({
        followerId: viewer.user.id,
        followeeId: target.id,
        createdAt: new Date().toISOString(),
      });
    }

    return { profile: toProfileDetail(database, target, viewer.user) };
  });
}

export async function mockUnfollowProfile(username: string, token: string | null | undefined) {
  await mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);
    const target = database.users.find((entry) => entry.username === username) ?? null;

    if (!target || !isUserVisible(target)) {
      throw new MockAuthError('Profile not found.', 404);
    }

    database.follows = database.follows.filter(
      (follow) => !(follow.followerId === viewer.user.id && follow.followeeId === target.id),
    );
  });
}

export async function mockFetchFollowers(username: string, token: string | null | undefined) {
  return mutateDatabase(async (database) => {
    const viewer = getViewer(database, token);
    const subject = database.users.find((entry) => entry.username === username) ?? null;

    if (!subject || !isUserVisible(subject)) {
      throw new MockAuthError('Profile not found.', 404);
    }

    const profiles = database.follows
      .filter((follow) => follow.followeeId === subject.id)
      .map((follow) => database.users.find((user) => user.id === follow.followerId) ?? null)
      .filter((user): user is MockUserRecord => Boolean(user && isUserVisible(user)))
      .map((user) => toPublicProfile(database, user, viewer?.user ?? null));

    return { profiles, nextCursor: null };
  });
}

export async function mockFetchFollowing(username: string, token: string | null | undefined) {
  return mutateDatabase(async (database) => {
    const viewer = getViewer(database, token);
    const subject = database.users.find((entry) => entry.username === username) ?? null;

    if (!subject || !isUserVisible(subject)) {
      throw new MockAuthError('Profile not found.', 404);
    }

    const profiles = database.follows
      .filter((follow) => follow.followerId === subject.id)
      .map((follow) => database.users.find((user) => user.id === follow.followeeId) ?? null)
      .filter((user): user is MockUserRecord => Boolean(user && isUserVisible(user)))
      .map((user) => toPublicProfile(database, user, viewer?.user ?? null));

    return { profiles, nextCursor: null };
  });
}

export async function mockFetchActivity(token: string | null | undefined) {
  return mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);
    const activity: ActivityItem[] = [];

    for (const follow of database.follows) {
      if (follow.followeeId === viewer.user.id) {
        const actor = database.users.find((user) => user.id === follow.followerId) ?? null;

        if (actor && isUserVisible(actor)) {
          activity.push({
            type: 'followed_you',
            createdAt: follow.createdAt,
            profile: toPublicProfile(database, actor, viewer.user),
          });
        }
      }

      if (follow.followerId === viewer.user.id) {
        const subject = database.users.find((user) => user.id === follow.followeeId) ?? null;

        if (subject && isUserVisible(subject)) {
          activity.push({
            type: 'you_followed',
            createdAt: follow.createdAt,
            profile: toPublicProfile(database, subject, viewer.user),
          });
        }
      }
    }

    activity.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return { activity };
  });
}

export async function resetMockAuthService() {
  cachedDatabase = cloneDatabase(SEEDED_DATABASE);
  mutationQueue = Promise.resolve();
  await persistDatabase(cachedDatabase);
}
