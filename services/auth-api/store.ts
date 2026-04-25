import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type {
  ActivityItem,
  AdminAuditEvent,
  Comment,
  CommentStatus,
  FollowRelationship,
  Notification,
  NotificationType,
  Post,
  PostStatus,
  ProfileDetail,
  PublicProfile,
  Reaction,
  ReactionType,
  Relationship,
  Report,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  Role,
  SessionInfo,
  SessionUser,
  UploadIntent,
  UserStatus,
} from '../../shared/social';
import { hasPermission } from '../../shared/social';

export interface StoredUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  role: Role;
  status: UserStatus;
  discoverable: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  emailVerifiedAt: string | null;
  suspendedAt: string | null;
  deactivatedAt: string | null;
  passwordHash: string;
}

export interface StoredSession {
  id: string;
  token: string;
  userId: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export interface StoredBlock {
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

export interface StoredMute {
  muterId: string;
  mutedId: string;
  createdAt: string;
}

export interface StoredPost {
  id: string;
  authorId: string;
  body: string;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StoredComment {
  id: string;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
  body: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StoredReaction {
  id: string;
  postId: string;
  userId: string;
  type: ReactionType;
  createdAt: string;
}

export interface StoredNotification {
  id: string;
  userId: string;
  type: NotificationType;
  actorUserId: string | null;
  postId: string | null;
  commentId: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface StoredReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reporterId: string;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  resolutionNote: string | null;
}

export interface StoredEmailVerificationToken {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

export interface StoredPasswordResetToken {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

export interface StoredUploadIntent {
  id: string;
  userId: string;
  kind: 'avatar' | 'cover';
  uploadToken: string;
  assetUrl: string;
  contentType: string;
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
}

export interface StoreDocument {
  users: StoredUser[];
  sessions: StoredSession[];
  follows: FollowRelationship[];
  blocks: StoredBlock[];
  mutes: StoredMute[];
  posts: StoredPost[];
  comments: StoredComment[];
  reactions: StoredReaction[];
  notifications: StoredNotification[];
  reports: StoredReport[];
  auditEvents: AdminAuditEvent[];
  emailVerificationTokens: StoredEmailVerificationToken[];
  passwordResetTokens: StoredPasswordResetToken[];
  uploadIntents: StoredUploadIntent[];
}

type LegacyStoredUser = {
  id: string;
  name?: string;
  email?: string;
  createdAt?: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  passwordHash?: string;
  username?: string;
  displayName?: string;
  bio?: string;
  role?: Role;
  status?: UserStatus;
  discoverable?: boolean;
  onboardingCompleted?: boolean;
  updatedAt?: string;
  emailVerifiedAt?: string | null;
  suspendedAt?: string | null;
  deactivatedAt?: string | null;
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
  blocks: [],
  mutes: [],
  posts: [],
  comments: [],
  reactions: [],
  notifications: [],
  reports: [],
  auditEvents: [],
  emailVerificationTokens: [],
  passwordResetTokens: [],
  uploadIntents: [],
};

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATA_URL_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i;
const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const TOKEN_WINDOW_MS = 60 * 60 * 1000;

function cloneDocument(document: StoreDocument): StoreDocument {
  return JSON.parse(JSON.stringify(document)) as StoreDocument;
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

function normalizeStatus(status: string | undefined): UserStatus {
  if (status === 'active' || status === 'suspended' || status === 'deactivated') {
    return status;
  }

  return 'active';
}

function computeOnboardingCompleted(user: Pick<StoredUser, 'bio' | 'avatarUrl' | 'displayName' | 'emailVerifiedAt'>) {
  return Boolean(user.displayName.trim() && user.bio.trim() && user.avatarUrl && user.emailVerifiedAt);
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
  const emailVerifiedAt =
    rawUser.emailVerifiedAt === null
      ? null
      : typeof rawUser.emailVerifiedAt === 'string' && rawUser.emailVerifiedAt.trim()
        ? rawUser.emailVerifiedAt
        : createdAt;
  const nextUser: StoredUser = {
    id: String(rawUser.id ?? randomUUID()),
    email,
    username,
    displayName,
    bio: typeof rawUser.bio === 'string' ? rawUser.bio : '',
    avatarUrl: rawUser.avatarUrl ?? null,
    coverUrl: rawUser.coverUrl ?? null,
    role: normalizeRole(rawUser.role, email, adminEmails),
    status: normalizeStatus(rawUser.status),
    discoverable: rawUser.discoverable ?? true,
    onboardingCompleted: rawUser.onboardingCompleted ?? false,
    createdAt,
    updatedAt:
      typeof rawUser.updatedAt === 'string' && rawUser.updatedAt.trim()
        ? rawUser.updatedAt
        : createdAt,
    emailVerifiedAt,
    suspendedAt: rawUser.suspendedAt ?? null,
    deactivatedAt: rawUser.deactivatedAt ?? null,
    passwordHash: String(rawUser.passwordHash ?? ''),
  };

  nextUser.onboardingCompleted = computeOnboardingCompleted(nextUser);
  return nextUser;
}

function normalizeSession(raw: Partial<StoredSession>): StoredSession {
  const createdAt = String(raw.createdAt ?? new Date().toISOString());
  const lastUsedAt = String(raw.lastUsedAt ?? createdAt);
  const expiresAt = String(raw.expiresAt ?? new Date(Date.parse(lastUsedAt) + 30 * 24 * 60 * 60 * 1000).toISOString());

  return {
    id: String(raw.id ?? randomUUID()),
    token: String(raw.token ?? ''),
    userId: String(raw.userId ?? ''),
    createdAt,
    lastUsedAt,
    expiresAt,
  };
}

function normalizeBlock(raw: Partial<StoredBlock>): StoredBlock {
  return {
    blockerId: String(raw.blockerId ?? ''),
    blockedId: String(raw.blockedId ?? ''),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

function normalizeMute(raw: Partial<StoredMute>): StoredMute {
  return {
    muterId: String(raw.muterId ?? ''),
    mutedId: String(raw.mutedId ?? ''),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

function normalizePost(raw: Partial<StoredPost>): StoredPost {
  const status: PostStatus =
    raw.status === 'hidden' || raw.status === 'removed' || raw.status === 'active'
      ? raw.status
      : 'active';
  const createdAt = String(raw.createdAt ?? new Date().toISOString());
  return {
    id: String(raw.id ?? randomUUID()),
    authorId: String(raw.authorId ?? ''),
    body: String(raw.body ?? ''),
    status,
    createdAt,
    updatedAt: String(raw.updatedAt ?? createdAt),
  };
}

function normalizeComment(raw: Partial<StoredComment>): StoredComment {
  const status: CommentStatus = raw.status === 'removed' ? 'removed' : 'active';
  const createdAt = String(raw.createdAt ?? new Date().toISOString());
  return {
    id: String(raw.id ?? randomUUID()),
    postId: String(raw.postId ?? ''),
    authorId: String(raw.authorId ?? ''),
    parentCommentId:
      raw.parentCommentId === null || raw.parentCommentId === undefined ? null : String(raw.parentCommentId),
    body: String(raw.body ?? ''),
    status,
    createdAt,
    updatedAt: String(raw.updatedAt ?? createdAt),
  };
}

function normalizeReaction(raw: Partial<StoredReaction>): StoredReaction {
  const type: ReactionType =
    raw.type === 'celebrate' || raw.type === 'support' || raw.type === 'like' ? raw.type : 'like';

  return {
    id: String(raw.id ?? randomUUID()),
    postId: String(raw.postId ?? ''),
    userId: String(raw.userId ?? ''),
    type,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

function normalizeNotification(raw: Partial<StoredNotification>): StoredNotification {
  const type: NotificationType =
    raw.type === 'comment' || raw.type === 'reply' || raw.type === 'reaction' || raw.type === 'follow'
      ? raw.type
      : 'follow';

  return {
    id: String(raw.id ?? randomUUID()),
    userId: String(raw.userId ?? ''),
    type,
    actorUserId:
      raw.actorUserId === null || raw.actorUserId === undefined ? null : String(raw.actorUserId),
    postId: raw.postId === null || raw.postId === undefined ? null : String(raw.postId),
    commentId: raw.commentId === null || raw.commentId === undefined ? null : String(raw.commentId),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    readAt: raw.readAt === null || raw.readAt === undefined ? null : String(raw.readAt),
  };
}

function normalizeReport(raw: Partial<StoredReport>): StoredReport {
  const targetType: ReportTargetType = raw.targetType === 'post' ? 'post' : 'user';
  const reason: ReportReason =
    raw.reason === 'abuse' || raw.reason === 'harassment' || raw.reason === 'other' || raw.reason === 'spam'
      ? raw.reason
      : 'other';
  const status: ReportStatus =
    raw.status === 'in_review' || raw.status === 'resolved' || raw.status === 'dismissed' || raw.status === 'open'
      ? raw.status
      : 'open';
  const createdAt = String(raw.createdAt ?? new Date().toISOString());

  return {
    id: String(raw.id ?? randomUUID()),
    targetType,
    targetId: String(raw.targetId ?? ''),
    reporterId: String(raw.reporterId ?? ''),
    reason,
    description: String(raw.description ?? ''),
    status,
    createdAt,
    updatedAt: String(raw.updatedAt ?? createdAt),
    resolutionNote:
      raw.resolutionNote === null || raw.resolutionNote === undefined ? null : String(raw.resolutionNote),
  };
}

function normalizeAuditEvent(raw: Partial<AdminAuditEvent>): AdminAuditEvent {
  return {
    id: String(raw.id ?? randomUUID()),
    actorUserId: String(raw.actorUserId ?? ''),
    action:
      raw.action === 'report.updated' ||
      raw.action === 'role.updated' ||
      raw.action === 'user.status.updated' ||
      raw.action === 'post.status.updated'
        ? raw.action
        : 'report.updated',
    targetType: raw.targetType === 'post' || raw.targetType === 'report' ? raw.targetType : 'user',
    targetId: String(raw.targetId ?? ''),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    metadata: raw.metadata && typeof raw.metadata === 'object' ? (raw.metadata as Record<string, string>) : {},
  };
}

function normalizeTimedToken<T extends { id: string; userId: string; token: string; createdAt: string; expiresAt: string; consumedAt: string | null }>(
  raw: Partial<T>,
): T {
  const createdAt = String(raw.createdAt ?? new Date().toISOString());
  return {
    id: String(raw.id ?? randomUUID()),
    userId: String(raw.userId ?? ''),
    token: String(raw.token ?? ''),
    createdAt,
    expiresAt: String(raw.expiresAt ?? new Date(Date.parse(createdAt) + TOKEN_WINDOW_MS).toISOString()),
    consumedAt: raw.consumedAt === null || raw.consumedAt === undefined ? null : String(raw.consumedAt),
  } as T;
}

function normalizeUploadIntent(raw: Partial<StoredUploadIntent>): StoredUploadIntent {
  const createdAt = String(raw.createdAt ?? new Date().toISOString());
  return {
    id: String(raw.id ?? randomUUID()),
    userId: String(raw.userId ?? ''),
    kind: raw.kind === 'cover' ? 'cover' : 'avatar',
    uploadToken: String(raw.uploadToken ?? randomUUID()),
    assetUrl: String(raw.assetUrl ?? ''),
    contentType: String(raw.contentType ?? 'image/jpeg'),
    createdAt,
    expiresAt: String(raw.expiresAt ?? new Date(Date.parse(createdAt) + TOKEN_WINDOW_MS).toISOString()),
    completedAt: raw.completedAt === null || raw.completedAt === undefined ? null : String(raw.completedAt),
  };
}

function isStoreDocument(value: unknown): value is Partial<StoreDocument> {
  return Boolean(value && typeof value === 'object');
}

function cleanupDocument(document: StoreDocument): StoreDocument {
  const userIds = new Set(document.users.map((user) => user.id));
  const postIds = new Set(document.posts.map((post) => post.id));
  const commentIds = new Set(document.comments.map((comment) => comment.id));
  const now = Date.now();

  document.users.forEach((user) => {
    user.onboardingCompleted = computeOnboardingCompleted(user);
  });
  document.sessions = document.sessions.filter(
    (session) => userIds.has(session.userId) && Date.parse(session.expiresAt) > now && session.token,
  );
  document.follows = document.follows.filter(
    (follow) =>
      userIds.has(follow.followerId) &&
      userIds.has(follow.followeeId) &&
      follow.followerId !== follow.followeeId,
  );
  document.blocks = document.blocks.filter(
    (block) =>
      userIds.has(block.blockerId) &&
      userIds.has(block.blockedId) &&
      block.blockerId !== block.blockedId,
  );
  document.mutes = document.mutes.filter(
    (mute) =>
      userIds.has(mute.muterId) &&
      userIds.has(mute.mutedId) &&
      mute.muterId !== mute.mutedId,
  );
  document.posts = document.posts.filter((post) => userIds.has(post.authorId) && post.body.trim());
  document.comments = document.comments.filter(
    (comment) =>
      userIds.has(comment.authorId) &&
      postIds.has(comment.postId) &&
      comment.body.trim() &&
      (!comment.parentCommentId || commentIds.has(comment.parentCommentId)),
  );
  document.reactions = document.reactions.filter(
    (reaction) =>
      userIds.has(reaction.userId) &&
      postIds.has(reaction.postId) &&
      Boolean(reaction.type),
  );
  document.notifications = document.notifications.filter(
    (notification) =>
      userIds.has(notification.userId) &&
      (!notification.actorUserId || userIds.has(notification.actorUserId)) &&
      (!notification.postId || postIds.has(notification.postId)) &&
      (!notification.commentId || commentIds.has(notification.commentId)),
  );
  document.reports = document.reports.filter(
    (report) =>
      userIds.has(report.reporterId) &&
      ((report.targetType === 'user' && userIds.has(report.targetId)) ||
        (report.targetType === 'post' && postIds.has(report.targetId))),
  );
  document.auditEvents = document.auditEvents.filter((event) => Boolean(event.actorUserId && event.targetId));
  document.emailVerificationTokens = document.emailVerificationTokens.filter(
    (token) => userIds.has(token.userId) && Date.parse(token.expiresAt) > now,
  );
  document.passwordResetTokens = document.passwordResetTokens.filter(
    (token) => userIds.has(token.userId) && Date.parse(token.expiresAt) > now,
  );
  document.uploadIntents = document.uploadIntents.filter(
    (intent) => userIds.has(intent.userId) && Date.parse(intent.expiresAt) > now,
  );

  return document;
}

function normalizeDocument(raw: unknown, adminEmails: Set<string>): StoreDocument {
  if (Array.isArray(raw)) {
    const usedUsernames = new Set<string>();
    return cleanupDocument({
      ...cloneDocument(EMPTY_DOCUMENT),
      users: raw.map((user) => normalizeUser(user as LegacyStoredUser, adminEmails, usedUsernames)),
    });
  }

  if (!isStoreDocument(raw)) {
    return cloneDocument(EMPTY_DOCUMENT);
  }

  const record = raw as Partial<StoreDocument>;
  const usedUsernames = new Set<string>();
  const users = Array.isArray(record.users)
    ? record.users.map((user) => normalizeUser(user as NormalizableUser, adminEmails, usedUsernames))
    : [];
  const document: StoreDocument = {
    users,
    sessions: Array.isArray(record.sessions) ? record.sessions.map((session) => normalizeSession(session)) : [],
    follows: Array.isArray(record.follows)
      ? record.follows.map((follow) => ({
          followerId: String(follow.followerId),
          followeeId: String(follow.followeeId),
          createdAt: String(follow.createdAt ?? new Date().toISOString()),
        }))
      : [],
    blocks: Array.isArray(record.blocks) ? record.blocks.map((block) => normalizeBlock(block)) : [],
    mutes: Array.isArray(record.mutes) ? record.mutes.map((mute) => normalizeMute(mute)) : [],
    posts: Array.isArray(record.posts) ? record.posts.map((post) => normalizePost(post)) : [],
    comments: Array.isArray(record.comments) ? record.comments.map((comment) => normalizeComment(comment)) : [],
    reactions: Array.isArray(record.reactions) ? record.reactions.map((reaction) => normalizeReaction(reaction)) : [],
    notifications: Array.isArray(record.notifications)
      ? record.notifications.map((notification) => normalizeNotification(notification))
      : [],
    reports: Array.isArray(record.reports) ? record.reports.map((report) => normalizeReport(report)) : [],
    auditEvents: Array.isArray(record.auditEvents)
      ? record.auditEvents.map((event) => normalizeAuditEvent(event))
      : [],
    emailVerificationTokens: Array.isArray(record.emailVerificationTokens)
      ? record.emailVerificationTokens.map((token) => normalizeTimedToken<StoredEmailVerificationToken>(token))
      : [],
    passwordResetTokens: Array.isArray(record.passwordResetTokens)
      ? record.passwordResetTokens.map((token) => normalizeTimedToken<StoredPasswordResetToken>(token))
      : [],
    uploadIntents: Array.isArray(record.uploadIntents)
      ? record.uploadIntents.map((intent) => normalizeUploadIntent(intent))
      : [],
  };

  return cleanupDocument(document);
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
  await writeFile(dataFile, JSON.stringify(cleanupDocument(document), null, 2), 'utf8');
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
        Object.assign(document, cloneDocument(EMPTY_DOCUMENT));
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

export function isValidAssetUrl(value: string): boolean {
  return DATA_URL_PATTERN.test(value) || HTTP_URL_PATTERN.test(value);
}

export function isValidAvatarDataUrl(value: string): boolean {
  return DATA_URL_PATTERN.test(value);
}

export function canAuthenticateUser(user: StoredUser): boolean {
  return user.status === 'active' && Boolean(user.emailVerifiedAt);
}

export function toSessionUser(user: StoredUser): SessionUser {
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
    onboardingCompleted: computeOnboardingCompleted(user),
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

function hasBlock(document: StoreDocument, blockerId: string, blockedId: string): boolean {
  return document.blocks.some((block) => block.blockerId === blockerId && block.blockedId === blockedId);
}

function hasMute(document: StoreDocument, muterId: string, mutedId: string): boolean {
  return document.mutes.some((mute) => mute.muterId === muterId && mute.mutedId === mutedId);
}

function getRelationship(document: StoreDocument, viewerId: string | null, profileId: string): Relationship | null {
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
    isBlocked: hasBlock(document, viewerId, profileId),
    hasBlockedYou: hasBlock(document, profileId, viewerId),
    isMuted: hasMute(document, viewerId, profileId),
  };
}

export function isUserAccessible(
  document: StoreDocument,
  subject: StoredUser,
  viewerId: string | null,
  { allowUndiscoverable = false }: { allowUndiscoverable?: boolean } = {},
): boolean {
  if (subject.status !== 'active') {
    return false;
  }

  if (viewerId && subject.id === viewerId) {
    return true;
  }

  if (viewerId && (hasBlock(document, viewerId, subject.id) || hasBlock(document, subject.id, viewerId))) {
    return false;
  }

  if (!allowUndiscoverable && !subject.discoverable) {
    return false;
  }

  return true;
}

function getVisibleFollowerCount(document: StoreDocument, userId: string): number {
  return document.follows.filter((follow) => follow.followeeId === userId).length;
}

function getVisibleFollowingCount(document: StoreDocument, userId: string): number {
  return document.follows.filter((follow) => follow.followerId === userId).length;
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
    coverUrl: user.coverUrl,
    role: user.role,
    status: user.status,
    discoverable: user.discoverable,
    onboardingCompleted: computeOnboardingCompleted(user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    followerCount: getVisibleFollowerCount(document, user.id),
    followingCount: getVisibleFollowingCount(document, user.id),
    relationship: getRelationship(document, viewer?.id ?? null, user.id),
  };
}

export function toProfileDetail(
  user: StoredUser,
  document: StoreDocument,
  viewer: SessionUser | null,
): ProfileDetail {
  const isSelf = viewer?.id === user.id;
  const relationship = getRelationship(document, viewer?.id ?? null, user.id);
  const blocked = Boolean(relationship?.isBlocked || relationship?.hasBlockedYou);

  return {
    ...toPublicProfile(user, document, viewer),
    isSelf,
    canEdit: isSelf ? hasPermission(viewer, 'profile.edit:self') : hasPermission(viewer, 'profile.edit:any'),
    canFollow: Boolean(viewer && !isSelf && !blocked && user.status === 'active'),
    canModerate: hasPermission(viewer, 'content.moderate:any'),
  };
}

export function findUserByUsername(document: StoreDocument, username: string): StoredUser | null {
  return document.users.find((entry) => entry.username === normalizeUsername(username)) ?? null;
}

function getReactionCounts(document: StoreDocument, postId: string): Record<ReactionType, number> {
  const counts: Record<ReactionType, number> = {
    celebrate: 0,
    like: 0,
    support: 0,
  };

  for (const reaction of document.reactions) {
    if (reaction.postId === postId) {
      counts[reaction.type] += 1;
    }
  }

  return counts;
}

export function canViewPost(
  document: StoreDocument,
  post: StoredPost,
  viewerId: string | null,
  { hideMuted = false }: { hideMuted?: boolean } = {},
): boolean {
  const author = document.users.find((user) => user.id === post.authorId);

  if (!author || author.status !== 'active') {
    return false;
  }

  if (viewerId && (hasBlock(document, viewerId, author.id) || hasBlock(document, author.id, viewerId))) {
    return false;
  }

  if (hideMuted && viewerId && hasMute(document, viewerId, author.id) && author.id !== viewerId) {
    return false;
  }

  return post.status === 'active';
}

export function toPost(
  document: StoreDocument,
  post: StoredPost,
  viewer: SessionUser | null,
): Post | null {
  const author = document.users.find((user) => user.id === post.authorId);

  if (!author || !isUserAccessible(document, author, viewer?.id ?? null, { allowUndiscoverable: true })) {
    return null;
  }

  const viewerReaction =
    viewer
      ? document.reactions.find((reaction) => reaction.postId === post.id && reaction.userId === viewer.id)?.type ?? null
      : null;

  return {
    id: post.id,
    author: toPublicProfile(author, document, viewer),
    body: post.body,
    status: post.status,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    commentCount: document.comments.filter((comment) => comment.postId === post.id && comment.status === 'active').length,
    reactionCounts: getReactionCounts(document, post.id),
    viewerReaction,
    canEdit: viewer?.id === post.authorId && hasPermission(viewer, 'post.edit:self'),
    canDelete:
      (viewer?.id === post.authorId && hasPermission(viewer, 'post.delete:self')) ||
      hasPermission(viewer, 'content.moderate:any'),
    canModerate: hasPermission(viewer, 'content.moderate:any'),
  };
}

export function toComment(
  document: StoreDocument,
  comment: StoredComment,
  viewer: SessionUser | null,
): Comment | null {
  const author = document.users.find((user) => user.id === comment.authorId);

  if (!author || !isUserAccessible(document, author, viewer?.id ?? null, { allowUndiscoverable: true })) {
    return null;
  }

  return {
    id: comment.id,
    postId: comment.postId,
    parentCommentId: comment.parentCommentId,
    author: toPublicProfile(author, document, viewer),
    body: comment.body,
    status: comment.status,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    canDelete:
      (viewer?.id === comment.authorId && hasPermission(viewer, 'comment.delete:self')) ||
      hasPermission(viewer, 'content.moderate:any'),
    canModerate: hasPermission(viewer, 'content.moderate:any'),
  };
}

export function toNotification(
  document: StoreDocument,
  notification: StoredNotification,
  viewer: SessionUser | null,
): Notification {
  const actorUser = notification.actorUserId
    ? document.users.find((user) => user.id === notification.actorUserId) ?? null
    : null;

  return {
    id: notification.id,
    type: notification.type,
    createdAt: notification.createdAt,
    readAt: notification.readAt,
    actor: actorUser ? toPublicProfile(actorUser, document, viewer) : null,
    postId: notification.postId,
    commentId: notification.commentId,
  };
}

export function toReport(document: StoreDocument, report: StoredReport, viewer: SessionUser | null): Report | null {
  const reporter = document.users.find((user) => user.id === report.reporterId);

  if (!reporter) {
    return null;
  }

  return {
    id: report.id,
    targetType: report.targetType,
    targetId: report.targetId,
    reporter: toPublicProfile(reporter, document, viewer),
    reason: report.reason,
    description: report.description,
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    resolutionNote: report.resolutionNote,
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
    uploadUrl: intent.assetUrl,
    assetUrl: intent.assetUrl,
    expiresAt: intent.expiresAt,
    contentType: intent.contentType,
  };
}

export function buildActivityFeed(document: StoreDocument, viewerId: string): ActivityItem[] {
  return document.notifications
    .filter((notification) => notification.userId === viewerId)
    .map((notification) => {
      const actor = notification.actorUserId
        ? document.users.find((user) => user.id === notification.actorUserId)
        : null;

      if (!actor) {
        return null;
      }

      const type =
        notification.type === 'follow'
          ? 'followed_you'
          : notification.type === 'comment' || notification.type === 'reply'
            ? 'commented_on_your_post'
            : 'reacted_to_your_post';

      return {
        type,
        createdAt: notification.createdAt,
        profile: toPublicProfile(actor, document),
        postId: notification.postId,
      } satisfies ActivityItem;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function appendNotification(
  document: StoreDocument,
  {
    actorUserId,
    commentId = null,
    postId = null,
    type,
    userId,
  }: {
    actorUserId: string | null;
    commentId?: string | null;
    postId?: string | null;
    type: NotificationType;
    userId: string;
  },
) {
  if (actorUserId && hasBlock(document, userId, actorUserId)) {
    return;
  }

  if (actorUserId && hasMute(document, userId, actorUserId)) {
    return;
  }

  const createdAt = new Date().toISOString();
  document.notifications.push({
    id: randomUUID(),
    userId,
    type,
    actorUserId,
    postId,
    commentId,
    createdAt,
    readAt: null,
  });
}

export function appendAuditEvent(
  document: StoreDocument,
  {
    action,
    actorUserId,
    metadata,
    targetId,
    targetType,
  }: {
    action: AdminAuditEvent['action'];
    actorUserId: string;
    metadata?: Record<string, string>;
    targetId: string;
    targetType: AdminAuditEvent['targetType'];
  },
) {
  document.auditEvents.push({
    id: randomUUID(),
    action,
    actorUserId,
    targetType,
    targetId,
    createdAt: new Date().toISOString(),
    metadata: metadata ?? {},
  });
}

export function createUploadIntentRecord(
  userId: string,
  kind: 'avatar' | 'cover',
  contentType: string,
): StoredUploadIntent {
  const createdAt = new Date().toISOString();
  const id = randomUUID();

  return {
    id,
    userId,
    kind,
    uploadToken: randomUUID(),
    assetUrl: `/uploads/${kind}/${userId}/${id}`,
    contentType,
    createdAt,
    expiresAt: new Date(Date.parse(createdAt) + TOKEN_WINDOW_MS).toISOString(),
    completedAt: null,
  };
}

export function createTimedTokenRecord<T extends StoredEmailVerificationToken | StoredPasswordResetToken>(
  userId: string,
): T {
  const createdAt = new Date().toISOString();
  return {
    id: randomUUID(),
    userId,
    token: randomUUID(),
    createdAt,
    expiresAt: new Date(Date.parse(createdAt) + TOKEN_WINDOW_MS).toISOString(),
    consumedAt: null,
  } as T;
}

export function isExpired(timestamp: string): boolean {
  return Date.parse(timestamp) <= Date.now();
}
