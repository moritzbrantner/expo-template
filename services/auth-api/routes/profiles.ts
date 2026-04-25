import { requirePermission } from '../authz';
import { getPaginationCursor, json, paginate, parseBody, sendError } from '../http';
import { readSessionToken, resolveSession } from '../session';
import {
  createUploadIntentRecord,
  findUserByUsername,
  isUserAccessible,
  isValidAssetUrl,
  isValidAvatarDataUrl,
  isValidUsername,
  normalizeUsername,
  toProfileDetail,
  toPublicProfile,
  toSessionUser,
  toUploadIntent,
} from '../store';
import type { RouteHandlerContext } from './types';

const PAGE_SIZE = 12;

function sortProfiles<T extends { displayName: string; username: string }>(profiles: T[]): T[] {
  return [...profiles].sort(
    (left, right) =>
      left.displayName.localeCompare(right.displayName) ||
      left.username.localeCompare(right.username),
  );
}

function isSupportedContentType(value: string): boolean {
  return value === 'image/jpeg' || value === 'image/jpg' || value === 'image/png' || value === 'image/webp';
}

export async function handleProfileRoutes(context: RouteHandlerContext): Promise<boolean> {
  const { corsOrigin, request, requestId, requestUrl, response, store } = context;
  const viewer = await resolveSession(store, readSessionToken(request));
  const viewerSession = viewer ? toSessionUser(viewer) : null;

  if (request.method === 'GET' && requestUrl.pathname === '/profiles') {
    const query = String(requestUrl.searchParams.get('query') ?? '').trim().toLowerCase();
    const cursor = getPaginationCursor(requestUrl);
    const document = await store.read();
    const searchableProfiles = sortProfiles(
      document.users
        .filter((user) => user.id !== viewer?.id)
        .filter((user) => isUserAccessible(document, user, viewer?.id ?? null))
        .filter((user) => {
          if (!query) {
            return true;
          }

          const haystack = `${user.displayName} ${user.username} ${user.bio}`.toLowerCase();
          return haystack.includes(query);
        })
        .map((user) => toPublicProfile(user, document, viewerSession)),
    );
    const page = paginate(searchableProfiles, cursor, PAGE_SIZE);

    json(response, 200, { profiles: page.items, nextCursor: page.nextCursor }, corsOrigin);
    return true;
  }

  if (request.method === 'GET' && requestUrl.pathname.startsWith('/usernames/')) {
    const segments = requestUrl.pathname.split('/').filter(Boolean);

    if (segments.length === 3 && segments[2] === 'availability') {
      const username = normalizeUsername(segments[1] ?? '');

      if (!isValidUsername(username)) {
        sendError(response, {
          code: 'INVALID_USERNAME',
          corsOrigin,
          message: 'Username must be 3-24 characters using lowercase letters, numbers, or underscores.',
          requestId,
          statusCode: 400,
        });
        return true;
      }

      const document = await store.read();
      const currentUsername = viewer?.username ?? null;
      const taken = document.users.some(
        (user) => user.username === username && user.username !== currentUsername,
      );

      json(
        response,
        200,
        {
          available: !taken,
          reason: taken ? 'taken' : 'available',
        },
        corsOrigin,
      );
      return true;
    }
  }

  if (request.method === 'GET' && requestUrl.pathname === '/me/profile') {
    if (!requirePermission(response, { corsOrigin, permission: 'profile.read', requestId, user: viewerSession })) {
      return true;
    }

    const document = await store.read();
    const user = document.users.find((entry) => entry.id === viewer!.id);

    if (!user) {
      sendError(response, {
        code: 'PROFILE_NOT_FOUND',
        corsOrigin,
        message: 'Profile not found.',
        requestId,
        statusCode: 404,
      });
      return true;
    }

    json(response, 200, { profile: toProfileDetail(user, document, viewerSession) }, corsOrigin);
    return true;
  }

  if (request.method === 'GET' && requestUrl.pathname.startsWith('/profiles/')) {
    const segments = requestUrl.pathname.split('/').filter(Boolean);

    if (segments.length === 2) {
      const username = normalizeUsername(segments[1] ?? '');
      const document = await store.read();
      const user = findUserByUsername(document, username);

      if (!user || !isUserAccessible(document, user, viewer?.id ?? null, { allowUndiscoverable: true })) {
        sendError(response, {
          code: 'PROFILE_NOT_FOUND',
          corsOrigin,
          message: 'Profile not found.',
          requestId,
          statusCode: 404,
        });
        return true;
      }

      json(response, 200, { profile: toProfileDetail(user, document, viewerSession) }, corsOrigin);
      return true;
    }
  }

  if (request.method === 'PATCH' && requestUrl.pathname === '/me/profile') {
    if (!requirePermission(response, { corsOrigin, permission: 'profile.edit:self', requestId, user: viewerSession })) {
      return true;
    }

    const body = await parseBody(request);
    const displayName = String(body.displayName ?? '').trim();
    const bio = String(body.bio ?? '').trim();
    const requestedUsername = normalizeUsername(String(body.username ?? viewer!.username));
    const discoverable =
      typeof body.discoverable === 'boolean' ? body.discoverable : viewer!.discoverable;

    if (!displayName) {
      sendError(response, {
        code: 'DISPLAY_NAME_REQUIRED',
        corsOrigin,
        message: 'Display name is required.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    if (!isValidUsername(requestedUsername)) {
      sendError(response, {
        code: 'INVALID_USERNAME',
        corsOrigin,
        message: 'Username must be 3-24 characters using lowercase letters, numbers, or underscores.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    if (bio.length > 280) {
      sendError(response, {
        code: 'BIO_TOO_LONG',
        corsOrigin,
        message: 'Bio must be 280 characters or fewer.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const result = await store.mutate((document) => {
      if (
        document.users.some(
          (entry) => entry.id !== viewer!.id && entry.username === requestedUsername,
        )
      ) {
        return { duplicate: true as const };
      }

      const user = document.users.find((entry) => entry.id === viewer!.id);

      if (!user) {
        return { missing: true as const };
      }

      user.displayName = displayName;
      user.username = requestedUsername;
      user.bio = bio;
      user.discoverable = discoverable;
      user.updatedAt = new Date().toISOString();

      return {
        user,
        profile: toProfileDetail(user, document, toSessionUser(user)),
      };
    });

    if ('duplicate' in result) {
      sendError(response, {
        code: 'USERNAME_TAKEN',
        corsOrigin,
        message: 'That username is already taken.',
        requestId,
        statusCode: 409,
      });
      return true;
    }

    if ('missing' in result) {
      sendError(response, {
        code: 'PROFILE_NOT_FOUND',
        corsOrigin,
        message: 'Profile not found.',
        requestId,
        statusCode: 404,
      });
      return true;
    }

    json(
      response,
      200,
      {
        user: toSessionUser(result.user),
        profile: result.profile,
      },
      corsOrigin,
    );
    return true;
  }

  if (
    request.method === 'POST' &&
    (requestUrl.pathname === '/me/avatar/upload-intent' || requestUrl.pathname === '/me/cover/upload-intent')
  ) {
    if (!requirePermission(response, { corsOrigin, permission: 'profile.edit:self', requestId, user: viewerSession })) {
      return true;
    }

    const body = await parseBody(request);
    const contentType = String(body.contentType ?? 'image/jpeg').trim().toLowerCase();

    if (!isSupportedContentType(contentType)) {
      sendError(response, {
        code: 'INVALID_CONTENT_TYPE',
        corsOrigin,
        message: 'A supported image content type is required.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const intent = createUploadIntentRecord(
      viewer!.id,
      requestUrl.pathname.includes('/cover/') ? 'cover' : 'avatar',
      contentType,
    );

    await store.mutate((document) => {
      document.uploadIntents.push(intent);
    });

    json(response, 201, { upload: toUploadIntent(intent) }, corsOrigin);
    return true;
  }

  if (
    request.method === 'POST' &&
    (requestUrl.pathname === '/me/avatar/complete' || requestUrl.pathname === '/me/cover/complete')
  ) {
    if (!requirePermission(response, { corsOrigin, permission: 'profile.edit:self', requestId, user: viewerSession })) {
      return true;
    }

    const body = await parseBody(request);
    const uploadToken = String(body.uploadToken ?? '').trim();
    const assetUrl = String(body.assetUrl ?? '').trim();
    const kind = requestUrl.pathname.includes('/cover/') ? 'cover' : 'avatar';

    if (!uploadToken || !assetUrl || !isValidAssetUrl(assetUrl)) {
      sendError(response, {
        code: 'INVALID_UPLOAD_COMPLETION',
        corsOrigin,
        message: 'A valid upload token and asset URL are required.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const result = await store.mutate((document) => {
      const intent = document.uploadIntents.find(
        (entry) =>
          entry.uploadToken === uploadToken &&
          entry.userId === viewer!.id &&
          entry.kind === kind &&
          !entry.completedAt,
      );

      if (!intent || Date.parse(intent.expiresAt) <= Date.now()) {
        return { invalid: true as const };
      }

      const user = document.users.find((entry) => entry.id === viewer!.id);

      if (!user) {
        return { missing: true as const };
      }

      intent.completedAt = new Date().toISOString();
      if (kind === 'avatar') {
        user.avatarUrl = assetUrl;
      } else {
        user.coverUrl = assetUrl;
      }
      user.updatedAt = new Date().toISOString();

      return {
        user,
        profile: toProfileDetail(user, document, toSessionUser(user)),
      };
    });

    if ('invalid' in result) {
      sendError(response, {
        code: 'INVALID_UPLOAD_TOKEN',
        corsOrigin,
        message: 'The upload token is invalid or expired.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    if ('missing' in result) {
      sendError(response, {
        code: 'PROFILE_NOT_FOUND',
        corsOrigin,
        message: 'Profile not found.',
        requestId,
        statusCode: 404,
      });
      return true;
    }

    json(response, 200, { user: toSessionUser(result.user), profile: result.profile }, corsOrigin);
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/me/avatar') {
    if (!requirePermission(response, { corsOrigin, permission: 'profile.edit:self', requestId, user: viewerSession })) {
      return true;
    }

    const body = await parseBody(request);
    const avatarInput = body.avatarDataUrl;
    const avatarDataUrl =
      avatarInput === null || avatarInput === undefined ? null : String(avatarInput).trim();

    if (avatarDataUrl && (!isValidAvatarDataUrl(avatarDataUrl) || avatarDataUrl.length > 2_000_000)) {
      sendError(response, {
        code: 'INVALID_AVATAR',
        corsOrigin,
        message: 'Avatar image must be a valid base64-encoded image.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const result = await store.mutate((document) => {
      const user = document.users.find((entry) => entry.id === viewer!.id);

      if (!user) {
        return { missing: true as const };
      }

      user.avatarUrl = avatarDataUrl;
      user.updatedAt = new Date().toISOString();

      return {
        user,
        profile: toProfileDetail(user, document, toSessionUser(user)),
      };
    });

    if ('missing' in result) {
      sendError(response, {
        code: 'PROFILE_NOT_FOUND',
        corsOrigin,
        message: 'Profile not found.',
        requestId,
        statusCode: 404,
      });
      return true;
    }

    json(response, 200, { user: toSessionUser(result.user), profile: result.profile }, corsOrigin);
    return true;
  }

  return false;
}
