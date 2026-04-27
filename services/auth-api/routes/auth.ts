import { randomBytes, randomUUID } from 'node:crypto';

import { requireAuthenticatedUser } from '../authz';
import { json, noContent, parseBody, sendError } from '../http';
import { createSession, revokeAllSessionsForUser, revokeSession, revokeSessionById } from '../session';
import {
  canAuthenticateUser,
  findUserByEmail,
  hashPassword,
  normalizeEmail,
  normalizeUsername,
  toSessionInfo,
  toSessionUser,
  verifyPassword,
  type StoredUser,
} from '../store';
import type { RouteHandlerContext } from './types';

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
const PASSWORD_MIN_LENGTH = 8;
const TOKEN_TTL_MS = 1000 * 60 * 60;

function createToken() {
  return randomBytes(24).toString('hex');
}

function createExpiryDate(durationMs: number) {
  return new Date(Date.now() + durationMs).toISOString();
}

function validateSignUpInput(body: Record<string, unknown>) {
  const displayName = String(body.displayName ?? '').trim();
  const username = normalizeUsername(String(body.username ?? ''));
  const email = normalizeEmail(String(body.email ?? ''));
  const password = String(body.password ?? '');
  const fieldErrors: Record<string, string> = {};

  if (!displayName) {
    fieldErrors.displayName = 'Display name is required.';
  }

  if (!USERNAME_PATTERN.test(username)) {
    fieldErrors.username = 'Username must be 3-24 characters using lowercase letters, numbers, or underscores.';
  }

  if (!email.includes('@')) {
    fieldErrors.email = 'A valid email address is required.';
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    fieldErrors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  return { displayName, username, email, password, fieldErrors };
}

async function sendVerificationEmail(context: RouteHandlerContext, user: StoredUser, token: string) {
  await context.sendAuthEmail({
    to: user.email,
    subject: 'Verify your email',
    text: `Verify your account with this token: ${token}`,
    html: `<p>Verify your account with this token:</p><pre>${token}</pre>`,
  });
}

async function sendPasswordResetEmail(context: RouteHandlerContext, user: StoredUser, token: string) {
  await context.sendAuthEmail({
    to: user.email,
    subject: 'Reset your password',
    text: `Reset your password with this token: ${token}`,
    html: `<p>Reset your password with this token:</p><pre>${token}</pre>`,
  });
}

export async function handleAuthRoutes(context: RouteHandlerContext): Promise<boolean> {
  const { corsOrigin, request, requestId, requestUrl, response, store } = context;

  if (request.method === 'POST' && requestUrl.pathname === '/auth/signup') {
    const body = await parseBody(request);
    const { displayName, username, email, password, fieldErrors } = validateSignUpInput(body);

    if (Object.keys(fieldErrors).length > 0) {
      sendError(response, {
        code: 'VALIDATION_ERROR',
        corsOrigin,
        fieldErrors,
        message: 'Sign-up details are invalid.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const result = await store.mutate(async (document) => {
      if (findUserByEmail(document, email)) {
        return { code: 'EMAIL_TAKEN' as const };
      }

      if (document.users.some((user) => user.username === username)) {
        return { code: 'USERNAME_TAKEN' as const };
      }

      const now = new Date().toISOString();
      const user: StoredUser = {
        id: randomUUID(),
        email,
        username,
        displayName,
        bio: '',
        avatarUrl: null,
        passwordHash: hashPassword(password),
        createdAt: now,
        updatedAt: now,
        emailVerifiedAt: null,
        deactivatedAt: null,
      };
      const verificationToken = createToken();

      document.users.push(user);
      document.emailVerificationTokens = document.emailVerificationTokens.filter(
        (token) => token.userId !== user.id,
      );
      document.emailVerificationTokens.push({
        id: randomUUID(),
        token: verificationToken,
        userId: user.id,
        createdAt: now,
        expiresAt: createExpiryDate(TOKEN_TTL_MS),
      });

      return { code: 'CREATED' as const, token: verificationToken, user };
    });

    if (result.code === 'EMAIL_TAKEN') {
      sendError(response, {
        code: 'EMAIL_TAKEN',
        corsOrigin,
        fieldErrors: { email: 'That email is already in use.' },
        message: 'That email is already in use.',
        requestId,
        statusCode: 409,
      });
      return true;
    }

    if (result.code === 'USERNAME_TAKEN') {
      sendError(response, {
        code: 'USERNAME_TAKEN',
        corsOrigin,
        fieldErrors: { username: 'That username is already in use.' },
        message: 'That username is already in use.',
        requestId,
        statusCode: 409,
      });
      return true;
    }

    await sendVerificationEmail(context, result.user, result.token);
    json(
      response,
      201,
      {
        message: 'Account created. Verify your email before signing in.',
        user: toSessionUser(result.user),
      },
      corsOrigin,
    );
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/auth/signin') {
    const body = await parseBody(request);
    const email = normalizeEmail(String(body.email ?? ''));
    const password = String(body.password ?? '');
    const document = await store.read();
    const user = findUserByEmail(document, email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      sendError(response, {
        code: 'INVALID_CREDENTIALS',
        corsOrigin,
        message: 'Email or password is incorrect.',
        requestId,
        statusCode: 401,
      });
      return true;
    }

    if (!user.emailVerifiedAt) {
      sendError(response, {
        code: 'EMAIL_NOT_VERIFIED',
        corsOrigin,
        message: 'Verify your email before signing in.',
        requestId,
        statusCode: 403,
      });
      return true;
    }

    if (!canAuthenticateUser(user)) {
      sendError(response, {
        code: 'ACCOUNT_UNAVAILABLE',
        corsOrigin,
        message: 'This account is not available.',
        requestId,
        statusCode: 403,
      });
      return true;
    }

    const session = await createSession(store, user.id);
    json(response, 200, { token: session.token, user: toSessionUser(user) }, corsOrigin);
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/auth/signout') {
    const authorization = request.headers.authorization;
    const token = authorization?.replace(/^Bearer\s+/i, '').trim() || null;
    await revokeSession(store, token);
    noContent(response, corsOrigin);
    return true;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/auth/session') {
    const authenticated = await requireAuthenticatedUser(context);

    if (!authenticated) {
      return true;
    }

    json(response, 200, { user: toSessionUser(authenticated.user) }, corsOrigin);
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/auth/verify-email/request') {
    const body = await parseBody(request);
    const email = normalizeEmail(String(body.email ?? ''));

    const result = await store.mutate((document) => {
      const user = findUserByEmail(document, email);

      if (!user || user.deactivatedAt !== null || user.emailVerifiedAt) {
        return { user: null, token: null };
      }

      const token = createToken();
      const now = new Date().toISOString();

      document.emailVerificationTokens = document.emailVerificationTokens.filter(
        (entry) => entry.userId !== user.id,
      );
      document.emailVerificationTokens.push({
        id: randomUUID(),
        token,
        userId: user.id,
        createdAt: now,
        expiresAt: createExpiryDate(TOKEN_TTL_MS),
      });

      return { user, token };
    });

    if (result.user && result.token) {
      await sendVerificationEmail(context, result.user, result.token);
    }

    json(
      response,
      200,
      { message: 'If that account exists, a verification email has been sent.' },
      corsOrigin,
    );
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/auth/verify-email/confirm') {
    const body = await parseBody(request);
    const token = String(body.token ?? '').trim();

    if (!token) {
      sendError(response, {
        code: 'VALIDATION_ERROR',
        corsOrigin,
        fieldErrors: { token: 'A verification token is required.' },
        message: 'A verification token is required.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const result = await store.mutate((document) => {
      const tokenEntry = document.emailVerificationTokens.find((entry) => entry.token === token);

      if (!tokenEntry) {
        return { user: null };
      }

      const user = document.users.find((entry) => entry.id === tokenEntry.userId) ?? null;

      if (!user || user.deactivatedAt !== null) {
        document.emailVerificationTokens = document.emailVerificationTokens.filter(
          (entry) => entry.token !== token,
        );
        return { user: null };
      }

      user.emailVerifiedAt = user.emailVerifiedAt ?? new Date().toISOString();
      user.updatedAt = new Date().toISOString();
      document.emailVerificationTokens = document.emailVerificationTokens.filter(
        (entry) => entry.userId !== user.id,
      );

      return { user };
    });

    if (!result.user) {
      sendError(response, {
        code: 'INVALID_TOKEN',
        corsOrigin,
        message: 'That verification token is invalid or expired.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    json(response, 200, { message: 'Email verified.', user: toSessionUser(result.user) }, corsOrigin);
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/auth/password-reset/request') {
    const body = await parseBody(request);
    const email = normalizeEmail(String(body.email ?? ''));

    const result = await store.mutate((document) => {
      const user = findUserByEmail(document, email);

      if (!user || user.deactivatedAt !== null || !user.emailVerifiedAt) {
        return { user: null, token: null };
      }

      const token = createToken();
      const now = new Date().toISOString();

      document.passwordResetTokens = document.passwordResetTokens.filter((entry) => entry.userId !== user.id);
      document.passwordResetTokens.push({
        id: randomUUID(),
        token,
        userId: user.id,
        createdAt: now,
        expiresAt: createExpiryDate(TOKEN_TTL_MS),
      });

      return { user, token };
    });

    if (result.user && result.token) {
      await sendPasswordResetEmail(context, result.user, result.token);
    }

    json(
      response,
      200,
      { message: 'If that account exists, a password reset email has been sent.' },
      corsOrigin,
    );
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/auth/password-reset/confirm') {
    const body = await parseBody(request);
    const token = String(body.token ?? '').trim();
    const password = String(body.password ?? '');

    if (!token || password.length < PASSWORD_MIN_LENGTH) {
      sendError(response, {
        code: 'VALIDATION_ERROR',
        corsOrigin,
        fieldErrors: {
          ...(token ? {} : { token: 'A password reset token is required.' }),
          ...(password.length >= PASSWORD_MIN_LENGTH
            ? {}
            : { password: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` }),
        },
        message: 'Password reset details are invalid.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const result = await store.mutate((document) => {
      const tokenEntry = document.passwordResetTokens.find((entry) => entry.token === token) ?? null;

      if (!tokenEntry) {
        return { user: null };
      }

      const user = document.users.find((entry) => entry.id === tokenEntry.userId) ?? null;

      if (!user || user.deactivatedAt !== null) {
        document.passwordResetTokens = document.passwordResetTokens.filter((entry) => entry.token !== token);
        return { user: null };
      }

      user.passwordHash = hashPassword(password);
      user.updatedAt = new Date().toISOString();
      document.passwordResetTokens = document.passwordResetTokens.filter((entry) => entry.userId !== user.id);
      document.sessions = document.sessions.filter((session) => session.userId !== user.id);

      return { user };
    });

    if (!result.user) {
      sendError(response, {
        code: 'INVALID_TOKEN',
        corsOrigin,
        message: 'That password reset token is invalid or expired.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    json(response, 200, { message: 'Password updated.' }, corsOrigin);
    return true;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/me/sessions') {
    const authenticated = await requireAuthenticatedUser(context);

    if (!authenticated) {
      return true;
    }

    const document = await store.read();
    const sessions = document.sessions
      .filter((session) => session.userId === authenticated.user.id)
      .map((session) => toSessionInfo(session, authenticated.token))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    json(response, 200, { sessions }, corsOrigin);
    return true;
  }

  if (
    request.method === 'DELETE' &&
    requestUrl.pathname.startsWith('/me/sessions/') &&
    requestUrl.pathname.split('/').length === 4
  ) {
    const authenticated = await requireAuthenticatedUser(context);

    if (!authenticated) {
      return true;
    }

    const sessionId = requestUrl.pathname.split('/')[3] ?? '';
    await revokeSessionById(store, authenticated.user.id, sessionId);
    noContent(response, corsOrigin);
    return true;
  }

  if (request.method === 'DELETE' && requestUrl.pathname === '/me/account') {
    const authenticated = await requireAuthenticatedUser(context);

    if (!authenticated) {
      return true;
    }

    await store.mutate((document) => {
      const user = document.users.find((entry) => entry.id === authenticated.user.id);

      if (!user) {
        return;
      }

      const now = new Date().toISOString();
      user.deactivatedAt = now;
      user.updatedAt = now;
      document.sessions = document.sessions.filter((session) => session.userId !== user.id);
      document.follows = document.follows.filter(
        (follow) => follow.followerId !== user.id && follow.followeeId !== user.id,
      );
      document.emailVerificationTokens = document.emailVerificationTokens.filter(
        (entry) => entry.userId !== user.id,
      );
      document.passwordResetTokens = document.passwordResetTokens.filter((entry) => entry.userId !== user.id);
      document.uploadIntents = document.uploadIntents.filter((entry) => entry.userId !== user.id);
    });

    await revokeAllSessionsForUser(store, authenticated.user.id);
    noContent(response, corsOrigin);
    return true;
  }

  return false;
}
