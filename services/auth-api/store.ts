import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  ProfileDetail,
  PublicProfile,
  Relationship,
  SessionInfo,
  SessionUser,
  UploadIntent,
} from '../../shared/social';

export interface StoredUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  emailVerifiedAt: string | null;
  deactivatedAt: string | null;
}

export interface StoredSession {
  id: string;
  token: string;
  userId: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export interface StoredFollow {
  followerId: string;
  followeeId: string;
  createdAt: string;
}

export interface StoredEmailVerificationToken {
  id: string;
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface StoredPasswordResetToken {
  id: string;
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface StoredUploadIntent {
  uploadToken: string;
  userId: string;
  kind: 'avatar';
  contentType: string;
  uploadUrl: string;
  assetUrl: string;
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
}

export interface StoreDocument {
  users: StoredUser[];
  sessions: StoredSession[];
  follows: StoredFollow[];
  emailVerificationTokens: StoredEmailVerificationToken[];
  passwordResetTokens: StoredPasswordResetToken[];
  uploadIntents: StoredUploadIntent[];
}

export interface Store {
  mutate<T>(mutator: (document: StoreDocument) => Promise<T> | T): Promise<T>;
  read(): Promise<StoreDocument>;
  reset(): Promise<void>;
}

const SEEDED_NOW = '2026-04-24T08:00:00.000Z';
const DEFAULT_PASSWORD = 'password123';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  return hashPassword(password) === passwordHash;
}

export function isExpired(timestamp: string): boolean {
  return new Date(timestamp).getTime() <= Date.now();
}

export function isUserVisible(user: StoredUser): boolean {
  return user.deactivatedAt === null && user.emailVerifiedAt !== null;
}

export function canAuthenticateUser(user: StoredUser): boolean {
  return isUserVisible(user);
}

export function toSessionUser(user: StoredUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

export function findUserByEmail(document: StoreDocument, email: string): StoredUser | null {
  const normalizedEmail = normalizeEmail(email);
  return document.users.find((user) => user.email === normalizedEmail) ?? null;
}

export function findUserByUsername(document: StoreDocument, username: string): StoredUser | null {
  const normalizedUsername = normalizeUsername(username);
  return document.users.find((user) => user.username === normalizedUsername) ?? null;
}

function getVisibleUserById(document: StoreDocument, userId: string): StoredUser | null {
  const user = document.users.find((entry) => entry.id === userId) ?? null;
  return user && isUserVisible(user) ? user : null;
}

function countFollowers(document: StoreDocument, userId: string): number {
  return document.follows.filter(
    (follow) => follow.followeeId === userId && getVisibleUserById(document, follow.followerId),
  ).length;
}

function countFollowing(document: StoreDocument, userId: string): number {
  return document.follows.filter(
    (follow) => follow.followerId === userId && getVisibleUserById(document, follow.followeeId),
  ).length;
}

function getRelationship(
  document: StoreDocument,
  subjectId: string,
  viewer: StoredUser | SessionUser | null,
): Relationship | null {
  if (!viewer) {
    return null;
  }

  return {
    isFollowedBy: document.follows.some(
      (follow) => follow.followerId === subjectId && follow.followeeId === viewer.id,
    ),
    isFollowing: document.follows.some(
      (follow) => follow.followerId === viewer.id && follow.followeeId === subjectId,
    ),
  };
}

export function toPublicProfile(
  user: StoredUser,
  document: StoreDocument,
  viewer: StoredUser | SessionUser | null,
): PublicProfile {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    followerCount: countFollowers(document, user.id),
    followingCount: countFollowing(document, user.id),
    relationship: getRelationship(document, user.id, viewer),
  };
}

export function toProfileDetail(
  user: StoredUser,
  document: StoreDocument,
  viewer: StoredUser | SessionUser | null,
): ProfileDetail {
  const isSelf = viewer?.id === user.id;

  return {
    ...toPublicProfile(user, document, viewer),
    isSelf,
    canEdit: isSelf,
  };
}

export function toSessionInfo(session: StoredSession, currentToken: string | null): SessionInfo {
  return {
    id: session.id,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    current: currentToken === session.token,
  };
}

export function toUploadIntent(intent: StoredUploadIntent): UploadIntent {
  return {
    uploadToken: intent.uploadToken,
    uploadUrl: intent.uploadUrl,
    assetUrl: intent.assetUrl,
    expiresAt: intent.expiresAt,
    contentType: intent.contentType,
  };
}

function createSeedUser(input: {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  createdAt: string;
}): StoredUser {
  return {
    id: input.id,
    email: normalizeEmail(input.email),
    username: normalizeUsername(input.username),
    displayName: input.displayName,
    bio: input.bio,
    avatarUrl: null,
    passwordHash: hashPassword(DEFAULT_PASSWORD),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    emailVerifiedAt: input.createdAt,
    deactivatedAt: null,
  };
}

function createSeedDocument(): StoreDocument {
  return {
    users: [
      createSeedUser({
        id: 'user-alex',
        email: 'alex@example.test',
        username: 'alex',
        displayName: 'Alex Mercer',
        bio: 'Shipping calm product surfaces across web, mobile, and desktop.',
        createdAt: '2026-04-23T10:30:00.000Z',
      }),
      createSeedUser({
        id: 'user-sam',
        email: 'sam@example.test',
        username: 'sam',
        displayName: 'Sam Rivera',
        bio: 'Curating design systems, onboarding flows, and launch checklists.',
        createdAt: '2026-04-22T14:15:00.000Z',
      }),
      createSeedUser({
        id: 'user-jordan',
        email: 'jordan@example.test',
        username: 'jordan',
        displayName: 'Jordan Lee',
        bio: 'Testing auth handshakes, profile edits, and follow interactions.',
        createdAt: SEEDED_NOW,
      }),
    ],
    sessions: [],
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
    emailVerificationTokens: [],
    passwordResetTokens: [],
    uploadIntents: [],
  };
}

function cloneDocument(document: StoreDocument): StoreDocument {
  return {
    users: document.users.map((user) => ({ ...user })),
    sessions: document.sessions.map((session) => ({ ...session })),
    follows: document.follows.map((follow) => ({ ...follow })),
    emailVerificationTokens: document.emailVerificationTokens.map((token) => ({ ...token })),
    passwordResetTokens: document.passwordResetTokens.map((token) => ({ ...token })),
    uploadIntents: document.uploadIntents.map((intent) => ({ ...intent })),
  };
}

function normalizeDocument(raw: Partial<StoreDocument> | null | undefined): StoreDocument {
  const seeded = createSeedDocument();

  if (!raw) {
    return seeded;
  }

  return {
    users: Array.isArray(raw.users) ? raw.users.map(normalizeStoredUser) : seeded.users,
    sessions: Array.isArray(raw.sessions) ? raw.sessions.map(normalizeStoredSession) : [],
    follows: Array.isArray(raw.follows) ? raw.follows.map(normalizeStoredFollow) : [],
    emailVerificationTokens: Array.isArray(raw.emailVerificationTokens)
      ? raw.emailVerificationTokens.map(normalizeEmailVerificationToken)
      : [],
    passwordResetTokens: Array.isArray(raw.passwordResetTokens)
      ? raw.passwordResetTokens.map(normalizePasswordResetToken)
      : [],
    uploadIntents: Array.isArray(raw.uploadIntents) ? raw.uploadIntents.map(normalizeUploadIntent) : [],
  };
}

function normalizeStoredUser(raw: Partial<StoredUser>): StoredUser {
  const createdAt = String(raw.createdAt ?? new Date().toISOString());
  return {
    id: String(raw.id ?? randomUUID()),
    email: normalizeEmail(String(raw.email ?? '')),
    username: normalizeUsername(String(raw.username ?? '')),
    displayName: String(raw.displayName ?? ''),
    bio: String(raw.bio ?? ''),
    avatarUrl: raw.avatarUrl ?? null,
    passwordHash: String(raw.passwordHash ?? ''),
    createdAt,
    updatedAt: String(raw.updatedAt ?? createdAt),
    emailVerifiedAt: raw.emailVerifiedAt ?? null,
    deactivatedAt: raw.deactivatedAt ?? null,
  };
}

function normalizeStoredSession(raw: Partial<StoredSession>): StoredSession {
  const createdAt = String(raw.createdAt ?? new Date().toISOString());
  return {
    id: String(raw.id ?? randomUUID()),
    token: String(raw.token ?? ''),
    userId: String(raw.userId ?? ''),
    createdAt,
    lastUsedAt: String(raw.lastUsedAt ?? createdAt),
    expiresAt: String(raw.expiresAt ?? createdAt),
  };
}

function normalizeStoredFollow(raw: Partial<StoredFollow>): StoredFollow {
  return {
    followerId: String(raw.followerId ?? ''),
    followeeId: String(raw.followeeId ?? ''),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

function normalizeEmailVerificationToken(
  raw: Partial<StoredEmailVerificationToken>,
): StoredEmailVerificationToken {
  const createdAt = String(raw.createdAt ?? new Date().toISOString());
  return {
    id: String(raw.id ?? randomUUID()),
    token: String(raw.token ?? randomUUID()),
    userId: String(raw.userId ?? ''),
    createdAt,
    expiresAt: String(raw.expiresAt ?? createdAt),
  };
}

function normalizePasswordResetToken(raw: Partial<StoredPasswordResetToken>): StoredPasswordResetToken {
  const createdAt = String(raw.createdAt ?? new Date().toISOString());
  return {
    id: String(raw.id ?? randomUUID()),
    token: String(raw.token ?? randomUUID()),
    userId: String(raw.userId ?? ''),
    createdAt,
    expiresAt: String(raw.expiresAt ?? createdAt),
  };
}

function normalizeUploadIntent(raw: Partial<StoredUploadIntent>): StoredUploadIntent {
  const createdAt = String(raw.createdAt ?? new Date().toISOString());
  return {
    uploadToken: String(raw.uploadToken ?? randomUUID()),
    userId: String(raw.userId ?? ''),
    kind: 'avatar',
    contentType: String(raw.contentType ?? 'image/jpeg'),
    uploadUrl: String(raw.uploadUrl ?? ''),
    assetUrl: String(raw.assetUrl ?? ''),
    createdAt,
    expiresAt: String(raw.expiresAt ?? createdAt),
    completedAt: raw.completedAt ?? null,
  };
}

function pruneDocument(document: StoreDocument): void {
  document.sessions = document.sessions.filter((session) => !isExpired(session.expiresAt));
  document.emailVerificationTokens = document.emailVerificationTokens.filter(
    (token) => !isExpired(token.expiresAt),
  );
  document.passwordResetTokens = document.passwordResetTokens.filter((token) => !isExpired(token.expiresAt));
  document.uploadIntents = document.uploadIntents.filter((intent) => !isExpired(intent.expiresAt));
  const activeUserIds = new Set(document.users.filter((user) => user.deactivatedAt === null).map((user) => user.id));
  document.follows = document.follows.filter(
    (follow) => activeUserIds.has(follow.followerId) && activeUserIds.has(follow.followeeId),
  );
}

async function writeDocument(dataFile: string, document: StoreDocument): Promise<void> {
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, JSON.stringify(document, null, 2), 'utf8');
}

async function readDocument(dataFile: string): Promise<StoreDocument> {
  try {
    const raw = await readFile(dataFile, 'utf8');
    return normalizeDocument(JSON.parse(raw) as Partial<StoreDocument>);
  } catch (error) {
    const seeded = createSeedDocument();
    await writeDocument(dataFile, seeded);
    return seeded;
  }
}

export function createStore({
  dataFile = '/data/users.json',
}: {
  dataFile?: string;
} = {}): Store {
  let cachedDocument: StoreDocument | null = null;
  let mutationQueue = Promise.resolve();

  async function load(): Promise<StoreDocument> {
    if (cachedDocument) {
      return cloneDocument(cachedDocument);
    }

    const document = await readDocument(dataFile);
    pruneDocument(document);
    cachedDocument = cloneDocument(document);
    await writeDocument(dataFile, document);
    return cloneDocument(document);
  }

  async function persist(document: StoreDocument): Promise<void> {
    pruneDocument(document);
    cachedDocument = cloneDocument(document);
    await writeDocument(dataFile, document);
  }

  return {
    async read() {
      return load();
    },
    async mutate<T>(mutator: (document: StoreDocument) => Promise<T> | T): Promise<T> {
      const runMutation = async () => {
        const document = await load();
        const result = await mutator(document);
        await persist(document);
        return result;
      };

      const result = mutationQueue.then(runMutation, runMutation);
      mutationQueue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    async reset() {
      const document = createSeedDocument();
      await persist(document);
    },
  };
}
