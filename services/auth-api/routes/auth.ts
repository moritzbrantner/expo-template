import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

import { requirePermission } from '../authz';
import { json, noContent, parseBody, sendError } from '../http';
import {
  createSession,
  readSessionToken,
  resolveSession,
  revokeAllSessionsForUser,
  revokeSession,
  revokeSessionById,
} from '../session';
import {
  canAuthenticateUser,
  createTimedTokenRecord,
  isValidEmail,
  isValidUsername,
  normalizeUsername,
  type StoredEmailVerificationToken,
  type StoredPasswordResetToken,
  toSessionInfo,
  toSessionUser,
  type StoredUser,
} from '../store';
import type { RouteHandlerContext } from './types';

function hashPassword(password: string): string {
  const saltHex = randomBytes(16).toString('hex');
  const hash = scryptSync(password, saltHex, 64).toString('hex');
  return `${saltHex}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHash] = storedHash.split(':');

  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  return actualHash.length === expected.length && timingSafeEqual(actualHash, expected);
}

async function sendVerificationEmail(context: RouteHandlerContext, user: StoredUser, token: string) {
  try {
    await context.sendAuthEmail({
      to: user.email,
      subject: 'Verify your email',
      text: `Hi ${user.displayName}, verify your account with token ${token}.`,
      html: `<p>Hi <strong>${user.displayName}</strong>,</p><p>Verify your account with token <code>${token}</code>.</p>`,
    });
  } catch (error) {
    context.log('email.send_failed', {
      emailType: 'verification',
      message: error instanceof Error ? error.message : 'Unknown email error.',
      userId: user.id,
    });
  }
}

async function sendPasswordResetEmail(context: RouteHandlerContext, user: StoredUser, token: string) {
  try {
    await context.sendAuthEmail({
      to: user.email,
      subject: 'Reset your password',
      text: `Hi ${user.displayName}, reset your password with token ${token}.`,
      html: `<p>Hi <strong>${user.displayName}</strong>,</p><p>Reset your password with token <code>${token}</code>.</p>`,
    });
  } catch (error) {
    context.log('email.send_failed', {
      emailType: 'password_reset',
      message: error instanceof Error ? error.message : 'Unknown email error.',
      userId: user.id,
    });
  }
}

export async function handleAuthRoutes(context: RouteHandlerContext): Promise<boolean> {
  const { corsOrigin, request, requestId, requestUrl, response, store } = context;

  if (request.method === 'POST' && requestUrl.pathname === '/auth/signup') {
    const body = await parseBody(request);
    const displayName = String(body.displayName ?? '').trim();
    const username = normalizeUsername(String(body.username ?? ''));
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!displayName) {
      sendError(response, {
        code: 'DISPLAY_NAME_REQUIRED',
        corsOrigin,
        message: 'Display name is required.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    if (!isValidUsername(username)) {
      sendError(response, {
        code: 'INVALID_USERNAME',
        corsOrigin,
        message: 'Username must be 3-24 characters using lowercase letters, numbers, or underscores.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    if (!isValidEmail(email)) {
      sendError(response, {
        code: 'INVALID_EMAIL',
        corsOrigin,
        message: 'A valid email address is required.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    if (password.length < 8) {
      sendError(response, {
        code: 'INVALID_PASSWORD',
        corsOrigin,
        message: 'Password must be at least 8 characters long.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const result = await store.mutate((document) => {
      if (document.users.some((entry) => entry.email === email)) {
        return { duplicate: 'email' as const };
      }

      if (document.users.some((entry) => entry.username === username)) {
        return { duplicate: 'username' as const };
      }

      const now = new Date().toISOString();
      const user: StoredUser = {
        id: randomUUID(),
        email,
        username,
        displayName,
        bio: '',
        avatarUrl: null,
        coverUrl: null,
        role: store.adminEmails.has(email) ? 'admin' : 'member',
        status: 'active',
        discoverable: true,
        onboardingCompleted: false,
        createdAt: now,
        updatedAt: now,
        emailVerifiedAt: null,
        suspendedAt: null,
        deactivatedAt: null,
        passwordHash: hashPassword(password),
      };
      const verificationToken = createTimedTokenRecord<StoredEmailVerificationToken>(user.id);

      document.users.push(user);
      document.emailVerificationTokens = document.emailVerificationTokens.filter((token) => token.userId !== user.id);
      document.emailVerificationTokens.push({
        ...verificationToken,
        userId: user.id,
      });

      return { user, verificationToken: verificationToken.token };
    });

    if ('duplicate' in result) {
      sendError(response, {
        code: result.duplicate === 'email' ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN',
        corsOrigin,
        message:
          result.duplicate === 'email'
            ? 'An account already exists for this email address.'
            : 'That username is already taken.',
        requestId,
        statusCode: 409,
      });
      return true;
    }

    await sendVerificationEmail(context, result.user, result.verificationToken);

    json(
      response,
      201,
      {
        message: 'Account created. Verify your email before signing in.',
        verificationRequired: true,
        user: toSessionUser(result.user),
      },
      corsOrigin,
    );
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/auth/verify-email/request') {
    const body = await parseBody(request);
    const email = String(body.email ?? '').trim().toLowerCase();

    if (!isValidEmail(email)) {
      sendError(response, {
        code: 'INVALID_EMAIL',
        corsOrigin,
        message: 'A valid email address is required.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const result = await store.mutate((document) => {
      const user = document.users.find((entry) => entry.email === email);

      if (!user || user.status !== 'active' || user.emailVerifiedAt) {
        return null;
      }

      const verificationToken = createTimedTokenRecord<StoredEmailVerificationToken>(user.id);
      document.emailVerificationTokens = document.emailVerificationTokens.filter((token) => token.userId !== user.id);
      document.emailVerificationTokens.push({
        ...verificationToken,
        userId: user.id,
      });
      return {
        token: verificationToken.token,
        user,
      };
    });

    if (result) {
      await sendVerificationEmail(context, result.user, result.token);
    }

    json(response, 202, { message: 'If the account exists, a verification email has been sent.' }, corsOrigin);
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/auth/verify-email/confirm') {
    const body = await parseBody(request);
    const tokenValue = String(body.token ?? '').trim();

    if (!tokenValue) {
      sendError(response, {
        code: 'TOKEN_REQUIRED',
        corsOrigin,
        message: 'A verification token is required.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const result = await store.mutate((document) => {
      const verificationToken = document.emailVerificationTokens.find(
        (token) => token.token === tokenValue && !token.consumedAt,
      );

      if (!verificationToken || Date.parse(verificationToken.expiresAt) <= Date.now()) {
        return { invalid: true as const };
      }

      const user = document.users.find((entry) => entry.id === verificationToken.userId);

      if (!user) {
        return { invalid: true as const };
      }

      const now = new Date().toISOString();
      verificationToken.consumedAt = now;
      user.emailVerifiedAt = now;
      user.updatedAt = now;

      return { user };
    });

    if ('invalid' in result) {
      sendError(response, {
        code: 'INVALID_TOKEN',
        corsOrigin,
        message: 'The verification token is invalid or expired.',
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
    const email = String(body.email ?? '').trim().toLowerCase();

    if (!isValidEmail(email)) {
      sendError(response, {
        code: 'INVALID_EMAIL',
        corsOrigin,
        message: 'A valid email address is required.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const result = await store.mutate((document) => {
      const user = document.users.find((entry) => entry.email === email);

      if (!user || user.status !== 'active') {
        return null;
      }

      const resetToken = createTimedTokenRecord<StoredPasswordResetToken>(user.id);
      document.passwordResetTokens = document.passwordResetTokens.filter((token) => token.userId !== user.id);
      document.passwordResetTokens.push({
        ...resetToken,
        userId: user.id,
      });

      return {
        token: resetToken.token,
        user,
      };
    });

    if (result) {
      await sendPasswordResetEmail(context, result.user, result.token);
    }

    json(response, 202, { message: 'If the account exists, a password reset email has been sent.' }, corsOrigin);
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/auth/password-reset/confirm') {
    const body = await parseBody(request);
    const tokenValue = String(body.token ?? '').trim();
    const password = String(body.password ?? '');

    if (!tokenValue || password.length < 8) {
      sendError(response, {
        code: 'INVALID_PASSWORD_RESET_REQUEST',
        corsOrigin,
        message: 'A valid password reset token and a new password of at least 8 characters are required.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const result = await store.mutate((document) => {
      const resetToken = document.passwordResetTokens.find(
        (token) => token.token === tokenValue && !token.consumedAt,
      );

      if (!resetToken || Date.parse(resetToken.expiresAt) <= Date.now()) {
        return { invalid: true as const };
      }

      const user = document.users.find((entry) => entry.id === resetToken.userId);

      if (!user) {
        return { invalid: true as const };
      }

      const now = new Date().toISOString();
      resetToken.consumedAt = now;
      user.passwordHash = hashPassword(password);
      user.updatedAt = now;
      document.sessions = document.sessions.filter((session) => session.userId !== user.id);

      return { user };
    });

    if ('invalid' in result) {
      sendError(response, {
        code: 'INVALID_TOKEN',
        corsOrigin,
        message: 'The password reset token is invalid or expired.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    json(response, 200, { message: 'Password updated.' }, corsOrigin);
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/auth/signin') {
    const body = await parseBody(request);
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const document = await store.read();
    const user = document.users.find((entry) => entry.email === email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      sendError(response, {
        code: 'INVALID_CREDENTIALS',
        corsOrigin,
        message: 'Invalid email or password.',
        requestId,
        statusCode: 401,
      });
      return true;
    }

    if (!canAuthenticateUser(user)) {
      const code =
        user.status === 'suspended'
          ? 'ACCOUNT_SUSPENDED'
          : user.status === 'deactivated'
            ? 'ACCOUNT_DEACTIVATED'
            : 'EMAIL_NOT_VERIFIED';
      const message =
        user.status === 'suspended'
          ? 'This account has been suspended.'
          : user.status === 'deactivated'
            ? 'This account has been deactivated.'
            : 'Verify your email before signing in.';

      sendError(response, {
        code,
        corsOrigin,
        message,
        requestId,
        statusCode: 403,
      });
      return true;
    }

    const session = await createSession(store, user.id);

    json(
      response,
      200,
      {
        token: session.token,
        session: toSessionInfo(session, session.token),
        user: toSessionUser(user),
      },
      corsOrigin,
    );
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/auth/signout') {
    await revokeSession(store, readSessionToken(request));
    noContent(response, corsOrigin);
    return true;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/auth/session') {
    const token = readSessionToken(request);
    const user = await resolveSession(store, token);

    if (!user) {
      sendError(response, {
        code: 'SESSION_NOT_FOUND',
        corsOrigin,
        message: 'Session not found.',
        requestId,
        statusCode: 401,
      });
      return true;
    }

    const document = await store.read();
    const session = document.sessions.find((entry) => entry.token === token) ?? null;

    json(
      response,
      200,
      {
        user: toSessionUser(user),
        session: session ? toSessionInfo(session, token) : null,
      },
      corsOrigin,
    );
    return true;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/me/sessions') {
    const token = readSessionToken(request);
    const user = await resolveSession(store, token);
    const sessionUser = user ? toSessionUser(user) : null;

    if (!requirePermission(response, { corsOrigin, permission: 'session.read:self', requestId, user: sessionUser })) {
      return true;
    }

    const document = await store.read();
    const sessions = document.sessions
      .filter((session) => session.userId === user!.id)
      .sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt))
      .map((session) => toSessionInfo(session, token));

    json(response, 200, { sessions }, corsOrigin);
    return true;
  }

  if (request.method === 'DELETE' && requestUrl.pathname.startsWith('/me/sessions/')) {
    const token = readSessionToken(request);
    const user = await resolveSession(store, token);
    const sessionUser = user ? toSessionUser(user) : null;

    if (!requirePermission(response, { corsOrigin, permission: 'session.delete:self', requestId, user: sessionUser })) {
      return true;
    }

    const sessionId = requestUrl.pathname.split('/').filter(Boolean)[2];
    await revokeSessionById(store, user!.id, String(sessionId));

    if ((await store.read()).sessions.some((session) => session.id === sessionId && session.token === token)) {
      await revokeSession(store, token);
    }

    noContent(response, corsOrigin);
    return true;
  }

  if (request.method === 'DELETE' && requestUrl.pathname === '/me/account') {
    const token = readSessionToken(request);
    const user = await resolveSession(store, token);
    const sessionUser = user ? toSessionUser(user) : null;

    if (!requirePermission(response, { corsOrigin, permission: 'account.delete:self', requestId, user: sessionUser })) {
      return true;
    }

    await store.mutate((document) => {
      const target = document.users.find((entry) => entry.id === user!.id);

      if (!target) {
        return;
      }

      const now = new Date().toISOString();
      target.status = 'deactivated';
      target.discoverable = false;
      target.deactivatedAt = now;
      target.updatedAt = now;
      document.sessions = document.sessions.filter((session) => session.userId !== target.id);
      document.follows = document.follows.filter(
        (follow) => follow.followerId !== target.id && follow.followeeId !== target.id,
      );
      document.blocks = document.blocks.filter(
        (block) => block.blockerId !== target.id && block.blockedId !== target.id,
      );
      document.mutes = document.mutes.filter(
        (mute) => mute.muterId !== target.id && mute.mutedId !== target.id,
      );
    });

    await revokeAllSessionsForUser(store, user!.id);
    noContent(response, corsOrigin);
    return true;
  }

  return false;
}
