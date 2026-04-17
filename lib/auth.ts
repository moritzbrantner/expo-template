import type {
  ActivityItem,
  FollowRelationship,
  Permission,
  ProfileDetail,
  PublicProfile,
  Role,
  SessionUser,
} from '@/shared/social';

export type {
  ActivityItem,
  FollowRelationship,
  Permission,
  ProfileDetail,
  PublicProfile,
  Role,
  SessionUser,
} from '@/shared/social';

export const AUTH_API_URL = process.env.EXPO_PUBLIC_AUTH_API_URL ?? 'http://localhost:4401';

export type AdminUser = SessionUser & {
  createdAt: string;
  updatedAt: string;
  followerCount: number;
  followingCount: number;
};

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

type ApiErrorPayload = {
  error?: string;
};

type ApiRequestOptions = {
  auth?: boolean;
  handleUnauthorized?: boolean;
};

let authTokenGetter: (() => string | null) | null = null;
let unauthorizedHandler: (() => void | Promise<void>) | null = null;

export function configureApiClient({
  getToken,
  onUnauthorized,
}: {
  getToken: () => string | null;
  onUnauthorized: () => void | Promise<void>;
}) {
  authTokenGetter = getToken;
  unauthorizedHandler = onUnauthorized;
}

async function parseResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | T | null;
  const errorMessage =
    payload && typeof payload === 'object' && 'error' in payload
      ? (payload.error as string | undefined)
      : undefined;

  if (!response.ok) {
    throw new ApiRequestError(errorMessage ?? 'The request could not be completed.', response.status);
  }

  return (payload ?? {}) as T;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options: ApiRequestOptions = {},
) {
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.auth !== false) {
    const token = authTokenGetter?.();

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${AUTH_API_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && options.handleUnauthorized !== false) {
    await unauthorizedHandler?.();
  }

  return parseResponse<T>(response);
}

export async function signUpRequest(input: {
  displayName: string;
  username: string;
  email: string;
  password: string;
}) {
  return request<{
    message: string;
    user: SessionUser;
  }>(
    '/auth/signup',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    { auth: false, handleUnauthorized: false },
  );
}

export async function signInRequest(input: { email: string; password: string }) {
  return request<{
    token: string;
    user: SessionUser;
  }>(
    '/auth/signin',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    { auth: false, handleUnauthorized: false },
  );
}

export async function signOutRequest() {
  return request<void>(
    '/auth/signout',
    {
      method: 'POST',
    },
    { handleUnauthorized: false },
  );
}

export async function fetchSessionRequest() {
  return request<{
    user: SessionUser;
  }>('/auth/session');
}

export async function searchProfilesRequest(params: { query?: string; cursor?: string | null }) {
  const searchParams = new URLSearchParams();

  if (params.query) {
    searchParams.set('query', params.query);
  }

  if (params.cursor) {
    searchParams.set('cursor', params.cursor);
  }

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return request<{
    profiles: PublicProfile[];
    nextCursor: string | null;
  }>(`/profiles${suffix}`, undefined, { auth: true, handleUnauthorized: false });
}

export async function fetchProfileRequest(username: string) {
  return request<{
    profile: ProfileDetail;
  }>(`/profiles/${encodeURIComponent(username)}`, undefined, {
    auth: true,
    handleUnauthorized: false,
  });
}

export async function updateMyProfileRequest(input: {
  displayName: string;
  username: string;
  bio: string;
}) {
  return request<{
    user: SessionUser;
    profile: ProfileDetail;
  }>('/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function updateMyAvatarRequest(avatarDataUrl: string | null) {
  return request<{
    user: SessionUser;
    profile: ProfileDetail;
  }>('/me/avatar', {
    method: 'POST',
    body: JSON.stringify({
      avatarDataUrl,
    }),
  });
}

export async function followProfileRequest(username: string) {
  return request<{
    profile: ProfileDetail;
  }>(`/profiles/${encodeURIComponent(username)}/follow`, {
    method: 'POST',
  });
}

export async function unfollowProfileRequest(username: string) {
  await request<void>(`/profiles/${encodeURIComponent(username)}/follow`, {
    method: 'DELETE',
  });
}

export async function fetchFollowersRequest(username: string) {
  return request<{
    profiles: PublicProfile[];
  }>(`/profiles/${encodeURIComponent(username)}/followers`, undefined, {
    auth: true,
    handleUnauthorized: false,
  });
}

export async function fetchFollowingRequest(username: string) {
  return request<{
    profiles: PublicProfile[];
  }>(`/profiles/${encodeURIComponent(username)}/following`, undefined, {
    auth: true,
    handleUnauthorized: false,
  });
}

export async function fetchActivityRequest() {
  return request<{
    activity: ActivityItem[];
  }>('/me/activity');
}

export async function fetchAdminUsersRequest() {
  return request<{
    users: AdminUser[];
  }>('/admin/users');
}

export async function updateUserRoleRequest(userId: string, role: Role) {
  return request<{
    user: AdminUser;
  }>(`/admin/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}
