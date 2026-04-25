export type Role = 'member' | 'moderator' | 'admin';

export type UserStatus = 'active' | 'suspended' | 'deactivated';

export type Permission =
  | 'profile.read'
  | 'profile.edit:self'
  | 'profile.edit:any'
  | 'follow.create:self'
  | 'follow.delete:self'
  | 'block.create:self'
  | 'block.delete:self'
  | 'mute.create:self'
  | 'mute.delete:self'
  | 'activity.read:self'
  | 'post.create:self'
  | 'post.edit:self'
  | 'post.delete:self'
  | 'comment.create:self'
  | 'comment.delete:self'
  | 'reaction.create:self'
  | 'reaction.delete:self'
  | 'notification.read:self'
  | 'session.read:self'
  | 'session.delete:self'
  | 'account.delete:self'
  | 'report.create:self'
  | 'report.read:any'
  | 'report.manage:any'
  | 'user.status.manage:any'
  | 'content.moderate:any'
  | 'role.manage:any'
  | 'audit.read:any';

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  role: Role;
  status: UserStatus;
  discoverable: boolean;
  onboardingCompleted: boolean;
  emailVerifiedAt: string | null;
};

export type Relationship = {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isBlocked: boolean;
  hasBlockedYou: boolean;
  isMuted: boolean;
};

export type FollowState = Relationship;

export type PublicProfile = {
  id: string;
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
  followerCount: number;
  followingCount: number;
  relationship: Relationship | null;
};

export type ProfileDetail = PublicProfile & {
  isSelf: boolean;
  canEdit: boolean;
  canFollow: boolean;
  canModerate: boolean;
};

export type FollowRelationship = {
  followerId: string;
  followeeId: string;
  createdAt: string;
};

export type ActivityItem = {
  type: 'followed_you' | 'you_followed' | 'commented_on_your_post' | 'reacted_to_your_post';
  createdAt: string;
  profile: PublicProfile;
  postId?: string | null;
};

export type SessionInfo = {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
};

export type UploadIntent = {
  uploadToken: string;
  uploadUrl: string;
  assetUrl: string;
  expiresAt: string;
  contentType: string;
};

export type ReactionType = 'like' | 'celebrate' | 'support';

export type PostStatus = 'active' | 'hidden' | 'removed';

export type CommentStatus = 'active' | 'removed';

export type Post = {
  id: string;
  author: PublicProfile;
  body: string;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  reactionCounts: Record<ReactionType, number>;
  viewerReaction: ReactionType | null;
  canEdit: boolean;
  canDelete: boolean;
  canModerate: boolean;
};

export type Comment = {
  id: string;
  postId: string;
  parentCommentId: string | null;
  author: PublicProfile;
  body: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt: string;
  canDelete: boolean;
  canModerate: boolean;
};

export type Reaction = {
  id: string;
  postId: string;
  userId: string;
  type: ReactionType;
  createdAt: string;
};

export type NotificationType = 'follow' | 'comment' | 'reply' | 'reaction';

export type Notification = {
  id: string;
  type: NotificationType;
  createdAt: string;
  readAt: string | null;
  actor: PublicProfile | null;
  postId: string | null;
  commentId: string | null;
};

export type ReportTargetType = 'user' | 'post';

export type ReportReason = 'spam' | 'abuse' | 'harassment' | 'other';

export type ReportStatus = 'open' | 'in_review' | 'resolved' | 'dismissed';

export type Report = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reporter: PublicProfile;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  resolutionNote: string | null;
};

export type AdminAuditEvent = {
  id: string;
  actorUserId: string;
  action:
    | 'role.updated'
    | 'user.status.updated'
    | 'post.status.updated'
    | 'report.updated';
  targetType: 'user' | 'post' | 'report';
  targetId: string;
  createdAt: string;
  metadata: Record<string, string>;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

const rolePermissions: Record<Role, Permission[]> = {
  member: [
    'profile.read',
    'profile.edit:self',
    'follow.create:self',
    'follow.delete:self',
    'block.create:self',
    'block.delete:self',
    'mute.create:self',
    'mute.delete:self',
    'activity.read:self',
    'post.create:self',
    'post.edit:self',
    'post.delete:self',
    'comment.create:self',
    'comment.delete:self',
    'reaction.create:self',
    'reaction.delete:self',
    'notification.read:self',
    'session.read:self',
    'session.delete:self',
    'account.delete:self',
    'report.create:self',
  ],
  moderator: [
    'profile.read',
    'profile.edit:self',
    'profile.edit:any',
    'follow.create:self',
    'follow.delete:self',
    'block.create:self',
    'block.delete:self',
    'mute.create:self',
    'mute.delete:self',
    'activity.read:self',
    'post.create:self',
    'post.edit:self',
    'post.delete:self',
    'comment.create:self',
    'comment.delete:self',
    'reaction.create:self',
    'reaction.delete:self',
    'notification.read:self',
    'session.read:self',
    'session.delete:self',
    'account.delete:self',
    'report.create:self',
    'report.read:any',
    'report.manage:any',
    'content.moderate:any',
    'audit.read:any',
  ],
  admin: [
    'profile.read',
    'profile.edit:self',
    'profile.edit:any',
    'follow.create:self',
    'follow.delete:self',
    'block.create:self',
    'block.delete:self',
    'mute.create:self',
    'mute.delete:self',
    'activity.read:self',
    'post.create:self',
    'post.edit:self',
    'post.delete:self',
    'comment.create:self',
    'comment.delete:self',
    'reaction.create:self',
    'reaction.delete:self',
    'notification.read:self',
    'session.read:self',
    'session.delete:self',
    'account.delete:self',
    'report.create:self',
    'report.read:any',
    'report.manage:any',
    'user.status.manage:any',
    'content.moderate:any',
    'role.manage:any',
    'audit.read:any',
  ],
};

export function getPermissionsForRole(role: Role): Permission[] {
  return rolePermissions[role];
}

export function hasPermission(
  user: Pick<SessionUser, 'role' | 'status'> | null | undefined,
  permission: Permission,
): boolean {
  if (!user || user.status !== 'active') {
    return false;
  }

  return rolePermissions[user.role].includes(permission);
}
