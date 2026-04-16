# Expo Router Auth Template

An Expo Router template with a local auth stack, persisted session state, saved theme mode, and a
live user directory backed by `auth-api`.

## What this repo includes

- Expo Router app with tabs for diagrams, explore, communication, and settings
- `auth-api` for `/auth/signup`, `/auth/signin`, `GET /users`, and `GET /users/:id`
- Mailpit for local signup email capture
- persisted auth session storage
- persisted theme preference storage
- optional `dev-api` seeded REST fixture example kept separate from app user data

## Get started

Install dependencies:

```bash
bun install
```

Create a local env file from the tracked example:

```bash
cp .env.example .env
```

Run the app only:

```bash
bun start
```

Run the app against the local auth stack:

```bash
bun test:e2e:services:up
EXPO_PUBLIC_AUTH_API_URL=http://localhost:4401 bun web
```

Rebuild the auth stack only when Dockerfiles or service dependencies change:

```bash
bun test:e2e:services:rebuild
```

Run the optional seeded fixture example:

```bash
bun dev:api:up
```

Stop services when finished:

```bash
bun dev:api:down
bun test:e2e:services:down
```

## Auth stack

The local auth stack includes:

- `auth-api`: lightweight Node service for auth and public user data
- `mailpit`: local SMTP inbox UI for signup emails

Docker Compose is the supported local runtime for `auth-api`. The non-E2E Bun test suite starts the
server in-process and does not require Docker.

Open Mailpit at `http://localhost:8825`.

The Expo app uses `auth-api` as the canonical user-facing backend:

- `Communication` calls `GET /users` through `EXPO_PUBLIC_AUTH_API_URL`
- `/profile/[profile]` resolves `GET /users/:id`
- signed-up users become visible in the directory after account creation
- auth session state is restored from storage on reload

Useful manual checks:

```bash
curl http://localhost:4401/users
curl http://localhost:4401/users/<user-id>
```

Run the browser e2e suite with:

```bash
bun test:e2e
```

## Optional dev fixture

`dev-api` is an explicitly separate seeded REST example served by
[`moritzbrantner/folder-server`](https://github.com/moritzbrantner/folder-server). It is not the
source of truth for app users.

- `GET /profiles` returns seeded example profiles from `services/dev-api/data/profiles.json`
- `GET /profiles/alex` returns a seeded example profile by `username`
- `GET /healthz` is exposed for local health checks

## Validation

```bash
bun test
bun run lint
bunx tsc --noEmit
bun run build
bunx expo-doctor
bun run test:e2e
```
