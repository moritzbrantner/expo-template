import { createServer, type Server } from 'node:http';

import { json, noContent } from './http';
import { handleAdminRoutes } from './routes/admin';
import { handleAuthRoutes } from './routes/auth';
import { handleFollowRoutes } from './routes/follows';
import { handleProfileRoutes } from './routes/profiles';
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

export function createAuthApiServer(config: AuthApiConfig = {}): Server {
  const corsOrigin = config.corsOrigin ?? '*';
  const store = createStore({
    dataFile: config.dataFile ?? '/data/users.json',
    adminEmails: config.adminEmails,
  });
  const enableTestEndpoints = config.enableTestEndpoints ?? false;
  const smtpFrom = config.smtpFrom ?? 'noreply@example.test';
  let mailTransportDisabled = false;

  async function sendWelcomeEmail(user: StoredUser): Promise<void> {
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
        to: user.email,
        subject: 'Welcome to the Expo auth flow',
        text: `Hi ${user.displayName}, your account for @${user.username} is ready. You can now sign in from the Expo app.`,
        html: `<p>Hi <strong>${user.displayName}</strong>,</p><p>Your account for <strong>@${user.username}</strong> is ready. You can now sign in from the Expo app.</p>`,
      });
    } catch (error) {
      mailTransportDisabled = true;
      throw error;
    }
  }

  return createServer(async (request, response) => {
    if (!request.url) {
      json(response, 400, { error: 'Missing request URL.' }, corsOrigin);
      return;
    }

    const requestUrl = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);

    if (request.method === 'OPTIONS') {
      noContent(response, corsOrigin);
      return;
    }

    try {
      if (request.method === 'GET' && requestUrl.pathname === '/health') {
        json(response, 200, { ok: true }, corsOrigin);
        return;
      }

      const context = {
        corsOrigin,
        request,
        response,
        requestUrl,
        store,
        sendWelcomeEmail,
      };

      if (
        (await handleAuthRoutes(context)) ||
        (await handleProfileRoutes(context)) ||
        (await handleFollowRoutes(context)) ||
        (await handleAdminRoutes(context))
      ) {
        return;
      }

      if (enableTestEndpoints && request.method === 'POST' && requestUrl.pathname === '/test/reset') {
        await store.reset();
        json(response, 200, { ok: true }, corsOrigin);
        return;
      }

      json(response, 404, { error: 'Not found.' }, corsOrigin);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected server error.';
      json(response, 500, { error: message }, corsOrigin);
    }
  });
}
