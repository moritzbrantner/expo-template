import type { ServerResponse } from 'node:http';

import type { Permission, SessionUser } from '../../shared/social';
import { hasPermission } from '../../shared/social';
import { sendError } from './http';

export { hasPermission } from '../../shared/social';

export function requirePermission(
  response: ServerResponse,
  {
    corsOrigin,
    permission,
    requestId,
    user,
  }: {
    corsOrigin: string;
    permission: Permission;
    requestId: string;
    user: SessionUser | null;
  },
): boolean {
  if (!user) {
    sendError(response, {
      code: 'AUTH_REQUIRED',
      corsOrigin,
      message: 'Authentication is required.',
      requestId,
      statusCode: 401,
    });
    return false;
  }

  if (!hasPermission(user, permission)) {
    sendError(response, {
      code: 'FORBIDDEN',
      corsOrigin,
      message: 'You do not have permission to perform this action.',
      requestId,
      statusCode: 403,
    });
    return false;
  }

  return true;
}
