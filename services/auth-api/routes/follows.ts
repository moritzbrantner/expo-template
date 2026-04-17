import { requirePermission } from '../authz';
import { json, noContent } from '../http';
import { readSessionToken, resolveSession } from '../session';
import { buildActivityFeed, toProfileDetail, toPublicProfile, toSessionUser } from '../store';
import type { RouteHandlerContext } from './types';

function sortProfiles<T extends { displayName: string; username: string }>(profiles: T[]): T[] {
  return [...profiles].sort(
    (left, right) =>
      left.displayName.localeCompare(right.displayName) ||
      left.username.localeCompare(right.username),
  );
}

export async function handleFollowRoutes(context: RouteHandlerContext): Promise<boolean> {
  const { corsOrigin, request, requestUrl, response, store } = context;
  const viewer = await resolveSession(store, readSessionToken(request));
  const viewerSession = viewer ? toSessionUser(viewer) : null;

  if (request.method === 'GET' && requestUrl.pathname === '/me/activity') {
    if (!requirePermission(response, corsOrigin, viewerSession, 'activity.read:self') || !viewer) {
      return true;
    }

    const document = await store.read();
    json(
      response,
      200,
      {
        activity: buildActivityFeed(document, viewer.id),
      },
      corsOrigin,
    );
    return true;
  }

  if (requestUrl.pathname.startsWith('/profiles/')) {
    const segments = requestUrl.pathname.split('/').filter(Boolean);

    if (segments.length === 3 && segments[2] === 'follow' && request.method === 'POST') {
      if (!requirePermission(response, corsOrigin, viewerSession, 'follow.create:self') || !viewer) {
        return true;
      }

      const username = (segments[1] ?? '').trim().toLowerCase();
      const result = await store.mutate((document) => {
        const targetUser = document.users.find((entry) => entry.username === username);

        if (!targetUser) {
          return { missing: true };
        }

        if (targetUser.id === viewer.id) {
          return { self: true };
        }

        if (
          document.follows.some(
            (follow) => follow.followerId === viewer.id && follow.followeeId === targetUser.id,
          )
        ) {
          return { duplicate: true };
        }

        document.follows.push({
          followerId: viewer.id,
          followeeId: targetUser.id,
          createdAt: new Date().toISOString(),
        });

        return {
          profile: toProfileDetail(targetUser, document, viewerSession),
        };
      });

      if ('missing' in result) {
        json(response, 404, { error: 'Profile not found.' }, corsOrigin);
        return true;
      }

      if ('self' in result) {
        json(response, 400, { error: 'You cannot follow yourself.' }, corsOrigin);
        return true;
      }

      if ('duplicate' in result) {
        json(response, 409, { error: 'You already follow this profile.' }, corsOrigin);
        return true;
      }

      json(response, 201, result, corsOrigin);
      return true;
    }

    if (segments.length === 3 && segments[2] === 'follow' && request.method === 'DELETE') {
      if (!requirePermission(response, corsOrigin, viewerSession, 'follow.delete:self') || !viewer) {
        return true;
      }

      const username = (segments[1] ?? '').trim().toLowerCase();
      await store.mutate((document) => {
        const targetUser = document.users.find((entry) => entry.username === username);

        if (!targetUser) {
          return;
        }

        document.follows = document.follows.filter(
          (follow) => !(follow.followerId === viewer.id && follow.followeeId === targetUser.id),
        );
      });

      noContent(response, corsOrigin);
      return true;
    }

    if (segments.length === 3 && segments[2] === 'followers' && request.method === 'GET') {
      const username = (segments[1] ?? '').trim().toLowerCase();
      const document = await store.read();
      const targetUser = document.users.find((entry) => entry.username === username);

      if (!targetUser) {
        json(response, 404, { error: 'Profile not found.' }, corsOrigin);
        return true;
      }

      const followerIds = new Set(
        document.follows
          .filter((follow) => follow.followeeId === targetUser.id)
          .map((follow) => follow.followerId),
      );
      const profiles = sortProfiles(
        document.users
          .filter((user) => followerIds.has(user.id))
          .map((user) => toPublicProfile(user, document, viewerSession)),
      );

      json(response, 200, { profiles }, corsOrigin);
      return true;
    }

    if (segments.length === 3 && segments[2] === 'following' && request.method === 'GET') {
      const username = (segments[1] ?? '').trim().toLowerCase();
      const document = await store.read();
      const targetUser = document.users.find((entry) => entry.username === username);

      if (!targetUser) {
        json(response, 404, { error: 'Profile not found.' }, corsOrigin);
        return true;
      }

      const followingIds = new Set(
        document.follows
          .filter((follow) => follow.followerId === targetUser.id)
          .map((follow) => follow.followeeId),
      );
      const profiles = sortProfiles(
        document.users
          .filter((user) => followingIds.has(user.id))
          .map((user) => toPublicProfile(user, document, viewerSession)),
      );

      json(response, 200, { profiles }, corsOrigin);
      return true;
    }
  }

  return false;
}
