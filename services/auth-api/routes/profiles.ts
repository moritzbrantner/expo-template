import { randomUUID } from 'node:crypto';

import { requireAuthenticatedUser, resolveViewer } from '../authz';
import { getPaginationCursor, getStringParam, json, parseBody, paginate, sendError } from '../http';
import {
  findUserByUsername,
  isUserVisible,
  normalizeUsername,
  toProfileDetail,
  toSessionUser,
  toUploadIntent,
  type StoredUploadIntent,
} from '../store';
import type { RouteHandlerContext } from './types';

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
const PAGE_SIZE = 20;
const UPLOAD_INTENT_TTL_MS = 1000 * 60 * 15;

export async function handleProfileRoutes(context: RouteHandlerContext): Promise<boolean> {
  const { corsOrigin, request, requestId, requestUrl, response, store } = context;
  const viewer = await resolveViewer(context);

  if (request.method === 'GET' && requestUrl.pathname === '/profiles') {
    const query = getStringParam(requestUrl.searchParams.get('query') ?? undefined)?.toLowerCase() ?? '';
    const cursor = getPaginationCursor(requestUrl);
    const document = await store.read();
    const visibleProfiles = document.users
      .filter((user) => isUserVisible(user))
      .filter((user) => {
        if (!query) {
          return true;
        }

        return (
          user.username.includes(query) ||
          user.displayName.toLowerCase().includes(query) ||
          user.bio.toLowerCase().includes(query)
        );
      })
      .sort((left, right) => left.username.localeCompare(right.username));

    const page = paginate(visibleProfiles, cursor, PAGE_SIZE);
    json(
      response,
      200,
      {
        profiles: page.items.map((user) => toProfileDetail(user, document, viewer)),
        nextCursor: page.nextCursor,
      },
      corsOrigin,
    );
    return true;
  }

  if (
    request.method === 'GET' &&
    requestUrl.pathname.startsWith('/usernames/') &&
    requestUrl.pathname.endsWith('/availability')
  ) {
    const segments = requestUrl.pathname.split('/');
    const username = normalizeUsername(segments[2] ?? '');
    const document = await store.read();
    const user = findUserByUsername(document, username);

    json(
      response,
      200,
      {
        username,
        available: Boolean(username) && !user,
      },
      corsOrigin,
    );
    return true;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/me/profile') {
    const authenticated = await requireAuthenticatedUser(context);

    if (!authenticated) {
      return true;
    }

    const document = await store.read();
    const freshUser = document.users.find((user) => user.id === authenticated.user.id) ?? authenticated.user;
    json(
      response,
      200,
      { profile: toProfileDetail(freshUser, document, authenticated.user) },
      corsOrigin,
    );
    return true;
  }

  if (request.method === 'PATCH' && requestUrl.pathname === '/me/profile') {
    const authenticated = await requireAuthenticatedUser(context);

    if (!authenticated) {
      return true;
    }

    const body = await parseBody(request);
    const displayName = String(body.displayName ?? '').trim();
    const username = normalizeUsername(String(body.username ?? ''));
    const bio = String(body.bio ?? '').trim();
    const fieldErrors: Record<string, string> = {};

    if (!displayName) {
      fieldErrors.displayName = 'Display name is required.';
    }

    if (!USERNAME_PATTERN.test(username)) {
      fieldErrors.username = 'Username must be 3-24 characters using lowercase letters, numbers, or underscores.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      sendError(response, {
        code: 'VALIDATION_ERROR',
        corsOrigin,
        fieldErrors,
        message: 'Profile details are invalid.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const result = await store.mutate((document) => {
      const user = document.users.find((entry) => entry.id === authenticated.user.id);

      if (!user) {
        return { code: 'NOT_FOUND' as const };
      }

      if (document.users.some((entry) => entry.id !== user.id && entry.username === username)) {
        return { code: 'USERNAME_TAKEN' as const };
      }

      user.displayName = displayName;
      user.username = username;
      user.bio = bio;
      user.updatedAt = new Date().toISOString();

      return {
        code: 'UPDATED' as const,
        profile: toProfileDetail(user, document, user),
        user,
      };
    });

    if (result.code === 'NOT_FOUND') {
      sendError(response, {
        code: 'NOT_FOUND',
        corsOrigin,
        message: 'Profile not found.',
        requestId,
        statusCode: 404,
      });
      return true;
    }

    if (result.code === 'USERNAME_TAKEN') {
      sendError(response, {
        code: 'USERNAME_TAKEN',
        corsOrigin,
        fieldErrors: { username: 'That username is already in use.' },
        message: 'That username is already in use.',
        requestId,
        statusCode: 409,
      });
      return true;
    }

    json(
      response,
      200,
      { user: toSessionUser(result.user), profile: result.profile },
      corsOrigin,
    );
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/me/avatar/upload-intent') {
    const authenticated = await requireAuthenticatedUser(context);

    if (!authenticated) {
      return true;
    }

    const body = await parseBody(request);
    const contentType = String(body.contentType ?? 'image/jpeg').trim() || 'image/jpeg';
    const now = new Date();
    const uploadToken = randomUUID();
    const assetUrl = `https://assets.example.test/avatar/${authenticated.user.id}/${uploadToken}`;
    const intent: StoredUploadIntent = {
      uploadToken,
      userId: authenticated.user.id,
      kind: 'avatar',
      contentType,
      uploadUrl: `https://uploads.example.test/mock/${uploadToken}`,
      assetUrl,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + UPLOAD_INTENT_TTL_MS).toISOString(),
      completedAt: null,
    };

    await store.mutate((document) => {
      document.uploadIntents = document.uploadIntents.filter(
        (entry) => !(entry.userId === authenticated.user.id && entry.kind === 'avatar'),
      );
      document.uploadIntents.push(intent);
    });

    json(response, 200, { uploadIntent: toUploadIntent(intent) }, corsOrigin);
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/me/avatar/complete') {
    const authenticated = await requireAuthenticatedUser(context);

    if (!authenticated) {
      return true;
    }

    const body = await parseBody(request);
    const clear = body.clear === true;
    const uploadToken = String(body.uploadToken ?? '').trim();

    if (!clear && !uploadToken) {
      sendError(response, {
        code: 'VALIDATION_ERROR',
        corsOrigin,
        fieldErrors: { uploadToken: 'An upload token is required.' },
        message: 'An upload token is required.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const result = await store.mutate((document) => {
      const user = document.users.find((entry) => entry.id === authenticated.user.id) ?? null;

      if (!user) {
        return { code: 'INVALID_INTENT' as const };
      }

      if (clear) {
        user.avatarUrl = null;
        user.updatedAt = new Date().toISOString();
        return {
          code: 'UPDATED' as const,
          profile: toProfileDetail(user, document, user),
          user,
        };
      }

      const intent = document.uploadIntents.find((entry) => entry.uploadToken === uploadToken) ?? null;

      if (!intent || intent.userId !== authenticated.user.id || intent.kind !== 'avatar') {
        return { code: 'INVALID_INTENT' as const };
      }

      if (intent.completedAt !== null || new Date(intent.expiresAt).getTime() <= Date.now()) {
        return { code: 'INVALID_INTENT' as const };
      }

      intent.completedAt = new Date().toISOString();
      user.avatarUrl = intent.assetUrl;
      user.updatedAt = new Date().toISOString();

      return {
        code: 'UPDATED' as const,
        profile: toProfileDetail(user, document, user),
        user,
      };
    });

    if (result.code === 'INVALID_INTENT') {
      sendError(response, {
        code: 'INVALID_UPLOAD_INTENT',
        corsOrigin,
        message: 'That upload intent is invalid or expired.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    json(
      response,
      200,
      { user: toSessionUser(result.user), profile: result.profile },
      corsOrigin,
    );
    return true;
  }

  if (
    request.method === 'GET' &&
    requestUrl.pathname.startsWith('/profiles/') &&
    requestUrl.pathname.split('/').length === 3
  ) {
    const username = requestUrl.pathname.split('/')[2] ?? '';
    const document = await store.read();
    const user = findUserByUsername(document, username);

    if (!user || !isUserVisible(user)) {
      sendError(response, {
        code: 'NOT_FOUND',
        corsOrigin,
        message: 'Profile not found.',
        requestId,
        statusCode: 404,
      });
      return true;
    }

    json(response, 200, { profile: toProfileDetail(user, document, viewer) }, corsOrigin);
    return true;
  }

  return false;
}
