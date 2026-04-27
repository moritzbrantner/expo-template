export type SessionUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type Relationship = {
  isFollowing: boolean;
  isFollowedBy: boolean;
};

export type FollowState = Relationship;

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  followerCount: number;
  followingCount: number;
  relationship: Relationship | null;
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
