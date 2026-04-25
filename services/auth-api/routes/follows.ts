import { requirePermission } from '../authz';
import { getPaginationCursor, json, noContent, paginate, sendError } from '../http';
import { readSessionToken, resolveSession } from '../session';
import {
  appendNotification,
  buildActivityFeed,
  findUserByUsername,
  isUserAccessible,
  normalizeUsername,
  toPublicProfile,
  toSessionUser,
} from '../store';
import type { RouteHandlerContext } from './types';

function sortProfiles<T extends { displayName: string; username: string }>(profiles: T[]): T[] {
  return [...profiles].sort(
    (left, right) =>
      left.displayName.localeCompare(right.displayName) ||
      left.username.localeCompare(right.username),
  );
}

export async function handleFollowRoutes(context: RouteHandlerContext): Promise<boolean> {
  const { corsOrigin, request, requestId, requestUrl, response, store } = context;
  const viewer = await resolveSession(store, readSessionToken(request));
  const viewerSession = viewer ? toSessionUser(viewer) : null;

  if (request.method === 'GET' && requestUrl.pathname === '/me/activity') {
    if (!requirePermission(response, { corsOrigin, permission: 'activity.read:self', requestId, user: viewerSession })) {
      return true;
    }

    const document = await store.read();
    json(
      response,
      200,
      {
        activity: buildActivityFeed(document, viewer!.id),
      },
      corsOrigin,
    );
    return true;
  }

  if (!requestUrl.pathname.startsWith('/profiles/')) {
    return false;
  }

  const segments = requestUrl.pathname.split('/').filter(Boolean);
  const username = normalizeUsername(segments[1] ?? '');

  if (segments.length === 3 && segments[2] === 'follow' && request.method === 'POST') {
    if (!requirePermission(response, { corsOrigin, permission: 'follow.create:self', requestId, user: viewerSession })) {
      return true;
    }

    const result = await store.mutate((document) => {
      const targetUser = findUserByUsername(document, username);

      if (!targetUser || !isUserAccessible(document, targetUser, viewer!.id, { allowUndiscoverable: true })) {
        return { missing: true as const };
      }

      if (targetUser.id === viewer!.id) {
        return { self: true as const };
      }

      if (
        document.blocks.some(
          (block) =>
            (block.blockerId === viewer!.id && block.blockedId === targetUser.id) ||
            (block.blockerId === targetUser.id && block.blockedId === viewer!.id),
        )
      ) {
        return { blocked: true as const };
      }

      if (
        document.follows.some(
          (follow) => follow.followerId === viewer!.id && follow.followeeId === targetUser.id,
        )
      ) {
        return { duplicate: true as const };
      }

      document.follows.push({
        followerId: viewer!.id,
        followeeId: targetUser.id,
        createdAt: new Date().toISOString(),
      });
      appendNotification(document, {
        actorUserId: viewer!.id,
        type: 'follow',
        userId: targetUser.id,
      });

      return {
        profile: toPublicProfile(targetUser, document, viewerSession),
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

    if ('self' in result) {
      sendError(response, {
        code: 'CANNOT_FOLLOW_SELF',
        corsOrigin,
        message: 'You cannot follow yourself.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    if ('blocked' in result) {
      sendError(response, {
        code: 'RELATIONSHIP_BLOCKED',
        corsOrigin,
        message: 'You cannot follow this profile because one of you has blocked the other.',
        requestId,
        statusCode: 403,
      });
      return true;
    }

    if ('duplicate' in result) {
      sendError(response, {
        code: 'ALREADY_FOLLOWING',
        corsOrigin,
        message: 'You already follow this profile.',
        requestId,
        statusCode: 409,
      });
      return true;
    }

    json(response, 201, result, corsOrigin);
    return true;
  }

  if (segments.length === 3 && segments[2] === 'follow' && request.method === 'DELETE') {
    if (!requirePermission(response, { corsOrigin, permission: 'follow.delete:self', requestId, user: viewerSession })) {
      return true;
    }

    await store.mutate((document) => {
      const targetUser = findUserByUsername(document, username);

      if (!targetUser) {
        return;
      }

      document.follows = document.follows.filter(
        (follow) => !(follow.followerId === viewer!.id && follow.followeeId === targetUser.id),
      );
    });

    noContent(response, corsOrigin);
    return true;
  }

  if (segments.length === 3 && segments[2] === 'block' && request.method === 'POST') {
    if (!requirePermission(response, { corsOrigin, permission: 'block.create:self', requestId, user: viewerSession })) {
      return true;
    }

    const result = await store.mutate((document) => {
      const targetUser = findUserByUsername(document, username);

      if (!targetUser || targetUser.status !== 'active') {
        return { missing: true as const };
      }

      if (targetUser.id === viewer!.id) {
        return { self: true as const };
      }

      if (
        document.blocks.some((block) => block.blockerId === viewer!.id && block.blockedId === targetUser.id)
      ) {
        return { duplicate: true as const };
      }

      document.blocks.push({
        blockerId: viewer!.id,
        blockedId: targetUser.id,
        createdAt: new Date().toISOString(),
      });
      document.follows = document.follows.filter(
        (follow) =>
          !(
            (follow.followerId === viewer!.id && follow.followeeId === targetUser.id) ||
            (follow.followerId === targetUser.id && follow.followeeId === viewer!.id)
          ),
      );

      return { ok: true as const };
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

    if ('self' in result) {
      sendError(response, {
        code: 'CANNOT_BLOCK_SELF',
        corsOrigin,
        message: 'You cannot block yourself.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    json(response, 201, { blocked: true }, corsOrigin);
    return true;
  }

  if (segments.length === 3 && segments[2] === 'block' && request.method === 'DELETE') {
    if (!requirePermission(response, { corsOrigin, permission: 'block.delete:self', requestId, user: viewerSession })) {
      return true;
    }

    await store.mutate((document) => {
      const targetUser = findUserByUsername(document, username);

      if (!targetUser) {
        return;
      }

      document.blocks = document.blocks.filter(
        (block) => !(block.blockerId === viewer!.id && block.blockedId === targetUser.id),
      );
    });

    noContent(response, corsOrigin);
    return true;
  }

  if (segments.length === 3 && segments[2] === 'mute' && request.method === 'POST') {
    if (!requirePermission(response, { corsOrigin, permission: 'mute.create:self', requestId, user: viewerSession })) {
      return true;
    }

    const result = await store.mutate((document) => {
      const targetUser = findUserByUsername(document, username);

      if (!targetUser || targetUser.status !== 'active') {
        return { missing: true as const };
      }

      if (targetUser.id === viewer!.id) {
        return { self: true as const };
      }

      if (
        document.mutes.some((mute) => mute.muterId === viewer!.id && mute.mutedId === targetUser.id)
      ) {
        return { duplicate: true as const };
      }

      document.mutes.push({
        muterId: viewer!.id,
        mutedId: targetUser.id,
        createdAt: new Date().toISOString(),
      });
      return { ok: true as const };
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

    if ('self' in result) {
      sendError(response, {
        code: 'CANNOT_MUTE_SELF',
        corsOrigin,
        message: 'You cannot mute yourself.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    json(response, 201, { muted: true }, corsOrigin);
    return true;
  }

  if (segments.length === 3 && segments[2] === 'mute' && request.method === 'DELETE') {
    if (!requirePermission(response, { corsOrigin, permission: 'mute.delete:self', requestId, user: viewerSession })) {
      return true;
    }

    await store.mutate((document) => {
      const targetUser = findUserByUsername(document, username);

      if (!targetUser) {
        return;
      }

      document.mutes = document.mutes.filter(
        (mute) => !(mute.muterId === viewer!.id && mute.mutedId === targetUser.id),
      );
    });

    noContent(response, corsOrigin);
    return true;
  }

  if (segments.length === 3 && segments[2] === 'followers' && request.method === 'GET') {
    const cursor = getPaginationCursor(requestUrl);
    const document = await store.read();
    const targetUser = findUserByUsername(document, username);

    if (!targetUser || !isUserAccessible(document, targetUser, viewer?.id ?? null, { allowUndiscoverable: true })) {
      sendError(response, {
        code: 'PROFILE_NOT_FOUND',
        corsOrigin,
        message: 'Profile not found.',
        requestId,
        statusCode: 404,
      });
      return true;
    }

    const page = paginate(
      sortProfiles(
        document.follows
          .filter((follow) => follow.followeeId === targetUser.id)
          .map((follow) => document.users.find((user) => user.id === follow.followerId) ?? null)
          .filter((user): user is NonNullable<typeof user> =>
            Boolean(user && isUserAccessible(document, user, viewer?.id ?? null, { allowUndiscoverable: true })),
          )
          .map((user) => toPublicProfile(user, document, viewerSession)),
      ),
      cursor,
      12,
    );

    json(response, 200, { profiles: page.items, nextCursor: page.nextCursor }, corsOrigin);
    return true;
  }

  if (segments.length === 3 && segments[2] === 'following' && request.method === 'GET') {
    const cursor = getPaginationCursor(requestUrl);
    const document = await store.read();
    const targetUser = findUserByUsername(document, username);

    if (!targetUser || !isUserAccessible(document, targetUser, viewer?.id ?? null, { allowUndiscoverable: true })) {
      sendError(response, {
        code: 'PROFILE_NOT_FOUND',
        corsOrigin,
        message: 'Profile not found.',
        requestId,
        statusCode: 404,
      });
      return true;
    }

    const page = paginate(
      sortProfiles(
        document.follows
          .filter((follow) => follow.followerId === targetUser.id)
          .map((follow) => document.users.find((user) => user.id === follow.followeeId) ?? null)
          .filter((user): user is NonNullable<typeof user> =>
            Boolean(user && isUserAccessible(document, user, viewer?.id ?? null, { allowUndiscoverable: true })),
          )
          .map((user) => toPublicProfile(user, document, viewerSession)),
      ),
      cursor,
      12,
    );

    json(response, 200, { profiles: page.items, nextCursor: page.nextCursor }, corsOrigin);
    return true;
  }

  return false;
}
