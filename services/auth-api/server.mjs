import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import nodemailer from 'nodemailer';

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

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(payload));
}

async function ensureStore() {
  await mkdir(dirname(DATA_FILE), { recursive: true });

  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeFile(DATA_FILE, '[]', 'utf8');
  }
}

async function readUsers() {
  await ensureStore();
  const raw = await readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

async function writeUsers(users) {
  await ensureStore();
  await writeFile(DATA_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expectedHash] = storedHash.split(':');

  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');

  return expected.length === actualHash.length && timingSafeEqual(expected, actualHash);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function parseBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function sendWelcomeEmail(user) {
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
    if (request.method === 'GET' && request.url === '/health') {
      json(response, 200, { ok: true });
      return;
    }

    if (request.method === 'POST' && request.url === '/auth/signup') {
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

      const user = {
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
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
      });
      return;
    }

    if (request.method === 'POST' && request.url === '/auth/signin') {
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
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
      });
      return;
    }

    if (ENABLE_TEST_ENDPOINTS && request.method === 'POST' && request.url === '/test/reset') {
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
