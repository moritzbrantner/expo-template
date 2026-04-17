import { requirePermission } from '../authz';
import { json, parseBody } from '../http';
import { readSessionToken, resolveSession } from '../session';
import {
  isValidAvatarDataUrl,
  isValidUsername,
  normalizeUsername,
  toProfileDetail,
  toPublicProfile,
  toSessionUser,
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

export async function handleProfileRoutes(context: RouteHandlerContext): Promise<boolean> {
  const { corsOrigin, request, requestUrl, response, store } = context;
  const viewer = await resolveSession(store, readSessionToken(request));
  const viewerSession = viewer ? toSessionUser(viewer) : null;

  if (request.method === 'GET' && requestUrl.pathname === '/profiles') {
    const query = String(requestUrl.searchParams.get('query') ?? '').trim().toLowerCase();
    const cursor = Number(requestUrl.searchParams.get('cursor') ?? '0');
    const document = await store.read();
    const searchableProfiles = document.users.filter((user) => {
      if (viewer && user.id === viewer.id) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = `${user.displayName} ${user.username} ${user.bio}`.toLowerCase();
      return haystack.includes(query);
    });
    const sortedProfiles = sortProfiles(searchableProfiles).map((user) =>
      toPublicProfile(user, document, viewerSession),
    );
    const start = Number.isFinite(cursor) && cursor >= 0 ? cursor : 0;
    const profiles = sortedProfiles.slice(start, start + PAGE_SIZE);
    const nextCursor = start + PAGE_SIZE < sortedProfiles.length ? String(start + PAGE_SIZE) : null;

    json(response, 200, { profiles, nextCursor }, corsOrigin);
    return true;
  }

  if (request.method === 'GET' && requestUrl.pathname.startsWith('/profiles/')) {
    const segments = requestUrl.pathname.split('/').filter(Boolean);

    if (segments.length === 2) {
      const username = normalizeUsername(segments[1] ?? '');
      const document = await store.read();
      const user = document.users.find((entry) => entry.username === username);

      if (!user) {
        json(response, 404, { error: 'Profile not found.' }, corsOrigin);
        return true;
      }

      json(
        response,
        200,
        {
          profile: toProfileDetail(user, document, viewerSession),
        },
        corsOrigin,
      );
      return true;
    }
  }

  if (request.method === 'PATCH' && requestUrl.pathname === '/me/profile') {
    if (!requirePermission(response, corsOrigin, viewerSession, 'profile.edit:self') || !viewer) {
      return true;
    }

    const body = await parseBody(request);
    const displayName = String(body.displayName ?? '').trim();
    const bio = String(body.bio ?? '').trim();
    const requestedUsername = normalizeUsername(String(body.username ?? viewer.username));

    if (!displayName) {
      json(response, 400, { error: 'Display name is required.' }, corsOrigin);
      return true;
    }

    if (!isValidUsername(requestedUsername)) {
      json(
        response,
        400,
        { error: 'Username must be 3-24 characters using lowercase letters, numbers, or underscores.' },
        corsOrigin,
      );
      return true;
    }

    if (bio.length > 280) {
      json(response, 400, { error: 'Bio must be 280 characters or fewer.' }, corsOrigin);
      return true;
    }

    const result = await store.mutate((document) => {
      if (
        document.users.some(
          (entry) => entry.id !== viewer.id && entry.username === requestedUsername,
        )
      ) {
        return { duplicate: true };
      }

      const user = document.users.find((entry) => entry.id === viewer.id);

      if (!user) {
        return { missing: true };
      }

      user.displayName = displayName;
      user.username = requestedUsername;
      user.bio = bio;
      user.updatedAt = new Date().toISOString();

      return {
        user,
        profile: toProfileDetail(user, document, toSessionUser(user)),
      };
    });

    if ('duplicate' in result) {
      json(response, 409, { error: 'That username is already taken.' }, corsOrigin);
      return true;
    }

    if ('missing' in result) {
      json(response, 404, { error: 'Profile not found.' }, corsOrigin);
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

  if (request.method === 'POST' && requestUrl.pathname === '/me/avatar') {
    if (!requirePermission(response, corsOrigin, viewerSession, 'profile.edit:self') || !viewer) {
      return true;
    }

    const body = await parseBody(request);
    const avatarInput = body.avatarDataUrl;
    const avatarDataUrl =
      avatarInput === null || avatarInput === undefined ? null : String(avatarInput).trim();

    if (
      avatarDataUrl &&
      (!isValidAvatarDataUrl(avatarDataUrl) || avatarDataUrl.length > 2_000_000)
    ) {
      json(response, 400, { error: 'Avatar image must be a valid base64-encoded image.' }, corsOrigin);
      return true;
    }

    const result = await store.mutate((document) => {
      const user = document.users.find((entry) => entry.id === viewer.id);

      if (!user) {
        return { missing: true };
      }

      user.avatarUrl = avatarDataUrl;
      user.updatedAt = new Date().toISOString();

      return {
        user,
        profile: toProfileDetail(user, document, toSessionUser(user)),
      };
    });

    if ('missing' in result) {
      json(response, 404, { error: 'Profile not found.' }, corsOrigin);
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

  return false;
}
