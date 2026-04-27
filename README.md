# expo-template

Expo Router template with a minimal backend example environment for frontend linkage testing.

## What ships here

- Expo Router public/app shell split
- local `auth-api` with:
  - sign-up, sign-in, sign-out, session restore
  - email verification and password reset endpoints
  - self profile editing and avatar upload intents
  - public profiles, follow/unfollow, followers/following
  - derived follow activity
  - `/health` and `/ready`
- Mailpit for local auth email testing
- in-app mock auth runtime that mirrors the same contract

## Run it

Install dependencies:

```bash
bun install
```

Create a local env file:

```bash
cp .env.example .env
```

Run the Expo app against the in-app mock runtime:

```bash
bun dev
```

This seeds regular member accounts and auto-signs in `alex@example.test` with password `password123` unless you override the `EXPO_PUBLIC_DEV_AUTH_*` variables.

Run the local backend example stack:

```bash
bun test:e2e:services:up
EXPO_PUBLIC_AUTH_MODE=api EXPO_PUBLIC_AUTH_API_URL=http://localhost:4401 bun web
```

Open Mailpit at `http://localhost:8825`.

Stop the backend stack:

```bash
bun test:e2e:services:down
```

## Canonical backend surface

- `POST /auth/signup`
- `POST /auth/signin`
- `POST /auth/signout`
- `GET /auth/session`
- `POST /auth/verify-email/request`
- `POST /auth/verify-email/confirm`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/confirm`
- `GET /me/sessions`
- `DELETE /me/sessions/:sessionId`
- `DELETE /me/account`
- `GET /profiles`
- `GET /profiles/:username`
- `GET /me/profile`
- `PATCH /me/profile`
- `POST /me/avatar/upload-intent`
- `POST /me/avatar/complete`
- `GET /usernames/:username/availability`
- `POST /profiles/:username/follow`
- `DELETE /profiles/:username/follow`
- `GET /profiles/:username/followers`
- `GET /profiles/:username/following`
- `GET /me/activity`
- `GET /health`
- `GET /ready`

## Useful checks

```bash
curl http://localhost:4401/health
curl http://localhost:4401/profiles
curl http://localhost:4401/profiles/alex
```

## Validation

```bash
bun test
bunx tsc --noEmit
```
