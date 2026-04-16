import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname } from 'node:path';

import nodemailer from 'nodemailer';

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

const PORT = Number(process.env.PORT ?? 4001);
const SMTP_HOST = process.env.SMTP_HOST ?? 'mailpit';
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 1025);
const SMTP_FROM = process.env.SMTP_FROM ?? 'noreply@example.test';
const DATA_FILE = process.env.DATA_FILE ?? '/data/users.json';
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';
const ENABLE_TEST_ENDPOINTS = process.env.AUTH_API_ENABLE_TEST_ENDPOINTS === 'true';

const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
});

function json(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(payload));
}

async function ensureStore(): Promise<void> {
  await mkdir(dirname(DATA_FILE), { recursive: true });

  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeFile(DATA_FILE, '[]', 'utf8');
  }
}

async function readUsers(): Promise<StoredUser[]> {
  await ensureStore();
  const raw = await readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw) as StoredUser[];
}

async function writeUsers(users: StoredUser[]): Promise<void> {
  await ensureStore();
  await writeFile(DATA_FILE, JSON.stringify(users, null, 2), 'utf8');
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

async function sendWelcomeEmail(user: StoredUser): Promise<void> {
  await transport.sendMail({
    from: SMTP_FROM,
    to: user.email,
    subject: 'Welcome to the Expo auth flow',
    text: `Hi ${user.name}, your account for ${user.email} is ready. You can now sign in from the Expo app.`,
    html: `<p>Hi <strong>${user.name}</strong>,</p><p>Your account for <strong>${user.email}</strong> is ready. You can now sign in from the Expo app.</p>`,
  });
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    json(response, 400, { error: 'Missing request URL.' });
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    });
    response.end();
    return;
  }

  try {
    if (request.method === 'GET' && requestUrl.pathname === '/health') {
      json(response, 200, { ok: true });
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/users') {
      const users = await readUsers();
      json(response, 200, {
        users: users.map(toPublicUser),
      });
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname.startsWith('/users/')) {
      const userId = requestUrl.pathname.slice('/users/'.length);

      if (!userId) {
        json(response, 400, { error: 'User id is required.' });
        return;
      }

      const users = await readUsers();
      const user = users.find((entry) => entry.id === userId);

      if (!user) {
        json(response, 404, { error: 'User not found.' });
        return;
      }

      json(response, 200, {
        user: toPublicUser(user),
      });
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/auth/signup') {
      const body = await parseBody(request);
      const name = String(body.name ?? '').trim();
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');

      if (!name) {
        json(response, 400, { error: 'Name is required.' });
        return;
      }

      if (!isValidEmail(email)) {
        json(response, 400, { error: 'A valid email address is required.' });
        return;
      }

      if (password.length < 8) {
        json(response, 400, { error: 'Password must be at least 8 characters long.' });
        return;
      }

      const users = await readUsers();
      const existingUser = users.find((user) => user.email === email);

      if (existingUser) {
        json(response, 409, { error: 'An account already exists for this email address.' });
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
      await writeUsers(users);
      await sendWelcomeEmail(user);

      json(response, 201, {
        message: 'Account created. Check Mailpit for the welcome email.',
        user: toPublicUser(user),
      });
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/auth/signin') {
      const body = await parseBody(request);
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      const users = await readUsers();
      const user = users.find((entry) => entry.email === email);

      if (!user || !verifyPassword(password, user.passwordHash)) {
        json(response, 401, { error: 'Invalid email or password.' });
        return;
      }

      json(response, 200, {
        token: randomBytes(24).toString('hex'),
        user: toPublicUser(user),
      });
      return;
    }

    if (ENABLE_TEST_ENDPOINTS && request.method === 'POST' && requestUrl.pathname === '/test/reset') {
      await writeUsers([]);
      json(response, 200, { ok: true });
      return;
    }

    json(response, 404, { error: 'Not found.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    json(response, 500, { error: message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Auth API listening on http://0.0.0.0:${PORT}`);
});
