import type { ServerResponse } from 'node:http';

import type { Permission, SessionUser } from '../../shared/social';
import { hasPermission } from '../../shared/social';
import { json } from './http';

export { hasPermission } from '../../shared/social';

export function requirePermission(
  response: ServerResponse,
  corsOrigin: string,
  user: SessionUser | null,
  permission: Permission,
): boolean {
  if (!user) {
    json(response, 401, { error: 'Authentication is required.' }, corsOrigin);
    return false;
  }

  if (!hasPermission(user, permission)) {
    json(response, 403, { error: 'You do not have permission to perform this action.' }, corsOrigin);
    return false;
  }

  return true;
}
