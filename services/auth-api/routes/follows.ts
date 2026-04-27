import { requireAuthenticatedUser, resolveViewer } from '../authz';
import { getPaginationCursor, json, noContent, paginate, sendError } from '../http';
import {
  findUserByUsername,
  isUserVisible,
  toProfileDetail,
  type StoredFollow,
} from '../store';
import type { ActivityItem, PublicProfile } from '../../../shared/social';
import type { RouteHandlerContext } from './types';

const PAGE_SIZE = 20;

function buildVisibleProfiles(
  userIds: string[],
  context: {
    document: Awaited<ReturnType<RouteHandlerContext['store']['read']>>;
    viewer: Awaited<ReturnType<typeof resolveViewer>>;
  },
): PublicProfile[] {
  return userIds
    .map((userId) => context.document.users.find((user) => user.id === userId) ?? null)
    .filter((user): user is NonNullable<typeof user> => Boolean(user && isUserVisible(user)))
    .map((user) => toProfileDetail(user, context.document, context.viewer));
}

export async function handleFollowRoutes(context: RouteHandlerContext): Promise<boolean> {
  const { corsOrigin, request, requestId, requestUrl, response, store } = context;

  if (request.method === 'GET' && requestUrl.pathname === '/me/activity') {
    const authenticated = await requireAuthenticatedUser(context);

    if (!authenticated) {
      return true;
    }

    const document = await store.read();
    const activity: ActivityItem[] = [];

    for (const follow of document.follows) {
      if (follow.followeeId === authenticated.user.id) {
        const actor = document.users.find((user) => user.id === follow.followerId) ?? null;

        if (actor && isUserVisible(actor)) {
          activity.push({
            type: 'followed_you',
            createdAt: follow.createdAt,
            profile: toProfileDetail(actor, document, authenticated.user),
          });
        }
      }

      if (follow.followerId === authenticated.user.id) {
        const subject = document.users.find((user) => user.id === follow.followeeId) ?? null;

        if (subject && isUserVisible(subject)) {
          activity.push({
            type: 'you_followed',
            createdAt: follow.createdAt,
            profile: toProfileDetail(subject, document, authenticated.user),
          });
        }
      }
    }

    activity.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    json(response, 200, { activity }, corsOrigin);
    return true;
  }

  if (
    request.method === 'POST' &&
    requestUrl.pathname.startsWith('/profiles/') &&
    requestUrl.pathname.endsWith('/follow')
  ) {
    const authenticated = await requireAuthenticatedUser(context);

    if (!authenticated) {
      return true;
    }

    const username = requestUrl.pathname.split('/')[2] ?? '';

    const result = await store.mutate((document) => {
      const targetUser = findUserByUsername(document, username);

      if (!targetUser || !isUserVisible(targetUser)) {
        return { code: 'NOT_FOUND' as const };
      }

      if (targetUser.id === authenticated.user.id) {
        return { code: 'SELF' as const };
      }

      const existingFollow = document.follows.find(
        (follow) =>
          follow.followerId === authenticated.user.id && follow.followeeId === targetUser.id,
      );

      if (!existingFollow) {
        const follow: StoredFollow = {
          followerId: authenticated.user.id,
          followeeId: targetUser.id,
          createdAt: new Date().toISOString(),
        };
        document.follows.push(follow);
      }

      return {
        code: 'FOLLOWED' as const,
        profile: toProfileDetail(targetUser, document, authenticated.user),
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

    if (result.code === 'SELF') {
      sendError(response, {
        code: 'INVALID_FOLLOW',
        corsOrigin,
        message: 'You cannot follow yourself.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    json(response, 201, { profile: result.profile }, corsOrigin);
    return true;
  }

  if (
    request.method === 'DELETE' &&
    requestUrl.pathname.startsWith('/profiles/') &&
    requestUrl.pathname.endsWith('/follow')
  ) {
    const authenticated = await requireAuthenticatedUser(context);

    if (!authenticated) {
      return true;
    }

    const username = requestUrl.pathname.split('/')[2] ?? '';

    await store.mutate((document) => {
      const targetUser = findUserByUsername(document, username);

      if (!targetUser) {
        return;
      }

      document.follows = document.follows.filter(
        (follow) =>
          !(
            follow.followerId === authenticated.user.id &&
            follow.followeeId === targetUser.id
          ),
      );
    });

    noContent(response, corsOrigin);
    return true;
  }

  if (
    request.method === 'GET' &&
    requestUrl.pathname.startsWith('/profiles/') &&
    (requestUrl.pathname.endsWith('/followers') || requestUrl.pathname.endsWith('/following'))
  ) {
    const viewer = await resolveViewer(context);
    const username = requestUrl.pathname.split('/')[2] ?? '';
    const cursor = getPaginationCursor(requestUrl);
    const document = await store.read();
    const targetUser = findUserByUsername(document, username);

    if (!targetUser || !isUserVisible(targetUser)) {
      sendError(response, {
        code: 'NOT_FOUND',
        corsOrigin,
        message: 'Profile not found.',
        requestId,
        statusCode: 404,
      });
      return true;
    }

    const isFollowersPath = requestUrl.pathname.endsWith('/followers');
    const userIds = document.follows
      .filter((follow) =>
        isFollowersPath ? follow.followeeId === targetUser.id : follow.followerId === targetUser.id,
      )
      .map((follow) => (isFollowersPath ? follow.followerId : follow.followeeId));
    const profiles = buildVisibleProfiles(userIds, { document, viewer });
    const page = paginate(profiles, cursor, PAGE_SIZE);

    json(
      response,
      200,
      {
        profiles: page.items,
        nextCursor: page.nextCursor,
      },
      corsOrigin,
    );
    return true;
  }

  return false;
}
