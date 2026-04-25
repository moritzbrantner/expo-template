import { requirePermission } from '../authz';
import { getPaginationCursor, json, paginate, sendError } from '../http';
import { readSessionToken, resolveSession } from '../session';
import { toNotification, toSessionUser } from '../store';
import type { RouteHandlerContext } from './types';

const PAGE_SIZE = 20;

export async function handleNotificationRoutes(context: RouteHandlerContext): Promise<boolean> {
  const { corsOrigin, request, requestId, requestUrl, response, store } = context;
  const viewer = await resolveSession(store, readSessionToken(request));
  const viewerSession = viewer ? toSessionUser(viewer) : null;

  if (request.method === 'GET' && requestUrl.pathname === '/me/notifications') {
    if (!requirePermission(response, { corsOrigin, permission: 'notification.read:self', requestId, user: viewerSession })) {
      return true;
    }

    const cursor = getPaginationCursor(requestUrl);
    const document = await store.read();
    const notifications = document.notifications
      .filter((notification) => notification.userId === viewer!.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((notification) => toNotification(document, notification, viewerSession));
    const page = paginate(notifications, cursor, PAGE_SIZE);

    json(response, 200, { notifications: page.items, nextCursor: page.nextCursor }, corsOrigin);
    return true;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/me/notifications/unread-count') {
    if (!requirePermission(response, { corsOrigin, permission: 'notification.read:self', requestId, user: viewerSession })) {
      return true;
    }

    const document = await store.read();
    const unreadCount = document.notifications.filter(
      (notification) => notification.userId === viewer!.id && !notification.readAt,
    ).length;

    json(response, 200, { unreadCount }, corsOrigin);
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/me/notifications/read-all') {
    if (!requirePermission(response, { corsOrigin, permission: 'notification.read:self', requestId, user: viewerSession })) {
      return true;
    }

    await store.mutate((document) => {
      const now = new Date().toISOString();
      document.notifications.forEach((notification) => {
        if (notification.userId === viewer!.id && !notification.readAt) {
          notification.readAt = now;
        }
      });
    });

    json(response, 200, { ok: true }, corsOrigin);
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname.startsWith('/me/notifications/')) {
    const segments = requestUrl.pathname.split('/').filter(Boolean);

    if (segments.length === 4 && segments[3] === 'read') {
      if (!requirePermission(response, { corsOrigin, permission: 'notification.read:self', requestId, user: viewerSession })) {
        return true;
      }

      const result = await store.mutate((document) => {
        const notification = document.notifications.find(
          (entry) => entry.id === segments[2] && entry.userId === viewer!.id,
        );

        if (!notification) {
          return { missing: true as const };
        }

        notification.readAt = notification.readAt ?? new Date().toISOString();
        return { ok: true as const };
      });

      if ('missing' in result) {
        sendError(response, {
          code: 'NOTIFICATION_NOT_FOUND',
          corsOrigin,
          message: 'Notification not found.',
          requestId,
          statusCode: 404,
        });
        return true;
      }

      json(response, 200, { ok: true }, corsOrigin);
      return true;
    }
  }

  return false;
}
