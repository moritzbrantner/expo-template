import { requirePermission } from '../authz';
import { json, parseBody } from '../http';
import { readSessionToken, resolveSession } from '../session';
import { toSessionUser } from '../store';
import type { RouteHandlerContext } from './types';

function toAdminUser(
  user: ReturnType<typeof toSessionUser> & { createdAt: string; updatedAt: string },
  followerCount: number,
  followingCount: number,
) {
  return {
    ...user,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    followerCount,
    followingCount,
  };
}

export async function handleAdminRoutes(context: RouteHandlerContext): Promise<boolean> {
  const { corsOrigin, request, requestUrl, response, store } = context;
  const viewer = await resolveSession(store, readSessionToken(request));
  const viewerSession = viewer ? toSessionUser(viewer) : null;

  if (request.method === 'GET' && requestUrl.pathname === '/admin/users') {
    if (!requirePermission(response, corsOrigin, viewerSession, 'role.manage:any')) {
      return true;
    }

    const document = await store.read();
    const users = document.users
      .map((user) =>
        toAdminUser(
          {
            ...toSessionUser(user),
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          document.follows.filter((follow) => follow.followeeId === user.id).length,
          document.follows.filter((follow) => follow.followerId === user.id).length,
        ),
      )
      .sort((left, right) => left.email.localeCompare(right.email));

    json(response, 200, { users }, corsOrigin);
    return true;
  }

  if (request.method === 'PATCH' && requestUrl.pathname.startsWith('/admin/users/')) {
    if (!requirePermission(response, corsOrigin, viewerSession, 'role.manage:any')) {
      return true;
    }

    const segments = requestUrl.pathname.split('/').filter(Boolean);

    if (segments.length !== 4 || segments[3] !== 'role') {
      return false;
    }

    const body = await parseBody(request);
    const role = String(body.role ?? '');

    if (role !== 'member' && role !== 'moderator' && role !== 'admin') {
      json(response, 400, { error: 'A valid role is required.' }, corsOrigin);
      return true;
    }

    const result = await store.mutate((document) => {
      const user = document.users.find((entry) => entry.id === segments[2]);

      if (!user) {
        return { missing: true };
      }

      user.role = role;
      user.updatedAt = new Date().toISOString();

      return {
        user: {
          ...toSessionUser(user),
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          followerCount: document.follows.filter((follow) => follow.followeeId === user.id).length,
          followingCount: document.follows.filter((follow) => follow.followerId === user.id).length,
        },
      };
    });

    if ('missing' in result) {
      json(response, 404, { error: 'User not found.' }, corsOrigin);
      return true;
    }

    json(response, 200, result, corsOrigin);
    return true;
  }

  return false;
}
