import { requirePermission } from '../authz';
import { json, parseBody, sendError } from '../http';
import { readSessionToken, resolveSession } from '../session';
import { appendAuditEvent, toSessionUser } from '../store';
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

function isValidStatus(value: string) {
  return value === 'active' || value === 'suspended' || value === 'deactivated';
}

function isValidPostStatus(value: string) {
  return value === 'active' || value === 'hidden' || value === 'removed';
}

export async function handleAdminRoutes(context: RouteHandlerContext): Promise<boolean> {
  const { corsOrigin, request, requestId, requestUrl, response, store } = context;
  const viewer = await resolveSession(store, readSessionToken(request));
  const viewerSession = viewer ? toSessionUser(viewer) : null;

  if (request.method === 'GET' && requestUrl.pathname === '/admin/users') {
    if (!requirePermission(response, { corsOrigin, permission: 'role.manage:any', requestId, user: viewerSession })) {
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

  if (request.method === 'GET' && requestUrl.pathname === '/admin/audit-log') {
    if (!requirePermission(response, { corsOrigin, permission: 'audit.read:any', requestId, user: viewerSession })) {
      return true;
    }

    const document = await store.read();
    const events = [...document.auditEvents].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    json(response, 200, { events }, corsOrigin);
    return true;
  }

  if (request.method === 'PATCH' && requestUrl.pathname.startsWith('/admin/users/')) {
    const segments = requestUrl.pathname.split('/').filter(Boolean);

    if (segments.length !== 4) {
      return false;
    }

    if (segments[3] === 'role') {
      if (!requirePermission(response, { corsOrigin, permission: 'role.manage:any', requestId, user: viewerSession })) {
        return true;
      }

      const body = await parseBody(request);
      const role = String(body.role ?? '');

      if (role !== 'member' && role !== 'moderator' && role !== 'admin') {
        sendError(response, {
          code: 'INVALID_ROLE',
          corsOrigin,
          message: 'A valid role is required.',
          requestId,
          statusCode: 400,
        });
        return true;
      }

      const result = await store.mutate((document) => {
        const user = document.users.find((entry) => entry.id === segments[2]);

        if (!user) {
          return { missing: true as const };
        }

        user.role = role;
        user.updatedAt = new Date().toISOString();
        appendAuditEvent(document, {
          action: 'role.updated',
          actorUserId: viewer!.id,
          metadata: { role },
          targetId: user.id,
          targetType: 'user',
        });

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
        sendError(response, {
          code: 'USER_NOT_FOUND',
          corsOrigin,
          message: 'User not found.',
          requestId,
          statusCode: 404,
        });
        return true;
      }

      json(response, 200, result, corsOrigin);
      return true;
    }

    if (segments[3] === 'status') {
      if (!requirePermission(response, { corsOrigin, permission: 'user.status.manage:any', requestId, user: viewerSession })) {
        return true;
      }

      const body = await parseBody(request);
      const status = String(body.status ?? '');

      if (!isValidStatus(status)) {
        sendError(response, {
          code: 'INVALID_STATUS',
          corsOrigin,
          message: 'A valid user status is required.',
          requestId,
          statusCode: 400,
        });
        return true;
      }

      const result = await store.mutate((document) => {
        const user = document.users.find((entry) => entry.id === segments[2]);

        if (!user) {
          return { missing: true as const };
        }

        const now = new Date().toISOString();
        user.status = status;
        user.updatedAt = now;
        user.suspendedAt = status === 'suspended' ? now : null;
        user.deactivatedAt = status === 'deactivated' ? now : user.deactivatedAt;
        if (status !== 'active') {
          document.sessions = document.sessions.filter((session) => session.userId !== user.id);
          user.discoverable = false;
        }

        appendAuditEvent(document, {
          action: 'user.status.updated',
          actorUserId: viewer!.id,
          metadata: { status },
          targetId: user.id,
          targetType: 'user',
        });

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
        sendError(response, {
          code: 'USER_NOT_FOUND',
          corsOrigin,
          message: 'User not found.',
          requestId,
          statusCode: 404,
        });
        return true;
      }

      json(response, 200, result, corsOrigin);
      return true;
    }
  }

  if (request.method === 'PATCH' && requestUrl.pathname.startsWith('/admin/posts/')) {
    const segments = requestUrl.pathname.split('/').filter(Boolean);

    if (segments.length === 4 && segments[3] === 'status') {
      if (!requirePermission(response, { corsOrigin, permission: 'content.moderate:any', requestId, user: viewerSession })) {
        return true;
      }

      const body = await parseBody(request);
      const status = String(body.status ?? '');

      if (!isValidPostStatus(status)) {
        sendError(response, {
          code: 'INVALID_POST_STATUS',
          corsOrigin,
          message: 'A valid post status is required.',
          requestId,
          statusCode: 400,
        });
        return true;
      }

      const result = await store.mutate((document) => {
        const post = document.posts.find((entry) => entry.id === segments[2]);

        if (!post) {
          return { missing: true as const };
        }

        post.status = status;
        post.updatedAt = new Date().toISOString();
        appendAuditEvent(document, {
          action: 'post.status.updated',
          actorUserId: viewer!.id,
          metadata: { status },
          targetId: post.id,
          targetType: 'post',
        });

        return { post };
      });

      if ('missing' in result) {
        sendError(response, {
          code: 'POST_NOT_FOUND',
          corsOrigin,
          message: 'Post not found.',
          requestId,
          statusCode: 404,
        });
        return true;
      }

      json(response, 200, { post: result.post }, corsOrigin);
      return true;
    }
  }

  return false;
}
