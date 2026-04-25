import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';

import { json, noContent, sendError, getRequestIp } from './http';
import { handleAdminRoutes } from './routes/admin';
import { handleAuthRoutes } from './routes/auth';
import { handleContentRoutes } from './routes/content';
import { handleFollowRoutes } from './routes/follows';
import { handleNotificationRoutes } from './routes/notifications';
import { handleProfileRoutes } from './routes/profiles';
import { handleReportRoutes } from './routes/reports';
import { createStore, type StoredUser } from './store';

export interface AuthApiConfig {
  adminEmails?: string[];
  corsOrigin?: string;
  dataFile?: string;
  enableTestEndpoints?: boolean;
  smtpFrom?: string;
  smtpHost?: string;
  smtpPort?: number;
}

type RateLimitRule = {
  limit: number;
  windowMs: number;
};

const rateLimitBuckets = new Map<string, number[]>();

function getRateLimitRule(method: string, pathname: string): RateLimitRule | null {
  if (
    method === 'POST' &&
    ['/auth/signup', '/auth/signin', '/auth/verify-email/request', '/auth/password-reset/request'].includes(pathname)
  ) {
    return {
      limit: 8,
      windowMs: 60_000,
    };
  }

  if (
    ['POST', 'PATCH', 'DELETE'].includes(method) &&
    (pathname.startsWith('/posts') ||
      pathname.startsWith('/comments') ||
      pathname.startsWith('/reports') ||
      pathname.includes('/reactions'))
  ) {
    return {
      limit: 60,
      windowMs: 60_000,
    };
  }

  return null;
}

function isRateLimited(ip: string, method: string, pathname: string): boolean {
  const rule = getRateLimitRule(method, pathname);

  if (!rule) {
    return false;
  }

  const key = `${ip}:${method}:${pathname}`;
  const now = Date.now();
  const entries = (rateLimitBuckets.get(key) ?? []).filter((timestamp) => now - timestamp < rule.windowMs);

  if (entries.length >= rule.limit) {
    rateLimitBuckets.set(key, entries);
    return true;
  }

  entries.push(now);
  rateLimitBuckets.set(key, entries);
  return false;
}

export function createAuthApiServer(config: AuthApiConfig = {}): Server {
  const corsOrigin = config.corsOrigin ?? '*';
  const store = createStore({
    dataFile: config.dataFile ?? '/data/users.json',
    adminEmails: config.adminEmails,
  });
  const enableTestEndpoints = config.enableTestEndpoints ?? false;
  const smtpFrom = config.smtpFrom ?? 'noreply@example.test';
  let mailTransportDisabled = false;

  async function sendAuthEmail(payload: {
    html: string;
    subject: string;
    text: string;
    to: string;
  }): Promise<void> {
    if (mailTransportDisabled) {
      return;
    }

    try {
      const nodemailer = await import('nodemailer');
      const transport = nodemailer.default.createTransport({
        host: config.smtpHost ?? 'mailpit',
        port: config.smtpPort ?? 1025,
        secure: false,
      });

      await transport.sendMail({
        from: smtpFrom,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
    } catch (error) {
      mailTransportDisabled = true;
      throw error;
    }
  }

  return createServer(async (request, response) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    const requestIp = getRequestIp(request);

    response.setHeader('x-request-id', requestId);
    response.once('finish', () => {
      console.log(
        JSON.stringify({
          durationMs: Date.now() - startedAt,
          event: 'request.completed',
          method: request.method,
          path: request.url,
          requestId,
          statusCode: response.statusCode,
        }),
      );
    });

    if (!request.url) {
      sendError(response, {
        code: 'MISSING_URL',
        corsOrigin,
        message: 'Missing request URL.',
        requestId,
        statusCode: 400,
      });
      return;
    }

    const requestUrl = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const log = (event: string, payload: Record<string, unknown> = {}) => {
      console.log(
        JSON.stringify({
          ...payload,
          event,
          method: request.method,
          path: requestUrl.pathname,
          requestId,
        }),
      );
    };

    log('request.started', { ip: requestIp });

    if (request.method === 'OPTIONS') {
      noContent(response, corsOrigin);
      return;
    }

    if (isRateLimited(requestIp, request.method ?? 'GET', requestUrl.pathname)) {
      sendError(response, {
        code: 'RATE_LIMITED',
        corsOrigin,
        message: 'Too many requests. Try again soon.',
        requestId,
        statusCode: 429,
      });
      return;
    }

    try {
      if (request.method === 'GET' && requestUrl.pathname === '/health') {
        json(response, 200, { ok: true }, corsOrigin);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/ready') {
        await store.read();
        json(response, 200, { ok: true }, corsOrigin);
        return;
      }

      const context = {
        corsOrigin,
        log,
        request,
        requestId,
        response,
        requestUrl,
        sendAuthEmail,
        store,
      };

      if (
        (await handleAuthRoutes(context)) ||
        (await handleProfileRoutes(context)) ||
        (await handleFollowRoutes(context)) ||
        (await handleContentRoutes(context)) ||
        (await handleNotificationRoutes(context)) ||
        (await handleReportRoutes(context)) ||
        (await handleAdminRoutes(context))
      ) {
        return;
      }

      if (enableTestEndpoints && request.method === 'POST' && requestUrl.pathname === '/test/reset') {
        await store.reset();
        json(response, 200, { ok: true }, corsOrigin);
        return;
      }

      sendError(response, {
        code: 'NOT_FOUND',
        corsOrigin,
        message: 'Not found.',
        requestId,
        statusCode: 404,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected server error.';
      log('request.failed', { message });
      sendError(response, {
        code: 'INTERNAL_SERVER_ERROR',
        corsOrigin,
        message,
        requestId,
        statusCode: 500,
      });
    }
  });
}
