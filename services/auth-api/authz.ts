import { sendError } from './http';
import { readSessionToken, resolveSession } from './session';
import type { StoredUser } from './store';
import type { RouteHandlerContext } from './routes/types';

export async function resolveViewer(context: RouteHandlerContext): Promise<StoredUser | null> {
  return resolveSession(context.store, readSessionToken(context.request));
}

export async function requireAuthenticatedUser(
  context: RouteHandlerContext,
): Promise<{ token: string; user: StoredUser } | null> {
  const token = readSessionToken(context.request);
  const user = await resolveSession(context.store, token);

  if (!token || !user) {
    sendError(context.response, {
      code: 'UNAUTHORIZED',
      corsOrigin: context.corsOrigin,
      message: 'Authentication is required for this request.',
      requestId: context.requestId,
      statusCode: 401,
    });
    return null;
  }

  return { token, user };
}
