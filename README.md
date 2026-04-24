# expo-template

Expo Router platform scaffold for auth, authz, social discovery, public profiles, and app-shell behavior backed by the local `auth-api` service.

## What this repo includes

- Expo Router public/app shell split with reusable auth and authenticated-app baselines
- local `auth-api` for sign-up, sign-in, sessions, profiles, follows, activity, and admin role updates
- Mailpit for local auth email smoke coverage
- persisted auth session storage
- persisted theme preference storage
- opt-in local fixture services kept separate from the scaffold contract

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

Run the local dev flow with the in-app mock auth service and automatic sign-in:

```bash
bun dev
```

`bun dev` launches Expo on port `4002` with `EXPO_PUBLIC_AUTH_MODE=mock`. The app uses a local
mock auth service, seeds a few profiles, and auto-signs in `admin@example.test` with password
`password123` unless you override the `EXPO_PUBLIC_DEV_AUTH_*` variables.

Run the app against the local auth stack manually:

```bash
bun test:e2e:services:up
EXPO_PUBLIC_AUTH_API_URL=http://localhost:4401 bun web
```

Rebuild the auth stack only when Dockerfiles or service dependencies change:

```bash
bun test:e2e:services:rebuild
```

Run the optional seeded fixture service:

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

The Expo app uses `auth-api` as the canonical scaffold backend:

- `Discover` calls the profile APIs through `EXPO_PUBLIC_AUTH_API_URL`
- `/u/[username]` resolves public profiles by username
- signed-up users become visible in the directory after account creation
- auth session state is restored from storage on reload
- authenticated app tabs stay behind the protected shell

Useful manual checks:

```bash
curl http://localhost:4401/profiles
curl http://localhost:4401/profiles/<username>
```

Run the browser smoke/auth suite with:

```bash
bun test:e2e
```

## Optional dev fixture

`dev-api` is an explicitly separate seeded REST example served by
[`moritzbrantner/folder-server`](https://github.com/moritzbrantner/folder-server). It is not the
source of truth for scaffold users or auth state.

- `GET /profiles` returns seeded example profiles from `services/dev-api/data/profiles.json`
- `GET /profiles/alex` returns a seeded example profile by `username`
- `GET /healthz` is exposed for local health checks

## Validation

```bash
bun test
bun run test:unit
bun run test:integration
bun run lint
bunx tsc --noEmit
bun run build
bunx expo-doctor
bun run test:e2e
```

See [SCAFFOLD_ALIGNMENT.md](./SCAFFOLD_ALIGNMENT.md) for the repo's scaffold-family role and anti-drift contract.
