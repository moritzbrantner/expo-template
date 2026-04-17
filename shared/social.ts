export type Role = 'member' | 'moderator' | 'admin';

export type Permission =
  | 'profile.read'
  | 'profile.edit:self'
  | 'profile.edit:any'
  | 'follow.create:self'
  | 'follow.delete:self'
  | 'activity.read:self'
  | 'role.manage:any';

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: Role;
  status: 'active';
};

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  role: Role;
  status: 'active';
  createdAt: string;
  updatedAt: string;
  followerCount: number;
  followingCount: number;
  relationship: FollowState | null;
};

export type FollowState = {
  isFollowing: boolean;
  isFollowedBy: boolean;
};

export type ProfileDetail = PublicProfile & {
  isSelf: boolean;
  canEdit: boolean;
};

export type FollowRelationship = {
  followerId: string;
  followeeId: string;
  createdAt: string;
};

export type ActivityItem = {
  type: 'followed_you' | 'you_followed';
  createdAt: string;
  profile: PublicProfile;
};

const rolePermissions: Record<Role, Permission[]> = {
  member: [
    'profile.read',
    'profile.edit:self',
    'follow.create:self',
    'follow.delete:self',
    'activity.read:self',
  ],
  moderator: [
    'profile.read',
    'profile.edit:self',
    'profile.edit:any',
    'follow.create:self',
    'follow.delete:self',
    'activity.read:self',
  ],
  admin: [
    'profile.read',
    'profile.edit:self',
    'profile.edit:any',
    'follow.create:self',
    'follow.delete:self',
    'activity.read:self',
    'role.manage:any',
  ],
};

export function getPermissionsForRole(role: Role): Permission[] {
  return rolePermissions[role];
}

export function hasPermission(
  user: Pick<SessionUser, 'role'> | null | undefined,
  permission: Permission,
): boolean {
  if (!user) {
    return false;
  }

  return rolePermissions[user.role].includes(permission);
}
