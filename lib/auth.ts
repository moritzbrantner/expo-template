import {
  mockFetchActivity,
  mockFetchFollowers,
  mockFetchFollowing,
  mockFetchProfile,
  mockFetchSession,
  mockFollowProfile,
  MockAuthError,
  mockSearchProfiles,
  mockSignIn,
  mockSignOut,
  mockSignUp,
  mockUnfollowProfile,
  mockUpdateMyAvatar,
  mockUpdateMyProfile,
} from '@/lib/mock-auth-service';
import type {
  ActivityItem,
  FollowRelationship,
  ProfileDetail,
  PublicProfile,
  SessionUser,
} from '@/shared/social';

export type { ActivityItem, FollowRelationship, ProfileDetail, PublicProfile, SessionUser } from '@/shared/social';

export const AUTH_API_URL = process.env.EXPO_PUBLIC_AUTH_API_URL ?? 'http://localhost:4401';

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

type ApiErrorPayload = {
  code?: string;
  error?: string;
  message?: string;
};

type ApiRequestOptions = {
  auth?: boolean;
  handleUnauthorized?: boolean;
};

let authTokenGetter: (() => string | null) | null = null;
let unauthorizedHandler: (() => void | Promise<void>) | null = null;

function shouldUseMockAuthService() {
  return process.env.EXPO_PUBLIC_AUTH_MODE === 'mock';
}

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
      : payload && typeof payload === 'object' && 'message' in payload
        ? (payload.message as string | undefined)
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

async function handleMockAuthError(error: unknown, options: ApiRequestOptions = {}): Promise<never> {
  if (!(error instanceof MockAuthError)) {
    throw error;
  }

  const apiError = new ApiRequestError(error.message, error.status);

  if (error.status === 401 && options.handleUnauthorized !== false) {
    await unauthorizedHandler?.();
  }

  throw apiError;
}

export async function signUpRequest(input: {
  displayName: string;
  username: string;
  email: string;
  password: string;
}) {
  if (shouldUseMockAuthService()) {
    try {
      return await mockSignUp(input);
    } catch (error) {
      return handleMockAuthError(error, { auth: false, handleUnauthorized: false });
    }
  }

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
  if (shouldUseMockAuthService()) {
    try {
      return await mockSignIn(input);
    } catch (error) {
      return handleMockAuthError(error, { auth: false, handleUnauthorized: false });
    }
  }

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
  if (shouldUseMockAuthService()) {
    try {
      return await mockSignOut(authTokenGetter?.());
    } catch (error) {
      return handleMockAuthError(error, { handleUnauthorized: false });
    }
  }

  return request<void>(
    '/auth/signout',
    {
      method: 'POST',
    },
    { handleUnauthorized: false },
  );
}

export async function fetchSessionRequest() {
  if (shouldUseMockAuthService()) {
    try {
      return await mockFetchSession(authTokenGetter?.());
    } catch (error) {
      return handleMockAuthError(error);
    }
  }

  return request<{
    user: SessionUser;
  }>('/auth/session');
}

export async function searchProfilesRequest(params: { query?: string; cursor?: string | null }) {
  if (shouldUseMockAuthService()) {
    try {
      return await mockSearchProfiles({
        query: params.query,
        token: authTokenGetter?.(),
      });
    } catch (error) {
      return handleMockAuthError(error, { auth: true, handleUnauthorized: false });
    }
  }

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
  if (shouldUseMockAuthService()) {
    try {
      return await mockFetchProfile(username, authTokenGetter?.());
    } catch (error) {
      return handleMockAuthError(error, { auth: true, handleUnauthorized: false });
    }
  }

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
  if (shouldUseMockAuthService()) {
    try {
      return await mockUpdateMyProfile(input, authTokenGetter?.());
    } catch (error) {
      return handleMockAuthError(error);
    }
  }

  return request<{
    user: SessionUser;
    profile: ProfileDetail;
  }>('/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function updateMyAvatarRequest(avatarDataUrl: string | null) {
  if (shouldUseMockAuthService()) {
    try {
      return await mockUpdateMyAvatar(avatarDataUrl, authTokenGetter?.());
    } catch (error) {
      return handleMockAuthError(error);
    }
  }

  if (avatarDataUrl === null) {
    return request<{
      user: SessionUser;
      profile: ProfileDetail;
    }>('/me/avatar/complete', {
      method: 'POST',
      body: JSON.stringify({
        clear: true,
      }),
    });
  }

  const uploadIntentResponse = await request<{
    uploadIntent: {
      uploadToken: string;
    };
  }>('/me/avatar/upload-intent', {
    method: 'POST',
    body: JSON.stringify({
      contentType: 'image/jpeg',
    }),
  });

  return request<{
    user: SessionUser;
    profile: ProfileDetail;
  }>('/me/avatar/complete', {
    method: 'POST',
    body: JSON.stringify({
      uploadToken: uploadIntentResponse.uploadIntent.uploadToken,
    }),
  });
}

export async function followProfileRequest(username: string) {
  if (shouldUseMockAuthService()) {
    try {
      return await mockFollowProfile(username, authTokenGetter?.());
    } catch (error) {
      return handleMockAuthError(error);
    }
  }

  return request<{
    profile: ProfileDetail;
  }>(`/profiles/${encodeURIComponent(username)}/follow`, {
    method: 'POST',
  });
}

export async function unfollowProfileRequest(username: string) {
  if (shouldUseMockAuthService()) {
    try {
      return await mockUnfollowProfile(username, authTokenGetter?.());
    } catch (error) {
      return handleMockAuthError(error);
    }
  }

  await request<void>(`/profiles/${encodeURIComponent(username)}/follow`, {
    method: 'DELETE',
  });
}

export async function fetchFollowersRequest(username: string) {
  if (shouldUseMockAuthService()) {
    try {
      return await mockFetchFollowers(username, authTokenGetter?.());
    } catch (error) {
      return handleMockAuthError(error, { auth: true, handleUnauthorized: false });
    }
  }

  return request<{
    profiles: PublicProfile[];
  }>(`/profiles/${encodeURIComponent(username)}/followers`, undefined, {
    auth: true,
    handleUnauthorized: false,
  });
}

export async function fetchFollowingRequest(username: string) {
  if (shouldUseMockAuthService()) {
    try {
      return await mockFetchFollowing(username, authTokenGetter?.());
    } catch (error) {
      return handleMockAuthError(error, { auth: true, handleUnauthorized: false });
    }
  }

  return request<{
    profiles: PublicProfile[];
  }>(`/profiles/${encodeURIComponent(username)}/following`, undefined, {
    auth: true,
    handleUnauthorized: false,
  });
}

export async function fetchActivityRequest() {
  if (shouldUseMockAuthService()) {
    try {
      return await mockFetchActivity(authTokenGetter?.());
    } catch (error) {
      return handleMockAuthError(error);
    }
  }

  return request<{
    activity: ActivityItem[];
  }>('/me/activity');
}
