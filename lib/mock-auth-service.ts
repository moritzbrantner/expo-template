import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  ActivityItem,
  FollowRelationship,
  ProfileDetail,
  PublicProfile,
  Role,
  SessionUser,
} from '@/shared/social';

const MOCK_AUTH_STORAGE_KEY = 'mock.auth.db.v1';
const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type MockUserRecord = SessionUser & {
  bio: string;
  createdAt: string;
  updatedAt: string;
  password: string;
};

type MockSessionRecord = {
  token: string;
  userId: string;
  createdAt: string;
  lastUsedAt: string;
};

type MockAuthDatabase = {
  users: MockUserRecord[];
  follows: FollowRelationship[];
  sessions: MockSessionRecord[];
};

type MockProfileMetrics = {
  followerCount: number;
  followingCount: number;
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

export type AdminUser = SessionUser & {
  createdAt: string;
  updatedAt: string;
  followerCount: number;
  followingCount: number;
};

export class MockAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'MockAuthError';
    this.status = status;
  }
}

const SEEDED_NOW = '2026-04-24T08:00:00.000Z';

const SEEDED_USERS: MockUserRecord[] = [
  {
    id: 'user-admin',
    email: 'admin@example.test',
    username: 'dev_admin',
    displayName: 'Dev Admin',
    bio: 'Designing the scaffold, testing flows, and keeping the shell honest.',
    avatarUrl: null,
    coverUrl: null,
    role: 'admin',
    status: 'active',
    discoverable: true,
    onboardingCompleted: false,
    emailVerifiedAt: SEEDED_NOW,
    createdAt: SEEDED_NOW,
    updatedAt: SEEDED_NOW,
    password: 'password123',
  },
  {
    id: 'user-alex',
    email: 'alex@example.test',
    username: 'alex',
    displayName: 'Alex Mercer',
    bio: 'Shipping calm product surfaces across web, mobile, and desktop.',
    avatarUrl: null,
    coverUrl: null,
    role: 'member',
    status: 'active',
    discoverable: true,
    onboardingCompleted: false,
    emailVerifiedAt: '2026-04-23T10:30:00.000Z',
    createdAt: '2026-04-23T10:30:00.000Z',
    updatedAt: '2026-04-23T10:30:00.000Z',
    password: 'password123',
  },
  {
    id: 'user-sam',
    email: 'sam@example.test',
    username: 'sam',
    displayName: 'Sam Rivera',
    bio: 'Curating design systems, onboarding flows, and internal launch checklists.',
    avatarUrl: null,
    coverUrl: null,
    role: 'moderator',
    status: 'active',
    discoverable: true,
    onboardingCompleted: false,
    emailVerifiedAt: '2026-04-22T14:15:00.000Z',
    createdAt: '2026-04-22T14:15:00.000Z',
    updatedAt: '2026-04-22T14:15:00.000Z',
    password: 'password123',
  },
];

const SEEDED_FOLLOWS: FollowRelationship[] = [
  {
    followerId: 'user-alex',
    followeeId: 'user-admin',
    createdAt: '2026-04-24T07:15:00.000Z',
  },
  {
    followerId: 'user-admin',
    followeeId: 'user-sam',
    createdAt: '2026-04-24T07:45:00.000Z',
  },
];

const SEEDED_DATABASE: MockAuthDatabase = {
  users: SEEDED_USERS,
  follows: SEEDED_FOLLOWS,
  sessions: [],
};

let cachedDatabase: MockAuthDatabase | null = null;
let mutationQueue = Promise.resolve();

function cloneDatabase(database: MockAuthDatabase): MockAuthDatabase {
  return {
    users: database.users.map((user) => ({ ...user })),
    follows: database.follows.map((follow) => ({ ...follow })),
    sessions: database.sessions.map((session) => ({ ...session })),
  };
}

function normalizeRole(role: string | undefined): Role {
  if (role === 'admin' || role === 'moderator' || role === 'member') {
    return role;
  }

  return 'member';
}

function normalizeUser(raw: Partial<MockUserRecord>): MockUserRecord {
  return {
    id: String(raw.id),
    email: String(raw.email ?? '').trim().toLowerCase(),
    username: String(raw.username ?? '').trim().toLowerCase(),
    displayName: String(raw.displayName ?? '').trim(),
    bio: String(raw.bio ?? ''),
    avatarUrl: raw.avatarUrl ?? null,
    coverUrl: raw.coverUrl ?? null,
    role: normalizeRole(raw.role),
    status: 'active',
    discoverable: raw.discoverable ?? true,
    onboardingCompleted: raw.onboardingCompleted ?? false,
    emailVerifiedAt: raw.emailVerifiedAt ?? new Date().toISOString(),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? raw.createdAt ?? new Date().toISOString()),
    password: String(raw.password ?? ''),
  };
}

function isDatabaseShape(value: unknown): value is MockAuthDatabase {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Partial<MockAuthDatabase>;
  return Array.isArray(record.users) && Array.isArray(record.follows) && Array.isArray(record.sessions);
}

async function loadDatabase(): Promise<MockAuthDatabase> {
  if (cachedDatabase) {
    return cloneDatabase(cachedDatabase);
  }

  try {
    const raw = await AsyncStorage.getItem(MOCK_AUTH_STORAGE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw) as unknown;

      if (isDatabaseShape(parsed)) {
        cachedDatabase = {
          users: parsed.users.map((user) => normalizeUser(user)),
          follows: parsed.follows.map((follow) => ({
            followerId: String(follow.followerId),
            followeeId: String(follow.followeeId),
            createdAt: String(follow.createdAt),
          })),
          sessions: parsed.sessions.map((session) => ({
            token: String(session.token),
            userId: String(session.userId),
            createdAt: String(session.createdAt),
            lastUsedAt: String(session.lastUsedAt ?? session.createdAt),
          })),
        };

        return cloneDatabase(cachedDatabase);
      }
    }
  } catch (error) {
    console.warn('Failed to restore mock auth database.', error);
  }

  cachedDatabase = cloneDatabase(SEEDED_DATABASE);
  await persistDatabase(cachedDatabase);
  return cloneDatabase(cachedDatabase);
}

async function persistDatabase(database: MockAuthDatabase) {
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

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function requireViewer(database: MockAuthDatabase, token: string | null | undefined): MockViewer {
  if (!token) {
    throw new MockAuthError('Session not found.', 401);
  }

  const session = database.sessions.find((entry) => entry.token === token);

  if (!session) {
    throw new MockAuthError('Session not found.', 401);
  }

  const user = database.users.find((entry) => entry.id === session.userId);

  if (!user) {
    throw new MockAuthError('Session not found.', 401);
  }

  session.lastUsedAt = new Date().toISOString();
  return { session, user };
}

function getViewer(database: MockAuthDatabase, token: string | null | undefined) {
  if (!token) {
    return null;
  }

  const session = database.sessions.find((entry) => entry.token === token);

  if (!session) {
    return null;
  }

  const user = database.users.find((entry) => entry.id === session.userId);

  if (!user) {
    return null;
  }

  session.lastUsedAt = new Date().toISOString();
  return { session, user };
}

function toSessionUser(user: MockUserRecord): SessionUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    role: user.role,
    status: user.status,
    discoverable: user.discoverable,
    onboardingCompleted: Boolean(user.bio && user.avatarUrl && user.emailVerifiedAt),
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

function getProfileMetrics(database: MockAuthDatabase, userId: string): MockProfileMetrics {
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
  const isFollowing = viewer
    ? database.follows.some(
        (follow) => follow.followerId === viewer.id && follow.followeeId === subject.id,
      )
    : false;
  const isFollowedBy = viewer
    ? database.follows.some(
        (follow) => follow.followerId === subject.id && follow.followeeId === viewer.id,
      )
    : false;

  return {
    id: subject.id,
    username: subject.username,
    displayName: subject.displayName,
    bio: subject.bio,
    avatarUrl: subject.avatarUrl,
    coverUrl: subject.coverUrl,
    role: subject.role,
    status: subject.status,
    discoverable: subject.discoverable,
    onboardingCompleted: Boolean(subject.bio && subject.avatarUrl && subject.emailVerifiedAt),
    createdAt: subject.createdAt,
    updatedAt: subject.updatedAt,
    followerCount: metrics.followerCount,
    followingCount: metrics.followingCount,
    relationship: viewer
      ? {
          isFollowing,
          isFollowedBy,
          isBlocked: false,
          hasBlockedYou: false,
          isMuted: false,
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
    canFollow: !isSelf,
    canModerate: viewer?.role === 'admin' || viewer?.role === 'moderator',
  };
}

function requireManageRoles(viewer: MockUserRecord) {
  if (viewer.role !== 'admin') {
    throw new MockAuthError('You do not have permission to manage roles.', 403);
  }
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

  if (input.password.length < 8) {
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
      username: input.username.trim().toLowerCase(),
      email: input.email.trim().toLowerCase(),
    };

    validateSignUp(normalizedInput);

    if (database.users.some((user) => user.email === normalizedInput.email)) {
      throw new MockAuthError('An account already exists for this email address.', 409);
    }

    if (database.users.some((user) => user.username === normalizedInput.username)) {
      throw new MockAuthError('That username is already taken.', 409);
    }

    const now = new Date().toISOString();
    const user: MockUserRecord = {
      id: createId('user'),
      email: normalizedInput.email,
      username: normalizedInput.username,
      displayName: normalizedInput.displayName,
      bio: '',
      avatarUrl: null,
      coverUrl: null,
      role: normalizedInput.email === 'admin@example.test' ? 'admin' : 'member',
      status: 'active',
      discoverable: true,
      onboardingCompleted: false,
      emailVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
      password: normalizedInput.password,
    };

    database.users.push(user);

    return {
      message: 'Account created. Sign in to continue.',
      user: toSessionUser(user),
    };
  });
}

export async function mockSignIn(input: SignInInput) {
  return mutateDatabase(async (database) => {
    const email = input.email.trim().toLowerCase();
    const user = database.users.find((entry) => entry.email === email);

    if (!user || user.password !== input.password) {
      throw new MockAuthError('Invalid email or password.', 401);
    }

    const now = new Date().toISOString();
    const token = createId('session');

    database.sessions = database.sessions.filter((entry) => entry.userId !== user.id);
    database.sessions.push({
      token,
      userId: user.id,
      createdAt: now,
      lastUsedAt: now,
    });

    return {
      token,
      user: toSessionUser(user),
    };
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
    return {
      user: toSessionUser(viewer.user),
    };
  });
}

export async function mockSearchProfiles(params: {
  query?: string;
  token?: string | null;
}) {
  return mutateDatabase(async (database) => {
    const viewer = getViewer(database, params.token);
    const query = params.query?.trim().toLowerCase() ?? '';
    const profiles = database.users
      .filter((user) => user.id !== viewer?.user.id)
      .filter((user) => {
        if (!query) {
          return true;
        }

        const haystack = `${user.displayName} ${user.username} ${user.bio}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .map((user) => toPublicProfile(database, user, viewer?.user ?? null));

    return {
      profiles,
      nextCursor: null,
    };
  });
}

export async function mockFetchProfile(username: string, token: string | null | undefined) {
  return mutateDatabase(async (database) => {
    const viewer = getViewer(database, token);
    const subject = database.users.find((entry) => entry.username === username);

    if (!subject) {
      throw new MockAuthError('Profile not found.', 404);
    }

    return {
      profile: toProfileDetail(database, subject, viewer?.user ?? null),
    };
  });
}

export async function mockUpdateMyProfile(input: UpdateProfileInput, token: string | null | undefined) {
  return mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);
    const normalizedInput = {
      displayName: input.displayName.trim(),
      username: input.username.trim().toLowerCase(),
      bio: input.bio.trim(),
    };

    validateProfileUpdate(normalizedInput);

    if (
      database.users.some(
        (user) => user.id !== viewer.user.id && user.username === normalizedInput.username,
      )
    ) {
      throw new MockAuthError('That username is already taken.', 409);
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

export async function mockUpdateMyAvatar(avatarDataUrl: string | null, token: string | null | undefined) {
  return mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);

    viewer.user.avatarUrl = avatarDataUrl;
    viewer.user.updatedAt = new Date().toISOString();

    return {
      user: toSessionUser(viewer.user),
      profile: toProfileDetail(database, viewer.user, viewer.user),
    };
  });
}

export async function mockFollowProfile(username: string, token: string | null | undefined) {
  return mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);
    const target = database.users.find((entry) => entry.username === username);

    if (!target) {
      throw new MockAuthError('Profile not found.', 404);
    }

    if (target.id === viewer.user.id) {
      throw new MockAuthError('You cannot follow your own profile.', 400);
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

    return {
      profile: toProfileDetail(database, target, viewer.user),
    };
  });
}

export async function mockUnfollowProfile(username: string, token: string | null | undefined) {
  await mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);
    const target = database.users.find((entry) => entry.username === username);

    if (!target) {
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
    const subject = database.users.find((entry) => entry.username === username);

    if (!subject) {
      throw new MockAuthError('Profile not found.', 404);
    }

    const profiles = database.follows
      .filter((follow) => follow.followeeId === subject.id)
      .map((follow) => database.users.find((user) => user.id === follow.followerId))
      .filter((user): user is MockUserRecord => Boolean(user))
      .map((user) => toPublicProfile(database, user, viewer?.user ?? null));

    return { profiles };
  });
}

export async function mockFetchFollowing(username: string, token: string | null | undefined) {
  return mutateDatabase(async (database) => {
    const viewer = getViewer(database, token);
    const subject = database.users.find((entry) => entry.username === username);

    if (!subject) {
      throw new MockAuthError('Profile not found.', 404);
    }

    const profiles = database.follows
      .filter((follow) => follow.followerId === subject.id)
      .map((follow) => database.users.find((user) => user.id === follow.followeeId))
      .filter((user): user is MockUserRecord => Boolean(user))
      .map((user) => toPublicProfile(database, user, viewer?.user ?? null));

    return { profiles };
  });
}

export async function mockFetchActivity(token: string | null | undefined) {
  return mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);
    const activity: ActivityItem[] = [];

    for (const follow of database.follows) {
      if (follow.followeeId === viewer.user.id) {
        const follower = database.users.find((user) => user.id === follow.followerId);

        if (follower) {
          activity.push({
            type: 'followed_you',
            createdAt: follow.createdAt,
            profile: toPublicProfile(database, follower, viewer.user),
          });
        }
      }

      if (follow.followerId === viewer.user.id) {
        const followed = database.users.find((user) => user.id === follow.followeeId);

        if (followed) {
          activity.push({
            type: 'you_followed',
            createdAt: follow.createdAt,
            profile: toPublicProfile(database, followed, viewer.user),
          });
        }
      }
    }

    activity.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return { activity };
  });
}

export async function mockFetchAdminUsers(token: string | null | undefined) {
  return mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);
    requireManageRoles(viewer.user);

    const users = database.users
      .map((user) => {
        const metrics = getProfileMetrics(database, user.id);

        return {
          ...toSessionUser(user),
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          followerCount: metrics.followerCount,
          followingCount: metrics.followingCount,
        };
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName));

    return { users };
  });
}

export async function mockUpdateUserRole(
  userId: string,
  role: Role,
  token: string | null | undefined,
) {
  return mutateDatabase(async (database) => {
    const viewer = requireViewer(database, token);
    requireManageRoles(viewer.user);

    const target = database.users.find((user) => user.id === userId);

    if (!target) {
      throw new MockAuthError('User not found.', 404);
    }

    target.role = role;
    target.updatedAt = new Date().toISOString();

    const metrics = getProfileMetrics(database, target.id);

    return {
      user: {
        ...toSessionUser(target),
        createdAt: target.createdAt,
        updatedAt: target.updatedAt,
        followerCount: metrics.followerCount,
        followingCount: metrics.followingCount,
      },
    };
  });
}

export async function resetMockAuthService() {
  cachedDatabase = cloneDatabase(SEEDED_DATABASE);
  mutationQueue = Promise.resolve();
  await persistDatabase(cachedDatabase);
}
