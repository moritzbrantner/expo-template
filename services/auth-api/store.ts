import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { ActivityItem, FollowRelationship, ProfileDetail, PublicProfile, Role, SessionUser } from '../../shared/social';
import { hasPermission } from '../../shared/social';

export interface StoredUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  role: Role;
  status: 'active';
  createdAt: string;
  updatedAt: string;
  passwordHash: string;
}

export interface StoredSession {
  token: string;
  userId: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export interface StoreDocument {
  users: StoredUser[];
  sessions: StoredSession[];
  follows: FollowRelationship[];
}

type LegacyStoredUser = {
  id: string;
  name?: string;
  email?: string;
  createdAt?: string;
  avatarUrl?: string | null;
  passwordHash?: string;
  username?: string;
  displayName?: string;
  bio?: string;
  role?: Role;
  updatedAt?: string;
};

type NormalizableUser = LegacyStoredUser & Partial<StoredUser>;

export interface Store {
  dataFile: string;
  adminEmails: Set<string>;
  read: () => Promise<StoreDocument>;
  mutate: <T>(mutator: (document: StoreDocument) => Promise<T> | T) => Promise<T>;
  reset: () => Promise<void>;
}

const EMPTY_DOCUMENT: StoreDocument = {
  users: [],
  sessions: [],
  follows: [],
};

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AVATAR_DATA_URL_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i;

function cloneDocument(document: StoreDocument): StoreDocument {
  return {
    users: [...document.users],
    sessions: [...document.sessions],
    follows: [...document.follows],
  };
}

async function ensureStore(dataFile: string): Promise<void> {
  await mkdir(dirname(dataFile), { recursive: true });

  try {
    await readFile(dataFile, 'utf8');
  } catch {
    await writeFile(dataFile, JSON.stringify(EMPTY_DOCUMENT, null, 2), 'utf8');
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function slugifyUsername(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (slug.length >= 3) {
    return slug.slice(0, 24);
  }

  return `user_${slug || 'account'}`.slice(0, 24);
}

function ensureUniqueUsername(baseUsername: string, usedUsernames: Set<string>): string {
  let username = baseUsername;
  let suffix = 1;

  while (usedUsernames.has(username)) {
    const suffixText = String(suffix);
    username = `${baseUsername.slice(0, Math.max(1, 24 - suffixText.length))}${suffixText}`;
    suffix += 1;
  }

  usedUsernames.add(username);
  return username;
}

function deriveUsername(user: NormalizableUser): string {
  const raw =
    typeof user.username === 'string' && user.username.trim()
      ? user.username
      : typeof user.displayName === 'string' && user.displayName.trim()
        ? user.displayName
        : typeof user.name === 'string' && user.name.trim()
          ? user.name
          : String(user.email ?? 'user');

  return slugifyUsername(raw.includes('@') ? raw.split('@')[0] : raw);
}

function normalizeRole(role: string | undefined, email: string, adminEmails: Set<string>): Role {
  if (role === 'member' || role === 'moderator' || role === 'admin') {
    return role;
  }

  return adminEmails.has(email) ? 'admin' : 'member';
}

function normalizeUser(
  rawUser: NormalizableUser,
  adminEmails: Set<string>,
  usedUsernames: Set<string>,
): StoredUser {
  const createdAt =
    typeof rawUser.createdAt === 'string' && rawUser.createdAt.trim()
      ? rawUser.createdAt
      : new Date().toISOString();
  const email = normalizeEmail(String(rawUser.email ?? ''));
  const displayName =
    typeof rawUser.displayName === 'string' && rawUser.displayName.trim()
      ? rawUser.displayName.trim()
      : typeof rawUser.name === 'string' && rawUser.name.trim()
        ? rawUser.name.trim()
        : email.split('@')[0] || 'New member';
  const baseUsername = deriveUsername(rawUser);
  const username = ensureUniqueUsername(
    USERNAME_PATTERN.test(baseUsername) ? baseUsername : slugifyUsername(baseUsername),
    usedUsernames,
  );

  return {
    id: String(rawUser.id ?? randomUUID()),
    email,
    username,
    displayName,
    bio: typeof rawUser.bio === 'string' ? rawUser.bio : '',
    avatarUrl: rawUser.avatarUrl ?? null,
    role: normalizeRole(rawUser.role, email, adminEmails),
    status: 'active',
    createdAt,
    updatedAt:
      typeof rawUser.updatedAt === 'string' && rawUser.updatedAt.trim()
        ? rawUser.updatedAt
        : createdAt,
    passwordHash: String(rawUser.passwordHash ?? ''),
  };
}

function isStoreDocument(value: unknown): value is StoreDocument {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Partial<StoreDocument>;
  return Array.isArray(record.users) && Array.isArray(record.sessions) && Array.isArray(record.follows);
}

function normalizeDocument(raw: unknown, adminEmails: Set<string>): StoreDocument {
  if (Array.isArray(raw)) {
    const usedUsernames = new Set<string>();
    return {
      users: raw.map((user) => normalizeUser(user as LegacyStoredUser, adminEmails, usedUsernames)),
      sessions: [],
      follows: [],
    };
  }

  if (!isStoreDocument(raw)) {
    return cloneDocument(EMPTY_DOCUMENT);
  }

  const usedUsernames = new Set<string>();
  const users = raw.users.map((user) =>
    normalizeUser(user, adminEmails, usedUsernames),
  );
  const userIds = new Set(users.map((user) => user.id));
  const sessions = raw.sessions.filter((session) => userIds.has(session.userId));
  const follows = raw.follows.filter(
    (follow) =>
      userIds.has(follow.followerId) &&
      userIds.has(follow.followeeId) &&
      follow.followerId !== follow.followeeId,
  );

  return {
    users,
    sessions,
    follows,
  };
}

async function readDocumentFromDisk(dataFile: string, adminEmails: Set<string>): Promise<StoreDocument> {
  await ensureStore(dataFile);
  const raw = await readFile(dataFile, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  const normalized = normalizeDocument(parsed, adminEmails);

  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
    await writeFile(dataFile, JSON.stringify(normalized, null, 2), 'utf8');
  }

  return normalized;
}

async function writeDocumentToDisk(dataFile: string, document: StoreDocument): Promise<void> {
  await ensureStore(dataFile);
  await writeFile(dataFile, JSON.stringify(document, null, 2), 'utf8');
}

export function createStore({
  dataFile,
  adminEmails,
}: {
  dataFile: string;
  adminEmails?: string[];
}): Store {
  const normalizedAdminEmails = new Set((adminEmails ?? []).map(normalizeEmail));
  let mutationQueue = Promise.resolve();

  return {
    dataFile,
    adminEmails: normalizedAdminEmails,
    async read() {
      await mutationQueue.catch(() => undefined);
      return readDocumentFromDisk(dataFile, normalizedAdminEmails);
    },
    async mutate<T>(mutator: (document: StoreDocument) => Promise<T> | T) {
      let result: T | undefined;

      mutationQueue = mutationQueue
        .catch(() => undefined)
        .then(async () => {
          const document = await readDocumentFromDisk(dataFile, normalizedAdminEmails);
          result = await mutator(document);
          await writeDocumentToDisk(dataFile, document);
        });

      await mutationQueue;
      return result as T;
    },
    async reset() {
      await this.mutate((document) => {
        document.users = [];
        document.sessions = [];
        document.follows = [];
      });
    },
  };
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isValidAvatarDataUrl(value: string): boolean {
  return AVATAR_DATA_URL_PATTERN.test(value);
}

export function toSessionUser(user: StoredUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
  };
}

function getFollowState(document: StoreDocument, viewerId: string | null, profileId: string) {
  if (!viewerId) {
    return null;
  }

  return {
    isFollowing: document.follows.some(
      (follow) => follow.followerId === viewerId && follow.followeeId === profileId,
    ),
    isFollowedBy: document.follows.some(
      (follow) => follow.followerId === profileId && follow.followeeId === viewerId,
    ),
  };
}

export function toPublicProfile(
  user: StoredUser,
  document: StoreDocument,
  viewer: SessionUser | null = null,
): PublicProfile {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    followerCount: document.follows.filter((follow) => follow.followeeId === user.id).length,
    followingCount: document.follows.filter((follow) => follow.followerId === user.id).length,
    relationship: getFollowState(document, viewer?.id ?? null, user.id),
  };
}

export function toProfileDetail(
  user: StoredUser,
  document: StoreDocument,
  viewer: SessionUser | null,
): ProfileDetail {
  return {
    ...toPublicProfile(user, document, viewer),
    isSelf: viewer?.id === user.id,
    canEdit:
      viewer?.id === user.id
        ? hasPermission(viewer, 'profile.edit:self')
        : hasPermission(viewer, 'profile.edit:any'),
  };
}

export function buildActivityFeed(document: StoreDocument, viewerId: string): ActivityItem[] {
  return document.follows
    .filter((follow) => follow.followerId === viewerId || follow.followeeId === viewerId)
    .map((follow) => {
      const type = follow.followeeId === viewerId ? 'followed_you' : 'you_followed';
      const profileId = type === 'followed_you' ? follow.followerId : follow.followeeId;
      const profileUser = document.users.find((user) => user.id === profileId);

      if (!profileUser) {
        return null;
      }

      return {
        type,
        createdAt: follow.createdAt,
        profile: toPublicProfile(profileUser, document),
      } satisfies ActivityItem;
    })
    .filter((item): item is ActivityItem => Boolean(item))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
