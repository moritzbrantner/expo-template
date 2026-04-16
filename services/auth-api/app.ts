import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { dirname } from 'node:path';

interface StoredUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  passwordHash: string;
}

interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthApiConfig {
  corsOrigin?: string;
  dataFile?: string;
  enableTestEndpoints?: boolean;
  smtpFrom?: string;
  smtpHost?: string;
  smtpPort?: number;
}

function json(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
  corsOrigin: string,
): void {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(payload));
}

async function ensureStore(dataFile: string): Promise<void> {
  await mkdir(dirname(dataFile), { recursive: true });

  try {
    await readFile(dataFile, 'utf8');
  } catch {
    await writeFile(dataFile, '[]', 'utf8');
  }
}

async function readUsers(dataFile: string): Promise<StoredUser[]> {
  await ensureStore(dataFile);
  const raw = await readFile(dataFile, 'utf8');
  return JSON.parse(raw) as StoredUser[];
}

async function writeUsers(dataFile: string, users: StoredUser[]): Promise<void> {
  await ensureStore(dataFile);
  await writeFile(dataFile, JSON.stringify(users, null, 2), 'utf8');
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHash] = storedHash.split(':');

  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');

  return expected.length === actualHash.length && timingSafeEqual(expected, actualHash);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

async function parseBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

export function createAuthApiServer(config: AuthApiConfig = {}): Server {
  const corsOrigin = config.corsOrigin ?? '*';
  const dataFile = config.dataFile ?? '/data/users.json';
  const enableTestEndpoints = config.enableTestEndpoints ?? false;
  const smtpFrom = config.smtpFrom ?? 'noreply@example.test';

  async function sendWelcomeEmail(user: StoredUser): Promise<void> {
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
      text: `Hi ${user.name}, your account for ${user.email} is ready. You can now sign in from the Expo app.`,
      html: `<p>Hi <strong>${user.name}</strong>,</p><p>Your account for <strong>${user.email}</strong> is ready. You can now sign in from the Expo app.</p>`,
    });
  }

  return createServer(async (request, response) => {
    if (!request.url) {
      json(response, 400, { error: 'Missing request URL.' }, corsOrigin);
      return;
    }

    const requestUrl = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      });
      response.end();
      return;
    }

    try {
      if (request.method === 'GET' && requestUrl.pathname === '/health') {
        json(response, 200, { ok: true }, corsOrigin);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/users') {
        const users = await readUsers(dataFile);
        json(
          response,
          200,
          {
            users: users.map(toPublicUser),
          },
          corsOrigin,
        );
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname.startsWith('/users/')) {
        const userId = requestUrl.pathname.slice('/users/'.length);

        if (!userId) {
          json(response, 400, { error: 'User id is required.' }, corsOrigin);
          return;
        }

        const users = await readUsers(dataFile);
        const user = users.find((entry) => entry.id === userId);

        if (!user) {
          json(response, 404, { error: 'User not found.' }, corsOrigin);
          return;
        }

        json(
          response,
          200,
          {
            user: toPublicUser(user),
          },
          corsOrigin,
        );
        return;
      }

      if (request.method === 'POST' && requestUrl.pathname === '/auth/signup') {
        const body = await parseBody(request);
        const name = String(body.name ?? '').trim();
        const email = String(body.email ?? '').trim().toLowerCase();
        const password = String(body.password ?? '');

        if (!name) {
          json(response, 400, { error: 'Name is required.' }, corsOrigin);
          return;
        }

        if (!isValidEmail(email)) {
          json(response, 400, { error: 'A valid email address is required.' }, corsOrigin);
          return;
        }

        if (password.length < 8) {
          json(
            response,
            400,
            { error: 'Password must be at least 8 characters long.' },
            corsOrigin,
          );
          return;
        }

        const users = await readUsers(dataFile);
        const existingUser = users.find((user) => user.email === email);

        if (existingUser) {
          json(
            response,
            409,
            { error: 'An account already exists for this email address.' },
            corsOrigin,
          );
          return;
        }

        const user: StoredUser = {
          id: randomBytes(12).toString('hex'),
          name,
          email,
          createdAt: new Date().toISOString(),
          passwordHash: hashPassword(password),
        };

        users.push(user);
        await writeUsers(dataFile, users);
        await sendWelcomeEmail(user);

        json(
          response,
          201,
          {
            message: 'Account created. Check Mailpit for the welcome email.',
            user: toPublicUser(user),
          },
          corsOrigin,
        );
        return;
      }

      if (request.method === 'POST' && requestUrl.pathname === '/auth/signin') {
        const body = await parseBody(request);
        const email = String(body.email ?? '').trim().toLowerCase();
        const password = String(body.password ?? '');
        const users = await readUsers(dataFile);
        const user = users.find((entry) => entry.email === email);

        if (!user || !verifyPassword(password, user.passwordHash)) {
          json(response, 401, { error: 'Invalid email or password.' }, corsOrigin);
          return;
        }

        json(
          response,
          200,
          {
            token: randomBytes(24).toString('hex'),
            user: toPublicUser(user),
          },
          corsOrigin,
        );
        return;
      }

      if (enableTestEndpoints && request.method === 'POST' && requestUrl.pathname === '/test/reset') {
        await writeUsers(dataFile, []);
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
